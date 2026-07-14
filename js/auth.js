/* ======================================================================
   auth.js - 登录认证、会话管理、用户切换
   ====================================================================== */

window.FA = window.FA || {};

FA.Auth = {
    /* DOM 引用 */
    btn: null,
    userInput: null,
    passInput: null,
    valBoxes: null,
    passEye: null,
    valEye: null,
    tzBtn: null,
    tzDropdown: null,
    tzLabel: null,

    init: function() {
        this.btn = document.getElementById('loginBtn');
        this.userInput = document.getElementById('user');
        this.passInput = document.getElementById('pass');
        this.valBoxes = document.querySelectorAll('.val-box');
        this.passEye = document.getElementById('passEye');
        this.valEye = document.getElementById('valEye');
        this.tzBtn = document.getElementById('tzBtn');
        this.tzDropdown = document.getElementById('tzDropdown');
        this.tzLabel = document.getElementById('tzLabel');

        this.setupEyes();
        this.setupVALBoxes();
        this.setupTimezone();
        this.setupLoginButton();
        this.setupUserPopup();
        this.setupForgotPassword();

        /* 启动单点登录监听: storage 事件 + 定时轮询 */
        this._startSingleSignOnMonitor();
    },

    /* 小眼睛: 按下显示, 松开隐藏 */
    setupEyes: function() {
        var self = this;
        function bind(eyeBtn, inputs) {
            var show = function() { inputs.forEach(function(i) { i.type = 'text'; }); };
            var hide = function() { inputs.forEach(function(i) { i.type = 'password'; }); };
            eyeBtn.addEventListener('mousedown', show);
            eyeBtn.addEventListener('mouseup', hide);
            eyeBtn.addEventListener('mouseleave', hide);
            eyeBtn.addEventListener('touchstart', function(e) { e.preventDefault(); show(); });
            eyeBtn.addEventListener('touchend', function(e) { e.preventDefault(); hide(); });
        }
        bind(this.passEye, [this.passInput]);
        bind(this.valEye, Array.from(this.valBoxes));
    },

    /* VAL 六框输入 */
    setupVALBoxes: function() {
        var self = this;
        var valBoxes = this.valBoxes;
        valBoxes.forEach(function(box, index) {
            box.addEventListener('input', function(e) {
                var val = e.target.value.replace(/\D/g, '');
                if (val.length > 1) {
                    val.split('').forEach(function(digit, i) {
                        if (i < valBoxes.length) valBoxes[i].value = digit;
                    });
                    valBoxes[Math.min(val.length, valBoxes.length - 1)].focus();
                    return;
                }
                e.target.value = val;
                if (val && index < valBoxes.length - 1) valBoxes[index + 1].focus();
                self.resetButton();
            });
            box.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    valBoxes[index - 1].focus();
                    valBoxes[index - 1].value = '';
                    e.preventDefault();
                    self.resetButton();
                }
                if (e.key === 'ArrowLeft' && index > 0) valBoxes[index - 1].focus();
                if (e.key === 'ArrowRight' && index < valBoxes.length - 1) valBoxes[index + 1].focus();
            });
            box.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                text.split('').forEach(function(digit, i) {
                    if (i < valBoxes.length) valBoxes[i].value = digit;
                });
                valBoxes[Math.min(text.length, valBoxes.length - 1)].focus();
                self.resetButton();
            });
        });

        [this.passInput].concat(Array.from(valBoxes)).forEach(function(i) {
            i.addEventListener('input', function() { self.resetButton(); });
        });
        this.userInput.addEventListener('input', function() { self.resetButton(); });
    },

    /* 时区选择器 */
    setupTimezone: function() {
        var self = this;
        this.tzBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.tzDropdown.classList.toggle('open');
            self.tzBtn.classList.toggle('open');
        });
        document.querySelectorAll('.tz-option').forEach(function(opt) {
            opt.addEventListener('click', function() {
                document.querySelectorAll('.tz-option').forEach(function(o) { o.classList.remove('selected'); });
                opt.classList.add('selected');
                FA.selectedTimezone = opt.dataset.tz;
                FA.selectedOffset = parseInt(opt.dataset.offset);
                self.tzLabel.textContent = opt.textContent.trim();
                self.tzDropdown.classList.remove('open');
                self.tzBtn.classList.remove('open');
            });
        });
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.tz-selector')) {
                self.tzDropdown.classList.remove('open');
                self.tzBtn.classList.remove('open');
            }
        });
    },

    /* 登录按钮 */
    setupLoginButton: function() {
        var self = this;
        this.btn.onclick = async function() {
            self.setButtonState('loading', '正在向服务器发送[Validate]请求...');
            await new Promise(function(r) { setTimeout(r, 800); });

            if (!navigator.onLine) { self.triggerError('Network Error'); return; }

            var u = self.userInput.value.trim();
            var p = self.passInput.value;

            // Try to find account by username OR phone number
            var acc = FA.accounts[u];
            var loginUsername = u;

            if (!acc) {
                // Try matching by phone number
                var foundKey = Object.keys(FA.accounts).find(function(key) {
                    var a = FA.accounts[key];
                    // Match full phone or last 4 digits
                    return a.phone === u || a.phone.replace(/\D/g, '') === u.replace(/\D/g, '') ||
                           a.phone.substring(a.phone.length - 4) === u;
                });
                if (foundKey) {
                    acc = FA.accounts[foundKey];
                    loginUsername = foundKey;
                }
            }

            if (!acc || acc.password !== p) {
                self.passInput.value = '';
                self.clearVAL();
                if (FA.Data.recordLoginLog) {
                    FA.Data.recordLoginLog(u || '未知', 'failed', '账号或密码错误');
                }
                self.triggerError('认证错误');
                return;
            }

            try {
                var expectedVal = await FA.generateVAL(FA.selectedOffset, loginUsername);
                var inputVal = self.getVALInput();
                if (inputVal.length !== 6 || inputVal !== expectedVal) {
                    self.clearVAL();
                    if (FA.Data.recordLoginLog) {
                        FA.Data.recordLoginLog(loginUsername || u, 'failed', '动态验证码错误');
                    }
                    self.triggerError('动态验证码错误');
                    return;
                }
                self.setButtonState('success', '认证成功 ✔️');
                /* 生成会话 token, 保存到当前标签会话 */
                self._sessionToken = FA.generateSessionToken();
                FA.saveSessionInfo({ username: loginUsername, token: self._sessionToken, loginAt: Date.now() });
                setTimeout(function() { self.enterMainSystem(loginUsername); }, 1000);
            } catch (e) {
                self.triggerError('VAL 服务异常');
            }
        };
    },

    getVALInput: function() { return Array.from(this.valBoxes).map(function(b) { return b.value; }).join(''); },
    clearVAL: function() { this.valBoxes.forEach(function(b) { b.value = ''; }); },

    triggerError: function(text) {
        this.setButtonState('error', text);
        this.btn.classList.add('shake');
        var self = this;
        setTimeout(function() { self.btn.classList.remove('shake'); }, 600);
    },

    setButtonState: function(state, text) {
        this.btn.classList.remove('loading', 'error', 'success');
        this.btn.disabled = false;
        if (state === 'loading') { this.btn.classList.add('loading'); this.btn.disabled = true; }
        if (state === 'error') this.btn.classList.add('error');
        if (state === 'success') this.btn.classList.add('success');
        this.btn.textContent = text;
    },

    resetButton: function() {
        if (this.btn.classList.contains('error') || this.btn.classList.contains('success')) {
            this.btn.classList.remove('loading', 'error', 'success', 'shake');
            this.btn.disabled = false;
            this.btn.textContent = 'LOGIN';
        }
    },

    /* 忘记密码 */
    setupForgotPassword: function() {
        var link = document.getElementById('forgotPasswordLink');
        if (!link) return;
        var self = this;
        link.addEventListener('click', function(e) {
            e.preventDefault();
            self.showForgotPasswordModal();
        });
    },

    showForgotPasswordModal: function() {
        var modalId = 'forgot-password-modal';
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>找回密码</h3></div>' +
                '<div id="forgotStep1">' +
                    '<p style="font-size:13px;color:#888;margin-bottom:14px">请输入您的用户名或手机号,我们将帮您找回密码</p>' +
                    '<div class="modal-field"><label>用户名或手机号</label><input id="forgotUserInput" placeholder="请输入用户名或手机号"></div>' +
                    '<div class="modal-actions"><button class="btn-primary" id="forgotNextBtn">下一步</button></div>' +
                '</div>' +
                '<div id="forgotStep2" style="display:none">' +
                    '<p style="font-size:13px;color:#888;margin-bottom:14px">请完成身份验证以重置密码</p>' +
                    '<div id="forgotVerifyHint" style="padding:14px;background:rgba(0,122,255,0.06);border-radius:10px;font-size:13px;color:#666;margin-bottom:14px">' +
                        '已找到用户: <strong id="forgotFoundUser"></strong><br>' +
                        '请点击下方按钮完成身份验证' +
                    '</div>' +
                    '<div class="modal-actions">' +
                        '<button class="btn-secondary" onclick="FA.Auth._goForgotStep(1)">返回</button>' +
                        '<button class="btn-primary" id="forgotVerifyBtn">开始身份验证</button>' +
                    '</div>' +
                '</div>' +
                '<div id="forgotStep3" style="display:none">' +
                    '<p style="font-size:13px;color:#888;margin-bottom:14px">验证通过,请设置新密码</p>' +
                    '<div class="modal-field"><label>新密码</label><input id="forgotNewPass" type="password" placeholder="请输入新密码"></div>' +
                    '<div class="modal-field"><label>确认密码</label><input id="forgotConfirmPass" type="password" placeholder="请再次输入新密码"></div>' +
                    '<div class="modal-actions"><button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button><button class="btn-primary" id="forgotResetBtn">重置密码</button></div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);

        var self = this;

        // Step 1: Find user
        document.getElementById('forgotNextBtn').onclick = function() {
            var input = document.getElementById('forgotUserInput').value.trim();
            if (!input) return FA.showToast('请输入用户名或手机号', 'error');

            // Find account
            var username = null;
            if (FA.accounts[input]) {
                username = input;
            } else {
                var foundKey = Object.keys(FA.accounts).find(function(key) {
                    var a = FA.accounts[key];
                    return a.phone === input || a.phone.replace(/\D/g, '') === input.replace(/\D/g, '') ||
                           a.phone.substring(a.phone.length - 4) === input;
                });
                if (foundKey) username = foundKey;
            }

            if (!username) {
                FA.showToast('未找到对应用户', 'error');
                return;
            }

            // Store the username for later
            self._forgotUsername = username;

            // 显示步骤2, 让用户点击"开始身份验证"按钮
            var foundUserEl = document.getElementById('forgotFoundUser');
            if (foundUserEl) foundUserEl.textContent = (FA.accounts[username].nameCn || username) + ' (' + username + ')';
            self._goForgotStep(2);
        };

        // Step 2: 开始身份验证
        document.getElementById('forgotVerifyBtn').onclick = function() {
            /* 未登录场景: 明确指定验证对象为找回密码的用户, doVerify 依赖此值 */
            FA.Verify._targetUsername = self._forgotUsername;
            /* 强制要求重新验证 (清除任何残留的验证会话) */
            FA.Verify._forceReverify = true;
            /* 保持 forgot modal 打开, verify modal 直接显示在 body 上 (z-index 更高) */
            FA.Verify.requireVerify('找回密码身份验证', 'normal', function(success) {
                FA.Verify._targetUsername = null;
                FA.Verify._forceReverify = false;
                if (success) {
                    /* 验证通过: 关闭 verify, 跳到 step3 */
                    self._goForgotStep(3);
                }
                /* 验证失败: 保持在 step2, 用户可重试 */
            });
        };

        // Step 3: Reset password
        document.getElementById('forgotResetBtn').onclick = function() {
            var newPass = document.getElementById('forgotNewPass').value;
            var confirmPass = document.getElementById('forgotConfirmPass').value;

            if (!newPass) return FA.showToast('请输入新密码', 'error');
            if (newPass !== confirmPass) return FA.showToast('两次密码不一致', 'error');
            if (newPass.length < 6) return FA.showToast('密码长度至少6位', 'error');

            // Update password
            var resetUsername = self._forgotUsername;
            FA.accounts[resetUsername].password = newPass;

            /* 记录操作日志 (无 currentUser 上下文, 用 _forgotUsername) */
            if (FA.Data.recordLoginLog) {
                FA.Data.recordLoginLog(resetUsername, 'password_reset', '用户通过身份验证重置密码');
            }
            if (FA.Data.opLogs) {
                FA.Data.opLogs.unshift({
                    id: 'op_' + Date.now(),
                    username: resetUsername,
                    action: 'password_reset',
                    detail: '通过身份验证重置密码',
                    time: new Date().toISOString()
                });
                FA.Data.saveData(FA.DB_KEYS.opLogs, FA.Data.opLogs);
            }

            FA.showToast('密码重置成功，请重新登录', 'success');
            setTimeout(function() {
                FA.closeModal(modalId);
            }, 1500);
        };

        FA.showModal(modalId);
    },

    /* 切换忘记密码步骤 */
    _goForgotStep: function(step) {
        document.getElementById('forgotStep1').style.display = step === 1 ? 'block' : 'none';
        document.getElementById('forgotStep2').style.display = step === 2 ? 'block' : 'none';
        document.getElementById('forgotStep3').style.display = step === 3 ? 'block' : 'none';
    },

    /* 进入主系统 */
    enterMainSystem: function(username) {
        var acc = FA.accounts[username];
        FA.currentUser = {
            username: username,
            name: acc.name,
            nameCn: acc.nameCn,
            role: acc.role,
            phone: acc.phone,
            email: acc.email || '',
            gender: acc.gender || '',
            loginTime: new Date().toLocaleString('zh-CN')
        };

        /* 确保 URL 保留 tab 后缀, 刷新后可恢复会话 */
        FA.getTabId();

        localStorage.setItem('fi_login_time', FA.currentUser.loginTime);

        /* 注册为当前账号的活跃会话, 触发单点登录同步 */
        if (this._sessionToken) {
            FA.saveSessionInfo({ username: username, token: this._sessionToken, loginAt: Date.now() });
            FA.registerActiveSession(username, this._sessionToken);
            if (FA.Sync && FA.Sync.schedulePush) FA.Sync.schedulePush();
        }

        document.getElementById('loginCard').style.display = 'none';
        document.body.classList.add('main-active');
        document.getElementById('mainContainer').style.display = 'block';

        /* 加载当前用户的首页布局 */
        if (FA.Data.loadUserLayout) FA.Data.loadUserLayout();

        this.updateUserUI();
        FA.applyPermissions();
        FA.renderPermissions();
        FA.renderAll();
        FA.showToast('欢迎回来，' + acc.nameCn + '！', 'success');

        /* 记录登录日志 */
        if (FA.Data.recordLoginLog) {
            FA.Data.recordLoginLog(username, 'login', '用户登录成功');
        }
        /* 记录操作日志 */
        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('login', '用户登录系统');
        }
    },

    /* 更新用户 UI */
    updateUserUI: function() {
        var u = FA.currentUser;
        if (!u) return;
        document.getElementById('currentUser').textContent = u.nameCn || u.name;
        document.getElementById('welcomeUser').textContent = u.nameCn || u.name;
        var avatar = document.getElementById('userAvatar');
        avatar.textContent = (u.nameCn || u.name).charAt(0);
        document.getElementById('profileAvatar').textContent = (u.nameCn || u.name).charAt(0);
        document.getElementById('profileName').textContent = u.nameCn || u.name;
        document.getElementById('profileUsername').textContent = u.username;
        document.getElementById('profileRoleText').textContent = FA.getRoleName(u.role);
        document.getElementById('profilePhone').textContent = u.phone;
        document.getElementById('profileLoginTime').textContent = u.loginTime;
        document.getElementById('profileEmail').textContent = u.email || '未填写';
        document.getElementById('profileGender').textContent = u.gender || '未填写';

        var roleBadge = document.getElementById('currentRole');
        var profileRole = document.getElementById('profileRole');
        roleBadge.textContent = FA.getRoleName(u.role);
        profileRole.textContent = FA.getRoleName(u.role);
        roleBadge.className = 'role-badge ' + FA.getRoleClass(u.role);
        profileRole.className = 'role-badge ' + FA.getRoleClass(u.role);

        /* 注册审核菜单: 仅超管可见 */
        var regMenuItem = document.getElementById('registrationMenuItem');
        if (regMenuItem) {
            regMenuItem.style.display = (u.role === 'superadmin') ? '' : 'none';
        }
        /* 注册审核徽章 */
        var regBadge = document.getElementById('regBadge');
        if (regBadge && FA.Registration && FA.Registration.getPendingCount) {
            var pending = FA.Registration.getPendingCount();
            regBadge.textContent = pending;
            regBadge.style.display = pending > 0 ? '' : 'none';
        }
    },

    /* 用户浮窗 (微信风格) */
    setupUserPopup: function() {
        var self = this;
        var profile = document.querySelector('.user-profile');
        var popup = document.getElementById('userPopup');
        if (!profile || !popup) return;

        profile.addEventListener('click', function(e) {
            e.stopPropagation();
            popup.classList.toggle('open');
        });
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#userPopup') && !e.target.closest('.user-profile')) {
                popup.classList.remove('open');
            }
        });

        /* 浮窗菜单项 */
        var items = popup.querySelectorAll('.user-popup-item');
        items.forEach(function(item) {
            item.addEventListener('click', function() {
                var action = item.dataset.action;
                popup.classList.remove('open');
                if (action === 'profile') { FA.showSection('settings-section'); FA.Settings.showProfileTab(); }
                else if (action === 'settings') { FA.showSection('settings-section'); }
                else if (action === 'switch') { self.showSwitchUser(); }
                else if (action === 'logout') { self.logout(); }
            });
        });
    },

    /* 切换用户 */
    showSwitchUser: function() {
        var self = this;
        var html = '<div style="max-height:300px;overflow-y:auto">';
        Object.keys(FA.accounts).forEach(function(key) {
            var acc = FA.accounts[key];
            if (key !== FA.currentUser.username) {
                html += '<div class="user-popup-item" data-user="' + key + '" style="cursor:pointer">' +
                    '<div class="user-popup-avatar" style="width:36px;height:36px;font-size:14px">' + acc.nameCn.charAt(0) + '</div>' +
                    '<div><div style="font-size:14px">' + acc.nameCn + '</div><div style="font-size:11px;color:#999">' + FA.getRoleName(acc.role) + '</div></div>' +
                    '</div>';
            }
        });
        html += '</div>';

        var modal = document.getElementById('switch-user-modal');
        var body = document.getElementById('switchUserBody');
        if (body) {
            body.innerHTML = html;
            body.querySelectorAll('[data-user]').forEach(function(el) {
                el.addEventListener('click', function() {
                    var user = el.dataset.user;
                    FA.closeModal('switch-user-modal');
                    self.switchUser(user);
                });
            });
            FA.showModal('switch-user-modal');
        }
    },

    switchUser: function(username) {
        /* 记录切换日志 */
        if (FA.Data.recordLoginLog) {
            FA.Data.recordLoginLog(FA.currentUser.username, 'switch', '切换至用户: ' + username);
        }
        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('switch_user', '切换用户: ' + username);
        }
        /* 为新用户生成独立会话并注册活跃状态 */
        var token = FA.generateSessionToken();
        FA.saveSessionInfo({ username: username, token: token, loginAt: Date.now() });
        FA.registerActiveSession(username, token);
        localStorage.removeItem('fi_verify_session');
        if (FA.Sync && FA.Sync.schedulePush) FA.Sync.schedulePush();
        location.reload();
    },

    /* 退出登录 */
    logout: function() {
        if (!confirm('确定要退出登录吗？')) return;
        var username = FA.currentUser && FA.currentUser.username;
        if (FA.currentUser) {
            if (FA.Data.recordLoginLog) {
                FA.Data.recordLoginLog(FA.currentUser.username, 'logout', '用户退出登录');
            }
            if (FA.Data.recordOpLog) {
                FA.Data.recordOpLog('logout', '用户退出系统');
            }
            /* 清除本账号活跃会话 (仅当 token 匹配时, 避免误删新登录) */
            var info = FA.getSessionInfo();
            if (info && info.username && info.token) {
                var map = FA.getActiveSessions();
                var active = map[info.username];
                if (active && active.token === info.token) {
                    delete map[info.username];
                    FA.setActiveSessions(map);
                    if (FA.Sync && FA.Sync.schedulePush) FA.Sync.schedulePush();
                }
            }
        }
        localStorage.removeItem(FA.sessionKey());
        localStorage.removeItem('fi_login_time');
        localStorage.removeItem('fi_verify_session');
        document.body.classList.remove('main-active');
        location.reload();
    },

    /* 单点登录检查: 当前账号若在其他地方登录, 本标签页应被顶掉 */
    checkSingleSignOn: function() {
        if (!FA.currentUser) return;
        var info = FA.getSessionInfo();
        if (!info || !info.username) return;
        if (info.legacy) {
            /* 兼容旧版纯字符串会话: 迁移并视为有效 */
            var token = FA.generateSessionToken();
            this._sessionToken = token;
            FA.saveSessionInfo({ username: info.username, token: token, loginAt: Date.now() });
            FA.registerActiveSession(info.username, token);
            if (FA.Sync && FA.Sync.schedulePush) FA.Sync.schedulePush();
            return;
        }
        if (!FA.validateActiveSession(info.username, info.token)) {
            FA.showToast('您的账号已在其他地方登录，即将退出', 'error');
            if (FA.Data.recordLoginLog) {
                FA.Data.recordLoginLog(info.username, 'kicked', '被其他登录会话顶掉');
            }
            setTimeout(function() {
                localStorage.removeItem(FA.sessionKey());
                localStorage.removeItem('fi_login_time');
                localStorage.removeItem('fi_verify_session');
                location.reload();
            }, 2000);
        }
    },

    _startSingleSignOnMonitor: function() {
        var self = this;
        /* 监听其他标签页/窗口的登录事件 */
        window.addEventListener('storage', function(e) {
            if (e.key === FA.DB_KEYS.activeSessions) {
                self.checkSingleSignOn();
            }
        });
        /* 定时轮询: 5 秒一次, 与 API 刷新节奏一致 */
        if (this._ssoInterval) clearInterval(this._ssoInterval);
        this._ssoInterval = setInterval(function() { self.checkSingleSignOn(); }, 5000);
    },

    /* 会话恢复 */
    restoreSession: function() {
        var info = FA.getSessionInfo();
        if (!info || !info.username || !FA.accounts[info.username]) return false;
        if (!info.legacy && !FA.validateActiveSession(info.username, info.token)) {
            /* 活跃会话已失效, 清理残留 */
            localStorage.removeItem(FA.sessionKey());
            localStorage.removeItem('fi_login_time');
            return false;
        }
        this._sessionToken = info.token || null;
        this.enterMainSystem(info.username);
        return true;
    }
};
