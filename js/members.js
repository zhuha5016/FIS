/* ======================================================================
   members.js - 家庭成员管理模块
   功能: 成员列表渲染、编辑、删除、添加、联系弹窗
   依赖: config.js, data.js, verify.js
   ====================================================================== */

window.FA = window.FA || {};

/* =====================
   工具: HTML 转义
   ===================== */
FA._esc = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/* =====================
   注入模块样式
   ===================== */
(function() {
    var style = document.createElement('style');
    style.textContent = [
        '/* 实名认证徽章 */',
        '.verified-badge { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:500; margin-left:6px; vertical-align:middle; }',
        '.verified-badge.verified { color:#28a745; }',
        '.verified-badge.unverified { color:#aaa; }',
        '.verified-badge svg { width:14px; height:14px; fill:currentColor; }',
        '',
        '/* 联系弹窗 */',
        '.contact-popup { position:fixed; background:white; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15); padding:16px 20px; min-width:220px; z-index:9999; animation:contactPopIn 0.2s ease; border:1px solid rgba(0,0,0,0.06); }',
        '@keyframes contactPopIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }',
        '.contact-popup-title { font-size:16px; font-weight:600; color:#1a1a1a; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.06); }',
        '.contact-popup-row { font-size:14px; color:#555; margin-bottom:6px; display:flex; align-items:center; gap:8px; }',
        '.contact-popup-row:last-child { margin-bottom:0; }',
        '',
        '/* 性别选择器 */',
        '.gender-tab-selector { display:flex; gap:0; border-radius:10px; overflow:hidden; border:1px solid rgba(0,0,0,0.1); }',
        '.gender-tab { flex:1; padding:10px; text-align:center; cursor:pointer; font-size:14px; color:#555; transition:all 0.2s; background:#f5f5f7; }',
        '.gender-tab.active { background:#007AFF; color:white; font-weight:500; }',
        '.gender-tab:hover:not(.active) { background:#e8e8ea; }',
        '',
        '/* 编辑弹窗布局 */',
        '.edit-top-section { display:flex; gap:24px; margin-bottom:20px; }',
        '.edit-avatar-area { display:flex; flex-direction:column; align-items:center; gap:10px; flex-shrink:0; }',
        '.edit-avatar-preview { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#007AFF,#0040FF); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:32px; cursor:pointer; overflow:hidden; box-shadow:0 4px 12px rgba(0,122,255,0.25); }',
        '.edit-avatar-preview > div { width:100%; height:100%; border-radius:50%; }',
        '.member-avatar > div { width:100%; height:100%; border-radius:50%; }',
        '.btn-upload-avatar { padding:6px 14px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); background:white; color:#007AFF; font-size:12px; cursor:pointer; transition:all 0.2s; }',
        '.btn-upload-avatar:hover { background:rgba(0,122,255,0.05); }',
        '.edit-basic-info { flex:1; min-width:0; }',
        '.edit-field-row { display:flex; gap:12px; align-items:flex-start; }',
        '.edit-field-row .modal-field { flex:1; min-width:0; }',
        '.verify-btn-area { display:flex; align-items:center; padding-top:28px; flex-shrink:0; }',
        '.btn-verify { padding:8px 14px; border-radius:8px; border:1px solid #28a745; background:rgba(40,167,69,0.08); color:#28a745; font-size:12px; cursor:pointer; white-space:nowrap; transition:all 0.2s; }',
        '.btn-verify:hover { background:rgba(40,167,69,0.15); }',
        '.verified-check { display:inline-flex; align-items:center; gap:4px; color:#28a745; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; }',
        '.verified-check svg { width:16px; height:16px; fill:currentColor; }',
        '',
        '/* 编辑表单网格 */',
        '.edit-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }',
        '.edit-form-grid .modal-field { margin-bottom:16px; }',
        '',
        '/* 编辑区域 */',
        '.edit-section { margin-top:20px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.06); }',
        '.edit-section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }',
        '.edit-section-header h4 { font-size:15px; font-weight:600; color:#1a1a1a; }',
        '.btn-add-row { padding:6px 12px; border-radius:8px; border:1px solid rgba(0,122,255,0.2); background:rgba(0,122,255,0.05); color:#007AFF; font-size:12px; cursor:pointer; transition:all 0.2s; }',
        '.btn-add-row:hover { background:rgba(0,122,255,0.1); }',
        '',
        '/* 证件/银行卡行 */',
        '.doc-row, .card-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }',
        '.doc-row select, .card-row select { flex-shrink:0; padding:10px 12px; }',
        '.doc-row .doc-type { width:140px; flex-shrink:0; }',
        '.doc-row .doc-value { flex:1; min-width:0; }',
        '.card-row .card-number { flex:1; min-width:0; }',
        '.card-row .card-bank { width:120px; flex-shrink:0; }',
        '.card-row .card-org { width:110px; flex-shrink:0; }',
        '.card-row .card-cvv { width:60px; flex-shrink:0; }',
        '.btn-remove-doc, .btn-remove-card { width:30px; height:30px; border-radius:8px; border:none; background:rgba(231,76,60,0.08); color:#e74c3c; font-size:16px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }',
        '.btn-remove-doc:hover, .btn-remove-card:hover { background:rgba(231,76,60,0.15); }',
        '.empty-row-msg { color:#999; font-size:13px; padding:8px 0; }',
        '',
        '/* 敏感信息锁定 */',
        '.sensitive-locked { padding:12px 16px; background:rgba(255,152,0,0.06); border:1px solid rgba(255,152,0,0.15); border-radius:10px; color:#999; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:8px; }',
        '.sensitive-locked:hover { background:rgba(255,152,0,0.1); }',
        '.sensitive-locked.no-access { cursor:not-allowed; }',
        '.sensitive-locked.no-access:hover { background:rgba(255,152,0,0.06); }',
        '',
        '/* 成员操作按钮 */',
        '.member-actions .contact-btn { color:#28a745; }',
        '.member-actions .contact-btn:hover { background:rgba(40,167,69,0.05); }',
        '.member-actions .edit-btn { color:#007AFF; }',
        '.member-actions .pwd-btn { color:#FF9800; }',
        '.member-actions .pwd-btn:hover { background:rgba(255,152,0,0.05); }',
        '',
        '/* 响应式 */',
        '@media(max-width:600px){ .edit-top-section{flex-direction:column;align-items:center} .edit-form-grid{grid-template-columns:1fr} .edit-field-row{flex-direction:column} .doc-row,.card-row{flex-wrap:wrap} .doc-row .doc-type,.card-row .card-bank,.card-row .card-org,.card-row .card-cvv{width:auto;flex:1} }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
})();

/* ======================================================================
   1. 联系弹窗 (稳健版: 单一 document 监听 + 时间戳防抖, 杜绝"打开即被关闭")
   ====================================================================== */
FA._contactPopup = null;
FA._contactJustOpened = 0;

FA.showContactPopup = function(index, btnEl) {
    FA.closeContactPopup();
    var m = (FA.members && FA.members[index]) ? FA.members[index] : null;
    if (!m) return;

    var surname = (m.nameCn || m.name || '?').charAt(0);
    var title = surname + (m.gender === '女' ? '女士' : '先生');

    /* 复用页面中已存在的 #contactPopup 元素 (避免重复创建多个 .contact-popup 造成定位/样式异常) */
    var popup = document.getElementById('contactPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'contactPopup';
        document.body.appendChild(popup);
    }
    popup.className = 'contact-popup';
    popup.innerHTML =
        '<div class="contact-popup-title">' + FA._esc(title) + '</div>' +
        '<div class="contact-popup-row"><span>📱</span> ' + FA._esc(m.phone || '未填写') + '</div>' +
        '<div class="contact-popup-row"><span>✉️</span> ' + FA._esc(m.email || '未填写') + '</div>';
    popup.style.display = '';

    FA._contactPopup = popup;
    FA._contactJustOpened = Date.now();
    _bindContactOutside(); /* 绑定单一外部点击监听 (幂等) */

    /* 定位到按钮下方 (带视口边界保护) */
    try {
        var rect = (btnEl && btnEl.getBoundingClientRect) ? btnEl.getBoundingClientRect() : null;
        var pr = popup.getBoundingClientRect();
        if (rect) {
            var top = rect.bottom + 8;
            var left = rect.left;
            if (top + pr.height > window.innerHeight) top = rect.top - pr.height - 8;
            if (left + pr.width > window.innerWidth - 10) left = window.innerWidth - pr.width - 10;
            popup.style.top = Math.max(10, top) + 'px';
            popup.style.left = Math.max(10, left) + 'px';
        } else {
            popup.style.top = '80px';
            popup.style.left = '20px';
        }
    } catch (e) {}
};

/* 单一持久 document 监听: 捕获阶段绑定, 用时间戳忽略"打开当次点击",
   彻底避免弹窗刚打开就被同一/后续冒泡点击关掉 */
var _contactBound = false;
function _bindContactOutside() {
    if (_contactBound) return;
    _contactBound = true;
    document.addEventListener('click', function(e) {
        if (!FA._contactPopup) return;
        /* 打开后 80ms 内的点击一律忽略 (覆盖本次 opening 点击及其冒泡) */
        if (Date.now() - FA._contactJustOpened < 80) return;
        /* 点到弹窗自身或联系按钮 → 不关 */
        if (e.target && e.target.closest && e.target.closest('.contact-popup')) return;
        if (e.target && e.target.closest && e.target.closest('.contact-btn')) return;
        FA.closeContactPopup();
    }, true);
}

FA.closeContactPopup = function() {
    if (FA._contactPopup) {
        FA._contactPopup.innerHTML = '';
        FA._contactPopup.style.display = 'none';
        FA._contactPopup = null;
    }
};

/* ======================================================================
   2. 渲染成员列表
   ====================================================================== */
FA.renderMembers = function() {
    if (!FA.members) return;

    var ul = document.getElementById('memberList');
    if (!ul) return;

    var colors = FA.avatarColors || ['#007AFF','#28a745','#FF9800','#9C27B0','#E91E63','#00BCD4'];
    var canDelete = FA.checkPermission('deleteMember');
    var canEdit = FA.checkPermission('editMember');

    var checkSVG = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

    ul.innerHTML = FA.members.map(function(m, i) {
        var color = colors[i % colors.length];
        var firstChar = (m.nameCn || m.name || '?').charAt(0);

        /* 头像: 有图片用图片，否则用首字 */
        var avatarInner = m.avatar
            ? '<div style="width:100%;height:100%;border-radius:50%;background-image:url(\'' + m.avatar + '\');background-size:cover;background-position:center"></div>'
            : FA._esc(firstChar);
        var avatarBg = m.avatar ? 'background:transparent' : ('background:' + color);

        /* 实名认证徽章 */
        var verifiedBadge = m.verified
            ? '<span class="verified-badge verified">' + checkSVG + ' 已实名</span>'
            : '<span class="verified-badge unverified">' + checkSVG + ' 未实名</span>';

        /* 权限判断 */
        var isSelf = FA.currentUser && FA.currentUser.username === m.username;
        var canEditThis = canEdit || isSelf;

        /* 操作按钮: 联系(左) → 编辑(中) → 改密 → 删除(右) */
        var canChangePwd = FA.currentUser && FA.currentUser.role === 'superadmin';
        var actions = '<div class="member-actions">';
        actions += '<button class="contact-btn" onclick="FA.showContactPopup(' + i + ', this)">联系</button>';
        if (canEditThis) {
            actions += '<button class="edit-btn" onclick="FA.editMember(' + i + ')">编辑</button>';
        }
        if (canChangePwd) {
            actions += '<button class="pwd-btn" onclick="FA.changeMemberPassword(' + i + ')">改密</button>';
        }
        if (canDelete) {
            actions += '<button class="delete-btn" onclick="FA.deleteMember(' + i + ')">删除</button>';
        }
        actions += '</div>';

        return '<li class="member-item">' +
            '<div class="member-avatar" style="' + avatarBg + '">' + avatarInner + '</div>' +
            '<div class="member-info">' +
                '<h4>' + FA._esc(m.nameCn || m.name) + ' ' + verifiedBadge + '</h4>' +
                '<p>' + FA._esc(FA.getRoleName(m.role)) + ' · ' + FA._esc(m.phone || '未填写') + '</p>' +
            '</div>' +
            actions +
        '</li>';
    }).join('');

    /* 更新首页成员摘要 */
    var homeUl = document.getElementById('homeMemberList');
    if (homeUl) {
        homeUl.innerHTML = FA.members.slice(0, 3).map(function(m, i) {
            var color = colors[i % colors.length];
            var badge = m.verified ? ' ✓' : '';
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
                '<div style="width:28px;height:28px;border-radius:50%;background:' + color + ';color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + FA._esc((m.nameCn||m.name).charAt(0)) + '</div>' +
                '<span style="font-size:13px">' + FA._esc(m.nameCn || m.name) + ' (' + FA._esc(FA.getRoleName(m.role)) + ')' + badge + '</span>' +
            '</div>';
        }).join('');
    }

    var memberNumEl = document.getElementById('memberNum');
    if (memberNumEl) memberNumEl.textContent = FA.members.length + '位成员';

    /* 保存到 localStorage */
    FA.Data.saveData(FA.DB_KEYS.members, FA.members);
};

/* ======================================================================
   3. 性别选择器
   ====================================================================== */
FA._selectGender = function(el) {
    var parent = el.parentNode;
    parent.querySelectorAll('.gender-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    el.classList.add('active');
    parent.dataset.value = el.dataset.value;
};

/* ======================================================================
   4. 编辑成员
   ====================================================================== */
FA._editingIndex = null;
FA._editingSelf = false;

FA.editMember = function(index) {
    var m = FA.members[index];
    if (!m) return;

    /* 权限检查 */
    var isSelf = FA.currentUser && FA.currentUser.username === m.username;
    if (!FA.checkPermission('editMember') && !isSelf) {
        return FA.showToast('权限不足', 'error');
    }

    FA._editingIndex = index;
    FA._editingSelf = isSelf;

    /* 设置验证目标用户: 编辑他人时验证使用对方安全信息 (超管VAL除外) */
    if (!isSelf) {
        FA.Verify.setTargetUser(m.username);
    } else {
        FA.Verify.clearTargetUser();
    }

    /* 确保字段存在 */
    if (!m.documents) m.documents = [];
    if (!m.bankCards) m.bankCards = [];

    var canViewSensitive = isSelf || FA.Verify.canViewSensitive(m.username);
    var canChangeRole = FA.currentUser && FA.currentUser.role === 'superadmin';
    var colors = FA.avatarColors || ['#007AFF'];
    var color = colors[index % colors.length];

    /* 构建实名认证按钮 */
    var verifyStatus = FA.Verify.getVerifyStatus(m.username);
    var verifyHTML;
    if (m.verified || verifyStatus) {
        verifyHTML = '<span class="verified-check" onclick="FA._showVerifyForEdit(\'' + FA._esc(m.username) + '\')">' +
            '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>已实名</span>';
    } else {
        verifyHTML = '<button class="btn-verify" onclick="FA._showVerifyForEdit(\'' + FA._esc(m.username) + '\')">实名认证</button>';
    }

    /* 构建性别选择器 */
    var gender = m.gender || '男';
    var genderTabs = '<div class="gender-tab-selector" id="edit-gender" data-value="' + gender + '">' +
        '<div class="gender-tab' + (gender === '男' ? ' active' : '') + '" data-value="男" onclick="FA._selectGender(this)">男</div>' +
        '<div class="gender-tab' + (gender === '女' ? ' active' : '') + '" data-value="女" onclick="FA._selectGender(this)">女</div>' +
    '</div>';

    /* 构建角色选择器 */
    var roleOptions = Object.keys(FA.roleNames).map(function(key) {
        return '<option value="' + key + '"' + (m.role === key ? ' selected' : '') + '>' + FA.roleNames[key] + '</option>';
    }).join('');
    var roleSelect = '<select id="edit-role"' + (canChangeRole ? '' : ' disabled') + '>' + roleOptions + '</select>';

    /* 构建头像预览 */
    var avatarInner = m.avatar
        ? '<div style="width:100%;height:100%;border-radius:50%;background-image:url(\'' + m.avatar + '\');background-size:cover;background-position:center"></div>'
        : FA._esc((m.nameCn || m.name || '?').charAt(0));
    var avatarStyle = m.avatar ? 'background:transparent' : ('background:' + color);

    /* 构建敏感区域 */
    var idcardAreaHTML = FA._buildIdCardArea(m, canViewSensitive);
    var docsAreaHTML = FA._buildDocsArea(m, canViewSensitive);
    var cardsAreaHTML = FA._buildCardsArea(m, canViewSensitive);

    /* 创建弹窗 */
    var modalId = 'member-edit-modal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;
    modal.innerHTML =
        '<div class="modal-content" style="max-width:680px;max-height:90vh;overflow-y:auto">' +
            '<button class="modal-close" onclick="FA._closeMemberEdit()">&times;</button>' +
            '<div class="modal-header"><h3>编辑成员</h3></div>' +

            /* 头像 + 基本信息 */
            '<div class="edit-top-section">' +
                '<div class="edit-avatar-area">' +
                    '<div class="edit-avatar-preview" id="edit-avatar-preview" style="' + avatarStyle + '" onclick="document.getElementById(\'edit-avatar-input\').click()">' + avatarInner + '</div>' +
                    '<input type="file" id="edit-avatar-input" accept="image/*" style="display:none">' +
                    '<button class="btn-upload-avatar" onclick="document.getElementById(\'edit-avatar-input\').click()">更换头像</button>' +
                '</div>' +
                '<div class="edit-basic-info">' +
                    '<div class="edit-field-row">' +
                        '<div class="modal-field"><label>姓名（英文）</label><input id="edit-name" value="' + FA._esc(m.name) + '"></div>' +
                        '<div class="modal-field"><label>中文名</label><input id="edit-nameCn" value="' + FA._esc(m.nameCn) + '"></div>' +
                        '<div class="verify-btn-area">' + verifyHTML + '</div>' +
                    '</div>' +
                    '<div class="edit-form-grid">' +
                        '<div class="modal-field"><label>性别</label>' + genderTabs + '</div>' +
                        '<div class="modal-field"><label>角色</label>' + roleSelect + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* 联系信息 */
            '<div class="edit-form-grid">' +
                '<div class="modal-field"><label>手机号</label><input id="edit-phone" value="' + FA._esc(m.phone) + '"></div>' +
                '<div class="modal-field"><label>邮箱</label><input id="edit-email" value="' + FA._esc(m.email) + '"></div>' +
            '</div>' +
            '<div class="modal-field"><label>地址</label><input id="edit-address" value="' + FA._esc(m.address) + '" placeholder="请输入地址"></div>' +

            /* 身份证号 */
            '<div class="modal-field"><label>身份证号</label><div id="edit-idcard-area">' + idcardAreaHTML + '</div></div>' +

            /* 附加证件 */
            '<div class="edit-section">' +
                '<div class="edit-section-header"><h4>附加证件</h4><div id="edit-docs-actions"></div></div>' +
                '<div id="edit-docs-container">' + docsAreaHTML + '</div>' +
            '</div>' +

            /* 银行卡 */
            '<div class="edit-section">' +
                '<div class="edit-section-header"><h4>银行卡</h4><div id="edit-cards-actions"></div></div>' +
                '<div id="edit-cards-container">' + cardsAreaHTML + '</div>' +
            '</div>' +

            /* 操作按钮 */
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA._closeMemberEdit()">取消</button>' +
                '<button class="btn-primary" onclick="FA.saveMember(' + index + ')">保存</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    /* 绑定头像上传 */
    var avatarInput = document.getElementById('edit-avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            FA._handleAvatarUpload(this);
        });
    }

    /* 设置添加按钮 */
    FA._refreshDocsActions(canViewSensitive);
    FA._refreshCardsActions(canViewSensitive);

    /* 点击背景关闭 */
    modal.addEventListener('click', function(e) {
        if (e.target === modal) FA._closeMemberEdit();
    });

    FA.showModal(modalId);

    /* 超管编辑他人时, 自动弹出敏感信息验证 (身份证+证件+银行卡均需要验证) */
    if (canViewSensitive && !isSelf && !FA.Verify.isVerified('normal')) {
        setTimeout(function() {
            FA.Verify.requireVerify('编辑成员敏感信息(身份证/证件)', 'normal', function(success) {
                if (success) {
                    /* 身份证/证件已验证, 刷新相关区域 */
                    var idcardArea = document.getElementById('edit-idcard-area');
                    if (idcardArea) idcardArea.innerHTML = FA._buildIdCardArea(m, canViewSensitive);
                    var docsContainer = document.getElementById('edit-docs-container');
                    if (docsContainer) docsContainer.innerHTML = FA._buildDocsArea(m, canViewSensitive);
                    FA._refreshDocsActions(canViewSensitive);
                }
            });
        }, 200);
    }
    if (canViewSensitive && !isSelf && !FA.Verify.isVerified('bank')) {
        setTimeout(function() {
            FA.Verify.requireVerify('编辑成员银行卡信息', 'bank', function(success) {
                if (success) {
                    /* 银行卡已验证, 刷新相关区域 */
                    var cardsContainer = document.getElementById('edit-cards-container');
                    if (cardsContainer) cardsContainer.innerHTML = FA._buildCardsArea(m, canViewSensitive);
                    FA._refreshCardsActions(canViewSensitive);
                }
            });
        }, 800);
    }
};

