/* ======================================================================
   approvals.js - 审批系统 (多人多环节 + 理由/留言)
   功能: 多环节审批/每环节多审批人/任一通过或全部通过/审批理由/给下一环节留言
   向后兼容: 旧数据(assignTo+steps)自动转换为新格式
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
        /* 兼容旧格式: 转换为stages */
        var normalized = FA._normalizeApproval(a);

        var statusClass = normalized.status;
        var statusName = FA._approvalStatusNames[normalized.status] || normalized.status;
        var categoryName = FA._approvalCategoryNames[normalized.category] || normalized.category;
        var applicantName = FA._getMemberName(normalized.applicant);

        /* 审批流程进度 */
        var stepHtml = FA._renderApprovalSteps(normalized);

        /* 操作按钮 */
        var actionHtml = '';
        var isApplicant = (normalized.applicant === FA.currentUser.username);
        var canActOnCurrentStage = FA._canActOnCurrentStage(normalized);

        /* 审批/驳回按钮 (当前环节审批人且待审批) */
        if (canApprove && normalized.status === 'pending' && canActOnCurrentStage) {
            actionHtml +=
                '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
                '<button class="btn-primary" style="font-size:12px;padding:6px 16px" onclick="FA.approveApproval(\'' + a.id + '\', \'approve\')">通过</button>' +
                '<button class="btn-secondary" style="font-size:12px;padding:6px 16px;color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + a.id + '\', \'reject\')">驳回</button>' +
                '</div>';
        }

        /* 详情/修改/删除按钮 */
        actionHtml += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
        actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.viewApprovalDetail(\'' + a.id + '\')">📄 详情</button>';
        if (canCreate && isApplicant && normalized.status === 'pending') {
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.editApproval(\'' + a.id + '\')">✎ 修改</button>';
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.withdrawApproval(\'' + a.id + '\')">↶ 撤回</button>';
            actionHtml += '<button class="toolbar-btn danger" style="font-size:12px;padding:4px 12px" onclick="FA.deleteApproval(\'' + a.id + '\')">✕ 删除</button>';
        }
        if (canCreate && isApplicant && (normalized.status === 'rejected' || normalized.status === 'approved')) {
            actionHtml += '<button class="toolbar-btn" style="font-size:12px;padding:4px 12px" onclick="FA.resubmitApproval(\'' + a.id + '\')">🔄 重新提交</button>';
        }
        actionHtml += '</div>';

        /* 当前环节信息 */
        var currentStageInfo = FA._getCurrentStageInfo(normalized);

        var metaParts = [];
        metaParts.push('📋 ' + normalized.orderNo);
        metaParts.push('👤 ' + applicantName);
        metaParts.push('📅 ' + (normalized.createdDate || '').substring(0, 10));
        if (normalized.amount) metaParts.push('💰 ¥' + normalized.amount);

        return '<div class="approval-item" style="cursor:pointer" onclick="FA.viewApprovalDetail(\'' + a.id + '\', event)">' +
            '<div class="approval-item-header">' +
                '<h4>' + normalized.title + '</h4>' +
                '<span class="approval-status ' + statusClass + '">' + statusName + '</span>' +
            '</div>' +
            '<div class="approval-meta">' +
                '<span style="display:inline-block;padding:2px 8px;background:rgba(0,122,255,0.08);border-radius:6px;font-size:11px;margin-right:6px">' + categoryName + '</span> ' +
                metaParts.join(' · ') +
            '</div>' +
            (normalized.description ? '<div style="font-size:13px;color:#666;margin:6px 0">' + normalized.description + '</div>' : '') +
            (currentStageInfo ? '<div style="font-size:12px;color:#999;margin-bottom:4px">' + currentStageInfo + '</div>' : '') +
            '<div class="approval-progress">' + stepHtml + '</div>' +
            actionHtml +
        '</div>';
    }).join('') + '</div>';
};

/* =====================
   兼容旧格式: 转换为stages结构
   ===================== */
