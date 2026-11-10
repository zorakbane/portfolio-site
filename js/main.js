/* main.js: reveals, YouTube facades, transitions, lazy-loads the Bug Hunt game. */
(() => {
  const d = document, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCRIPT = d.currentScript && d.currentScript.src;

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

  // Hero title: fit outline SVG to natural glyph width (no compressed A/E), then glitch.
  function fitHeroOutline() {
    const svg = d.querySelector('.ht-outline');
    const text = svg && svg.querySelector('text');
    if (!svg || !text) return;
    text.removeAttribute('textLength');
    text.removeAttribute('lengthAdjust');
    let w = 0;
    try { w = text.getComputedTextLength(); } catch { return; }
    if (!(w > 0)) return;
    const padX = 18, height = 140;
    svg.setAttribute('viewBox', `0 0 ${Math.ceil(w + padX * 2)} ${height}`);
    text.setAttribute('x', String(padX));
    text.setAttribute('y', '108');
  }
  const fontsReady = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
  fontsReady.then(fitHeroOutline).catch(() => fitHeroOutline());
  addEventListener('load', fitHeroOutline);
  addEventListener('resize', fitHeroOutline);
  const ht = d.querySelector('.hero-title');
  if (ht && !RM) setInterval(() => { ht.classList.remove('glitch'); void ht.offsetWidth; ht.classList.add('glitch'); }, 5200);

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
  const loadGame = () => { const s = d.createElement('script'); s.src = new URL('game.js', SCRIPT || location.href).href; s.async = true; d.body.appendChild(s); };
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  if (d.readyState === 'complete') idle(loadGame, { timeout: 2500 });
  else addEventListener('load', () => idle(loadGame, { timeout: 2500 }));
})();
