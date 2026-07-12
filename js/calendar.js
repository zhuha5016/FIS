/* ======================================================================
   calendar.js - 家庭日历、日程管理、节假日/节气
   修复: calendarBody → calendarContent ID匹配
   新增: 星期表头、日历表格美化
   ====================================================================== */

window.FA = window.FA || {};

/* =====================
   日历状态
   ===================== */
FA._calYear = FA._calYear || new Date().getFullYear();
FA._calMonth = FA._calMonth !== undefined ? FA._calMonth : new Date().getMonth();
FA._calView = FA._calView || 'month';
FA._selectedDate = FA._selectedDate || (FA.getTodayStr ? FA.getTodayStr() : '');
FA._calendarUIInit = false;

/* =====================
   节气数据 (近似日期，每年偏差1-2天)
   ===================== */
FA._solarTermData = [
    { month: 1,  day: 6,  name: '小寒' },
    { month: 1,  day: 20, name: '大寒' },
    { month: 2,  day: 4,  name: '立春' },
    { month: 2,  day: 19, name: '雨水' },
    { month: 3,  day: 6,  name: '惊蛰' },
    { month: 3,  day: 20, name: '春分' },
    { month: 4,  day: 5,  name: '清明' },
    { month: 4,  day: 20, name: '谷雨' },
    { month: 5,  day: 6,  name: '立夏' },
    { month: 5,  day: 21, name: '小满' },
    { month: 6,  day: 6,  name: '芒种' },
    { month: 6,  day: 21, name: '夏至' },
    { month: 7,  day: 7,  name: '小暑' },
    { month: 7,  day: 23, name: '大暑' },
    { month: 8,  day: 8,  name: '立秋' },
    { month: 8,  day: 23, name: '处暑' },
    { month: 9,  day: 8,  name: '白露' },
    { month: 9,  day: 23, name: '秋分' },
    { month: 10, day: 8,  name: '寒露' },
    { month: 10, day: 23, name: '霜降' },
    { month: 11, day: 7,  name: '立冬' },
    { month: 11, day: 22, name: '小雪' },
    { month: 12, day: 7,  name: '大雪' },
    { month: 12, day: 22, name: '冬至' }
];

/* 农历节日近似日期 (春节/端午/中秋) */
FA._lunarHolidayData = {
    2023: { springFestival: '01-22', dragonBoat: '06-22', midAutumn: '09-29' },
    2024: { springFestival: '02-10', dragonBoat: '06-10', midAutumn: '09-17' },
    2025: { springFestival: '01-29', dragonBoat: '05-31', midAutumn: '10-06' },
    2026: { springFestival: '02-17', dragonBoat: '06-19', midAutumn: '09-25' },
    2027: { springFestival: '02-06', dragonBoat: '06-09', midAutumn: '09-15' },
    2028: { springFestival: '01-26', dragonBoat: '05-28', midAutumn: '10-03' },
    2029: { springFestival: '02-13', dragonBoat: '06-16', midAutumn: '09-22' },
    2030: { springFestival: '02-03', dragonBoat: '06-05', midAutumn: '09-12' }
};

/* 固定日期节日 */
FA._fixedHolidays = [
    { month: 1,  day: 1,  name: '元旦' },
    { month: 2,  day: 14, name: '情人节' },
    { month: 3,  day: 8,  name: '妇女节' },
    { month: 3,  day: 12, name: '植树节' },
    { month: 4,  day: 4,  name: '清明节' },
    { month: 4,  day: 5,  name: '清明节' },
    { month: 4,  day: 6,  name: '清明节' },
    { month: 5,  day: 1,  name: '劳动节' },
    { month: 5,  day: 4,  name: '青年节' },
    { month: 6,  day: 1,  name: '儿童节' },
    { month: 7,  day: 1,  name: '建党节' },
    { month: 7,  day: 1,  name: '香港回归纪念日' },
    { month: 8,  day: 1,  name: '建军节' },
    { month: 9,  day: 10, name: '教师节' },
    { month: 10, day: 1,  name: '国庆节' },
    { month: 10, day: 2,  name: '国庆节' },
    { month: 10, day: 3,  name: '国庆节' },
    { month: 10, day: 4,  name: '国庆节' },
    { month: 10, day: 5,  name: '国庆节' },
    { month: 10, day: 6,  name: '国庆节' },
    { month: 10, day: 7,  name: '国庆节' },
    { month: 12, day: 25, name: '圣诞节' }
];

