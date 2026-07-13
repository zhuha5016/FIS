/* ======================================================================
   sync.js - GitHub 云同步模块
   将 localStorage 中的 fi_* 数据同步到 GitHub 仓库, 实现跨浏览器/设备共享
   方案: 单文件存储 (data/family-data.json), 通过 GitHub Contents API 读写
   冲突策略: 后写入者胜 (last-write-wins), 409 冲突时先拉取再重试
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
    _token: '',            // 从 fi_sync_token 单独读取, 不推送到 GitHub
    _initialized: false,

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
        if (!remoteData || !remoteData.data) return false;
        var changed = false;
        Object.keys(remoteData.data).forEach(function(key) {
            var value = remoteData.data[key];
            var serialized = JSON.stringify(value);
            if (localStorage.getItem(key) !== serialized) {
                localStorage.setItem(key, serialized);
                changed = true;
            }
        });
        /* 内存对象刷新 */
        if (changed && FA.Data && FA.Data.init) {
            FA.Data.init();
            if (FA.currentUser && FA.Data.loadUserLayout) FA.Data.loadUserLayout();
        }
        return changed;
    },

    /* ============================================================
       从 GitHub 拉取
       ============================================================ */
    pull: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);

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
            if (!json || !json.content) { self.setStatus('idle'); return false; }
            /* base64 -> UTF-8 文本 */
            var binary = atob(json.content.replace(/\s/g, ''));
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var text = new TextDecoder('utf-8').decode(bytes);
            var remoteData = JSON.parse(text);

            self.remoteSha = json.sha;
            var changed = self.applyRemoteData(remoteData);
            self.setStatus('success');
            self.lastSyncTime = new Date();
            if (changed && FA.renderAll) FA.renderAll();
            return changed;
        }).catch(function(err) {
            self.setStatus('error', err.message);
            console.error('[Sync] 拉取失败:', err);
            return false;
        });
    },

    /* ============================================================
       推送到 GitHub
       ============================================================ */
    push: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);

        this._hasPendingPush = false;
        this.setStatus('syncing');

        var payload = {
            version: 2,
            updatedAt: new Date().toISOString(),
            data: this.collectLocalData()
        };

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
                'Authorization': 'Bearer ' + this._token,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(function(res) {
            if (res.status === 409) {
                /* 冲突: 远程已被他人修改 -> 先拉取再重试 */
                return self.pull().then(function() { return self._retryPush(payload); });
            }
            if (!res.ok) return self._extractError(res).then(function(m){ throw new Error(m); });
            return res.json();
        }).then(function(json) {
            if (json && json.content && json.content.sha) self.remoteSha = json.content.sha;
            self.setStatus('success');
            self.lastSyncTime = new Date();
            return true;
        }).catch(function(err) {
            self.setStatus('error', err.message);
            console.error('[Sync] 推送失败:', err);
            if (FA.showToast) FA.showToast('☁️ 同步失败: ' + err.message, 'error');
            return false;
        });
    },

    /* 冲突后重试 (使用最新 sha) */
    _retryPush: function(payload) {
        var self = this;
        var jsonStr = JSON.stringify(payload, null, 2);
        var bytes = new TextEncoder().encode(jsonStr);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        var content = btoa(binary);

        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo) + '/contents/' +
                  encodeURIComponent(this.config.path);

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + this._token,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: '🔄 家庭数据同步 (冲突重试) ' + new Date().toLocaleString('zh-CN'),
                content: content,
                branch: this.config.branch,
                sha: this.remoteSha
            })
        }).then(function(res) {
            if (!res.ok) return self._extractError(res).then(function(m){ throw new Error(m); });
            return res.json();
        }).then(function(json) {
            if (json && json.content && json.content.sha) self.remoteSha = json.content.sha;
            return true;
        });
    },

    /* ============================================================
       自动推送 (数据变更时, 防抖 3 秒)
       ============================================================ */
    schedulePush: function() {
        if (!this.isConfigured()) return;
        this._hasPendingPush = true;
        var self = this;
        if (this._pushTimer) clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(function() {
            self.push();
        }, 3000);
    },

    /* ============================================================
       自动拉取 (每 60 秒, 但本地有未推送改动时跳过)
       ============================================================ */
    startAutoPull: function() {
        var self = this;
        if (this._pullTimer) clearInterval(this._pullTimer);
        this._pullTimer = setInterval(function() {
            if (self._hasPendingPush) return;  // 避免覆盖本地未保存编辑
            self.pull();
        }, 60000);
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
       配置弹窗 (仅超管可调用)
       ============================================================ */
    showConfigModal: function() {
        if (!FA.currentUser || FA.currentUser.role !== 'superadmin') {
            return FA.showToast('仅超级管理员可配置云同步', 'error');
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
