(() => {
	const DURATION = 350;
	const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

	document.querySelectorAll('details.reveal').forEach((details) => {
		const summary = details.querySelector('summary');
		const panel = details.querySelector('.flowchart');
		let animating = false;
		let currentAnim = null;

		// Defensive: ensure the panel is present
		if (!summary || !panel) return;

		// Optional: ensure pointer affordance
		summary.style.cursor = 'pointer';

		summary.addEventListener('click', (e) => {
			// Respect reduced-motion: let native toggle occur
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

			// Use custom animation instead of native toggle
			e.preventDefault();

			if (animating) return;
			animating = true;

			// Cancel any in-flight animation cleanly
			if (currentAnim) {
				currentAnim.cancel();
				currentAnim = null;
			}

			const openNow = details.open;

			if (!openNow) {
				// ---- OPEN: fade-down (translateY -8px -> 0) ----
				details.open = true;            // make panel measurable
				panel.style.overflow = 'hidden';
				panel.style.height = '0px';
				panel.style.opacity = '0';
				panel.style.transform = 'translateY(-8px)';

				// measure target block-size after it's in layout
				const target = panel.scrollHeight;

				// kick animation on next frame so initial styles stick
				requestAnimationFrame(() => {
					currentAnim = panel.animate([
						{ height: '0px', opacity: 0, transform: 'translateY(-8px)' },
						{ height: target + 'px', opacity: 1, transform: 'translateY(0)' }
					], { duration: DURATION, easing: EASING });

					currentAnim.onfinish = () => {
						// snap to natural layout (auto height), clear overrides
						panel.style.height = '';
						panel.style.opacity = '';
						panel.style.transform = '';
						panel.style.overflow = '';
						animating = false;
						currentAnim = null;
					};

					currentAnim.oncancel = () => { animating = false; currentAnim = null; };
				});

			} else {
				// ---- CLOSE: fade-up (translateY 0 -> -8px) ----
				const start = panel.offsetHeight;   // current rendered height
				panel.style.overflow = 'hidden';    // constrain during collapse

				currentAnim = panel.animate([
					{ height: start + 'px', opacity: 1, transform: 'translateY(0)' },
					{ height: '0px', opacity: 0, transform: 'translateY(-8px)' }
				], { duration: DURATION, easing: EASING });

				currentAnim.onfinish = () => {
					// After collapsing, actually close the <details>
					panel.style.height = '';
					panel.style.opacity = '';
					panel.style.transform = '';
					panel.style.overflow = '';
					details.open = false;            // triggers your label swap CSS
					animating = false;
					currentAnim = null;
				};

				currentAnim.oncancel = () => { animating = false; currentAnim = null; };
			}
		});
	});
})();