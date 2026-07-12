/* ======================================================================
   dashboard.js - 首页卡片、待办事项、设备控制、通知、布局拖拽
   ====================================================================== */

window.FA = window.FA || {};

FA.layoutEditMode = false;

/* =====================
   1. 首页摘要卡片
   ===================== */
FA.renderHomeSummary = function() {
    /* 家庭日程卡片 (前3条) */
    var scheduleEl = document.getElementById('homeScheduleList');
    if (scheduleEl) {
        scheduleEl.innerHTML = FA.events.slice(0, 3).map(function(e) {
            return '<div style="margin-bottom:8px"><strong>' + e.date + ' ' + (e.time || '') + '</strong> - ' + e.title + '</div>';
        }).join('') || '<p style="color:#999">暂无日程</p>';
    }
    var scheduleNum = document.getElementById('scheduleNum');
    if (scheduleNum) scheduleNum.textContent = FA.events.length + '个日程';

    /* 设备状态卡片 (前3条) */
    var deviceEl = document.getElementById('homeDeviceSummary');
    if (deviceEl) {
        deviceEl.innerHTML = FA.devices.slice(0, 3).map(function(d) {
            return '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                '<span>' + d.name + '</span>' +
                '<span class="device-status ' + (d.on ? '' : 'off') + '">' + (d.on ? '开启' : '关闭') + '</span>' +
            '</div>';
        }).join('') || '<p style="color:#999">暂无设备</p>';
    }
    var onCount = FA.devices.filter(function(d) { return d.on; }).length;
    var deviceStatusText = document.getElementById('deviceStatusText');
    if (deviceStatusText) deviceStatusText.textContent = onCount + '/' + FA.devices.length + ' 已开启';

    /* 家庭成员卡片 (前3条) */
    var memberEl = document.getElementById('homeMemberList');
    if (memberEl) {
        memberEl.innerHTML = FA.members.slice(0, 3).map(function(m) {
            return '<div style="margin-bottom:6px">' + (m.nameCn || m.name) + ' (' + FA.getRoleName(m.role) + ')</div>';
        }).join('') || '<p style="color:#999">暂无成员</p>';
    }
    var memberNum = document.getElementById('memberNum');
    if (memberNum) memberNum.textContent = FA.members.length + '位成员';

    /* 近期消息卡片 (前3条) */
    var notifEl = document.getElementById('homeNotifList');
    if (notifEl) {
        notifEl.innerHTML = FA.notifications.slice(0, 3).map(function(n) {
            return '<div style="margin-bottom:8px"><strong>' + n.title + '</strong></div>' +
                   '<div style="margin-bottom:8px;color:#888">' + n.content + '</div>';
        }).join('') || '<p style="color:#999">暂无通知</p>';
    }

    FA.updateNetworkStatus();
};

/* =====================
   2. 待办事项
   ===================== */
FA.renderTodos = function() {
    var ul = document.getElementById('todoList');
    if (!ul) return;
    ul.innerHTML = FA.todos.map(function(t, i) {
        return '<li class="todo-item ' + (t.done ? 'done' : '') + '">' +
            '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' onchange="FA.toggleTodo(' + i + ')">' +
            '<span>' + t.text + '</span>' +
            '<button class="delete-todo" onclick="FA.deleteTodo(' + i + ')">&times;</button>' +
        '</li>';
    }).join('') || '<p style="color:#999;font-size:14px;padding:8px 0">暂无待办事项</p>';
    if (FA.updateStats) FA.updateStats();
    FA.Data.saveData(FA.DB_KEYS.todos, FA.todos);
};

FA.addTodo = function() {
    var input = document.getElementById('todoInput');
    if (!input || !input.value.trim()) return;
    FA.todos.push({ text: input.value.trim(), done: false });
    input.value = '';
    FA.renderTodos();
};

FA.toggleTodo = function(index) {
    FA.todos[index].done = !FA.todos[index].done;
    FA.renderTodos();
};

FA.deleteTodo = function(index) {
    FA.todos.splice(index, 1);
    FA.renderTodos();
};

/* =====================
   3. 设备控制
   ===================== */