/* =====================
   实名认证辅助
   ===================== */
FA._showVerifyForEdit = function(username) {
    var verifyStatus = FA.Verify.getVerifyStatus(username);
    FA.Verify.showRealNameVerify(username, verifyStatus);
};

/* 关闭编辑弹窗时清除验证目标用户 */
FA._closeMemberEdit = function() {
    FA.Verify.clearTargetUser();
    FA.closeModal('member-edit-modal');
};

/* =====================
   头像上传处理
   ===================== */
FA._handleAvatarUpload = function(input) {
    var file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        FA.showToast('请选择图片文件', 'error');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            var ctx = canvas.getContext('2d');
            /* 居中裁剪为正方形 */
            var minDim = Math.min(img.width, img.height);
            var sx = (img.width - minDim) / 2;
            var sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 200, 200);
            var compressed = canvas.toDataURL('image/jpeg', 0.85);

            var preview = document.getElementById('edit-avatar-preview');
            if (preview) {
                preview.innerHTML = '<div style="width:100%;height:100%;border-radius:50%;background-image:url(\'' + compressed + '\');background-size:cover;background-position:center"></div>';
                preview.style.background = 'transparent';
                preview.dataset.avatar = compressed;
            }
            FA.showToast('头像已更新', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
};

/* =====================
   敏感区域构建
   ===================== */