/* =====================
   获取节假日/节气数据
   ===================== */
FA.getHolidays = function(year, month) {
    var result = {};
    var pad = function(n) { return String(n).padStart(2, '0'); };
    var key = function(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); };

    /* 1. 节气 */
    FA._solarTermData.forEach(function(term) {
        if (term.month === month) {
            result[key(year, month, term.day)] = { name: term.name, type: 'solar-term' };
        }
    });

    /* 2. 固定节日 */
    FA._fixedHolidays.forEach(function(hol) {
        if (hol.month === month) {
            result[key(year, month, hol.day)] = { name: hol.name, type: 'holiday' };
        }
    });

    /* 3. 农历节日 */
    var lunar = FA._lunarHolidayData[year];
    if (lunar) {
        var springParts = lunar.springFestival.split('-');
        var springMonth = parseInt(springParts[0]);
        var springDay = parseInt(springParts[1]);
        if (springMonth === month) {
            for (var d = springDay; d <= springDay + 6; d++) {
                var date = new Date(year, springMonth - 1, d);
                var actualYear = date.getFullYear();
                var actualMonth = date.getMonth() + 1;
                var actualDay = date.getDate();
                if (actualMonth === month) {
                    var label = (d === springDay) ? '春节' : '春节假期';
                    result[key(actualYear, actualMonth, actualDay)] = { name: label, type: 'holiday' };
                }
            }
        }

        var dragonParts = lunar.dragonBoat.split('-');
        var dragonMonth = parseInt(dragonParts[0]);
        var dragonDay = parseInt(dragonParts[1]);
        if (dragonMonth === month) {
            result[key(year, dragonMonth, dragonDay)] = { name: '端午节', type: 'holiday' };
        }

        var midParts = lunar.midAutumn.split('-');
        var midMonth = parseInt(midParts[0]);
        var midDay = parseInt(midParts[1]);
        if (midMonth === month) {
            result[key(year, midMonth, midDay)] = { name: '中秋节', type: 'holiday' };
        }
    }

    /* 4. 家庭成员生日 */
    if (FA.members) {
        FA.members.forEach(function(m) {
            if (m.birthday) {
                var parts = m.birthday.split('-');
                if (parts.length >= 3) {
                    var bMonth = parseInt(parts[1]);
                    var bDay = parseInt(parts[2]);
                    if (bMonth === month) {
                        var name = (m.nameCn || m.name || '') + '生日';
                        result[key(year, bMonth, bDay)] = { name: name, type: 'birthday' };
                    }
                }
            }
        });
    }

    return result;
};

/* =====================
   日历UI初始化
   ===================== */
FA._initCalendarUI = function() {
    if (FA._calendarUIInit) return;

    /* 视图切换标签 - 已在 HTML 中存在，只需同步状态 */
    var monthTitle = document.getElementById('calendarMonth');
    if (monthTitle) {
        monthTitle.style.cursor = 'pointer';
    }

    FA._calendarUIInit = true;
};

/* =====================
   渲染日历
   ===================== */
