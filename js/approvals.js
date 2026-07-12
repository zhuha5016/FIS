/* ======================================================================
   approvals.js - 审批系统 (发起/审批/查询/历史/修改/删除/详情)
   功能完善: 创建/审批/驳回/修改详情重新提交/删除/查看详情/按单号查询/历史筛选
   ====================================================================== */

window.FA = window.FA || {};

/* 审批状态中文映射 */
FA._approvalStatusNames = {
    pending:  '待审批',
    approved: '已通过',
    rejected: '已驳回',
    withdrawn: '已撤回'
};

FA._approvalCategoryNames = {
    finance: '财务',
    affair:  '事务',
    other:   '其他'
};

/* =====================
   渲染审批列表
   ===================== */
FA.renderApprovals = function() {
    var container = document.getElementById('approvalsContent');
    if (!container) return;

    var section = document.getElementById('approvals-section') || container.closest('.content-section');

    /* 添加工具栏 (如果不存在) */
    if (section && !section.querySelector('.approval-toolbar')) {
        FA._injectApprovalToolbar(section);
    }

    if (!FA.approvals || FA.approvals.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-icon">📋</div>' +
                '<p>暂无审批记录</p>' +
                '<p class="empty-hint">点击"发起审批"创建新审批</p>' +
            '</div>';
        return;
    }

    var canApprove = FA.checkPermission('approveApproval');
    var canCreate = FA.checkPermission('createApproval');

    container.innerHTML = '<div class="approval-list">' + FA.approvals.map(function(a) {
        var statusClass = a.status;
        var statusName = FA._approvalStatusNames[a.status] || a.status;
        var categoryName = FA._approvalCategoryNames[a.category] || a.category;
        var applicantName = FA._getMemberName(a.applicant);
        var assigneeName = FA._getMemberName(a.assignTo);

        /* 审批流程进度 */
        var stepHtml = FA._renderApprovalSteps(a);

        /* 操作按钮 */
        var actionHtml = '';
        var isApplicant = (a.applicant === FA.currentUser.username);
        var isAssignee = (a.assignTo === FA.currentUser.username);

        /* 审批/驳回按钮 (审批人且待审批) */
        if (canApprove && a.status === 'pending' && isAssignee) {
            actionHtml +=
                '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
                '<button class="btn-primary" style="font-size:12px;padding:6px 16px" onclick="FA.approveApproval(\'' + a.id + '\', \'approve\')">通过</button>' +
                '<button class="btn-secondary" style="font-size:12px;padding:6px 16px;color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + a.id + '\', \'reject\')">驳回</button>' +
                '</div>';
        }

        /* 详情/修改/删除按钮 */
        actionHtml += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
        actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.viewApprovalDetail(\'' + a.id + '\')">📄 详情</button>';
        if (canCreate && isApplicant && a.status === 'pending') {
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.editApproval(\'' + a.id + '\')">✎ 修改</button>';
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.withdrawApproval(\'' + a.id + '\')">↶ 撤回</button>';
            actionHtml += '<button class="toolbar-btn danger" style="font-size:12px;padding:4px 12px" onclick="FA.deleteApproval(\'' + a.id + '\')">✕ 删除</button>';
        }
        if (canCreate && isApplicant && (a.status === 'rejected' || a.status === 'approved')) {
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.resubmitApproval(\'' + a.id + '\')">🔄 重新提交</button>';
        }
        actionHtml += '</div>';

        var metaParts = [];
        metaParts.push('📋 ' + a.orderNo);
        metaParts.push('👤 ' + applicantName);
        metaParts.push('📅 ' + (a.createdDate || '').substring(0, 10));
        if (a.amount) metaParts.push('💰 ¥' + a.amount);

        return '<div class="approval-item" style="cursor:pointer" onclick="FA.viewApprovalDetail(\'' + a.id + '\', event)">' +
            '<div class="approval-item-header">' +
                '<h4>' + a.title + '</h4>' +
                '<span class="approval-status ' + statusClass + '">' + statusName + '</span>' +
            '</div>' +
            '<div class="approval-meta">' +
                '<span style="display:inline-block;padding:2px 8px;background:rgba(0,122,255,0.08);border-radius:6px;font-size:11px;margin-right:6px">' + categoryName + '</span> ' +
                metaParts.join(' · ') +
            '</div>' +
            (a.description ? '<div style="font-size:13px;color:#666;margin:6px 0">' + a.description + '</div>' : '') +
            (assigneeName ? '<div style="font-size:12px;color:#999;margin-bottom:4px">审批人: ' + assigneeName + '</div>' : '') +
            '<div class="approval-progress">' + stepHtml + '</div>' +
            actionHtml +
        '</div>';
    }).join('') + '</div>';
};

/* 渲染审批步骤 */
FA._renderApprovalSteps = function(a) {
    if (!a.steps || a.steps.length === 0) return '';

    var stepIcons = {
        done: '✓',
        approved: '✓',
        rejected: '✗',
        pending: '○',
        withdrawn: '↶'
    };

    var html = '';
    a.steps.forEach(function(step, i) {
        var stepClass = '';
        if (step.status === 'done' || step.status === 'approved') stepClass = 'done';
        else if (step.status === 'pending') stepClass = 'current';
        else if (step.status === 'rejected') stepClass = 'current';
        else if (step.status === 'withdrawn') stepClass = '';

        var icon = stepIcons[step.status] || '○';
        var userName = FA._getMemberName(step.user);
        var timeStr = step.time ? ' ' + new Date(step.time).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

        html += '<div class="approval-step ' + stepClass + '">' +
            '<span>' + icon + '</span>' +
            '<span>' + step.name + (userName ? ' (' + userName + ')' : '') + timeStr + '</span>' +
        '</div>';

        if (i < a.steps.length - 1) {
            html += '<span class="approval-step-arrow">→</span>';
        }
    });

    return html;
};

/* 获取成员显示名 */
FA._getMemberName = function(username) {
    if (!username) return '';
    if (FA.currentUser && FA.currentUser.username === username) {
        return FA.currentUser.nameCn || FA.currentUser.name || username;
    }
    if (FA.accounts && FA.accounts[username]) {
        return FA.accounts[username].nameCn || FA.accounts[username].name || username;
    }
    if (FA.members) {
        for (var i = 0; i < FA.members.length; i++) {
            if (FA.members[i].username === username) {
                return FA.members[i].nameCn || FA.members[i].name || username;
            }
        }
    }
    return username;
};

/* 注入审批工具栏 */
FA._injectApprovalToolbar = function(section) {
    var toolbar = document.createElement('div');
    toolbar.className = 'toolbar approval-toolbar';
    toolbar.style.justifyContent = 'space-between';

    /* 左侧: 查询 */
    var leftHtml =
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            '<input type="text" id="approvalOrderInput" placeholder="输入审批单号查询" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px;width:200px">' +
            '<button class="toolbar-btn" onclick="FA.queryApprovalByOrder(document.getElementById(\'approvalOrderInput\').value)">查询</button>' +
            '<button class="toolbar-btn" onclick="FA.getApprovalHistory()">历史记录</button>' +
        '</div>';

    /* 右侧: 发起审批 */
    var rightHtml = FA.checkPermission('createApproval')
        ? '<button class="toolbar-btn" onclick="FA.createApproval()">＋ 发起审批</button>'
        : '';

    toolbar.innerHTML = leftHtml + rightHtml;

    /* 插入到容器之前 */
    var container = section.querySelector('#approvalsContent');
    if (container) {
        section.insertBefore(toolbar, container);
    } else {
        section.appendChild(toolbar);
    }
};

/* =====================
   发起审批
   ===================== */
FA.createApproval = function() {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var modalId = 'create-approval-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = FA._createApprovalModal(modalId, null);
    document.body.appendChild(modal);

    /* 填充审批人下拉 */
    FA._populateAssigneeSelect();

    /* 清空表单 */
    document.getElementById('approvalTitle').value = '';
    document.getElementById('approvalCategory').value = 'affair';
    document.getElementById('approvalDescription').value = '';
    var amountField = document.getElementById('approvalAmount');
    if (amountField) amountField.value = '';
    FA._toggleAmountField();

    /* 绑定类别切换 */
    var catSelect = document.getElementById('approvalCategory');
    catSelect.onchange = FA._toggleAmountField;

    /* 绑定提交 */
    var submitBtn = document.getElementById('approvalSubmit');
    submitBtn.onclick = function() { FA._submitApproval(); };

    /* 标题 */
    document.getElementById('approvalModalTitle').textContent = '发起审批';

    FA.showModal(modalId);
};

FA._createApprovalModal = function(modalId, existing) {
    var div = document.createElement('div');
    var title = existing ? '修改审批' : '发起审批';
    var btnText = existing ? '重新提交' : '提交';

    div.innerHTML =
        '<div class="modal" id="' + modalId + '">' +
            '<div class="modal-content">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3 id="approvalModalTitle">' + title + '</h3></div>' +
                '<div class="modal-field"><label>标题</label><input id="approvalTitle" placeholder="审批标题"></div>' +
                '<div class="modal-field"><label>类别</label>' +
                    '<select id="approvalCategory">' +
                        '<option value="affair">事务</option>' +
                        '<option value="finance">财务</option>' +
                        '<option value="other">其他</option>' +
                    '</select>' +
                '</div>' +
                '<div class="modal-field" id="approvalAmountField" style="display:none">' +
                    '<label>金额 (元)</label>' +
                    '<input id="approvalAmount" type="number" min="0" step="0.01" placeholder="请输入金额">' +
                '</div>' +
                '<div class="modal-field"><label>描述</label><textarea id="approvalDescription" rows="3" placeholder="详细说明"></textarea></div>' +
                '<div class="modal-field"><label>审批人</label><select id="approvalAssignTo"></select></div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                    '<button class="btn-primary" id="approvalSubmit">' + btnText + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    /* 如果是修改模式，填充已有数据 */
    if (existing) {
        var modal = div.firstElementChild;
        modal.dataset.editId = existing.id;
        /* 延迟填充 (等 DOM 挂载后) */
        setTimeout(function() {
            var titleInput = document.getElementById('approvalTitle');
            var catSelect = document.getElementById('approvalCategory');
            var descInput = document.getElementById('approvalDescription');
            var amountInput = document.getElementById('approvalAmount');
            if (titleInput) titleInput.value = existing.title || '';
            if (catSelect) catSelect.value = existing.category || 'affair';
            if (descInput) descInput.value = existing.description || '';
            if (amountInput) amountInput.value = existing.amount || '';
            FA._toggleAmountField();
        }, 50);
    }

    return div.firstElementChild;
};

FA._populateAssigneeSelect = function() {
    var assignSelect = document.getElementById('approvalAssignTo');
    if (!assignSelect) return;
    assignSelect.innerHTML = '';
    var users = FA._getOtherUsers();
    users.forEach(function(u) {
        var opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = u.nameCn || u.name + ' (' + FA.getRoleName(u.role) + ')';
        assignSelect.appendChild(opt);
    });
};

FA._toggleAmountField = function() {
    var cat = document.getElementById('approvalCategory');
    var amountField = document.getElementById('approvalAmountField');
    if (!cat || !amountField) return;
    amountField.style.display = (cat.value === 'finance') ? 'block' : 'none';
};

FA._getOtherUsers = function() {
    var users = [];
    Object.keys(FA.accounts).forEach(function(key) {
        if (key !== FA.currentUser.username) {
            var acc = FA.accounts[key];
            users.push({ username: key, nameCn: acc.nameCn, name: acc.name, role: acc.role });
        }
    });
    return users;
};

FA._submitApproval = function(isEdit) {
    var title = document.getElementById('approvalTitle').value.trim();
    var category = document.getElementById('approvalCategory').value;
    var description = document.getElementById('approvalDescription').value.trim();
    var assignTo = document.getElementById('approvalAssignTo').value;
    var amountEl = document.getElementById('approvalAmount');
    var amount = (category === 'finance' && amountEl) ? parseFloat(amountEl.value) || 0 : 0;

    if (!title) { FA.showToast('请填写标题', 'error'); return; }
    if (!assignTo) { FA.showToast('请选择审批人', 'error'); return; }

    var modalEl = document.getElementById('create-approval-modal');
    var editId = modalEl ? modalEl.dataset.editId : null;

    if (editId) {
        /* 修改并重新提交 */
        var existing = FA.approvals.find(function(a) { return a.id === editId; });
        if (existing) {
            existing.title = title;
            existing.category = category;
            existing.description = description;
            existing.amount = amount;
            existing.assignTo = assignTo;
            existing.status = 'pending';
            existing.modifiedDate = new Date().toISOString();

            /* 重置步骤 */
            existing.steps = [
                { name: '申请人修改并重新提交', status: 'done', user: FA.currentUser.username, time: existing.modifiedDate },
                { name: '审批人处理', status: 'pending', user: assignTo, time: null }
            ];

            /* 添加历史记录 */
            if (!existing.history) existing.history = [];
            existing.history.push({
                action: '已重新提交',
                user: FA.currentUser.username,
                time: existing.modifiedDate,
                detail: '审批已修改并重新提交'
            });

            FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
            FA.closeModal('create-approval-modal');
            FA.renderApprovals();

            var assigneeName = FA._getMemberName(assignTo);
            FA.Data.addNotification('info', '审批已修改重新提交',
                title + ' · 单号 ' + existing.orderNo + ' · 审批人: ' + assigneeName);
            FA.showToast('审批已修改并重新提交', 'success');
        }
        return;
    }

    /* 生成单号: APR-YYYYMMDD-XXXX */
    var today = FA.getTodayStr().replace(/-/g, '');
    var prefix = 'APR-' + today + '-';
    var count = 0;
    if (FA.approvals) {
        FA.approvals.forEach(function(a) {
            if (a.orderNo && a.orderNo.indexOf(prefix) === 0) count++;
        });
    }
    var orderNo = prefix + String(count + 1).padStart(4, '0');

    var now = new Date().toISOString();

    var approval = {
        id: 'apr_' + Date.now(),
        orderNo: orderNo,
        title: title,
        category: category,
        description: description,
        amount: amount,
        applicant: FA.currentUser.username,
        assignTo: assignTo,
        status: 'pending',
        steps: [
            { name: '申请人提交', status: 'done', user: FA.currentUser.username, time: now },
            { name: '审批人处理', status: 'pending', user: assignTo, time: null }
        ],
        createdDate: now,
        history: [
            { action: '已创建', user: FA.currentUser.username, time: now, detail: '审批创建' }
        ]
    };

    FA.approvals.unshift(approval);
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.closeModal('create-approval-modal');
    FA.renderApprovals();

    /* 通知审批人 */
    var assigneeName = FA._getMemberName(assignTo);
    FA.Data.addNotification('info', '新审批待处理',
        title + ' · 单号 ' + orderNo + ' · 审批人: ' + assigneeName);
    FA.showToast('审批已提交，单号: ' + orderNo, 'success');
};

/* =====================
   修改审批 (重新编辑)
   ===================== */
FA.editApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能修改自己发起的审批', 'error');
        return;
    }
    if (approval.status !== 'pending') {
        FA.showToast('只能修改待审批的审批', 'error');
        return;
    }

    var modalId = 'create-approval-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = FA._createApprovalModal(modalId, approval);
    document.body.appendChild(modal);

    /* 填充审批人下拉 */
    FA._populateAssigneeSelect();

    /* 选中当前审批人 */
    var assignSelect = document.getElementById('approvalAssignTo');
    if (assignSelect) assignSelect.value = approval.assignTo;

    /* 绑定类别切换 */
    var catSelect = document.getElementById('approvalCategory');
    catSelect.onchange = FA._toggleAmountField;

    /* 绑定提交 */
    var submitBtn = document.getElementById('approvalSubmit');
    submitBtn.onclick = function() { FA._submitApproval(true); };

    FA.showModal(modalId);
};

/* =====================
   重新提交 (已驳回/已通过的)
   ===================== */
FA.resubmitApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能重新提交自己发起的审批', 'error');
        return;
    }

    /* 确认重新提交 */
    if (!confirm('确定要重新提交此审批吗？将生成新的审批流程。')) return;

    /* 重置审批状态 */
    var now = new Date().toISOString();
    approval.status = 'pending';
    approval.steps = [
        { name: '申请人重新提交', status: 'done', user: FA.currentUser.username, time: now },
        { name: '审批人处理', status: 'pending', user: approval.assignTo, time: null }
    ];
    if (!approval.history) approval.history = [];
    approval.history.push({ action: '已重新提交', user: FA.currentUser.username, time: now, detail: '审批重新提交' });

    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();

    var assigneeName = FA._getMemberName(approval.assignTo);
    FA.Data.addNotification('info', '审批重新提交',
        approval.title + ' · 单号 ' + approval.orderNo + ' · 审批人: ' + assigneeName);
    FA.showToast('审批已重新提交', 'success');
};

