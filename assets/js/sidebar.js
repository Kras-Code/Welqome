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



	/* ---- Close overlay if open, then resolve when the animation actually finishes ---- */
	async function minimizeOverlayIfOpen({ returnFocus = false } = {}) {
		const ov = document.querySelector('.zoom-overlay');
		if (!ov) return;                    // nothing to do

		// Optional: suppress focus return (useful when immediately opening sidebar)
		if (returnFocus === false) ov._returnFocus = null;

		const sheet = ov.querySelector('.zoom-overlay__sheet');
		const closeBtn = ov.querySelector('[data-close]');

		await new Promise((resolve) => {
			// If reduced motion, the overlay script will remove immediately after we click close
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const finish = () => resolve();

			if (!sheet || reduced) {
				// Fall back if we can't observe the transition
				closeBtn ? closeBtn.click() : ov.remove();
				resolve();
				return;
			}

			const onEnd = (e) => {
				if (e.propertyName !== 'transform') return; // ignore unrelated transitions
				sheet.removeEventListener('transitionend', onEnd);
				// By now the overlay script has run its cleanup & removed the node.
				resolve();
			};
			sheet.addEventListener('transitionend', onEnd, { once: true });

			// Start the close using the overlay's own handler
			closeBtn ? closeBtn.click() : ov.remove();
		});
	}
})();