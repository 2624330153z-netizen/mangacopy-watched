// ==UserScript==
// @name         Mangacopy 看过漫画屏蔽
// @namespace    https://www.mangacopy.com
// @version      2.1
// @description  在漫画列表中添加"看过"按钮，可模糊/隐藏看过的漫画，支持导入导出数据
// @author       You
// @match        https://www.mangacopy.com/comics*
// @match        https://www.mangacopy.com/filter*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'mangacopy_watched_comics';
    const HIDE_KEY = 'mangacopy_hide_watched';

    function getWatchedSet() {
        try {
            return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
        } catch(e) { return new Set(); }
    }

    function saveWatchedSet(s) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
    }

    function isHideMode() {
        return localStorage.getItem(HIDE_KEY) === 'true';
    }

    function setHideMode(v) {
        localStorage.setItem(HIDE_KEY, v ? 'true' : 'false');
    }

    // 从 /comic/xxx 链接中提取 path_word
    function extractId(href) {
        const m = href.match(/\/comic\/([^/?#]+)/);
        return m ? m[1] : null;
    }

    // 创建顶部控制栏
    function createControlBar(watchedSet) {
        if (document.getElementById('mc-ctrl-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'mc-ctrl-bar';
        Object.assign(bar.style, {
            position: 'fixed',
            bottom: '10px',
            left: '20px',
            zIndex: '99999',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255,255,255,0.96)',
            padding: '8px 14px',
            borderRadius: '8px',
            boxShadow: '0 2px 14px rgba(0,0,0,0.15)',
            fontFamily: 'sans-serif',
            fontSize: '13px'
        });

        const countEl = document.createElement('span');
        countEl.style.color = '#666';
        countEl.textContent = '已看过: ' + watchedSet.size + ' 部';

        const hideMode = isHideMode();
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = hideMode ? '显示全部' : '隐藏看过';
        Object.assign(toggleBtn.style, {
            padding: '5px 12px',
            border: '1px solid #e74c3c',
            borderRadius: '4px',
            background: hideMode ? '#e74c3c' : '#fff',
            color: hideMode ? '#fff' : '#e74c3c',
            cursor: 'pointer',
            fontSize: '12px'
        });

        toggleBtn.addEventListener('click', () => {
            const newHide = !isHideMode();
            setHideMode(newHide);
            toggleBtn.textContent = newHide ? '显示全部' : '隐藏看过';
            toggleBtn.style.background = newHide ? '#e74c3c' : '#fff';
            toggleBtn.style.color = newHide ? '#fff' : '#e74c3c';

            document.querySelectorAll('.mc-watched').forEach(el => {
                el.style.display = newHide ? 'none' : '';
            });

            const s = getWatchedSet();
            countEl.textContent = '已看过: ' + s.size + ' 部';
        });

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出';
        Object.assign(exportBtn.style, {
            padding: '5px 12px',
            border: '1px solid #27ae60',
            borderRadius: '4px',
            background: '#fff',
            color: '#27ae60',
            cursor: 'pointer',
            fontSize: '12px'
        });
        exportBtn.addEventListener('click', () => {
            const s = getWatchedSet();
            const data = JSON.stringify([...s], null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mangacopy-watched-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.json';
        importInput.style.display = 'none';
        importInput.addEventListener('change', () => {
            const file = importInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arr = JSON.parse(e.target.result);
                    if (!Array.isArray(arr) || !arr.every(x => typeof x === 'string')) {
                        alert('文件格式不正确，应为 path_word 字符串数组');
                        return;
                    }
                    showImportDialog(arr.length, (action) => {
                        if (action === 'cancel') return;
                        const w = getWatchedSet();
                        if (action === 'overwrite') {
                            const newSet = new Set(arr);
                            saveWatchedSet(newSet);
                        } else {
                            arr.forEach(id => w.add(id));
                            saveWatchedSet(w);
                        }
                        location.reload();
                    });
                } catch (err) {
                    alert('导入失败：文件内容无法解析');
                }
            };
            reader.readAsText(file);
            importInput.value = '';
        });
        document.body.appendChild(importInput);

        const importBtn = document.createElement('button');
        importBtn.textContent = '导入';
        Object.assign(importBtn.style, {
            padding: '5px 12px',
            border: '1px solid #27ae60',
            borderRadius: '4px',
            background: '#fff',
            color: '#27ae60',
            cursor: 'pointer',
            fontSize: '12px'
        });
        importBtn.addEventListener('click', () => importInput.click());

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清除记录';
        Object.assign(clearBtn.style, {
            padding: '5px 12px',
            border: '1px solid #999',
            borderRadius: '4px',
            background: '#fff',
            color: '#999',
            cursor: 'pointer',
            fontSize: '12px'
        });
        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清除所有"看过"记录吗？此操作不可恢复。')) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(HIDE_KEY);
                location.reload();
            }
        });

        bar.appendChild(countEl);
        bar.appendChild(toggleBtn);
        bar.appendChild(exportBtn);
        bar.appendChild(importBtn);
        bar.appendChild(clearBtn);
        document.body.appendChild(bar);
    }

    // 导入弹窗：三选一
    function showImportDialog(count, callback) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.4)', zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#fff', borderRadius: '10px', padding: '24px 28px',
            minWidth: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            fontFamily: 'sans-serif', fontSize: '14px', textAlign: 'center'
        });
        box.innerHTML = '<p style="font-size:16px;font-weight:bold;margin-bottom:8px;">导入数据</p>'
            + '<p style="color:#666;margin-bottom:20px;">共 ' + count + ' 条记录，请选择操作：</p>';

        function btnEl(text, color) {
            const b = document.createElement('button');
            b.textContent = text;
            Object.assign(b.style, {
                padding: '8px 20px', margin: '0 6px',
                border: '1px solid ' + color, borderRadius: '4px',
                background: color, color: '#fff', cursor: 'pointer', fontSize: '13px'
            });
            return b;
        }

        const overwriteBtn = btnEl('覆盖', '#e74c3c');
        const appendBtn = btnEl('追加', '#27ae60');
        const cancelBtn = btnEl('取消', '#999');

        overwriteBtn.addEventListener('click', () => { close('overwrite'); });
        appendBtn.addEventListener('click', () => { close('append'); });
        cancelBtn.addEventListener('click', () => { close('cancel'); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close('cancel'); });

        function close(action) {
            overlay.remove();
            callback(action);
        }

        box.appendChild(overwriteBtn);
        box.appendChild(appendBtn);
        box.appendChild(cancelBtn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // 处理单个漫画卡片 (.exemptComic_Item)
    function processItem(item, watchedSet, hideMode) {
        if (item.dataset.mcDone === '1') return;
        item.dataset.mcDone = '1';

        // 从链接中获取 comic id
        const link = item.querySelector('a[href*="/comic/"]');
        if (!link) return;
        const comicId = extractId(link.href);
        if (!comicId) return;

        item.dataset.mcId = comicId;

        const imgWrap = item.querySelector('.exemptComic_Item-img');
        const img = imgWrap ? imgWrap.querySelector('img') : item.querySelector('img');
        if (!img) return;

        // 创建"看过"按钮
        const isWatched = watchedSet.has(comicId);
        const btn = document.createElement('button');
        btn.textContent = isWatched ? '✓ 看过' : '看过';
        Object.assign(btn.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            zIndex: '20',
            padding: '3px 8px',
            border: '1px solid #e74c3c',
            borderRadius: '3px',
            background: isWatched ? '#e74c3c' : 'rgba(255,255,255,0.92)',
            color: isWatched ? '#fff' : '#e74c3c',
            fontSize: '11px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'sans-serif'
        });
        btn.title = isWatched ? '取消看过' : '标记为看过';

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const w = getWatchedSet();
            if (w.has(comicId)) {
                w.delete(comicId);
                btn.textContent = '看过';
                btn.style.background = 'rgba(255,255,255,0.92)';
                btn.style.color = '#e74c3c';
                btn.title = '标记为看过';
                unblur(item, img);
                item.classList.remove('mc-watched');
                item.style.display = '';
            } else {
                w.add(comicId);
                btn.textContent = '✓ 看过';
                btn.style.background = '#e74c3c';
                btn.style.color = '#fff';
                btn.title = '取消看过';
                blur(item, img);
                item.classList.add('mc-watched');
                if (isHideMode()) {
                    item.style.display = 'none';
                }
            }
            saveWatchedSet(w);
            const bar = document.getElementById('mc-ctrl-bar');
            if (bar) {
                bar.querySelector('span').textContent = '已看过: ' + w.size + ' 部';
            }
        });

        // 确保图片容器是相对定位
        if (imgWrap) {
            const cs = window.getComputedStyle(imgWrap);
            if (cs.position === 'static') imgWrap.style.position = 'relative';
            imgWrap.appendChild(btn);
        } else {
            item.style.position = 'relative';
            item.appendChild(btn);
        }

        // 应用初始状态
        if (isWatched) {
            blur(item, img);
            item.classList.add('mc-watched');
            if (hideMode) {
                item.style.display = 'none';
            }
        }
    }

    function blur(item, img) {
        img.style.filter = 'blur(14px) brightness(0.55)';
        img.style.transition = 'filter 0.3s';
        // 添加"已看"覆层
        let ov = item.querySelector('.mc-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.className = 'mc-overlay';
            ov.textContent = '已看';
            Object.assign(ov.style, {
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: '15',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                background: 'rgba(231,76,60,0.75)',
                padding: '4px 14px',
                borderRadius: '4px',
                pointerEvents: 'none',
                fontFamily: 'sans-serif'
            });
            const imgWrap = item.querySelector('.exemptComic_Item-img');
            (imgWrap || item).appendChild(ov);
        }
    }

    function unblur(item, img) {
        img.style.filter = '';
        const ov = item.querySelector('.mc-overlay');
        if (ov) ov.remove();
    }

    // 扫描所有漫画卡片
    function scanAll() {
        const watchedSet = getWatchedSet();
        const hideMode = isHideMode();
        const items = document.querySelectorAll('.exemptComic_Item');
        items.forEach(item => processItem(item, watchedSet, hideMode));
        createControlBar(watchedSet);
    }

    // 轮询等待漫画渲染完成（因为 JS 渲染可能晚于脚本执行）
    function waitAndScan(retries) {
        retries = retries || 0;
        const items = document.querySelectorAll('.exemptComic_Item');
        if (items.length > 0) {
            scanAll();
            return;
        }
        if (retries < 30) {
            setTimeout(() => waitAndScan(retries + 1), 200);
        }
    }

    // MutationObserver 监听翻页等DOM变化
    function observeDOM() {
        const observer = new MutationObserver(() => {
            const items = document.querySelectorAll('.exemptComic_Item:not([data-mc-done="1"])');
            if (items.length > 0) scanAll();
        });
        const target = document.querySelector('.exemptComicList') || document.body;
        observer.observe(target, { childList: true, subtree: true });
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { waitAndScan(); observeDOM(); });
    } else {
        waitAndScan();
        observeDOM();
    }

})();