/* 删除审批 — 留痕：从 approvals 移到 deletedApprovals */
FA.deleteApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能删除自己发起的审批', 'error');
        return;
    }

    if (!confirm('确定要删除审批「' + approval.title + '」吗？此操作不可撤销。')) return;

    var now = new Date().toISOString();

    /* 记录删除留痕 */
    if (!approval.history) approval.history = [];
    approval.history.push({
        action: '已删除',
        user: FA.currentUser.username,
        time: now,
        detail: '审批已被申请人删除(留痕)'
    });
    approval.status = 'deleted';
    approval.deletedAt = now;
    approval.deletedBy = FA.currentUser.username;

    /* 移动到 deletedApprovals, 保留可查 */
    FA.deletedApprovals = FA.Data.loadData(FA.DB_KEYS.deletedApprovals, []);
    FA.deletedApprovals.unshift(JSON.parse(JSON.stringify(approval)));
    FA.Data.saveData(FA.DB_KEYS.deletedApprovals, FA.deletedApprovals);

    /* 从 approvals 移除 */
    FA.approvals = FA.approvals.filter(function(a) { return a.id !== id; });
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
    FA.showToast('审批已删除（留痕保留）', 'info');
};

/* =====================
   查看审批详情
   ===================== */
FA.viewApprovalDetail = function(id, event) {
    /* 如果点击的是按钮，不触发详情查看 */
    if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.closest('button'))) {
        event.stopPropagation();
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) {
        /* 在已删除审批(留痕)中查找 */
        var deleted = FA.Data.loadData(FA.DB_KEYS.deletedApprovals, []);
        approval = deleted.find(function(a) { return a.id === id; });
    }
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }

    var modalId = 'approval-detail-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;

    var statusName = FA._approvalStatusNames[approval.status] || approval.status;
    var categoryName = FA._approvalCategoryNames[approval.category] || approval.category;
    var applicantName = FA._getMemberName(approval.applicant);
    var assigneeName = FA._getMemberName(approval.assignTo);
    var stepHtml = FA._renderApprovalSteps(approval);

    /* 操作按钮 */
    var actionHtml = '';
    var isApplicant = (approval.applicant === FA.currentUser.username);
    var isAssignee = (approval.assignTo === FA.currentUser.username);
    var canApprove = FA.checkPermission('approveApproval');
    var canCreate = FA.checkPermission('createApproval');

    if (canApprove && approval.status === 'pending' && isAssignee) {
        actionHtml +=
            '<div style="margin-top:16px;display:flex;gap:10px">' +
            '<button class="btn-primary" onclick="FA.approveApproval(\'' + approval.id + '\', \'approve\');FA.closeModal(\'approval-detail-modal\')">通过</button>' +
            '<button class="btn-secondary" style="color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + approval.id + '\', \'reject\');FA.closeModal(\'approval-detail-modal\')">驳回</button>' +
            '</div>';
    }
    if (canCreate && isApplicant && approval.status === 'pending') {
        actionHtml +=
            '<div style="margin-top:10px;display:flex;gap:10px">' +
            '<button class="btn-secondary" onclick="FA.closeModal(\'approval-detail-modal\');FA.editApproval(\'' + approval.id + '\')">✎ 修改详情</button>' +
            '<button class="btn-secondary" onclick="FA.closeModal(\'approval-detail-modal\');FA.withdrawApproval(\'' + approval.id + '\')">↶ 撤回</button>' +
            '<button class="btn-danger" onclick="FA.closeModal(\'approval-detail-modal\');FA.deleteApproval(\'' + approval.id + '\')">✕ 删除</button>' +
            '</div>';
    }
    if (canCreate && isApplicant && (approval.status === 'rejected' || approval.status === 'approved')) {
        actionHtml +=
            '<div style="margin-top:10px">' +
            '<button class="btn-primary" onclick="FA.closeModal(\'approval-detail-modal\');FA.resubmitApproval(\'' + approval.id + '\')">🔄 重新提交</button>' +
            '</div>';
    }

    /* 历史记录 */
    var historyHtml = '';
    if (approval.history && approval.history.length > 0) {
        historyHtml = '<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(0,0,0,0.06)">' +
            '<h4 style="font-size:14px;margin-bottom:10px">📜 操作历史</h4>' +
            approval.history.map(function(h) {
                var userName = FA._getMemberName(h.user);
                var timeStr = h.time ? new Date(h.time).toLocaleString('zh-CN') : '';
                return '<div style="font-size:12px;color:#888;margin-bottom:4px;padding:4px 8px;background:rgba(245,245,247,0.5);border-radius:6px">' +
                    '<strong>' + h.action + '</strong> · ' + userName + ' · ' + timeStr +
                    (h.detail ? '<br><span style="color:#aaa">' + h.detail + '</span>' : '') +
                '</div>';
            }).join('') +
        '</div>';
    }

    modal.innerHTML =
        '<div class="modal-content" style="max-width:560px">' +
            '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
            '<div class="modal-header"><h3>审批详情</h3></div>' +
            '<div style="font-size:14px;line-height:2">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                    '<h4 style="font-size:18px;font-weight:600">' + approval.title + '</h4>' +
                    '<span class="approval-status ' + approval.status + '">' + statusName + '</span>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-top:12px">' +
                    '<div><strong>单号:</strong> ' + approval.orderNo + '</div>' +
                    '<div><strong>类别:</strong> ' + categoryName + '</div>' +
                    '<div><strong>申请人:</strong> ' + applicantName + '</div>' +
                    '<div><strong>审批人:</strong> ' + assigneeName + '</div>' +
                    '<div><strong>创建时间:</strong> ' + (approval.createdDate || '').replace('T', ' ').substring(0, 19) + '</div>' +
                    (approval.modifiedDate ? '<div><strong>修改时间:</strong> ' + approval.modifiedDate.replace('T', ' ').substring(0, 19) + '</div>' : '<div></div>') +
                    (approval.amount ? '<div><strong>金额:</strong> ¥' + approval.amount + '</div>' : '<div></div>') +
                '</div>' +
                (approval.description ? '<div style="margin-top:12px;padding:12px;background:rgba(245,245,247,0.5);border-radius:10px"><strong style="display:block;margin-bottom:4px">描述:</strong>' + approval.description + '</div>' : '') +
                '<div style="margin-top:14px"><strong>审批流程:</strong></div>' +
                '<div class="approval-progress" style="margin-top:6px">' + stepHtml + '</div>' +
                historyHtml +
            '</div>' +
            actionHtml +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);
    FA.showModal(modalId);
};

