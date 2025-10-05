/* ===== Infinite left→right auto-scroll with seamless wrap, pointer-drag, and arrow controls ===== */
(() => {
  const root = document.querySelector('.card-marquee');
    if (!root) return;

    const viewport = root.querySelector('.viewport');
    const track    = root.querySelector('.track');
    const btnPrev  = root.querySelector('.nav.prev');
    const btnNext  = root.querySelector('.nav.next');

  // Clone original items once to enable seamless wrap
  const originals = Array.from(track.children).map(n => n.cloneNode(true));
    const originalWidthBeforeClone = track.scrollWidth; // measure once
  originals.forEach(n => track.appendChild(n));       // duplicate content

    // Initialise scroll position at mid-point so we can move leftwards immediately
    const HALF = originalWidthBeforeClone;
    viewport.scrollLeft = HALF;

    // Speed (px/s). Editable via data-speed on the root.
    const SPEED = Number(root.dataset.speed || 80); // default 80 px/s
    let running = true;
    let last = performance.now();

  // Pause on hover/focus for usability
  const pause = () => (running = true && !prefersReducedMotion.matches);
  const play  = () => (running = true && !prefersReducedMotion.matches);

  root.addEventListener('mouseenter', () => running = false);
  root.addEventListener('mouseleave', () => running = true);
  root.addEventListener('focusin',   () => running = false);
  root.addEventListener('focusout',  () => running = true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) running = false;

    function wrap() {
    // Keep scrollLeft within [0, HALF) for seamless loop
    if (viewport.scrollLeft < 0) {
        viewport.scrollLeft += HALF;
    } else if (viewport.scrollLeft >= HALF) {
        viewport.scrollLeft -= HALF;
    }
  }

    function step(now) {
    const dt = (now - last) / 1000;
    last = now;

    // Move content visually left→right by decreasing scrollLeft
    if (running) viewport.scrollLeft -= SPEED * dt;

    wrap();
    requestAnimationFrame(step);
  }
    requestAnimationFrame(step);

  // Smooth manual controls
  const jump = () => Math.max(240, Math.floor(viewport.clientWidth * 0.8));
  btnPrev.addEventListener('click', () => {
        running = false;
    viewport.scrollBy({left: -jump(), behavior: 'smooth' });
    // resume after a short delay
    setTimeout(() => running = !prefersReducedMotion.matches, 600);
  });
  btnNext.addEventListener('click', () => {
        running = false;
    viewport.scrollBy({left: +jump(), behavior: 'smooth' });
    setTimeout(() => running = !prefersReducedMotion.matches, 600);
  });

    // Keep seamless wrap during any user scrolls
    viewport.addEventListener('scroll', wrap, {passive: true });

    // Drag-to-scroll with pointer events
    let dragging = false, startX = 0, startScroll = 0, pointerId = null;
  viewport.addEventListener('pointerdown', (e) => {
        dragging = true;
    pointerId = e.pointerId;
    viewport.setPointerCapture(pointerId);
    startX = e.clientX;
    startScroll = viewport.scrollLeft;
    running = false;
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    viewport.scrollLeft = startScroll - dx; // natural drag
    wrap();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    if (pointerId != null) viewport.releasePointerCapture(pointerId);
    pointerId = null;
    running = !prefersReducedMotion.matches;
  };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

  // Keyboard accessibility when viewport is focused
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
    viewport.scrollBy({left: -jump(), behavior: 'smooth' });
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
    viewport.scrollBy({left: +jump(), behavior: 'smooth' });
    }
  });
})();