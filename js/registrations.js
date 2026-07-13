/* ======================================================================
   registrations.js - 注册申请系统
   功能: 新用户注册申请 / 超管审核 / 通过后自动创建账户
   ====================================================================== */

window.FA = window.FA || {};

FA.Registration = {

    /* =====================
       显示注册申请表单 (登录页)
       ===================== */
    showForm: function() {
        var modalId = 'registration-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '5000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:480px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>注册新账户</h3></div>' +
                '<p style="font-size:13px;color:#888;margin-bottom:14px">填写以下信息提交注册申请，待管理员审核通过后即可登录</p>' +
                '<div class="modal-field"><label>用户名（英文）</label><input id="regUsername" placeholder="字母数字组合，如 zhangsan"></div>' +
                '<div class="modal-field"><label>中文姓名</label><input id="regNameCn" placeholder="请输入中文姓名"></div>' +
                '<div class="modal-field"><label>密码</label><input id="regPassword" type="password" placeholder="至少6位"></div>' +
                '<div class="modal-field"><label>确认密码</label><input id="regPasswordConfirm" type="password" placeholder="再次输入密码"></div>' +
                '<div class="modal-field"><label>手机号</label><input id="regPhone" placeholder="请输入手机号"></div>' +
                '<div class="modal-field"><label>邮箱（选填）</label><input id="regEmail" placeholder="邮箱地址"></div>' +
                '<div class="modal-field"><label>性别</label>' +
                    '<div class="gender-tabs" id="regGenderTabs">' +
                        '<div class="gender-tab active" data-gender="男" onclick="FA._selectGender(this)">男</div>' +
                        '<div class="gender-tab" data-gender="女" onclick="FA._selectGender(this)">女</div>' +
                    '</div>' +
                '</div>' +
                '<div class="modal-field"><label>申请理由</label><textarea id="regReason" rows="3" placeholder="请说明注册原因（如：家庭成员、需要使用审批等）"></textarea></div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                    '<button class="btn-primary" onclick="FA.Registration.submit()">提交申请</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    /* =====================
       提交注册申请
       ===================== */
    submit: function() {
        var username = document.getElementById('regUsername').value.trim();
        var nameCn = document.getElementById('regNameCn').value.trim();
        var password = document.getElementById('regPassword').value;
        var passwordConfirm = document.getElementById('regPasswordConfirm').value;
        var phone = document.getElementById('regPhone').value.trim();
        var email = document.getElementById('regEmail').value.trim();
        var reason = document.getElementById('regReason').value.trim();

        /* 性别 */
        var genderEl = document.querySelector('#regGenderTabs .gender-tab.active');
        var gender = genderEl ? genderEl.dataset.gender : '男';

        /* 验证 */
        if (!username) { FA.showToast('请输入用户名', 'error'); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) { FA.showToast('用户名只能包含字母、数字和下划线', 'error'); return; }
        if (FA.accounts[username]) { FA.showToast('该用户名已存在', 'error'); return; }

        /* 检查是否已有待审核的注册 */
        var existing = FA.registrations.find(function(r) {
            return r.username === username && r.status === 'pending';
        });
        if (existing) { FA.showToast('该用户名已有待审核的注册申请', 'error'); return; }

        if (!nameCn) { FA.showToast('请输入中文姓名', 'error'); return; }
        if (!password || password.length < 6) { FA.showToast('密码至少6位', 'error'); return; }
        if (password !== passwordConfirm) { FA.showToast('两次密码不一致', 'error'); return; }
        if (!phone) { FA.showToast('请输入手机号', 'error'); return; }
        if (!reason) { FA.showToast('请填写申请理由', 'error'); return; }

        /* 创建注册申请 */
        var reg = {
            id: 'reg_' + Date.now(),
            username: username,
            nameCn: nameCn,
            name: username,
            password: password,
            phone: phone,
            email: email || '',
            gender: gender,
            reason: reason,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null,
            rejectReason: ''
        };

        FA.registrations.unshift(reg);
        FA.Data.saveData(FA.DB_KEYS.registrations, FA.registrations);

        FA.closeModal('registration-modal');
        FA.showToast('注册申请已提交，请等待管理员审核', 'success');
    },

    /* =====================
       渲染注册申请列表 (超管)
       ===================== */
    render: function() {
        var container = document.getElementById('registrationsContent');
        if (!container) return;

        var pendingCount = FA.registrations.filter(function(r) { return r.status === 'pending'; }).length;

        /* 工具栏 */
        var section = document.getElementById('registrations-section') || container.closest('.content-section');
        if (section && !section.querySelector('.registration-toolbar')) {
            var toolbar = document.createElement('div');
            toolbar.className = 'toolbar registration-toolbar';
            toolbar.style.justifyContent = 'space-between';
            toolbar.innerHTML =
                '<div style="display:flex;gap:8px;align-items:center">' +
                    '<select id="regStatusFilter" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px" onchange="FA.Registration.render()">' +
                        '<option value="">全部</option>' +
                        '<option value="pending">待审核</option>' +
                        '<option value="approved">已通过</option>' +
                        '<option value="rejected">已驳回</option>' +
                    '</select>' +
                '</div>' +
                '<span style="font-size:13px;color:#888">待审核: <strong style="color:#FF9800">' + pendingCount + '</strong> 条</span>';
            section.insertBefore(toolbar, container);
        }

        var statusFilter = '';
        var filterEl = document.getElementById('regStatusFilter');
        if (filterEl) statusFilter = filterEl.value;

        var list = FA.registrations.filter(function(r) {
            if (statusFilter && r.status !== statusFilter) return false;
            return true;
        });

        if (list.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                    '<div class="empty-icon">📝</div>' +
                    '<p>暂无注册申请</p>' +
                '</div>';
            return;
        }

        var statusNames = { pending: '待审核', approved: '已通过', rejected: '已驳回' };

        container.innerHTML = '<div class="registration-list">' + list.map(function(r) {
            var statusName = statusNames[r.status] || r.status;
            var submittedTime = r.submittedAt ? new Date(r.submittedAt).toLocaleString('zh-CN') : '';
            var reviewedTime = r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('zh-CN') : '';
            var reviewedByName = r.reviewedBy ? FA._getMemberName(r.reviewedBy) : '';

            var actionHtml = '';
            if (r.status === 'pending') {
                actionHtml =
                    '<div class="registration-actions">' +
                        '<button class="btn-primary" style="font-size:12px;padding:6px 16px" onclick="FA.Registration.approve(\'' + r.id + '\')">通过</button>' +
                        '<button class="btn-secondary" style="font-size:12px;padding:6px 16px;color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.Registration.reject(\'' + r.id + '\')">驳回</button>' +
                    '</div>';
            }

            var metaHtml = '👤 ' + FA._esc(r.username) + ' (' + FA._esc(r.nameCn) + ') · 📱 ' + FA._esc(r.phone) + (r.email ? ' · 📧 ' + FA._esc(r.email) : '') + ' · ' + (r.gender || '') + '<br>' +
                '📅 提交时间: ' + submittedTime;

            if (r.status !== 'pending') {
                metaHtml += '<br>📋 审核人: ' + FA._esc(reviewedByName) + ' · 审核时间: ' + reviewedTime;
                if (r.rejectReason) {
                    metaHtml += '<br>❌ 驳回理由: ' + FA._esc(r.rejectReason);
                }
            }

            return '<div class="registration-item">' +
                '<div class="registration-item-header">' +
                    '<h4>' + FA._esc(r.nameCn) + ' <span style="font-size:12px;color:#888;font-weight:normal">(' + FA._esc(r.username) + ')</span></h4>' +
                    '<span class="registration-status ' + r.status + '">' + statusName + '</span>' +
                '</div>' +
                '<div class="registration-meta">' + metaHtml + '</div>' +
                '<div class="registration-reason"><strong>申请理由:</strong> ' + FA._esc(r.reason) + '</div>' +
                actionHtml +
            '</div>';
        }).join('') + '</div>';
    },

    /* =====================
       通过注册申请
       ===================== */
    approve: function(id) {
        var reg = FA.registrations.find(function(r) { return r.id === id; });
        if (!reg) { FA.showToast('申请不存在', 'error'); return; }
        if (reg.status !== 'pending') { FA.showToast('该申请已处理', 'error'); return; }

        /* 再次检查用户名是否被占用 */
        if (FA.accounts[reg.username]) {
            FA.showToast('用户名 ' + reg.username + ' 已被占用，无法通过', 'error');
            return;
        }

        if (!confirm('确定通过 ' + reg.nameCn + ' (' + reg.username + ') 的注册申请吗？\n将通过后自动创建账户，角色为普通账户。')) return;

        /* 创建账户 */
        FA.accounts[reg.username] = {
            password: reg.password,
            role: 'user',
            name: reg.username,
            nameCn: reg.nameCn,
            phone: reg.phone,
            email: reg.email || (reg.username + '@family.local'),
            gender: reg.gender || '男',
            securityQuestions: [
                { question: '', answer: '' },
                { question: '', answer: '' },
                { question: '', answer: '' }
            ]
        };

        /* 创建成员 */
        FA.members.push({
            name: reg.username,
            nameCn: reg.nameCn,
            role: 'user',
            phone: reg.phone,
            username: reg.username,
            gender: reg.gender || '男',
            email: reg.email || (reg.username + '@family.local'),
            verified: false
        });

        /* 持久化 */
        FA.Data.saveAccounts();
        FA.Data.saveData(FA.DB_KEYS.members, FA.members);

        /* 更新注册状态 */
        reg.status = 'approved';
        reg.reviewedAt = new Date().toISOString();
        reg.reviewedBy = FA.currentUser.username;
        FA.Data.saveData(FA.DB_KEYS.registrations, FA.registrations);

        /* 通知 */
        FA.Data.addNotification('success', '注册申请已通过',
            reg.nameCn + ' (' + reg.username + ') 的注册申请已通过，账户已创建');

        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('registration_approve', '通过注册申请: ' + reg.username + ' (' + reg.nameCn + ')');
        }

        FA.showToast('已通过注册申请，账户已创建', 'success');
        FA.Registration.render();

        /* 刷新成员列表 */
        if (FA.renderMembers) FA.renderMembers();
    },

    /* =====================
       驳回注册申请
       ===================== */
    reject: function(id) {
        var reg = FA.registrations.find(function(r) { return r.id === id; });
        if (!reg) { FA.showToast('申请不存在', 'error'); return; }
        if (reg.status !== 'pending') { FA.showToast('该申请已处理', 'error'); return; }

        /* 弹窗输入驳回理由 */
        var modalId = 'reject-reg-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>驳回注册申请</h3></div>' +
                '<p style="font-size:13px;color:#888;margin-bottom:10px">' + FA._esc(reg.nameCn) + ' (' + FA._esc(reg.username) + ')</p>' +
                '<div class="modal-field"><label>驳回理由</label>' +
                    '<textarea id="rejectReasonInput" rows="3" placeholder="请填写驳回理由"></textarea>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                    '<button class="btn-primary" style="background:linear-gradient(45deg,#e74c3c,#c0392b)" onclick="FA.Registration._doReject(\'' + id + '\', \'' + modalId + '\')">确认驳回</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    _doReject: function(id, modalId) {
        var reg = FA.registrations.find(function(r) { return r.id === id; });
        if (!reg) return;

        var reason = document.getElementById('rejectReasonInput').value.trim();

        reg.status = 'rejected';
        reg.reviewedAt = new Date().toISOString();
        reg.reviewedBy = FA.currentUser.username;
        reg.rejectReason = reason || '未填写';
        FA.Data.saveData(FA.DB_KEYS.registrations, FA.registrations);

        FA.Data.addNotification('info', '注册申请已驳回',
            reg.nameCn + ' (' + reg.username + ') 的注册申请已被驳回: ' + (reason || '未填写'));

        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('registration_reject', '驳回注册申请: ' + reg.username + ' - ' + (reason || '未填写'));
        }

        FA.closeModal(modalId);
        FA.showToast('已驳回注册申请', 'info');
        FA.Registration.render();
    },

    /* =====================
       获取待审核数量
       ===================== */
    getPendingCount: function() {
        return FA.registrations.filter(function(r) { return r.status === 'pending'; }).length;
    }
};

/* 全局桥接 */
FA.renderRegistrations = function() { FA.Registration.render(); };