/* =====================
   审批/驳回
   ===================== */
FA.approveApproval = function(id, action) {
    if (!FA.checkPermission('approveApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.status !== 'pending') { FA.showToast('该审批已处理', 'error'); return; }

    var now = new Date().toISOString();
    var actionName = '';
    var notifType = 'success';
    var notifTitle = '';

    if (action === 'approve') {
        approval.status = 'approved';
        actionName = '通过';
        if (approval.steps.length > 1) {
            approval.steps[1].status = 'approved';
            approval.steps[1].time = now;
        }
        notifTitle = '审批已通过';
        FA.showToast('审批已通过', 'success');
    } else if (action === 'reject') {
        approval.status = 'rejected';
        actionName = '驳回';
        if (approval.steps.length > 1) {
            approval.steps[1].status = 'rejected';
            approval.steps[1].time = now;
        }
        notifType = 'warning';
        notifTitle = '审批已驳回';
        FA.showToast('审批已驳回', 'info');
    }

    /* 添加历史记录 */
    if (!approval.history) approval.history = [];
    approval.history.push({
        action: actionName,
        user: FA.currentUser.username,
        time: now,
        detail: approval.title + ' 被' + actionName
    });

    FA.Data.addNotification(notifType, notifTitle,
        approval.title + ' · ' + approval.orderNo + ' 已' + actionName);

    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
};

/* =====================
   撤回审批
   ===================== */
FA.withdrawApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error');
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能撤回自己发起的审批', 'error');
        return;
    }
    if (approval.status !== 'pending') {
        FA.showToast('只能撤回待审批的审批', 'error');
        return;
    }

    if (!confirm('确定要撤回审批「' + approval.title + '」吗？')) return;

    var now = new Date().toISOString();
    approval.status = 'withdrawn';

    /* 更新步骤状态 */
    if (approval.steps.length > 1) {
        approval.steps[1].status = 'withdrawn';
        approval.steps[1].time = now;
    }

    /* 添加历史记录 */
    if (!approval.history) approval.history = [];
    approval.history.push({
        action: '已撤回',
        user: FA.currentUser.username,
        time: now,
        detail: '审批已撤回'
    });

    FA.Data.addNotification('info', '审批已撤回',
        approval.title + ' · ' + approval.orderNo + ' 已撤回');
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
    FA.showToast('审批已撤回', 'info');
};

