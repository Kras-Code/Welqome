/* sidebar.js — drop-in rewrite with CSS-coexistence fixes
   - Caret (<span class="wq-caret">) is the ONLY toggle on mobile
   - Inline max-height (px) + .is-open drive open state (beats CSS)
   - Adds .user-opened to #m-sidebar after first manual toggle so your :has() auto-open rules stop overriding user intent
   - Drawer toggle no longer opens/closes submenus implicitly
*/
(function () {
    const desktopList = document.querySelector('#sidebar nav > ul');
    const mobileList = document.querySelector('#m-sidebar nav > ul.menu');
    const toggle = document.getElementById('mSidebarToggle');
    const drawer = document.getElementById('m-sidebar');
    const backdrop = document.getElementById('m-sidebar-backdrop');

    if (!mobileList || !toggle || !drawer || !backdrop) return;

    // Clone desktop items into mobile on first load (keeps authoring single source)
    if (desktopList && !mobileList.children.length) {
        mobileList.innerHTML = desktopList.innerHTML;
    }

    const mmMobile = window.matchMedia('(max-width: 736px)');
    const isMobile = () => mmMobile.matches;
    const px = n => `${Math.max(0, Math.round(n))}px`;

    // --- Submenu preparation: ARIA, caret, collapsed state ---
    function prepareSubmenus(root) {
        root.querySelectorAll('li.has-submenu').forEach((li, i) => {
            const a = li.querySelector(':scope > a');
            const submenu = li.querySelector(':scope > ul.submenu');
            if (!a || !submenu) return;

            // ARIA wiring
            const id = submenu.id || `m-submenu-${i}`;
            submenu.id = id;
            a.setAttribute('aria-controls', id);
            a.setAttribute('aria-expanded', 'false');

            // Ensure caret element exists inside the link (matches your CSS selectors)
            let caret = a.querySelector('.wq-caret');
            if (!caret) {
                caret = document.createElement('span');
                caret.className = 'wq-caret';
                a.appendChild(caret);
            }
            caret.setAttribute('role', 'button');
            caret.setAttribute('tabindex', '0');
            caret.setAttribute('aria-label', 'Toggle submenu');

            // Collapsed initial state
            li.classList.remove('is-open');
            submenu.style.maxHeight = '0px';
        });
    }
    prepareSubmenus(mobileList);

    // --- Measurement helper for smooth height animation ---
    function measure(submenu) {
        const prev = submenu.style.maxHeight;
        submenu.style.maxHeight = 'none';
        const h = submenu.scrollHeight;
        submenu.style.maxHeight = prev;
        return h;
    }

    // --- Accordion open/close (JS owns the state) ---
    function openSubmenu(li) {
        const a = li.querySelector(':scope > a');
        const submenu = li.querySelector(':scope > ul.submenu');
        if (!submenu || li.classList.contains('is-open')) return;

        // Close siblings
        li.parentElement.querySelectorAll(':scope > li.has-submenu.is-open').forEach(sib => {
            if (sib !== li) closeSubmenu(sib);
        });

        li.classList.add('is-open');
        a?.setAttribute('aria-expanded', 'true');
        submenu.style.maxHeight = px(measure(submenu));

        // Signal manual interaction — disables CSS :has() auto-open via the companion CSS gate
        drawer.classList.add('user-opened');
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

    // --- Drawer controls (no implicit submenu mutations here) ---
    function openDrawer() {
        drawer.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        backdrop.removeAttribute('hidden');
    }
    function closeDrawer() {
        drawer.classList.remove('is-open');
        drawer.classList.remove('user-opened'); // reset: allow CSS auto-open next time
        toggle.setAttribute('aria-expanded', 'false');
        backdrop.setAttribute('hidden', '');
        closeAllSubmenus();
    }
    function toggleDrawer() {
        drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    }

    // --- Events: drawer ---
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        toggleDrawer();
    });
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    // --- Events: delegated menu interactions ---
    // Design choice: caret is the only intended toggle in mobile ≤736px.
    mobileList.addEventListener('click', (e) => {
        const caret = e.target.closest('.wq-caret');
        const link = e.target.closest('a');

        // Caret toggles submenu (mobile only)
        if (caret && isMobile()) {
            e.preventDefault();
            const li = caret.closest('li.has-submenu');
            if (!li) return;
            li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li);
            return;
        }

        // Parent text tap with inert href should also toggle (graceful fallback)
        if (link && isMobile()) {
            const li = link.closest('li.has-submenu');
            const href = link.getAttribute('href') || '';
            if (li && (href === '' || href === '#' || href === '#!')) {
                e.preventDefault();
                li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li);
                return;
            }
        }

        // Any real navigation inside the drawer closes it (submenu items or parent links with URLs)
        if (link) {
            const href = link.getAttribute('href') || '';
            if (href && href !== '#' && href !== '#!') {
                // Let the browser navigate; just close the drawer for perceived responsiveness
                closeDrawer();
            }
        }
    });

    // Keyboard support for caret
    mobileList.addEventListener('keydown', (e) => {
        const caret = e.target.closest('.wq-caret');
        if (!caret || !isMobile()) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const li = caret.closest('li.has-submenu');
            if (!li) return;
            li.classList.contains('is-open') ? closeSubmenu(li) : openSubmenu(li);
        }
    });

    // Keep open submenu heights correct if content resizes (fonts, dynamic items)
    const ro = new ResizeObserver(() => {
        mobileList.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(sub => {
            sub.style.maxHeight = px(measure(sub));
        });
    });
    ro.observe(mobileList);

    // Reset on breakpoint changes to avoid stale inline heights and states
    mmMobile.addEventListener('change', () => {
        closeDrawer();
        mobileList.querySelectorAll('ul.submenu').forEach(sub => (sub.style.maxHeight = '0px'));
    });
})();