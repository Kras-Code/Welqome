(function () {
    const mm = window.matchMedia('(max-width: 736px)');
    const mobileNav = document.querySelector('#m-sidebar nav');
    if (!mobileNav) return;

    const isMobile = () => mm.matches;

    // Ensure caret + ARIA are present
    function prepare() {
        mobileNav.querySelectorAll('li.has-submenu > a').forEach(a => {
            if (!a.querySelector('.wq-caret')) {
                const c = document.createElement('span');
                c.className = 'wq-caret';
                c.setAttribute('aria-hidden', 'true');
                a.appendChild(c);
            }
            a.setAttribute('aria-expanded', 'false');
        });
    }
    prepare();

    // Delegate clicks: first tap opens (no nav), second tap navigates
    mobileNav.addEventListener('click', function (e) {
        const a = e.target.closest('li.has-submenu > a');
        if (!a || !isMobile()) return;

        const li = a.parentElement;
        const submenu = li.querySelector(':scope > ul.submenu');
        if (!submenu) return;

        const isOpen = li.classList.contains('is-open');

        if (!isOpen) {
            // FIRST TAP (mobile): open only
            e.preventDefault();                // block navigation
            e.stopPropagation();               // block global "close drawer on link" handlers
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            li.classList.add('is-open');
            a.setAttribute('aria-expanded', 'true');

            // Smooth height animation
            submenu.style.maxHeight = submenu.scrollHeight + 'px';
            submenu.style.opacity = '1';
            submenu.style.transform = 'translateY(0)';

            // Close siblings (optional)
            Array.from(li.parentElement.children).forEach(sib => {
                if (sib !== li && sib.classList.contains('is-open')) {
                    const s = sib.querySelector(':scope > ul.submenu');
                    const sa = sib.querySelector(':scope > a[aria-expanded]');
                    sib.classList.remove('is-open');
                    if (sa) sa.setAttribute('aria-expanded', 'false');
                    if (s) s.style.maxHeight = '0px';
                }
            });
        } else {
            // SECOND TAP (mobile): allow navigation normally
            // If the href is "#" or empty, treat as a toggle instead of a navigation
            const href = a.getAttribute('href') || '';
            if (href === '' || href === '#') {
                e.preventDefault();
                li.classList.remove('is-open');
                a.setAttribute('aria-expanded', 'false');
                submenu.style.maxHeight = '0px';
            }
            // else: do nothing -> browser follows the link and (likely) your drawer closes
        }
    });

    // Keep heights correct on resize; collapse when leaving mobile
    mm.addEventListener?.('change', () => {
        if (!isMobile()) {
            mobileNav.querySelectorAll('li.has-submenu.is-open').forEach(li => {
                const a = li.querySelector(':scope > a[aria-expanded]');
                const ul = li.querySelector(':scope > ul.submenu');
                li.classList.remove('is-open');
                if (a) a.setAttribute('aria-expanded', 'false');
                if (ul) ul.style.maxHeight = '0px';
            });
        } else {
            mobileNav.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(ul => {
                ul.style.maxHeight = ul.scrollHeight + 'px';
            });
        }
    });

    // If you have a global "close drawer on any nav click", make it respect prevented events.
    // (This guard runs before your closer if it's also attached high up.)
    document.addEventListener('click', function (ev) {
        if (ev.defaultPrevented) return; // first tap was to open submenu; don't close drawer
        // Your existing "close drawer" logic can proceed here.
    }, true);
})();