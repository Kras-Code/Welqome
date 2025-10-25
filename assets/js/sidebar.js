/* =========================================================
   MOBILE DRAWER + SUBMENUS + SCROLL-SPY (single, clean bundle)
   - Preserves your .active styling (white text + gradient ::after)
   - When the drawer opens and the current section lives in a submenu,
     that submenu is expanded automatically (without setting .user-opened).
   - Manual taps add .user-opened so scroll-driven auto-open won’t fight the user.
   ========================================================= */
(function () {
    // ---------- cache ----------
    const desktopList = document.querySelector('#sidebar nav > ul');
    const mobileList = document.querySelector('#m-sidebar nav > ul.menu');
    const toggle = document.getElementById('mSidebarToggle');
    const drawer = document.getElementById('m-sidebar');
    const backdrop = document.getElementById('m-sidebar-backdrop');
    if (!mobileList || !toggle || !drawer || !backdrop) return;

    // Clone desktop items into mobile once (author in one place)
    if (desktopList && !mobileList.children.length) {
        mobileList.innerHTML = desktopList.innerHTML;
    }

    // ---------- utils ----------
    const mmMobile = window.matchMedia('(max-width: 736px)');
    const isMobile = () => mmMobile.matches;
    const px = n => `${Math.max(0, Math.round(n))}px`;

    // ---------- submenu prep ----------
    function prepareSubmenus(root) {
        root.querySelectorAll('li.has-submenu').forEach((li, i) => {
            const a = li.querySelector(':scope > a');
            const submenu = li.querySelector(':scope > ul.submenu');
            if (!a || !submenu) return;

            const id = submenu.id || `m-submenu-${i}`;
            submenu.id = id;
            a.setAttribute('aria-controls', id);
            a.setAttribute('aria-expanded', 'false');

            let caret = a.querySelector('.wq-caret');
            if (!caret) {
                caret = document.createElement('span');
                caret.className = 'wq-caret';
                a.appendChild(caret);
            }
            caret.setAttribute('role', 'button');
            caret.setAttribute('tabindex', '0');
            caret.setAttribute('aria-label', 'Toggle submenu');

            li.classList.remove('is-open');
            submenu.style.maxHeight = '0px';
        });
    }
    prepareSubmenus(mobileList);

    const measure = submenu => {
        const prev = submenu.style.maxHeight;
        submenu.style.maxHeight = 'none';
        const h = submenu.scrollHeight;
        submenu.style.maxHeight = prev;
        return h;
    };

    // source: 'user' (sets .user-opened) | 'auto' (does not)
    function openSubmenu(li, opts = {}) {
        const source = opts.source || 'user';
        const a = li.querySelector(':scope > a');
        const submenu = li.querySelector(':scope > ul.submenu');
        if (!submenu || li.classList.contains('is-open')) return;

        // close siblings (accordion)
        li.parentElement.querySelectorAll(':scope > li.has-submenu.is-open').forEach(sib => {
            if (sib !== li) closeSubmenu(sib);
        });

        li.classList.add('is-open');
        a?.setAttribute('aria-expanded', 'true');
        submenu.style.maxHeight = px(measure(submenu));
        if (source === 'user') drawer.classList.add('user-opened');
    }

    function closeSubmenu(li) {
        const a = li.querySelector(':scope > a');
        const submenu = li.querySelector(':scope > ul.submenu');
        if (!submenu) return;
        li.classList.remove('is-open');
        a?.setAttribute('aria-expanded', 'false');
        submenu.style.maxHeight = '0px';
    }
    function closeAllSubmenus() {
        mobileList.querySelectorAll('li.has-submenu.is-open').forEach(closeSubmenu);
    }

    function getActiveSubmenuLI() {
        let found = null;
        mobileList.querySelectorAll('li.has-submenu').forEach(li => {
            if (!found && li.querySelector('ul.submenu a.active')) found = li;
        });
        return found;
    }
    function ensureActiveSubmenuOpen() {
        const li = getActiveSubmenuLI();
        if (li) openSubmenu(li, { source: 'auto' });
    }

    // ---------- drawer controls ----------
    function openDrawer() {
        drawer.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        backdrop.removeAttribute('hidden');

        // Auto-expand the submenu containing the current .active link
        requestAnimationFrame(ensureActiveSubmenuOpen);
    }
    function closeDrawer() {
        drawer.classList.remove('is-open');
        drawer.classList.remove('user-opened'); // reset: allow scroll-spy auto-open next time
        toggle.setAttribute('aria-expanded', 'false');
        backdrop.setAttribute('hidden', '');
        closeAllSubmenus();
    }

    toggle.addEventListener('click', e => {
        e.preventDefault();
        drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    // ---------- delegated interactions (mobile) ----------
    mobileList.addEventListener('click', e => {
        const caret = e.target.closest('.wq-caret');
        const link = e.target.closest('a');

        // caret toggles
        if (caret && isMobile()) {
            e.preventDefault();
            const li = caret.closest('li.has-submenu');
            if (!li) return;
            li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li, { source: 'user' });
            return;
        }

        // parent link with inert href also toggles
        if (link && isMobile()) {
            const li = link.closest('li.has-submenu');
            const href = link.getAttribute('href') || '';
            if (li && (!href || href === '#' || href === '#!')) {
                e.preventDefault();
                li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li, { source: 'user' });
                return;
            }
        }

        // Real navigation inside drawer → close for responsiveness
        if (link) {
            const href = link.getAttribute('href') || '';
            if (href && href !== '#' && href !== '#!') closeDrawer();
        }
    });

    mobileList.addEventListener('keydown', e => {
        const caret = e.target.closest('.wq-caret');
        if (!caret || !isMobile()) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const li = caret.closest('li.has-submenu');
            if (!li) return;
            li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li, { source: 'user' });
        }
    });

    // Keep open heights correct on content resize
    const ro = new ResizeObserver(() => {
        mobileList.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(sub => {
            sub.style.maxHeight = px(measure(sub));
        });
    });
    ro.observe(mobileList);

    // Reset when breakpoint flips to avoid stale inline heights
    mmMobile.addEventListener('change', () => {
        closeDrawer();
        mobileList.querySelectorAll('ul.submenu').forEach(sub => (sub.style.maxHeight = '0px'));
    });

    /* =========================================================
       SCROLL-SPY (safe .active handling + submenu sync)
       ========================================================= */
    const CENTERLINE = 0.35;                 // 35% down the viewport
    const CSS_HEADROOM_VAR = '--scrollspy-headroom';
    const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const idFromHash = h => (h || '').replace(/^[^#]*#/, '').trim();
    const samePath = (url) => {
        try { const u = new URL(url, location.href); return u.pathname === location.pathname; }
        catch { return false; }
    };
    const getHeadroom = () => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(CSS_HEADROOM_VAR);
        const v = parseFloat(raw);
        return Number.isFinite(v) ? v : 0;
    };

    // Only manage same-page anchors pointing to existing sections
    const linkSelector = [
        '#sidebar nav a[href^="#"]',
        '#m-sidebar nav a[href^="#"]',
        '#sidebar nav a[href*="#"]:not([href^="http"]):not([href^="//"])',
        '#m-sidebar nav a[href*="#"]:not([href^="http"]):not([href^="//"])'
    ].join(',');

    let linkMap = new Map();   // id -> [a, a, ...] (both navs)
    let managedLinks = [];     // flattened list of anchors we control
    let sections = [];         // [{id, el, top, bottom}]
    let currentId = null;      // last applied id

    function collectLinks() {
        linkMap.clear();
        managedLinks = [];
        const links = $all(linkSelector).filter(a => {
            const href = a.getAttribute('href') || '';
            const id = idFromHash(href);
            if (!id) return false;
            if (href.startsWith('#') || samePath(href)) return !!document.getElementById(id);
            return false;
        });
        for (const a of links) {
            const id = idFromHash(a.getAttribute('href'));
            if (!linkMap.has(id)) linkMap.set(id, []);
            linkMap.get(id).push(a);
            managedLinks.push(a);
        }
    }

    function indexSections() {
        sections = [];
        for (const [id] of linkMap) {
            const el = document.getElementById(id);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            const top = r.top + window.scrollY;
            const bottom = r.bottom + window.scrollY;
            sections.push({ id, el, top, bottom });
        }
        sections.sort((a, b) => a.top - b.top);
    }

    function pickCurrent() {
        if (sections.length === 0) return null;
        const headroom = getHeadroom();
        const probeY = window.scrollY + headroom + window.innerHeight * CENTERLINE;

        // Prefer containing section
        let s = sections.find(s => s.top <= probeY && s.bottom > probeY);
        if (s) return s.id;

        // Otherwise nearest by center
        let best = sections[0], bestDist = Math.abs((best.top + best.bottom) / 2 - probeY);
        for (const t of sections) {
            const d = Math.abs((t.top + t.bottom) / 2 - probeY);
            if (d < bestDist) { best = t; bestDist = d; }
        }
        return best.id;
    }

    // Only touch .active on links we manage (preserves your styling elsewhere)
    function setActiveId(nextId) {
        if (!nextId || nextId === currentId) { syncSpyOpen(); return; }
        for (const a of managedLinks) a.classList.remove('active');
        const group = linkMap.get(nextId) || [];
        for (const a of group) a.classList.add('active');
        currentId = nextId;
        syncSpyOpen();
        // If the drawer is open, ensure the relevant submenu is expanded
        if (drawer.classList.contains('is-open')) ensureActiveSubmenuOpen();
    }

    // Class-based submenu sync for browsers without :has()
    function syncSpyOpen() {
        const allowAuto = !drawer.classList.contains('user-opened');
        document.querySelectorAll('#m-sidebar nav li.has-submenu').forEach(li => {
            if (!allowAuto) { li.classList.remove('spy-open'); return; }
            const hasActive = !!li.querySelector('ul.submenu a.active');
            li.classList.toggle('spy-open', hasActive);
        });
    }

    // ---------- scroll-spy lifecycle ----------
    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            setActiveId(pickCurrent());
            ticking = false;
        });
    }
    function onHashChange() {
        const id = idFromHash(location.hash);
        if (!id) return;
        setActiveId(id);
    }
    function onClick(e) {
        const a = e.target.closest('a');
        if (!a || !a.matches(linkSelector)) return;
        const href = a.getAttribute('href') || '';
        const id = idFromHash(href);
        if (!id) return;
        // Immediate feedback; onScroll reconciles after the jump
        setActiveId(id);
    }
    function reindex() {
        collectLinks();
        indexSections();
        const initial = idFromHash(location.hash) || pickCurrent();
        setActiveId(initial);
    }

    // init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', reindex, { once: true });
    } else {
        reindex();
    }
    window.addEventListener('load', reindex, { once: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { indexSections(); onScroll(); }, { passive: true });
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick, { capture: true });
})();