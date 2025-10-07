/*
	Hyperspace by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function($) {

	var	$window = $(window),
		$body = $('body'),
		$sidebar = $('#sidebar');

	// Breakpoints.
		breakpoints({
			xlarge:   [ '1281px',  '1680px' ],
			large:    [ '981px',   '1280px' ],
			medium:   [ '737px',   '980px'  ],
			small:    [ '481px',   '736px'  ],
			xsmall:   [ null,      '480px'  ]
		});

	// Hack: Enable IE flexbox workarounds.
		if (browser.name == 'ie')
			$body.addClass('is-ie');

	// Play initial animations on page load.
		$window.on('load', function() {
			window.setTimeout(function() {
				$body.removeClass('is-preload');
			}, 100);
		});

	// Forms.

		// Hack: Activate non-input submits.
			$('form').on('click', '.submit', function(event) {

				// Stop propagation, default.
					event.stopPropagation();
					event.preventDefault();

				// Submit form.
					$(this).parents('form').submit();

			});

	// Sidebar.
		if ($sidebar.length > 0) {

			var $sidebar_a = $sidebar.find('a');

			$sidebar_a
				.addClass('scrolly')
				.on('click', function() {

					var $this = $(this);

					// External link? Bail.
						if ($this.attr('href').charAt(0) != '#')
							return;

					// Deactivate all links.
						$sidebar_a.removeClass('active');

					// Activate link *and* lock it (so Scrollex doesn't try to activate other links as we're scrolling to this one's section).
						$this
							.addClass('active')
							.addClass('active-locked');

				})
				.each(function() {

					var	$this = $(this),
						id = $this.attr('href'),
						$section = $(id);

					// No section for this link? Bail.
						if ($section.length < 1)
							return;

					// Scrollex.
						$section.scrollex({
							mode: 'middle',
							top: '-20vh',
							bottom: '-20vh',
							initialize: function() {

								// Deactivate section.
									$section.addClass('inactive');

							},
							enter: function() {

								// Activate section.
									$section.removeClass('inactive');

								// No locked links? Deactivate all links and activate this section's one.
									if ($sidebar_a.filter('.active-locked').length == 0) {

										$sidebar_a.removeClass('active');
										$this.addClass('active');

									}

								// Otherwise, if this section's link is the one that's locked, unlock it.
									else if ($this.hasClass('active-locked'))
										$this.removeClass('active-locked');

							}
						});

				});

		}

	// Scrolly.
		$('.scrolly').scrolly({
			speed: 1000,
			offset: function() {

				// If <=large, >small, and sidebar is present, use its height as the offset.
					if (breakpoints.active('<=large')
					&&	!breakpoints.active('<=small')
					&&	$sidebar.length > 0)
						return $sidebar.height();

				return 0;

			}
		});

	// Spotlights.
		$('.spotlights > section')
			.scrollex({
				mode: 'middle',
				top: '-10vh',
				bottom: '-10vh',
				initialize: function() {

					// Deactivate section.
						$(this).addClass('inactive');

				},
				enter: function() {

					// Activate section.
						$(this).removeClass('inactive');

				}
			})
			.each(function() {

				var	$this = $(this),
					$image = $this.find('.image'),
					$img = $image.find('img'),
					x;

				// Assign image.
					$image.css('background-image', 'url(' + $img.attr('src') + ')');

				// Set background position.
					if (x = $img.data('position'))
						$image.css('background-position', x);

				// Hide <img>.
					$img.hide();

			});

	// Features.
		$('.features')
			.scrollex({
				mode: 'middle',
				top: '-20vh',
				bottom: '-20vh',
				initialize: function() {

					// Deactivate section.
						$(this).addClass('inactive');

				},
				enter: function() {

					// Activate section.
						$(this).removeClass('inactive');

				}
			});



	// Code for synchronising when a button is pressed
	// --- Button->Sidebar sync WITHOUT breaking fullscreen.js --- //
	(() => {
		if (window.__navSyncInstalled) return;
		window.__navSyncInstalled = true;

		const ACTIVE_SELECTOR = 'a.button, button, .actions .button, .zoom-open';

		// Build nav map once (desktop + mobile)
		const navMap = (() => {
			const map = new Map();
			document.querySelectorAll('#sidebar a[href^="#"], #m-sidebar a[href^="#"]').forEach(a => {
				const id = (a.getAttribute('href') || '').slice(1);
				if (!id) return;
				(map.get(id) || map.set(id, []).get(id)).push(a);
			});
			return map;
		})();

		document.addEventListener('click', (evt) => {
			const trigger = evt.target.closest(ACTIVE_SELECTOR);
			if (!trigger) return;

			// 1) Resolve the top-level section that exists in the nav
			const sectionId = resolveTargetSectionId(trigger, navMap);
			if (sectionId) activateNav(sectionId, navMap);

			// 2) If this is a fullscreen trigger, DO NOT interfere; fullscreen.js will preventDefault itself.
			const isZoomOpen = trigger.classList.contains('zoom-open');
			const tplSel = trigger.dataset && trigger.dataset.zoomTemplate;
			const hasValidTpl = !!(tplSel && document.querySelector(tplSel));
			if (isZoomOpen && hasValidTpl) {
				return; // let fullscreen.js handle it
			}

			// 3) Otherwise, for external links, do the small paint delay
			if (trigger.tagName === 'A') {
				const href = trigger.getAttribute('href') || '';
				const isHash = href.trim().startsWith('#');
				const isExternalNav = href && !isHash && !trigger.hasAttribute('target');
				if (isExternalNav) {
					evt.preventDefault();
					setTimeout(() => { window.location.href = trigger.href; }, 75);
				}
			}
		}, { capture: true });

		// --- helpers ---
		function resolveTargetSectionId(trigger, map) {
			// Optional explicit hint
			const hinted = trigger.closest('[data-nav-target]')?.getAttribute('data-nav-target')?.trim()
				|| trigger.dataset?.navTarget?.trim();
			if (hinted && map.has(hinted)) return hinted;

			// Walk up to a section[id] that the nav actually knows about (e.g., "#one")
			let cur = trigger.closest('section[id]');
			while (cur) {
				if (map.has(cur.id)) return cur.id;
				cur = cur.parentElement ? cur.parentElement.closest('section[id]') : null;
			}
			return '';
		}

		function activateNav(id, map) {
			const targets = map.get(id);
			if (!targets || !targets.length) return;

			document.querySelectorAll('#sidebar a[href^="#"], #m-sidebar a[href^="#"]').forEach(a => {
				a.classList.remove('active', 'active-locked');
				a.removeAttribute('aria-current');
			});

			targets.forEach(a => {
				a.classList.add('active', 'active-locked');
				a.setAttribute('aria-current', 'page');
				try { a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { a.scrollIntoView(); }
			});

			setTimeout(() => targets.forEach(a => a.classList.remove('active-locked')), 500);
		}
	})();



})(jQuery);