FA._buildIdCardArea = function(m, canView) {
    if (!canView) {
        return '<div class="sensitive-locked no-access">🔒 受保护</div>';
    }
    if (FA._editingSelf || FA.Verify.isVerified()) {
        return '<input id="edit-idcard" type="text" value="' + FA._esc(m.idcard) + '" placeholder="请输入身份证号" maxlength="18">';
    }
    return '<div class="sensitive-locked" onclick="FA._revealSensitive()">🔒 点击验证查看</div>';
};

FA._buildDocsArea = function(m, canView) {
    if (!canView) {
        return '<div class="sensitive-locked no-access">🔒 受保护</div>';
    }
    if (FA._editingSelf || FA.Verify.isVerified()) {
        var html = '';
        if (m.documents && m.documents.length > 0) {
            var docTypes = FA.idDocTypes || [];
            m.documents.forEach(function(doc) {
                var options = docTypes.map(function(t) {
                    return '<option value="' + t.key + '"' + (doc.type === t.key ? ' selected' : '') + '>' + t.label + '</option>';
                }).join('');
                html += '<div class="doc-row">' +
                    '<select class="doc-type">' + options + '</select>' +
                    '<input class="doc-value" placeholder="证件号码" value="' + FA._esc(doc.value) + '">' +
                    '<button class="btn-remove-doc" onclick="this.parentElement.remove()">×</button>' +
                '</div>';
            });
        }
        if (!html) html = '<div class="empty-row-msg">暂无附加证件</div>';
        return html;
    }
    return '<div class="sensitive-locked" onclick="FA._revealSensitive()">🔒 点击验证查看</div>';
};

