(function () {
    const desktopList = document.querySelector('#sidebar nav > ul');
    const mobileList = document.querySelector('#m-sidebar nav > ul.menu');
    const toggle = document.getElementById('mSidebarToggle');
    const drawer = document.getElementById('m-sidebar');
    const backdrop = document.getElementById('m-sidebar-backdrop');
    if (!mobileList || !toggle || !drawer || !backdrop) return;

    // Clone desktop items into mobile on first load
    if (desktopList && !mobileList.children.length) {
        mobileList.innerHTML = desktopList.innerHTML;
    }

    const mm = window.matchMedia('(max-width: 736px)');
    const isMobile = () => mm.matches;

    // Prepare submenu (caret, ARIA, collapsed)
    function prepareSubmenus(root) {
        root.querySelectorAll('li.has-submenu').forEach(li => {
            const a = li.querySelector(':scope > a');
            const submenu = li.querySelector(':scope > ul.submenu');
            if (!a || !submenu) return;

            if (!a.querySelector('.wq-caret')) {
                const caret = document.createElement('span');
                caret.className = 'wq-caret';
                caret.setAttribute('aria-hidden', 'true');
                a.appendChild(caret);
            }
            a.setAttribute('aria-haspopup', 'true');
            a.setAttribute('aria-expanded', 'false');

            // Start collapsed (CSS animates via max-height)
            submenu.style.maxHeight = '0px';
        });
    }
    prepareSubmenus(mobileList);

    // -------- Drawer open/close with a "close lock" --------
    let lastFocus = null;
    let closeLockUntil = 0; // ms timestamp; while in the future, ignore non-forced closes

    const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
    function lockClose(ms = 600) { closeLockUntil = Math.max(closeLockUntil, now() + ms); }
    function canClose() { return now() > closeLockUntil; }

    function openDrawer() {
        lastFocus = document.activeElement;
        drawer.classList.add('is-open');
        backdrop.hidden = false;
        backdrop.classList.add('is-visible');
        toggle.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        const firstFocusable = drawer.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
        (firstFocusable || drawer).focus?.({ preventScroll: true });
    }

    function closeDrawer(opts = { force: false }) {
        if (!opts.force && !canClose()) return; // ignore stray "close" while locked
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        backdrop.classList.remove('is-visible');
        setTimeout(() => { backdrop.hidden = true; }, 240);
        (lastFocus && lastFocus.focus ? lastFocus : toggle).focus?.({ preventScroll: true });
    }

    toggle.addEventListener('click', () => {
        const open = drawer.classList.contains('is-open');
        open ? closeDrawer({ force: true }) : openDrawer();
    });
    backdrop.addEventListener('click', () => closeDrawer({ force: true }));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
            e.preventDefault(); closeDrawer({ force: true });
        }
    });

    // Keep "active" class in sync with desktop
    const observer = new MutationObserver(() => {
        if (!desktopList) return;
        const activeHrefs = new Set(
            [...desktopList.querySelectorAll('a.active')].map(a => a.getAttribute('href'))
        );
        mobileList.querySelectorAll('a').forEach(a => {
            activeHrefs.has(a.getAttribute('href')) ? a.classList.add('active') : a.classList.remove('active');
        });
    });
    if (desktopList) observer.observe(desktopList, { subtree: true, attributes: true, attributeFilter: ['class'] });

    // -------- Early interception: pointerdown "primes" the lock on first tap --------
    mobileList.addEventListener('pointerdown', (e) => {
        if (!isMobile()) return;
        const a = e.target.closest('li.has-submenu > a');
        if (!a) return;
        const li = a.parentElement;
        const submenu = li.querySelector(':scope > ul.submenu');
        if (submenu && !li.classList.contains('is-open')) {
            // User intends to expand, not navigate: temporarily lock drawer auto-close
            lockClose(700);
            // Do NOT prevent pointerdown (keeps ripple/active states consistent),
            // we'll prevent the click below.
        }
    }, true); // capture early

    // -------- Unified click handler --------
    mobileList.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;

        const li = a.closest('li');
        const isParentWithSubmenu = !!(li && li.classList.contains('has-submenu'));
        const submenu = isParentWithSubmenu ? li.querySelector(':scope > ul.submenu') : null;

        if (isMobile() && isParentWithSubmenu && submenu) {
            const isOpen = li.classList.contains('is-open');

            if (!isOpen) {
                // FIRST TAP on parent: open instead of navigating; keep drawer open
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();

                // Lock again just in case any later handler tries to close
                lockClose(700);

                li.classList.add('is-open');
                a.setAttribute('aria-expanded', 'true');
                submenu.style.maxHeight = submenu.scrollHeight + 'px';

                // Accordion: close siblings
                Array.from(li.parentElement.children).forEach(sib => {
                    if (sib !== li && sib.classList.contains('is-open')) {
                        sib.classList.remove('is-open');
                        const sa = sib.querySelector(':scope > a[aria-expanded]');
                        const s = sib.querySelector(':scope > ul.submenu');
                        if (sa) sa.setAttribute('aria-expanded', 'false');
                        if (s) s.style.maxHeight = '0px';
                    }
                });

                return; // do not navigate, do not close
            }

            // SECOND TAP on parent: navigate; drawer can close
            // Let browser handle navigation; then close drawer
            setTimeout(() => closeDrawer({ force: true }), 0);
            return;
        }

        // Child links & non-submenu links: navigate then close
        if (isMobile()) {
            const href = a.getAttribute('href') || '';
            // Close reliably after navigation intent is registered
            if (href.startsWith('#') || href === '' || href.startsWith(location.origin) || !isParentWithSubmenu) {
                setTimeout(() => closeDrawer({ force: true }), 0);
            }
        }
    }, true); // capture to beat generic "close on link click" handlers

    // Keyboard support on mobile: Enter/Space opens parent
    mobileList.addEventListener('keydown', (e) => {
        if (!isMobile()) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const a = e.target.closest('li.has-submenu > a');
        if (!a) return;
        e.preventDefault();
        a.click();
    });

    // Collapse open submenus when leaving mobile; recompute heights on enter
    mm.addEventListener?.('change', () => {
        if (!isMobile()) {
            mobileList.querySelectorAll('li.has-submenu.is-open').forEach(li => {
                li.classList.remove('is-open');
                const a = li.querySelector(':scope > a[aria-expanded]');
                const ul = li.querySelector(':scope > ul.submenu');
                if (a) a.setAttribute('aria-expanded', 'false');
                if (ul) ul.style.maxHeight = '0px';
            });
        } else {
            mobileList.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(ul => {
                ul.style.maxHeight = ul.scrollHeight + 'px';
            });
        }
    });
})();