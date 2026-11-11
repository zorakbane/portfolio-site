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
