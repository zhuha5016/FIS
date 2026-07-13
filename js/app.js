/* ======================================================================
   app.js - 主初始化文件，串联所有模块
   加载顺序: config -> val -> data -> auth -> verify ->
             members -> photos -> calendar -> approvals ->
             dashboard -> settings -> app
   ====================================================================== */

window.FA = window.FA || {};

FA.App = {
    init: function() {
        /* 初始化数据系统 */
        FA.Data.init();

        /* 初始化 GitHub 云同步 (挂钩 saveData, 已配置则自动拉取) */
        if (FA.Sync && FA.Sync.init) FA.Sync.init();

        /* 应用语言翻译 */
        FA.applyLanguage();

        /* 初始化聊天模块 */
        if (FA.Chat && FA.Chat.init) FA.Chat.init();

        /* 初始化认证界面 */
        FA.Auth.init();

        /* 初始化设置页面 (重构 DOM) */
        if (FA.Settings) FA.Settings.init();

        /* 设置今日日期 */
        FA.App.setDateDisplay();

        /* 初始化仪表盘布局 */
        if (FA.initDashboardLayout) FA.initDashboardLayout();

        /* 设置仪表盘拖拽 */
        if (FA.setupDashboardDrag) FA.setupDashboardDrag();

        /* 设置模态框关闭处理 */
        FA.App.setupModalHandlers();

        /* 尝试恢复会话 */
        if (FA.Auth.restoreSession) FA.Auth.restoreSession();
    },

    /* 设置日期显示 */
    setDateDisplay: function() {
        var el = document.getElementById('currentDate');
        if (el) {
            el.textContent = new Date().toLocaleDateString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });
        }
    },

    /* 模态框关闭处理：点击背景或 ESC */
    setupModalHandlers: function() {
        /* 点击背景关闭 */
        document.querySelectorAll('.modal').forEach(function(modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.classList.remove('open');
            });
        });

        /* ESC 键关闭 */
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.open').forEach(function(m) {
                    m.classList.remove('open');
                });
            }
        });
    }
};

/* =====================
   DOMContentLoaded 启动
   ===================== */
document.addEventListener('DOMContentLoaded', function() {
    FA.App.init();
    FA.App.setDateDisplay();
});

/* =====================
   全局函数桥接 (兼容 HTML onclick)
   ===================== */

/* 核心函数 */
window.showSection = function(id, event) { FA.showSection(id, event); };
window.showModal = function(id) { FA.showModal(id); };
window.closeModal = function(id) { FA.closeModal(id); };

/* 数据管理 */
window.exportData = function() { FA.Data.exportData(); };
window.importData = function(event) { FA.Data.importData(event); };
window.resetAll = function() { FA.Data.resetAll(); };

/* 认证 */
window.logout = function() { FA.Auth.logout(); };

/* 待办事项 */
window.addTodo = function() { FA.addTodo(); };
window.toggleTodo = function(i) { FA.toggleTodo(i); };
window.deleteTodo = function(i) { FA.deleteTodo(i); };

/* 设备 */
window.saveDevice = function() { FA.saveDevice(); };
window.toggleDevice = function(id, status) { FA.toggleDevice(id, status); };

/* 通知 */
window.markAsRead = function(i) { FA.markAsRead(i); };
window.markAllRead = function() { FA.markAllRead(); };
window.clearNotifications = function() { FA.clearNotifications(); };

/* 其他模块函数 (条件桥接，不覆盖已有定义) */
['saveMember', 'deleteMember', 'saveEvent', 'deleteEvent',
 'changeMonth', 'goToToday', 'dayClick',
 'filterPhotos', 'uploadPhoto', 'deletePhoto'
].forEach(function(name) {
    if (!window[name]) {
        window[name] = function() {
            var fn = FA[name];
            if (fn) fn.apply(FA, arguments);
        };
    }
});
