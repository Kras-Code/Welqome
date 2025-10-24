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
    const easeInOutCubic = t => (t < 0.5) ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const mmMobile = window.matchMedia('(max-width: 736px)');
    const px = v => Math.round(v * 100) / 100;
    const absRect = el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    };

    let totalLen = 0;
    let lengthsAtAnchors = [];
    let currReveal = 0;

    function progressFractionFromScroll() {
        const flowAbs = absRect(flow);
        const sentinelAbs = absRect(sentinel);
        const viewportBottom = window.scrollY + window.innerHeight;

        const leadPx = (() => {
            const cssVal = cssNumber(flow, '--reveal-lead', NaN);
            return Number.isNaN(cssVal) ? Math.max(0.18 * window.innerHeight, 140) : cssVal;
        })();
        const stretch = Math.max(1, cssNumber(flow, '--reveal-stretch', 1.35));

        const startY = sentinelAbs.y + leadPx;
        const endY = flowAbs.y + flowAbs.h;
        const span = Math.max(1, (endY - startY) * stretch);
        const raw = (viewportBottom - startY) / span;
        return Math.max(0, Math.min(1, raw));
    }

    // Build anchors for a local rect
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
        const pEased = easeInOutCubic(progressFractionFromScroll());

        // Size SVG to current flow box
        const fr = flow.getBoundingClientRect();
        const fw = fr.width, fh = fr.height;
        svg.setAttribute('viewBox', `0 0 ${px(fw)} ${px(fh)}`);
        svg.setAttribute('width', px(fw));
        svg.setAttribute('height', px(fh));

        const em = parseFloat(getComputedStyle(flow).fontSize) || 16;
        const thick = 3 * em;                 // 3em trunk thickness
        const half = thick / 2;
        const outClear = Math.max(half + 6, 14); // “outside” clearance guard

        // Local-space rects/anchors
        const flowAbs = absRect(flow);
        const toLocal = r => ({ x: r.x - flowAbs.x, y: r.y - flowAbs.y, w: r.w, h: r.h });

        const vid = video ? toLocal(absRect(video)) : { x: fw / 2 - 1, y: -half, w: 2, h: 2 };
        const cardsLocal = steps.map(s => toLocal(absRect(s)));

        // Start at the bottom-centre of the video
        const start = { x: vid.x + vid.w / 2, y: vid.y + vid.h + 2 };

        // Helpers to push axis-aligned segments only
        const pts = [];
        let cumLen = 0;
        const last = () => pts[pts.length - 1];
        const begin = (x, y) => { pts.push([px(x), px(y)]); };
        const hline = x => { const L = last(); pts.push([px(x), L[1]]); cumLen += Math.abs(x - L[0]); };
        const vline = y => { const L = last(); pts.push([L[0], px(y)]); cumLen += Math.abs(y - L[1]); };

        begin(start.x, start.y);
        lengthsAtAnchors = new Array(cardsLocal.length).fill(0);

        if (mmMobile.matches) {
            // Mobile: single column – go topIn of each card down the spine
            // Sort by centre-y to avoid DOM order surprises
            const ordered = cardsLocal
                .map((r, i) => ({ i, r, cy: r.y + r.h / 2 }))
                .sort((a, b) => a.cy - b.cy);

            const spineX = start.x;
            for (const item of ordered) {
                const A = anchorsFor(item.r, half, outClear);
                hline(spineX);
                vline(A.topIn.y);
                lengthsAtAnchors[item.i] = cumLen;
            }
        } else {
            // Desktop: robust pairing by geometry
            // Sort by centre-y (visual order top→bottom)
            const ordered = cardsLocal
                .map((r, i) => ({ i, r, cx: r.x + r.w / 2, cy: r.y + r.h / 2 }))
                .sort((a, b) => a.cy - b.cy);

            // Midline uses video bottom-centre x to be consistent with your design
            const midX = start.x;

            // Walk in pairs (top two, next two, …); decide left vs right by cx
            for (let k = 0; k < ordered.length; k += 2) {
                const A = ordered[k];
                const B = ordered[k + 1];

                if (!B) {
                    // Single trailing card: just route as a LEFT card that ends at centre
                    const L = anchorsFor(A.r, half, outClear);
                    // Approach vertically to topIn, then centre, then stop
                    vline(L.topIn.y);
                    hline(L.center.x);
                    lengthsAtAnchors[A.i] = cumLen;
                    vline(L.center.y);
                    break;
                }

                // Decide left/right by comparing to midline; tie-breaker by cx
                let left, right;
                if (Math.min(A.cx, B.cx) < midX && Math.max(A.cx, B.cx) > midX) {
                    left = (A.cx < B.cx) ? A : B;
                    right = (A.cx < B.cx) ? B : A;
                } else {
                    // Both on same side of midline; still take left = smaller cx
                    left = (A.cx <= B.cx) ? A : B;
                    right = (A.cx <= B.cx) ? B : A;
                }

                const L = anchorsFor(left.r, half, outClear);
                const R = anchorsFor(right.r, half, outClear);

                // ----- LEFT card (enter top-mid, cross centre, exit centre-right) -----
                vline(L.topIn.y);         // up/down to topIn y
                hline(L.center.x);        // to exact centre x
                lengthsAtAnchors[left.i] = cumLen;
                vline(L.center.y);        // through centre
                hline(L.rightIn.x);       // to inside right-mid
                hline(L.rightOut.x);      // outside-right (clear of the card)

                // ----- Hop across gutter at LEFT centre-y to RIGHT outside-left -----
                hline(R.leftOut.x);       // horizontal run at fixed y = L.center.y
                vline(R.center.y);        // vertical to RIGHT centre y

                // ----- RIGHT card (enter centre-left, cross centre) -----
                hline(R.leftIn.x);        // inside left-mid
                lengthsAtAnchors[right.i] = cumLen;
                hline(R.center.x);        // to exact centre x

                const isFinal = (k + 1 === ordered.length - 1);
                if (isFinal) {
                    // Final card: stop at centre
                    break;
                }

                // Else exit bottom-mid and route to next LEFT top-mid
                vline(R.bottomIn.y);
                vline(R.bottomOut.y);

                // Next pair's LEFT is ordered[k+2] or ordered[k+3] depending on geometry.
                // We will simply aim at the *next pair's* smaller-cx card topIn.
                const nextA = ordered[k + 2];
                const nextB = ordered[k + 3];
                if (nextA) {
                    let nextLeftCandidate = nextA;
                    if (nextB) nextLeftCandidate = (nextA.cx <= (nextB?.cx ?? nextA.cx)) ? nextA : nextB;
                    const NL = anchorsFor(nextLeftCandidate.r, half, outClear);
                    hline(NL.center.x);   // move horizontally to next-left centre x
                    vline(NL.topIn.y);    // then up/down to its topIn y (we'll enter on next loop)
                }
            }
        }

        // Render & measure
        const d = pts.map((p, idx) => (idx ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
        path.setAttribute('d', d);
        // Force layout read before measuring length (Safari guard)
        path.getBoundingClientRect();
        totalLen = path.getTotalLength();
        path.style.strokeDasharray = `${totalLen} ${totalLen}`;

        // Snap current reveal to progress fraction
        currReveal = pEased * totalLen;
        path.style.strokeDashoffset = Math.max(0, totalLen - currReveal);

        // Sync card states
        for (let i = 0; i < steps.length; i++) {
            if (currReveal + 2 >= lengthsAtAnchors[i]) steps[i].classList.add('is-live');
            else steps[i].classList.remove('is-live');
        }
    }

    function tick() {
        const pEased = easeInOutCubic(progressFractionFromScroll());
        const target = pEased * totalLen;
        const alpha = Math.min(1, Math.max(0.02, cssNumber(flow, '--reveal-smooth-alpha', 0.12)));
        currReveal += (target - currReveal) * alpha;
        path.style.strokeDashoffset = Math.max(0, totalLen - currReveal);
        for (let i = 0; i < steps.length; i++) {
            if (currReveal + 2 >= lengthsAtAnchors[i]) steps[i].classList.add('is-live');
            else steps[i].classList.remove('is-live');
        }
    }

    // ---------- rebuild wiring ----------
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

    let raf = null;
    window.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { tick(); raf = null; });
    }, { passive: true });

    if ('fonts' in document) document.fonts.ready.then(scheduleRebuild);
    window.addEventListener('load', scheduleRebuild, { once: true });

    // init
    buildPathAndSnapToProgress();
    tick();
})();