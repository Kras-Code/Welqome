(function () {
    const viewport = document.querySelector('.integrations-marquee');
    const content = document.querySelector('#integrationsMarquee');
    const track = document.querySelector('#integrationsTrack');
    const btnL = document.querySelector('#marqueeLeft');
    const btnR = document.querySelector('#marqueeRight');

    if (!viewport || !content || !track) return;

    // Duplicate the track to form a seamless strip [A][A’]
    const clone = track.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    content.appendChild(clone);

    let firstWidth = 0;     // px width of a single track (A)
    let x = 0;              // translateX
    let dir = +1;           // +1 = right, -1 = left
    let paused = false;
    let rafId = null;

    // Speeds
    const BASE_SPEED = 40;            // px/s baseline
    const BOOST_FACTOR = 1.45;        // quick tap/click nudge
    const BOOST_MS = 1800;            // nudge duration
    let speed = BASE_SPEED;
    let boostUntil = 0;

    // Hold acceleration (ramps up while held)
    const HOLD_MIN_FACTOR = 1.8;      // immediate when pressed
    const HOLD_MAX_FACTOR = 3.2;      // cap after ramp
    const HOLD_RAMP_MS = 1500;     // time to reach cap

    let holding = false;
    let holdStart = 0;
    let holdingBtn = null;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function measure() {
        firstWidth = Math.ceil(track.scrollWidth);
        // keep x in [-firstWidth, 0] depending on direction
        if (x > 0) x = 0;
        if (x < -firstWidth) x = -firstWidth;
        // Start on the left copy if moving right so we don't wrap on frame 1
        if (dir === +1 && x === 0) x = -firstWidth;
        content.style.transform = `translate3d(${x}px,0,0)`;
    }

    function holdFactor(tsNow) {
        if (!holding) return 1;
        const t = Math.min(1, (tsNow - holdStart) / HOLD_RAMP_MS);
        return HOLD_MIN_FACTOR + (HOLD_MAX_FACTOR - HOLD_MIN_FACTOR) * t;
    }

    function step(tsNow) {
        if (!step.lastTs) step.lastTs = tsNow;
        const dt = Math.min(64, tsNow - step.lastTs);
        step.lastTs = tsNow;

        // While held: use hold factor; else: apply short boost if any
        const target =
            holding ? BASE_SPEED * holdFactor(tsNow)
                : (tsNow < boostUntil ? BASE_SPEED * BOOST_FACTOR : BASE_SPEED);

        // Smooth toward target
        speed += (target - speed) * 0.12;

        if (!paused && !prefersReducedMotion && firstWidth > 0) {
            const dx = dir * (speed * dt / 1000);
            x += dx;

            // Seamless wrap
            if (dir === +1 && x >= 0) x = -firstWidth;
            else if (dir === -1 && x <= -firstWidth) x = 0;

            content.style.transform = `translate3d(${x}px,0,0)`;
        }

        rafId = requestAnimationFrame(step);
    }

    // Pause/resume on hover/focus
    const setPaused = (v) => { paused = v; };
    viewport.addEventListener('mouseenter', () => setPaused(true));
    viewport.addEventListener('mouseleave', () => setPaused(false));
    viewport.addEventListener('focusin', () => setPaused(true));
    viewport.addEventListener('focusout', () => setPaused(false));

    // Quick nudge on click (optional), independent of hold
    function nudge(toDir) {
        dir = toDir;
        boostUntil = performance.now() + BOOST_MS;
        if (paused) paused = false;
    }

    // --- Press-and-hold handling (pointer + keyboard) ---
    function startHold(toDir, btn, e) {
        dir = toDir;
        holding = true;
        holdStart = performance.now();
        if (holdingBtn && holdingBtn !== btn) holdingBtn.setAttribute('aria-pressed', 'false');
        holdingBtn = btn;
        if (btn) {
            btn.setAttribute('aria-pressed', 'true');
            if (e && e.pointerId != null && btn.setPointerCapture) {
                try { btn.setPointerCapture(e.pointerId); } catch { }
            }
        }
        if (paused) paused = false;
    }

    function endHold() {
        holding = false;
        holdStart = 0;
        if (holdingBtn) {
            holdingBtn.setAttribute('aria-pressed', 'false');
            holdingBtn = null;
        }
    }

    // Pointer (mouse/touch/pen)
    if (btnL) {
        btnL.addEventListener('pointerdown', e => startHold(-1, btnL, e));
        btnL.addEventListener('pointerup', endHold);
        btnL.addEventListener('pointercancel', endHold);
        btnL.addEventListener('pointerleave', endHold);
        // Optional quick tap nudge
        btnL.addEventListener('click', () => nudge(-1));
    }

    if (btnR) {
        btnR.addEventListener('pointerdown', e => startHold(+1, btnR, e));
        btnR.addEventListener('pointerup', endHold);
        btnR.addEventListener('pointercancel', endHold);
        btnR.addEventListener('pointerleave', endHold);
        btnR.addEventListener('click', () => nudge(+1));
    }

    // Keyboard: hold Space/Enter to accelerate while focused
    function keyHoldHandler(toDir) {
        return function (e) {
            if (e.type === 'keydown' && (e.code === 'Space' || e.key === 'Enter')) {
                e.preventDefault();
                if (!holding) startHold(toDir, e.currentTarget);
            } else if (e.type === 'keyup' && (e.code === 'Space' || e.key === 'Enter')) {
                e.preventDefault();
                endHold();
            }
        };
    }
    if (btnL) {
        btnL.addEventListener('keydown', keyHoldHandler(-1));
        btnL.addEventListener('keyup', keyHoldHandler(-1));
    }
    if (btnR) {
        btnR.addEventListener('keydown', keyHoldHandler(+1));
        btnR.addEventListener('keyup', keyHoldHandler(+1));
    }

    // Resize / decode guards to avoid pop-in and maintain correct width
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    async function ensureDecoded(img) {
        try {
            img.loading = 'eager';
            if (img.decode) await img.decode();
            else if (!img.complete) await new Promise(res => { img.onload = img.onerror = res; });
        } catch {
            await new Promise(res => { const pre = new Image(); pre.onload = pre.onerror = res; pre.src = img.currentSrc || img.src; });
        }
    }

    async function primeAllImagesAndStart() {
        const imgs = Array.from(content.querySelectorAll('img'));
        const timeout = new Promise(res => setTimeout(res, 2000));
        await Promise.race([Promise.all(imgs.map(ensureDecoded)), timeout]);
        measure();
        rafId = requestAnimationFrame(step);
    }

    primeAllImagesAndStart();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
})();