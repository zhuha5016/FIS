/* ======================================================================
   config.js - 全局配置、账号体系、权限定义
   所有模块通过 window.FA 命名空间共享数据
   ====================================================================== */

window.FA = window.FA || {};

/* =====================
   账号体系 (用户名改为英文)
   ===================== */
FA.accounts = {
    "zhuha":      { password: "zhuha106424", role: "superadmin", name: "zhuha",   nameCn: "朱哈",   phone: "138****0001", email: "zhuha@family.local", gender: "男", securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ] },
    "zhunengxin": { password: "19770714",   role: "senior",    name: "zhunengxin", nameCn: "朱能新", phone: "139****0002", email: "zhunengxin@family.local", gender: "男", securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ] },
    "huguili":    { password: "19800328",   role: "senior",    name: "huguili",    nameCn: "胡桂丽", phone: "137****0003", email: "huguili@family.local", gender: "女", securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ] },
    "zhurenmin":  { password: "19430513",   role: "user",      name: "zhurenmin",  nameCn: "朱人民", phone: "136****0004", email: "zhurenmin@family.local", gender: "男", securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ] },
    "luoaiyu":    { password: "19520606",   role: "user",      name: "luoaiyu",    nameCn: "罗爱玉", phone: "135****0005", email: "luoaiyu@family.local", gender: "女", securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ] }
};

/* 角色显示名映射 */
FA.roleNames = {
    superadmin: "最高管理员",
    senior: "高级管理员",
    user: "普通用户"
};

/* =====================
   权限定义
   ===================== */
FA.PERMISSIONS = {
    superadmin: {
        addMember: true, editMember: true, deleteMember: true,
        addDevice: true, deleteDevice: true, toggleDevice: true,
        addEvent: true, deleteEvent: true,
        addPhoto: true, deletePhoto: true, createAlbum: true, editAlbum: true, deleteAlbum: true,
        exportData: true, importData: true, resetData: true,
        manageSettings: true, manageNotifications: true,
        createApproval: true, approveApproval: true, deleteApproval: true,
        viewSensitive: true, editLayout: true,
        verifyIdentity: true
    },
    senior: {
        addMember: true, editMember: true, deleteMember: false,
        addDevice: true, deleteDevice: true, toggleDevice: true,
        addEvent: true, deleteEvent: true,
        addPhoto: true, deletePhoto: true, createAlbum: true, editAlbum: true, deleteAlbum: false,
        exportData: true, importData: false, resetData: false,
        manageSettings: true, manageNotifications: true,
        createApproval: true, approveApproval: true, deleteApproval: false,
        viewSensitive: true, editLayout: false,
        verifyIdentity: true
    },
    user: {
        addMember: false, editMember: false, deleteMember: false,
        addDevice: false, deleteDevice: false, toggleDevice: false,
        addEvent: true, deleteEvent: true,
        addPhoto: false, deletePhoto: false, createAlbum: false, editAlbum: false, deleteAlbum: false,
        exportData: false, importData: false, resetData: false,
        manageSettings: false, manageNotifications: false,
        createApproval: true, approveApproval: false, deleteApproval: false,
        viewSensitive: false, editLayout: false,
        verifyIdentity: false
    }
};

/* 权限中文标签 */
FA.permissionLabels = {
    addMember: "添加家庭成员", editMember: "编辑家庭成员", deleteMember: "删除家庭成员",
    addDevice: "添加设备", deleteDevice: "删除设备", toggleDevice: "控制设备",
    addEvent: "添加日程", deleteEvent: "删除日程",
    addPhoto: "上传照片", deletePhoto: "删除照片", createAlbum: "创建相册", editAlbum: "编辑相册", deleteAlbum: "删除相册",
    exportData: "导出数据", importData: "导入数据", resetData: "重置数据",
    manageSettings: "管理设置", manageNotifications: "管理通知",
    createApproval: "发起审批", approveApproval: "审批处理", deleteApproval: "删除审批",
    viewSensitive: "查看敏感信息", editLayout: "编辑布局",
    verifyIdentity: "身份验证"
};

/* =====================
   数据存储键名
   ===================== */
