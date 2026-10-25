// ==UserScript==
// @name         Mangacopy 看过漫画屏蔽
// @namespace    https://www.mangacopy.com
// @version      2.5
// @description  在漫画列表中添加"看过"按钮，直接将看过的漫画隐藏，支持导入导出数据；支持键盘方向键左右翻页，翻页后自动定位到排序行
// @author       You
// @match        https://www.mangacopy.com/comics*
// @match        https://www.mangacopy.com/filter*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'mangacopy_watched_comics';
    const HIDE_KEY = 'mangacopy_hide_watched';
    const SCROLL_KEY = 'mangacopy_scroll_to_sort';

    function getWatchedSet() {
        try {
            return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
        } catch(e) { return new Set(); }
    }

    function saveWatchedSet(s) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
    }

    // 默认显示全部漫画（仅当显式存储为 'true' 时才隐藏看过的漫画）
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
        toggleBtn.textContent = hideMode ? '隐藏看过' : '显示全部';
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
            toggleBtn.textContent = newHide ? '隐藏看过' : '显示全部';
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

        const hintEl = document.createElement('span');
        hintEl.style.color = '#aaa';
        hintEl.style.fontSize = '11px';
        hintEl.textContent = '← → 翻页';

        bar.appendChild(countEl);
        bar.appendChild(toggleBtn);
        bar.appendChild(exportBtn);
        bar.appendChild(importBtn);
        bar.appendChild(clearBtn);
        bar.appendChild(hintEl);
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
        btn.textContent = '看过';
        Object.assign(btn.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            zIndex: '20',
            padding: '3px 8px',
            border: '1px solid #e74c3c',
            borderRadius: '3px',
            background: isWatched ? '#e74c3c' : '#fff',
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
                item.classList.remove('mc-watched');
                item.style.display = '';
            } else {
                w.add(comicId);
                btn.textContent = '看过';
                btn.style.background = '#e74c3c';
                btn.style.color = '#fff';
                btn.title = '取消看过';
                item.classList.add('mc-watched');
                applyVisibility(item);
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
            item.classList.add('mc-watched');
            applyVisibility(item);
        }
    }

    // 根据当前隐藏模式直接隐藏或显示漫画卡片（不再模糊化）
    function applyVisibility(item) {
        item.style.filter = '';
        item.style.display = isHideMode() ? 'none' : '';
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

    // 键盘左右方向键翻页（← 上一页，→ 下一页）
    // 直接复用页面底部 ul.page-all 里的 prev / next 链接，自动保留筛选条件与边界
    function navPager(dir) {
        const link = document.querySelector('ul.page-all li.' + dir + ' a[href]');
        if (!link) return false;
        let target;
        try { target = new URL(link.getAttribute('href'), location.href); } catch (e) { return false; }
        const cur = new URL(location.href);
        const curOffset = parseInt(cur.searchParams.get('offset') || '0', 10);
        const tarOffset = parseInt(target.searchParams.get('offset') || '0', 10);
        // 已在第一页 / 最后一页时不再跳转
        if (dir === 'prev' ? tarOffset >= curOffset : tarOffset <= curOffset) return false;
        setScrollFlag();
        location.href = target.href;
        return true;
    }

    function setupKeyboardPaging() {
        document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented) return;
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            let dir = null;
            if (e.key === 'ArrowLeft' || e.key === 'Left') dir = 'prev';
            else if (e.key === 'ArrowRight' || e.key === 'Right') dir = 'next';
            if (!dir) return;
            if (navPager(dir)) e.preventDefault();
        });
    }

    // —— 翻页后把页面顶部定位到"排序"这一行 ——
    function setScrollFlag() {
        try { sessionStorage.setItem(SCROLL_KEY, '1'); } catch (e) {}
    }

    function scrollToSortRow() {
        const groups = document.querySelectorAll('.cartoon-classify');
        let target = null;
        groups.forEach(g => {
            if (!target && (g.textContent || '').indexOf('排序') !== -1) target = g;
        });
        if (!target && groups.length) target = groups[0];
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - 8));
    }

    function maybeScrollAfterPaging() {
        let need = false;
        try { need = sessionStorage.getItem(SCROLL_KEY) === '1'; } catch (e) {}
        if (!need) return;
        try { sessionStorage.removeItem(SCROLL_KEY); } catch (e) {}
        scrollToSortRow();
        // 懒加载图片可能改变布局，等资源就位后再校正一次
        if (document.readyState !== 'complete') {
            window.addEventListener('load', scrollToSortRow, { once: true });
        }
        setTimeout(scrollToSortRow, 400);
    }

    // 点击页面自带的分页链接（页码 / 上一页 / 下一页）时也打标记
    function setupPagingClickHook() {
        document.addEventListener('click', (e) => {
            const a = e.target && e.target.closest ? e.target.closest('ul.page-all a[href]') : null;
            if (!a) return;
            const href = a.getAttribute('href') || '';
            if (href.indexOf('offset=') === -1) return;
            setScrollFlag();
        }, true);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { waitAndScan(); observeDOM(); setupKeyboardPaging(); setupPagingClickHook(); maybeScrollAfterPaging(); });
    } else {
        waitAndScan();
        observeDOM();
        setupKeyboardPaging();
        setupPagingClickHook();
        maybeScrollAfterPaging();
    }

})();
