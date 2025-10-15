
    (function () {
  const mobileNav = document.querySelector('#m-sidebar nav');
    if (!mobileNav) return;

  // Ensure ARIA + caret exist
  mobileNav.querySelectorAll('li.has-submenu > a').forEach(a => {
    if (!a.querySelector('.wq-caret')) {
      const c = document.createElement('span');
    c.className = 'wq-caret';
    c.setAttribute('aria-hidden', 'true');
    a.appendChild(c);
    }
    a.setAttribute('aria-expanded', 'false');
  });

    // Delegate taps
    mobileNav.addEventListener('click', function (e) {
    const a = e.target.closest('li.has-submenu > a');
    if (!a) return;

    const li = a.parentElement;
    const submenu = li.querySelector(':scope > ul.submenu');
    if (!submenu) return;

    const isOpen = li.classList.contains('is-open');

    // First tap opens (prevent navigation). Second tap (when open) follows link.
    if (!isOpen) e.preventDefault();

    // Toggle state
    li.classList.toggle('is-open', !isOpen);
    a.setAttribute('aria-expanded', String(!isOpen));

    // Animate height precisely
    if (!isOpen) {
        submenu.style.maxHeight = submenu.scrollHeight + 'px';
    submenu.style.opacity = '1';
    submenu.style.transform = 'translateY(0)';
    } else {
        submenu.style.maxHeight = '0px';
    submenu.style.opacity = '';
    submenu.style.transform = '';
    }

    // Close siblings (optional; comment out if you want multiple open)
    Array.from(li.parentElement.children).forEach(sib => {
      if (sib !== li && sib.classList.contains('is-open')) {
        const s = sib.querySelector(':scope > ul.submenu');
    sib.classList.remove('is-open');
        const sa = sib.querySelector(':scope > a[aria-expanded]');
    if (sa) sa.setAttribute('aria-expanded', 'false');
    if (s) s.style.maxHeight = '0px';
      }
    });
  });

    // Recompute height on window resize (if fonts/line-height change)
    let rid;
  window.addEventListener('resize', () => {
        cancelAnimationFrame(rid);
    rid = requestAnimationFrame(() => {
        mobileNav.querySelectorAll('li.has-submenu.is-open > ul.submenu').forEach(ul => {
            ul.style.maxHeight = ul.scrollHeight + 'px';
        });
    });
  });
})();