FA.renderDevices = function() {
    var grid = document.getElementById('deviceGrid');
    var canToggle = FA.checkPermission('toggleDevice');

    if (grid) {
        grid.innerHTML = FA.devices.map(function(d) {
            var icon = FA.getDeviceIcon(d.type);
            return '<div class="device-item">' +
                '<div class="device-header">' +
                    '<h4>' + icon + ' ' + d.name + '</h4>' +
                    (canToggle ? '<label class="toggle-switch">' +
                        '<input type="checkbox" ' + (d.on ? 'checked' : '') + ' onchange="FA.toggleDevice(' + d.id + ', this.checked)">' +
                        '<span class="toggle-slider"></span>' +
                    '</label>' : '') +
                '</div>' +
                '<div class="device-location">📍 ' + d.location + '</div>' +
                '<div class="device-status ' + (d.on ? '' : 'off') + '">' + (d.on ? '● 已开启' : '○ 已关闭') + '</div>' +
            '</div>';
        }).join('') || '<div class="empty-state"><div class="empty-icon">🔌</div><p>暂无设备</p></div>';
    }

    /* 同步首页设备摘要 */
    var homeSummary = document.getElementById('homeDeviceSummary');
    if (homeSummary) {
        homeSummary.innerHTML = FA.devices.slice(0, 3).map(function(d) {
            return '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                '<span>' + d.name + '</span>' +
                '<span class="device-status ' + (d.on ? '' : 'off') + '">' + (d.on ? '开启' : '关闭') + '</span>' +
            '</div>';
        }).join('') || '<p style="color:#999">暂无设备</p>';
    }
    var onCount = FA.devices.filter(function(d) { return d.on; }).length;
    var deviceStatusText = document.getElementById('deviceStatusText');
    if (deviceStatusText) deviceStatusText.textContent = onCount + '/' + FA.devices.length + ' 已开启';

    FA.Data.saveData(FA.DB_KEYS.devices, FA.devices);
};

FA.saveDevice = function() {
    if (!FA.checkPermission('addDevice')) return FA.showToast('权限不足', 'error');
    var name = document.getElementById('deviceName').value.trim();
    if (!name) return FA.showToast('请输入设备名称', 'error');
    FA.devices.push({
        id: Date.now(),
        name: name,
        location: document.getElementById('deviceLocation').value || '未指定',
        type: document.getElementById('deviceType').value,
        on: false
    });
    FA.renderDevices();
    FA.closeModal('add-device-modal');
    document.getElementById('deviceName').value = '';
    document.getElementById('deviceLocation').value = '';
    FA.Data.addNotification('info', '设备添加', name + ' 已添加到设备列表');
    FA.showToast('设备添加成功', 'success');
};

FA.toggleDevice = function(id, status) {
    if (!FA.checkPermission('toggleDevice')) return FA.showToast('权限不足', 'error');
    var device = FA.devices.find(function(d) { return d.id === id; });
    if (device) device.on = status;
    FA.renderDevices();
};

FA.getDeviceIcon = function(type) {
    var icons = { '灯光': '💡', '空调': '❄️', '电视': '📺', '音响': '🔊', '其他': '📱' };
    return icons[type] || '📱';
};

/* =====================
   4. 通知
   ===================== */
FA.renderNotifications = function() {
    var list = document.getElementById('notificationList');
    var homeList = document.getElementById('homeNotifList');
    var icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

    if (list) {
        list.innerHTML = FA.notifications.map(function(n, i) {
            return '<li class="notification-item ' + (n.read ? '' : 'unread') + '" onclick="FA.markAsRead(' + i + ')">' +
                '<div class="notification-icon ' + n.type + '">' + (icons[n.type] || 'ℹ️') + '</div>' +
                '<div class="notification-body">' +
                    '<h4>' + n.title + '</h4>' +
                    '<p>' + n.content + '</p>' +
                    '<span class="notification-time">' + FA.formatTime(n.time) + '</span>' +
                '</div>' +
                (n.read ? '' : '<div class="notification-unread-dot"></div>') +
            '</li>';
        }).join('') || '<div class="empty-state"><div class="empty-icon">🔔</div><p>暂无通知</p></div>';
    }

    /* 同步首页通知摘要 */
    if (homeList) {
        homeList.innerHTML = FA.notifications.slice(0, 3).map(function(n) {
            return '<div style="margin-bottom:8px"><strong>' + n.title + '</strong></div>' +
                   '<div style="margin-bottom:8px;color:#888">' + n.content + '</div>';
        }).join('') || '<p style="color:#999">暂无通知</p>';
    }

    if (FA.updateStats) FA.updateStats();
    FA.Data.saveData(FA.DB_KEYS.notifications, FA.notifications);
};