/* =====================
   按单号查询
   ===================== */
FA.queryApprovalByOrder = function(orderNo) {
    if (!orderNo || !orderNo.trim()) {
        FA.showToast('请输入审批单号', 'error');
        return;
    }
    orderNo = orderNo.trim().toUpperCase();

    var approval = FA.approvals.find(function(a) {
        return a.orderNo && a.orderNo.toUpperCase() === orderNo;
    });

    if (!approval) {
        FA.showToast('未找到单号 ' + orderNo, 'error');
        return;
    }

    /* 直接打开详情弹窗 */
    FA.viewApprovalDetail(approval.id);
};

/* =====================
   审批历史 (带筛选)
   ===================== */
FA.getApprovalHistory = function() {
    var modalId = 'approval-history-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;
    modal.innerHTML =
        '<div class="modal-content" style="max-width:640px">' +
            '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
            '<div class="modal-header"><h3>审批历史</h3></div>' +
            '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
                '<select id="histStatusFilter" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
                    '<option value="">全部状态</option>' +
                    '<option value="pending">待审批</option>' +
                    '<option value="approved">已通过</option>' +
                    '<option value="rejected">已驳回</option>' +
                    '<option value="withdrawn">已撤回</option>' +
                    '<option value="deleted">已删除</option>' +
                '</select>' +
                '<select id="histCategoryFilter" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
                    '<option value="">全部类别</option>' +
                    '<option value="finance">财务</option>' +
                    '<option value="affair">事务</option>' +
                    '<option value="other">其他</option>' +
                '</select>' +
                '<input type="date" id="histDateFrom" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px" placeholder="开始日期">' +
                '<span style="color:#999">至</span>' +
                '<input type="date" id="histDateTo" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px" placeholder="结束日期">' +
                '<button class="toolbar-btn" id="histFilterBtn">筛选</button>' +
                '<button class="toolbar-btn" id="histClearBtn">清空</button>' +
            '</div>' +
            '<div id="approvalHistoryBody" style="max-height:400px;overflow-y:auto"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn-primary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#histFilterBtn').addEventListener('click', function() {
        FA._renderApprovalHistory();
    });
    modal.querySelector('#histClearBtn').addEventListener('click', function() {
        document.getElementById('histStatusFilter').value = '';
        document.getElementById('histCategoryFilter').value = '';
        document.getElementById('histDateFrom').value = '';
        document.getElementById('histDateTo').value = '';
        FA._renderApprovalHistory();
    });

    FA._renderApprovalHistory();
    FA.showModal(modalId);
};

