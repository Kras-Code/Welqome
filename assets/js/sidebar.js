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

    // Drawer open/close with focus management (unchanged behavior)
    let lastFocus = null;

    function openDrawer() {
        lastFocus = document.activeElement;
        drawer.classList.add('is-open');
        backdrop.hidden = false;
        backdrop.classList.add('is-visible');
        toggle.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        const firstFocusable = drawer.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
        (firstFocusable || drawer).focus({ preventScroll: true });
    }

    function closeDrawer() {
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        backdrop.classList.remove('is-visible');
        setTimeout(() => { backdrop.hidden = true; }, 240);
        (lastFocus && lastFocus.focus ? lastFocus : toggle).focus({ preventScroll: true });
    }

    toggle.addEventListener('click', () => {
        const open = drawer.classList.contains('is-open');
        open ? closeDrawer() : openDrawer();
    });
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
            e.preventDefault(); closeDrawer();
        }
    });

    // Keep "active" class in sync with desktop (optional, as in your script)
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

    // === SINGLE unified click handler for the mobile menu ===
    // Behaviour:
    // - On mobile, first tap on a submenu parent opens it (prevents navigation and prevents drawer close)
    // - On mobile, second tap on the same parent navigates and then drawer closes
    // - Any child link (submenu item) navigates and then drawer closes
    // - Non-submenu links behave as before: navigate and then drawer closes
    mobileList.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;

        const li = a.closest('li');
        const isParentWithSubmenu = !!(li && li.classList.contains('has-submenu'));
        const submenu = isParentWithSubmenu ? li.querySelector(':scope > ul.submenu') : null;

        if (isMobile() && isParentWithSubmenu && submenu) {
            const isOpen = li.classList.contains('is-open');

            if (!isOpen) {
                // FIRST TAP on parent: open instead of navigating; DO NOT close drawer
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                li.classList.add('is-open');
                a.setAttribute('aria-expanded', 'true');
                submenu.style.maxHeight = submenu.scrollHeight + 'px';

                // Close open siblings (accordion behavior)
                Array.from(li.parentElement.children).forEach(sib => {
                    if (sib !== li && sib.classList.contains('is-open')) {
                        sib.classList.remove('is-open');
                        const sa = sib.querySelector(':scope > a[aria-expanded]');
                        const s = sib.querySelector(':scope > ul.submenu');
                        if (sa) sa.setAttribute('aria-expanded', 'false');
                        if (s) s.style.maxHeight = '0px';
                    }
                });
                return;
            }

            // SECOND TAP on parent: allow navigation; close drawer after click
            // Let the browser handle the actual navigation (hash or URL)
            setTimeout(closeDrawer, 0);
            return;
        }

        // Otherwise (child links, non-submenu links):
        if (isMobile()) {
            // For in-page anchors or same-origin links, close after click
            const href = a.getAttribute('href') || '';
            // We close the drawer after the navigation intent has been registered
            // (hash change or route). Timeout ensures deterministic order.
            if (href.startsWith('#') || href === '' || href.startsWith(location.origin) || !isParentWithSubmenu) {
                setTimeout(closeDrawer, 0);
            }
        }
    }, true); // capture: outruns any global "close on link click" listeners

    // Keyboard support for accessibility: Enter/Space opens parent on mobile
    mobileList.addEventListener('keydown', (e) => {
        if (!isMobile()) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const a = e.target.closest('li.has-submenu > a');
        if (!a) return;
        e.preventDefault();
        a.click();
    });

    // When leaving mobile, collapse any open submenus to avoid odd heights
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
            // Recompute heights if fonts/layout changed
            mobileList.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(ul => {
                ul.style.maxHeight = ul.scrollHeight + 'px';
            });
        }
    });

})();