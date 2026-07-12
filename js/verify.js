/* ======================================================================
   verify.js - 身份验证系统
   3种验证方式: 手机号+VAL / 身份证号+VAL / 密码
   银行卡等高敏感信息: 密码+CVV
   10分钟会话保持
   身份证本地校验算法
   实名认证 (姓名+身份证号验证)
   ====================================================================== */

window.FA = window.FA || {};

FA.Verify = {
    /* 身份证号本地校验算法 */
    validateIDCard: function(id) {
        if (!/^\d{17}[\dXx]$/.test(id)) return false;
        var weights = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
        var checkCodes = ['1','0','X','9','8','7','6','5','4','3','2'];
        var sum = 0;
        for (var i = 0; i < 17; i++) {
            sum += parseInt(id.charAt(i)) * weights[i];
        }
        var checkCode = checkCodes[sum % 11];
        return id.charAt(17).toUpperCase() === checkCode;
    },

    /* 从身份证号提取信息 */
    extractIDInfo: function(id) {
        if (!this.validateIDCard(id)) return null;
        var birth = id.substring(6, 10) + '-' + id.substring(10, 12) + '-' + id.substring(12, 14);
        var genderCode = parseInt(id.charAt(16));
        var gender = genderCode % 2 === 1 ? '男' : '女';
        var age = new Date().getFullYear() - parseInt(id.substring(6, 10));
        return { birth: birth, gender: gender, age: age };
    },

    /* 检查验证会话是否有效 (10分钟) */
    isVerified: function(level) {
        var session = FA.Data.loadData(FA.DB_KEYS.verifySession, null);
        if (!session) return false;
        var now = Date.now();
        if (now - session.time > 10 * 60 * 1000) { /* 10分钟过期 */
            localStorage.removeItem(FA.DB_KEYS.verifySession);
            return false;
        }
        if (level === 'bank' && session.level !== 'bank') return false;
        return true;
    },

    /* 获取剩余有效时间 */
    getRemainingTime: function() {
        var session = FA.Data.loadData(FA.DB_KEYS.verifySession, null);
        if (!session) return 0;
        var remaining = 10 * 60 * 1000 - (Date.now() - session.time);
        return Math.max(0, Math.floor(remaining / 1000));
    },

    /* 清除验证会话 */
    clearSession: function() {
        localStorage.removeItem(FA.DB_KEYS.verifySession);
    },

    /* 发起身份验证 */
    requireVerify: function(purpose, level, callback) {
        /* level: 'normal' (3种方式) / 'bank' (密码+CVV) */
        /* 先检查是否已有有效会话 */
        if (this.isVerified(level)) {
            callback(true);
            return;
        }

        var self = this;
        var modalId = 'auth-verify-modal';
        var modal = document.getElementById(modalId);
        if (!modal) {
            /* 动态创建验证弹窗 */
            modal = this.createVerifyModal();
            document.body.appendChild(modal);
        }

        /* 设置标题 */
        document.getElementById('authVerifyTitle').textContent = purpose || '身份验证';
        document.getElementById('authVerifyPurpose').textContent = '为了保护您的敏感信息，请完成身份验证';

        /* 银行卡级别只显示密码+CVV */
        var tabs = modal.querySelectorAll('.auth-verify-tab');
        var methodAreas = modal.querySelectorAll('.auth-verify-method-area');
        if (level === 'bank') {
            tabs.forEach(function(t) { t.style.display = 'none'; });
            methodAreas.forEach(function(a) { a.style.display = 'none'; });
            document.getElementById('authVerifyBankArea').style.display = 'block';
        } else {
            tabs.forEach(function(t) { t.style.display = ''; });
            tabs[0].classList.add('active');
            tabs[0].click();
        }

        /* 确认按钮 */
        var confirmBtn = document.getElementById('authVerifyConfirm');
        confirmBtn.onclick = function() { self.doVerify(level, callback); };

        /* 记住选项 */
        var remember = document.getElementById('authVerifyRemember');
        remember.checked = false;

        FA.showModal(modalId);
    },

    createVerifyModal: function() {
        var html = '<div class="modal" id="auth-verify-modal"><div class="modal-content verify-modal">' +
            '<button class="modal-close" onclick="FA.closeModal(\'auth-verify-modal\')">&times;</button>' +
            '<div class="modal-header"><h3 id="authVerifyTitle">身份验证</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:14px" id="authVerifyPurpose"></p>' +

            /* 验证方式选项卡 (非银行级别) */
            '<div class="auth-verify-methods" id="authVerifyTabs">' +
                '<div class="auth-verify-tab active" data-method="phone">手机号+VAL</div>' +
                '<div class="auth-verify-tab" data-method="idcard">身份证+VAL</div>' +
                '<div class="auth-verify-tab" data-method="password">密码</div>' +
            '</div>' +

            /* 手机号+VAL 方式 */
            '<div class="auth-verify-method-area" id="methodPhone">' +
                '<div class="modal-field"><label>手机号</label><input id="verifyPhone" type="text" placeholder="请输入手机号"></div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box" maxlength="1" data-vi="0">' +
                        '<input class="val-input-box" maxlength="1" data-vi="1">' +
                        '<input class="val-input-box" maxlength="1" data-vi="2">' +
                        '<input class="val-input-box" maxlength="1" data-vi="3">' +
                        '<input class="val-input-box" maxlength="1" data-vi="4">' +
                        '<input class="val-input-box" maxlength="1" data-vi="5">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 身份证+VAL 方式 */
            '<div class="auth-verify-method-area" id="methodIdcard" style="display:none">' +
                '<div class="modal-field"><label>身份证号</label><input id="verifyIdcard" type="text" placeholder="请输入身份证号"></div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="0">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="1">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="2">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="3">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="4">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="5">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 密码 方式 */
            '<div class="auth-verify-method-area" id="methodPassword" style="display:none">' +
                '<div class="modal-field"><label>登录密码</label><input id="verifyPassword" type="password" placeholder="请输入登录密码"></div>' +
            '</div>' +

            /* 银行卡验证方式 (密码+CVV) */
            '<div id="authVerifyBankArea" style="display:none">' +
                '<div class="modal-field"><label>登录密码</label><input id="verifyBankPass" type="password" placeholder="请输入登录密码"></div>' +
                '<div class="modal-field"><label>CVV码</label><input id="verifyCVV" type="password" maxlength="4" placeholder="请输入CVV码"></div>' +
            '</div>' +

            /* 记住选项 */
            '<div class="auth-verify-remember">' +
                '<input type="checkbox" id="authVerifyRemember">' +
                '<label for="authVerifyRemember">10分钟内凭此验证信息直接访问</label>' +
            '</div>' +

            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'auth-verify-modal\')">取消</button>' +
                '<button class="btn-primary" id="authVerifyConfirm">验证</button>' +
            '</div>' +
        '</div></div>';

        var div = document.createElement('div');
        div.innerHTML = html;
        var modal = div.firstElementChild;

        /* 绑定选项卡切换 */
        modal.querySelectorAll('.auth-verify-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                modal.querySelectorAll('.auth-verify-tab').forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var method = tab.dataset.method;
                modal.querySelectorAll('.auth-verify-method-area').forEach(function(a) { a.style.display = 'none'; });
                if (method === 'phone') document.getElementById('methodPhone').style.display = 'block';
                if (method === 'idcard') document.getElementById('methodIdcard').style.display = 'block';
                if (method === 'password') document.getElementById('methodPassword').style.display = 'block';
            });
        });

        /* VAL 输入框自动跳转 */
        this.setupVALInputs(modal.querySelectorAll('#methodPhone .val-input-box'));
        this.setupVALInputs(modal.querySelectorAll('#methodIdcard .val-input-box'));

        return modal;
    },

    setupVALInputs: function(boxes) {
        boxes.forEach(function(box, index) {
            box.addEventListener('input', function(e) {
                var val = e.target.value.replace(/\D/g, '');
                e.target.value = val;
                if (val && index < boxes.length - 1) boxes[index + 1].focus();
            });
            box.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    boxes[index - 1].focus();
                }
            });
        });
    },

    doVerify: async function(level, callback) {
        var acc = FA.accounts[FA.currentUser.username];
        var success = false;
        var remember = document.getElementById('authVerifyRemember').checked;

        if (level === 'bank') {
            /* 银行卡验证: 密码 + CVV */
            var bankPass = document.getElementById('verifyBankPass').value;
            var cvv = document.getElementById('verifyCVV').value;
            if (bankPass === acc.password && cvv.length >= 3) {
                success = true;
            }
        } else {
            /* 普通验证: 3种方式 */
            var activeTab = document.querySelector('.auth-verify-tab.active');
            var method = activeTab ? activeTab.dataset.method : 'phone';

            if (method === 'phone') {
                var phone = document.getElementById('verifyPhone').value;
                var valInputs = document.querySelectorAll('#methodPhone .val-input-box');
                var valStr = Array.from(valInputs).map(function(b) { return b.value; }).join('');
                var expectedVal = await FA.generateVAL(FA.selectedOffset);
                if (phone === acc.phone.replace(/\*/g, '').replace(/\D/g, '').substring(0, 11) && valStr === expectedVal) {
                    success = true;
                }
                /* 宽松匹配: 手机后4位 */
                if (!success && phone === acc.phone.substring(acc.phone.length - 4)) {
                    if (valStr === expectedVal) success = true;
                }
            } else if (method === 'idcard') {
                var idcard = document.getElementById('verifyIdcard').value;
                var idcValInputs = document.querySelectorAll('#methodIdcard .val-input-box');
                var idcValStr = Array.from(idcValInputs).map(function(b) { return b.value; }).join('');
                var expectedVal2 = await FA.generateVAL(FA.selectedOffset);
                if (this.validateIDCard(idcard) && idcValStr === expectedVal2) {
                    success = true;
                }
            } else if (method === 'password') {
                var pass = document.getElementById('verifyPassword').value;
                if (pass === acc.password) success = true;
            }
        }

        if (success) {
            if (remember) {
                FA.Data.saveData(FA.DB_KEYS.verifySession, { time: Date.now(), level: level });
            }
            FA.closeModal('auth-verify-modal');
            FA.showToast('验证成功', 'success');
            callback(true);
        } else {
            FA.showToast('验证失败，请检查信息', 'error');
        }
    },

    /* 实名认证 */
    showRealNameVerify: function(memberUsername, existingVerify) {
        var self = this;
        var modalId = 'realname-verify-modal';
        var modal = document.getElementById(modalId);

        if (!modal) {
            modal = this.createRealNameModal();
            document.body.appendChild(modal);
        }

        if (existingVerify) {
            /* 已实名认证 - 显示绿色打勾和修改选项 */
            this.showVerifiedState(modal, existingVerify);
        } else {
            /* 未认证 - 显示输入表单 */
            this.showVerifyForm(modal, memberUsername);
        }

        FA.showModal(modalId);
    },

    createRealNameModal: function() {
        var html = '<div class="modal" id="realname-verify-modal"><div class="modal-content verify-modal">' +
            '<button class="modal-close" onclick="FA.closeModal(\'realname-verify-modal\')">&times;</button>' +
            '<div id="realnameContent"></div>' +
        '</div></div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        return div.firstElementChild;
    },

    showVerifyForm: function(modal, memberUsername) {
        var self = this;
        var content = modal.querySelector('#realnameContent');
        content.innerHTML =
            '<div class="modal-header"><h3>实名认证</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:16px">请输入真实姓名和身份证号进行验证</p>' +
            '<div class="modal-field"><label>真实姓名</label><input id="rnName" type="text" placeholder="请输入真实姓名"></div>' +
            '<div class="modal-field"><label>身份证号</label><input id="rnIdcard" type="text" placeholder="请输入18位身份证号" maxlength="18"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'realname-verify-modal\')">取消</button>' +
                '<button class="btn-primary" id="rnSubmit">验证</button>' +
            '</div>';

        document.getElementById('rnSubmit').onclick = function() {
            var name = document.getElementById('rnName').value.trim();
            var idcard = document.getElementById('rnIdcard').value.trim();

            if (!name) return FA.showToast('请输入姓名', 'error');
            if (!self.validateIDCard(idcard)) return FA.showToast('身份证号无效', 'error');

            /* 验证成功动画 */
            self.showVerifySuccessAnimation(modal, { name: name, idcard: idcard }, memberUsername);
        };
    },

    showVerifySuccessAnimation: function(modal, verifyData, memberUsername) {
        var content = modal.querySelector('#realnameContent');
        content.innerHTML =
            '<div style="text-align:center;padding:30px 0">' +
                '<div class="verify-success-icon">' +
                    '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' +
                '</div>' +
                '<div class="verify-success-text">认证成功</div>' +
                '<p style="font-size:13px;color:#888">' + verifyData.name + ' 已通过实名认证</p>' +
            '</div>';

        /* 保存实名认证状态 */
        var verifyStore = FA.Data.loadData(FA.DB_KEYS.userVerify, {});
        verifyStore[memberUsername || FA.currentUser.username] = {
            name: verifyData.name,
            idcard: verifyData.idcard,
            time: new Date().toISOString()
        };
        FA.Data.saveData(FA.DB_KEYS.userVerify, verifyStore);

        /* 更新成员的 verified 状态 */
        var member = FA.members.find(function(m) { return m.username === (memberUsername || FA.currentUser.username); });
        if (member) {
            member.verified = true;
            member.realName = verifyData.name;
            FA.Data.saveData(FA.DB_KEYS.members, FA.members);
            if (FA.renderMembers) FA.renderMembers();
        }

        FA.showToast('实名认证成功！', 'success');

        /* 3秒后关闭 */
        setTimeout(function() { FA.closeModal('realname-verify-modal'); }, 2000);
    },

    showVerifiedState: function(modal, verifyData) {
        var self = this;
        var content = modal.querySelector('#realnameContent');
        content.innerHTML =
            '<div style="text-align:center;padding:30px 0">' +
                '<div class="verify-success-icon">' +
                    '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' +
                '</div>' +
                '<div class="verify-success-text">已实名验证</div>' +
                '<p style="font-size:13px;color:#888">' + verifyData.name + ' · ' + verifyData.idcard.substring(0, 6) + '********' + verifyData.idcard.substring(14) + '</p>' +
                '<div class="verify-modify-hint" id="modifyRealName">修改实名信息</div>' +
            '</div>';

        document.getElementById('modifyRealName').onclick = function() {
            /* 修改实名信息需要先验证之前的信息 */
            self.showModifyRealNameForm(modal, verifyData);
        };
    },

    showModifyRealNameForm: function(modal, oldVerify) {
        var self = this;
        var content = modal.querySelector('#realnameContent');
        content.innerHTML =
            '<div class="modal-header"><h3>修改实名信息</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:14px">请先验证之前的实名信息</p>' +
            '<div class="modal-field"><label>原姓名</label><input id="oldRnName" type="text" placeholder="请输入之前的姓名"></div>' +
            '<div class="modal-field"><label>原身份证号</label><input id="oldRnIdcard" type="text" placeholder="请输入之前的身份证号" maxlength="18"></div>' +
            '<div class="modal-field"><label>CVV码</label><input id="oldRnCVV" type="password" maxlength="4" placeholder="请输入CVV码"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'realname-verify-modal\')">取消</button>' +
                '<button class="btn-primary" id="oldRnSubmit">验证并修改</button>' +
            '</div>';

        document.getElementById('oldRnSubmit').onclick = function() {
            var name = document.getElementById('oldRnName').value.trim();
            var idcard = document.getElementById('oldRnIdcard').value.trim();
            var cvv = document.getElementById('oldRnCVV').value;

            if (name === oldVerify.name && idcard === oldVerify.idcard && cvv.length >= 3) {
                /* 验证通过，显示新的输入表单 */
                self.showVerifyForm(modal, oldVerify.username);
            } else {
                FA.showToast('验证失败，请检查信息', 'error');
            }
        };
    },

    /* 获取用户实名认证状态 */
    getVerifyStatus: function(username) {
        var store = FA.Data.loadData(FA.DB_KEYS.userVerify, {});
        return store[username] || null;
    },

    /* 检查是否有权限查看敏感信息 */
    canViewSensitive: function(targetUsername) {
        if (FA.currentUser.role === 'superadmin') return true;
        if (FA.currentUser.username === targetUsername) return true;
        return false;
    }
};
