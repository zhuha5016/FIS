/* ======================================================================
   approvals.js - 审批系统 (发起/审批/查询/历史)
   ====================================================================== */

window.FA = window.FA || {};

/* 审批状态中文映射 */
FA._approvalStatusNames = {
    pending:  '待审批',
    approved: '已通过',
    rejected: '已驳回'
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
    var container = document.getElementById('approvalList');
    if (!container) return;

    /* 添加工具栏 (如果不存在) */
    var section = document.getElementById('approvals-section') || container.closest('.content-section');
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

    container.innerHTML = FA.approvals.map(function(a) {
        var statusClass = a.status;
        var statusName = FA._approvalStatusNames[a.status] || a.status;
        var categoryName = FA._approvalCategoryNames[a.category] || a.category;
        var applicantName = FA._getMemberName(a.applicant);
        var assigneeName = FA._getMemberName(a.assignTo);

        /* 审批流程进度 */
        var stepHtml = FA._renderApprovalSteps(a);

        /* 操作按钮 */
        var actionHtml = '';
        if (canApprove && a.status === 'pending' && a.assignTo === FA.currentUser.username) {
            actionHtml =
                '<div style="margin-top:10px;display:flex;gap:8px">' +
                '<button class="btn-primary" style="font-size:12px;padding:6px 16px" onclick="FA.approveApproval(\'' + a.id + '\', \'approve\')">通过</button>' +
                '<button class="btn-secondary" style="font-size:12px;padding:6px 16px;color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + a.id + '\', \'reject\')">驳回</button>' +
                '</div>';
        }

        var metaParts = [];
        metaParts.push('📋 ' + a.orderNo);
        metaParts.push('👤 ' + applicantName);
        metaParts.push('📅 ' + (a.createdDate || '').substring(0, 10));
        if (a.amount) metaParts.push('💰 ¥' + a.amount);

        return '<div class="approval-item">' +
            '<div class="approval-item-header">' +
                '<h4>' + a.title + '</h4>' +
                '<span class="approval-status ' + statusClass + '">' + statusName + '</span>' +
            '</div>' +
            '<div class="approval-meta">' +
                '<span style="display:inline-block;padding:2px 8px;background:rgba(0,122,255,0.08);border-radius:6px;font-size:11px;margin-right:6px">' + categoryName + '</span> ' +
                metaParts.join(' · ') +
            '</div>' +
            (a.description ? '<div style="font-size:13px;color:#666;margin:6px 0">' + a.description + '</div>' : '') +
            '<div class="approval-progress">' + stepHtml + '</div>' +
            actionHtml +
        '</div>';
    }).join('');
};

/* 渲染审批步骤 */
FA._renderApprovalSteps = function(a) {
    if (!a.steps || a.steps.length === 0) return '';

    var stepIcons = {
        done: '✓',
        approved: '✓',
        rejected: '✗',
        pending: '○'
    };

    var html = '';
    a.steps.forEach(function(step, i) {
        var stepClass = '';
        if (step.status === 'done' || step.status === 'approved') stepClass = 'done';
        else if (step.status === 'pending') stepClass = 'current';
        else if (step.status === 'rejected') stepClass = 'current';

        var icon = stepIcons[step.status] || '○';
        var userName = FA._getMemberName(step.user);

        html += '<div class="approval-step ' + stepClass + '">' +
            '<span>' + icon + '</span>' +
            '<span>' + step.name + (userName ? ' (' + userName + ')' : '') + '</span>' +
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
        '<div style="display:flex;gap:6px;align-items:center">' +
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
    var container = section.querySelector('#approvalList');
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
    var modal = document.getElementById(modalId);

    if (!modal) {
        modal = FA._createApprovalModal(modalId);
        document.body.appendChild(modal);
    }

    /* 填充审批人下拉 (其他用户) */
    var assignSelect = document.getElementById('approvalAssignTo');
    if (assignSelect) {
        assignSelect.innerHTML = '';
        var users = FA._getOtherUsers();
        users.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.nameCn || u.name + ' (' + FA.getRoleName(u.role) + ')';
            assignSelect.appendChild(opt);
        });
    }

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

    FA.showModal(modalId);
};

FA._createApprovalModal = function(modalId) {
    var div = document.createElement('div');
    div.innerHTML =
        '<div class="modal" id="' + modalId + '">' +
            '<div class="modal-content">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>发起审批</h3></div>' +
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
                    '<button class="btn-primary" id="approvalSubmit">提交</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    return div.firstElementChild;
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

FA._submitApproval = function() {
    var title = document.getElementById('approvalTitle').value.trim();
    var category = document.getElementById('approvalCategory').value;
    var description = document.getElementById('approvalDescription').value.trim();
    var assignTo = document.getElementById('approvalAssignTo').value;
    var amountEl = document.getElementById('approvalAmount');
    var amount = (category === 'finance' && amountEl) ? parseFloat(amountEl.value) || 0 : 0;

    if (!title) { FA.showToast('请填写标题', 'error'); return; }
    if (!assignTo) { FA.showToast('请选择审批人', 'error'); return; }

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
        createdDate: now
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

    if (action === 'approve') {
        approval.status = 'approved';
        if (approval.steps.length > 1) {
            approval.steps[1].status = 'approved';
            approval.steps[1].time = now;
        }
        FA.Data.addNotification('success', '审批已通过',
            approval.title + ' · ' + approval.orderNo + ' 已通过审批');
        FA.showToast('审批已通过', 'success');
    } else if (action === 'reject') {
        approval.status = 'rejected';
        if (approval.steps.length > 1) {
            approval.steps[1].status = 'rejected';
            approval.steps[1].time = now;
        }
        FA.Data.addNotification('warning', '审批已驳回',
            approval.title + ' · ' + approval.orderNo + ' 已被驳回');
        FA.showToast('审批已驳回', 'info');
    }

    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
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

    /* 显示查询结果弹窗 */
    var modalId = 'approval-query-modal';
    var modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML =
            '<div class="modal-content">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>查询结果</h3></div>' +
                '<div id="approvalQueryBody"></div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-primary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
    }

    var body = modal.querySelector('#approvalQueryBody');
    body.innerHTML = FA._renderApprovalDetail(approval);

    FA.showModal(modalId);
};

