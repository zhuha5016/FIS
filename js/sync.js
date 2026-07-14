/* ======================================================================
   sync.js - GitHub 云同步模块
   将 localStorage 中的 fi_* 数据同步到 GitHub 仓库, 实现跨浏览器/设备共享
   方案: 单文件存储 (data/family-data.json), 通过 GitHub Contents API 读写
   冲突策略: 后写入者胜 (last-write-wins), 409 冲突时内部自动重试(max 3次)
   错误策略: 所有临时错误(409/422/网络)完全静默; 仅配置类错误(401/403/404)弹窗
   频率策略: 推送防抖 10秒, 拉取 15秒, 连续失败自动降速到 60秒
   ====================================================================== */

window.FA = window.FA || {};

FA.Sync = {
    /* --------------- 配置 --------------- */
    config: {
        owner: '',                              // GitHub 用户名 / 组织
        repo: '',                               // 仓库名 (如 FIS)
        path: 'data/family-data.json',          // 数据文件路径
        branch: 'main',                         // 分支名
        token: '',                              // Personal Access Token (仅超管可见)
        excludePhotos: true                     // 排除照片 base64 (GitHub 单文件 1MB 限制)
    },

    /* --------------- 运行时状态 --------------- */
    status: 'disabled',     // disabled | idle | syncing | success | error
    lastSyncTime: null,
    lastError: '',
    remoteSha: null,        // 远程文件 blob sha (冲突检测用)
    _pushTimer: null,
    _pullTimer: null,
    _hasPendingPush: false, // 是否有未推送的本地改动 (防止自动拉取覆盖)
    _syncInProgress: false, // 是否正在同步(推/拉), 防止并发导致 409/422
    _token: '',            // 从 fi_sync_token 单独读取, 不推送到 GitHub
    _initialized: false,
    _consecutiveFails: 0,  // 连续失败计数 (用于自动降速)
    _pullIntervalMs: 15000, // 自动拉取间隔 (动态: 失败多则变慢)

    /* 不应同步的键 (会话 / 纯本地偏好 / 同步配置 / Token) */
    EXCLUDE_KEYS: [
        'fi_session',          // 旧会话键 (已废弃)
        'fi_language',          // 语言偏好 (本地)
        'fi_sync_config',       // 同步配置 (仓库地址等, 本地配置即可)
        'fi_sync_token'         // Token 绝不能同步到 GitHub
    ],

    /* ============================================================
       初始化
       ============================================================ */
    init: function() {
        if (this._initialized) return;
        this._initialized = true;

        /* 读取已保存的配置 (不含 token) */
        var saved = FA.Data.loadData('fi_sync_config', null);
        if (saved) {
            var cfg = Object.assign({}, this.config, saved);
            /* 兼容旧配置: 如果 token 之前保存在 fi_sync_config 中, 迁移后清除 */
            if (cfg.token) {
                var legacyToken = cfg.token;
                delete cfg.token;
                this._token = legacyToken;
                localStorage.setItem('fi_sync_token', JSON.stringify(legacyToken));
                FA.Data.saveData('fi_sync_config', cfg);
            }
            this.config = cfg;
        }
        /* token 单独读取 */
        var tk = localStorage.getItem('fi_sync_token');
        if (tk) {
            try { tk = JSON.parse(tk); } catch (e) {}
            this._token = (typeof tk === 'string') ? tk : '';
        }

        /* 挂钩 saveData, 数据变更时自动推送 */
        this._hookSaveData();

        /* 已配置则启动自动拉取 + 首拉 */
        if (this.isConfigured()) {
            this.startAutoPull();
            var self = this;
            setTimeout(function() { self.pull(); }, 1500);
            this.setStatus('idle');
        }
    },

    isConfigured: function() {
        return !!(this.config.owner && this.config.repo && this._token);
    },

    /* 解析 GitHub 错误响应, 返回可读信息 (含 GitHub 原始 message) */
    _extractError: function(res) {
        var self = this;
        return res.text().then(function(text) {
            var msg = 'GitHub API 错误 ' + res.status;
            try {
                var j = JSON.parse(text);
                if (j && j.message) {
                    msg += ': ' + j.message;
                    if (j.message.indexOf('size limit') !== -1 || j.message.indexOf('exceeds') !== -1) {
                        msg += '（数据超过 GitHub 单文件 1MB 限制，建议排除照片后重试）';
                    } else if (j.message.indexOf('Bad credentials') !== -1) {
                        msg += '（Token 无效或已过期）';
                    } else if (j.message.indexOf('Resource not accessible') !== -1) {
                        msg += '（Token 无权限，检查细粒度 Token 的仓库访问与 Contents 读写权限）';
                    } else if (j.message.indexOf('Not Found') !== -1) {
                        msg += '（仓库/文件不存在或无权限，检查 owner/repo/branch）';
                    } else if (j.message.indexOf('branch') !== -1) {
                        msg += '（分支不存在，检查 branch 配置）';
                    }
                }
            } catch (e) {}
            return msg;
        });
    },

    /* 测试连接: 验证 Token 与仓库可访问性 */
    testConnection: function() {
        if (!this.isConfigured()) {
            return FA.showToast('请先填写完整配置（owner / repo / token）', 'error');
        }
        var self = this;
        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo);
        FA.showToast('正在测试连接…', 'info');
        fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + this._token,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(function(res) {
            if (res.status === 200) {
                FA.showToast('✅ 连接成功：仓库可访问，Token 有效', 'success');
            } else if (res.status === 401) {
                FA.showToast('❌ Token 无效或已过期（401 Bad credentials）', 'error');
            } else if (res.status === 403) {
                FA.showToast('❌ Token 无权限访问该仓库（403，检查细粒度 Token 的仓库访问与 Contents 读写权限）', 'error');
            } else if (res.status === 404) {
                FA.showToast('❌ 仓库不存在或无权限（404，检查 owner/repo 是否正确）', 'error');
            } else {
                return self._extractError(res).then(function(m){ FA.showToast('❌ ' + m, 'error'); });
            }
        }).catch(function(err) {
            FA.showToast('❌ 网络错误：' + err.message + '（可能是 CORS 或网络被拦截）', 'error');
        });
    },

    saveConfig: function(cfg) {
        var token = cfg.token || '';
        delete cfg.token;                     // 配置对象中不存 token
        this.config = Object.assign({}, this.config, cfg);

        /* token 单独保存到本地, 绝不同步到 GitHub */
        if (token) {
            this._token = token;
            localStorage.setItem('fi_sync_token', JSON.stringify(token));
        }

        FA.Data.saveData('fi_sync_config', this.config);
        if (this.isConfigured()) {
            this.startAutoPull();
            this.pull();
        }
    },

    /* ============================================================
       收集本地数据 (所有 fi_* 键, 排除会话)
       ============================================================ */
    collectLocalData: function() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key || key.indexOf('fi_') !== 0) continue;
            if (key.indexOf('fi_session_') === 0) continue;       // 会话隔离键
            if (this.EXCLUDE_KEYS.indexOf(key) !== -1) continue;  // 本地偏好
            if (this.config.excludePhotos && key === 'fi_photos') continue;  // 照片 base64 体积大, 跳过避免 1MB 限制
            try {
                data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    },

    /* ============================================================
       将远程数据应用到本地
       返回是否有变更
       ============================================================ */
    applyRemoteData: function(remoteData) {
        if (!remoteData || !remoteData.data) return { changed: false, keys: [] };
        var changed = false;
        var changedKeys = [];
        Object.keys(remoteData.data).forEach(function(key) {
            var value = remoteData.data[key];
            var serialized = JSON.stringify(value);
            if (localStorage.getItem(key) !== serialized) {
                localStorage.setItem(key, serialized);
                changed = true;
                changedKeys.push(key);
            }
        });
        /* 内存对象刷新 */
        if (changed && FA.Data && FA.Data.init) {
            FA.Data.init();
            if (FA.currentUser && FA.Data.loadUserLayout) FA.Data.loadUserLayout();
        }
        return { changed: changed, keys: changedKeys };
    },

    /* ============================================================
       从 GitHub 拉取
       ============================================================ */
    pull: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);
        if (this._syncInProgress) return Promise.resolve(false);
        this._syncInProgress = true;

        this.setStatus('syncing');
        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo) + '/contents/' +
                  encodeURIComponent(this.config.path) + '?ref=' + encodeURIComponent(this.config.branch);

        return fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + this._token,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(function(res) {
            if (res.status === 404) {
                /* 文件不存在: 当作空仓库, 触发一次推送初始化 */
                self.remoteSha = null;
                self.setStatus('idle');
                return false;
            }
            if (!res.ok) return self._extractError(res).then(function(m){ throw new Error(m); });
            return res.json();
        }).then(function(json) {
            if (json === false) return false;
            if (!json || !json.content) { self.setStatus('idle'); return false; }
            /* base64 -> UTF-8 文本 */
            var binary = atob(json.content.replace(/\s/g, ''));
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var text = new TextDecoder('utf-8').decode(bytes);
            var remoteData = JSON.parse(text);

            self.remoteSha = json.sha;
            var result = self.applyRemoteData(remoteData);
            self.setStatus('success');
            self.lastSyncTime = new Date();

            /* 聊天数据变化时实时刷新聊天界面 */
            if (result.keys.indexOf(FA.DB_KEYS.chatMessages) !== -1) {
                if (FA.Chat && FA.Chat.renderChatList) {
                    FA.Chat.renderChatList();
                    if (FA.Chat.currentChatUser && FA.Chat.renderMessages) FA.Chat.renderMessages();
                    FA.Chat.checkNewMessages();
                }
            }
            /* 活跃会话变化时触发单点登录检查 */
            if (result.keys.indexOf(FA.DB_KEYS.activeSessions) !== -1) {
                if (FA.Auth && FA.Auth.checkSingleSignOn) FA.Auth.checkSingleSignOn();
            }

            if (result.changed && FA.renderAll) FA.renderAll();
            return result.changed;
        }).catch(function(err) {
            var msg = (err && err.message) ? err.message : '';
            /* 所有拉取错误都静默处理:
               - 网络抖动 / 409 / 422 → 下次自动重试
               - 401/403/404 → 仅更新状态指示器, 不弹窗 (拉取失败不紧急)
               拉取是被动操作, 不需要打扰用户 */
            var isTransient = (err && err.name === 'TypeError') ||
                /failed to fetch|network|timeout|abort|409|422/i.test(msg);
            if (isTransient) {
                self._consecutiveFails++;
                self._slowDownIfNeeded();
                self.setStatus('idle');
                console.warn('[Sync] 拉取临时失败 (已静默):', msg);
            } else {
                /* 配置类错误: 更新状态但不弹窗 (拉取不是用户主动操作) */
                self.setStatus('error', msg);
                console.error('[Sync] 拉取失败:', err);
            }
            return false;
        }).finally(function() {
            self._syncInProgress = false;
        });
    },

    /* ============================================================
       推送到 GitHub
       策略: 409/422 冲突 → 内部自动重试(max 3次, 指数退避)
             所有临时错误(冲突/网络) → 完全静默, 不弹窗
             仅 401/403/404 等配置类错误 → 弹窗提醒用户
       ============================================================ */
    push: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);
        if (this._syncInProgress) {
            this._hasPendingPush = true;
            return Promise.resolve(false);
        }
        this._syncInProgress = true;
        this._hasPendingPush = false;
        this.setStatus('syncing');

        var payload = {
            version: 2,
            updatedAt: new Date().toISOString(),
            data: this.collectLocalData()
        };

        return self._doPushWithRetry(payload, 0).then(function(success) {
            if (success) {
                self._consecutiveFails = 0;
                self._restorePullInterval();
                self.setStatus('success');
                self.lastSyncTime = new Date();
            } else {
                /* 重试次数耗尽: 标记待推送, 等下一轮 schedulePush 自动重试 */
                self._consecutiveFails++;
                self._slowDownIfNeeded();
                self.setStatus('idle');
                self._hasPendingPush = true;
            }
            return success;
        }).catch(function(err) {
            var msg = (err && err.message) ? err.message : '';
            /* 错误分级:
               - 网络抖动 / 409 SHA 冲突 / 422 状态异常 → 完全静默, 自动降速重试
               - 401 Token失效 / 403 无权限 / 404 仓库不存在 → 弹窗, 需用户处理 */
            var isNetworkError = (err && err.name === 'TypeError') ||
                /failed to fetch|network|timeout|abort/i.test(msg);
            var isTransientConflict = /409|422|does not match|sha/i.test(msg);
            if (isNetworkError || isTransientConflict) {
                self._consecutiveFails++;
                self._slowDownIfNeeded();
                self.setStatus('idle');
                self._hasPendingPush = true;
                console.warn('[Sync] 推送临时失败 (已静默, 将自动重试):', msg);
            } else {
                self.setStatus('error', msg);
                console.error('[Sync] 推送失败 (需用户处理):', err);
                if (FA.showToast) FA.showToast('☁️ 同步配置错误: ' + msg, 'error');
            }
            return false;
        }).finally(function() {
            self._syncInProgress = false;
            if (self._hasPendingPush) self.schedulePush();
        });
    },

    /* 内部: 带重试的推送 (max 3次, 指数退避 1s/2s/4s) */
    _doPushWithRetry: function(payload, attempt) {
        var self = this;
        var maxRetries = 3;

        var jsonStr = JSON.stringify(payload, null, 2);
        var bytes = new TextEncoder().encode(jsonStr);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        var content = btoa(binary);

        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo) + '/contents/' +
                  encodeURIComponent(this.config.path);

        var body = {
            message: '🔄 家庭数据同步 ' + new Date().toLocaleString('zh-CN'),
            content: content,
            branch: this.config.branch
        };
        if (this.remoteSha) body.sha = this.remoteSha;

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + self._token,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(function(res) {
            if (res.status === 409 || res.status === 422) {
                /* SHA 冲突 / 文件状态异常: 先拉取最新 sha, 再重试 */
                if (attempt < maxRetries) {
                    return self._refreshSha().then(function() {
                        var delay = Math.pow(2, attempt) * 1000; /* 1s, 2s, 4s */
                        return new Promise(function(r) { setTimeout(r, delay); });
                    }).then(function() {
                        return self._doPushWithRetry(payload, attempt + 1);
                    });
                }
                /* 重试次数耗尽: 静默放弃, 等下次 schedulePush */
                return false;
            }
            if (!res.ok) return self._extractError(res).then(function(m){ throw new Error(m); });
            return res.json();
        }).then(function(json) {
            if (json && json.content && json.content.sha) self.remoteSha = json.content.sha;
            return true;
        });
    },

    /* 仅刷新 remoteSha (轻量 pull, 不 applyRemoteData) */
    _refreshSha: function() {
        var self = this;
        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo) + '/contents/' +
                  encodeURIComponent(this.config.path) + '?ref=' + encodeURIComponent(this.config.branch);
        return fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + self._token,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(function(res) {
            if (!res.ok) return null;
            return res.json();
        }).then(function(json) {
            if (json && json.sha) self.remoteSha = json.sha;
            /* 同时 apply 远程数据 (保持本地最新) */
            if (json && json.content) {
                try {
                    var binary = atob(json.content.replace(/\s/g, ''));
                    var bytes = new Uint8Array(binary.length);
                    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    var text = new TextDecoder('utf-8').decode(bytes);
                    var remoteData = JSON.parse(text);
                    self.applyRemoteData(remoteData);
                } catch (e) {}
            }
        }).catch(function() { /* 静默: refreshSha 失败不影响主流程 */ });
    },

    /* ============================================================
       自动推送 (数据变更时, 防抖 10 秒 — 批量合并多次变更, 减少冲突)
       ============================================================ */
    schedulePush: function() {
        if (!this.isConfigured()) return;
        this._hasPendingPush = true;
        var self = this;
        if (this._pushTimer) clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(function() {
            self.push();
        }, 10000);
    },

    /* ============================================================
       自动拉取 (动态间隔: 正常 15 秒, 连续失败后自动降速到 60 秒)
       本地有未推送改动或同步进行中时跳过, 避免覆盖/并发
       ============================================================ */
    startAutoPull: function() {
        var self = this;
        if (this._pullTimer) clearInterval(this._pullTimer);
        this._pullTimer = setInterval(function() {
            if (self._hasPendingPush || self._syncInProgress) return;
            self.pull();
        }, this._pullIntervalMs);
    },

    /* 连续失败 3 次以上 → 拉取间隔降到 60 秒 (减少冲突/API消耗) */
    _slowDownIfNeeded: function() {
        if (this._consecutiveFails >= 3 && this._pullIntervalMs < 60000) {
            this._pullIntervalMs = 60000;
            this.startAutoPull();
            console.warn('[Sync] 连续失败 ' + this._consecutiveFails + ' 次, 拉取间隔降为 60 秒');
        }
    },

    /* 成功后恢复正常拉取间隔 */
    _restorePullInterval: function() {
        if (this._pullIntervalMs !== 15000) {
            this._pullIntervalMs = 15000;
            this.startAutoPull();
            console.log('[Sync] 恢复正常拉取间隔 (15 秒)');
        }
    },

    /* ============================================================
       状态指示器
       ============================================================ */
    setStatus: function(status, error) {
        this.status = status;
        if (error) this.lastError = error;
        var indicator = document.getElementById('syncStatusIndicator');
        if (!indicator) return;
        var map = {
            disabled: { text: '未启用', color: '#999' },
            idle:     { text: '空闲',   color: '#888' },
            syncing:  { text: '同步中…', color: '#007AFF' },
            success:  { text: '已同步', color: '#28a745' },
            error:    { text: '同步失败', color: '#e74c3c' }
        };
        var info = map[status] || map.idle;
        var timeStr = this.lastSyncTime ? ' · ' + this.lastSyncTime.toLocaleTimeString('zh-CN') : '';
        indicator.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' +
            info.color + ';margin-right:6px' + (status === 'syncing' ? ';animation:pulse 1s infinite' : '') + '"></span>' +
            info.text + timeStr;
        indicator.title = error || '';
    },

    /* ============================================================
       saveData 钩子: 任何 fi_* 写入都触发自动推送
       ============================================================ */
    _hookSaveData: function() {
        var self = this;
        var origSave = FA.Data.saveData;
        FA.Data.saveData = function(key, data) {
            var result = origSave.call(FA.Data, key, data);
            if (key && key.indexOf('fi_') === 0 &&
                key.indexOf('fi_session_') !== 0 &&
                key !== 'fi_sync_token') {
                self.schedulePush();
            }
            return result;
        };
    },

    /* ============================================================
       配置弹窗入口: 先弹身份验证框, 通过后再打开配置 (所有用户可用)
       ============================================================ */
    openConfigWithVerify: function() {
        FA.Verify.requireVerify('修改云同步配置', 'normal', function(success) {
            if (success) FA.Sync.showConfigModal();
        });
    },

    /* ============================================================
       配置弹窗 (身份验证通过后可调用, 所有用户可用)
       ============================================================ */
    showConfigModal: function() {
        if (!FA.currentUser) {
            return FA.showToast('请先登录', 'error');
        }
        var modalId = 'sync-config-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var cfg = FA.Sync.config;
        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:480px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>☁️ GitHub 云同步配置</h3></div>' +
                '<p style="font-size:12px;color:#888;margin-bottom:14px">配置后, 所有 fi_* 数据自动同步到 GitHub 仓库, 实现跨浏览器 / 设备共享。需要 Personal Access Token (repo 权限)。</p>' +
                '<div class="modal-field"><label>仓库所有者 / 组织</label><input id="syncOwner" value="' + FA._esc(cfg.owner || '') + '" placeholder="例如: zhuha5016"></div>' +
                '<div class="modal-field"><label>仓库名</label><input id="syncRepo" value="' + FA._esc(cfg.repo || '') + '" placeholder="例如: FIS"></div>' +
                '<div class="modal-field"><label>分支</label><input id="syncBranch" value="' + FA._esc(cfg.branch || 'main') + '"></div>' +
                '<div class="modal-field"><label>数据文件路径</label><input id="syncPath" value="' + FA._esc(cfg.path || 'data/family-data.json') + '"></div>' +
                '<div class="modal-field"><label>Access Token</label><input id="syncToken" type="password" value="' + FA._esc(FA.Sync._token || '') + '" placeholder="ghp_xxx 或 github_pat_xxx"></div>' +
                '<div style="margin:6px 0 10px;font-size:12px;color:#555"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="syncExcludePhotos" ' + (cfg.excludePhotos === false ? '' : 'checked') + '> 排除照片 (base64, 避免 GitHub 单文件 1MB 限制)</label></div>' +
                '<div style="font-size:11px;color:#aaa;margin:0 0 14px;line-height:1.5">Token 保存在本浏览器 localStorage, 仅用于读写该仓库的数据文件。建议创建仅限此仓库的细粒度 Token。</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.Sync.testConnection()">测试连接</button>' +
                    '<button class="btn-secondary" onclick="FA.Sync.disableSync()">停用</button>' +
                    '<button class="btn-primary" onclick="FA.Sync.saveConfigFromModal()">保存并启用</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    saveConfigFromModal: function() {
        var cfg = {
            owner:  document.getElementById('syncOwner').value.trim(),
            repo:   document.getElementById('syncRepo').value.trim(),
            branch: document.getElementById('syncBranch').value.trim() || 'main',
            path:   document.getElementById('syncPath').value.trim() || 'data/family-data.json',
            token:  document.getElementById('syncToken').value.trim(),
            excludePhotos: document.getElementById('syncExcludePhotos') ? document.getElementById('syncExcludePhotos').checked : true
        };
        if (!cfg.owner || !cfg.repo || !cfg.token) {
            return FA.showToast('请填写完整配置', 'error');
        }
        FA.Sync.saveConfig(cfg);
        FA.closeModal('sync-config-modal');
        FA.showToast('云同步已启用', 'success');
        var area = document.getElementById('syncStatusArea');
        if (area) area.style.display = '';
    },

    disableSync: function() {
        FA.Sync._token = '';
        localStorage.removeItem('fi_sync_token');
        FA.Sync.config = Object.assign({}, FA.Sync.config, {
            owner: '', repo: '', path: 'data/family-data.json', branch: 'main', excludePhotos: true
        });
        FA.Data.saveData('fi_sync_config', FA.Sync.config);
        if (FA.Sync._pullTimer) clearInterval(FA.Sync._pullTimer);
        FA.Sync.setStatus('disabled');
        FA.closeModal('sync-config-modal');
        FA.showToast('已停用云同步', 'info');
        var area = document.getElementById('syncStatusArea');
        if (area) area.style.display = 'none';
    }
};
