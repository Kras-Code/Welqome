
    (function () {
        const section = document.getElementById('one-automation');
        if (!section) return;

        const flow = section.querySelector('#flow-snake');
        const svg = flow?.querySelector('.flow-canvas');
        const path = svg?.querySelector('#flowPath');
        const sentinel = section.querySelector('#flow-sentinel');
        const steps = [...flow.querySelectorAll('.step')];
        const video = section.querySelector('.yt-wrap');

        // Read numeric CSS vars in px (or unitless), with fallback
        const cssNumber = (el, name, fallback) => {
            const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
            return Number.isFinite(v) ? v : fallback;
        };

        // Easing: slow start & finish, faster mid
        const easeInOutCubic = t => (t < 0.5)
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Smoothed reveal accumulator (in path-length units)
        let currReveal = 0;


        if (!flow || !svg || !path || !sentinel || steps.length === 0) return;

        // Utilities
        const px = v => Math.round(v * 100) / 100;
        const absRect = el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
        };

        let lengthsAtAnchors = []; // cumulative path lengths where each card is "touched"
        let totalLen = 0;

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

            const isMobile = () => window.matchMedia('(max-width: 736px)').matches;

            const px = v => Math.round(v * 100) / 100;
            const absRect = el => {
                const r = el.getBoundingClientRect();
                return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
            };

            let lengthsAtAnchors = []; // cumulative length when each card is "touched"
            let totalLen = 0;

            function buildPath() {
                // Size SVG to the flow box
                const fr = flow.getBoundingClientRect();
                const fw = fr.width, fh = fr.height;
                svg.setAttribute('viewBox', `0 0 ${px(fw)} ${px(fh)}`);
                svg.setAttribute('width', px(fw));
                svg.setAttribute('height', px(fh));

                const em = parseFloat(getComputedStyle(flow).fontSize) || 16;
                const thick = 3 * em;            // 3em trunk thickness
                const half = thick / 2;
                const fudge = 2;                  // slight overlap so stroke kisses edges

                // Local-space rect helpers
                const flowAbs = absRect(flow);
                const toLocal = (r) => ({ x: r.x - flowAbs.x, y: r.y - flowAbs.y, w: r.w, h: r.h });

                const vid = video ? toLocal(absRect(video)) : { x: fw / 2 - 1, y: -half, w: 2, h: 2 };
                const cards = steps.map(s => toLocal(absRect(s)));

                // Start at the bottom-centre of the video
                const start = { x: vid.x + vid.w / 2, y: vid.y + vid.h + 2 };

                const pts = [];
                let cumLen = 0;
                const push = (x, y) => {
                    const lx = pts.length ? pts[pts.length - 1][0] : start.x;
                    const ly = pts.length ? pts[pts.length - 1][1] : start.y;
                    pts.push([px(x), px(y)]);
                    cumLen += Math.hypot(x - lx, y - ly);
                };

                // seed
                pts.push([px(start.x), px(start.y)]);
                lengthsAtAnchors = new Array(cards.length).fill(0);

                const onMobile = window.matchMedia('(max-width: 736px)').matches;

                if (onMobile) {
                    // Simple vertical spine for one-column layout
                    const xCenter = start.x;
                    for (let i = 0; i < cards.length; i++) {
                        const r = cards[i];
                        const yTopIn = r.y + half;
                        push(xCenter, yTopIn);
                        lengthsAtAnchors[i] = cumLen;
                    }
                } else {
                    // DESKTOP: strict Manhattan routing per spec
                    // DESKTOP: strict Manhattan routing per spec (no inner i++!)
                    for (let i = 0; i < cards.length; i += 2) {
                        // ----- LEFT card (i) -----
                        const L = cards[i];
                        const L_xc = L.x + L.w / 2;
                        const L_yc = L.y + L.h / 2;
                        const L_yTopIn = L.y + half;                   // enter at centre-top (inside)
                        const L_xRtIn = L.x + L.w - half - fudge;     // centre-right (inside)
                        const L_xRtOut = L.x + L.w + half + fudge;     // outside-right

                        // Approach from current point -> top line -> top-centre
                        push(pts[pts.length - 1][0], L_yTopIn);        // vertical
                        push(L_xc, L_yTopIn);                          // to top-centre
                        lengthsAtAnchors[i] = cumLen;                  // touch LEFT

                        // Cross centre and exit centre-right
                        push(L_xc, L_yc);                               // through centre
                        push(L_xRtIn, L_yc);                            // to inside centre-right
                        push(L_xRtOut, L_yc);                           // outside-right

                        // ----- RIGHT card (i+1), if present -----
                        if (i + 1 < cards.length) {
                            const R = cards[i + 1];
                            const R_xc = R.x + R.w / 2;
                            const R_yc = R.y + R.h / 2;
                            const R_xLtIn = R.x + half + fudge;        // centre-left (inside)
                            const R_xLtOut = R.x - half - fudge;        // outside-left
                            const R_yBotIn = R.y + R.h - half;          // centre-bottom (inside)
                            const R_yBotOut = R.y + R.h + half + fudge;  // outside-bottom

                            // From LEFT outside-right -> RIGHT outside-left at L centre-y -> drop to R centre-y
                            push(R_xLtOut, L_yc);                         // horizontal across gutter
                            push(R_xLtOut, R_yc);                         // vertical to R centre-y

                            // Enter RIGHT via centre-left, cross centre
                            push(R_xLtIn, R_yc);                          // first contact
                            lengthsAtAnchors[i + 1] = cumLen;
                            push(R_xc, R_yc);                              // through centre

                            // If this is the final card, stop at the centre (per spec for card 6)
                            if (i + 1 === cards.length - 1) {
                                break;
                            }

                            // Otherwise exit RIGHT via centre-bottom and route to next LEFT top-centre
                            push(R_xc, R_yBotIn);                          // inside bottom
                            push(R_xc, R_yBotOut);                         // outside bottom

                            if (i + 2 < cards.length) {
                                const NL = cards[i + 2];                     // next LEFT
                                const NL_xc = NL.x + NL.w / 2;
                                const NL_yTopIn = NL.y + half;               // enter next at centre-top
                                push(NL_xc, R_yBotOut);                      // horizontal under R to NL centre-x
                                push(NL_xc, NL_yTopIn);                      // vertical up/down to NL top line
                            }
                        }
                    }

                    
                }

                // Render and prepare stroke growth
                const d = pts.map((p, idx) => (idx ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
                path.setAttribute('d', d);
                path.style.strokeDasharray = 'none';
                totalLen = path.getTotalLength();
                path.style.strokeDasharray = `${totalLen} ${totalLen}`;
                path.style.strokeDashoffset = totalLen;

                // Reset card states
                steps.forEach(s => s.classList.remove('is-live'));
            }




            function progressFromScroll() {
                const flowAbs = absRect(flow);
                const sentinelAbs = absRect(sentinel);
                const viewportBottom = window.scrollY + window.innerHeight;

                // Existing lead (delay start). Default ≈18vh if not set.
                const leadPx = (() => {
                    const cssVal = cssNumber(flow, '--reveal-lead', NaN);
                    return Number.isNaN(cssVal) ? Math.max(0.18 * window.innerHeight, 140) : cssVal;
                })();

                // Stretch factor > 1.0 = more scroll required → slower overall
                const stretch = Math.max(1, cssNumber(flow, '--reveal-stretch', 1.35));

                const startY = sentinelAbs.y + leadPx;
                const endY = flowAbs.y + flowAbs.h;

                const span = Math.max(1, (endY - startY) * stretch);
                const raw = (viewportBottom - startY) / span;

                return Math.max(0, Math.min(1, raw));
            }



            function tick() {
                const pRaw = progressFromScroll();          // 0..1 from scroll
                const pEased = easeInOutCubic(pRaw);          // nicer curve
                const target = pEased * totalLen;             // target length to reveal

                // Smooth toward the target for a gliding feel
                const alpha = Math.min(1, Math.max(0.02, cssNumber(flow, '--reveal-smooth-alpha', 0.12)));
                currReveal += (target - currReveal) * alpha;

                path.style.strokeDashoffset = Math.max(0, totalLen - currReveal);

                // Activate cards against the smoothed reveal
                for (let i = 0; i < steps.length; i++) {
                    if (currReveal + 2 >= lengthsAtAnchors[i]) steps[i].classList.add('is-live');
                    else steps[i].classList.remove('is-live');
                }
            }


            // Observers & listeners
            const ro = new ResizeObserver(() => { buildPath(); tick(); });
            ro.observe(flow);
            ro.observe(document.body);

            window.addEventListener('resize', () => { buildPath(); tick(); }, { passive: true });
            window.addEventListener('orientationchange', () => { buildPath(); tick(); }, { passive: true });

            let raf = null;
            window.addEventListener('scroll', () => {
                if (raf) return;
                raf = requestAnimationFrame(() => { tick(); raf = null; });
            }, { passive: true });

            // Init
            buildPath(); tick();
        })();
    })();