FA._normalizeApproval = function(a) {
    /* 如果已有 stages, 直接返回 */
    if (a.stages && a.stages.length > 0) return a;

    /* 旧格式: assignTo + steps → 转换为单环节 */
    var approvers = [];
    if (a.assignTo) approvers.push(a.assignTo);

    var stages = [{
        name: '审批',
        mode: 'all',
        approvers: approvers,
        status: a.status === 'pending' ? 'pending' : (a.status === 'approved' ? 'approved' : (a.status === 'rejected' ? 'rejected' : a.status)),
        approverResults: [],
        reason: '',
        message: ''
    }];

    /* 从 steps 中提取审批结果 */
    if (a.steps && a.steps.length > 1 && a.steps[1].time) {
        stages[0].approverResults = [{
            user: a.assignTo,
            action: a.steps[1].status === 'approved' ? 'approve' : (a.steps[1].status === 'rejected' ? 'reject' : a.steps[1].status),
            reason: '',
            message: '',
            time: a.steps[1].time
        }];
    }

    return {
        id: a.id,
        orderNo: a.orderNo,
        title: a.title,
        category: a.category,
        description: a.description,
        amount: a.amount,
        applicant: a.applicant,
        status: a.status,
        stages: stages,
        currentStage: 0,
        createdDate: a.createdDate,
        modifiedDate: a.modifiedDate,
        history: a.history || []
    };
};

/* =====================
   获取当前环节信息
   ===================== */
FA._getCurrentStageInfo = function(a) {
    if (a.status !== 'pending') return '';
    var stageIdx = a.currentStage || 0;
    if (!a.stages || stageIdx >= a.stages.length) return '';
    var stage = a.stages[stageIdx];
    var approverNames = stage.approvers.map(function(u) { return FA._getMemberName(u); }).join('、');
    var modeText = stage.mode === 'any' ? '任一通过' : '全部通过';
    return '当前环节: ' + stage.name + ' · 审批人: ' + approverNames + ' · ' + modeText;
};

/* =====================
   判断当前用户是否可以操作当前环节
   ===================== */
FA._canActOnCurrentStage = function(a) {
    if (a.status !== 'pending') return false;
    var stageIdx = a.currentStage || 0;
    if (!a.stages || stageIdx >= a.stages.length) return false;
    var stage = a.stages[stageIdx];
    /* 当前用户是审批人且尚未操作 */
    if (stage.approvers.indexOf(FA.currentUser.username) === -1) return false;
    var alreadyActed = stage.approverResults.some(function(r) {
        return r.user === FA.currentUser.username;
    });
    return !alreadyActed;
};

/* =====================
   渲染审批步骤 (多环节)
   ===================== */
FA._renderApprovalSteps = function(a) {
    var normalized = (a.stages && a.stages.length > 0) ? a : FA._normalizeApproval(a);
    if (!normalized.stages || normalized.stages.length === 0) return '';

    var stepIcons = {
        done: '✓',
        approved: '✓',
        rejected: '✗',
        pending: '○',
        withdrawn: '↶'
    };

    var html = '';
    normalized.stages.forEach(function(stage, i) {
        var stageClass = '';
        if (stage.status === 'approved') stageClass = 'done';
        else if (stage.status === 'pending' && i === (normalized.currentStage || 0)) stageClass = 'current';
        else if (stage.status === 'rejected') stageClass = 'current';
        else if (stage.status === 'withdrawn') stageClass = '';

        var icon = stepIcons[stage.status] || '○';
        var approverNames = stage.approvers.map(function(u) {
            return FA._getMemberName(u);
        }).join('/');
        var modeText = stage.mode === 'any' ? '(任一)' : '(全部)';
        var timeStr = '';

        /* 显示已审批人的结果 */
        var resultsStr = '';
        if (stage.approverResults && stage.approverResults.length > 0) {
            resultsStr = stage.approverResults.map(function(r) {
                var rName = FA._getMemberName(r.user);
                var rIcon = r.action === 'approve' ? '✓' : '✗';
                return rName + rIcon;
            }).join(' ');
            var lastResult = stage.approverResults[stage.approverResults.length - 1];
            if (lastResult && lastResult.time) {
                timeStr = ' ' + new Date(lastResult.time).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
            }
        }

        html += '<div class="approval-step ' + stageClass + '">' +
            '<span>' + icon + '</span>' +
            '<span>' + stage.name + ': ' + approverNames + modeText +
                (resultsStr ? ' [' + resultsStr + ']' : '') + timeStr + '</span>' +
        '</div>';

        if (i < normalized.stages.length - 1) {
            html += '<span class="approval-step-arrow">→</span>';
        }
    });

    /* 如果是旧格式且有steps, 也显示 */
    if (!normalized.stages && a.steps) {
        a.steps.forEach(function(step, i) {
            var icon = stepIcons[step.status] || '○';
            var userName = FA._getMemberName(step.user);
            var timeStr = step.time ? ' ' + new Date(step.time).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
            html += '<div class="approval-step">' +
                '<span>' + icon + '</span>' +
                '<span>' + step.name + (userName ? ' (' + userName + ')' : '') + timeStr + '</span>' +
            '</div>';
            if (i < a.steps.length - 1) html += '<span class="approval-step-arrow">→</span>';
        });
    }

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

    var leftHtml =
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            '<input type="text" id="approvalOrderInput" placeholder="输入审批单号查询" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px;width:200px">' +
            '<button class="toolbar-btn" onclick="FA.queryApprovalByOrder(document.getElementById(\'approvalOrderInput\').value)">查询</button>' +
            '<button class="toolbar-btn" onclick="FA.getApprovalHistory()">历史记录</button>' +
        '</div>';

    var rightHtml = FA.checkPermission('createApproval')
        ? '<button class="toolbar-btn" onclick="FA.createApproval()">＋ 发起审批</button>'
        : '';

    toolbar.innerHTML = leftHtml + rightHtml;

    var container = section.querySelector('#approvalsContent');
    if (container) {
        section.insertBefore(toolbar, container);
    } else {
        section.appendChild(toolbar);
    }
};