FA.DB_KEYS = {
    members: 'fi_members',
    devices: 'fi_devices',
    events: 'fi_events',
    todos: 'fi_todos',
    photos: 'fi_photos',
    albums: 'fi_albums',
    notifications: 'fi_notifications',
    approvals: 'fi_approvals',
    layout: 'fi_dashboard_layout',
    verifySession: 'fi_verify_session',
    userVerify: 'fi_user_verified', // 存储每个用户的实名认证状态
    deletedApprovals: 'fi_deleted_approvals', // 删除的审批(留痕)
    loginLogs: 'fi_login_logs',     // 登录日志(超管可见)
    opLogs: 'fi_op_logs'            // 操作日志(每个用户都有)
};

/* =====================
   时区配置
   ===================== */
FA.timezones = [
    { tz: "UTC+0",  offset: 0,  label: "UTC+0 伦敦" },
    { tz: "UTC+8",  offset: 8,  label: "UTC+8 北京" },
    { tz: "UTC-5",  offset: -5, label: "UTC-5 纽约" },
    { tz: "UTC+9",  offset: 9,  label: "UTC+9 东京" },
    { tz: "UTC+1",  offset: 1,  label: "UTC+1 巴黎" }
];

/* =====================
   证件类型配置
   ===================== */
FA.idDocTypes = [
    { key: "passport",      label: "护照" },
    { key: "hk_macau_pass", label: "往来港澳通行证" },
    { key: "taiwan_pass",   label: "往来台湾通行证" },
    { key: "driver_license", label: "驾驶证" },
    { key: "vehicle_license", label: "行驶证" },
    { key: "medical_card",  label: "医保卡" }
];

/* 银行卡组织 */
FA.cardOrganizations = [
    { key: "unionpay", label: "银联" },
    { key: "visa",     label: "Visa" },
    { key: "mastercard", label: "Mastercard" },
    { key: "amex",     label: "American Express" },
    { key: "jcb",      label: "JCB" },
    { key: "discover", label: "Discover" }
];

/* =====================
   证件类型颜色（头像）
   ===================== */
FA.avatarColors = ['#007AFF','#28a745','#FF9800','#9C27B0','#E91E63','#00BCD4','#FF5722','#3F51B5'];

/* =====================
   当前用户状态
   ===================== */
FA.currentUser = null;
FA.currentLang = localStorage.getItem('fi_language') || 'zh';
FA.selectedTimezone = 'UTC+8';
FA.selectedOffset = 8;

/* =====================
   国际化 (i18n)
   ===================== */
FA.i18n = {
    welcome:              { zh: '欢迎登陆',          en: 'Welcome',              ja: 'ようこそ' },
    usernamePlaceholder:  { zh: '用户名或手机号',     en: 'Username or Phone',    ja: 'ユーザー名または電話番号' },
    passwordPlaceholder:  { zh: '密码',              en: 'Password',             ja: 'パスワード' },
    login:                { zh: '登录',              en: 'LOGIN',                ja: 'ログイン' },
    home:                 { zh: '首页',              en: 'Home',                 ja: 'ホーム' },
    familyMembers:        { zh: '家庭成员',          en: 'Family Members',       ja: '家族メンバー' },
    devices:              { zh: '家庭设备',          en: 'Devices',              ja: 'デバイス' },
    photos:               { zh: '家庭相册',          en: 'Photos',               ja: 'アルバム' },
    calendar:             { zh: '家庭日历',          en: 'Calendar',             ja: 'カレンダー' },
    approvals:            { zh: '审核与报告',         en: 'Approvals',            ja: '承認' },
    notifications:        { zh: '消息通知',          en: 'Notifications',        ja: '通知' },
    settings:             { zh: '系统设置',          en: 'Settings',             ja: '設定' },
    profile:              { zh: '个人信息',          en: 'Profile',              ja: 'プロフィール' },
    accountSecurity:      { zh: '账号与安全',         en: 'Account & Security',   ja: 'アカウントとセキュリティ' },
    dataManagement:       { zh: '数据管理',          en: 'Data Management',      ja: 'データ管理' },
    aboutSystem:          { zh: '关于系统',          en: 'About',                ja: 'システム情報' },
    forgotPassword:       { zh: '忘记密码',          en: 'Forgot Password',      ja: 'パスワード忘れ' },
    logout:               { zh: '退出登录',          en: 'Logout',               ja: 'ログアウト' },
    edit:                 { zh: '编辑',              en: 'Edit',                 ja: '編集' },
    save:                 { zh: '保存',              en: 'Save',                 ja: '保存' },
    cancel:               { zh: '取消',              en: 'Cancel',               ja: 'キャンセル' },
    online:               { zh: '在线',              en: 'Online',               ja: 'オンライン' },
    offline:              { zh: '离线',              en: 'Offline',              ja: 'オフライン' },
    systemLanguage:       { zh: '系统语言',          en: 'System Language',      ja: 'システム言語' },
    networkRestored:      { zh: '网络已恢复',         en: 'Network restored',     ja: 'ネットワークが復旧しました' },
    networkOffline:       { zh: '网络已断开',         en: 'Network offline',      ja: 'ネットワークが切断されました' }
};

