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
		(lastFocus && lastFocus.focus) ? lastFocus.focus({ preventScroll: true }) : toggle.focus({ preventScroll: true });
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

	// Keep the "active" class in sync if desktop updates later (optional)
	const observer = new MutationObserver(() => {
		if (!desktopList) return;
		const activeHrefs = new Set([...desktopList.querySelectorAll('a.active')].map(a => a.getAttribute('href')));
		mobileList.querySelectorAll('a').forEach(a => {
			activeHrefs.has(a.getAttribute('href')) ? a.classList.add('active') : a.classList.remove('active');
		});
	});
	if (desktopList) observer.observe(desktopList, { subtree: true, attributes: true, attributeFilter: ['class'] });

	// Close after clicking a same-page link
	mobileList.addEventListener('click', (e) => {
		const a = e.target.closest('a'); if (!a) return;
		const href = a.getAttribute('href') || '';
		if (href.startsWith('#') || href === '' || href.startsWith(location.origin)) closeDrawer();
	});
})();