/* =====================
   发起审批 (多环节)
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

    /* 初始化环节编辑器 */
    FA._stagesEditor = [{ name: '审批', mode: 'all', approvers: [] }];
    FA._renderStagesEditor();

    /* 绑定提交 */
    var submitBtn = document.getElementById('approvalSubmit');
    submitBtn.onclick = function() { FA._submitApproval(); };

    document.getElementById('approvalModalTitle').textContent = '发起审批';

    FA.showModal(modalId);
};

/* =====================
   创建审批弹窗 (含多环节编辑器)
   ===================== */
FA._createApprovalModal = function(modalId, existing) {
    var div = document.createElement('div');
    var title = existing ? '修改审批' : '发起审批';
    var btnText = existing ? '重新提交' : '提交';

    div.innerHTML =
        '<div class="modal" id="' + modalId + '">' +
            '<div class="modal-content" style="max-width:600px">' +
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
                '<div class="modal-field">' +
                    '<label>审批流程 (多环节)</label>' +
                    '<div id="stagesEditor"></div>' +
                '</div>' +
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
        var normalized = FA._normalizeApproval(existing);
        FA._stagesEditor = normalized.stages.map(function(s) {
            return { name: s.name, mode: s.mode, approvers: s.approvers.slice() };
        });
        if (FA._stagesEditor.length === 0) {
            FA._stagesEditor = [{ name: '审批', mode: 'all', approvers: [] }];
        }
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
            FA._renderStagesEditor();
        }, 50);
    } else {
        /* 新建时初始化空编辑器 */
        FA._stagesEditor = [{ name: '审批', mode: 'all', approvers: [] }];
        setTimeout(function() { FA._renderStagesEditor(); }, 50);
    }

    return div.firstElementChild;
};

/* =====================
   渲染环节编辑器
   ===================== */
FA._renderStagesEditor = function() {
    var container = document.getElementById('stagesEditor');
    if (!container) return;

    var users = FA._getOtherUsers();

    var html = FA._stagesEditor.map(function(stage, idx) {
        var approverChips = stage.approvers.map(function(u, ai) {
            var name = FA._getMemberName(u);
            return '<span class="stage-approver-chip">' + FA._esc(name) +
                ' <span class="chip-remove" onclick="FA._removeApprover(' + idx + ', ' + ai + ')">×</span>' +
            '</span>';
        }).join('');

        var userOptions = '<option value="">+ 添加审批人</option>' +
            users.filter(function(u) { return stage.approvers.indexOf(u.username) === -1; })
                .map(function(u) {
                    return '<option value="' + u.username + '">' + FA._esc(u.nameCn || u.name) + ' (' + FA.getRoleName(u.role) + ')</option>';
                }).join('');

        return '<div class="stage-editor-card">' +
            '<div class="stage-editor-header">' +
                '<input type="text" class="stage-name-input" value="' + FA._esc(stage.name) + '" placeholder="环节名称" ' +
                    'oninput="FA._stagesEditor[' + idx + '].name = this.value">' +
                '<button class="stage-remove-btn" onclick="FA._removeStage(' + idx + ')" title="删除环节">×</button>' +
            '</div>' +
            '<div class="stage-mode-tabs">' +
                '<div class="stage-mode-tab' + (stage.mode === 'any' ? ' active' : '') + '" ' +
                    'onclick="FA._setStageMode(' + idx + ', \'any\')">任一通过</div>' +
                '<div class="stage-mode-tab' + (stage.mode === 'all' ? ' active' : '') + '" ' +
                    'onclick="FA._setStageMode(' + idx + ', \'all\')">全部通过</div>' +
            '</div>' +
            '<div class="stage-approvers">' + approverChips + '</div>' +
            '<select class="stage-approver-select" onchange="if(this.value){FA._addApprover(' + idx + ', this.value);this.value=\'\';}">' + userOptions + '</select>' +
        '</div>';
    }).join('');

    html += '<button class="add-stage-btn" onclick="FA._addStage()">＋ 添加环节</button>';

    container.innerHTML = html;
};