FA.t = function(key) {
    var lang = FA.currentLang || 'zh';
    var entry = FA.i18n[key];
    if (!entry) return key;
    return entry[lang] || entry['zh'] || key;
};

FA.setLanguage = function(lang) {
    FA.currentLang = lang;
    localStorage.setItem('fi_language', lang);
    // Reload to apply changes
    location.reload();
};

/* =====================
   网络状态监控
   ===================== */
FA.networkStatus = navigator.onLine ? 'online' : 'offline';
FA.initNetworkMonitor = function() {
    window.addEventListener('online', function() {
        FA.networkStatus = 'online';
        if (FA.showToast) FA.showToast(FA.t('networkRestored'), 'success');
        if (FA.onNetworkRestore) FA.onNetworkRestore();
    });
    window.addEventListener('offline', function() {
        FA.networkStatus = 'offline';
        if (FA.showToast) FA.showToast(FA.t('networkOffline'), 'error');
        if (FA.onNetworkOffline) FA.onNetworkOffline();
    });
};

/* =====================
   时间格式化辅助函数
   ===================== */
FA.formatExactTime = function(d) {
    d = d instanceof Date ? d : new Date(d);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
};

FA.formatDateCN = function(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '.' + (d.getMonth()+1) + '.' + d.getDate();
};

FA.formatTimeCN = function(d) {
    d = d instanceof Date ? d : new Date(d);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
};

/* =====================
   Windows 系统通知
   ===================== */
FA.sendWindowsNotification = function(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                new Notification(title, { body: body, icon: '/favicon.ico' });
            }
        });
    }
};

/* =====================
   工具函数
   ===================== */
FA.checkPermission = function(action) {
    if (!FA.currentUser) return false;
    var perms = FA.PERMISSIONS[FA.currentUser.role];
    return perms && perms[action];
};

FA.applyPermissions = function() {
    document.querySelectorAll('[data-permission]').forEach(function(el) {
        var action = el.dataset.permission;
        el.style.display = FA.checkPermission(action) ? '' : 'none';
    });
};

FA.getRoleClass = function(role) {
    if (role === 'superadmin') return 'admin';
    if (role === 'senior') return 'senior';
    return 'user';
};

FA.getRoleName = function(role) {
    return FA.roleNames[role] || role;
};

FA.getTodayStr = function() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};

FA.showToast = function(msg, type) {
    type = type || 'info';
    var toast = document.getElementById('toast');
    if (!toast) return;
    // Build content with icon
    var iconHTML = '';
    if (type === 'success') {
        iconHTML = '<span class="toast-icon toast-icon-success"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>';
    } else if (type === 'error') {
        iconHTML = '<span class="toast-icon toast-icon-error"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>';
    }
    toast.innerHTML = '<span class="toast-text">' + msg + '</span>' + iconHTML;
    toast.className = 'toast ' + type;
    requestAnimationFrame(function() { toast.classList.add('show'); });
    if (FA._toastTimer) clearTimeout(FA._toastTimer);
    FA._toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3000);
};

FA.formatTime = function(isoStr) {
    var d = new Date(isoStr);
    var now = new Date();
    var diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff/60) + '分钟前';
    if (diff < 86400) return Math.floor(diff/3600) + '小时前';
    return d.toLocaleDateString('zh-CN');
};

FA.showModal = function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
};

FA.closeModal = function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
};