FA.renderCalendar = function() {
    FA._initCalendarUI();

    var monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                      '七月', '八月', '九月', '十月', '十一月', '十二月'];
    var monthTitle = document.getElementById('calendarMonth');
    if (monthTitle) {
        monthTitle.textContent = FA._calYear + '年 ' + monthNames[FA._calMonth];
    }

    /* 更新视图标签状态 */
    var tabs = document.querySelectorAll('.calendar-view-tab');
    tabs.forEach(function(tab) { tab.classList.remove('active'); });
    if (tabs.length > 0) {
        tabs[0].classList.toggle('active', FA._calView === 'month');
        if (tabs.length > 1) tabs[1].classList.toggle('active', FA._calView === 'day');
    }

    /* 修复: 使用 calendarContent (匹配 index.html 中的 id) */
    var body = document.getElementById('calendarContent');
    if (!body) return;

    if (FA._calView === 'day') {
        FA._renderDayView(body);
    } else {
        FA._renderMonthView(body);
    }

    FA.Data.saveData(FA.DB_KEYS.events, FA.events);
};

/* =====================
   月视图 - 大表格
   ===================== */
FA._renderMonthView = function(body) {
    var todayStr = FA.getTodayStr();
    var daysInMonth = new Date(FA._calYear, FA._calMonth + 1, 0).getDate();
    var firstDay = new Date(FA._calYear, FA._calMonth, 1).getDay();
    var holidays = FA.getHolidays(FA._calYear, FA._calMonth + 1);
    var pad = function(n) { return String(n).padStart(2, '0'); };

    /* 星期表头 */
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var html = '<div class="calendar-weekdays">';
    weekdays.forEach(function(w) {
        html += '<div class="calendar-weekday">' + w + '</div>';
    });
    html += '</div>';

    /* 日期格子 */
    html += '<div class="calendar-days">';

    /* 月初空白格 */
    for (var i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    /* 每一天 */
    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = FA._calYear + '-' + pad(FA._calMonth + 1) + '-' + pad(d);
        var hasEvent = FA.events.some(function(e) { return e.date === dateStr; });
        var holiday = holidays[dateStr];
        var isToday = dateStr === todayStr;
        var isWeekend = new Date(FA._calYear, FA._calMonth, d).getDay();
        var isSat = (isWeekend === 6);
        var isSun = (isWeekend === 0);

        var classes = 'calendar-day';
        if (hasEvent) classes += ' has-event';
        if (holiday) classes += ' has-holiday';
        if (isToday) classes += ' today';
        if (isSat) classes += ' weekend';
        if (isSun) classes += ' weekend';

        var holidayHtml = holiday ? '<div class="day-holiday">' + holiday.name + '</div>' : '';

        html += '<div class="' + classes + '" onclick="FA.dayClick(\'' + dateStr + '\')">' +
                '<div class="day-num">' + d + '</div>' + holidayHtml + '</div>';
    }

    html += '</div>';

    body.innerHTML = html;
};

/* =====================
   日视图
   ===================== */
FA._renderDayView = function(body) {
    var dateStr = FA._selectedDate || FA.getTodayStr();
    var dayEvents = FA.events.filter(function(e) { return e.date === dateStr; });
    var holidays = FA.getHolidays(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]));
    var holiday = holidays[dateStr];

    var typeIcons = {
        'custom': '📌',
        'birthday': '🎂',
        'holiday': '🎉',
        'solar-term': '🌿'
    };

    var html = '<div style="margin-bottom:12px;font-size:14px;color:#666">已选日期: <strong style="color:#007AFF">' + dateStr + '</strong>' +
               (holiday ? ' · <span style="color:#ff453a">' + holiday.name + '</span>' : '') +
               ' <span style="color:#007AFF;cursor:pointer;margin-left:8px" onclick="FA.openDatePicker()">更换日期</span></div>';

    html += '<div class="calendar-day-list">';
    if (dayEvents.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon">📅</div><p>当日暂无日程</p></div>';
    } else {
        dayEvents.forEach(function(e) {
            var icon = typeIcons[e.type] || typeIcons['custom'];
            html +=
                '<div class="calendar-day-event">' +
                    '<div class="event-type">' + icon + '</div>' +
                    '<div class="event-detail">' +
                        '<h4>' + e.title + '</h4>' +
                        '<p>⏰ ' + (e.time || '全天') + (e.location ? ' · 📍 ' + e.location : '') + '</p>' +
                    '</div>' +
                '</div>';
        });
    }
    html += '</div>';

    body.innerHTML = html;
};

