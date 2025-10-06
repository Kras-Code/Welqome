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
          <button type="button" class="zoom-close" data-close="1" aria-label="Minimise and return">Minimise</button>
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
            if (e.target && e.target.hasAttribute('data-close')) {
                e.preventDefault();
                closeZoom(overlay, sourceEl);
            }
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
        // Reverse animation
        overlay.dataset.state && overlay.removeAttribute('data-state');

        const finish = () => {
            overlay._cleanup && overlay._cleanup();
            overlay._ro && overlay._ro.disconnect();
            overlay.remove();
            document.documentElement.classList.remove('zoom-lock');
            document.body.classList.remove('zoom-lock');
            if (overlay._returnFocus && overlay._returnFocus.focus) {
                overlay._returnFocus.focus({ preventScroll: false });
            } else {
                sourceEl.setAttribute('tabindex', '-1');
                sourceEl.focus({ preventScroll: false });
                sourceEl.removeAttribute('tabindex');
            }
        };

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) { finish(); return; }

        const sheet = overlay.querySelector('.zoom-overlay__sheet');
        if (!sheet) { finish(); return; }

        const onEnd = (e) => {
            if (e.propertyName !== 'transform') return;
            sheet.removeEventListener('transitionend', onEnd);
            finish();
        };
        sheet.addEventListener('transitionend', onEnd);
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
})();