FA._addStage = function() {
    FA._stagesEditor.push({ name: '环节' + (FA._stagesEditor.length + 1), mode: 'all', approvers: [] });
    FA._renderStagesEditor();
};

FA._removeStage = function(idx) {
    if (FA._stagesEditor.length <= 1) {
        FA.showToast('至少需要保留一个环节', 'error');
        return;
    }
    FA._stagesEditor.splice(idx, 1);
    FA._renderStagesEditor();
};

FA._setStageMode = function(idx, mode) {
    if (FA._stagesEditor[idx]) {
        FA._stagesEditor[idx].mode = mode;
        FA._renderStagesEditor();
    }
};

FA._addApprover = function(stageIdx, username) {
    if (FA._stagesEditor[stageIdx].approvers.indexOf(username) === -1) {
        FA._stagesEditor[stageIdx].approvers.push(username);
        FA._renderStagesEditor();
    }
};

FA._removeApprover = function(stageIdx, approverIdx) {
    FA._stagesEditor[stageIdx].approvers.splice(approverIdx, 1);
    FA._renderStagesEditor();
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

/* =====================
   提交审批 (多环节)
   ===================== */
FA._submitApproval = function(isEdit) {
    var title = document.getElementById('approvalTitle').value.trim();
    var category = document.getElementById('approvalCategory').value;
    var description = document.getElementById('approvalDescription').value.trim();
    var amountEl = document.getElementById('approvalAmount');
    var amount = (category === 'finance' && amountEl) ? parseFloat(amountEl.value) || 0 : 0;

    if (!title) { FA.showToast('请填写标题', 'error'); return; }

    /* 验证环节 */
    if (!FA._stagesEditor || FA._stagesEditor.length === 0) {
        FA.showToast('请至少添加一个审批环节', 'error'); return;
    }
    for (var i = 0; i < FA._stagesEditor.length; i++) {
        var s = FA._stagesEditor[i];
        if (!s.name || !s.name.trim()) {
            FA.showToast('请填写环节' + (i+1) + '的名称', 'error'); return;
        }
        if (!s.approvers || s.approvers.length === 0) {
            FA.showToast('请为环节"' + s.name + '"添加至少一个审批人', 'error'); return;
        }
    }

    /* 构建stages数据 */
    var now = new Date().toISOString();
    var stages = FA._stagesEditor.map(function(s) {
        return {
            name: s.name,
            mode: s.mode,
            approvers: s.approvers.slice(),
            status: 'pending',
            approverResults: [],
            reason: '',
            message: ''
        };
    });

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
            existing.stages = stages;
            existing.currentStage = 0;
            existing.status = 'pending';
            existing.modifiedDate = now;

            if (!existing.history) existing.history = [];
            existing.history.push({
                action: '已重新提交',
                user: FA.currentUser.username,
                time: now,
                detail: '审批已修改并重新提交 (' + stages.length + '个环节)'
            });

            FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
            FA.closeModal('create-approval-modal');
            FA.renderApprovals();

            /* 通知审批人 */
            var firstStageApprovers = stages[0].approvers;
            firstStageApprovers.forEach(function(u) {
                var name = FA._getMemberName(u);
                FA.Data.addNotification('info', '新审批待处理',
                    title + ' · 单号 ' + existing.orderNo + ' · 审批人: ' + name);
            });
            FA.showToast('审批已修改并重新提交', 'success');
        }
        return;
    }

    /* 生成单号 */
    var today = FA.getTodayStr().replace(/-/g, '');
    var prefix = 'APR-' + today + '-';
    var count = 0;
    if (FA.approvals) {
        FA.approvals.forEach(function(a) {
            if (a.orderNo && a.orderNo.indexOf(prefix) === 0) count++;
        });
    }
    var orderNo = prefix + String(count + 1).padStart(4, '0');

    var approval = {
        id: 'apr_' + Date.now(),
        orderNo: orderNo,
        title: title,
        category: category,
        description: description,
        amount: amount,
        applicant: FA.currentUser.username,
        status: 'pending',
        stages: stages,
        currentStage: 0,
        createdDate: now,
        history: [
            { action: '已创建', user: FA.currentUser.username, time: now, detail: '审批创建 (' + stages.length + '个环节)' }
        ]
    };

    FA.approvals.unshift(approval);
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.closeModal('create-approval-modal');
    FA.renderApprovals();

    /* 通知第一环节审批人 */
    var firstApprovers = stages[0].approvers;
    firstApprovers.forEach(function(u) {
        var name = FA._getMemberName(u);
        FA.Data.addNotification('info', '新审批待处理',
            title + ' · 单号 ' + orderNo + ' · 审批人: ' + name);
    });
    FA.showToast('审批已提交，单号: ' + orderNo, 'success');
};