/* 渲染审批详情 */
FA._renderApprovalDetail = function(a) {
    var statusName = FA._approvalStatusNames[a.status] || a.status;
    var categoryName = FA._approvalCategoryNames[a.category] || a.category;
    var applicantName = FA._getMemberName(a.applicant);
    var assigneeName = FA._getMemberName(a.assignTo);

    var stepHtml = FA._renderApprovalSteps(a);

    var canApprove = FA.checkPermission('approveApproval') &&
                     a.status === 'pending' &&
                     a.assignTo === FA.currentUser.username;

    var actionHtml = '';
    if (canApprove) {
        actionHtml =
            '<div style="margin-top:16px;display:flex;gap:10px">' +
            '<button class="btn-primary" onclick="FA.approveApproval(\'' + a.id + '\', \'approve\');FA.closeModal(\'approval-query-modal\')">通过</button>' +
            '<button class="btn-secondary" style="color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + a.id + '\', \'reject\');FA.closeModal(\'approval-query-modal\')">驳回</button>' +
            '</div>';
    }

    return '<div style="font-size:14px;line-height:2">' +
        '<p><strong>标题:</strong> ' + a.title + '</p>' +
        '<p><strong>单号:</strong> ' + a.orderNo + '</p>' +
        '<p><strong>状态:</strong> <span class="approval-status ' + a.status + '">' + statusName + '</span></p>' +
        '<p><strong>类别:</strong> ' + categoryName + '</p>' +
        (a.amount ? '<p><strong>金额:</strong> ¥' + a.amount + '</p>' : '') +
        '<p><strong>申请人:</strong> ' + applicantName + '</p>' +
        '<p><strong>审批人:</strong> ' + assigneeName + '</p>' +
        '<p><strong>创建时间:</strong> ' + (a.createdDate || '').replace('T', ' ').substring(0, 19) + '</p>' +
        (a.description ? '<p><strong>描述:</strong> ' + a.description + '</p>' : '') +
        '<p><strong>审批流程:</strong></p>' +
        '<div class="approval-progress" style="margin-top:4px">' + stepHtml + '</div>' +
        actionHtml +
    '</div>';
};

/* =====================
   审批历史 (带筛选)
   ===================== */
FA.getApprovalHistory = function() {
    var modalId = 'approval-history-modal';
    var modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML =
            '<div class="modal-content" style="max-width:600px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>审批历史</h3></div>' +
                '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
                    '<select id="histStatusFilter" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
                        '<option value="">全部状态</option>' +
                        '<option value="pending">待审批</option>' +
                        '<option value="approved">已通过</option>' +
                        '<option value="rejected">已驳回</option>' +
                    '</select>' +
                    '<input type="date" id="histDateFrom" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px" placeholder="开始日期">' +
                    '<span style="color:#999">至</span>' +
                    '<input type="date" id="histDateTo" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px" placeholder="结束日期">' +
                    '<button class="toolbar-btn" id="histFilterBtn">筛选</button>' +
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
    }

    FA._renderApprovalHistory();
    FA.showModal(modalId);
};

FA._renderApprovalHistory = function() {
    var body = document.getElementById('approvalHistoryBody');
    if (!body) return;

    var statusFilter = document.getElementById('histStatusFilter').value;
    var dateFrom = document.getElementById('histDateFrom').value;
    var dateTo = document.getElementById('histDateTo').value;

    var filtered = FA.approvals.filter(function(a) {
        if (statusFilter && a.status !== statusFilter) return false;
        if (dateFrom && a.createdDate && a.createdDate.substring(0, 10) < dateFrom) return false;
        if (dateTo && a.createdDate && a.createdDate.substring(0, 10) > dateTo) return false;
        return true;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>无匹配记录</p></div>';
        return;
    }

    body.innerHTML = '<div class="approval-list">' + filtered.map(function(a) {
        var statusName = FA._approvalStatusNames[a.status] || a.status;
        var applicantName = FA._getMemberName(a.applicant);
        var stepHtml = FA._renderApprovalSteps(a);

        return '<div class="approval-item">' +
            '<div class="approval-item-header">' +
                '<h4>' + a.title + '</h4>' +
                '<span class="approval-status ' + a.status + '">' + statusName + '</span>' +
            '</div>' +
            '<div class="approval-meta">📋 ' + a.orderNo + ' · 👤 ' + applicantName + ' · 📅 ' + (a.createdDate || '').substring(0, 10) + '</div>' +
            '<div class="approval-progress">' + stepHtml + '</div>' +
        '</div>';
    }).join('') + '</div>';
};