FA._renderApprovalHistory = function() {
    var body = document.getElementById('approvalHistoryBody');
    if (!body) return;

    var statusFilter = document.getElementById('histStatusFilter').value;
    var categoryFilter = document.getElementById('histCategoryFilter').value;
    var dateFrom = document.getElementById('histDateFrom').value;
    var dateTo = document.getElementById('histDateTo').value;

    /* 合并当前审批 + 已删除审批(留痕) */
    var deletedApprovals = FA.Data.loadData(FA.DB_KEYS.deletedApprovals, []);
    var all = (FA.approvals || []).concat(deletedApprovals || []);

    var filtered = all.filter(function(a) {
        if (statusFilter && a.status !== statusFilter) return false;
        if (categoryFilter && a.category !== categoryFilter) return false;
        var dateStr = (a.createdDate || '').substring(0, 10);
        if (dateFrom && dateStr && dateStr < dateFrom) return false;
        if (dateTo && dateStr && dateStr > dateTo) return false;
        return true;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>无匹配记录</p></div>';
        return;
    }

    body.innerHTML = '<div class="approval-list">' + filtered.map(function(a) {
        var statusName = FA._approvalStatusNames[a.status] || (a.status === 'deleted' ? '已删除' : a.status);
        var categoryName = FA._approvalCategoryNames[a.category] || a.category;
        var applicantName = FA._getMemberName(a.applicant);
        var stepHtml = FA._renderApprovalSteps(a);

        return '<div class="approval-item" style="cursor:pointer;opacity:' + (a.status === 'deleted' ? '0.7' : '1') + '" onclick="FA.closeModal(\'approval-history-modal\');FA.viewApprovalDetail(\'' + a.id + '\')">' +
            '<div class="approval-item-header">' +
                '<h4>' + a.title + (a.status === 'deleted' ? ' <span style="font-size:11px;color:#e74c3c">[已删除留痕]</span>' : '') + '</h4>' +
                '<span class="approval-status ' + a.status + '">' + statusName + '</span>' +
            '</div>' +
            '<div class="approval-meta">' +
                '<span style="display:inline-block;padding:2px 8px;background:rgba(0,122,255,0.08);border-radius:6px;font-size:11px;margin-right:6px">' + categoryName + '</span> ' +
                '📋 ' + a.orderNo + ' · 👤 ' + applicantName + ' · 📅 ' + (a.createdDate || '').substring(0, 10) +
            '</div>' +
            '<div class="approval-progress">' + stepHtml + '</div>' +
        '</div>';
    }).join('') + '</div>';
};
