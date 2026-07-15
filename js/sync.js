/* ======================================================================
   sync.js - GitHub 云同步模块
   将 localStorage 中的 fi_* 数据同步到 GitHub 仓库, 实现跨浏览器/设备共享
   方案: 单文件存储 (data/family-data.json), 通过 GitHub Contents API 读写

   冲突策略 (根治版, v20260714e → v20260715a 提速/稳化):
   - 采用「合并式同步 (CRDT-lite)」, 彻底消除 409 死循环与新建/删除账号丢失
   - 推送前先拉取最新远程, 用 reconcile() 把「本地改动」与「远程改动」合并:
       * fi_accounts / fi_active_sessions: 按 username 并集 (两边同时新增都保留)
       * fi_chat_messages: 按消息 id 合并 (不丢消息)
       * 数组成员(成员/设备/日程/审批...): 按 id 并集, 两边同时新增都保留
       * 已删除账号: 通过 fi_deleted_usernames 并集, 合并后从 fi_accounts 剔除
   - 推送遇到 409/422 → 重新拉取最新再合并重试 (最多 5 次), 必然收敛
   - 拉取绝不整体覆盖本地: 用 reconcile 让本地未推送改动存活, 仅补入远程增量

   提速/稳化 (v20260715a):
   - ETag 条件拉取: 远程未变时返回 304, 免解析/免冲突, 拉取近乎零成本
   - 脏数据检测: 本地数据未变化时跳过推送, 大幅减少 409 风暴与 API 消耗
   - 推送防抖 10s→6s, 拉取 15s→12s, 同步更跟手
   - 切回标签页 / 其他标签改动 → 立即拉取 (跨标签近乎实时)
   - 远程数据内存缓存, 配合 ETag 让推送合并始终有正确基线

   错误策略: 所有临时错误(409/422/网络)完全静默; 仅配置类错误(401/403/404)弹窗
   频率策略: 推送防抖 6秒, 拉取 12秒, 连续失败自动降速到 60秒
   并发控制: 跨标签锁 (fi_sync_lock), 避免同浏览器多标签同时推送造成 409 风暴
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
    _pullIntervalMs: 12000, // 自动拉取间隔 (动态: 失败多则变慢)
    _lastPushedSig: null,    // 上次成功推送的本地数据签名 (脏检测: 未变化则跳过)
    _remoteEtag: null,       // 远程文件 ETag (条件拉取 304)
    _lastRemoteData: null,    // 远程数据内存缓存 (配合 ETag, 推送合并基线)

    /* 不应同步的键 (会话 / 纯本地偏好 / 同步配置 / Token) */
    EXCLUDE_KEYS: [
        'fi_session',          // 旧会话键 (已废弃)
        'fi_language',          // 语言偏好 (本地)
        'fi_sync_config',       // 同步配置 (仓库地址等, 本地配置即可)
        'fi_sync_token',        // Token 绝不能同步到 GitHub
        'fi_sync_lock'          // 跨标签临时锁, 非业务数据, 且每次加锁都会变 → 必须排除, 否则脏签名恒变
    ],

    /* ============================================================
       初始化
       ============================================================ */
    init: function() {
        if (this._initialized) return;
        this._initialized = true;
        var self = this;

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
            setTimeout(function() { self.pull(); }, 1500);
            /* 首拉后主动推送一次本地数据 (含 fi_accounts 等),
               确保新建/修复的本地账号尽快上云, 供 RDM 拉取 */
            setTimeout(function() { self.schedulePush(); }, 3000);
            this.setStatus('idle');
        }

        /* 提速: 切回标签页 或 其他标签改了 fi_* → 立即拉取 (跨标签近乎实时) */
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible' && self.isConfigured()) self.pull();
        });
        window.addEventListener('storage', function(e) {
            if (e && e.key && e.key.indexOf('fi_') === 0 &&
                e.key.indexOf('fi_session_') !== 0 && e.key !== 'fi_sync_token') {
                if (self.isConfigured()) self.pull();
            }
        });
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
    /* 将远程数据合并应用到本地 (pull 用)
       关键: 使用 reconcile 做「本地优先 + 远程增量合并」, 绝不整体覆盖本地未推送的改动 */
    applyRemoteData: function(remoteData) {
        if (!remoteData || !remoteData.data) return { changed: false, keys: [] };
        var local = this.collectLocalData();
        var merged = this.reconcile(local, remoteData.data);
        return this._writeMerged(merged);
    },

    /* 把合并结果写回 localStorage, 并刷新内存对象
       返回 { changed, keys } 供调用方做聊天刷新 / 单点登录检查 */
    _writeMerged: function(merged) {
        var changed = false;
        var changedKeys = [];
        Object.keys(merged).forEach(function(key) {
            var serialized = JSON.stringify(merged[key]);
            if (localStorage.getItem(key) !== serialized) {
                localStorage.setItem(key, serialized);
                changed = true;
                changedKeys.push(key);
            }
        });
        if (changed && FA.Data && FA.Data.init) {
            FA.Data.init();
            if (FA.currentUser && FA.Data.loadUserLayout) FA.Data.loadUserLayout();
        }
        return { changed: changed, keys: changedKeys };
    },

    /* ============================================================
       从 GitHub 拉取 (pull)
       用 reconcile 合并, 不会覆盖本地未推送改动
       ============================================================ */
    pull: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);
        if (this._syncInProgress) return Promise.resolve(false);
        if (!this._acquireLock()) return Promise.resolve(false);  // 跨标签互斥, 避免并发
        this._syncInProgress = true;
        this.setStatus('syncing');

        return this._getRemote().then(function(remote) {
            if (!remote) { self.setStatus('idle'); return false; }
            /* 远程未变 (304): 免解析/免冲突, 直接成功返回 */
            if (remote.notModified) {
                self._consecutiveFails = 0;
                self._restorePullInterval();
                self.setStatus('success');
                self.lastSyncTime = new Date();
                return false;
            }
            self.remoteSha = remote.sha;
            var result = self.applyRemoteData(remote);
            self.setStatus('success');
            self.lastSyncTime = new Date();
            /* 拉取到的远程数据无需回推: 更新脏签名, 避免立刻又推一次 */
            self._lastPushedSig = self._sig(self.collectLocalData());
            self._consecutiveFails = 0;
            self._restorePullInterval();

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
            self._releaseLock();
        });
    },

    /* ============================================================
       推送到 GitHub (push) — 合并式, 根治 409 与账号丢失
       流程: 拉最新 → reconcile(本地,远程) → PUT 合并结果
             409/422 → 重新拉取再合并重试 (最多 5 次), 必然收敛
       ============================================================ */
    push: function() {
        var self = this;
        if (!this.isConfigured()) return Promise.resolve(false);
        if (this._syncInProgress) { this._hasPendingPush = true; return Promise.resolve(false); }
        if (!this._acquireLock()) {
            /* 其他标签正在推送, 稍后重试 */
            this._hasPendingPush = true;
            this.schedulePush();
            return Promise.resolve(false);
        }
        this._syncInProgress = true;
        this._hasPendingPush = false;
        /* 脏检测: 本地数据自上次成功推送后未变化 → 跳过网络请求,
           大幅减少无谓的 409 与 API 消耗 (提速 + 稳化) */
        var sig = this._sig(this.collectLocalData());
        if (this._lastPushedSig === sig) {
            this._syncInProgress = false;
            this._releaseLock();
            this.setStatus('idle');
            return Promise.resolve(false);
        }
        this.setStatus('syncing');
        return this._pushLoop(0).then(function(success) {
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
            if (isNetworkError) {
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
            self._releaseLock();
            if (self._hasPendingPush) self.schedulePush();
        });
    },

    /* 推送重试循环: 每次都重新拉取最新, 合并后 PUT
       409/422 → 重新拉取再合并重试 (最多 5 次), 必然收敛到一致状态 */
    _pushLoop: function(attempt) {
        var self = this;
        var MAX = 5;
        return self._getRemote().then(function(remote) {
            var local = self.collectLocalData();
            /* 合并: 本地改动优先, 同时补入远程独有增量 (根治覆盖/丢失) */
            var merged = remote ? self.reconcile(local, remote.data) : local;

            var jsonStr = JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), data: merged }, null, 2);
            var bytes = new TextEncoder().encode(jsonStr);
            var binary = '';
            for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            var content = btoa(binary);

            var url = 'https://api.github.com/repos/' + encodeURIComponent(self.config.owner) + '/' +
                      encodeURIComponent(self.config.repo) + '/contents/' +
                      encodeURIComponent(self.config.path);
            var body = {
                message: '🔄 家庭数据同步 ' + new Date().toLocaleString('zh-CN'),
                content: content,
                branch: self.config.branch
            };
            if (remote && remote.sha) body.sha = remote.sha;

            return fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + self._token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }).then(function(res) {
                if (res.ok) {
                    return res.json().then(function(j) {
                        if (j && j.content && j.content.sha) self.remoteSha = j.content.sha;
                        /* 把合并结果写回本地, 使本地与远程立即一致 (含对方新增) */
                        self._writeMerged(merged);
                        /* 记录已推送签名, 后续未变化时跳过推送 */
                        self._lastPushedSig = self._sig(merged);
                        return true;
                    });
                }
                if (res.status === 409 || res.status === 422) {
                    /* SHA 冲突 / 文件状态异常: 重新拉取最新再合并重试 */
                    if (attempt < MAX) {
                        console.warn('[Sync] 推送冲突 (' + res.status + '), 重新拉取合并重试 ' + (attempt + 1) + '/' + MAX);
                        return self._pushLoop(attempt + 1);
                    }
                    return false; /* 极端情况下放弃, 等下次 schedulePush */
                }
                return self._extractError(res).then(function(m){ throw new Error(m); });
            });
        });
    },

    /* 拉取远程文件 (返回 {sha, data} / {notModified:true} / null=404); fatal 错误抛出
       提速: 带 If-None-Match (ETag), 远程未变时返回 304 → notModified, 零解析零冲突
       稳化: 缓存最近一次远程数据, 配合 304 作为推送合并基线 */
    _getRemote: function() {
        var self = this;
        var url = 'https://api.github.com/repos/' + encodeURIComponent(this.config.owner) + '/' +
                  encodeURIComponent(this.config.repo) + '/contents/' +
                  encodeURIComponent(this.config.path) + '?ref=' + encodeURIComponent(this.config.branch);
        var headers = {
            'Authorization': 'Bearer ' + self._token,
            'Accept': 'application/vnd.github.v3+json'
        };
        if (self._remoteEtag) headers['If-None-Match'] = self._remoteEtag;
        return fetch(url, { headers: headers }).then(function(res) {
            if (res.status === 304) {
                /* 远程未修改: 复用缓存的 sha 与数据, 省去下载与解析 */
                return { notModified: true, sha: self.remoteSha, data: self._lastRemoteData || null };
            }
            var etag = res.headers.get('ETag');
            if (etag) self._remoteEtag = etag;
            if (res.status === 404) return null;
            if (!res.ok) return self._extractError(res).then(function(m){ throw new Error(m); });
            return res.json();
        }).then(function(json) {
            if (!json) return null;
            if (json.notModified) return json; // 透传 304 结果, 不破坏 notModified / 缓存数据
            if (!json.content) { self._lastRemoteData = {}; return { sha: json.sha || null, data: {} }; }
            var binary = atob(json.content.replace(/\s/g, ''));
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var text = new TextDecoder('utf-8').decode(bytes);
            var remoteData = JSON.parse(text);
            var data = (remoteData && remoteData.data) ? remoteData.data : {};
            self._lastRemoteData = data; // 缓存, 配合 ETag 在 304 时作合并基线
            return { sha: json.sha, data: data };
        });
    },

    /* ============================================================
       脏数据签名: 轻量 FNV-1a 32 位哈希
       用于判断「本地数据是否真的发生了变化」, 未变化则跳过推送
       (JSON 键序稳定, 同一对象序列化结果一致, 签名可复现)
       ============================================================ */
    _sig: function(data) {
        var s = JSON.stringify(data);
        var h = 0x811c9dc5;
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        return h.toString(16);
    },

    /* ============================================================
       合并算法 (reconcile)
       本地改动优先 (local-wins), 同时补入远程独有增量, 彻底消除覆盖与丢失
       ============================================================ */
    reconcile: function(local, remote) {
        var out = {};
        var self = this;
        Object.keys(remote || {}).forEach(function(k) { out[k] = remote[k]; });
        Object.keys(local || {}).forEach(function(k) {
            out[k] = self.mergeKey(k, local[k], (remote || {})[k]);
        });
        /* 已删除账号: 从 fi_accounts 剔除 (跨设备同步删除) */
        var del = out[FA.DB_KEYS.deletedUsernames] || [];
        if (out[FA.DB_KEYS.accounts]) {
            del.forEach(function(u) { if (u) delete out[FA.DB_KEYS.accounts][u]; });
        }
        return out;
    },

    mergeKey: function(key, L, R) {
        if (key === FA.DB_KEYS.accounts) return this._unionObjects(L, R);
        if (key === FA.DB_KEYS.activeSessions) return this._unionObjects(L, R);
        if (key === FA.DB_KEYS.deletedUsernames) return this._unionArrays(L, R);
        if (key === FA.DB_KEYS.chatMessages) return this._mergeChat(L, R);
        if (this._isArrayKey(key)) return this._mergeArrayById(L, R);
        /* 普通对象: 合并字段, 本地优先 */
        if (L && R && typeof L === 'object' && typeof R === 'object' && !Array.isArray(L) && !Array.isArray(R)) {
            return this._unionObjects(L, R);
        }
        /* 基础类型: 本地优先 */
        return (L !== undefined && L !== null) ? L : R;
    },

    _isArrayKey: function(key) {
        if (/^fi_dashboard_layout_/.test(key)) return true;
        var arr = ['fi_members', 'fi_devices', 'fi_events', 'fi_todos', 'fi_notifications',
                   'fi_approvals', 'fi_login_logs', 'fi_op_logs', 'fi_registrations', 'fi_albums'];
        return arr.indexOf(key) !== -1;
    },

    /* 对象并集 (按 key): 以 L 为基准, 仅补入 R 独有 key (不覆盖 L 已有字段) */
    _unionObjects: function(a, b) {
        var out = {};
        var src = a || {};
        Object.keys(src).forEach(function(k) { out[k] = src[k]; });
        src = b || {};
        Object.keys(src).forEach(function(k) { if (out[k] === undefined) out[k] = src[k]; });
        return out;
    },

    /* 数组并集 (按值去重, 用于 fi_deleted_usernames 等字符串数组) */
    _unionArrays: function(a, b) {
        var seen = {}; var out = [];
        function add(v) { var k = (v == null) ? '∅' : String(v); if (!seen[k]) { seen[k] = true; out.push(v); } }
        (a || []).forEach(add);
        (b || []).forEach(add);
        return out;
    },

    /* 数组合并 (按 id 去重): 本地优先, 远程独有增量补入 (两边同时新增都保留) */
    _mergeArrayById: function(a, b) {
        var seen = {}; var out = [];
        function add(item) {
            var k = (item && item.id != null) ? ('id:' + item.id) : ('j:' + JSON.stringify(item));
            if (!seen[k]) { seen[k] = true; out.push(item); }
        }
        (a || []).forEach(add);   // 本地优先
        (b || []).forEach(add);   // 远程增量补入
        return out;
    },

    /* 聊天合并: 每个会话(user)内的消息按 id 去重合并 */
    _mergeChat: function(L, R) {
        var out = {};
        var users = {};
        Object.keys(L || {}).forEach(function(u){ users[u] = true; });
        Object.keys(R || {}).forEach(function(u){ users[u] = true; });
        var self = this;
        Object.keys(users).forEach(function(u) {
            out[u] = self._mergeArrayById(L ? L[u] : null, R ? R[u] : null);
        });
        return out;
    },

    /* ============================================================
       跨标签推送锁 (同浏览器多标签互斥, 防 409 风暴)
       基于 localStorage, 30 秒超时自动释放, 不阻塞其他设备(各设备独立 localStorage)
       ============================================================ */
    _acquireLock: function() {
        try {
            var myId = FA.getTabId();
            var raw = localStorage.getItem('fi_sync_lock');
            var now = Date.now();
            if (raw) {
                try {
                    var l = JSON.parse(raw);
                    if (l.tabId === myId) { l.ts = now; localStorage.setItem('fi_sync_lock', JSON.stringify(l)); return true; }
                    if (now - l.ts < 30000) return false; // 被其他标签持有且未超时
                } catch (e) {}
            }
            localStorage.setItem('fi_sync_lock', JSON.stringify({ tabId: myId, ts: now }));
            return true;
        } catch (e) { return true; } // 异常时放行, 避免死锁
    },

    _releaseLock: function() {
        try {
            var raw = localStorage.getItem('fi_sync_lock');
            if (raw) {
                var l = JSON.parse(raw);
                if (l.tabId === FA.getTabId()) localStorage.removeItem('fi_sync_lock');
            }
        } catch (e) {}
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
        }, 6000);
    },

    /* ============================================================
       自动拉取 (动态间隔: 正常 12 秒, 连续失败后自动降速到 60 秒)
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
        if (this._pullIntervalMs !== 12000) {
            this._pullIntervalMs = 12000;
            this.startAutoPull();
            console.log('[Sync] 恢复正常拉取间隔 (12 秒)');
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