FA._buildCardsArea = function(m, canView) {
    if (!canView) {
        return '<div class="sensitive-locked no-access">🔒 受保护</div>';
    }
    if (FA._editingSelf || FA.Verify.isVerified('bank')) {
        var html = '';
        if (m.bankCards && m.bankCards.length > 0) {
            var cardOrgs = FA.cardOrganizations || [];
            m.bankCards.forEach(function(card) {
                var orgOptions = cardOrgs.map(function(o) {
                    return '<option value="' + o.key + '"' + (card.organization === o.key ? ' selected' : '') + '>' + o.label + '</option>';
                }).join('');
                html += '<div class="card-row">' +
                    '<input class="card-number" placeholder="卡号" value="' + FA._esc(card.number) + '">' +
                    '<input class="card-bank" placeholder="发卡行" value="' + FA._esc(card.bank) + '">' +
                    '<select class="card-org">' + orgOptions + '</select>' +
                    '<input class="card-cvv" type="password" maxlength="4" placeholder="CVV" value="' + FA._esc(card.cvv) + '">' +
                    '<button class="btn-remove-card" onclick="this.parentElement.remove()">×</button>' +
                '</div>';
            });
        }
        if (!html) html = '<div class="empty-row-msg">暂无银行卡</div>';
        return html;
    }
    return '<div class="sensitive-locked" onclick="FA._revealBankCards()">🔒 银行卡信息需要验证</div>';
};

