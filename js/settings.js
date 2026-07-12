/* ======================================================================
   settings.js - 系统设置页面 (个人信息 / 数据管理 / 关于系统)
   合并了原 profile-section 的功能
   ====================================================================== */

window.FA = window.FA || {};

/* 重写 showSection：将 'profile-section' 重定向到设置页个人信息标签 */
(function() {
    var originalShowSection = FA.showSection;
    FA.showSection = function(id, event) {
        if (id === 'profile-section') {
            originalShowSection('settings-section', event);
            if (FA.Settings) FA.Settings.showProfileTab();
        } else {
            originalShowSection(id, event);
        }
    };
})();

FA.Settings = {
    /* 初始化设置页面：构建标签页结构 */
    init: function() {
        var section = document.getElementById('settings-section');
        if (!section) return;

        /* 构建新的设置页 HTML */
        section.innerHTML =
            '<h1 class="page-title">系统设置</h1>' +
            '<p class="page-subtitle">管理个人信息和系统配置</p>' +

            /* 标签页导航 */
            '<div class="settings-tabs" id="settingsTabs">' +
                '<div class="settings-tab active" data-tab="profile">👤 个人信息</div>' +
                '<div class="settings-tab" data-tab="data">💾 数据管理</div>' +
                '<div class="settings-tab" data-tab="system">ℹ️ 关于系统</div>' +
            '</div>' +

            /* 标签1: 个人信息 (原 profile-section 内容) */
            '<div id="settingsTabProfile" class="settings-tab-content">' +
                '<div class="profile-card">' +
                    '<div class="profile-header">' +
                        '<div class="profile-avatar-large" id="profileAvatar" style="cursor:pointer;overflow:hidden;">朱</div>' +
                        '<input type="file" id="avatarUpload" accept="image/*" style="display:none">' +
                        '<div class="profile-details">' +
                            '<h2 id="profileName">用户</h2>' +
                            '<span class="role-badge admin" id="profileRole">管理员</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="profile-info-grid">' +
                        '<div class="profile-info-item"><label>用户名</label><span id="profileUsername">—</span></div>' +
                        '<div class="profile-info-item"><label>角色</label><span id="profileRoleText">—</span></div>' +
                        '<div class="profile-info-item"><label>手机号</label><span id="profilePhone">—</span></div>' +
                        '<div class="profile-info-item"><label>邮箱</label><span id="profileEmail">未填写</span></div>' +
                        '<div class="profile-info-item"><label>性别</label><span id="profileGender">未填写</span></div>' +
                        '<div class="profile-info-item"><label>登录时间</label><span id="profileLoginTime">—</span></div>' +
                    '</div>' +
                    '<div class="permissions-list">' +
                        '<h3 style="font-size:15px;margin-bottom:12px">权限列表</h3>' +
                        '<div id="permissionsList"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 标签2: 数据管理 */
            '<div id="settingsTabData" class="settings-tab-content" style="display:none">' +
                '<div class="settings-group">' +
                    '<h3>数据管理</h3>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">📥</div>' +
                            '<div class="settings-item-content"><h4>导出数据</h4><p>将所有数据保存为文件</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="FA.Data.exportData()" data-permission="exportData">导出</button>' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">📤</div>' +
                            '<div class="settings-item-content"><h4>导入数据</h4><p>从文件恢复数据</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="document.getElementById(\'importFile2\').click()" data-permission="importData">导入</button>' +
                        '<input type="file" id="importFile2" accept=".json" style="display:none" onchange="FA.Data.importData(event)">' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">🔄</div>' +
                            '<div class="settings-item-content"><h4>重置数据</h4><p>清空所有数据并恢复默认</p></div>' +
                        '</div>' +
                        '<button class="btn-secondary" style="color:#e74c3c" onclick="FA.Data.resetAll()" data-permission="resetData">重置</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 标签3: 关于系统 */
            '<div id="settingsTabSystem" class="settings-tab-content" style="display:none">' +
                '<div class="settings-group">' +
                    '<h3>关于系统</h3>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">ℹ️</div>' +
                            '<div class="settings-item-content"><h4>系统版本</h4><p>当前版本信息</p></div>' +
                        '</div>' +
                        '<span style="color:#888;font-size:14px">v2.0.0</span>' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">🔐</div>' +
                            '<div class="settings-item-content"><h4>安全认证</h4><p>VAL 时空同步验证</p></div>' +
                        '</div>' +
                        '<span style="color:#28a745;font-size:14px">已启用</span>' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">🌐</div>' +
                            '<div class="settings-item-content"><h4>VAL 服务</h4><p>随机数生成状态</p></div>' +
                        '</div>' +
                        '<span style="color:#28a745;font-size:14px">在线</span>' +
                    '</div>' +
                '</div>' +
            '</div>';

        /* 移除旧的 profile-section */
        var profileSection = document.getElementById('profile-section');
        if (profileSection) profileSection.remove();

        /* 更新侧边栏用户头像点击事件 */
        var userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.setAttribute('onclick', "FA.showSection('settings-section'); FA.Settings.showProfileTab();");
        }

        /* 绑定标签页点击 */
        var tabs = section.querySelectorAll('.settings-tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                FA.Settings.showTab(tab.dataset.tab);
            });
        });

        /* 绑定头像上传 */
        var avatar = document.getElementById('profileAvatar');
        var avatarUpload = document.getElementById('avatarUpload');
        if (avatar && avatarUpload) {
            avatar.addEventListener('click', function() { avatarUpload.click(); });
            avatarUpload.addEventListener('change', function(e) { FA.Settings.editAvatar(e); });
        }
    },

    /* 切换标签页 */
    showTab: function(tabName) {
        document.querySelectorAll('.settings-tab-content').forEach(function(el) {
            el.style.display = 'none';
        });
        document.querySelectorAll('.settings-tab').forEach(function(el) {
            el.classList.remove('active');
        });

        var tabMap = { profile: 'settingsTabProfile', data: 'settingsTabData', system: 'settingsTabSystem' };
        var contentEl = document.getElementById(tabMap[tabName]);
        if (contentEl) contentEl.style.display = '';

        var tabEl = document.querySelector('.settings-tab[data-tab="' + tabName + '"]');
        if (tabEl) tabEl.classList.add('active');

        /* 切换到个人信息标签时刷新资料 */
        if (tabName === 'profile') {
            FA.Settings.renderProfileInfo();
        }
    },

    /* 显示个人信息标签 */
    showProfileTab: function() {
        this.showTab('profile');
    },

    /* 渲染个人信息 */
    renderProfileInfo: function() {
        var u = FA.currentUser;
        if (!u) return;

        var name = u.nameCn || u.name;

        /* 头像文字 */
        var avatar = document.getElementById('profileAvatar');
        if (avatar) {
            avatar.textContent = name.charAt(0);
        }

        /* 检查已保存的头像图片 */
        var avatarKey = 'fi_avatar_' + u.username;
        var savedAvatar = localStorage.getItem(avatarKey);
        if (savedAvatar && avatar) {
            avatar.style.backgroundImage = 'url(' + savedAvatar + ')';
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        }

        /* 各字段 */
        this.setText('profileName', name);
        this.setText('profileUsername', u.username);
        this.setText('profileRoleText', FA.getRoleName(u.role));
        this.setText('profilePhone', u.phone);
        this.setText('profileEmail', u.email || '未填写');
        this.setText('profileGender', u.gender || '未填写');
        this.setText('profileLoginTime', u.loginTime);

        /* 角色徽章 */
        var roleBadge = document.getElementById('profileRole');
        if (roleBadge) {
            roleBadge.textContent = FA.getRoleName(u.role);
            roleBadge.className = 'role-badge ' + FA.getRoleClass(u.role);
        }

        /* 同步侧边栏头像 */
        var sidebarAvatar = document.getElementById('userAvatar');
        if (sidebarAvatar) {
            if (savedAvatar) {
                sidebarAvatar.style.backgroundImage = 'url(' + savedAvatar + ')';
                sidebarAvatar.style.backgroundSize = 'cover';
                sidebarAvatar.style.backgroundPosition = 'center';
                sidebarAvatar.textContent = '';
            } else {
                sidebarAvatar.style.backgroundImage = '';
                sidebarAvatar.textContent = name.charAt(0);
            }
        }

        /* 渲染权限列表 */
        FA.renderPermissions();
    },

    /* 辅助：设置元素文本 */
    setText: function(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    /* 上传并设置头像 */
    editAvatar: function(event) {
        var file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            FA.showToast('请选择图片文件', 'error');
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            var avatarKey = 'fi_avatar_' + FA.currentUser.username;
            localStorage.setItem(avatarKey, e.target.result);

            /* 更新设置页头像 */
            var avatar = document.getElementById('profileAvatar');
            if (avatar) {
                avatar.style.backgroundImage = 'url(' + e.target.result + ')';
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
                avatar.textContent = '';
            }

            /* 更新侧边栏头像 */
            var sidebarAvatar = document.getElementById('userAvatar');
            if (sidebarAvatar) {
                sidebarAvatar.style.backgroundImage = 'url(' + e.target.result + ')';
                sidebarAvatar.style.backgroundSize = 'cover';
                sidebarAvatar.style.backgroundPosition = 'center';
                sidebarAvatar.textContent = '';
            }

            FA.showToast('头像更新成功', 'success');
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }
};

/* =====================
   渲染权限列表
   ===================== */
FA.renderPermissions = function() {
    var list = document.getElementById('permissionsList');
    if (!list || !FA.currentUser) return;

    var perms = FA.PERMISSIONS[FA.currentUser.role];
    list.innerHTML = Object.keys(FA.permissionLabels).map(function(key) {
        var hasPerm = perms && perms[key];
        return '<div class="permission-item">' +
            '<span class="permission-icon ' + (hasPerm ? 'yes' : 'no') + '">' + (hasPerm ? '✓' : '✕') + '</span>' +
            '<span class="permission-text">' + FA.permissionLabels[key] + '</span>' +
        '</div>';
    }).join('');
};
