/* ======================================================================
   config.js - 全局配置、账号体系、权限定义
   所有模块通过 window.FA 命名空间共享数据
   ====================================================================== */

window.FA = window.FA || {};

/* =====================
   账号体系 (用户名改为英文)
   ===================== */
FA.accounts = {
    "zhuha":      { password: "zhuha106424", role: "superadmin", name: "zhuha",   nameCn: "朱哈",   phone: "138****0001", email: "zhuha@family.local", gender: "男" },
    "zhunengxin": { password: "19770714",   role: "senior",    name: "zhunengxin", nameCn: "朱能新", phone: "139****0002", email: "zhunengxin@family.local", gender: "男" },
    "huguili":    { password: "19800328",   role: "senior",    name: "huguili",    nameCn: "胡桂丽", phone: "137****0003", email: "huguili@family.local", gender: "女" },
    "zhurenmin":  { password: "19430513",   role: "user",      name: "zhurenmin",  nameCn: "朱人民", phone: "136****0004", email: "zhurenmin@family.local", gender: "男" },
    "luoaiyu":    { password: "19520606",   role: "user",      name: "luoaiyu",    nameCn: "罗爱玉", phone: "135****0005", email: "luoaiyu@family.local", gender: "女" }
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
    userVerify: 'fi_user_verified' // 存储每个用户的实名认证状态
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
FA.selectedTimezone = 'UTC+8';
FA.selectedOffset = 8;

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
    toast.textContent = msg;
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
