/* ======================================================================
   verify.js - 身份验证系统
   5种验证方式: 手机号+VAL / 身份证号+VAL / 密码 / 密保问题+VAL / 超级管理员VAL
   银行卡等高敏感信息: 密码+CVV
   10分钟会话保持
   身份证本地校验算法
   实名认证 (姓名+身份证号验证)
   VAL六框: 粘贴自动填充 / 无光标 / 边框加粗 / 长按删除清空
   ====================================================================== */

window.FA = window.FA || {};

FA.Verify = {
    /* 目标用户名: 当编辑他人信息时, 验证使用对方的安全信息 (超管VAL除外) */
    _targetUsername: null,

    /* 设置验证目标用户 */
    setTargetUser: function(username) {
        this._targetUsername = username || null;
    },

    /* 清除验证目标用户 */
    clearTargetUser: function() {
        this._targetUsername = null;
    },

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
        if (now - session.time > 10 * 60 * 1000) {
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
        if (this.isVerified(level)) {
            callback(true);
            return;
        }

        var self = this;
        var modalId = 'auth-verify-modal';
        var modal = document.getElementById(modalId);
        if (!modal) {
            modal = this.createVerifyModal();
            document.body.appendChild(modal);
        } else {
            /* 移到 body 最后，确保 DOM 顺序在最顶层 */
            document.body.appendChild(modal);
        }

        /* z-index 设为 3000，高于普通 modal 的 1000 */
        modal.style.zIndex = '3000';

        document.getElementById('authVerifyTitle').textContent = purpose || '身份验证';
        document.getElementById('authVerifyPurpose').textContent = '为了保护您的敏感信息，请完成身份验证';

        /* 6 种验证方式全部显示在 modal 中 (5 normal + 1 bank)
           用户自选 — 不再分流 */
        var tabs = modal.querySelectorAll('.auth-verify-tab');
        var methodAreas = modal.querySelectorAll('.auth-verify-method-area');
        tabs.forEach(function(t) { t.style.display = ''; });
        methodAreas.forEach(function(a) { a.style.display = 'none'; });

        /* 隐藏超级管理员VAL标签 (如果当前用户是superadmin) */
        var adminTab = modal.querySelector('[data-method="adminval"]');
        if (adminTab) {
            adminTab.style.display = (FA.currentUser.role === 'superadmin') ? 'none' : '';
        }

        /* 隐藏银行卡方式 (非超管不显示 — 仅超管/特定操作需要) */
        var bankTab = modal.querySelector('[data-method="bank"]');
        if (bankTab) {
            bankTab.style.display = (level === 'bank') ? '' : 'none';
        }
        var bankArea = document.getElementById('authVerifyBankArea');
        if (bankArea) {
            bankArea.style.display = 'none';
        }

        /* 默认显示第一个标签 */
        tabs[0].classList.add('active');
        tabs[0].click();

        var confirmBtn = document.getElementById('authVerifyConfirm');
        confirmBtn.onclick = function() { self.doVerify(level, callback); };

        var remember = document.getElementById('authVerifyRemember');
        remember.checked = false;

        FA.showModal(modalId);
    },

    createVerifyModal: function() {
        var html = '<div class="modal" id="auth-verify-modal"><div class="modal-content verify-modal">' +
            '<button class="modal-close" onclick="FA.closeModal(\'auth-verify-modal\')">&times;</button>' +
            '<div class="modal-header"><h3 id="authVerifyTitle">身份验证</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:14px" id="authVerifyPurpose"></p>' +

            '<div class="auth-verify-methods" id="authVerifyTabs">' +
                '<div class="auth-verify-tab active" data-method="phone">手机号+VAL</div>' +
                '<div class="auth-verify-tab" data-method="idcard">身份证+VAL</div>' +
                '<div class="auth-verify-tab" data-method="password">密码</div>' +
                '<div class="auth-verify-tab" data-method="security">密保问题+VAL</div>' +
                '<div class="auth-verify-tab" data-method="adminval">超级管理员VAL</div>' +
            '</div>' +

            '<div class="auth-verify-method-area" id="methodPhone">' +
                '<div class="modal-field"><label>手机号</label><input id="verifyPhone" type="text" placeholder="请输入手机号"></div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box" maxlength="1" data-vi="0" inputmode="numeric">' +
                        '<input class="val-input-box" maxlength="1" data-vi="1" inputmode="numeric">' +
                        '<input class="val-input-box" maxlength="1" data-vi="2" inputmode="numeric">' +
                        '<input class="val-input-box" maxlength="1" data-vi="3" inputmode="numeric">' +
                        '<input class="val-input-box" maxlength="1" data-vi="4" inputmode="numeric">' +
                        '<input class="val-input-box" maxlength="1" data-vi="5" inputmode="numeric">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="auth-verify-method-area" id="methodIdcard" style="display:none">' +
                '<div class="modal-field"><label>身份证号</label><input id="verifyIdcard" type="text" placeholder="请输入身份证号"></div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="0" inputmode="numeric">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="1" inputmode="numeric">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="2" inputmode="numeric">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="3" inputmode="numeric">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="4" inputmode="numeric">' +
                        '<input class="val-input-box idc-val" maxlength="1" data-vi="5" inputmode="numeric">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="auth-verify-method-area" id="methodPassword" style="display:none">' +
                '<div class="modal-field"><label>登录密码</label><input id="verifyPassword" type="password" placeholder="请输入登录密码"></div>' +
            '</div>' +

            '<div class="auth-verify-method-area" id="methodSecurity" style="display:none">' +
                '<div class="modal-field">' +
                    '<label>选择密保问题</label>' +
                    '<select id="verifySecQ" onchange="FA.Verify._updateSecQuestion()">' +
                        '<option value="0">密保问题1</option>' +
                        '<option value="1">密保问题2</option>' +
                        '<option value="2">密保问题3</option>' +
                    '</select>' +
                '</div>' +
                '<div class="modal-field">' +
                    '<label>问题</label>' +
                    '<div id="verifySecQuestionText" style="padding:10px;background:rgba(0,0,0,0.03);border-radius:8px;font-size:13px">请先设置密保问题</div>' +
                '</div>' +
                '<div class="modal-field">' +
                    '<label>答案</label>' +
                    '<input id="verifySecAnswer" type="text" placeholder="请输入答案">' +
                '</div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="0" inputmode="numeric">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="1" inputmode="numeric">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="2" inputmode="numeric">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="3" inputmode="numeric">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="4" inputmode="numeric">' +
                        '<input class="val-input-box sec-val" maxlength="1" data-vi="5" inputmode="numeric">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="auth-verify-method-area" id="methodAdminVal" style="display:none">' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">请联系超级管理员获取VAL验证码</p>' +
                '<div class="modal-field">' +
                    '<label>超级管理员VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="0" inputmode="numeric">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="1" inputmode="numeric">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="2" inputmode="numeric">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="3" inputmode="numeric">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="4" inputmode="numeric">' +
                        '<input class="val-input-box admin-val" maxlength="1" data-vi="5" inputmode="numeric">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div id="authVerifyBankArea" style="display:none">' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">请输入登录密码和动态验证码以查看银行卡</p>' +
                '<div class="modal-field"><label>登录密码</label><input id="verifyBankPass" type="password" placeholder="请输入登录密码"></div>' +
                '<div class="modal-field"><label>VAL Code</label>' +
                    '<div class="val-input-row">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="0" inputmode="numeric">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="1" inputmode="numeric">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="2" inputmode="numeric">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="3" inputmode="numeric">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="4" inputmode="numeric">' +
                        '<input class="val-input-box bank-val" maxlength="1" data-vi="5" inputmode="numeric">' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<!-- bank tab removed: password entry is already covered by 密码 tab -->' +

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

        /* z-index 设为 3000，高于普通 modal 的 1000 */
        modal.style.zIndex = '3000';

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
                if (method === 'security') {
                    document.getElementById('methodSecurity').style.display = 'block';
                    FA.Verify._updateSecQuestion();
                }
                if (method === 'adminval') document.getElementById('methodAdminVal').style.display = 'block';
                if (method === 'bank') document.getElementById('authVerifyBankArea').style.display = 'block';
            });
        });

        /* VAL 输入框: 粘贴自动填充 / 无光标 / 连贯删除 / 长按清空 */
        this.setupVALInputs(modal.querySelectorAll('#methodPhone .val-input-box'));
        this.setupVALInputs(modal.querySelectorAll('#methodIdcard .val-input-box'));
        this.setupVALInputs(modal.querySelectorAll('#methodSecurity .val-input-box'));
        this.setupVALInputs(modal.querySelectorAll('#methodAdminVal .val-input-box'));
        this.setupVALInputs(modal.querySelectorAll('#authVerifyBankArea .val-input-box'));

        return modal;
    },

    /* 更新密保问题显示文本 */
    _updateSecQuestion: function() {
        var idx = parseInt(document.getElementById('verifySecQ').value);
        var verifyUsername = this._targetUsername || FA.currentUser.username;
        var acc = FA.accounts[verifyUsername];
        var q = (acc && acc.securityQuestions && acc.securityQuestions[idx] && acc.securityQuestions[idx].question)
            ? acc.securityQuestions[idx].question
            : '未设置密保问题';
        var el = document.getElementById('verifySecQuestionText');
        if (el) el.textContent = q;
    },

    /* VAL 六框输入: 增强版
       - 粘贴6位数自动填入所有框
       - 无光标 (caret-color: transparent, CSS 控制)
       - 聚焦时边框加粗 (CSS 控制)
       - 删除连贯: 当前框空则跳到前一个并清空
       - 长按删除键: 从当前框往前依次清空所有框
       - 不会出现删除后停顿在某个框的情况
    */
    setupVALInputs: function(boxes) {
        if (!boxes || boxes.length === 0) return;
        var boxArr = Array.from(boxes);
        var backspaceHoldTimer = null;
        var backspaceClearInterval = null;

        boxArr.forEach(function(box, index) {
            /* 输入: 自动跳到下一个 */
            box.addEventListener('input', function(e) {
                var val = e.target.value.replace(/\D/g, '');
                if (val.length > 1) {
                    /* 多位输入 (如粘贴): 分散到各框 */
                    e.target.value = '';
                    val.split('').forEach(function(digit, i) {
                        if (i < boxArr.length) boxArr[i].value = digit;
                    });
                    var focusIdx = Math.min(val.length, boxArr.length - 1);
                    boxArr[focusIdx].focus();
                    return;
                }
                e.target.value = val;
                if (val && index < boxArr.length - 1) {
                    boxArr[index + 1].focus();
                }
            });

            /* 粘贴: 直接填入所有6个框 */
            box.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (text.length === 0) return;
                text.split('').forEach(function(digit, i) {
                    if (i < boxArr.length) boxArr[i].value = digit;
                });
                var focusIdx = Math.min(text.length, boxArr.length - 1);
                if (text.length >= boxArr.length) {
                    boxArr[boxArr.length - 1].focus();
                } else {
                    boxArr[focusIdx].focus();
                }
            });

            /* 键盘按下: 处理 Backspace 和方向键 */
            box.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace') {
                    if (e.target.value) {
                        /* 当前框有值: 先清空当前框 (默认行为会清空)
                           如果长按, 启动连续清空 */
                        if (backspaceHoldTimer === null) {
                            backspaceHoldTimer = setTimeout(function() {
                                /* 长按超过 400ms: 开始从当前框往前依次清空 */
                                backspaceClearInterval = setInterval(function() {
                                    /* 找到当前有值的框清空 */
                                    var focused = document.activeElement;
                                    var fIdx = boxArr.indexOf(focused);
                                    if (fIdx >= 0 && boxArr[fIdx].value) {
                                        boxArr[fIdx].value = '';
                                    } else if (fIdx > 0) {
                                        /* 当前框空了, 跳到前一个 */
                                        boxArr[fIdx - 1].focus();
                                        boxArr[fIdx - 1].value = '';
                                    } else {
                                        /* 已经到第一个了, 停止 */
                                        clearInterval(backspaceClearInterval);
                                        backspaceClearInterval = null;
                                    }
                                }, 80);
                            }, 400);
                        }
                    } else if (index > 0) {
                        /* 当前框空: 跳到前一个并清空它, 阻止默认行为 */
                        e.preventDefault();
                        boxArr[index - 1].focus();
                        boxArr[index - 1].value = '';
                    }
                }
                /* 方向键导航 */
                if (e.key === 'ArrowLeft' && index > 0) {
                    e.preventDefault();
                    boxArr[index - 1].focus();
                }
                if (e.key === 'ArrowRight' && index < boxArr.length - 1) {
                    e.preventDefault();
                    boxArr[index + 1].focus();
                }
                /* Enter 提交 */
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var confirmBtn = document.getElementById('authVerifyConfirm');
                    if (confirmBtn) confirmBtn.click();
                }
            });

            /* 键盘抬起: 清除长按计时器 */
            box.addEventListener('keyup', function(e) {
                if (e.key === 'Backspace') {
                    if (backspaceHoldTimer) {
                        clearTimeout(backspaceHoldTimer);
                        backspaceHoldTimer = null;
                    }
                    if (backspaceClearInterval) {
                        clearInterval(backspaceClearInterval);
                        backspaceClearInterval = null;
                    }
                }
            });

            /* 点击: 选中全部内容 */
            box.addEventListener('focus', function(e) {
                e.target.select();
            });

            /* 失焦时清除长按状态 */
            box.addEventListener('blur', function() {
                if (backspaceHoldTimer) {
                    clearTimeout(backspaceHoldTimer);
                    backspaceHoldTimer = null;
                }
                if (backspaceClearInterval) {
                    clearInterval(backspaceClearInterval);
                    backspaceClearInterval = null;
                }
            });
        });
    },

    doVerify: async function(level, callback) {
        /* 当编辑他人信息时, 验证使用对方的安全信息 (超管VAL除外) */
        var verifyUsername = this._targetUsername || FA.currentUser.username;
        var acc = FA.accounts[verifyUsername];
        if (!acc) { FA.showToast('账户不存在', 'error'); return; }
        var success = false;
        var remember = document.getElementById('authVerifyRemember').checked;

        var activeTab = document.querySelector('.auth-verify-tab.active');
        var method = activeTab ? activeTab.dataset.method : 'phone';

        if (method === 'bank') {
            /* 银行卡验证: 密码 + VAL 码 (无 CVV) */
            var bankPass = document.getElementById('verifyBankPass').value;
            var bankValInputs = document.querySelectorAll('#authVerifyBankArea .val-input-box');
            var bankValStr = Array.from(bankValInputs).map(function(b) { return b.value; }).join('');
            var expectedBankVal = await FA.generateVAL(FA.selectedOffset, verifyUsername);
            if (bankPass === acc.password && bankValStr === expectedBankVal) {
                success = true;
            }
        } else if (method === 'phone') {
            var phone = document.getElementById('verifyPhone').value;
            var valInputs = document.querySelectorAll('#methodPhone .val-input-box');
            var valStr = Array.from(valInputs).map(function(b) { return b.value; }).join('');
            var expectedVal = await FA.generateVAL(FA.selectedOffset, verifyUsername);
            if (phone === acc.phone.replace(/\*/g, '').replace(/\D/g, '').substring(0, 11) && valStr === expectedVal) {
                success = true;
            }
            if (!success && phone === acc.phone.substring(acc.phone.length - 4)) {
                if (valStr === expectedVal) success = true;
            }
        } else if (method === 'idcard') {
            var idcard = document.getElementById('verifyIdcard').value;
            var idcValInputs = document.querySelectorAll('#methodIdcard .val-input-box');
            var idcValStr = Array.from(idcValInputs).map(function(b) { return b.value; }).join('');
            var expectedVal2 = await FA.generateVAL(FA.selectedOffset, verifyUsername);
            if (this.validateIDCard(idcard) && idcValStr === expectedVal2) {
                success = true;
            }
        } else if (method === 'password') {
            var pass = document.getElementById('verifyPassword').value;
            if (pass === acc.password) success = true;
        } else if (method === 'security') {
            var secQIndex = parseInt(document.getElementById('verifySecQ').value);
            var secAnswer = document.getElementById('verifySecAnswer').value.trim();
            var secValInputs = document.querySelectorAll('#methodSecurity .val-input-box');
            var secValStr = Array.from(secValInputs).map(function(b) { return b.value; }).join('');
            var expectedVal3 = await FA.generateVAL(FA.selectedOffset, verifyUsername);
            if (acc.securityQuestions && acc.securityQuestions[secQIndex] &&
                acc.securityQuestions[secQIndex].answer &&
                acc.securityQuestions[secQIndex].answer.toLowerCase() === secAnswer.toLowerCase() &&
                secValStr === expectedVal3) {
                success = true;
            }
        } else if (method === 'adminval') {
            var adminValInputs = document.querySelectorAll('#methodAdminVal .val-input-box');
            var adminValStr = Array.from(adminValInputs).map(function(b) { return b.value; }).join('');
            /* 找到超级管理员 */
            var adminUsername = Object.keys(FA.accounts).find(function(k) { return FA.accounts[k].role === 'superadmin'; });
            /* 使用超管用户名生成 VAL — 不同用户的 VAL 不同 */
            var expectedVal4 = await FA.generateVAL(FA.selectedOffset, adminUsername);
            if (adminValStr === expectedVal4) {
                success = true;
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
            this.showVerifiedState(modal, existingVerify);
        } else {
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

        var verifyStore = FA.Data.loadData(FA.DB_KEYS.userVerify, {});
        verifyStore[memberUsername || FA.currentUser.username] = {
            name: verifyData.name,
            idcard: verifyData.idcard,
            time: new Date().toISOString()
        };
        FA.Data.saveData(FA.DB_KEYS.userVerify, verifyStore);

        var member = FA.members.find(function(m) { return m.username === (memberUsername || FA.currentUser.username); });
        if (member) {
            member.verified = true;
            member.realName = verifyData.name;
            FA.Data.saveData(FA.DB_KEYS.members, FA.members);
            if (FA.renderMembers) FA.renderMembers();
        }

        FA.showToast('实名认证成功！', 'success');
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
            '<div class="modal-field"><label>VAL Code</label>' +
                '<div class="val-input-row">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="0" inputmode="numeric">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="1" inputmode="numeric">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="2" inputmode="numeric">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="3" inputmode="numeric">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="4" inputmode="numeric">' +
                    '<input class="val-input-box rn-val" maxlength="1" data-vi="5" inputmode="numeric">' +
                '</div>' +
            '</div>' +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'realname-verify-modal\')">取消</button>' +
                '<button class="btn-primary" id="oldRnSubmit">验证并修改</button>' +
            '</div>';

        this.setupVALInputs(modal.querySelectorAll('.rn-val'));

        document.getElementById('oldRnSubmit').onclick = async function() {
            var name = document.getElementById('oldRnName').value.trim();
            var idcard = document.getElementById('oldRnIdcard').value.trim();
            var rnValInputs = modal.querySelectorAll('.rn-val');
            var rnValStr = Array.from(rnValInputs).map(function(b) { return b.value; }).join('');
            var rnUsername = self._targetUsername || FA.currentUser.username;
            var expectedVal = await FA.generateVAL(FA.selectedOffset, rnUsername);

            if (name === oldVerify.name && idcard === oldVerify.idcard && rnValStr === expectedVal) {
                self.showVerifyForm(modal, oldVerify.username);
            } else {
                FA.showToast('验证失败，请检查信息', 'error');
            }
        };
    },

    getVerifyStatus: function(username) {
        var store = FA.Data.loadData(FA.DB_KEYS.userVerify, {});
        return store[username] || null;
    },

    canViewSensitive: function(targetUsername) {
        if (FA.currentUser.role === 'superadmin') return true;
        if (FA.currentUser.username === targetUsername) return true;
        return false;
    }
};