/* =====================
   修改审批
   ===================== */
FA.editApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error'); return;
    }
    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能修改自己发起的审批', 'error'); return;
    }
    if (approval.status !== 'pending') {
        FA.showToast('只能修改待审批的审批', 'error'); return;
    }

    var modalId = 'create-approval-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = FA._createApprovalModal(modalId, approval);
    document.body.appendChild(modal);

    var catSelect = document.getElementById('approvalCategory');
    catSelect.onchange = FA._toggleAmountField;

    var submitBtn = document.getElementById('approvalSubmit');
    submitBtn.onclick = function() { FA._submitApproval(true); };

    FA.showModal(modalId);
};

/* =====================
   重新提交
   ===================== */
FA.resubmitApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error'); return;
    }
    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能重新提交自己发起的审批', 'error'); return;
    }
    if (!confirm('确定要重新提交此审批吗？将重置审批流程。')) return;

    var now = new Date().toISOString();
    var normalized = FA._normalizeApproval(approval);

    approval.status = 'pending';
    approval.stages = normalized.stages.map(function(s) {
        return {
            name: s.name, mode: s.mode,
            approvers: s.approvers.slice(),
            status: 'pending',
            approverResults: [],
            reason: '', message: ''
        };
    });
    approval.currentStage = 0;

    if (!approval.history) approval.history = [];
    approval.history.push({ action: '已重新提交', user: FA.currentUser.username, time: now, detail: '审批重新提交' });

    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();

    var firstApprovers = approval.stages[0].approvers;
    firstApprovers.forEach(function(u) {
        var name = FA._getMemberName(u);
        FA.Data.addNotification('info', '审批重新提交',
            approval.title + ' · 单号 ' + approval.orderNo + ' · 审批人: ' + name);
    });
    FA.showToast('审批已重新提交', 'success');
};

/* 删除审批 */
FA.deleteApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error'); return;
    }
    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能删除自己发起的审批', 'error'); return;
    }
    if (!confirm('确定要删除审批「' + approval.title + '」吗？此操作不可撤销。')) return;

    var now = new Date().toISOString();
    if (!approval.history) approval.history = [];
    approval.history.push({
        action: '已删除', user: FA.currentUser.username, time: now,
        detail: '审批已被申请人删除(留痕)'
    });
    approval.status = 'deleted';
    approval.deletedAt = now;
    approval.deletedBy = FA.currentUser.username;

    FA.deletedApprovals = FA.Data.loadData(FA.DB_KEYS.deletedApprovals, []);
    FA.deletedApprovals.unshift(JSON.parse(JSON.stringify(approval)));
    FA.Data.saveData(FA.DB_KEYS.deletedApprovals, FA.deletedApprovals);

    FA.approvals = FA.approvals.filter(function(a) { return a.id !== id; });
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
    FA.showToast('审批已删除（留痕保留）', 'info');
};

/* =====================
   查看审批详情
   ===================== */
