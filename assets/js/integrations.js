
(function () {
  // --- DOM -------------------------------------------------------------------
  const viewport = document.querySelector('.integrations-marquee');       // visible window
  const content  = document.querySelector('#integrationsMarquee');        // holds A + A'
  const track    = document.querySelector('#integrationsTrack');          // track A
  const btnL     = document.querySelector('#marqueeLeft');
  const btnR     = document.querySelector('#marqueeRight');

  // Create dots container if missing
  let dotsWrap = document.querySelector('#integrationsDots');
  if (!dotsWrap) {
    dotsWrap = document.createElement('div');
    dotsWrap.id = 'integrationsDots';
    dotsWrap.className = 'marquee-dots';
    dotsWrap.setAttribute('aria-label', 'Slide navigation');
    dotsWrap.setAttribute('role', 'tablist');
    // place directly after content within viewport
    if (viewport) viewport.appendChild(dotsWrap);
  }

  if (!viewport || !content || !track) return;

  // Duplicate track A -> A'
  const clone = track.cloneNode(true);
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  content.appendChild(clone);

  // --- State -----------------------------------------------------------------
  let firstWidth = 0;     // px width of track A
  let x = 0;              // unwrapped translateX of content (logical position)
  let dir = +1;           // ambient direction (+1 right, -1 left)
  let paused = false;     // ambient pause
  let forcePaused = false;// paused due to snap (until next outside click)
  let rafId = null;       // ambient RAF id
  let cardCenters = [];   // centers (px) of <li> in track A
  let lastActiveDot = -1; // currently highlighted dot index
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Geometry helpers ------------------------------------------------------
  const normalizeToDomain = (val) => {
    if (firstWidth <= 0) return 0;
    // Map to [-firstWidth, 0)
    let v = val % firstWidth;
    if (v > 0) v -= firstWidth;
    return v;
  };

  // Called on startup/resize
  function measure() {
    firstWidth = Math.ceil(track.scrollWidth) || 0;
    computeCardCenters();
    // keep x in principal domain for numerical stability
    x = normalizeToDomain(x);
    render();        // draw current position
    renderDots();    // (re)build dots if count changed
    updateActiveDot();
  }

  function computeCardCenters() {
    const items = Array.from(track.children); // direct <li>
    cardCenters = items.map(el => el.offsetLeft + el.offsetWidth / 2);
    cardCenters.sort((a, b) => a - b);
  }

  function viewportCenterWrapped() {
    // Viewport center in [0, firstWidth)
    const vc = -x + (viewport.clientWidth / 2);
    if (firstWidth <= 0) return 0;
    return ((vc % firstWidth) + firstWidth) % firstWidth;
  }

  function nearestCardIndex() {
    if (!cardCenters.length) return 0;
    const vc = viewportCenterWrapped();
    let best = 0, bestD = Infinity;
    for (let i = 0; i < cardCenters.length; i++) {
      const d = Math.abs(cardCenters[i] - vc);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function nextCardIndex() {
    if (!cardCenters.length) return 0;
    const vc = viewportCenterWrapped();
    const idx = cardCenters.findIndex(c => c - vc > 0.5);
    return idx === -1 ? 0 : idx;
  }

  function prevCardIndex() {
    if (!cardCenters.length) return 0;
    const vc = viewportCenterWrapped();
    let idx = -1;
    for (let i = 0; i < cardCenters.length; i++) {
      if (vc - cardCenters[i] > 0.5) idx = i; else break;
    }
    return idx === -1 ? (cardCenters.length - 1) : idx;
  }

  // Shortest-path target: choose nearest copy of the target card on the infinite line
  function targetXForCenter(cx) {
    if (firstWidth <= 0) return x;
    const vwHalf = viewport.clientWidth / 2;
    const vcUnwrapped = -x + vwHalf; // current viewport center on infinite axis
    const k = Math.round((vcUnwrapped - cx) / firstWidth);
    const cTarget = cx + k * firstWidth;
    return -cTarget + vwHalf; // x that centers cTarget
  }

  // --- Rendering -------------------------------------------------------------
  function render() {
    // Always render the normalized position to keep visuals seamless
    const xn = normalizeToDomain(x);
    content.style.transform = `translate3d(${xn}px,0,0)`;
  }

  // --- Ambient loop ----------------------------------------------------------
  const BASE_SPEED = 40; // px/s
  let speed = BASE_SPEED;

  function step(tsNow) {
    if (!step.lastTs) step.lastTs = tsNow;
    const dt = Math.min(64, tsNow - step.lastTs);
    step.lastTs = tsNow;

    if (!paused && !prefersReducedMotion && firstWidth > 0) {
      x += dir * (speed * dt / 1000);
      render();
      updateActiveDot();
    }
    rafId = requestAnimationFrame(step);
  }

  function stopAmbient() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function resumeAmbient() {
    if (prefersReducedMotion) return;
    forcePaused = false;
    paused = false;
    step.lastTs = undefined;
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  // Resume on next click that isn't on controls (arrows/dots)
  function setupResumeOnNextOutsideClick() {
    const resumeIfOutside = (e) => {
      if (!e || !e.target) return;
      if (e.target.closest && (
           e.target.closest('#marqueeLeft') ||
           e.target.closest('#marqueeRight') ||
           e.target.closest('#integrationsDots')
         )) {
        return; // ignore control clicks
      }
      document.removeEventListener('click', resumeIfOutside, true);
      resumeAmbient();
    };
    // delay to avoid catching the same initiating click
    setTimeout(() => document.addEventListener('click', resumeIfOutside, { once: true, capture: true }), 0);
  }

  // Smooth snap to target x; remains paused afterwards until outside click
  function glideTo(target, duration = 520) {
    stopAmbient();
    forcePaused = true;
    paused = true;

    const startX = x;
    const start = performance.now();
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    const dur = prefersReducedMotion ? 0 : duration;

    function tick(now) {
      const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
      x = startX + (target - startX) * easeOutCubic(t);
      render();
      updateActiveDot();
      if (t < 1) requestAnimationFrame(tick);
      else {
        // fold into principal domain to keep numbers bounded
        x = normalizeToDomain(x);
        render();
      }
    }
    requestAnimationFrame(tick);
    setupResumeOnNextOutsideClick();
  }

  function snapToIndex(i) {
    if (!cardCenters.length || firstWidth <= 0) return;
    const idx = Math.max(0, Math.min(i, cardCenters.length - 1));
    const cx = cardCenters[idx];
    const tx = targetXForCenter(cx);
    glideTo(tx);
  }

  const snapNext = () => snapToIndex(nextCardIndex());
  const snapPrev = () => snapToIndex(prevCardIndex());

  // --- Hover/focus pause (ignored while forcePaused) -------------------------
  const setPaused = (v) => { if (!forcePaused) paused = v; };
  viewport.addEventListener('mouseenter', () => setPaused(true));
  viewport.addEventListener('mouseleave', () => setPaused(false));
  viewport.addEventListener('focusin',   () => setPaused(true));
  viewport.addEventListener('focusout',  () => setPaused(false));

  // --- Controls: arrows ------------------------------------------------------
  if (btnL) {
    btnL.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); snapPrev(); });
    btnL.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); snapPrev(); }
    });
  }
  if (btnR) {
    btnR.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); snapNext(); });
    btnR.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); snapNext(); }
    });
  }

  // --- Dots (render + wire + update) ----------------------------------------
  function renderDots() {
    if (!dotsWrap) return;
    const n = cardCenters.length;
    if (!n) { dotsWrap.innerHTML = ''; return; }

    if (dotsWrap.childElementCount !== n) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'marquee-dot';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-label', `Go to card ${i + 1} of ${n}`);
        btn.dataset.index = String(i);

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          snapToIndex(i);
        });

        btn.addEventListener('keydown', (e) => {
          if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation(); snapToIndex(i);
          }
          // optional keyboard nav across dots
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault(); const nxt = Math.min(n - 1, i + 1); dotsWrap.children[nxt]?.focus();
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault(); const prv = Math.max(0, i - 1); dotsWrap.children[prv]?.focus();
          }
        });

        dotsWrap.appendChild(btn);
      }
    }
  }

  function updateActiveDot() {
    if (!dotsWrap || !dotsWrap.childElementCount) return;
    const idx = nearestCardIndex();
    if (idx === lastActiveDot) return;

    if (lastActiveDot >= 0 && lastActiveDot < dotsWrap.children.length) {
      const prev = dotsWrap.children[lastActiveDot];
      prev.classList.remove('is-active');
      prev.setAttribute('aria-current', 'false');
      prev.setAttribute('aria-selected', 'false');
    }
    if (idx >= 0 && idx < dotsWrap.children.length) {
      const cur = dotsWrap.children[idx];
      cur.classList.add('is-active');
      cur.setAttribute('aria-current', 'true');
      cur.setAttribute('aria-selected', 'true');
    }
    lastActiveDot = idx;
  }

  // --- Image decode priming (prevent pop-in) --------------------------------
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
    if (!prefersReducedMotion) rafId = requestAnimationFrame(step);
  }

  // --- Observers & lifecycle -------------------------------------------------
  const ro = new ResizeObserver(() => { measure(); });
  ro.observe(track);

  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('beforeunload', () => { if (rafId) cancelAnimationFrame(rafId); });

  // Kickoff
  primeAllImagesAndStart();
})();
