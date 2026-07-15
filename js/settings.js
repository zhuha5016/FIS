/* ======================================================================
   settings.js - 系统设置页面 (个人信息 / 账号与安全 / 数据管理 / 关于系统)
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
                '<div class="settings-tab" data-tab="security">🔐 账号与安全</div>' +
                '<div class="settings-tab" data-tab="data">💾 数据管理</div>' +
                '<div class="settings-tab" data-tab="system">ℹ️ 关于系统</div>' +
            '</div>' +

            /* 标签1: 个人信息 (原 profile-section 内容) */
            '<div id="settingsTabProfile" class="settings-tab-content">' +
                '<div class="profile-card">' +
                    '<div class="profile-header" style="position:relative">' +
                        '<div class="profile-avatar-large" id="profileAvatar">朱</div>' +
                        '<input type="file" id="avatarUpload" style="display:none">' +
                        '<div class="profile-details">' +
                            '<h2 id="profileName">用户</h2>' +
                            '<span class="role-badge admin" id="profileRole">管理员</span>' +
                        '</div>' +
                        /* Edit button positioned on the right, same horizontal level as avatar */
                        '<button class="btn-edit-profile" id="editProfileBtn" onclick="FA.Settings.editProfile()" style="position:absolute;right:0;top:0">' +
                            '✏️ 编辑信息' +
                        '</button>' +
                    '</div>' +

                    /* Personal info in white-bordered box */
                    '<div class="profile-section-box">' +
                        '<h3 class="profile-section-title">个人信息</h3>' +
                        '<div class="profile-info-grid">' +
                            '<div class="profile-info-item">' +
                                '<label>姓名</label>' +
                                '<span class="profile-info-value"><strong id="profileNameCn">朱哈</strong> <strong id="profileNameEn">zhuha</strong></span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>用户名</label>' +
                                '<span class="profile-info-value" id="profileUsername">—</span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>角色</label>' +
                                '<span class="profile-info-value" id="profileRoleText">—</span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>手机号</label>' +
                                '<span class="profile-info-value" id="profilePhone">—</span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>邮箱</label>' +
                                '<span class="profile-info-value" id="profileEmail">未填写</span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>性别</label>' +
                                '<span class="profile-info-value" id="profileGender">未填写</span>' +
                            '</div>' +
                            '<div class="profile-info-item">' +
                                '<label>登录时间</label>' +
                                '<span class="profile-info-value" id="profileLoginTime">—</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +

                    /* Permissions in separate white box */
                    '<div class="profile-section-box">' +
                        '<h3 class="profile-section-title">权限信息</h3>' +
                        '<div class="permissions-grid" id="permissionsList"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 标签2: 账号与安全 */
            '<div id="settingsTabSecurity" class="settings-tab-content" style="display:none">' +
                '<div class="settings-group">' +
                    '<h3>账号与安全</h3>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left"><div class="settings-item-icon">🔑</div>' +
                        '<div class="settings-item-content"><h4>修改密码</h4><p>更改账户登录密码</p></div></div>' +
                        '<button class="btn-primary" onclick="FA.Settings.changePassword()">修改</button>' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left"><div class="settings-item-icon">📱</div>' +
                        '<div class="settings-item-content"><h4>绑定手机号</h4><p>修改绑定的手机号</p></div></div>' +
                        '<button class="btn-primary" onclick="FA.Settings.changePhone()">修改</button>' +
                    '</div>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left"><div class="settings-item-icon">❓</div>' +
                        '<div class="settings-item-content"><h4>密保问题</h4><p>设置3个密保问题用于身份验证</p></div></div>' +
                        '<button class="btn-primary" onclick="FA.Settings.setupSecurityQuestions()">设置</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 标签3: 数据管理 */
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
                    '<div class="settings-item" style="position:relative">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">📋</div>' +
                            '<div class="settings-item-content"><h4>操作日志</h4><p>记录数据使用和修改</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="FA.Settings.showOpLogs()">查看</button>' +
                        '<button class="btn-primary" id="manageAllOpLogsBtn" style="background:linear-gradient(45deg,#007AFF,#5856D6);display:none;margin-left:6px" onclick="FA.Settings.showOpLogs(true)">⚙️ 管理</button>' +
                    '</div>' +
                    '<div class="settings-item" id="loginLogsRow" style="display:none">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">🔒</div>' +
                            '<div class="settings-item-content"><h4>登录日志</h4><p>仅超级管理员可见</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="FA.Settings.showLoginLogs()">查看</button>' +
                    '</div>' +
                    '<div class="settings-item" id="registrationMgmtRow" style="display:none">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">📝</div>' +
                            '<div class="settings-item-content"><h4>注册审核</h4><p>审核新用户注册申请</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="FA.showSection(\'registrations-section\')">查看</button>' +
                    '</div>' +
                    '<div class="settings-item" id="syncRow">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">☁️</div>' +
                            '<div class="settings-item-content"><h4>GitHub 云同步</h4><p>跨浏览器 / 设备共享数据</p></div>' +
                        '</div>' +
                        '<button class="btn-primary" onclick="FA.Sync.openConfigWithVerify()">配置</button>' +
                    '</div>' +
                    '<div id="syncStatusArea" style="padding:4px 0 14px;font-size:13px;color:#666;display:none">' +
                        '<span id="syncStatusIndicator"></span>' +
                        '<div style="margin-top:10px;display:flex;gap:8px">' +
                            '<button class="toolbar-btn" onclick="FA.Sync.pull(true)">立即拉取</button>' +
                            '<button class="toolbar-btn" onclick="FA.Sync.push(true)">立即推送</button>' +
                        '</div>' +
                        '<div style="margin-top:8px;font-size:11px;color:#aaa" id="syncConfigHint"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 标签4: 关于系统 */
            '<div id="settingsTabSystem" class="settings-tab-content" style="display:none">' +
                '<div class="settings-group">' +
                    '<h3>关于系统</h3>' +
                    '<div class="settings-item">' +
                        '<div class="settings-item-left">' +
                            '<div class="settings-item-icon">🌐</div>' +
                            '<div class="settings-item-content"><h4 id="langLabel">系统语言</h4><p>切换系统显示语言</p></div>' +
                        '</div>' +
                        '<select id="langSelect" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);font-size:13px">' +
                            '<option value="zh">中文</option>' +
                            '<option value="en">English</option>' +
                            '<option value="ja">日本語</option>' +
                        '</select>' +
                    '</div>' +
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
                        '<span id="valServiceStatus" style="color:#28a745;font-size:14px">在线</span>' +
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

        /* 绑定语言切换 */
        var langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = FA.currentLang || 'zh';
            langSelect.addEventListener('change', function() {
                FA.setLanguage(this.value);
            });
        }

        /* 立即渲染个人信息(防止初次直接查看设置时资料为空) */
        FA.Settings.renderProfileInfo();

        /* 渲染登录日志 + 操作日志入口(超管显示登录日志) */
        FA.Settings.renderLoginLogs();
        FA.Settings.renderOpLogs();
        FA.Settings.renderSync();
    },

    /* 切换标签页 */
    showTab: function(tabName) {
        document.querySelectorAll('.settings-tab-content').forEach(function(el) {
            el.style.display = 'none';
        });
        document.querySelectorAll('.settings-tab').forEach(function(el) {
            el.classList.remove('active');
        });

        var tabMap = { profile: 'settingsTabProfile', security: 'settingsTabSecurity', data: 'settingsTabData', system: 'settingsTabSystem' };
        var contentEl = document.getElementById(tabMap[tabName]);
        if (contentEl) contentEl.style.display = '';

        var tabEl = document.querySelector('.settings-tab[data-tab="' + tabName + '"]');
        if (tabEl) tabEl.classList.add('active');

        /* 切换到个人信息标签时刷新资料 */
        if (tabName === 'profile') {
            FA.Settings.renderProfileInfo();
        }

        /* 切换到关于系统标签时刷新网络/VAL服务状态 */
        if (tabName === 'system' && FA.updateNetworkStatus) {
            FA.updateNetworkStatus();
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
        this.setText('profileNameCn', u.nameCn || u.name);
        this.setText('profileNameEn', u.name || '');
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
    },

    /* 编辑个人信息 */
    editProfile: function() {
        var u = FA.currentUser;
        if (!u) return;
        var self = this;
        var modalId = 'edit-profile-modal';
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:500px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>编辑个人信息</h3></div>' +
                '<div class="modal-field"><label>中文姓名</label><input id="editProfNameCn" value="' + FA._esc(u.nameCn || '') + '"></div>' +
                '<div class="modal-field"><label>英文姓名</label><input id="editProfName" value="' + FA._esc(u.name || '') + '"></div>' +
                '<div class="modal-field"><label>手机号</label><input id="editProfPhone" value="' + FA._esc(u.phone || '') + '"></div>' +
                '<div class="modal-field"><label>邮箱</label><input id="editProfEmail" value="' + FA._esc(u.email || '') + '"></div>' +
                '<div class="modal-field"><label>性别</label>' +
                    '<div class="gender-tab-selector" id="editProfGender" data-value="' + (u.gender || '男') + '">' +
                        '<div class="gender-tab' + (u.gender !== '女' ? ' active' : '') + '" data-value="男" onclick="FA._selectGender(this)">男</div>' +
                        '<div class="gender-tab' + (u.gender === '女' ? ' active' : '') + '" data-value="女" onclick="FA._selectGender(this)">女</div>' +
                    '</div>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                    '<button class="btn-primary" onclick="FA.Settings.saveProfileEdit()">保存</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    /* 保存个人信息编辑 */
    saveProfileEdit: function() {
        var u = FA.currentUser;
        if (!u) return;

        var changes = [];
        var newNameCn = document.getElementById('editProfNameCn').value.trim();
        var newName = document.getElementById('editProfName').value.trim();
        var newPhone = document.getElementById('editProfPhone').value.trim();
        var newEmail = document.getElementById('editProfEmail').value.trim();
        var genderEl = document.getElementById('editProfGender');
        var newGender = genderEl ? genderEl.dataset.value : u.gender;

        /* Track changes */
        if (newNameCn && newNameCn !== u.nameCn) {
            changes.push({field: 'nameCn', oldValue: u.nameCn, newValue: newNameCn});
            u.nameCn = newNameCn;
            FA.accounts[u.username].nameCn = newNameCn;
        }
        if (newName && newName !== u.name) {
            changes.push({field: 'name', oldValue: u.name, newValue: newName});
            u.name = newName;
            FA.accounts[u.username].name = newName;
        }
        if (newPhone && newPhone !== u.phone) {
            changes.push({field: 'phone', oldValue: u.phone, newValue: newPhone});
            u.phone = newPhone;
            FA.accounts[u.username].phone = newPhone;
        }
        if (newEmail !== (u.email || '')) {
            changes.push({field: 'email', oldValue: u.email || '', newValue: newEmail});
            u.email = newEmail;
            FA.accounts[u.username].email = newEmail;
        }
        if (newGender !== u.gender) {
            changes.push({field: 'gender', oldValue: u.gender, newValue: newGender});
            u.gender = newGender;
            FA.accounts[u.username].gender = newGender;
        }

        /* Update member in FA.members */
        var member = FA.members.find(function(m) { return m.username === u.username; });
        if (member) {
            if (newNameCn) member.nameCn = newNameCn;
            if (newName) member.name = newName;
            member.phone = newPhone;
            member.email = newEmail;
            member.gender = newGender;
            FA.Data.saveData(FA.DB_KEYS.members, FA.members);
        }

        /* Record changes for notification (5-min batched) */
        if (changes.length > 0) {
            FA.Data.recordInfoChange(u.username, changes);
            if (FA.Data.recordOpLog) {
                var detail = changes.map(function(c) { return c.field + ': ' + (c.oldValue || '空') + ' → ' + (c.newValue || '空'); }).join('; ');
                FA.Data.recordOpLog('profile_edit', '编辑个人信息: ' + detail);
            }
        }

        FA.closeModal('edit-profile-modal');
        FA.Auth.updateUserUI();
        this.renderProfileInfo();
        FA.showToast('个人信息已保存', 'success');
    },

    /* 修改密码 */
    changePassword: function() {
        var self = this;
        FA.Verify.requireVerify('修改密码', 'normal', function(success) {
            if (!success) return;
            var modalId = 'change-password-modal';
            var existing = document.getElementById(modalId);
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = modalId;
            modal.style.zIndex = '3000';
            modal.innerHTML =
                '<div class="modal-content" style="max-width:400px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>修改密码</h3></div>' +
                '<div class="modal-field"><label>新密码</label><input id="newPassword" type="password" placeholder="请输入新密码"></div>' +
                '<div class="modal-field"><label>确认密码</label><input id="confirmPassword" type="password" placeholder="请再次输入"></div>' +
                '<div class="modal-actions"><button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                '<button class="btn-primary" onclick="FA.Settings.doChangePassword()">确认</button></div>' +
                '</div>';
            document.body.appendChild(modal);
            FA.showModal(modalId);
        });
    },

    /* 执行修改密码 */
    doChangePassword: function() {
        var newPass = document.getElementById('newPassword').value;
        var confirmPass = document.getElementById('confirmPassword').value;
        if (!newPass) return FA.showToast('请输入新密码', 'error');
        if (newPass !== confirmPass) return FA.showToast('两次密码不一致', 'error');
        if (newPass.length < 6) return FA.showToast('密码长度至少6位', 'error');

        var u = FA.currentUser;
        var oldPass = FA.accounts[u.username].password;
        FA.accounts[u.username].password = newPass;

        FA.Data.recordInfoChange(u.username, [{field: 'password', oldValue: '***', newValue: '***'}]);

        FA.closeModal('change-password-modal');
        FA.showToast('密码修改成功', 'success');
    },

    /* 修改手机号 */
    changePhone: function() {
        var self = this;
        FA.Verify.requireVerify('修改手机号', 'normal', function(success) {
            if (!success) return;
            var modalId = 'change-phone-modal';
            var existing = document.getElementById(modalId);
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = modalId;
            modal.style.zIndex = '3000';
            modal.innerHTML =
                '<div class="modal-content" style="max-width:400px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>修改手机号</h3></div>' +
                '<div class="modal-field"><label>新手机号</label><input id="newPhoneInput" type="text" placeholder="请输入新手机号"></div>' +
                '<div class="modal-actions"><button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                '<button class="btn-primary" onclick="FA.Settings.doChangePhone()">确认</button></div>' +
                '</div>';
            document.body.appendChild(modal);
            FA.showModal(modalId);
        });
    },

    /* 执行修改手机号 */
    doChangePhone: function() {
        var newPhone = document.getElementById('newPhoneInput').value.trim();
        if (!newPhone) return FA.showToast('请输入手机号', 'error');

        var u = FA.currentUser;
        var oldPhone = u.phone;
        u.phone = newPhone;
        FA.accounts[u.username].phone = newPhone;

        var member = FA.members.find(function(m) { return m.username === u.username; });
        if (member) {
            member.phone = newPhone;
            FA.Data.saveData(FA.DB_KEYS.members, FA.members);
        }

        FA.Data.recordInfoChange(u.username, [{field: 'phone', oldValue: oldPhone, newValue: newPhone}]);
        if (FA.Data.recordOpLog) FA.Data.recordOpLog('phone_change', '修改手机号: ' + oldPhone + ' → ' + newPhone);

        FA.closeModal('change-phone-modal');
        FA.Auth.updateUserUI();
        this.renderProfileInfo();
        FA.showToast('手机号修改成功', 'success');
    },

    /* 设置密保问题 */
    setupSecurityQuestions: function() {
        var self = this;
        FA.Verify.requireVerify('设置密保问题', 'normal', function(success) {
            if (!success) return;
            var u = FA.currentUser;
            var acc = FA.accounts[u.username];
            if (!acc.securityQuestions) acc.securityQuestions = [{question:'',answer:''},{question:'',answer:''},{question:'',answer:''}];

            var modalId = 'security-questions-modal';
            var existing = document.getElementById(modalId);
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = modalId;
            modal.style.zIndex = '3000';

            var questionsHTML = '';
            var presets = ['您的出生城市是？', '您母亲的姓名是？', '您第一所学校名称是？', '您最喜欢的食物是？', '您的宠物名字是？'];
            for (var i = 0; i < 3; i++) {
                var sq = acc.securityQuestions[i] || {question:'',answer:''};
                var opts = presets.map(function(p) { return '<option value="' + p + '"' + (sq.question === p ? ' selected' : '') + '>' + p + '</option>'; }).join('');
                questionsHTML +=
                    '<div class="modal-field"><label>密保问题 ' + (i+1) + '</label>' +
                    '<select id="secQ' + i + '"><option value="">请选择</option>' + opts + '<option value="custom">自定义</option></select></div>' +
                    '<div class="modal-field" id="customQ' + i + '" style="display:none"><label>自定义问题</label><input id="secQCustom' + i + '" value="' + (presets.indexOf(sq.question) === -1 ? FA._esc(sq.question) : '') + '"></div>' +
                    '<div class="modal-field"><label>答案</label><input id="secA' + i + '" value="' + FA._esc(sq.answer) + '"></div>';
            }

            modal.innerHTML =
                '<div class="modal-content" style="max-width:460px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>设置密保问题</h3></div>' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">设置3个密保问题，用于身份验证和密码找回</p>' +
                questionsHTML +
                '<div class="modal-actions"><button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                '<button class="btn-primary" onclick="FA.Settings.saveSecurityQuestions()">保存</button></div>' +
                '</div>';

            document.body.appendChild(modal);

            /* Setup custom question toggle */
            for (var j = 0; j < 3; j++) {
                (function(idx) {
                    var select = document.getElementById('secQ' + idx);
                    var customDiv = document.getElementById('customQ' + idx);
                    if (select.value === 'custom') customDiv.style.display = 'block';
                    select.addEventListener('change', function() {
                        customDiv.style.display = this.value === 'custom' ? 'block' : 'none';
                    });
                })(j);
            }

            FA.showModal(modalId);
        });
    },

    /* 保存密保问题 */
    saveSecurityQuestions: function() {
        var u = FA.currentUser;
        var acc = FA.accounts[u.username];
        if (!acc.securityQuestions) acc.securityQuestions = [];

        for (var i = 0; i < 3; i++) {
            var select = document.getElementById('secQ' + i);
            var question = select.value;
            if (question === 'custom') {
                question = document.getElementById('secQCustom' + i).value.trim();
            }
            var answer = document.getElementById('secA' + i).value.trim();

            if (!question) { FA.showToast('请选择密保问题' + (i+1), 'error'); return; }
            if (!answer) { FA.showToast('请输入答案' + (i+1), 'error'); return; }

            acc.securityQuestions[i] = { question: question, answer: answer };
        }

        FA.closeModal('security-questions-modal');
        FA.showToast('密保问题设置成功', 'success');
        if (FA.Data.recordOpLog) FA.Data.recordOpLog('security_setup', '设置密保问题');
    },

    /* =====================
       登录日志 (超管可见)
       ===================== */
    renderLoginLogs: function() {
        var isSuper = (FA.currentUser && FA.currentUser.role === 'superadmin');
        var row = document.getElementById('loginLogsRow');
        if (row) row.style.display = isSuper ? '' : 'none';
        var regRow = document.getElementById('registrationMgmtRow');
        if (regRow) regRow.style.display = isSuper ? '' : 'none';
    },

    /* =====================
       GitHub 云同步状态 (所有用户可见)
       每个用户都能看到同步状态与拉取/推送按钮, 修改配置需身份验证
       ===================== */
    renderSync: function() {
        /* 同步入口对所有用户开放 */
        var syncRow = document.getElementById('syncRow');
        if (syncRow) syncRow.style.display = '';

        var area = document.getElementById('syncStatusArea');
        if (!area) return;
        area.style.display = '';

        FA.Sync.setStatus(FA.Sync.status);
        var hint = document.getElementById('syncConfigHint');
        if (hint) {
            if (FA.Sync.isConfigured()) {
                hint.textContent = FA.Sync.config.owner + '/' + FA.Sync.config.repo + ' @ ' +
                    FA.Sync.config.branch + ' · ' + FA.Sync.config.path;
            } else {
                hint.textContent = '尚未配置云同步 · 点击「配置」进行设置 (需身份验证)';
            }
        }
    },

    showLoginLogs: function() {
        if (!FA.currentUser || FA.currentUser.role !== 'superadmin') {
            return FA.showToast('仅超级管理员可查看登录日志', 'error');
        }

        var modalId = 'login-logs-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';

        var logs = (FA.loginLogs || []).slice(0, 200);
        var actionNames = { login: '登录', logout: '退出', switch: '切换用户', failed: '登录失败' };
        var actionColors = { login: '#28a745', logout: '#888', switch: '#007AFF', failed: '#e74c3c' };

        var rows = logs.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无登录日志</p></div>'
            : logs.map(function(l) {
                var userName = (FA.accounts[l.username] && (FA.accounts[l.username].nameCn || FA.accounts[l.username].name)) || l.username;
                var timeStr = l.time ? new Date(l.time).toLocaleString('zh-CN', {hour12:false}) : '';
                var color = actionColors[l.action] || '#666';
                var actionName = actionNames[l.action] || l.action;
                return '<div style="font-size:12px;color:#666;margin-bottom:4px;padding:8px;background:rgba(245,245,247,0.5);border-radius:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
                    '<span style="display:inline-block;min-width:54px;padding:2px 6px;background:' + color + ';color:#fff;border-radius:4px;font-size:11px;text-align:center">' + actionName + '</span>' +
                    '<span style="min-width:80px"><strong>' + userName + '</strong> (' + l.username + ')</span>' +
                    '<span style="flex:1;min-width:120px">' + (l.detail || '') + '</span>' +
                    '<span style="color:#007AFF;font-size:11px;white-space:nowrap">🌐 ' + (l.browser || '') + '</span>' +
                    '<span style="color:#888;font-size:11px;white-space:nowrap">📍 ' + (l.ip || '本地') + '</span>' +
                    (l.location && l.location !== '获取中...' ? '<span style="color:#888;font-size:11px;white-space:nowrap">🗺 ' + l.location + '</span>' : '') +
                    '<span style="color:#aaa;font-size:11px;white-space:nowrap">' + timeStr + '</span>' +
                '</div>';
            }).join('');

        modal.innerHTML =
            '<div class="modal-content" style="max-width:780px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>🔒 登录日志</h3></div>' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">记录所有用户的登录、退出、切换及失败尝试 (共 ' + logs.length + ' 条)</p>' +
                '<div style="max-height:480px;overflow-y:auto">' + rows + '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" style="color:#e74c3c" onclick="if(confirm(\'确定清空所有登录日志？\')){FA.loginLogs=[];FA.Data.saveData(FA.DB_KEYS.loginLogs,[]);FA.closeModal(\'' + modalId + '\');FA.showToast(\'已清空登录日志\',\'info\');}">清空日志</button>' +
                    '<button class="btn-primary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    /* =====================
       操作日志 (每个用户都有)
       ===================== */
    renderOpLogs: function() {
        /* 超管显示 "管理" 按钮 (右上角) */
        var manageBtn = document.getElementById('manageAllOpLogsBtn');
        if (manageBtn) {
            manageBtn.style.display = (FA.currentUser && FA.currentUser.role === 'superadmin') ? '' : 'none';
        }
    },

    showOpLogs: function(showAll) {
        if (!FA.currentUser) return;

        var modalId = 'op-logs-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';

        var isSuper = (FA.currentUser.role === 'superadmin');
        var showAllUsers = isSuper && showAll;

        var allLogs = (FA.opLogs || []).slice(0, 500);
        var logs = showAllUsers ? allLogs : allLogs.filter(function(l) { return l.username === FA.currentUser.username; });

        var userOptions = '';
        if (showAllUsers) {
            /* 用户过滤下拉 */
            var users = [];
            allLogs.forEach(function(l) { if (users.indexOf(l.username) === -1) users.push(l.username); });
            userOptions = '<select id="opLogUserFilter" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
                '<option value="">全部用户</option>' +
                users.map(function(u) { return '<option value="' + u + '">' + ((FA.accounts[u] && FA.accounts[u].nameCn) || u) + ' (' + u + ')</option>'; }).join('') +
            '</select>';
        }

        var rows = logs.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无操作日志</p></div>'
            : logs.map(function(l) {
                var userName = (FA.accounts[l.username] && (FA.accounts[l.username].nameCn || FA.accounts[l.username].name)) || l.username;
                var timeStr = l.time ? new Date(l.time).toLocaleString('zh-CN', {hour12:false}) : '';
                return '<div class="op-log-row" data-user="' + l.username + '" style="font-size:12px;color:#666;margin-bottom:4px;padding:8px;background:rgba(245,245,247,0.5);border-radius:6px;display:flex;gap:10px;align-items:center">' +
                    '<span style="min-width:80px"><strong>' + userName + '</strong></span>' +
                    '<span style="min-width:90px;padding:2px 6px;background:rgba(0,122,255,0.1);color:#007AFF;border-radius:4px;font-size:11px;text-align:center">' + l.action + '</span>' +
                    '<span style="flex:1">' + (l.detail || '') + '</span>' +
                    '<span style="color:#aaa;font-size:11px;white-space:nowrap">' + timeStr + '</span>' +
                '</div>';
            }).join('');

        modal.innerHTML =
            '<div class="modal-content" style="max-width:780px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>📋 操作日志' + (showAllUsers ? ' <span style="font-size:12px;color:#007AFF;font-weight:normal">(超管模式 - 全部用户)</span>' : '') + '</h3></div>' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">记录数据使用和修改 (共 ' + logs.length + ' 条)</p>' +
                (userOptions ? '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">' + userOptions +
                    '<input type="text" id="opLogSearchInput" placeholder="搜索操作/详情" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px;flex:1;min-width:180px">' +
                    '<button class="toolbar-btn" onclick="FA.Settings._filterOpLogs()">筛选</button>' +
                    '<button class="toolbar-btn" onclick="document.getElementById(\'opLogUserFilter\').value=\'\';document.getElementById(\'opLogSearchInput\').value=\'\';FA.Settings._filterOpLogs()">清空</button>' +
                '</div>' : '') +
                '<div id="opLogsBody" style="max-height:480px;overflow-y:auto">' + rows + '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" style="color:#e74c3c" onclick="if(confirm(\'确定清空自己的操作日志？\')){FA.opLogs = (FA.opLogs||[]).filter(function(l){return l.username !== FA.currentUser.username;});FA.Data.saveData(FA.DB_KEYS.opLogs, FA.opLogs);FA.closeModal(\'' + modalId + '\');FA.showToast(\'已清空您的操作日志\',\'info\');}">清空我的日志</button>' +
                    '<button class="btn-primary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);

        if (showAllUsers) {
            var filterEl = document.getElementById('opLogUserFilter');
            var searchEl = document.getElementById('opLogSearchInput');
            if (filterEl) filterEl.addEventListener('change', FA.Settings._filterOpLogs);
            if (searchEl) searchEl.addEventListener('input', FA.Settings._filterOpLogs);
        }
    },

    _filterOpLogs: function() {
        var body = document.getElementById('opLogsBody');
        if (!body) return;
        var userVal = document.getElementById('opLogUserFilter');
        var searchVal = document.getElementById('opLogSearchInput');
        var userF = userVal ? userVal.value : '';
        var searchF = searchVal ? searchVal.value.toLowerCase() : '';

        body.querySelectorAll('.op-log-row').forEach(function(row) {
            var rowUser = row.dataset.user || '';
            var rowText = row.textContent.toLowerCase();
            var showUser = !userF || rowUser === userF;
            var showSearch = !searchF || rowText.indexOf(searchF) !== -1;
            row.style.display = (showUser && showSearch) ? '' : 'none';
        });
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
        return '<div class="permission-grid-item">' +
            '<span class="permission-icon ' + (hasPerm ? 'yes' : 'no') + '">' + (hasPerm ? '✓' : '✕') + '</span>' +
            '<span class="permission-text">' + FA.permissionLabels[key] + '</span>' +
        '</div>';
    }).join('');
};
