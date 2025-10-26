(() => {
    /* ------------ geometry + utils ------------ */
    function pageRect(el) {
        const r = el.getBoundingClientRect();
        const sx = window.scrollX || document.documentElement.scrollLeft || 0;
        const sy = window.scrollY || document.documentElement.scrollTop || 0;
        return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
    }

    function makeOverlayShell() {
        const ov = document.createElement('div');
        ov.className = 'zoom-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'Fullscreen preview');

        ov.innerHTML = `
      <div class="zoom-overlay__backdrop" data-close="1" aria-hidden="true"></div>
      <div class="zoom-overlay__sheet">
        <div class="zoom-overlay__toolbar">
          <button type="button" class="zoom-close" data-close="1" aria-label="Minimise and return"><strong>-</strong></button>
        </div>
        <div class="zoom-overlay__content"></div>
      </div>
    `;
        return ov;
    }

    function sanitizeAndRebase(fragment, baseURL) {
        // Remove script tags for safety
        fragment.querySelectorAll('script').forEach(s => s.remove());

        // Rebase common URL-bearing attributes to absolute paths
        const absolutize = (el, attr) => {
            const v = el.getAttribute(attr);
            if (!v) return;
            try {
                const abs = new URL(v, baseURL).href;
                el.setAttribute(attr, abs);
            } catch { }
        };

        fragment.querySelectorAll('[src]').forEach(el => absolutize(el, 'src'));
        fragment.querySelectorAll('link[href]').forEach(el => absolutize(el, 'href'));
        fragment.querySelectorAll('a[href]').forEach(a => {
            absolutize(a, 'href');
            // Keep links from hijacking the modal view
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
        });

        return fragment;
    }

    /* ------------ resolve content for the overlay ------------ */
    function resolveContent(trigger) {
        // 1) <template> route
        const tplSel = trigger.getAttribute('data-zoom-template');
        if (tplSel) {
            const tpl = document.querySelector(tplSel);
            if (tpl && tpl.tagName.toLowerCase() === 'template') {
                const frag = tpl.content.cloneNode(true);
                return { mode: 'node', node: frag };
            }
        }

        // 2) Fragment clone from current page
        const fragSel = trigger.getAttribute('data-zoom-content');
        if (fragSel) {
            const el = document.querySelector(fragSel);
            if (el) {
                const frag = document.createDocumentFragment();
                frag.appendChild(el.cloneNode(true));
                return { mode: 'node', node: frag };
            }
        }

        // 3) Fetch from href (same-origin)
        const wantsFetch = trigger.hasAttribute('data-zoom-fetch');
        const isA = trigger.tagName === 'A';
        if (wantsFetch && isA && trigger.href) {
            const url = new URL(trigger.href, location.href);
            if (url.origin === location.origin) {
                const selector = trigger.getAttribute('data-zoom-selector') || 'main, #main, body';
                return { mode: 'fetch', href: url.href, selector };
            }
        }

        // 4) Fallback: clone the source zoomable (keeps old behavior)
        return { mode: 'fallback' };
    }

    /* ------------ open/close with FLIP animation ------------ */
    function openZoom(sourceEl, triggerEl) {
        const rect = pageRect(sourceEl);
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

        // Create overlay
        const overlay = makeOverlayShell();
        const contentRoot = overlay.querySelector('.zoom-overlay__content');

        // Compute starting transform (FLIP)
        const scaleX = rect.w / vw || 0.0001;
        const scaleY = rect.h / vh || 0.0001;
        const initial = `translate3d(${rect.x}px, ${rect.y}px, 0) scale(${scaleX}, ${scaleY})`;
        overlay.style.setProperty('--initial-transform', initial);

        // Insert overlay
        document.body.appendChild(overlay);
        document.documentElement.classList.add('zoom-lock');
        document.body.classList.add('zoom-lock');

        // Focus management
        const closeBtn = overlay.querySelector('.zoom-close');
        overlay._returnFocus = document.activeElement;

        // Load content according to resolution strategy
        const resolution = resolveContent(triggerEl);
        if (resolution.mode === 'node') {
            contentRoot.innerHTML = '';
            contentRoot.appendChild(resolution.node);
        } else if (resolution.mode === 'fetch') {
            contentRoot.innerHTML = '<p style="opacity:.8">Loading…</p>';
            fetch(resolution.href, { credentials: 'same-origin' })
                .then(r => r.text())
                .then(html => {
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const picked = doc.querySelector(resolution.selector) ||
                        doc.querySelector('main') ||
                        doc.querySelector('#main') ||
                        doc.body;
                    const clone = picked.cloneNode(true);
                    const frag = document.createDocumentFragment();
                    frag.appendChild(clone);
                    sanitizeAndRebase(frag, resolution.href);
                    contentRoot.innerHTML = '';
                    contentRoot.appendChild(frag);
                })
                .catch(() => {
                    contentRoot.innerHTML = '<p role="alert">Failed to load content.</p>';
                });
        } else {
            // fallback = clone the card
            const clone = sourceEl.cloneNode(true);
            clone.querySelectorAll('.zoom-open').forEach(b => b.remove());
            contentRoot.innerHTML = '';
            contentRoot.appendChild(clone);
        }

        // Enter (animate to identity)
        requestAnimationFrame(() => {
            overlay.dataset.state = 'enter';
            closeBtn && closeBtn.focus({ preventScroll: true });
        });

        // Close interactions
        const onKey = (e) => { if (e.key === 'Escape') closeZoom(overlay, sourceEl); };
        document.addEventListener('keydown', onKey, { passive: true });
        overlay._cleanup = () => document.removeEventListener('keydown', onKey);

        overlay.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest('[data-close]');
            if (!btn) return;
            e.preventDefault();
            closeZoom(overlay, sourceEl);
        });


        // Keep reverse transform aligned if viewport changes
        const ro = new ResizeObserver(() => {
            const r2 = pageRect(sourceEl);
            const sX = r2.w / vw || 0.0001;
            const sY = r2.h / vh || 0.0001;
            overlay.style.setProperty('--initial-transform',
                `translate3d(${r2.x}px, ${r2.y}px, 0) scale(${sX}, ${sY})`);
        });
        ro.observe(document.documentElement);
        overlay._ro = ro;
    }

    function closeZoom(overlay, sourceEl) {
        // Prevent re-entrancy / spam while an existing close is in-flight
        if (overlay._closing) return;
        overlay._closing = true;

        // If an open rAF is queued, cancel its work
        overlay._cancelEnter = true;

        // Reverse animation: removing data-state puts the sheet back to its initial transform
        if (overlay.dataset.state) overlay.removeAttribute('data-state');

        // Disable all minimise controls during close
        overlay.querySelectorAll('[data-close]').forEach(el => {
            el.setAttribute('aria-disabled', 'true');
            el.setAttribute('disabled', '');
            el.style.pointerEvents = 'none';
        });

        const finish = () => {
            overlay._cleanup && overlay._cleanup();
            overlay._ro && overlay._ro.disconnect();
            overlay.remove();
            document.documentElement.classList.remove('zoom-lock');
            document.body.classList.remove('zoom-lock');
            overlay._closing = false;

            // Return focus
            const ret = overlay._returnFocus;
            if (ret && typeof ret.focus === 'function') {
                ret.focus({ preventScroll: false });
            } else if (sourceEl && typeof sourceEl.focus === 'function') {
                sourceEl.setAttribute('tabindex', '-1');
                sourceEl.focus({ preventScroll: false });
                sourceEl.removeAttribute('tabindex');
            }
        };

        // Respect reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish();
            return;
        }

        const sheet = overlay.querySelector('.zoom-overlay__sheet');
        if (!sheet) { finish(); return; }

        // Force reflow so the browser observes the state flip even mid-animation
        void sheet.getBoundingClientRect();

        // Compute a robust fallback timeout from the actual CSS timings
        const cs = getComputedStyle(sheet);
        const first = s => (s || '0s').split(',')[0].trim();
        const toMs = s => {
            const n = parseFloat(s);
            return s.endsWith('ms') ? n : n * 1000;
        };
        const durMs = toMs(first(cs.transitionDuration));
        const delMs = toMs(first(cs.transitionDelay));
        const fallbackMs = Math.max(200, durMs + delMs + 120); // safety buffer

        let done = false;
        const onEnd = () => {
            if (done) return;
            done = true;
            sheet.removeEventListener('transitionend', onEnd);
            clearTimeout(timer);
            finish();
        };

        // Don’t over-filter on propertyName; some themes don’t animate transform
        sheet.addEventListener('transitionend', onEnd, { once: true });

        const timer = setTimeout(onEnd, fallbackMs);
    }


    /* ------------ robust event interception ------------ */
    document.addEventListener('click', function (e) {
        const trigger = e.target.closest('a.zoom-open, button.zoom-open');
        if (!trigger) return;

        // Let modified clicks behave like normal links
        const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
        if (trigger.tagName === 'A' && (modified || trigger.target === '_blank')) return;
        if (e.button === 1) return; // middle-click

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        const source = trigger.closest('.zoomable') || trigger.closest('section') || document.body;
        openZoom(source, trigger);
    }, { capture: true, passive: false });


    /* ================= Sidebar-triggered minimise ================= */

    /** Find all open overlays (defensive if multiple could exist) */
    function getOpenOverlays() {
        return Array.from(document.querySelectorAll('.zoom-overlay'));
    }

    /** Close one overlay using your existing closeZoom(...) */
    function _closeOverlay(ov) {
        const src = ov._sourceEl || document.body; // fallback if not tracked
        // If your closeZoom is in scope, this will animate-out; otherwise remove hard.
        if (typeof closeZoom === 'function') {
            closeZoom(ov, src);
        } else {
            ov.remove();
            document.documentElement.classList.remove('zoom-lock');
            document.body.classList.remove('zoom-lock');
        }
    }

    /** Close any open overlay(s) */
    function closeAnyZoom() {
        const open = getOpenOverlays();
        if (!open.length) return;
        open.forEach(_closeOverlay);
    }

    /* Expose a tiny global (optional but handy for other scripts) */
    window.ZoomOverlay = Object.freeze({
        closeAny: closeAnyZoom,
        isOpen: () => !!document.querySelector('.zoom-overlay'),
    });

    /* Ensure we remember the source element when opening (one-liner safety)
       If you already set overlay._sourceEl in openZoom, this is redundant. */
    const _openZoom_orig = typeof openZoom === 'function' ? openZoom : null;
    if (_openZoom_orig) {
        window.openZoom = function patchedOpenZoom(sourceEl, triggerEl) {
            const before = document.querySelector('.zoom-overlay');
            _openZoom_orig(sourceEl, triggerEl);
            // After open, tag the newly inserted overlay with its source
            const after = document.querySelector('.zoom-overlay');
            if (after && after !== before) after._sourceEl = sourceEl;
        };
    }

    /* Close on desktop sidebar links, mobile drawer links, and mobile toggle.
       Use capture so we run even if other listeners stop propagation. */
    const NAV_SELECTORS = '#sidebar a, #m-sidebar a, #mSidebarToggle';

    function bindNavMinimisers() {
        // Trigger close on keyboard/mouse/touch activations
        ['pointerdown', 'click', 'keydown'].forEach(type => {
            document.addEventListener(type, (e) => {
                if (!window.ZoomOverlay.isOpen()) return;

                // Keyboard: Enter/Space on focused link/button
                if (type === 'keydown') {
                    const k = e.key;
                    if (k !== 'Enter' && k !== ' ') return;
                }

                const hit = e.target.closest(NAV_SELECTORS);
                if (!hit) return;

                // Do not block navigation — just start minimising
                closeAnyZoom();
            }, { capture: true, passive: true });
        });

        // Also close on hash URL changes and history navigation
        window.addEventListener('hashchange', closeAnyZoom, { passive: true });
        window.addEventListener('popstate', closeAnyZoom, { passive: true });
    }

    // Run once after parse (your file is loaded with `defer`)
    bindNavMinimisers();

    /* === Auto-open FAQs across redirect ==========================
       When clicking a .js-faqs-link (which navigates to "/#four"),
       mark the intent and, on the landing page, auto-open the
       fullscreen FAQs overlay sourced from data-zoom-template="#tpl-faqs".
       ------------------------------------------------------------------ */
    (function bindAutoFaqAcrossRedirect() {
        const FLAG = 'wq:autoOpenFaqs';
        const FAQ_SELECTOR = 'a.js-faqs-link[data-zoom-template="#tpl-faqs"]';

        // Mark intent and ensure ?autofaq=1 is present in outgoing URL
        document.addEventListener('click', (e) => {
            const a = e.target && e.target.closest(FAQ_SELECTOR);
            if (!a) return;
            try { sessionStorage.setItem(FLAG, '1'); } catch { }

            try {
                const url = new URL(a.getAttribute('href'), location.href);
                url.searchParams.set('autofaq', '1');
                a.setAttribute('href', url.pathname + url.search + url.hash);
            } catch { }
            // Let navigation proceed normally.
        }, { capture: true });

        function autoOpenFaq() {
            const url = new URL(location.href);
            const hasParam = url.searchParams.get('autofaq') === '1';
            let hasFlag = false;
            try { hasFlag = sessionStorage.getItem(FLAG) === '1'; } catch { }

            if (!hasParam && !hasFlag) return;

            // Clean up so refresh doesn't re-open
            try { sessionStorage.removeItem(FLAG); } catch { }
            if (hasParam) {
                url.searchParams.delete('autofaq');
                try { history.replaceState(null, '', url.pathname + url.hash); } catch { }
            }

            // Prefer the real trigger so the existing interceptor runs
            const trigger = document.querySelector(FAQ_SELECTOR);
            if (trigger) {
                if (!/\bzoom-open\b/.test(trigger.className)) {
                    trigger.classList.add('zoom-open');
                }
                const open = () => {
                    // Tiny delay so hash jump to #four completes
                    setTimeout(() => {
                        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    }, 40);
                };
                if (document.readyState === 'complete') open();
                else window.addEventListener('load', open, { once: true });
                return;
            }

            // Fallback: call window.openZoom with a synthetic trigger
            const fallback = () => {
                if (typeof window.openZoom === 'function') {
                    const fake = document.createElement('a');
                    fake.className = 'zoom-open';
                    fake.setAttribute('data-zoom-template', '#tpl-faqs');
                    const source = document.querySelector('#four') || document.body;
                    window.openZoom(source, fake);
                }
            };
            if (document.readyState === 'complete') fallback();
            else window.addEventListener('load', fallback, { once: true });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoOpenFaq, { once: true });
        } else {
            autoOpenFaq();
        }
    })();
    /* === /Auto-open FAQs across redirect ========================= */

})();