FA.markAsRead = function(index) {
    FA.notifications[index].read = true;
    FA.renderNotifications();
};

FA.markAllRead = function() {
    FA.notifications.forEach(function(n) { n.read = true; });
    FA.renderNotifications();
    FA.showToast('全部已标记为已读', 'success');
};

FA.clearNotifications = function() {
    if (!FA.checkPermission('manageNotifications')) return FA.showToast('权限不足', 'error');
    if (!confirm('确定清空所有通知？')) return;
    FA.notifications = [];
    FA.renderNotifications();
    FA.showToast('通知已清空', 'info');
};

/* =====================
   5. 仪表盘布局拖拽
   ===================== */
FA.initDashboardLayout = function() {
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    /* 注入布局编辑样式 */
    if (!document.getElementById('dashboardLayoutStyles')) {
        var style = document.createElement('style');
        style.id = 'dashboardLayoutStyles';
        style.textContent =
            '.dashboard-layout-bar { background:#007AFF; color:white; padding:10px 16px; border-radius:10px; margin-bottom:12px; font-size:13px; display:flex; justify-content:space-between; align-items:center; }' +
            '.card-grid.layout-editing [data-card-id] { cursor:move; position:relative; }' +
            '.card-grid.layout-editing .dragging { opacity:0.4; transform:scale(0.98); }' +
            '.card-delete-btn { position:absolute; top:8px; right:8px; width:24px; height:24px; border-radius:50%; background:#ff453a; color:white; border:none; font-size:16px; cursor:pointer; z-index:100; display:flex; align-items:center; justify-content:center; line-height:1; padding:0; }' +
            '.card-delete-btn:hover { background:#d63525; }' +
            '.card-grid .todo-card { max-width:none; }' +
            '.settings-tabs { display:flex; gap:0; margin-bottom:24px; border-bottom:2px solid rgba(0,0,0,0.06); }' +
            '.settings-tab { padding:12px 24px; cursor:pointer; font-size:14px; font-weight:500; color:#888; transition:all 0.2s; }' +
            '.settings-tab:hover { color:#555; }' +
            '.settings-tab.active { color:#007AFF; font-weight:600; border-bottom:2px solid #007AFF; margin-bottom:-2px; }';
        document.head.appendChild(style);
    }

    /* 为每张卡片添加 data-card-id */
    var cardMap = {
        'homeScheduleList': 'schedule',
        'homeDeviceSummary': 'devices',
        'homeMemberList': 'members',
        'homeNotifList': 'notifications'
    };

    cardGrid.querySelectorAll('.card').forEach(function(card) {
        if (card.getAttribute('data-card-id')) return;
        for (var contentId in cardMap) {
            if (card.querySelector('#' + contentId)) {
                card.setAttribute('data-card-id', cardMap[contentId]);
                break;
            }
        }
    });

    /* 将待办卡片移入 card-grid */
    var todoCard = document.querySelector('.todo-card');
    if (todoCard && !todoCard.getAttribute('data-card-id')) {
        todoCard.setAttribute('data-card-id', 'todo');
        if (todoCard.parentElement !== cardGrid) {
            cardGrid.appendChild(todoCard);
        }
    }

    /* 按保存的顺序排列卡片 */
    FA.applyLayoutOrder();

    /* 添加编辑按钮 (有 editLayout 权限时可见) */
    if (!document.getElementById('layoutEditBtn')) {
        var toolbar = document.createElement('div');
        toolbar.id = 'layoutToolbar';
        toolbar.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';

        var editBtn = document.createElement('button');
        editBtn.id = 'layoutEditBtn';
        editBtn.className = 'toolbar-btn';
        editBtn.textContent = '✏️ 编辑布局';
        editBtn.setAttribute('data-permission', 'editLayout');
        editBtn.style.display = 'none';
        editBtn.onclick = function() { FA.toggleLayoutEditMode(); };

        toolbar.appendChild(editBtn);
        cardGrid.parentElement.insertBefore(toolbar, cardGrid);
    }

    /* 设置拖拽 */
    FA.setupDashboardDrag();
};