/* =====================
   添加行辅助
   ===================== */
FA._refreshDocsActions = function(canView) {
    var actions = document.getElementById('edit-docs-actions');
    if (!actions) return;
    if (canView && (FA._editingSelf || FA.Verify.isVerified())) {
        actions.innerHTML = '<button class="btn-add-row" onclick="FA._addDocRow()">+ 添加证件</button>';
    } else {
        actions.innerHTML = '';
    }
};

FA._refreshCardsActions = function(canView) {
    var actions = document.getElementById('edit-cards-actions');
    if (!actions) return;
    if (canView && (FA._editingSelf || FA.Verify.isVerified('bank'))) {
        actions.innerHTML = '<button class="btn-add-row" onclick="FA._addCardRow()">+ 添加银行卡</button>';
    } else {
        actions.innerHTML = '';
    }
};

FA._addDocRow = function(doc) {
    var container = document.getElementById('edit-docs-container');
    if (!container) return;

    /* 移除空状态提示 */
    var emptyMsg = container.querySelector('.empty-row-msg');
    if (emptyMsg) emptyMsg.remove();

    var docTypes = FA.idDocTypes || [];
    var options = docTypes.map(function(t) {
        return '<option value="' + t.key + '"' + (doc && doc.type === t.key ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');

    var row = document.createElement('div');
    row.className = 'doc-row';
    row.innerHTML =
        '<select class="doc-type">' + options + '</select>' +
        '<input class="doc-value" placeholder="证件号码" value="' + (doc ? FA._esc(doc.value) : '') + '">' +
        '<button class="btn-remove-doc" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(row);
};

FA._addCardRow = function(card) {
    var container = document.getElementById('edit-cards-container');
    if (!container) return;

    var emptyMsg = container.querySelector('.empty-row-msg');
    if (emptyMsg) emptyMsg.remove();

    var cardOrgs = FA.cardOrganizations || [];
    var orgOptions = cardOrgs.map(function(o) {
        return '<option value="' + o.key + '"' + (card && card.organization === o.key ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var row = document.createElement('div');
    row.className = 'card-row';
    row.innerHTML =
        '<input class="card-number" placeholder="卡号" value="' + (card ? FA._esc(card.number) : '') + '">' +
        '<input class="card-bank" placeholder="发卡行" value="' + (card ? FA._esc(card.bank) : '') + '">' +
        '<select class="card-org">' + orgOptions + '</select>' +
        '<input class="card-cvv" type="password" maxlength="4" placeholder="CVV" value="' + (card ? FA._esc(card.cvv) : '') + '">' +
        '<button class="btn-remove-card" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(row);
};

/* =====================
   敏感信息验证后刷新
   ===================== */
FA._revealSensitive = function() {
    FA.Verify.requireVerify('查看敏感信息', 'normal', function(success) {
        if (success && FA._editingIndex !== null) {
            var m = FA.members[FA._editingIndex];
            var canView = FA.Verify.canViewSensitive(m.username);

            /* 刷新身份证区域 */
            var idcardArea = document.getElementById('edit-idcard-area');
            if (idcardArea) idcardArea.innerHTML = FA._buildIdCardArea(m, canView);

            /* 刷新证件区域 */
            var docsContainer = document.getElementById('edit-docs-container');
            if (docsContainer) docsContainer.innerHTML = FA._buildDocsArea(m, canView);

            FA._refreshDocsActions(canView);
        }
    });
};

FA._revealBankCards = function() {
    FA.Verify.requireVerify('查看银行卡信息', 'bank', function(success) {
        if (success && FA._editingIndex !== null) {
            var m = FA.members[FA._editingIndex];
            var canView = FA.Verify.canViewSensitive(m.username);

            var cardsContainer = document.getElementById('edit-cards-container');
            if (cardsContainer) cardsContainer.innerHTML = FA._buildCardsArea(m, canView);

            FA._refreshCardsActions(canView);
        }
    });
};

/* ======================================================================
   5. 保存编辑成员
   ====================================================================== */
FA.saveMember = function(index) {
    var m = FA.members[index];
    if (!m) return;

    /* 基本字段 */
    m.name = document.getElementById('edit-name').value.trim() || m.name;
    m.nameCn = document.getElementById('edit-nameCn').value.trim() || m.nameCn;

    var genderEl = document.getElementById('edit-gender');
    if (genderEl) m.gender = genderEl.dataset.value || m.gender;

    var roleEl = document.getElementById('edit-role');
    if (roleEl && !roleEl.disabled) m.role = roleEl.value;

    m.phone = document.getElementById('edit-phone').value.trim();
    m.email = document.getElementById('edit-email').value.trim();
    m.address = document.getElementById('edit-address').value.trim();

    /* 头像 */
    var avatarEl = document.getElementById('edit-avatar-preview');
    if (avatarEl && avatarEl.dataset.avatar) {
        m.avatar = avatarEl.dataset.avatar;
    }

    /* 身份证号 (仅在已揭示时保存) */
    var idcardInput = document.getElementById('edit-idcard');
    if (idcardInput) {
        m.idcard = idcardInput.value.trim();
    }

    /* 附加证件 (仅在已揭示时保存) */
    var docsContainer = document.getElementById('edit-docs-container');
    if (docsContainer && !docsContainer.querySelector('.sensitive-locked')) {
        var docs = [];
        docsContainer.querySelectorAll('.doc-row').forEach(function(row) {
            var type = row.querySelector('.doc-type').value;
            var value = row.querySelector('.doc-value').value.trim();
            if (type && value) docs.push({ type: type, value: value });
        });
        m.documents = docs;
    }

    /* 银行卡 (仅在已揭示时保存) */
    var cardsContainer = document.getElementById('edit-cards-container');
    if (cardsContainer && !cardsContainer.querySelector('.sensitive-locked')) {
        var cards = [];
        cardsContainer.querySelectorAll('.card-row').forEach(function(row) {
            var number = row.querySelector('.card-number').value.trim();
            var bank = row.querySelector('.card-bank').value.trim();
            var org = row.querySelector('.card-org').value;
            var cvv = row.querySelector('.card-cvv').value;
            if (number) cards.push({ number: number, bank: bank, organization: org, cvv: cvv });
        });
        m.bankCards = cards;
    }

    FA.Data.saveData(FA.DB_KEYS.members, FA.members);

    /* =====================
       成员-账户联动: 同步基本信息到 FA.accounts
       编辑成员时, 登录账户的 name/nameCn/phone/email/gender/role 同步更新
       ===================== */
    var username = m.username;
    var acc = FA.accounts[username];
    if (acc) {
        var changes = [];
        if (acc.name !== m.name) { changes.push({field:'name', oldValue:acc.name, newValue:m.name}); acc.name = m.name; }
        if (acc.nameCn !== m.nameCn) { changes.push({field:'nameCn', oldValue:acc.nameCn, newValue:m.nameCn}); acc.nameCn = m.nameCn; }
        if (acc.phone !== m.phone) { changes.push({field:'phone', oldValue:acc.phone, newValue:m.phone}); acc.phone = m.phone; }
        if ((acc.email || '') !== (m.email || '')) { changes.push({field:'email', oldValue:acc.email||'', newValue:m.email||''}); acc.email = m.email || ''; }
        if ((acc.gender || '') !== (m.gender || '')) { changes.push({field:'gender', oldValue:acc.gender||'', newValue:m.gender||''}); acc.gender = m.gender || ''; }
        if (acc.role !== m.role) { changes.push({field:'role', oldValue:acc.role, newValue:m.role}); acc.role = m.role; }

        /* 持久化账户到 localStorage */
        FA.Data.saveAccounts();

        /* 同步头像到 localStorage */
        if (m.avatar) {
            localStorage.setItem('fi_avatar_' + username, m.avatar);
        }

        /* 如果是当前用户, 更新 FA.currentUser 和 UI */
        if (FA.currentUser && FA.currentUser.username === username) {
            FA.currentUser.name = acc.name;
            FA.currentUser.nameCn = acc.nameCn;
            FA.currentUser.role = acc.role;
            FA.currentUser.phone = acc.phone;
            FA.currentUser.email = acc.email;
            FA.currentUser.gender = acc.gender;
            if (FA.Auth && FA.Auth.updateUserUI) FA.Auth.updateUserUI();
            FA.applyPermissions();
            if (FA.renderPermissions) FA.renderPermissions();
        }

        /* 记录信息变更通知 (5分钟延迟 + 批量合并) */
        if (changes.length > 0 && FA.Data.recordInfoChange) {
            FA.Data.recordInfoChange(username, changes);
        }

        /* 记录操作日志 */
        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('edit_member', '修改成员信息: ' + (m.nameCn || m.name));
        }
    }

    FA.renderMembers();
    FA._closeMemberEdit();
    FA.showToast('成员信息已保存', 'success');
};

/* ======================================================================
   6. 删除成员
   ====================================================================== */
FA.deleteMember = function(index) {
    if (!FA.checkPermission('deleteMember')) {
        return FA.showToast('权限不足', 'error');
    }
    var m = FA.members[index];
    if (!m) return;
    if (!confirm('确定删除 ' + (m.nameCn || m.name) + '？')) return;

    /* 成员-账户联动: 同时删除登录账户 */
    if (m.username && FA.accounts[m.username]) {
        delete FA.accounts[m.username];
        FA.Data.saveAccounts();
        /* 标记为已删除, 防止云同步拉取后复活 */
        FA.Data.markDeletedUsername(m.username);
        localStorage.removeItem('fi_avatar_' + m.username);
    }

    FA.members.splice(index, 1);
    FA.Data.saveData(FA.DB_KEYS.members, FA.members);
    FA.renderMembers();

    if (FA.Data.recordOpLog) {
        FA.Data.recordOpLog('delete_member', '删除成员: ' + (m.nameCn || m.name));
    }

    FA.showToast('成员已删除', 'info');
};

/* ======================================================================
   7. 添加新成员
   ====================================================================== */
FA.setupAddMemberModal = function() {
    var modal = document.getElementById('add-member-modal');
    if (!modal) return;

    var content = modal.querySelector('.modal-content');
    if (!content) return;

    var roleOptions = Object.keys(FA.roleNames).map(function(key) {
        return '<option value="' + key + '">' + FA.roleNames[key] + '</option>';
    }).join('');

    content.innerHTML =
        '<button class="modal-close" onclick="FA.closeModal(\'add-member-modal\')">&times;</button>' +
        '<div class="modal-header"><h3>添加家庭成员</h3></div>' +
        '<div class="modal-field"><label>姓名（英文）</label><input id="memberName" placeholder="请输入英文姓名"></div>' +
        '<div class="modal-field"><label>中文名</label><input id="memberNameCn" placeholder="请输入中文姓名"></div>' +
        '<div class="modal-field"><label>性别</label>' +
            '<div class="gender-tab-selector" id="newMemberGender" data-value="男">' +
                '<div class="gender-tab active" data-value="男" onclick="FA._selectGender(this)">男</div>' +
                '<div class="gender-tab" data-value="女" onclick="FA._selectGender(this)">女</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal-field"><label>手机号</label><input id="memberPhone" placeholder="请输入手机号"></div>' +
        '<div class="modal-field"><label>角色</label><select id="memberRole">' + roleOptions + '</select></div>' +
        '<div class="modal-actions">' +
            '<button class="btn-secondary" onclick="FA.closeModal(\'add-member-modal\')">取消</button>' +
            '<button class="btn-primary" onclick="FA.saveMemberNew()">添加</button>' +
        '</div>';
};

FA.saveMemberNew = function() {
    var name = document.getElementById('memberName').value.trim();
    if (!name) return FA.showToast('请输入姓名', 'error');

    var nameCn = document.getElementById('memberNameCn').value.trim();
    var phone = document.getElementById('memberPhone').value.trim() || '未填写';
    var role = document.getElementById('memberRole').value;
    var genderEl = document.getElementById('newMemberGender');
    var gender = (genderEl && genderEl.dataset.value) || '男';

    /* 生成用户名: 英文姓名小写去空格 */
    var username = name.toLowerCase().replace(/\s/g, '');

    /* 检查用户名是否已存在 */
    if (FA.accounts[username]) {
        return FA.showToast('用户名 ' + username + ' 已存在，请使用其他姓名', 'error');
    }

    FA.members.push({
        name: name,
        nameCn: nameCn || name,
        role: role,
        phone: phone,
        gender: gender,
        username: username,
        email: '',
        verified: false,
        documents: [],
        bankCards: []
    });

    /* 成员-账户联动: 创建对应的登录账户 */
    FA.accounts[username] = {
        password: phone,  /* 默认密码 = 手机号, 首次登录后应修改 */
        role: role,
        name: name,
        nameCn: nameCn || name,
        phone: phone,
        email: '',
        gender: gender,
        securityQuestions: [ { question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' } ]
    };
    FA.Data.saveAccounts();
    /* 重新添加曾删除的同名账号: 从已删除集合中移除 */
    FA.Data.unmarkDeletedUsername(username);

    FA.Data.saveData(FA.DB_KEYS.members, FA.members);
    FA.renderMembers();
    FA.closeModal('add-member-modal');

    /* 清空输入 */
    document.getElementById('memberName').value = '';
    var nameCnEl = document.getElementById('memberNameCn');
    if (nameCnEl) nameCnEl.value = '';
    document.getElementById('memberPhone').value = '';

    FA.Data.addNotification('success', '成员添加', (nameCn || name) + ' 已添加到家庭成员');
    FA.showToast('成员添加成功', 'success');
};

/* =====================
   超级管理员修改成员密码 (需敏感信息验证框)
   ===================== */
FA.changeMemberPassword = function(index) {
    var m = FA.members[index];
    if (!m) return;
    if (!FA.currentUser || FA.currentUser.role !== 'superadmin') {
        return FA.showToast('仅超级管理员可修改成员密码', 'error');
    }

    /* 验证使用超级管理员自身身份 (清空可能残留的目标用户) */
    FA.Verify.clearTargetUser();

    /* 弹出敏感信息验证框, 强制显示「超级管理员密码+VAL」方式 */
    FA.Verify.requireVerify('修改成员「' + (m.nameCn || m.name) + '」的密码', 'normal', function(success) {
        if (!success) return;
        FA._openSetMemberPasswordModal(m.username, m.nameCn || m.name);
    }, { requireAdmin: true });
};

FA._openSetMemberPasswordModal = function(username, nameCn) {
    var modalId = 'set-member-password-modal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;
    modal.style.zIndex = '3000';
    modal.innerHTML =
        '<div class="modal-content" style="max-width:420px">' +
            '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
            '<div class="modal-header"><h3>修改成员密码</h3></div>' +
            '<p style="font-size:13px;color:#888;margin-bottom:14px">为「' + FA._esc(nameCn) + '」设置新密码（至少 6 位）</p>' +
            '<div class="modal-field"><label>新密码</label><input id="newMemberPassword" type="password" placeholder="请输入新密码"></div>' +
            '<div class="modal-field"><label>确认密码</label><input id="confirmMemberPassword" type="password" placeholder="请再次输入"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                '<button class="btn-primary" onclick="FA._doChangeMemberPassword(\'' + FA._esc(username) + '\')">确认</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    FA.showModal(modalId);
};

FA._doChangeMemberPassword = function(username) {
    var acc = FA.accounts[username];
    if (!acc) return FA.showToast('账户不存在', 'error');

    var newPass = document.getElementById('newMemberPassword').value;
    var confirmPass = document.getElementById('confirmMemberPassword').value;
    if (!newPass) return FA.showToast('请输入新密码', 'error');
    if (newPass !== confirmPass) return FA.showToast('两次密码不一致', 'error');
    if (newPass.length < 6) return FA.showToast('密码长度至少 6 位', 'error');

    acc.password = newPass;
    FA.Data.saveAccounts();

    /* 使该成员的当前活跃会话失效, 强制下次使用新密码登录 (单点登录) */
    var sessions = FA.getActiveSessions();
    if (sessions[username]) {
        delete sessions[username];
        FA.setActiveSessions(sessions);
    }

    FA.closeModal('set-member-password-modal');
    FA.showToast('「' + (acc.nameCn || username) + '」的密码已修改', 'success');
    if (FA.Data.recordOpLog) {
        FA.Data.recordOpLog('admin_change_password', '超级管理员修改成员密码: ' + username);
    }
};

/* =====================
   初始化
   ===================== */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        FA.setupAddMemberModal();
    });
} else {
    FA.setupAddMemberModal();
}
