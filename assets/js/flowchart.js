(function () {
    const section = document.getElementById('one-automation');
    if (!section) return;

    const flow = section.querySelector('#flow-snake');
    const svg = flow?.querySelector('.flow-canvas');
    const path = svg?.querySelector('#flowPath');
    const sentinel = section.querySelector('#flow-sentinel');
    const steps = [...flow.querySelectorAll('.step')];
    const video = section.querySelector('.yt-wrap');
    if (!flow || !svg || !path || !sentinel || steps.length === 0) return;

    // ---------- utils ----------
    const cssNumber = (el, name, fallback) => {
        const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
        return Number.isFinite(v) ? v : fallback;
    };
    const clamp01 = t => Math.max(0, Math.min(1, t));
    const easeInOutCubic = t => (t < 0.5) ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const mmMobile = window.matchMedia('(max-width: 736px)');
    const px = v => Math.round(v * 100) / 100;
    const absRect = el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    };

    let totalLen = 0;
    let lengthsAtAnchors = [];
    let currReveal = 0;   // revealed path length (px)
    let builtOnce = false;
    let firstAnchorFrac = 0; // 0..1, fraction where we hit the first card’s top-entry

    // Progress: lock to a fixed reveal line in the viewport (robust to fast scroll)
    function progressFractionFromScroll() {
        const flowAbs = absRect(flow);
        const sentinelAbs = absRect(sentinel);

        const lineFrac = clamp01(cssNumber(flow, '--reveal-line-frac', 0.95)); // 0..1
        const revealLineY = window.scrollY + window.innerHeight * lineFrac;

        const leadPx = (() => {
            const v = cssNumber(flow, '--reveal-lead', NaN);
            return Number.isNaN(v) ? Math.max(0.18 * window.innerHeight, 140) : v;
        })();
        const stretch = Math.max(1, cssNumber(flow, '--reveal-stretch', 1.35));

        const startY = sentinelAbs.y + leadPx;
        const endY = flowAbs.y + flowAbs.h;
        const span = Math.max(1, (endY - startY) * stretch);

        return clamp01((revealLineY - startY) / span);
    }

    // Anchor helpers for a local rect
    function anchorsFor(r, half, outClear) {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        return {
            cx, cy,
            topIn: { x: cx, y: r.y + half },
            rightIn: { x: r.x + r.w - half, y: cy },
            rightOut: { x: r.x + r.w + outClear, y: cy },
            leftIn: { x: r.x + half, y: cy },
            leftOut: { x: r.x - outClear, y: cy },
            bottomIn: { x: cx, y: r.y + r.h - half },
            bottomOut: { x: cx, y: r.y + r.h + outClear },
            center: { x: cx, y: cy }
        };
    }

    function buildPathAndSnapToProgress() {
        const p = progressFractionFromScroll();
        const pE = easeInOutCubic(p);

        // Size SVG to the flow box
        const fr = flow.getBoundingClientRect();
        const fw = fr.width, fh = fr.height;
        svg.setAttribute('viewBox', `0 0 ${px(fw)} ${px(fh)}`);
        svg.setAttribute('width', px(fw));
        svg.setAttribute('height', px(fh));

        const em = parseFloat(getComputedStyle(flow).fontSize) || 16;
        const thick = 3 * em;               // 3em trunk thickness
        const half = thick / 2;
        const outClr = Math.max(half + 6, 14);

        // Local-space transforms
        const flowAbs = absRect(flow);
        const toLocal = r => ({ x: r.x - flowAbs.x, y: r.y - flowAbs.y, w: r.w, h: r.h });

        const vid = video ? toLocal(absRect(video)) : { x: fw / 2 - 1, y: -half, w: 2, h: 2 };
        const cardsLocal = steps.map(s => toLocal(absRect(s)));

        // Start exactly at video bottom-centre to keep “touch”
        const start = { x: vid.x + vid.w / 2, y: vid.y + vid.h };

        // Read desired vertical drop from CSS (fallback to a sensible visible run)
        const videoDrop = (() => {
            const d = cssNumber(flow, '--video-drop', NaN); // e.g., 28..48px typical
            return Number.isNaN(d) ? Math.max(half * 1.35, 48) : Math.max(0, d);
        })();

        // Polyline builders (axis-aligned)
        const pts = [];
        let cumLen = 0;
        const last = () => pts[pts.length - 1];
        const begin = (x, y) => { pts.push([px(x), px(y)]); };
        const hline = x => { const L = last(); const X = px(x); const dx = X - L[0]; if (dx) { pts.push([X, L[1]]); cumLen += Math.abs(dx); } };
        const vline = y => { const L = last(); const Y = px(y); const dy = Y - L[1]; if (dy) { pts.push([L[0], Y]); cumLen += Math.abs(dy); } };

        begin(start.x, start.y);
        lengthsAtAnchors = new Array(cardsLocal.length).fill(0);

        if (mmMobile.matches) {
            // ----- MOBILE: single column, enter via top-centre, exit bottom -----
            const ordered = cardsLocal
                .map((r, i) => ({ i, r, cy: r.y + r.h / 2 }))
                .sort((a, b) => a.cy - b.cy);

            if (ordered.length) {
                const firstA = anchorsFor(ordered[0].r, half, outClr);
                // First, drop vertically from the video before any turn
                const approachY = Math.min(firstA.topIn.y - (half + 2), start.y + videoDrop);
                if (approachY > start.y) vline(approachY);
            }

            for (let idx = 0; idx < ordered.length; idx++) {
                const item = ordered[idx];
                const A = anchorsFor(item.r, half, outClr);

                // Align X to card centre, then vertical top entry
                hline(A.center.x);
                vline(A.topIn.y);
                lengthsAtAnchors[item.i] = cumLen;

                // Cross through the centre
                vline(A.center.y);

                const isLast = (idx === ordered.length - 1);
                if (isLast) break;

                // Exit bottom then head toward next card’s centre X
                vline(A.bottomIn.y);
                vline(A.bottomOut.y);

                const next = ordered[idx + 1];
                const N = anchorsFor(next.r, half, outClr);
                hline(N.center.x);
            }

        } else {
            // ----- DESKTOP: pairwise L-R routing -----
            const ordered = cardsLocal
                .map((r, i) => ({ i, r, cx: r.x + r.w / 2, cy: r.y + r.h / 2 }))
                .sort((a, b) => a.cy - b.cy);

            const midX = start.x;

            // Pre-drop vertically from the video before any horizontal turn (k=0)
            if (ordered.length) {
                const A0 = ordered[0];
                const B0 = ordered[1];
                let left0;
                if (B0) {
                    // decide left among first pair
                    if (Math.min(A0.cx, B0.cx) < midX && Math.max(A0.cx, B0.cx) > midX) {
                        left0 = (A0.cx < B0.cx) ? A0 : B0;
                    } else {
                        left0 = (A0.cx <= B0.cx) ? A0 : B0;
                    }
                } else {
                    left0 = A0; // single first card behaves like LEFT
                }
                const L0 = anchorsFor(left0.r, half, outClr);
                const approachY = Math.min(L0.topIn.y - (half + 2), start.y + videoDrop);
                if (approachY > start.y) vline(approachY);
            }

            for (let k = 0; k < ordered.length; k += 2) {
                const A = ordered[k];
                const B = ordered[k + 1];

                if (!B) {
                    // Single trailing card -> treat as LEFT: enter via top-centre, cross centre
                    const L = anchorsFor(A.r, half, outClr);
                    hline(L.center.x);
                    vline(L.topIn.y);
                    lengthsAtAnchors[A.i] = cumLen;
                    vline(L.center.y);
                    break;
                }

                // Decide left/right by cx relative to midline (fallback by cx)
                let left, right;
                if (Math.min(A.cx, B.cx) < midX && Math.max(A.cx, B.cx) > midX) {
                    left = (A.cx < B.cx) ? A : B;
                    right = (A.cx < B.cx) ? B : A;
                } else {
                    left = (A.cx <= B.cx) ? A : B;
                    right = (A.cx <= B.cx) ? B : A;
                }

                const L = anchorsFor(left.r, half, outClr);
                const R = anchorsFor(right.r, half, outClr);

                // LEFT card: enter via top-centre (align X first → vertical drop), cross centre, exit right
                hline(L.center.x);
                vline(L.topIn.y);
                lengthsAtAnchors[left.i] = cumLen;
                vline(L.center.y);
                hline(L.rightIn.x);
                hline(L.rightOut.x);

                // Hop across gutter at L.center.y to RIGHT outer-left, then into centre
                hline(R.leftOut.x);
                vline(R.center.y);
                hline(R.leftIn.x);
                lengthsAtAnchors[right.i] = cumLen;
                hline(R.center.x);

                const isFinalPair = (k + 1 === ordered.length - 1);
                if (isFinalPair) break;

                // Exit bottom of RIGHT, then aim toward next LEFT’s top-centre
                vline(R.bottomIn.y);
                vline(R.bottomOut.y);

                const nextA = ordered[k + 2];
                const nextB = ordered[k + 3];
                if (nextA) {
                    let nextLeft = nextA;
                    if (nextB) nextLeft = (nextA.cx <= (nextB?.cx ?? nextA.cx)) ? nextA : nextB;
                    const NL = anchorsFor(nextLeft.r, half, outClr);
                    hline(NL.center.x);
                    vline(NL.topIn.y - (half + 1)); // stage just above; next loop drops in
                }
            }
        }

        // Render & measure
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
        path.setAttribute('d', d || `M${px(start.x)} ${px(start.y)} L${px(start.x)} ${px(start.y + 0.001)}`);
        path.getBoundingClientRect(); // Safari layout guard

        totalLen = Math.max(1, path.getTotalLength());
        path.style.strokeDasharray = `${totalLen} ${totalLen}`;

        // --- locate first positive anchor (earliest card top-entry along path) ---
        const firstPx = lengthsAtAnchors
            .filter(v => v > 0)
            .reduce((m, v) => Math.min(m, v), Infinity);
        firstAnchorFrac = (Number.isFinite(firstPx) && totalLen > 0) ? clamp01(firstPx / totalLen) : 0;

        // Snap to current (boosted) progress for first paint correctness
        const f0 = boostedFractionBeforeFirstBox(pE);
        currReveal = f0 * totalLen;
        path.style.strokeDashoffset = Math.max(0, totalLen - currReveal);

        // Sync card states immediately at build time
        for (let i = 0; i < steps.length; i++) {
            if (currReveal + 2 >= lengthsAtAnchors[i]) steps[i].classList.add('is-live');
            else steps[i].classList.remove('is-live');
        }

        builtOnce = true;
    }

    function tick() {
        if (!builtOnce || totalLen <= 1) return;

        const pE = easeInOutCubic(progressFractionFromScroll());
        const f = boostedFractionBeforeFirstBox(pE);
        const target = f * totalLen;

        // Adaptive smoothing: snap on large gaps or near extremes
        const alpha = clamp01(cssNumber(flow, '--reveal-smooth-alpha', 0.12));
        const snapFrac = clamp01(cssNumber(flow, '--reveal-snap-gap', 0.20));
        const snapGap = snapFrac * totalLen;

        const gap = Math.abs(target - currReveal);
        const shouldSnap = (gap >= snapGap) || pE <= 0.0001 || pE >= 0.9999;

        currReveal = shouldSnap ? target : (currReveal + (target - currReveal) * alpha);

        path.style.strokeDashoffset = Math.max(0, totalLen - currReveal);

        for (let i = 0; i < steps.length; i++) {
            if (currReveal + 2 >= lengthsAtAnchors[i]) steps[i].classList.add('is-live');
            else steps[i].classList.remove('is-live');
        }
    }

    // Piecewise-linear boost only before the first card’s entry anchor
    function boostedFractionBeforeFirstBox(f) {
        const boost = Math.max(1, cssNumber(flow, '--pre-first-boost', 1.15)); // 1 = off
        const early = clamp01(cssNumber(flow, '--pre-first-end-frac', firstAnchorFrac || 0));
        if (early <= 0 || boost <= 1) return f;

        const fSwitch = early / boost; // boundary where the early segment ends pre-remap
        if (f <= fSwitch) return f * boost;

        const restIn = 1 - fSwitch;
        const restOut = 1 - early;
        const t = (f - fSwitch) / restIn; // 0..1 across remainder
        return early + t * restOut;       // smooth to 1 at f=1
    }

    // ---------- rebuild + listeners ----------
    let rebuildRaf = null;
    const scheduleRebuild = () => {
        if (rebuildRaf) cancelAnimationFrame(rebuildRaf);
        rebuildRaf = requestAnimationFrame(() => { rebuildRaf = null; buildPathAndSnapToProgress(); });
    };

    const ro = new ResizeObserver(scheduleRebuild);
    ro.observe(flow);
    if (video) ro.observe(video);
    steps.forEach(s => ro.observe(s));

    if (mmMobile.addEventListener) mmMobile.addEventListener('change', scheduleRebuild);
    else if (mmMobile.addListener) mmMobile.addListener(scheduleRebuild);

    window.addEventListener('resize', scheduleRebuild, { passive: true });
    window.addEventListener('orientationchange', scheduleRebuild, { passive: true });
    window.addEventListener('pageshow', scheduleRebuild); // bfcache restores

    // Scroll/throttle + handle large navigation jumps
    let raf = null;
    const onScroll = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { tick(); raf = null; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('keydown', (e) => {
        if (['PageDown', 'PageUp', 'End', 'Home', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) onScroll();
    }, { passive: true });

    if ('fonts' in document) document.fonts.ready.then(scheduleRebuild);
    if (document.readyState === 'complete') scheduleRebuild();
    else window.addEventListener('load', scheduleRebuild, { once: true });

    // init
    buildPathAndSnapToProgress();
    tick();
})();