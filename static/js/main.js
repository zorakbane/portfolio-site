/* main.js: reveals, YouTube facades, transitions, lazy-loads the Bug Hunt game. */
(() => {
  const d = document, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCRIPT = d.currentScript;
  const GAME_SRC = (SCRIPT && SCRIPT.getAttribute('data-game')) || new URL('game.js', (SCRIPT && SCRIPT.src) || location.href).href;

  // Scroll reveals
  const els = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !RM) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(el => io.observe(el));
  } else els.forEach(el => el.classList.add('in'));

  // YouTube click-to-load facade
  d.addEventListener('click', e => {
    const b = e.target.closest('.yt[data-yt]');
    if (!b || b.querySelector('iframe')) return;
    const f = d.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0`;
    f.title = b.getAttribute('aria-label') || 'YouTube video';
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    b.appendChild(f);
  });

  // Hero outline is baked SVG paths — do not remasure or rewrite the viewBox.
  // Periodic offset-glitch is desktop-only; on phones a drop-shadow looks like a doubled A/E stroke.
  const ht = d.querySelector('.hero-title');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (ht && !RM && finePointer) setInterval(() => { ht.classList.remove('glitch'); void ht.offsetWidth; ht.classList.add('glitch'); }, 5200);

  // Hero perspective grid, drawn on a small canvas. The old CSS version animated background-position on a
  // huge perspective(600px) rotateX(58deg) + mask-image layer; Firefox re-rasterizes that whole 3D surface
  // every frame (≈1–12 fps at 1440p). Same projection, line spacing, colour and fade, but only the visible
  // band is drawn, and only while the hero is on screen.
  const heroBg = d.querySelector('.hero-bg');
  if (heroBg) heroGrid(heroBg);
  function heroGrid(bg) {
    const cv = d.createElement('canvas'); cv.className = 'grid-cv';
    const g = cv.getContext('2d', { alpha: true });
    if (!g) return;
    bg.insertBefore(cv, bg.firstChild);
    bg.classList.add('has-grid-cv');
    const CELL = 48, PERSP = 600, TH = 58 * Math.PI / 180, COS = Math.cos(TH), SIN = Math.sin(TH), PERIOD = 6000;
    let w = 0, h = 0, bandTop = 0, dpr = 1, visible = true, raf = 0, lastOff = -1;
    // Element box of the old .grid: inset -50% -10% 0 → width 1.2w, height 1.5h, origin at bottom centre.
    const proj = Y => PERSP / (PERSP - Y * SIN); // Y ≤ 0 (above the origin), recedes from the viewer
    function size() {
      const r = bg.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      const topY = -1.5 * h; // element top relative to the origin
      bandTop = Math.max(0, Math.floor(h + topY * COS * proj(topY)) - 2);
      // Whole-number ratio only: a fractional backing store (e.g. 1.5 on a 2× Retina screen) is resampled on every
      // composite, and in WebKit's software path that alone pinned the idle page at ~5 fps (MacBook 1440×900@2).
      dpr = (window.devicePixelRatio || 1) >= 2 ? 2 : 1;
      const bh = h - bandTop;
      cv.style.top = bandTop + 'px'; cv.style.height = bh + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.max(1, Math.round(bh * dpr));
      lastOff = -1;
    }
    function draw(off) {
      const eh = 1.5 * h, ew = 1.2 * w, ox = w / 2, oy = h - bandTop; // origin in canvas space
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h - bandTop);
      // mask: linear-gradient(to top, #000 10%, transparent 75%) along the element height
      const fade = f => f <= 0.1 ? 1 : f >= 0.75 ? 0 : 1 - (f - 0.1) / 0.65;
      const sy = Y => oy + Y * COS * proj(Y);
      const sx = (X, Y) => ox + X * proj(Y);
      const col = 'rgba(57,255,136,0.09)';
      // horizontal lines: background tiles start at element top + off
      g.fillStyle = col;
      for (let y = off - CELL; y <= eh; y += CELL) {
        if (y < 0) continue;
        const Y = y - eh; // relative to the bottom origin
        const f = (eh - y) / eh, a = fade(f);
        if (a <= 0) continue;
        const s = proj(Y), y0 = sy(Y), th = Math.max(0.35, COS * s);
        g.globalAlpha = a;
        g.fillRect(sx(-ew / 2, Y), y0, ew * s, th);
      }
      // vertical lines never move, so they live in a cached layer
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(vlines(), 0, 0);
    }
    let vCache = null;
    function vlines() {
      if (vCache && vCache.width === cv.width && vCache.height === cv.height) return vCache;
      vCache = vCache || d.createElement('canvas');
      vCache.width = cv.width; vCache.height = cv.height;
      const v = vCache.getContext('2d');
      const eh = 1.5 * h, ew = 1.2 * w, ox = w / 2, oy = h - bandTop;
      const fade = f => f <= 0.1 ? 1 : f >= 0.75 ? 0 : 1 - (f - 0.1) / 0.65;
      const sy = Y => oy + Y * COS * proj(Y);
      const sx = (X, Y) => ox + X * proj(Y);
      v.setTransform(dpr, 0, 0, dpr, 0, 0);
      // one gradient carries the mask fade along screen y
      const grad = v.createLinearGradient(0, sy(-eh), 0, oy);
      for (let i = 0; i <= 13; i++) {
        const ff = Math.max(0, 0.75 - i * 0.05), Y = -ff * eh;
        const t = (sy(Y) - sy(-eh)) / Math.max(1, oy - sy(-eh));
        grad.addColorStop(Math.min(1, Math.max(0, t)), `rgba(57,255,136,${(0.09 * fade(ff)).toFixed(4)})`);
      }
      v.strokeStyle = grad; v.lineWidth = 1;
      v.beginPath();
      const Yt = -0.75 * eh; // fully faded above this
      for (let x = 0; x <= ew; x += CELL) {
        const X = x + 0.5 - ew / 2;
        v.moveTo(sx(X, Yt), sy(Yt)); v.lineTo(sx(X, 0), oy);
      }
      v.stroke();
      return vCache;
    }
    function tick(t) {
      raf = 0;
      if (!visible || d.hidden || d.body.classList.contains('bh-play')) return;
      const off = RM ? 0 : Math.round(((t % PERIOD) / PERIOD) * CELL * 4) / 4;
      if (off !== lastOff) { lastOff = off; draw(off); }
      if (!RM) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf && visible && !d.hidden) raf = requestAnimationFrame(tick); };
    size(); draw(0); lastOff = 0;
    addEventListener('resize', () => { size(); kick(); if (RM) draw(0); }, { passive: true });
    d.addEventListener('visibilitychange', kick);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; kick(); }).observe(bg);
    if ('MutationObserver' in window) new MutationObserver(kick).observe(d.body, { attributes: true, attributeFilter: ['class'] });
    kick();
  }

  // Page transitions: native cross-document View Transitions where supported (CSS @view-transition),
  // otherwise a quick wipe before navigating.
  const nativeVT = 'onpagereveal' in window;
  if (!nativeVT && !RM) {
    d.body.classList.add('arrived');
    d.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      window.dispatchEvent(new Event('bh-save'));
      d.body.classList.remove('arrived'); d.body.classList.add('leaving');
      setTimeout(() => { location.href = url.href; }, 190);
    });
    addEventListener('pageshow', ev => { if (ev.persisted) d.body.classList.remove('leaving'); });
  }

  // Lazy-load the game after the page is idle (keeps first paint fast)
  const loadGame = () => { const s = d.createElement('script'); s.src = GAME_SRC; s.async = true; d.body.appendChild(s); };
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  if (d.readyState === 'complete') idle(loadGame, { timeout: 2500 });
  else addEventListener('load', () => idle(loadGame, { timeout: 2500 }));
})();
