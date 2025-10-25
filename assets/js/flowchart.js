(() => {
    // Run after DOM is ready; if elements are still missing, retry briefly.
    const ready = (fn) => {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn, { once: true });
    };

    ready(() => {
        // Poll for late-hydrated menus for up to 3s (60 tries x 50ms)
        let tries = 60;
        const waitForEls = setInterval(() => {
            const q = (s) => document.querySelector(s);
            const desktopList = q('#sidebar nav > ul');
            const mobileList = q('#m-sidebar nav > ul.menu');
            const toggle = document.getElementById('mSidebarToggle');
            const drawer = document.getElementById('m-sidebar');
            const backdrop = document.getElementById('m-sidebar-backdrop');

            if (mobileList && toggle && drawer && backdrop) {
                clearInterval(waitForEls);
                init({ desktopList, mobileList, toggle, drawer, backdrop });
            } else if (--tries <= 0) {
                clearInterval(waitForEls);
                // Last-ditch: still attempt init with whatever exists
                init({ desktopList, mobileList, toggle, drawer, backdrop });
            }
        }, 50);
    });

    function init(refs) {
        const { desktopList, mobileList, toggle, drawer, backdrop } = refs || {};
        if (!mobileList || !toggle || !drawer || !backdrop) return; // nothing to do

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
                submenu.style.maxHeight = '0px'; // start collapsed
            });
        }
        prepareSubmenus(mobileList);

        // -------- Drawer open/close with a "close lock" --------
        let lastFocus = null;
        let closeLockUntil = 0;
        const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
        const lockClose = (ms = 700) => { closeLockUntil = Math.max(closeLockUntil, now() + ms); };
        const canClose = () => now() > closeLockUntil;

        function openDrawer() {
            lastFocus = document.activeElement;
            drawer.classList.add('is-open');
            backdrop.hidden = false;
            backdrop.removeAttribute('hidden');
            backdrop.classList.add('is-visible');
            toggle.setAttribute('aria-expanded', 'true');
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            const firstFocusable = drawer.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
            (firstFocusable || drawer).focus?.({ preventScroll: true });
        }

        function closeDrawer(opts = { force: false }) {
            if (!opts.force && !canClose()) return;
            drawer.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            backdrop.classList.remove('is-visible');
            setTimeout(() => { backdrop.hidden = true; }, 240);
            (lastFocus && lastFocus.focus ? lastFocus : toggle).focus?.({ preventScroll: true });
        }

        // Toggle button
        toggle.addEventListener('click', () => {
            const open = drawer.classList.contains('is-open');
            open ? closeDrawer({ force: true }) : openDrawer();
        });

        // Backdrop & ESC
        backdrop.addEventListener('click', () => closeDrawer({ force: true }));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
                e.preventDefault(); closeDrawer({ force: true });
            }
        });

        // Sync "active" from desktop
        if (desktopList) {
            const observer = new MutationObserver(() => {
                const activeHrefs = new Set(
                    [...desktopList.querySelectorAll('a.active')].map(a => a.getAttribute('href'))
                );
                mobileList.querySelectorAll('a').forEach(a => {
                    activeHrefs.has(a.getAttribute('href')) ? a.classList.add('active') : a.classList.remove('active');
                });
            });
            observer.observe(desktopList, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }

        // Early interception to prevent accidental close on first tap
        mobileList.addEventListener('pointerdown', (e) => {
            if (!isMobile()) return;
            const a = e.target.closest('li.has-submenu > a');
            if (!a) return;
            const li = a.parentElement;
            const submenu = li.querySelector(':scope > ul.submenu');
            if (submenu && !li.classList.contains('is-open')) {
                lockClose(700); // we intend to expand, not navigate
            }
        }, true); // capture

        // Unified click handler
        mobileList.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (!a) return;

            const li = a.closest('li');
            const isParentWithSubmenu = !!(li && li.classList.contains('has-submenu'));
            const submenu = isParentWithSubmenu ? li.querySelector(':scope > ul.submenu') : null;

            if (isMobile() && isParentWithSubmenu && submenu) {
                const isOpen = li.classList.contains('is-open');

                if (!isOpen) {
                    // First tap: open; keep drawer open
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation?.();
                    lockClose(700);

                    li.classList.add('is-open');
                    a.setAttribute('aria-expanded', 'true');
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';

                    // Accordion
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

                // Second tap: navigate, then close
                setTimeout(() => closeDrawer({ force: true }), 0);
                return;
            }

            // Child/non-submenu links: navigate then close
            if (isMobile()) {
                const href = a.getAttribute('href') || '';
                if (href.startsWith('#') || href === '' || href.startsWith(location.origin) || !isParentWithSubmenu) {
                    setTimeout(() => closeDrawer({ force: true }), 0);
                }
            }
        }, true);

        // Keyboard: Enter/Space opens parent on mobile
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
    }
})();