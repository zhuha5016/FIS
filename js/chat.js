/* ======================================================================
   chat.js - 微信风格通讯模块
   功能: 消息收发/持久化/搜索/置顶/静音/表情/图片/文件/导入导出
   ====================================================================== */

window.FA = window.FA || {};

FA.Chat = {
    /* 当前打开的聊天对象 */
    currentChatUser: null,
    /* 聊天列表 */
    chatList: [],
    /* 所有消息记录 { from: '', to: '', content: '', type: 'text', time: '' } */
    messages: {},
    /* 置顶列表 */
    pinnedUsers: [],
    /* 静音列表 */
    mutedUsers: [],
    /* 搜索关键词 */
    searchKeyword: '',
    /* 表情面板状态 */
    emojiPanelOpen: false,
    /* 当前选中的文件(待发送) */
    pendingFile: null,

    /* =====================
       初始化
       ===================== */
    init: function() {
        /* 加载数据 */
        FA.Chat.chatList = FA.Data.loadData(FA.DB_KEYS.chatList, []);
        FA.Chat.messages = FA.Data.loadData(FA.DB_KEYS.chatMessages, {});
        FA.Chat.pinnedUsers = FA.Data.loadData(FA.DB_KEYS.chatPinned, []);
        FA.Chat.mutedUsers = FA.Data.loadData(FA.DB_KEYS.chatMuted, []);

        /* 监听 localStorage 变化 (跨标签页实时通讯) */
        window.addEventListener('storage', function(e) {
            if (e.key === FA.DB_KEYS.chatMessages) {
                try {
                    FA.Chat.messages = JSON.parse(e.newValue || '{}');
                } catch(err) { return; }
                /* 如果当前在聊天页面, 刷新消息 */
                var chatSection = document.getElementById('chat-section');
                if (chatSection && chatSection.style.display !== 'none') {
                    FA.Chat.renderChatList();
                    if (FA.Chat.currentChatUser) {
                        FA.Chat.renderMessages();
                    }
                    /* 检查新消息通知 */
                    FA.Chat.checkNewMessages();
                }
            }
        });

        /* 定时检查新消息 (每3秒) */
        setInterval(function() {
            var chatSection = document.getElementById('chat-section');
            if (chatSection && chatSection.style.display !== 'none') {
                FA.Chat.renderChatList();
                if (FA.Chat.currentChatUser) {
                    FA.Chat.renderMessages();
                }
            }
            FA.Chat.checkNewMessages();
        }, 3000);
    },

    /* =====================
       渲染聊天页面
       ===================== */
    render: function() {
        var container = document.getElementById('chatContent');
        if (!container) return;

        container.innerHTML =
            '<div class="chat-layout">' +
                /* 左侧: 聊天列表 */
                '<div class="chat-sidebar">' +
                    '<div class="chat-search-bar">' +
                        '<input type="text" id="chatSearchInput" placeholder="搜索聊天记录..." ' +
                            'oninput="FA.Chat.onSearch(this.value)">' +
                    '</div>' +
                    '<div class="chat-list-container" id="chatListContainer"></div>' +
                '</div>' +
                /* 右侧: 聊天窗口 */
                '<div class="chat-window" id="chatWindow">' +
                    '<div class="chat-empty" id="chatEmpty">' +
                        '<div class="chat-empty-icon">💬</div>' +
                        '<p>选择一个联系人开始聊天</p>' +
                    '</div>' +
                    '<div class="chat-active" id="chatActive" style="display:none">' +
                        '<div class="chat-header" id="chatHeader"></div>' +
                        '<div class="chat-messages" id="chatMessages"></div>' +
                        '<div class="chat-input-bar">' +
                            '<div class="chat-input-actions">' +
                                '<button class="chat-action-btn" onclick="FA.Chat.toggleEmojiPanel()" title="表情">😊</button>' +
                                '<button class="chat-action-btn" onclick="document.getElementById(\'chatFileInput\').click()" title="图片">📷</button>' +
                                '<button class="chat-action-btn" onclick="document.getElementById(\'chatFileInput2\').click()" title="文件">📎</button>' +
                                '<input type="file" id="chatFileInput" accept="image/*" style="display:none" onchange="FA.Chat.onFileSelect(event, \'image\')">' +
                                '<input type="file" id="chatFileInput2" style="display:none" onchange="FA.Chat.onFileSelect(event, \'file\')">' +
                            '</div>' +
                            '<div class="chat-emoji-panel" id="chatEmojiPanel" style="display:none"></div>' +
                            '<div class="chat-input-row">' +
                                '<input type="text" id="chatInputText" placeholder="输入消息..." ' +
                                    'onkeydown="if(event.key===\'Enter\'){event.preventDefault();FA.Chat.sendMessage()}" ' +
                                    'oninput="FA.Chat.onInput()">' +
                                '<button class="chat-send-btn" onclick="FA.Chat.sendMessage()">发送</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        FA.Chat.renderChatList();
        FA.Chat.renderEmojiPanel();
    },

    /* =====================
       渲染聊天列表 (左侧)
       ===================== */
    renderChatList: function() {
        var container = document.getElementById('chatListContainer');
        if (!container) return;

        /* 构建聊天列表: 所有用户 + 最后一条消息 */
        var users = FA.Chat._getAllChatUsers();

        /* 按最后消息时间排序, 置顶优先 */
        users.sort(function(a, b) {
            var aPinned = FA.Chat.pinnedUsers.indexOf(a.username) !== -1;
            var bPinned = FA.Chat.pinnedUsers.indexOf(b.username) !== -1;
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            var aLast = FA.Chat._getLastMessage(a.username);
            var bLast = FA.Chat._getLastMessage(b.username);
            var aTime = aLast ? new Date(aLast.time).getTime() : 0;
            var bTime = bLast ? new Date(bLast.time).getTime() : 0;
            return bTime - aTime;
        });

        /* 搜索过滤 */
        if (FA.Chat.searchKeyword) {
            var kw = FA.Chat.searchKeyword.toLowerCase();
            users = users.filter(function(u) {
                var name = (u.nameCn || u.name || '').toLowerCase();
                if (name.indexOf(kw) !== -1) return true;
                /* 搜索消息内容 */
                var msgs = FA.Chat._getConversation(u.username);
                return msgs.some(function(m) {
                    return (m.content || '').toLowerCase().indexOf(kw) !== -1;
                });
            });
        }

        if (users.length === 0) {
            container.innerHTML = '<div class="chat-list-empty"><p>暂无联系人</p></div>';
            return;
        }

        container.innerHTML = users.map(function(u) {
            var lastMsg = FA.Chat._getLastMessage(u.username);
            var lastContent = lastMsg ? FA.Chat._formatMessagePreview(lastMsg) : '暂无消息';
            var lastTime = lastMsg ? FA.Chat._formatChatTime(lastMsg.time) : '';
            var isActive = (FA.Chat.currentChatUser === u.username);
            var isPinned = FA.Chat.pinnedUsers.indexOf(u.username) !== -1;
            var isMuted = FA.Chat.mutedUsers.indexOf(u.username) !== -1;
            var unread = FA.Chat._getUnreadCount(u.username);

            var avatarHtml = FA.Chat._getAvatarHtml(u);
            var name = u.nameCn || u.name || u.username;
            var roleBadge = FA.getRoleName(u.role);

            return '<div class="chat-list-item' + (isActive ? ' active' : '') + '" ' +
                'onclick="FA.Chat.openChat(\'' + u.username + '\')">' +
                '<div class="chat-list-avatar">' + avatarHtml + '</div>' +
                '<div class="chat-list-body">' +
                    '<div class="chat-list-top">' +
                        '<span class="chat-list-name">' + FA._esc(name) +
                        (isMuted ? ' <span style="font-size:10px">🔇</span>' : '') +
                        '</span>' +
                        '<span class="chat-list-time">' + lastTime + '</span>' +
                    '</div>' +
                    '<div class="chat-list-bottom">' +
                        '<span class="chat-list-preview">' + FA._esc(lastContent) + '</span>' +
                        (unread > 0 ? '<span class="chat-list-badge">' + unread + '</span>' : '') +
                        (isPinned ? '<span class="chat-list-pin">📌</span>' : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    },

    /* =====================
       打开聊天窗口
       ===================== */
    openChat: function(username) {
        FA.Chat.currentChatUser = username;

        document.getElementById('chatEmpty').style.display = 'none';
        document.getElementById('chatActive').style.display = 'flex';
        FA.Chat.currentChatUser = username;

        /* 渲染聊天头部 */
        var user = FA.Chat._getUserInfo(username);
        var name = user ? (user.nameCn || user.name || username) : username;
        var roleBadge = user ? FA.getRoleName(user.role) : '';
        var isPinned = FA.Chat.pinnedUsers.indexOf(username) !== -1;
        var isMuted = FA.Chat.mutedUsers.indexOf(username) !== -1;

        var header = document.getElementById('chatHeader');
        header.innerHTML =
            '<div class="chat-header-left">' +
                '<button class="chat-back-btn" onclick="FA.Chat.closeChat()">←</button>' +
                '<div class="chat-header-avatar">' + FA.Chat._getAvatarHtml(user || {username: username}) + '</div>' +
                '<div class="chat-header-info">' +
                    '<span class="chat-header-name">' + FA._esc(name) + '</span>' +
                    '<span class="chat-header-role">' + roleBadge + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="chat-header-actions">' +
                '<button class="chat-header-btn" onclick="FA.Chat.togglePin(\'' + username + '\')" title="置顶">' +
                    (isPinned ? '📌' : '📍') +
                '</button>' +
                '<button class="chat-header-btn" onclick="FA.Chat.toggleMute(\'' + username + '\')" title="静音">' +
                    (isMuted ? '🔕' : '🔔') +
                '</button>' +
                '<button class="chat-header-btn" onclick="FA.Chat.showChatSearch(\'' + username + '\')" title="搜索">🔍</button>' +
            '</div>';

        /* 标记消息已读 */
        FA.Chat._markAsRead(username);

        /* 渲染消息 */
        FA.Chat.renderMessages();

        /* 聚焦输入框 */
        setTimeout(function() {
            var input = document.getElementById('chatInputText');
            if (input) input.focus();
        }, 100);

        /* 刷新列表 (更新未读数) */
        FA.Chat.renderChatList();
    },

    /* =====================
       关闭聊天窗口
       ===================== */
    closeChat: function() {
        FA.Chat.currentChatUser = null;
        document.getElementById('chatEmpty').style.display = 'flex';
        document.getElementById('chatActive').style.display = 'none';
        FA.Chat.renderChatList();
    },

    /* =====================
       渲染消息列表
       ===================== */
    renderMessages: function() {
        var container = document.getElementById('chatMessages');
        if (!container) return;
        if (!FA.Chat.currentChatUser) return;

        var msgs = FA.Chat._getConversation(FA.Chat.currentChatUser);

        if (msgs.length === 0) {
            container.innerHTML = '<div class="chat-no-messages"><p>暂无消息, 发送第一条消息吧！</p></div>';
            return;
        }

        var html = '';
        var lastDate = '';
        msgs.forEach(function(msg, i) {
            /* 日期分隔线 */
            var msgDate = new Date(msg.time).toLocaleDateString('zh-CN');
            if (msgDate !== lastDate) {
                html += '<div class="chat-date-divider"><span>' + FA.Chat._formatDateDivider(msg.time) + '</span></div>';
                lastDate = msgDate;
            }

            var isMe = (msg.from === FA.currentUser.username);
            var senderInfo = FA.Chat._getUserInfo(msg.from);
            var senderName = senderInfo ? (senderInfo.nameCn || senderInfo.name || msg.from) : msg.from;
            var avatarHtml = FA.Chat._getAvatarHtml(senderInfo || {username: msg.from});
            var timeStr = new Date(msg.time).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});

            var contentHtml = '';
            if (msg.type === 'text') {
                contentHtml = '<div class="chat-bubble-text">' + FA._esc(msg.content) + '</div>';
            } else if (msg.type === 'image') {
                contentHtml = '<div class="chat-bubble-image"><img src="' + msg.content + '" onclick="FA.Chat.viewImage(\'' + msg.id + '\')"></div>';
            } else if (msg.type === 'file') {
                var fileName = msg.fileName || '文件';
                var fileSize = msg.fileSize ? FA.Chat._formatFileSize(msg.fileSize) : '';
                contentHtml = '<div class="chat-bubble-file">' +
                    '<span class="chat-file-icon">📎</span>' +
                    '<div class="chat-file-info">' +
                        '<div class="chat-file-name">' + FA._esc(fileName) + '</div>' +
                        (fileSize ? '<div class="chat-file-size">' + fileSize + '</div>' : '') +
                    '</div>' +
                    '<a href="' + msg.content + '" download="' + fileName + '" class="chat-file-download">下载</a>' +
                '</div>';
            } else if (msg.type === 'emoji') {
                contentHtml = '<div class="chat-bubble-emoji">' + msg.content + '</div>';
            }

            html += '<div class="chat-msg' + (isMe ? ' me' : '') + '" data-msg-id="' + msg.id + '">' +
                '<div class="chat-msg-avatar">' + avatarHtml + '</div>' +
                '<div class="chat-msg-body">' +
                    '<div class="chat-msg-meta">' +
                        '<span class="chat-msg-name">' + FA._esc(senderName) + '</span>' +
                        '<span class="chat-msg-time">' + timeStr + '</span>' +
                    '</div>' +
                    contentHtml +
                '</div>' +
            '</div>';
        });

        container.innerHTML = html;

        /* 滚动到底部 */
        container.scrollTop = container.scrollHeight;
    },

    /* =====================
       发送消息
       ===================== */
    sendMessage: function() {
        var input = document.getElementById('chatInputText');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        if (!FA.Chat.currentChatUser) return;

        FA.Chat._addMessage(FA.currentUser.username, FA.Chat.currentChatUser, text, 'text');

        input.value = '';
        FA.Chat.closeEmojiPanel();
        FA.Chat.renderMessages();
        FA.Chat.renderChatList();

        /* 发送通知给对方 (如果不是自己) */
        if (FA.Chat.currentChatUser !== FA.currentUser.username) {
            var isMuted = FA.Chat.mutedUsers.indexOf(FA.Chat.currentChatUser) !== -1;
            if (!isMuted && FA.sendWindowsNotification) {
                var myName = FA.currentUser.nameCn || FA.currentUser.name;
                FA.sendWindowsNotification(myName + ' 发来消息', text.length > 50 ? text.substring(0, 50) + '...' : text);
            }
        }

        /* 记录操作日志 */
        if (FA.Data.recordOpLog) {
            FA.Data.recordOpLog('chat_send', '发送消息给 ' + FA.Chat.currentChatUser);
        }
    },

    /* =====================
       发送表情
       ===================== */
    sendEmoji: function(emoji) {
        if (!FA.Chat.currentChatUser) return;
        FA.Chat._addMessage(FA.currentUser.username, FA.Chat.currentChatUser, emoji, 'emoji');
        FA.Chat.renderMessages();
        FA.Chat.renderChatList();
        FA.Chat.closeEmojiPanel();
    },

    /* =====================
       文件选择处理
       ===================== */
    onFileSelect: function(event, type) {
        var file = event.target.files[0];
        if (!file) return;
        if (!FA.Chat.currentChatUser) return;

        /* 文件大小限制: 图片 5MB, 文件 10MB */
        var maxSize = type === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            FA.showToast('文件太大, 最大' + (type === 'image' ? '5MB' : '10MB'), 'error');
            event.target.value = '';
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            var content = e.target.result;
            var msgType = type === 'image' ? 'image' : 'file';
            var extra = {};
            if (type === 'file') {
                extra.fileName = file.name;
                extra.fileSize = file.size;
            }
            FA.Chat._addMessage(FA.currentUser.username, FA.Chat.currentChatUser, content, msgType, extra);
            FA.Chat.renderMessages();
            FA.Chat.renderChatList();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    },

    /* =====================
       表情面板
       ===================== */
    renderEmojiPanel: function() {
        var panel = document.getElementById('chatEmojiPanel');
        if (!panel) return;

        var emojis = [
            '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
            '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
            '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
            '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🙂',
            '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵',
            '🥶','😱😨','😰','😥','😢','😭','😤','😠','😡','🤬',
            '🤯','😳','🥵','🥶','😱','😨','😰','😥','😢','😭',
            '👍','👎','👌','✌️','🤞','🤟','🤘','👊','✊','🙌',
            '👏','🤝','🙏','🤲','💪','🔥','⭐','✨','💫','💥',
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
            '💯','🔔','🔕','📌','📍','💬','📝','📄','📅','🎉'
        ];

        panel.innerHTML = '<div class="emoji-grid">' +
            emojis.map(function(e) {
                return '<span class="emoji-item" onclick="FA.Chat.sendEmoji(\'' + e + '\')">' + e + '</span>';
            }).join('') +
        '</div>';
    },

    toggleEmojiPanel: function() {
        var panel = document.getElementById('chatEmojiPanel');
        if (!panel) return;
        FA.Chat.emojiPanelOpen = !FA.Chat.emojiPanelOpen;
        panel.style.display = FA.Chat.emojiPanelOpen ? 'block' : 'none';
    },

    closeEmojiPanel: function() {
        FA.Chat.emojiPanelOpen = false;
        var panel = document.getElementById('chatEmojiPanel');
        if (panel) panel.style.display = 'none';
    },

    /* =====================
       搜索
       ===================== */
    onSearch: function(keyword) {
        FA.Chat.searchKeyword = keyword.trim();
        FA.Chat.renderChatList();
    },

    showChatSearch: function(username) {
        var msgs = FA.Chat._getConversation(username);
        if (msgs.length === 0) {
            FA.showToast('暂无消息记录', 'info');
            return;
        }

        var modalId = 'chat-search-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '3000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:600px">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>搜索聊天记录</h3></div>' +
                '<div style="margin-bottom:14px">' +
                    '<input type="text" id="chatSearchInModal" placeholder="输入关键词搜索..." ' +
                        'oninput="FA.Chat._doSearchInModal(this.value, \'' + username + '\')" ' +
                        'style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(0,0,0,0.1);font-size:14px">' +
                '</div>' +
                '<div id="chatSearchResults" style="max-height:400px;overflow-y:auto">' +
                    '<p style="color:#999;text-align:center;padding:20px">输入关键词开始搜索</p>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn-primary" onclick="FA.closeModal(\'' + modalId + '\')">关闭</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
        setTimeout(function() {
            document.getElementById('chatSearchInModal').focus();
        }, 100);
    },

    _doSearchInModal: function(keyword, username) {
        var body = document.getElementById('chatSearchResults');
        if (!body) return;
        keyword = keyword.trim().toLowerCase();
        if (!keyword) {
            body.innerHTML = '<p style="color:#999;text-align:center;padding:20px">输入关键词开始搜索</p>';
            return;
        }

        var msgs = FA.Chat._getConversation(username);
        var results = msgs.filter(function(m) {
            return (m.content || '').toLowerCase().indexOf(keyword) !== -1;
        });

        if (results.length === 0) {
            body.innerHTML = '<p style="color:#999;text-align:center;padding:20px">未找到匹配消息</p>';
            return;
        }

        body.innerHTML = results.map(function(m) {
            var isMe = (m.from === FA.currentUser.username);
            var senderInfo = FA.Chat._getUserInfo(m.from);
            var senderName = senderInfo ? (senderInfo.nameCn || senderInfo.name) : m.from;
            var timeStr = new Date(m.time).toLocaleString('zh-CN');
            var content = m.type === 'text' ? m.content : '[' + (m.type === 'image' ? '图片' : '文件') + ']';

            return '<div style="padding:10px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer" ' +
                'onclick="FA.Chat._jumpToMessage(\'' + username + '\',\'' + m.id + '\')">' +
                '<div style="font-size:12px;color:#888;margin-bottom:4px">' +
                    (isMe ? '我' : FA._esc(senderName)) + ' · ' + timeStr +
                '</div>' +
                '<div style="font-size:14px;color:#333">' + FA._esc(content) + '</div>' +
            '</div>';
        }).join('');
    },

    _jumpToMessage: function(username, msgId) {
        FA.closeModal('chat-search-modal');
        if (FA.Chat.currentChatUser !== username) {
            FA.Chat.openChat(username);
        }
        setTimeout(function() {
            var msgEl = document.querySelector('[data-msg-id="' + msgId + '"]');
            if (msgEl) {
                msgEl.scrollIntoView({behavior: 'smooth', block: 'center'});
                msgEl.style.background = 'rgba(0,122,255,0.08)';
                msgEl.style.borderRadius = '8px';
                msgEl.style.transition = 'background 0.5s';
                setTimeout(function() {
                    msgEl.style.background = '';
                }, 2000);
            }
        }, 200);
    },

    /* =====================
       置顶/取消置顶
       ===================== */
    togglePin: function(username) {
        var idx = FA.Chat.pinnedUsers.indexOf(username);
        if (idx === -1) {
            FA.Chat.pinnedUsers.push(username);
            FA.showToast('已置顶', 'success');
        } else {
            FA.Chat.pinnedUsers.splice(idx, 1);
            FA.showToast('已取消置顶', 'info');
        }
        FA.Data.saveData(FA.DB_KEYS.chatPinned, FA.Chat.pinnedUsers);
        FA.Chat.renderChatList();
        if (FA.Chat.currentChatUser === username) {
            FA.Chat.openChat(username);
        }
    },

    /* =====================
       静音/取消静音
       ===================== */
    toggleMute: function(username) {
        var idx = FA.Chat.mutedUsers.indexOf(username);
        if (idx === -1) {
            FA.Chat.mutedUsers.push(username);
            FA.showToast('已静音', 'info');
        } else {
            FA.Chat.mutedUsers.splice(idx, 1);
            FA.showToast('已取消静音', 'info');
        }
        FA.Data.saveData(FA.DB_KEYS.chatMuted, FA.Chat.mutedUsers);
        FA.Chat.renderChatList();
        if (FA.Chat.currentChatUser === username) {
            FA.Chat.openChat(username);
        }
    },

    /* =====================
       查看大图
       ===================== */
    viewImage: function(msgId) {
        var msgs = FA.Chat._getConversation(FA.Chat.currentChatUser);
        var msg = msgs.find(function(m) { return m.id === msgId; });
        if (!msg) return;

        var modalId = 'chat-image-viewer';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.style.zIndex = '4000';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:90vw;max-height:90vh;padding:12px;background:rgba(0,0,0,0.9)">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<img src="' + msg.content + '" style="max-width:100%;max-height:80vh;border-radius:8px">' +
                '<div style="text-align:center;margin-top:8px">' +
                    '<a href="' + msg.content + '" download="image.png" class="btn-primary" style="text-decoration:none;display:inline-block;padding:8px 20px">下载图片</a>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    },

    /* =====================
       导入/导出聊天记录
       ===================== */
    exportChat: function() {
        /* 显示加载动画 */
        FA.Chat._showLoadingOverlay('正在导出聊天记录...');

        setTimeout(function() {
            var data = {
                messages: FA.Chat.messages,
                chatList: FA.Chat.chatList,
                pinnedUsers: FA.Chat.pinnedUsers,
                mutedUsers: FA.Chat.mutedUsers,
                exportDate: new Date().toISOString()
            };
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'chat_backup_' + FA.getTodayStr() + '.json';
            a.click();
            URL.revokeObjectURL(url);
            FA.Chat._hideLoadingOverlay();
            FA.showToast('聊天记录导出成功', 'success');
        }, 800);
    },

    importChat: function(event) {
        var file = event.target.files[0];
        if (!file) return;

        FA.Chat._showLoadingOverlay('正在导入聊天记录...');

        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.messages) {
                    /* 合并消息 */
                    Object.keys(data.messages).forEach(function(key) {
                        if (!FA.Chat.messages[key]) {
                            FA.Chat.messages[key] = data.messages[key];
                        } else {
                            /* 合并消息数组 */
                            var existing = FA.Chat.messages[key];
                            data.messages[key].forEach(function(msg) {
                                var exists = existing.find(function(m) { return m.id === msg.id; });
                                if (!exists) existing.push(msg);
                            });
                        }
                    });
                    FA.Data.saveData(FA.DB_KEYS.chatMessages, FA.Chat.messages);
                }
                if (data.pinnedUsers) {
                    data.pinnedUsers.forEach(function(u) {
                        if (FA.Chat.pinnedUsers.indexOf(u) === -1) FA.Chat.pinnedUsers.push(u);
                    });
                    FA.Data.saveData(FA.DB_KEYS.chatPinned, FA.Chat.pinnedUsers);
                }
                if (data.mutedUsers) {
                    data.mutedUsers.forEach(function(u) {
                        if (FA.Chat.mutedUsers.indexOf(u) === -1) FA.Chat.mutedUsers.push(u);
                    });
                    FA.Data.saveData(FA.DB_KEYS.chatMuted, FA.Chat.mutedUsers);
                }
                FA.Chat._hideLoadingOverlay();
                FA.Chat.renderChatList();
                if (FA.Chat.currentChatUser) FA.Chat.renderMessages();
                FA.showToast('聊天记录导入成功', 'success');
            } catch (err) {
                FA.Chat._hideLoadingOverlay();
                FA.showToast('导入失败, 请检查文件格式', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    /* =====================
       加载动画
       ===================== */
    _showLoadingOverlay: function(text) {
        var old = document.getElementById('chat-loading-overlay');
        if (old) old.remove();
        var overlay = document.createElement('div');
        overlay.id = 'chat-loading-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
        overlay.innerHTML =
            '<div style="background:white;border-radius:16px;padding:30px 40px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15)">' +
                '<div class="chat-spinner"></div>' +
                '<p style="font-size:14px;color:#555;margin:0">' + (text || '加载中...') + '</p>' +
            '</div>';
        document.body.appendChild(overlay);
    },

    _hideLoadingOverlay: function() {
        var overlay = document.getElementById('chat-loading-overlay');
        if (overlay) overlay.remove();
    },

    /* =====================
       检查新消息 (通知)
       ===================== */
    checkNewMessages: function() {
        /* 检查所有对话的新消息 */
        Object.keys(FA.Chat.messages).forEach(function(key) {
            var parts = key.split('_');
            if (parts.length === 2) {
                var from = parts[0];
                var to = parts[1];
                if (to === FA.currentUser.username && from !== FA.currentUser.username) {
                    var msgs = FA.Chat.messages[key];
                    var lastMsg = msgs[msgs.length - 1];
                    if (lastMsg && !lastMsg.read) {
                        /* 检查是否已通知过 */
                        if (!FA.Chat._notifiedMsgs) FA.Chat._notifiedMsgs = {};
                        if (!FA.Chat._notifiedMsgs[lastMsg.id]) {
                            FA.Chat._notifiedMsgs[lastMsg.id] = true;
                            var isMuted = FA.Chat.mutedUsers.indexOf(from) !== -1;
                            if (!isMuted && FA.sendWindowsNotification) {
                                var senderInfo = FA.Chat._getUserInfo(from);
                                var senderName = senderInfo ? (senderInfo.nameCn || senderInfo.name) : from;
                                var preview = lastMsg.type === 'text' ? lastMsg.content : '[' + (lastMsg.type === 'image' ? '图片' : '文件') + ']';
                                FA.sendWindowsNotification(senderName + ' 发来消息', preview);
                            }
                        }
                    }
                }
            }
        });
    },

    /* =====================
       内部辅助函数
       ===================== */

    /* 添加消息到存储 */
    _addMessage: function(from, to, content, type, extra) {
        var key = [from, to].sort().join('_');
        if (!FA.Chat.messages[key]) FA.Chat.messages[key] = [];

        var msg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            from: from,
            to: to,
            content: content,
            type: type || 'text',
            time: new Date().toISOString(),
            read: false
        };

        if (extra) {
            if (extra.fileName) msg.fileName = extra.fileName;
            if (extra.fileSize) msg.fileSize = extra.fileSize;
        }

        FA.Chat.messages[key].push(msg);
        FA.Data.saveData(FA.DB_KEYS.chatMessages, FA.Chat.messages);

        /* 如果对方打开了这个聊天, 标记已读 */
        if (FA.Chat.currentChatUser === from || FA.Chat.currentChatUser === to) {
            FA.Chat._markAsRead(FA.Chat.currentChatUser);
        }
    },

    /* 获取两个用户之间的消息 */
    _getConversation: function(otherUser) {
        var key = [FA.currentUser.username, otherUser].sort().join('_');
        return FA.Chat.messages[key] || [];
    },

    /* 获取最后一条消息 */
    _getLastMessage: function(otherUser) {
        var msgs = FA.Chat._getConversation(otherUser);
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    },

    /* 获取未读消息数 */
    _getUnreadCount: function(otherUser) {
        var msgs = FA.Chat._getConversation(otherUser);
        return msgs.filter(function(m) {
            return m.to === FA.currentUser.username && !m.read;
        }).length;
    },

    /* 标记已读 */
    _markAsRead: function(otherUser) {
        var key = [FA.currentUser.username, otherUser].sort().join('_');
        var msgs = FA.Chat.messages[key];
        if (!msgs) return;
        var changed = false;
        msgs.forEach(function(m) {
            if (m.to === FA.currentUser.username && !m.read) {
                m.read = true;
                changed = true;
            }
        });
        if (changed) {
            FA.Data.saveData(FA.DB_KEYS.chatMessages, FA.Chat.messages);
        }
    },

    /* 获取所有可聊天的用户 */
    _getAllChatUsers: function() {
        var users = [];
        Object.keys(FA.accounts).forEach(function(key) {
            if (key !== FA.currentUser.username) {
                var acc = FA.accounts[key];
                users.push({
                    username: key,
                    nameCn: acc.nameCn,
                    name: acc.name,
                    role: acc.role
                });
            }
        });
        return users;
    },

    /* 获取用户信息 */
    _getUserInfo: function(username) {
        if (!username) return null;
        if (FA.accounts[username]) return FA.accounts[username];
        /* 在 members 中查找 */
        if (FA.members) {
            for (var i = 0; i < FA.members.length; i++) {
                if (FA.members[i].username === username) return FA.members[i];
            }
        }
        return { username: username, name: username, nameCn: username, role: 'user' };
    },

    /* 获取头像 HTML */
    _getAvatarHtml: function(user) {
        if (!user) return '<div class="chat-avatar-placeholder">?</div>';
        var name = user.nameCn || user.name || user.username || '?';
        var firstChar = name.charAt(0);
        var avatarKey = 'fi_avatar_' + (user.username || '');
        var savedAvatar = localStorage.getItem(avatarKey);
        if (savedAvatar) {
            return '<div class="chat-avatar" style="background-image:url(\'' + savedAvatar + '\');background-size:cover;background-position:center;width:100%;height:100%;border-radius:50%"></div>';
        }
        var colors = FA.avatarColors || ['#007AFF'];
        var colorIdx = (user.username || '').charCodeAt(0) % colors.length;
        return '<div class="chat-avatar" style="background:' + colors[colorIdx] + ';width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px">' + FA._esc(firstChar) + '</div>';
    },

    /* 格式化消息预览 */
    _formatMessagePreview: function(msg) {
        if (msg.type === 'text') return msg.content;
        if (msg.type === 'image') return '[图片]';
        if (msg.type === 'file') return '[文件] ' + (msg.fileName || '');
        if (msg.type === 'emoji') return msg.content;
        return msg.content || '';
    },

    /* 格式化聊天列表时间 */
    _formatChatTime: function(timeStr) {
        var d = new Date(timeStr);
        var now = new Date();
        var diff = (now - d) / 1000;
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        }
        var yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return '昨天';
        return d.toLocaleDateString('zh-CN', {month: '2-digit', day: '2-digit'});
    },

    /* 格式化日期分隔线 */
    _formatDateDivider: function(timeStr) {
        var d = new Date(timeStr);
        var now = new Date();
        if (d.toDateString() === now.toDateString()) return '今天';
        var yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return '昨天';
        return d.toLocaleDateString('zh-CN', {year: 'numeric', month: 'long', day: 'numeric'});
    },

    /* 格式化文件大小 */
    _formatFileSize: function(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};

/* 全局桥接 */
FA.renderChat = function() { FA.Chat.render(); };