FA.applyLayoutOrder = function() {
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    /* 按布局顺序重新排列可见卡片 */
    FA.dashboardLayout.forEach(function(cardId) {
        var card = cardGrid.querySelector('[data-card-id="' + cardId + '"]');
        if (card) {
            card.style.display = '';
            cardGrid.appendChild(card);
        }
    });

    /* 隐藏不在布局中的卡片 */
    cardGrid.querySelectorAll('[data-card-id]').forEach(function(card) {
        var cardId = card.getAttribute('data-card-id');
        if (FA.dashboardLayout.indexOf(cardId) === -1) {
            card.style.display = 'none';
        }
    });
};

FA.toggleLayoutEditMode = function() {
    FA.layoutEditMode = !FA.layoutEditMode;
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    var toolbar = document.getElementById('layoutToolbar');

    if (FA.layoutEditMode) {
        /* 进入编辑模式 */
        cardGrid.classList.add('layout-editing');

        /* 显示蓝色提示栏 */
        var hintBar = document.createElement('div');
        hintBar.id = 'layoutHintBar';
        hintBar.className = 'dashboard-layout-bar';
        hintBar.innerHTML = '<span>长按拖动卡片重新排列，点击红叉删除卡片</span>';

        var doneBtn = document.createElement('button');
        doneBtn.className = 'btn-primary';
        doneBtn.textContent = '完成';
        doneBtn.style.cssText = 'padding:6px 16px;font-size:13px;';
        doneBtn.onclick = function() { FA.saveLayout(); };

        hintBar.appendChild(doneBtn);
        cardGrid.parentElement.insertBefore(hintBar, cardGrid);

        /* 隐藏编辑按钮 */
        if (toolbar) toolbar.style.display = 'none';

        /* 为每张可见卡片添加拖拽和删除按钮 */
        cardGrid.querySelectorAll('[data-card-id]').forEach(function(card) {
            var cardId = card.getAttribute('data-card-id');
            if (FA.dashboardLayout.indexOf(cardId) === -1) return;

            card.setAttribute('draggable', 'true');

            var deleteBtn = document.createElement('button');
            deleteBtn.className = 'card-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.onclick = function(e) { e.stopPropagation(); FA.removeCard(cardId); };
            card.appendChild(deleteBtn);
        });

    } else {
        FA.exitLayoutEditMode();
    }
};

FA.exitLayoutEditMode = function() {
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    cardGrid.classList.remove('layout-editing');

    /* 移除提示栏 */
    var hintBar = document.getElementById('layoutHintBar');
    if (hintBar) hintBar.remove();

    /* 恢复编辑按钮 */
    var toolbar = document.getElementById('layoutToolbar');
    if (toolbar) toolbar.style.display = 'flex';

    /* 移除拖拽属性和删除按钮 */
    cardGrid.querySelectorAll('[data-card-id]').forEach(function(card) {
        card.removeAttribute('draggable');
        var deleteBtn = card.querySelector('.card-delete-btn');
        if (deleteBtn) deleteBtn.remove();
    });

    FA.layoutEditMode = false;
};

FA.saveLayout = function() {
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    /* 从 DOM 顺序读取新布局 */
    var newLayout = [];
    cardGrid.querySelectorAll('[data-card-id]').forEach(function(card) {
        if (card.style.display !== 'none') {
            newLayout.push(card.getAttribute('data-card-id'));
        }
    });

    FA.dashboardLayout = newLayout;
    FA.Data.saveData(FA.DB_KEYS.layout, FA.dashboardLayout);

    FA.exitLayoutEditMode();
    FA.showToast('布局已保存', 'success');
};