FA.viewApprovalDetail = function(id, event) {
    if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.closest('button'))) {
        event.stopPropagation();
        return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) {
        var deleted = FA.Data.loadData(FA.DB_KEYS.deletedApprovals, []);
        approval = deleted.find(function(a) { return a.id === id; });
    }
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }

    var normalized = FA._normalizeApproval(approval);
    var modalId = 'approval-detail-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;

    var statusName = FA._approvalStatusNames[normalized.status] || normalized.status;
    var categoryName = FA._approvalCategoryNames[normalized.category] || normalized.category;
    var applicantName = FA._getMemberName(normalized.applicant);
    var stepHtml = FA._renderApprovalSteps(normalized);

    /* 操作按钮 */
    var actionHtml = '';
    var isApplicant = (normalized.applicant === FA.currentUser.username);
    var canApprove = FA.checkPermission('approveApproval');
    var canCreate = FA.checkPermission('createApproval');
    var canActOnCurrentStage = FA._canActOnCurrentStage(normalized);

    if (canApprove && normalized.status === 'pending' && canActOnCurrentStage) {
        actionHtml +=
            '<div style="margin-top:16px;display:flex;gap:10px">' +
            '<button class="btn-primary" onclick="FA.approveApproval(\'' + approval.id + '\', \'approve\');FA.closeModal(\'approval-detail-modal\')">通过</button>' +
            '<button class="btn-secondary" style="color:#e74c3c;border-color:rgba(231,76,60,0.2)" onclick="FA.approveApproval(\'' + approval.id + '\', \'reject\');FA.closeModal(\'approval-detail-modal\')">驳回</button>' +
            '</div>';
    }
    if (canCreate && isApplicant && normalized.status === 'pending') {
        actionHtml +=
            '<div style="margin-top:10px;display:flex;gap:10px">' +
            '<button class="btn-secondary" onclick="FA.closeModal(\'approval-detail-modal\');FA.editApproval(\'' + approval.id + '\')">✎ 修改详情</button>' +
            '<button class="btn-secondary" onclick="FA.closeModal(\'approval-detail-modal\');FA.withdrawApproval(\'' + approval.id + '\')">↶ 撤回</button>' +
            '<button class="btn-danger" onclick="FA.closeModal(\'approval-detail-modal\');FA.deleteApproval(\'' + approval.id + '\')">✕ 删除</button>' +
            '</div>';
    }
    if (canCreate && isApplicant && (normalized.status === 'rejected' || normalized.status === 'approved')) {
        actionHtml +=
            '<div style="margin-top:10px">' +
            '<button class="btn-primary" onclick="FA.closeModal(\'approval-detail-modal\');FA.resubmitApproval(\'' + approval.id + '\')">🔄 重新提交</button>' +
            '</div>';
    }

    /* 多环节详情 */
    var stagesDetailHtml = '';
    if (normalized.stages && normalized.stages.length > 0) {
        stagesDetailHtml = normalized.stages.map(function(stage, si) {
            var stageStatusName = FA._approvalStatusNames[stage.status] || stage.status;
            var modeText = stage.mode === 'any' ? '任一通过' : '全部通过';
            var approverNames = stage.approvers.map(function(u) { return FA._getMemberName(u); }).join('、');

            var resultsHtml = '';
            if (stage.approverResults && stage.approverResults.length > 0) {
                resultsHtml = stage.approverResults.map(function(r) {
                    var rName = FA._getMemberName(r.user);
                    var rAction = r.action === 'approve' ? '✓ 通过' : '✗ 驳回';
                    var rTime = r.time ? new Date(r.time).toLocaleString('zh-CN') : '';
                    return '<div style="font-size:12px;padding:6px 8px;background:rgba(245,245,247,0.5);border-radius:6px;margin-top:4px">' +
                        '<strong>' + rName + '</strong> · ' + rAction + ' · ' + rTime +
                        (r.reason ? '<br><span style="color:#888">理由: ' + FA._esc(r.reason) + '</span>' : '') +
                        (r.message ? '<br><span style="color:#007AFF">留言: ' + FA._esc(r.message) + '</span>' : '') +
                    '</div>';
                }).join('');
            }

            return '<div style="padding:10px;background:rgba(245,245,247,0.3);border-radius:10px;margin-bottom:8px">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
                    '<strong style="font-size:14px">环节' + (si+1) + ': ' + FA._esc(stage.name) + '</strong>' +
                    '<span class="approval-status ' + stage.status + '" style="font-size:11px">' + stageStatusName + '</span>' +
                '</div>' +
                '<div style="font-size:12px;color:#888;margin-bottom:4px">审批人: ' + approverNames + ' · ' + modeText + '</div>' +
                resultsHtml +
            '</div>';
        }).join('');
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
        '<div class="modal-content" style="max-width:600px">' +
            '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
            '<div class="modal-header"><h3>审批详情</h3></div>' +
            '<div style="font-size:14px;line-height:2">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                    '<h4 style="font-size:18px;font-weight:600">' + normalized.title + '</h4>' +
                    '<span class="approval-status ' + normalized.status + '">' + statusName + '</span>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-top:12px">' +
                    '<div><strong>单号:</strong> ' + normalized.orderNo + '</div>' +
                    '<div><strong>类别:</strong> ' + categoryName + '</div>' +
                    '<div><strong>申请人:</strong> ' + applicantName + '</div>' +
                    '<div><strong>创建时间:</strong> ' + (normalized.createdDate || '').replace('T', ' ').substring(0, 19) + '</div>' +
                    (normalized.modifiedDate ? '<div><strong>修改时间:</strong> ' + normalized.modifiedDate.replace('T', ' ').substring(0, 19) + '</div>' : '<div></div>') +
                    (normalized.amount ? '<div><strong>金额:</strong> ¥' + normalized.amount + '</div>' : '<div></div>') +
                '</div>' +
                (normalized.description ? '<div style="margin-top:12px;padding:12px;background:rgba(245,245,247,0.5);border-radius:10px"><strong style="display:block;margin-bottom:4px">描述:</strong>' + normalized.description + '</div>' : '') +
                '<div style="margin-top:14px"><strong>审批流程:</strong></div>' +
                '<div class="approval-progress" style="margin-top:6px">' + stepHtml + '</div>' +
                (stagesDetailHtml ? '<div style="margin-top:14px"><strong>环节详情:</strong></div>' + stagesDetailHtml : '') +
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
   审批/驳回 (多环节逻辑)
   ===================== */
FA.approveApproval = function(id, action) {
    if (!FA.checkPermission('approveApproval')) {
        FA.showToast('权限不足', 'error'); return;
    }

    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.status !== 'pending') { FA.showToast('该审批已处理', 'error'); return; }

    var normalized = FA._normalizeApproval(approval);
    var stageIdx = normalized.currentStage || 0;
    var stage = normalized.stages[stageIdx];
    if (!stage) { FA.showToast('审批环节异常', 'error'); return; }

    /* 检查当前用户是否为审批人 */
    if (stage.approvers.indexOf(FA.currentUser.username) === -1) {
        FA.showToast('您不是当前环节的审批人', 'error'); return;
    }

    /* 检查是否已操作 */
    var alreadyActed = stage.approverResults.some(function(r) {
        return r.user === FA.currentUser.username;
    });
    if (alreadyActed) {
        FA.showToast('您已审批过此环节', 'error'); return;
    }

    /* 弹窗收集理由和留言 */
    var modalId = 'approval-action-modal';
    var old = document.getElementById(modalId);
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;
    modal.style.zIndex = '3000';
    var actionName = action === 'approve' ? '通过' : '驳回';
    var isLastStage = (stageIdx >= normalized.stages.length - 1);

    modal.innerHTML =
        '<div class="modal-content" style="max-width:440px">' +
            '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
            '<div class="modal-header"><h3>审批' + actionName + '</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:14px">' +
                '环节: ' + stage.name + ' · 审批: ' + approval.title +
            '</p>' +
            '<div class="modal-field"><label>审批理由</label>' +
                '<textarea id="approvalReason" rows="3" placeholder="请填写审批理由（选填）"></textarea>' +
            '</div>' +
            (isLastStage ? '' : '<div class="modal-field"><label>给下一环节的留言</label>' +
                '<textarea id="approvalMessage" rows="2" placeholder="给下一环节审批人的留言（选填）"></textarea>' +
            '</div>') +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                '<button class="btn-primary" onclick="FA._doApproveAction(\'' + id + '\', \'' + action + '\')">确认' + actionName + '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);
    FA.showModal(modalId);
};

