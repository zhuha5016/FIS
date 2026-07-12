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
        FA.members = this.loadData(FA.DB_KEYS.members, [
            { name: 'zhuha', nameCn: '朱哈', role: 'superadmin', phone: '138****0001', username: 'zhuha', gender: '男', email: 'zhuha@family.local', verified: true },
            { name: 'zhunengxin', nameCn: '朱能新', role: 'senior', phone: '139****0002', username: 'zhunengxin', gender: '男', email: 'zhunengxin@family.local', verified: false },
            { name: 'huguili', nameCn: '胡桂丽', role: 'senior', phone: '137****0003', username: 'huguili', gender: '女', email: 'huguili@family.local', verified: false },
            { name: 'zhurenmin', nameCn: '朱人民', role: 'user', phone: '136****0004', username: 'zhurenmin', gender: '男', email: 'zhurenmin@family.local', verified: false },
            { name: 'luoaiyu', nameCn: '罗爱玉', role: 'user', phone: '135****0005', username: 'luoaiyu', gender: '女', email: 'luoaiyu@family.local', verified: false }
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
        FA.dashboardLayout = this.loadData(FA.DB_KEYS.layout, ['schedule', 'devices', 'members', 'notifications', 'todo']);
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