/* =====================
   渲染日程列表
   ===================== */
FA.renderEvents = function() {
    var list = document.getElementById('eventList');
    if (!list) return;

    var sorted = FA.events.slice().sort(function(a, b) {
        return a.date.localeCompare(b.date);
    });

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>暂无日程</p><p class="empty-hint">点击"新建日程"添加</p></div>';
        return;
    }

    var canDelete = FA.checkPermission('deleteEvent');
    var typeIcons = {
        'custom': '📌',
        'birthday': '🎂',
        'holiday': '🎉',
        'solar-term': '🌿'
    };

    list.innerHTML = sorted.map(function(e) {
        var actualIndex = FA.events.indexOf(e);
        var parts = e.date.split('-');
        var day = parseInt(parts[2]);
        var month = parseInt(parts[1]);
        var icon = typeIcons[e.type] || typeIcons['custom'];

        return '<div class="event-item">' +
            '<div class="event-date"><div class="day">' + day + '</div><div class="month">' + month + '月</div></div>' +
            '<div class="event-info">' +
                '<h4>' + icon + ' ' + e.title + '</h4>' +
                '<p>⏰ ' + (e.time || '全天') + (e.location ? ' · 📍 ' + e.location : '') + '</p>' +
            '</div>' +
            (canDelete ? '<button class="event-delete" onclick="FA.deleteEvent(' + actualIndex + ')">&times;</button>' : '') +
        '</div>';
    }).join('');
};

/* =====================
   月份导航
   ===================== */
FA.changeMonth = function(delta) {
    FA._calMonth += delta;
    if (FA._calMonth > 11) { FA._calMonth = 0; FA._calYear++; }
    if (FA._calMonth < 0) { FA._calMonth = 11; FA._calYear--; }
    FA.renderCalendar();
};

FA.goToToday = function() {
    var now = new Date();
    FA._calYear = now.getFullYear();
    FA._calMonth = now.getMonth();
    FA._selectedDate = FA.getTodayStr();
    FA.renderCalendar();
};

/* =====================
   视图切换
   ===================== */
FA.changeCalendarView = function(view) {
    FA._calView = view;
    if (view === 'day' && !FA._selectedDate) {
        FA._selectedDate = FA.getTodayStr();
    }
    FA.renderCalendar();
};

/* =====================
   点击日期
   ===================== */
FA.dayClick = function(dateStr) {
    FA._selectedDate = dateStr;

    var dayEvents = FA.events.filter(function(e) { return e.date === dateStr; });
    if (dayEvents.length > 0) {
        var msg = dayEvents.map(function(e) {
            return (e.time || '全天') + ' - ' + e.title;
        }).join('\n');
        FA.showToast(msg, 'info');
    } else {
        var holidays = FA.getHolidays(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]));
        if (holidays[dateStr]) {
            FA.showToast(holidays[dateStr].name, 'info');
        }
    }

    if (FA._calView === 'day') {
        FA.renderCalendar();
    }
};

/* =====================
   日期选择器 (滚轮)
   ===================== */
FA.openDatePicker = function() {
    var modalId = 'date-picker-modal';
    var modal = document.getElementById(modalId);

    if (!modal) {
        modal = FA._createDatePickerModal(modalId);
        document.body.appendChild(modal);
    }

    var initDate = FA._selectedDate ? FA._selectedDate.split('-') :
                   [String(FA._calYear), String(FA._calMonth + 1).padStart(2, '0'), '01'];
    var initYear = parseInt(initDate[0]);
    var initMonth = parseInt(initDate[1]);
    var initDay = parseInt(initDate[2]);

    FA._dpState = { year: initYear, month: initMonth, day: initDay };

    FA._setupDateWheel('dpWheelYear', FA._dpGetYears(), initYear, function(val) {
        FA._dpState.year = val;
        FA._dpUpdateDays();
    });
    FA._setupDateWheel('dpWheelMonth', FA._dpGetMonths(), initMonth, function(val) {
        FA._dpState.month = val;
        FA._dpUpdateDays();
    });
    FA._setupDateWheel('dpWheelDay', FA._dpGetDays(initYear, initMonth), initDay, function(val) {
        FA._dpState.day = val;
    });

    FA.showModal(modalId);
};