/* 执行审批操作 */
FA._doApproveAction = function(id, action) {
    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) return;

    var normalized = FA._normalizeApproval(approval);
    /* 确保approval上有stages */
    if (!approval.stages) {
        approval.stages = normalized.stages;
        approval.currentStage = 0;
    }

    var stageIdx = approval.currentStage || 0;
    var stage = approval.stages[stageIdx];
    if (!stage) return;

    var now = new Date().toISOString();
    var reason = '';
    var messageEl = document.getElementById('approvalReason');
    if (messageEl) reason = messageEl.value.trim();

    var message = '';
    var msgEl = document.getElementById('approvalMessage');
    if (msgEl) message = msgEl.value.trim();

    /* 记录审批结果 */
    if (!stage.approverResults) stage.approverResults = [];
    stage.approverResults.push({
        user: FA.currentUser.username,
        action: action,
        reason: reason,
        message: message,
        time: now
    });

    /* 添加历史记录 */
    if (!approval.history) approval.history = [];
    var actionName = action === 'approve' ? '通过' : '驳回';
    approval.history.push({
        action: actionName,
        user: FA.currentUser.username,
        time: now,
        detail: '环节"' + stage.name + '" - ' + actionName + (reason ? ' (' + reason + ')' : '')
    });

    /* 判断环节是否完成 */
    var stageDone = false;
    var stagePassed = false;

    if (action === 'reject') {
        /* 驳回: 当前环节立即完成(未通过) */
        stageDone = true;
        stagePassed = false;
    } else {
        /* 通过: 根据模式判断 */
        if (stage.mode === 'any') {
            /* 任一通过: 只要有一个人通过即可 */
            stageDone = true;
            stagePassed = true;
        } else {
            /* 全部通过: 需要所有审批人都通过 */
            var allApproved = stage.approvers.every(function(u) {
                return stage.approverResults.some(function(r) {
                    return r.user === u && r.action === 'approve';
                });
            });
            if (allApproved) {
                stageDone = true;
                stagePassed = true;
            }
            /* 如果有人驳回, 且模式是全部通过, 则环节失败 */
            var anyRejected = stage.approverResults.some(function(r) {
                return r.action === 'reject';
            });
            if (anyRejected) {
                stageDone = true;
                stagePassed = false;
            }
        }
    }

    if (stageDone) {
        stage.status = stagePassed ? 'approved' : 'rejected';
        stage.reason = reason;
        stage.message = message;

        if (stagePassed) {
            /* 当前环节通过, 检查是否还有下一环节 */
            if (stageIdx < approval.stages.length - 1) {
                /* 进入下一环节 */
                approval.currentStage = stageIdx + 1;
                approval.status = 'pending';

                /* 通知下一环节审批人 */
                var nextStage = approval.stages[stageIdx + 1];
                nextStage.approvers.forEach(function(u) {
                    var name = FA._getMemberName(u);
                    var msgText = message ? ' (留言: ' + message + ')' : '';
                    FA.Data.addNotification('info', '审批待处理',
                        approval.title + ' · ' + nextStage.name + msgText);
                });
            } else {
                /* 所有环节通过 */
                approval.status = 'approved';
                FA.Data.addNotification('success', '审批已通过',
                    approval.title + ' · ' + approval.orderNo + ' 已全部通过');
            }
        } else {
            /* 当前环节未通过 */
            approval.status = 'rejected';
            FA.Data.addNotification('warning', '审批已驳回',
                approval.title + ' · ' + approval.orderNo + ' 被驳回');
        }
    } else {
        /* 环节未完成 (全部通过模式, 还有人没操作) */
        /* 通知申请人进度 */
        FA.Data.addNotification('info', '审批进度更新',
            approval.title + ' · ' + stage.name + ' - ' + FA._getMemberName(FA.currentUser.username) + actionName);
    }

    FA.closeModal('approval-action-modal');
    FA.Data.saveData(FA.DB_KEYS.approvals, FA.approvals);
    FA.renderApprovals();
    FA.showToast('审批已' + actionName, action === 'approve' ? 'success' : 'info');
};

