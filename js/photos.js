/* ======================================================================
   photos.js - 家庭相册模块
   修复: 相册网格/照片网格切换显示
   新增: 鼠标悬浮显示上传时间(左上角)
   新增: 照片查看器右侧信息面板(文件名/格式/尺寸等)
   ====================================================================== */

window.FA = window.FA || {};

(function () {

    var currentAlbumFilter = 'albums';
    var viewerPhotos = [];
    var viewerIndex = 0;
    var tempCoverUrl = '';
    var editingAlbumId = null;

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

    /* 压缩图片至 800px 最大边，输出 base64 + 元数据 */
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
                var dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                /* 估算文件大小 (base64 长度 * 3/4) */
                var base64Data = dataUrl.split(',')[1] || '';
                var fileSize = Math.round(base64Data.length * 3 / 4);

                callback({
                    url: dataUrl,
                    originalWidth: img.width,
                    originalHeight: img.height,
                    compressedWidth: w,
                    compressedHeight: h,
                    fileSize: fileSize,
                    fileType: file.type || 'image/jpeg',
                    fileName: file.name
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes <= 0) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function getFileFormat(type) {
        if (!type) return '-';
        var map = {
            'image/jpeg': 'JPEG',
            'image/png': 'PNG',
            'image/gif': 'GIF',
            'image/webp': 'WebP',
            'image/svg+xml': 'SVG',
            'image/bmp': 'BMP'
        };
        return map[type] || type.replace('image/', '').toUpperCase();
    }

    function savePhotos() {
        FA.Data.saveData(FA.DB_KEYS.photos, FA.photos);
    }

    function saveAlbums() {
        FA.Data.saveData(FA.DB_KEYS.albums, FA.albums);
    }

    /* =====================
       渲染 - 修复: 正确切换 albumView / photoView
       ===================== */
    FA.renderPhotos = function () {
        ensureDefaultAlbum();
        var photoGrid = document.getElementById('photoGrid');
        var albumView = document.getElementById('albumView');
        var photoView = document.getElementById('photoView');
        if (!photoGrid) return;

        if (currentAlbumFilter === 'albums') {
            /* 相册网格视图: 显示 albumView, 隐藏 photoView */
            if (photoView) photoView.style.display = 'none';
            if (albumView) {
                albumView.style.display = 'block';
                albumView.innerHTML = renderAlbumGrid();
            }
        } else {
            /* 照片网格视图: 隐藏 albumView, 显示 photoView */
            if (albumView) albumView.style.display = 'none';
            if (photoView) photoView.style.display = 'block';
            photoGrid.innerHTML = renderPhotoGrid();
            photoGrid.className = 'photo-grid';
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
        html += '<div class="album-grid">';

        /* "所有照片" 卡片 */
        var allCount = (FA.photos || []).length;
        var allCover = '';
        if (FA.photos && FA.photos.length > 0) {
            allCover = FA.photos[0].url;
        }
        html += '<div class="album-card" onclick="FA.filterPhotos(\'all\')" style="background:' + (allCover ? 'url(\'' + allCover + '\') center/cover' : 'linear-gradient(135deg, #667eea, #764ba2)') + ';">';
        html += '<div class="album-card-overlay">';
        html += '<h4>所有照片</h4>';
        html += '<p>共 ' + allCount + ' 张照片</p>';
        html += '</div></div>';

        /* 各相册卡片 */
        FA.albums.forEach(function (album) {
            var count = countPhotosInAlbum(album.id);
            var cover = album.cover;
            if (!cover) {
                var photos = getPhotosInAlbum(album.id);
                if (photos.length > 0) cover = photos[0].url;
            }

            html += '<div class="album-card" onclick="FA.filterPhotos(\'' + album.id + '\')" style="background:' + (cover ? 'url(\'' + cover + '\') center/cover' : 'linear-gradient(135deg, #999, #777)') + ';">';

            /* 编辑/删除按钮 */
            if (album.id !== 'default') {
                html += '<div style="position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:5;" onclick="event.stopPropagation()">';
                if (FA.checkPermission('createAlbum') || FA.checkPermission('editAlbum')) {
                    html += '<button onclick="FA.editAlbum(\'' + album.id + '\')" title="编辑相册" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✎</button>';
                }
                if (FA.checkPermission('deleteAlbum')) {
                    html += '<button onclick="FA.deleteAlbum(\'' + album.id + '\')" title="删除相册" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(231,76,60,0.75);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>';
                }
                html += '</div>';
            }

            html += '<div class="album-card-overlay">';
            html += '<h4>' + escapeHtml(album.name) + '</h4>';
            if (album.description) {
                html += '<p>' + escapeHtml(album.description) + '</p>';
            }
            html += '<p>' + count + ' 张照片</p>';
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
            html += '<div class="empty-state"><div class="empty-icon">📷</div><p>暂无照片</p><p class="empty-hint">点击"上传照片"添加</p></div>';
            return html;
        }

        html += '<div class="photo-grid">';
        photos.forEach(function (photo, idx) {
            /* 照片项 - 悬浮显示上传时间在左上角 */
            html += '<div class="photo-item" onclick="FA.openPhotoViewer(' + idx + ')">';
            html += '<img src="' + photo.url + '" alt="' + escapeHtml(photo.title || '家庭照片') + '">';

            /* 左上角: 上传时间 (悬浮显示) */
            html += '<div class="photo-upload-time">' + escapeHtml(photo.uploadDate || '-') + '</div>';

            /* 底部: 标题和删除按钮 (悬浮显示) */
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

        (FA.photos || []).forEach(function (p) {
            if (p.albumId === albumId) p.albumId = 'default';
        });

        FA.albums = FA.albums.filter(function (a) { return a.id !== albumId; });

        savePhotos();
        saveAlbums();

        if (currentAlbumFilter === albumId) {
            currentAlbumFilter = 'albums';
        }

        FA.renderPhotos();
        FA.showToast('相册已删除，照片已移至默认相册', 'info');
    };

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
                compressImage(file, function (result) {
                    tempCoverUrl = result.url;
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
       照片上传 - 保存更多元数据
       ===================== */
    FA.showUploadDialog = function () {
        if (!FA.checkPermission('addPhoto')) return FA.showToast('权限不足', 'error');

        var modalId = 'photo-upload-modal';
        var old = document.getElementById(modalId);
        if (old) old.remove();

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

        var albumSelect = document.getElementById('uploadAlbumSelect');
        var albumId = albumSelect ? albumSelect.value : 'default';

        var total = files.length;
        var processed = 0;

        for (var i = 0; i < files.length; i++) {
            (function (file) {
                compressImage(file, function (result) {
                    var photo = {
                        id: genId(),
                        url: result.url,
                        title: (result.fileName || file.name || '家庭照片').replace(/\.[^.]+$/, ''),
                        albumId: albumId,
                        uploadDate: FA.getTodayStr(),
                        uploadTime: new Date().toISOString(),
                        originalWidth: result.originalWidth,
                        originalHeight: result.originalHeight,
                        compressedWidth: result.compressedWidth,
                        compressedHeight: result.compressedHeight,
                        fileSize: result.fileSize,
                        fileType: result.fileType,
                        fileName: result.fileName || file.name || '-'
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
       照片查看器 (全屏 + 右侧信息面板)
       ===================== */
    FA.openPhotoViewer = function (index) {
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
        viewer.className = 'photo-viewer';

        viewer.innerHTML =
            /* 关闭按钮 */
            '<button class="photo-viewer-close" onclick="FA.closePhotoViewer()">&times;</button>' +
            /* 下载按钮 */
            '<button class="photo-viewer-download" onclick="FA.downloadPhoto()">⬇ 下载</button>' +
            /* 上一张 */
            '<button class="photo-viewer-nav prev" onclick="FA.prevPhoto()">&#8249;</button>' +
            /* 下一张 */
            '<button class="photo-viewer-nav next" onclick="FA.nextPhoto()">&#8250;</button>' +
            /* 内容区: 左侧图片 + 右侧信息面板 */
            '<div class="photo-viewer-layout">' +
                '<div class="photo-viewer-image-area">' +
                    '<img id="photoViewerImg" src="">' +
                '</div>' +
                '<div class="photo-viewer-info-panel" id="photoViewerInfoPanel">' +
                    '<h3 id="photoViewerTitle"></h3>' +
                    '<div id="photoViewerDetails"></div>' +
                '</div>' +
            '</div>';

        /* 点击空白区域关闭 */
        viewer.addEventListener('click', function (e) {
            if (e.target === viewer) FA.closePhotoViewer();
        });

        return viewer;
    }

    function showPhotoInViewer() {
        var photo = viewerPhotos[viewerIndex];
        if (!photo) return;

        var img = document.getElementById('photoViewerImg');
        var titleEl = document.getElementById('photoViewerTitle');
        var detailsEl = document.getElementById('photoViewerDetails');

        if (img) img.src = photo.url;
        if (titleEl) titleEl.textContent = photo.title || '家庭照片';

        /* 构建详细信息面板 */
        var albumName = '-';
        if (photo.albumId) {
            var album = getAlbum(photo.albumId);
            if (album) albumName = album.name;
        }

        var uploadTimeStr = '-';
        if (photo.uploadTime) {
            try {
                uploadTimeStr = new Date(photo.uploadTime).toLocaleString('zh-CN');
            } catch(e) {
                uploadTimeStr = photo.uploadTime;
            }
        } else if (photo.uploadDate) {
            uploadTimeStr = photo.uploadDate;
        }

        var format = getFileFormat(photo.fileType);
        var origSize = (photo.originalWidth && photo.originalHeight) ?
            (photo.originalWidth + ' × ' + photo.originalHeight) : '-';
        var compSize = (photo.compressedWidth && photo.compressedHeight) ?
            (photo.compressedWidth + ' × ' + photo.compressedHeight) : '-';
        var fileSize = formatFileSize(photo.fileSize);
        var fileName = photo.fileName || (photo.title || '家庭照片') + '.jpg';

        if (detailsEl) {
            var rows = [
                { label: '文件名', value: escapeHtml(fileName) },
                { label: '格式', value: format },
                { label: '原始尺寸', value: origSize },
                { label: '压缩尺寸', value: compSize },
                { label: '文件大小', value: fileSize },
                { label: '所属相册', value: escapeHtml(albumName) },
                { label: '上传日期', value: escapeHtml(photo.uploadDate || '-') },
                { label: '上传时间', value: escapeHtml(uploadTimeStr) }
            ];

            var html = '<div class="photo-info-rows">';
            rows.forEach(function(row) {
                html += '<div class="photo-info-row">' +
                    '<span class="photo-info-label">' + row.label + '</span>' +
                    '<span class="photo-info-value">' + row.value + '</span>' +
                '</div>';
            });
            html += '</div>';

            /* 底部: 照片索引 */
            html += '<div class="photo-info-index">' + (viewerIndex + 1) + ' / ' + viewerPhotos.length + '</div>';

            detailsEl.innerHTML = html;
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
        var ext = '.jpg';
        if (photo.fileType) {
            var extMap = { 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/jpeg': '.jpg' };
            ext = extMap[photo.fileType] || '.jpg';
        }
        a.download = (photo.title || 'photo') + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        FA.showToast('照片下载已开始', 'success');
    };

})();
