/* ======================================================================
   photos.js - 家庭相册模块
   功能：相册管理、照片上传、照片查看器
   ====================================================================== */

window.FA = window.FA || {};

(function () {

    /* =====================
       内部状态
       ===================== */
    var currentAlbumFilter = 'albums';  // 'albums' = 相册网格, 'all' = 所有照片, albumId = 指定相册
    var viewerPhotos = [];              // 查看器当前照片列表
    var viewerIndex = 0;               // 查看器当前索引
    var tempCoverUrl = '';             // 创建/编辑相册时的临时封面
    var editingAlbumId = null;         // 当前编辑的相册ID (null=新建)

    /* =====================
       工具函数
       ===================== */
    function ensureDefaultAlbum() {
        if (!FA.albums) FA.albums = [];
        var hasDefault = FA.albums.some(function (a) { return a.id === 'default'; });
        if (!hasDefault) {
            FA.albums.push({
                id: 'default',
                name: '默认相册',
                description: '日常照片',
                cover: '',
                createdDate: new Date().toISOString()
            });
        }
    }

    function getAlbum(id) {
        return (FA.albums || []).find(function (a) { return a.id === id; });
    }

    function getPhotosInAlbum(id) {
        return (FA.photos || []).filter(function (p) { return p.albumId === id; });
    }

    function countPhotosInAlbum(id) {
        return getPhotosInAlbum(id).length;
    }

    function genId() {
        return 'photo_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }

    function genAlbumId() {
        return 'album_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* 压缩图片至 800px 最大边，输出 base64 */
    function compressImage(file, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var maxDim = 800;
                var w = img.width;
                var h = img.height;
                if (w > h && w > maxDim) {
                    h = Math.round(h * maxDim / w);
                    w = maxDim;
                } else if (h > maxDim) {
                    w = Math.round(w * maxDim / h);
                    h = maxDim;
                }
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                callback(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function savePhotos() {
        FA.Data.saveData(FA.DB_KEYS.photos, FA.photos);
    }

    function saveAlbums() {
        FA.Data.saveData(FA.DB_KEYS.albums, FA.albums);
    }

    /* =====================
       渲染
       ===================== */
    FA.renderPhotos = function () {
        ensureDefaultAlbum();
        var container = document.getElementById('photoGrid');
        if (!container) return;

        /* 清空旧的筛选栏 */
        var filters = document.getElementById('albumFilters');
        if (filters) filters.innerHTML = '';

        if (currentAlbumFilter === 'albums') {
            container.innerHTML = renderAlbumGrid();
            container.className = '';
        } else {
            container.innerHTML = renderPhotoGrid();
            container.className = 'photo-grid';
        }
    };

    /* 渲染相册网格视图 */
    function renderAlbumGrid() {
        var html = '';

        /* 顶部栏 */
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<h2 style="margin:0;font-size:20px;color:#333;">所有相册</h2>';
        if (FA.checkPermission('createAlbum')) {
            html += '<button onclick="FA.createAlbum()" style="background:#007AFF;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px;">+ 创建相册</button>';
        }
        html += '</div>';

        /* 相册卡片网格 */
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">';

        /* "所有照片" 卡片 */
        var allCount = (FA.photos || []).length;
        var allCover = '';
        if (FA.photos && FA.photos.length > 0) {
            allCover = FA.photos[FA.photos.length - 1].url;
        }
        html += '<div onclick="FA.filterPhotos(\'all\')" style="position:relative;height:260px;border-radius:14px;overflow:hidden;cursor:pointer;background:' + (allCover ? 'url(\'' + allCover + '\') center/cover' : '#667eea') + ';">';
        html += '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.7),transparent 55%);"></div>';
        if (!allCover) {
            html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;">📷</div>';
        }
        html += '<div style="position:absolute;bottom:0;left:0;right:0;padding:16px;color:#fff;">';
        html += '<h3 style="margin:0;font-size:18px;">所有照片</h3>';
        html += '<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">共 ' + allCount + ' 张照片</p>';
        html += '</div></div>';

        /* 各相册卡片 */
        FA.albums.forEach(function (album) {
            var count = countPhotosInAlbum(album.id);
            var cover = album.cover;
            if (!cover) {
                var photos = getPhotosInAlbum(album.id);
                if (photos.length > 0) cover = photos[photos.length - 1].url;
            }

            html += '<div onclick="FA.filterPhotos(\'' + album.id + '\')" style="position:relative;height:260px;border-radius:14px;overflow:hidden;cursor:pointer;background:' + (cover ? 'url(\'' + cover + '\') center/cover' : '#999') + ';">';
            html += '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.7),transparent 55%);"></div>';
            if (!cover) {
                html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;">📁</div>';
            }

            /* 编辑/删除按钮（默认相册不显示） */
            if (album.id !== 'default') {
                html += '<div style="position:absolute;top:10px;right:10px;display:flex;gap:6px;" onclick="event.stopPropagation()">';
                if (FA.checkPermission('createAlbum') || FA.checkPermission('editAlbum')) {
                    html += '<button onclick="FA.editAlbum(\'' + album.id + '\')" title="编辑相册" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✎</button>';
                }
                if (FA.checkPermission('deleteAlbum')) {
                    html += '<button onclick="FA.deleteAlbum(\'' + album.id + '\')" title="删除相册" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(231,76,60,0.75);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>';
                }
                html += '</div>';
            }

            html += '<div style="position:absolute;bottom:0;left:0;right:0;padding:16px;color:#fff;">';
            html += '<h3 style="margin:0;font-size:18px;">' + escapeHtml(album.name) + '</h3>';
            if (album.description) {
                html += '<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">' + escapeHtml(album.description) + '</p>';
            }
            html += '<p style="margin:2px 0 0;font-size:12px;opacity:0.7;">' + count + ' 张照片</p>';
            html += '</div></div>';
        });

        html += '</div>';
        return html;
    }

    /* 渲染照片网格视图 */
    function renderPhotoGrid() {
        var photos = [];
        var title = '';

        if (currentAlbumFilter === 'all') {
            photos = FA.photos || [];
            title = '所有照片';
        } else {
            var album = getAlbum(currentAlbumFilter);
            title = album ? album.name : '相册';
            photos = getPhotosInAlbum(currentAlbumFilter);
        }

        var html = '';

        /* 顶部栏 */
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<button onclick="FA.filterPhotos(\'albums\')" style="padding:8px 14px;background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.06);border-radius:8px;cursor:pointer;font-size:14px;color:#555;">← 返回相册</button>';
        html += '<h2 style="margin:0;font-size:20px;color:#333;">' + escapeHtml(title) + '</h2>';
        html += '</div>';
        if (FA.checkPermission('addPhoto')) {
            html += '<button onclick="FA.showUploadDialog()" style="background:#007AFF;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px;">+ 上传照片</button>';
        }
        html += '</div>';

        /* 照片网格 */
        if (photos.length === 0) {
            html += '<div class="photo-empty"><div class="empty-icon">📷</div><p>暂无照片</p><p class="empty-hint">点击"上传照片"添加</p></div>';
            return html;
        }

        html += '<div class="photo-grid">';
        photos.forEach(function (photo, idx) {
            html += '<div class="photo-item" onclick="FA.openPhotoViewer(' + idx + ')">';
            html += '<img src="' + photo.url + '" alt="' + escapeHtml(photo.title) + '">';
            html += '<div class="photo-overlay">';
            html += '<span>' + escapeHtml(photo.title || '家庭照片') + '</span>';
            if (FA.checkPermission('deletePhoto')) {
                html += '<button class="photo-delete" onclick="event.stopPropagation();FA.deletePhoto(\'' + photo.id + '\')">删除</button>';
            }
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';

        return html;
    }

    /* =====================
       筛选切换
       ===================== */
    FA.filterPhotos = function (albumId) {
        currentAlbumFilter = albumId || 'albums';
        FA.renderPhotos();
    };

    /* =====================
       相册管理
       ===================== */
    FA.createAlbum = function () {
        if (!FA.checkPermission('createAlbum')) return FA.showToast('权限不足', 'error');

        editingAlbumId = null;
        tempCoverUrl = '';

        var modalId = 'album-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML = buildAlbumModalHTML('创建相册', '', '', '');
        document.body.appendChild(modal);
        FA.showModal(modalId);
    };

    FA.editAlbum = function (albumId) {
        if (!FA.checkPermission('createAlbum') && !FA.checkPermission('editAlbum')) {
            return FA.showToast('权限不足', 'error');
        }

        var album = getAlbum(albumId);
        if (!album) return;

        editingAlbumId = albumId;
        tempCoverUrl = album.cover || '';

        var modalId = 'album-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML = buildAlbumModalHTML('编辑相册', album.name, album.description || '', album.cover || '');
        document.body.appendChild(modal);
        FA.showModal(modalId);
    };

    function buildAlbumModalHTML(title, name, desc, cover) {
        var coverPreview;
        if (cover) {
            coverPreview = '<img src="' + cover + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;">';
        } else {
            coverPreview = '<div style="width:100%;height:80px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">暂无封面</div>';
        }

        return '<div class="modal-content">' +
            '<button class="modal-close" onclick="FA.closeModal(\'album-modal\')">&times;</button>' +
            '<div class="modal-header"><h3>' + title + '</h3></div>' +
            '<div class="modal-field"><label>相册名称</label><input id="albumNameInput" type="text" value="' + escapeHtml(name) + '" placeholder="请输入相册名称"></div>' +
            '<div class="modal-field"><label>相册描述</label><input id="albumDescInput" type="text" value="' + escapeHtml(desc) + '" placeholder="请输入相册描述"></div>' +
            '<div class="modal-field"><label>相册封面</label>' +
                '<div id="albumCoverPreview">' + coverPreview + '</div>' +
                '<div style="display:flex;gap:10px;margin-top:8px;">' +
                    '<button type="button" onclick="FA.selectAlbumCover(null, false)" style="padding:6px 12px;background:#f0f0f0;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;">📷 上传封面</button>' +
                    '<button type="button" onclick="FA.selectAlbumCover(null, true)" style="padding:6px 12px;background:#f0f0f0;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;">🖼️ 从照片选择</button>' +
                '</div>' +
            '</div>' +
            '<div class="modal-actions">' +
                '<button class="btn-secondary" onclick="FA.closeModal(\'album-modal\')">取消</button>' +
                '<button class="btn-primary" onclick="FA.confirmAlbum()">保存</button>' +
            '</div>' +
        '</div>';
    }

    FA.confirmAlbum = function () {
        var nameInput = document.getElementById('albumNameInput');
        var descInput = document.getElementById('albumDescInput');
        if (!nameInput) return;

        var name = nameInput.value.trim();
        var desc = descInput ? descInput.value.trim() : '';

        if (!name) return FA.showToast('请输入相册名称', 'error');

        if (editingAlbumId) {
            var album = getAlbum(editingAlbumId);
            if (album) {
                album.name = name;
                album.description = desc;
                album.cover = tempCoverUrl;
                saveAlbums();
                FA.renderPhotos();
                FA.showToast('相册已更新', 'success');
            }
        } else {
            FA.albums.push({
                id: genAlbumId(),
                name: name,
                description: desc,
                cover: tempCoverUrl,
                createdDate: new Date().toISOString()
            });
            saveAlbums();
            FA.renderPhotos();
            FA.showToast('相册创建成功', 'success');
        }

        FA.closeModal('album-modal');
        editingAlbumId = null;
        tempCoverUrl = '';
    };

    FA.deleteAlbum = function (albumId) {
        if (!FA.checkPermission('deleteAlbum')) return FA.showToast('权限不足', 'error');
        if (albumId === 'default') return FA.showToast('默认相册不能删除', 'error');
        if (!confirm('删除相册后，相册内的照片将移至默认相册。确定删除？')) return;

        /* 将照片移至默认相册 */
        (FA.photos || []).forEach(function (p) {
            if (p.albumId === albumId) p.albumId = 'default';
        });

        /* 删除相册 */
        FA.albums = FA.albums.filter(function (a) { return a.id !== albumId; });

        savePhotos();
        saveAlbums();

        if (currentAlbumFilter === albumId) {
            currentAlbumFilter = 'albums';
        }

        FA.renderPhotos();
        FA.showToast('相册已删除，照片已移至默认相册', 'info');
    };

    /* 选择相册封面 */
    FA.selectAlbumCover = function (albumId, fromExisting) {
        if (fromExisting) {
            showCoverPicker();
        } else {
            triggerCoverUpload();
        }
    };

    function triggerCoverUpload() {
        var input = document.getElementById('tempCoverInput');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'tempCoverInput';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.addEventListener('change', function (e) {
                var file = e.target.files[0];
                if (!file) return;
                compressImage(file, function (dataUrl) {
                    tempCoverUrl = dataUrl;
                    updateCoverPreview();
                });
                e.target.value = '';
            });
            document.body.appendChild(input);
        }
        input.click();
    }

    function updateCoverPreview() {
        var preview = document.getElementById('albumCoverPreview');
        if (!preview) return;
        if (tempCoverUrl) {
            preview.innerHTML = '<img src="' + tempCoverUrl + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;">';
        } else {
            preview.innerHTML = '<div style="width:100%;height:80px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">暂无封面</div>';
        }
    }

    function showCoverPicker() {
        if (!FA.photos || FA.photos.length === 0) {
            return FA.showToast('暂无照片可选择，请先上传照片', 'error');
        }

        var modalId = 'cover-picker-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        var photosHTML = FA.photos.map(function (p, idx) {
            return '<div onclick="FA.pickCover(' + idx + ')" style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;background:#f0f0f0;position:relative;">' +
                '<img src="' + p.url + '" style="width:100%;height:100%;object-fit:cover;">' +
                '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:6px;color:#fff;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(p.title || '照片') + '</div>' +
            '</div>';
        }).join('');

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML =
            '<div class="modal-content" style="max-width:600px;">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>选择封面照片</h3></div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;max-height:400px;overflow-y:auto;padding:4px;">' +
                    photosHTML +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    }

    FA.pickCover = function (index) {
        if (index >= 0 && index < (FA.photos || []).length) {
            tempCoverUrl = FA.photos[index].url;
            FA.closeModal('cover-picker-modal');
            updateCoverPreview();
        }
    };

    /* =====================
       照片上传
       ===================== */
    FA.showUploadDialog = function () {
        if (!FA.checkPermission('addPhoto')) return FA.showToast('权限不足', 'error');

        var modalId = 'photo-upload-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

        /* 默认选中当前查看的相册 */
        var defaultAlbum = 'default';
        if (currentAlbumFilter !== 'albums' && currentAlbumFilter !== 'all') {
            defaultAlbum = currentAlbumFilter;
        }

        var albumOptions = (FA.albums || []).map(function (a) {
            return '<option value="' + a.id + '"' + (a.id === defaultAlbum ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
        }).join('');

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        modal.innerHTML =
            '<div class="modal-content">' +
                '<button class="modal-close" onclick="FA.closeModal(\'' + modalId + '\')">&times;</button>' +
                '<div class="modal-header"><h3>上传照片</h3></div>' +
                '<div class="modal-field"><label>选择相册</label>' +
                    '<select id="uploadAlbumSelect" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">' + albumOptions + '</select>' +
                '</div>' +
                '<div class="modal-field"><label>选择照片</label>' +
                    '<button type="button" onclick="document.getElementById(\'photoFileInput\').click()" style="padding:10px 20px;background:#007AFF;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">选择照片</button>' +
                    '<input type="file" id="photoFileInput" accept="image/*" multiple style="display:none" onchange="FA.uploadPhoto(event)">' +
                    '<p style="font-size:12px;color:#999;margin-top:8px;">支持多张照片上传，自动压缩至800px</p>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        FA.showModal(modalId);
    };

    FA.uploadPhoto = function (event) {
        if (!FA.checkPermission('addPhoto')) return FA.showToast('权限不足', 'error');

        var files = event.target.files;
        if (!files || files.length === 0) return;

        /* 从下拉框获取目标相册 */
        var albumSelect = document.getElementById('uploadAlbumSelect');
        var albumId = albumSelect ? albumSelect.value : 'default';

        var total = files.length;
        var processed = 0;

        for (var i = 0; i < files.length; i++) {
            (function (file) {
                compressImage(file, function (dataUrl) {
                    var photo = {
                        id: genId(),
                        url: dataUrl,
                        title: file.name.replace(/\.[^.]+$/, '') || '家庭照片',
                        albumId: albumId,
                        uploadDate: FA.getTodayStr()
                    };
                    if (!FA.photos) FA.photos = [];
                    FA.photos.unshift(photo);
                    processed++;

                    if (processed === total) {
                        savePhotos();
                        FA.closeModal('photo-upload-modal');
                        FA.renderPhotos();

                        var albumName = '相册';
                        var album = getAlbum(albumId);
                        if (album) albumName = album.name;

                        FA.Data.addNotification('success', '照片上传', '上传了 ' + total + ' 张照片到「' + albumName + '」');
                        FA.showToast('照片上传成功', 'success');
                    }
                });
            })(files[i]);
        }

        event.target.value = '';
    };

    FA.deletePhoto = function (photoId) {
        if (!FA.checkPermission('deletePhoto')) return FA.showToast('权限不足', 'error');
        if (!confirm('确定删除这张照片？')) return;

        FA.photos = (FA.photos || []).filter(function (p) { return p.id !== photoId; });
        savePhotos();
        FA.renderPhotos();
        FA.showToast('照片已删除', 'info');
    };

    /* =====================
       照片查看器 (全屏)
       ===================== */
    FA.openPhotoViewer = function (index) {
        /* 根据当前视图获取照片列表 */
        if (currentAlbumFilter === 'all') {
            viewerPhotos = FA.photos || [];
        } else if (currentAlbumFilter === 'albums') {
            viewerPhotos = FA.photos || [];
        } else {
            viewerPhotos = getPhotosInAlbum(currentAlbumFilter);
        }

        if (!viewerPhotos.length || index < 0 || index >= viewerPhotos.length) return;

        viewerIndex = index;

        var viewer = document.getElementById('photoViewer');
        if (!viewer) {
            viewer = createPhotoViewer();
            document.body.appendChild(viewer);
        }

        showPhotoInViewer();
        viewer.style.display = 'flex';
        document.addEventListener('keydown', viewerKeyHandler);
    };

    function createPhotoViewer() {
        var viewer = document.createElement('div');
        viewer.id = 'photoViewer';
        viewer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.95);z-index:9999;display:none;align-items:center;justify-content:center;';

        viewer.innerHTML =
            /* 关闭按钮 */
            '<button onclick="FA.closePhotoViewer()" title="关闭" style="position:absolute;top:20px;right:24px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:24px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">&times;</button>' +
            /* 下载按钮 */
            '<button onclick="FA.downloadPhoto()" title="下载" style="position:absolute;top:20px;left:24px;padding:8px 16px;border-radius:8px;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:14px;cursor:pointer;z-index:2;display:flex;align-items:center;gap:6px;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">⬇ 下载</button>' +
            /* 上一张按钮 */
            '<button onclick="FA.prevPhoto()" title="上一张" style="position:absolute;left:24px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:28px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">&#8249;</button>' +
            /* 下一张按钮 */
            '<button onclick="FA.nextPhoto()" title="下一张" style="position:absolute;right:24px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:28px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">&#8250;</button>' +
            /* 照片 */
            '<img id="photoViewerImg" style="max-width:90vw;max-height:85vh;object-fit:contain;user-select:none;" src="">' +
            /* 底部信息 */
            '<div id="photoViewerInfo" style="position:absolute;bottom:24px;left:0;right:0;text-align:center;color:#fff;pointer-events:none;"></div>';

        /* 点击空白区域关闭 */
        viewer.addEventListener('click', function (e) {
            if (e.target === viewer || e.target.id === 'photoViewerImg') {
                /* 只有点击 viewer 本身或图片以外区域才关闭 */
                if (e.target === viewer) FA.closePhotoViewer();
            }
        });

        return viewer;
    }

    function showPhotoInViewer() {
        var photo = viewerPhotos[viewerIndex];
        if (!photo) return;

        var img = document.getElementById('photoViewerImg');
        var info = document.getElementById('photoViewerInfo');

        if (img) img.src = photo.url;
        if (info) {
            info.innerHTML =
                '<div style="font-size:16px;font-weight:500;">' + escapeHtml(photo.title || '家庭照片') + '</div>' +
                '<div style="font-size:13px;opacity:0.7;margin-top:4px;">' + escapeHtml(photo.uploadDate || '') + ' · ' + (viewerIndex + 1) + ' / ' + viewerPhotos.length + '</div>';
        }
    }

    function viewerKeyHandler(e) {
        if (e.key === 'Escape') {
            FA.closePhotoViewer();
        } else if (e.key === 'ArrowLeft') {
            FA.prevPhoto();
        } else if (e.key === 'ArrowRight') {
            FA.nextPhoto();
        }
    }

    FA.closePhotoViewer = function () {
        var viewer = document.getElementById('photoViewer');
        if (viewer) viewer.style.display = 'none';
        document.removeEventListener('keydown', viewerKeyHandler);
        viewerPhotos = [];
        viewerIndex = 0;
    };

    FA.prevPhoto = function () {
        if (!viewerPhotos.length) return;
        viewerIndex = (viewerIndex - 1 + viewerPhotos.length) % viewerPhotos.length;
        showPhotoInViewer();
    };

    FA.nextPhoto = function () {
        if (!viewerPhotos.length) return;
        viewerIndex = (viewerIndex + 1) % viewerPhotos.length;
        showPhotoInViewer();
    };

    /* 下载当前查看的照片 */
    FA.downloadPhoto = function () {
        if (viewerIndex < 0 || viewerIndex >= viewerPhotos.length) return;
        var photo = viewerPhotos[viewerIndex];

        /* base64 转 Blob */
        var arr = photo.url.split(',');
        var mime = arr[0].match(/:(.*?);/)[1];
        var bstr = atob(arr[1]);
        var n = bstr.length;
        var u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        var blob = new Blob([u8arr], { type: mime });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = (photo.title || 'photo') + '.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        FA.showToast('照片下载已开始', 'success');
    };

})();