/* =====================
   撤回审批
   ===================== */
FA.withdrawApproval = function(id) {
    if (!FA.checkPermission('createApproval')) {
        FA.showToast('权限不足', 'error'); return;
    }
    var approval = FA.approvals.find(function(a) { return a.id === id; });
    if (!approval) { FA.showToast('审批不存在', 'error'); return; }
    if (approval.applicant !== FA.currentUser.username) {
        FA.showToast('只能撤回自己发起的审批', 'error'); return;
    }
    if (approval.status !== 'pending') {
        FA.showToast('只能撤回待审批的审批', 'error'); return;
    }
    if (!confirm('确定要撤回审批「' + approval.title + '」吗？')) return;

    var now = new Date().toISOString();
    approval.status = 'withdrawn';

    /* 更新当前环节状态 */
    if (approval.stages) {
        var stageIdx = approval.currentStage || 0;
        if (approval.stages[stageIdx]) {
            approval.stages[stageIdx].status = 'withdrawn';
        }
    }

    if (!approval.history) approval.history = [];
    approval.history.push({
        action: '已撤回', user: FA.currentUser.username, time: now, detail: '审批已撤回'
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
        FA.showToast('请输入审批单号', 'error'); return;
    }
    orderNo = orderNo.trim().toUpperCase();

    var approval = FA.approvals.find(function(a) {
        return a.orderNo && a.orderNo.toUpperCase() === orderNo;
    });
    if (!approval) {
        FA.showToast('未找到单号 ' + orderNo, 'error'); return;
    }
    FA.viewApprovalDetail(approval.id);
};

/* =====================
   审批历史
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
                '<input type="date" id="histDateFrom" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
                '<span style="color:#999">至</span>' +
                '<input type="date" id="histDateTo" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px">' +
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
        var normalized = FA._normalizeApproval(a);
        var statusName = FA._approvalStatusNames[a.status] || (a.status === 'deleted' ? '已删除' : a.status);
        var categoryName = FA._approvalCategoryNames[a.category] || a.category;
        var applicantName = FA._getMemberName(a.applicant);
        var stepHtml = FA._renderApprovalSteps(normalized);

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