FA._createDatePickerModal = function(modalId) {
    var div = document.createElement('div');
    div.innerHTML =
        '<div class="modal" id="' + modalId + '">' +
            '<div class="modal-content date-picker-modal">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>选择日期</h3></div>' +
                '<div class="date-picker-wheels">' +
                    '<div class="date-wheel" id="dpWheelYear">' +
                        '<div class="date-wheel-items"></div>' +
                        '<div class="date-wheel-center-line"></div>' +
                    '</div>' +
                    '<div class="date-wheel" id="dpWheelMonth">' +
                        '<div class="date-wheel-items"></div>' +
                        '<div class="date-wheel-center-line"></div>' +
                    '</div>' +
                    '<div class="date-wheel" id="dpWheelDay">' +
                        '<div class="date-wheel-items"></div>' +
                        '<div class="date-wheel-center-line"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-secondary" onclick="FA.closeModal(\'' + modalId + '\')">取消</button>' +
                    '<button class="btn-primary" id="dpConfirm">确定</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    var modal = div.firstElementChild;

    modal.querySelector('#dpConfirm').addEventListener('click', function() {
        var pad = function(n) { return String(n).padStart(2, '0'); };
        var dateStr = FA._dpState.year + '-' + pad(FA._dpState.month) + '-' + pad(FA._dpState.day);
        FA._selectedDate = dateStr;
        FA._calYear = FA._dpState.year;
        FA._calMonth = FA._dpState.month - 1;
        FA.closeModal(modalId);
        FA.renderCalendar();
        FA.showToast('已跳转到 ' + dateStr, 'info');
    });

    return modal;
};

FA._dpGetYears = function() {
    var years = [];
    for (var y = 2020; y <= 2035; y++) {
        years.push({ value: y, label: y + '年' });
    }
    return years;
};

FA._dpGetMonths = function() {
    var months = [];
    for (var m = 1; m <= 12; m++) {
        months.push({ value: m, label: m + '月' });
    }
    return months;
};

FA._dpGetDays = function(year, month) {
    var daysInMonth = new Date(year, month, 0).getDate();
    var days = [];
    for (var d = 1; d <= daysInMonth; d++) {
        days.push({ value: d, label: d + '日' });
    }
    return days;
};

FA._dpUpdateDays = function() {
    var state = FA._dpState;
    var days = FA._dpGetDays(state.year, state.month);
    var maxDay = days.length;
    if (state.day > maxDay) state.day = maxDay;
    FA._setupDateWheel('dpWheelDay', days, state.day, function(val) {
        FA._dpState.day = val;
    });
};

