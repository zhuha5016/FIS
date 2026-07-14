/* ======================================================================
   data.js - 数据存储系统、导入导出
   ====================================================================== */

window.FA = window.FA || {};

FA.Data = {
    loadData: function(key, defaultVal) {
        var data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
    },

    saveData: function(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    /* 初始化所有数据 */
    init: function() {
        /* 账户体系: 先加载 localStorage 中持久化的版本 (成员编辑时同步) */
        var savedAccounts = localStorage.getItem(FA.DB_KEYS.accounts);
        if (savedAccounts) {
            try {
                var parsed = JSON.parse(savedAccounts);
                var deletedSet = FA.Data.getDeletedUsernames();
                /* 仅补回「内置默认账号」中未删除的; 动态账号(test/TEST 等)不补回,
                   已删除的内置账号也不补回 → 防止云同步拉取后把删除的账号复活 */
                (FA.BUILTIN_USERNAMES || []).forEach(function(key) {
                    if (!parsed[key] && deletedSet.indexOf(key) === -1) parsed[key] = FA.accounts[key];
                });
                FA.accounts = parsed;
            } catch (e) {
                /* 解析失败, 保留默认账户 */
            }
        } else {
            /* 首次启动: 将内置默认账户持久化到 fi_accounts,
               以便云同步把账号体系同步到 GitHub, 供 RDM 拉取账号 (Feature 3) */
            FA.Data.saveAccounts();
            if (FA.Sync && FA.Sync.schedulePush) FA.Sync.schedulePush();
        }

        FA.members = this.loadData(FA.DB_KEYS.members, [
            { name: 'zhuha', nameCn: '朱淏', role: 'superadmin', phone: '18250857696', username: 'zhuha', gender: '男', email: 'zhuha@family.local', verified: true },
            { name: 'zhunengxin', nameCn: '朱能鑫', role: 'senior', phone: '13799287164', username: 'zhunengxin', gender: '男', email: 'zhunengxin@family.local', verified: false },
            { name: 'huguili', nameCn: '胡桂丽', role: 'senior', phone: '13606086703', username: 'huguili', gender: '女', email: 'huguili@family.local', verified: false },
            { name: 'zhurenmin', nameCn: '朱仁民', role: 'user', phone: '18950996905', username: 'zhurenmin', gender: '男', email: 'zhurenmin@family.local', verified: false },
            { name: 'luoaiyu', nameCn: '罗爱玉', role: 'user', phone: '18950997559', username: 'luoaiyu', gender: '女', email: 'luoaiyu@family.local', verified: false }
        ]);

        FA.devices = this.loadData(FA.DB_KEYS.devices, [
            { id: 1, name: '客厅灯光', location: '客厅', type: '灯光', on: true },
            { id: 2, name: '卧室灯光', location: '卧室', type: '灯光', on: false },
            { id: 3, name: '空调',     location: '客厅', type: '空调', on: false },
            { id: 4, name: '电视',     location: '客厅', type: '电视', on: false }
        ]);

        FA.events = this.loadData(FA.DB_KEYS.events, [
            { date: FA.getTodayStr(), title: '家庭会议', time: '14:30', location: '客厅', type: 'custom' }
        ]);

        FA.todos = this.loadData(FA.DB_KEYS.todos, []);
        FA.photos = this.loadData(FA.DB_KEYS.photos, []);

        FA.albums = this.loadData(FA.DB_KEYS.albums, [
            { id: 'default', name: '默认相册', description: '日常照片', cover: '', createdDate: new Date().toISOString() }
        ]);

        FA.notifications = this.loadData(FA.DB_KEYS.notifications, [
            { id: 1, type: 'info', title: '欢迎来到家庭门户系统', content: '系统已成功启动，VAL安全认证已启用。', time: new Date().toISOString(), read: false },
            { id: 2, type: 'success', title: '设备同步完成', content: '所有智能设备已同步至最新状态。', time: new Date().toISOString(), read: false }
        ]);

        FA.approvals = this.loadData(FA.DB_KEYS.approvals, []);
        /* 首页布局: 先加载默认, 登录后会被 loadUserLayout 覆盖 */
        FA.dashboardLayout = this.loadData(FA.DB_KEYS.layout, ['schedule', 'devices', 'members', 'notifications', 'todo']);

        /* 加载删除的审批(留痕) + 登录日志 + 操作日志 */
        FA.deletedApprovals = this.loadData(FA.DB_KEYS.deletedApprovals, []);
        FA.loginLogs = this.loadData(FA.DB_KEYS.loginLogs, []);
        FA.opLogs = this.loadData(FA.DB_KEYS.opLogs, []);

        /* 加载聊天数据 */
        FA.Chat.chatList = this.loadData(FA.DB_KEYS.chatList, []);
        FA.Chat.messages = this.loadData(FA.DB_KEYS.chatMessages, {});
        FA.Chat.pinnedUsers = this.loadData(FA.DB_KEYS.chatPinned, []);
        FA.Chat.mutedUsers = this.loadData(FA.DB_KEYS.chatMuted, []);

        /* 加载注册申请 */
        FA.registrations = this.loadData(FA.DB_KEYS.registrations, []);

        /* 加载语言偏好 */
        FA.currentLang = localStorage.getItem('fi_language') || 'zh';

        /* 启动网络状态监控 */
        if (FA.initNetworkMonitor) FA.initNetworkMonitor();
    },

    /* =====================
       按用户加载首页布局
       每个用户有独立的卡片排列顺序, 存储在 fi_dashboard_layout_<username>
       ===================== */
    loadUserLayout: function() {
        if (!FA.currentUser) return;
        var key = 'fi_dashboard_layout_' + FA.currentUser.username;
        FA.dashboardLayout = FA.Data.loadData(key, ['schedule', 'devices', 'members', 'notifications', 'todo']);
        if (FA.applyLayoutOrder) FA.applyLayoutOrder();
    },

    /* 按用户保存首页布局 */
    saveUserLayout: function(layout) {
        if (!FA.currentUser) return;
        var key = 'fi_dashboard_layout_' + FA.currentUser.username;
        FA.Data.saveData(key, layout);
    },

    /* 持久化账户体系到 localStorage (成员编辑后同步) */
    saveAccounts: function() {
        FA.Data.saveData(FA.DB_KEYS.accounts, FA.accounts);
    },

    /* =====================
       已删除账号追踪: 防止云同步拉取后把删除的账号复活
       ===================== */
    getDeletedUsernames: function() {
        try {
            var raw = localStorage.getItem(FA.DB_KEYS.deletedUsernames);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    },

    markDeletedUsername: function(username) {
        if (!username) return;
        var set = FA.Data.getDeletedUsernames();
        if (set.indexOf(username) === -1) {
            set.push(username);
            FA.Data.saveData(FA.DB_KEYS.deletedUsernames, set);
        }
    },

    unmarkDeletedUsername: function(username) {
        if (!username) return;
        var set = FA.Data.getDeletedUsernames();
        var idx = set.indexOf(username);
        if (idx !== -1) {
            set.splice(idx, 1);
            FA.Data.saveData(FA.DB_KEYS.deletedUsernames, set);
        }
    },

    /* 导出数据 */
    exportData: function() {
        if (!FA.checkPermission('exportData')) return FA.showToast('权限不足', 'error');
        var data = {
            members: FA.members, devices: FA.devices, events: FA.events,
            todos: FA.todos, photos: FA.photos, albums: FA.albums,
            notifications: FA.notifications, approvals: FA.approvals,
            exportDate: new Date().toISOString()
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'family_backup_' + FA.getTodayStr() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        FA.showToast('数据导出成功', 'success');
    },

    /* 导入数据 */
    importData: function(event) {
        if (!FA.checkPermission('importData')) return FA.showToast('权限不足', 'error');
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.members) { FA.members = data.members; FA.Data.saveData(FA.DB_KEYS.members, FA.members); }
                if (data.devices) { FA.devices = data.devices; FA.Data.saveData(FA.DB_KEYS.devices, FA.devices); }
                if (data.events)  { FA.events = data.events;  FA.Data.saveData(FA.DB_KEYS.events, FA.events); }
                if (data.todos)   { FA.todos = data.todos;     FA.Data.saveData(FA.DB_KEYS.todos, FA.todos); }
                if (data.photos)  { FA.photos = data.photos;  FA.Data.saveData(FA.DB_KEYS.photos, FA.photos); }
                if (data.albums)  { FA.albums = data.albums;  FA.Data.saveData(FA.DB_KEYS.albums, FA.albums); }
                if (data.notifications) { FA.notifications = data.notifications; FA.Data.saveData(FA.DB_KEYS.notifications, FA.notifications); }
                if (data.approvals) { FA.approvals = data.approvals; FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals); }
                FA.renderAll();
                FA.showToast('数据导入成功！', 'success');
            } catch (err) {
                FA.showToast('导入失败，请检查文件格式', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    /* 重置数据 */
    resetAll: function() {
        if (!FA.checkPermission('resetData')) return FA.showToast('权限不足', 'error');
        if (!confirm('确定要清空所有数据并恢复默认设置吗？此操作不可撤销！')) return;
        Object.values(FA.DB_KEYS).forEach(function(key) { localStorage.removeItem(key); });
        FA.showToast('数据已重置，页面即将刷新...', 'info');
        setTimeout(function() { location.reload(); }, 1500);
    },

    /* 通知管理 */
    addNotification: function(type, title, content) {
        FA.notifications.unshift({
            id: Date.now(), type: type, title: title, content: content,
            time: new Date().toISOString(), read: false
        });
        if (FA.notifications.length > 50) FA.notifications = FA.notifications.slice(0, 50);
        if (FA.renderNotifications) FA.renderNotifications();
    },

    /* =====================
       信息变更通知系统 (5分钟延迟 + 批量合并)
       ===================== */
    pendingInfoChanges: null,
    infoChangeTimer: null,

    recordInfoChange: function(username, changes) {
        // changes is an array of { field: 'phone', oldValue: '...', newValue: '...' }
        var now = new Date();
        if (!FA.Data.pendingInfoChanges) {
            FA.Data.pendingInfoChanges = {
                username: username,
                changes: changes,
                firstChangeTime: now,
                lastChangeTime: now
            };
        } else {
            // Same user — batch changes
            FA.Data.pendingInfoChanges.changes = FA.Data.pendingInfoChanges.changes.concat(changes);
            FA.Data.pendingInfoChanges.lastChangeTime = now;
        }

        // Clear any existing timer
        if (FA.Data.infoChangeTimer) clearTimeout(FA.Data.infoChangeTimer);

        // Set 5-minute (300000ms) timer to send notification
        FA.Data.infoChangeTimer = setTimeout(function() {
            FA.Data.flushInfoChangeNotification();
        }, 300000);
    },

    flushInfoChangeNotification: function() {
        if (!FA.Data.pendingInfoChanges) return;
        var data = FA.Data.pendingInfoChanges;
        FA.Data.pendingInfoChanges = null;
        FA.Data.infoChangeTimer = null;

        var acc = FA.accounts[data.username];
        if (!acc) return;

        var member = FA.members.find(function(m) { return m.username === data.username; });
        var realName = (member && member.realName) || acc.nameCn || acc.name;
        var phone = (member && member.phone) || acc.phone;
        var gender = (member && member.gender) || acc.gender || '';
        var role = FA.getRoleName(acc.role);

        var firstTime = data.firstChangeTime;
        var lastTime = data.lastChangeTime;
        var timeStr;
        if (firstTime.getTime() === lastTime.getTime()) {
            timeStr = FA.formatExactTime(firstTime);
        } else {
            timeStr = FA.formatExactTime(firstTime) + '-' + FA.formatExactTime(lastTime);
        }

        // Title: 身份 用户名 真实姓名 于 2026.7.12 19:58:00分修改了信息
        var title = role + ' ' + data.username + ' ' + realName + ' 于 ' + FA.formatDateCN(firstTime) + ' ' + FA.formatTimeCN(firstTime) + '分修改了信息';

        // Content: 用户名：... 真实姓名：... 手机号：... 身份：... 性别：... 修改时间：...  修改了以下信息：
        var fieldLabels = {
            name: '英文姓名', nameCn: '中文姓名', phone: '手机号', email: '邮箱',
            gender: '性别', password: '密码', role: '角色'
        };
        var changeLines = data.changes.map(function(c, i) {
            var label = fieldLabels[c.field] || c.field;
            return '-' + (i+1) + '.' + label + '：' + (c.oldValue || '空') + ' → ' + (c.newValue || '空');
        }).join('\n');

        var content = '用户名：' + data.username + '\n' +
            '真实姓名：' + realName + '\n' +
            '手机号：' + phone + '\n' +
            '身份：' + role + '\n' +
            '性别：' + gender + '\n' +
            '修改时间：' + timeStr + '  修改了以下信息：\n' + changeLines;

        // Add notification for the user themselves
        FA.Data.addNotification('info', title, content);

        // Add notification for super admin (if the user is not super admin)
        if (acc.role !== 'superadmin') {
            FA.Data.addNotification('info', title, content);
        }

        // Try Windows system notification
        if (FA.sendWindowsNotification) {
            FA.sendWindowsNotification(title, content);
        }
    },

    /* =====================
       登录日志 (超管可见)
       含 IP / 地理位置 / 浏览器信息
       ===================== */
    recordLoginLog: function(username, action, detail) {
        FA.loginLogs = FA.Data.loadData(FA.DB_KEYS.loginLogs, []);

        /* 浏览器检测 */
        var browser = FA.Data._detectBrowser();

        var log = {
            id: 'll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            username: username,
            action: action,   // 'login' / 'logout' / 'switch' / 'failed'
            detail: detail,
            time: new Date().toISOString(),
            ip: '获取中...',     // 异步获取
            location: '获取中...',
            browser: browser,
            userAgent: navigator.userAgent.substring(0, 120)
        };

        FA.loginLogs.unshift(log);

        /* 限制 200 条 */
        if (FA.loginLogs.length > 200) FA.loginLogs = FA.loginLogs.slice(0, 200);
        FA.Data.saveData(FA.DB_KEYS.loginLogs, FA.loginLogs);

        /* 异步获取 IP 和地理位置 */
        FA.Data._fetchIpLocation(log.id);
    },

    /* 浏览器检测 */
    _detectBrowser: function() {
        var ua = navigator.userAgent;
        var browser = 'Unknown';
        if (/Edg\//.test(ua)) browser = 'Edge';
        else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
        else if (/Firefox\//.test(ua)) browser = 'Firefox';
        else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
        else if (/MSIE|Trident/.test(ua)) browser = 'IE';

        var os = 'Unknown';
        if (/Windows/.test(ua)) os = 'Windows';
        else if (/Mac OS X/.test(ua)) os = 'macOS';
        else if (/Android/.test(ua)) os = 'Android';
        else if (/iPhone|iPad/.test(ua)) os = 'iOS';
        else if (/Linux/.test(ua)) os = 'Linux';

        return browser + ' / ' + os;
    },

    /* 异步获取 IP 和地理位置 */
    _fetchIpLocation: function(logId) {
        /* 使用 ipapi.co 免费接口获取 IP 和位置 */
        fetch('https://ipapi.co/json/')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!data) return;
                var log = FA.loginLogs.find(function(l) { return l.id === logId; });
                if (!log) return;
                log.ip = data.ip || '未知';
                log.location = (data.city || '') + (data.city && data.country_name ? ', ' : '') + (data.country_name || '');
                if (!log.location) log.location = '未知';
                FA.Data.saveData(FA.DB_KEYS.loginLogs, FA.loginLogs);
            })
            .catch(function() {
                /* 获取失败, 标记为本地 */
                var log = FA.loginLogs.find(function(l) { return l.id === logId; });
                if (log) {
                    log.ip = '本地';
                    log.location = '无法获取';
                    FA.Data.saveData(FA.DB_KEYS.loginLogs, FA.loginLogs);
                }
            });
    },

    /* =====================
       操作日志 (每个用户都有)
       ===================== */
    recordOpLog: function(action, detail) {
        if (!FA.currentUser) return;
        FA.opLogs = FA.Data.loadData(FA.DB_KEYS.opLogs, []);
        FA.opLogs.unshift({
            id: 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            username: FA.currentUser.username,
            action: action,
            detail: detail,
            time: new Date().toISOString()
        });
        if (FA.opLogs.length > 500) FA.opLogs = FA.opLogs.slice(0, 500);
        FA.Data.saveData(FA.DB_KEYS.opLogs, FA.opLogs);
    }
};

/* 全局渲染入口 */
FA.renderAll = function() {
    if (FA.renderMembers) FA.renderMembers();
    if (FA.renderDevices) FA.renderDevices();
    if (FA.renderHomeSummary) FA.renderHomeSummary();
    if (FA.renderTodos) FA.renderTodos();
    if (FA.renderCalendar) FA.renderCalendar();
    if (FA.renderEvents) FA.renderEvents();
    if (FA.renderPhotos) FA.renderPhotos();
    if (FA.renderNotifications) FA.renderNotifications();
    if (FA.renderApprovals) FA.renderApprovals();
    if (FA.Chat && FA.Chat.render) FA.Chat.render();
    if (FA.Registration && FA.Registration.getPendingCount && FA.currentUser && FA.currentUser.role === 'superadmin') {
        if (FA.renderRegistrations) FA.renderRegistrations();
    }
    if (FA.updateStats) FA.updateStats();
};

FA.showSection = function(id, event) {
    document.querySelectorAll('.content-section').forEach(function(s) { s.style.display = 'none'; });
    var el = document.getElementById(id);
    if (el) el.style.display = 'block';
    document.querySelectorAll('.sidebar-menu a').forEach(function(a) { a.classList.remove('active'); });
    if (event && event.target) {
        var closest = event.target.closest('a');
        if (closest) closest.classList.add('active');
    } else {
        /* 通过代码调用时，根据 id 找到对应的菜单项 */
        var menuLink = document.querySelector('.sidebar-menu a[onclick*="' + id + '"]');
        if (menuLink) menuLink.classList.add('active');
    }
    /* 关闭用户浮窗 */
    var popup = document.getElementById('userPopup');
    if (popup) popup.classList.remove('open');

    /* 按需重新渲染对应区块 */
    switch (id) {
        case 'approvals-section':
            if (FA.renderApprovals) FA.renderApprovals();
            break;
        case 'photos-section':
            if (FA.renderPhotos) FA.renderPhotos();
            break;
        case 'calendar-section':
            if (FA.renderCalendar) FA.renderCalendar();
            if (FA.renderEvents) FA.renderEvents();
            break;
        case 'family-members':
            if (FA.renderMembers) FA.renderMembers();
            break;
        case 'notifications-section':
            if (FA.renderNotifications) FA.renderNotifications();
            break;
        case 'chat-section':
            if (FA.Chat && FA.Chat.render) FA.Chat.render();
            break;
        case 'registrations-section':
            if (FA.renderRegistrations) FA.renderRegistrations();
            break;
        case 'settings-section':
            if (FA.Settings && FA.Settings.init) FA.Settings.init();
            break;
        case 'welcome-section':
            if (FA.renderHomeSummary) FA.renderHomeSummary();
            break;
    }
};

FA.updateStats = function() {
    var unread = FA.notifications.filter(function(n) { return !n.read; }).length;
    var todoCount = FA.todos.filter(function(t) { return !t.done; }).length;
    var deviceOn = FA.devices.filter(function(d) { return d.on; }).length;
    var msgEl = document.getElementById('msgCount');
    var todoEl = document.getElementById('todoCount');
    var devEl = document.getElementById('deviceOnCount');
    if (msgEl) msgEl.textContent = unread;
    if (todoEl) todoEl.textContent = todoCount;
    if (devEl) devEl.textContent = deviceOn;
    var badge = document.getElementById('notifBadge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }
};