FA.removeCard = function(cardId) {
    var index = FA.dashboardLayout.indexOf(cardId);
    if (index > -1) {
        FA.dashboardLayout.splice(index, 1);
    }

    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (cardGrid) {
        var card = cardGrid.querySelector('[data-card-id="' + cardId + '"]');
        if (card) {
            card.style.display = 'none';
            card.removeAttribute('draggable');
            var deleteBtn = card.querySelector('.card-delete-btn');
            if (deleteBtn) deleteBtn.remove();
        }
    }

    if (FA.dashboardLayout.length === 0) {
        FA.showToast('所有卡片已隐藏，点击"完成"保存', 'info');
    }
};

FA.setupDashboardDrag = function() {
    var cardGrid = document.querySelector('#welcome-section .card-grid');
    if (!cardGrid) return;

    var dragSrc = null;
    var dragOverCard = null;
    var dragPosition = null;

    cardGrid.addEventListener('dragstart', function(e) {
        if (!FA.layoutEditMode) return;
        var card = e.target.closest('[data-card-id]');
        if (!card || card.style.display === 'none') return;

        dragSrc = card;
        setTimeout(function() { card.classList.add('dragging'); }, 0);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-card-id'));
    });

    cardGrid.addEventListener('dragover', function(e) {
        if (!FA.layoutEditMode || !dragSrc) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        var card = e.target.closest('[data-card-id]');
        if (!card || card === dragSrc || card.style.display === 'none') return;

        dragOverCard = card;

        var rect = card.getBoundingClientRect();
        var midpoint = rect.left + rect.width / 2;
        dragPosition = e.clientX < midpoint ? 'before' : 'after';
    });

    cardGrid.addEventListener('drop', function(e) {
        if (!FA.layoutEditMode || !dragSrc) return;
        e.preventDefault();
        e.stopPropagation();

        if (dragOverCard && dragSrc !== dragOverCard) {
            if (dragPosition === 'before') {
                cardGrid.insertBefore(dragSrc, dragOverCard);
            } else {
                cardGrid.insertBefore(dragSrc, dragOverCard.nextSibling);
            }
        }

        if (dragSrc) {
            dragSrc.classList.remove('dragging');
            dragSrc = null;
        }
        dragOverCard = null;
        dragPosition = null;
    });

    cardGrid.addEventListener('dragend', function() {
        if (dragSrc) {
            dragSrc.classList.remove('dragging');
            dragSrc = null;
        }
        dragOverCard = null;
        dragPosition = null;
    });
};

/* =====================
   6. 网络状态指示器
   ===================== */
FA.updateNetworkStatus = function() {
    var indicator = document.getElementById('networkStatus');
    var icon = document.getElementById('networkIcon');
    if (!indicator || !icon) return;

    if (navigator.onLine) {
        indicator.className = 'network-status online';
        icon.innerHTML = '●';
        indicator.title = '网络正常';
    } else {
        indicator.className = 'network-status offline';
        icon.innerHTML = '●';
        indicator.title = '网络异常';
    }

    /* Also check and update VAL service status in settings */
    var valService = document.getElementById('valServiceStatus');
    if (valService) {
        if (navigator.onLine) {
            valService.textContent = '在线';
            valService.style.color = '#28a745';
        } else {
            valService.textContent = '离线';
            valService.style.color = '#e74c3c';
        }
    }
};

FA.onNetworkRestore = function() {
    FA.updateNetworkStatus();
    /* Update VAL service status to online */
    var valStatus = document.getElementById('valServiceStatus');
    if (valStatus) {
        valStatus.textContent = '在线';
        valStatus.style.color = '#28a745';
    }
};

FA.onNetworkOffline = function() {
    FA.updateNetworkStatus();
    /* Update VAL service status to offline */
    var valStatus = document.getElementById('valServiceStatus');
    if (valStatus) {
        valStatus.textContent = '离线';
        valStatus.style.color = '#e74c3c';
    }
    /* Add notification */
    FA.Data.addNotification('error', '系统已离线', '请检查网络设置。VAL服务已同步为离线状态。');
};