FA._setupDateWheel = function(wheelId, items, selectedValue, onChange) {
    var wheel = document.getElementById(wheelId);
    if (!wheel) return;

    var itemsContainer = wheel.querySelector('.date-wheel-items');
    var itemHeight = 40;
    var centerOffset = 60;

    itemsContainer.innerHTML = items.map(function(item, idx) {
        return '<div class="date-wheel-item" data-value="' + item.value + '" data-index="' + idx + '">' + item.label + '</div>';
    }).join('');

    var currentIndex = 0;
    for (var i = 0; i < items.length; i++) {
        if (items[i].value === selectedValue) { currentIndex = i; break; }
    }

    var updatePosition = function(animate) {
        itemsContainer.style.transition = animate !== false ? 'transform 0.3s ease' : 'none';
        itemsContainer.style.transform = 'translateY(' + (centerOffset - currentIndex * itemHeight) + 'px)';
    };
    updatePosition(false);

    var newWheel = wheel.cloneNode(true);
    wheel.parentNode.replaceChild(newWheel, wheel);
    wheel = newWheel;
    itemsContainer = wheel.querySelector('.date-wheel-items');

    itemsContainer.innerHTML = items.map(function(item, idx) {
        return '<div class="date-wheel-item" data-value="' + item.value + '" data-index="' + idx + '">' + item.label + '</div>';
    }).join('');
    updatePosition(false);

    var startY = 0;
    var startTranslate = 0;
    var currentTranslate = centerOffset - currentIndex * itemHeight;
    var isDragging = false;

    var onStart = function(e) {
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startTranslate = currentTranslate;
        itemsContainer.style.transition = 'none';
        e.preventDefault();
    };

    var onMove = function(e) {
        if (!isDragging) return;
        var y = e.touches ? e.touches[0].clientY : e.clientY;
        currentTranslate = startTranslate + (y - startY);
        itemsContainer.style.transform = 'translateY(' + currentTranslate + 'px)';
        e.preventDefault();
    };

    var onEnd = function() {
        if (!isDragging) return;
        isDragging = false;
        var newIndex = Math.round((centerOffset - currentTranslate) / itemHeight);
        newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
        currentIndex = newIndex;
        currentTranslate = centerOffset - currentIndex * itemHeight;
        updatePosition(true);
        if (onChange) onChange(items[currentIndex].value);
    };

    wheel.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    wheel.addEventListener('touchstart', onStart, { passive: false });
    wheel.addEventListener('touchmove', onMove, { passive: false });
    wheel.addEventListener('touchend', onEnd);

    wheel.querySelectorAll('.date-wheel-item').forEach(function(itemEl, idx) {
        itemEl.addEventListener('click', function() {
            if (isDragging) return;
            currentIndex = idx;
            currentTranslate = centerOffset - currentIndex * itemHeight;
            updatePosition(true);
            if (onChange) onChange(items[currentIndex].value);
        });
    });

    wheel.addEventListener('wheel', function(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 1 : -1;
        var newIndex = Math.max(0, Math.min(items.length - 1, currentIndex + delta));
        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            currentTranslate = centerOffset - currentIndex * itemHeight;
            updatePosition(true);
            if (onChange) onChange(items[currentIndex].value);
        }
    });
};

/* =====================
   保存日程
   ===================== */
FA.saveEvent = function() {
    var title = document.getElementById('eventTitle').value.trim();
    var date = document.getElementById('eventDate').value;
    if (!title || !date) {
        FA.showToast('请填写标题和日期', 'error');
        return;
    }

    var typeEl = document.getElementById('eventType');
    var type = typeEl ? typeEl.value : 'custom';

    FA.events.push({
        title: title,
        date: date,
        time: document.getElementById('eventTime').value,
        location: document.getElementById('eventLocation').value,
        type: type
    });

    FA.Data.saveData(FA.DB_KEYS.events, FA.events);
    FA.closeModal('add-event-modal');
    FA.renderAll();

    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventTime').value = '';
    document.getElementById('eventLocation').value = '';
    if (typeEl) typeEl.value = 'custom';

    FA.Data.addNotification('info', '日程添加', title + ' 已添加到日历');
    FA.showToast('日程添加成功', 'success');
};

/* =====================
   删除日程
   ===================== */
FA.deleteEvent = function(index) {
    if (index < 0 || index >= FA.events.length) return;
    if (!confirm('确定删除日程 "' + FA.events[index].title + '"？')) return;

    var title = FA.events[index].title;
    FA.events.splice(index, 1);
    FA.Data.saveData(FA.DB_KEYS.events, FA.events);
    FA.renderAll();
    FA.showToast('日程已删除', 'info');
};
