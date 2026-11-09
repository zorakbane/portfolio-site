// Zero-dependency static site builder.
//   node build.mjs              -> dist/ (TODO notes visible)
//   node build.mjs --hide-todos -> dist/ with TODO notes stripped
//   BASE=/repo-name/ node build.mjs  (when hosting under a sub-path)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const BASE = process.env.BASE || '/';
const SHOW_TODOS = !process.argv.includes('--hide-todos');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects.json'), 'utf8'));
const IMG = JSON.parse(fs.readFileSync(path.join(ROOT, 'static/img/images.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(ROOT, 'static/css/site.css'), 'utf8');
const S = data.site;

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const u = p => BASE + p.replace(/^\//, '');
const isTodo = s => typeof s === 'string' && /^TODO\b/.test(s);
const todo = s => (SHOW_TODOS && s ? `<span class="todo">${esc(s)}</span>` : '');
const todos = arr => (SHOW_TODOS && arr && arr.length ? `<div class="todos">${arr.map(todo).join('')}</div>` : '');
const txt = s => (isTodo(s) ? todo(s) : esc(s));

function img(key, { sizes = '100vw', cls = '', alt = '', eager = false, fit = '' } = {}) {
  const m = IMG[key];
  if (!m) return '';
  const ws = m.w;
  const big = ws[ws.length - 1];
  const srcset = ws.map(w => `${u(`img/${key}-${w}.webp`)} ${w}w`).join(', ');
  const h = Math.round(big / m.ratio);
  return `<img class="${cls}${fit ? ' fit-' + fit : ''}" src="${u(`img/${key}-${ws[0]}.webp`)}" srcset="${srcset}" sizes="${sizes}" width="${big}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function yt(id, title) {
  if (!id) return '';
  return `<button class="yt" type="button" data-yt="${esc(id)}" aria-label="Play video: ${esc(title || 'trailer')}">
    <img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">
    <span class="yt-play" aria-hidden="true"><svg viewBox="0 0 68 48"><path d="M66.5 7.7A8.5 8.5 0 0 0 60.5 1.7C55.2.3 34 .3 34 .3S12.8.3 7.5 1.7A8.5 8.5 0 0 0 1.5 7.7C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z"/><path fill="#fff" d="M45 24 27 14v20z"/></svg></span>
    <span class="yt-title">${esc(title || '')}</span>
  </button>`;
}

const projects = data.projects;
const group = g => projects.filter(p => p.group === g);
const hasPage = p => !p.noPage;
const href = p => u(`projects/${p.slug}/`);

const NAV = [
  ['#work', 'Work'], ['#earlier', 'Earlier'], ['#lab', 'Lab'], ['#awards', 'Awards'], ['#about', 'About'], ['#contact', 'Contact'],
];

function layout({ title, desc, body, bodyClass = '', canonical = '', home = false }) {
  const nav = NAV.map(([h, l]) => `<a href="${home ? h : u('') + h}">${l}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#07070d">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="icon" href="${u('favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<style>${CSS}</style>
<script>document.documentElement.classList.add('js')</script>
<script src="${u('js/main.js')}" defer></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${u('')}"><span class="brand-mark" aria-hidden="true">DJ</span><span class="brand-name">Derick Janssen</span></a>
  <nav class="nav" aria-label="Sections">${nav}</nav>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <p>© ${new Date().getFullYear()} Derick Janssen · Built by hand, fast on purpose. <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>
  <p class="foot-hint">Psst: tap empty space. Bugs are coming.</p>
</footer>
<div class="wipe" aria-hidden="true"></div>
</body>
</html>`;
}

function featuredCard(p, i) {
  return `<article class="card feat reveal" style="--accent:${p.accent};--i:${i}">
  <a class="card-link" href="${href(p)}">
    <div class="card-media">${img(p.cardImage || p.image, { sizes: '(min-width: 1100px) 460px, (min-width: 700px) 45vw, 92vw', alt: `${p.title} key art` })}<span class="card-status">${esc(p.status || '')}</span></div>
    <div class="card-body">
      <p class="card-kicker">${esc(p.studio)} · ${esc(p.role)}</p>
      <h3 class="card-title">${esc(p.title)}</h3>
      <p class="card-sum">${esc(p.summary)}</p>
      <ul class="chips">${(p.tags || []).slice(0, 4).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <span class="card-cta">View mission <span aria-hidden="true">→</span></span>
    </div>
  </a>
</article>`;
}

function smallCard(p, i) {
  const inner = `
    ${p.image ? `<div class="card-media sm">${img(p.image, { sizes: '(min-width: 1100px) 340px, (min-width: 700px) 30vw, 92vw', alt: `${p.title} screenshot`, fit: p.imageFit })}</div>` : `<div class="card-media sm glyph" aria-hidden="true"><span>${esc(p.glyph || p.title.split(/\s+/).map(w => w[0]).join('').slice(0, 3))}</span></div>`}
    <div class="card-body">
      <p class="card-kicker">${esc(p.studio)}${p.engine ? ' · ' + esc(p.engine) : ''}</p>
      <h3 class="card-title">${esc(p.title)}</h3>
      <p class="card-sum">${esc(p.summary)}</p>
      ${p.awards ? `<ul class="chips gold">${p.awards.slice(0, 2).map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${hasPage(p) ? `<span class="card-cta">Details <span aria-hidden="true">→</span></span>` : ''}
      ${todos(p.todo)}
    </div>`;
  return `<article class="card small reveal" style="--accent:${p.accent};--i:${i % 6}">${hasPage(p) ? `<a class="card-link" href="${href(p)}">${inner}</a>` : `<div class="card-link">${inner}</div>`}</article>`;
}

const ICONS = {
  trophy: '<path d="M7 3h10v3h3v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V6h3zm0 5V8H6a3 3 0 0 0 1 2.2zm10 0v2.2A3 3 0 0 0 18 8z"/>',
  joystick: '<path d="M12 2a3 3 0 0 1 1 5.8V14h4a3 3 0 0 1 3 3v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a3 3 0 0 1 3-3h4V7.8A3 3 0 0 1 12 2z"/>',
  star: '<path d="m12 2 3 6.6 7 .7-5.3 4.8L18.2 21 12 17.3 5.8 21l1.5-6.9L2 9.3l7-.7z"/>',
  paper: '<path d="M6 2h8l5 5v15H6zm7 1.5V8h4.5zM8.5 12h8v1.5h-8zm0 3.5h8V17h-8z"/>',
  brain: '<path d="M9 3a3 3 0 0 1 3 1.8A3 3 0 0 1 15 3a3 3 0 0 1 3 3v.3A3.5 3.5 0 0 1 20 13a3.5 3.5 0 0 1-2 5.5A3 3 0 0 1 15 21a3 3 0 0 1-3-1.8A3 3 0 0 1 9 21a3 3 0 0 1-3-2.5A3.5 3.5 0 0 1 4 13a3.5 3.5 0 0 1 2-6.7V6a3 3 0 0 1 3-3z"/>',
  medal: '<path d="M7 2h4l1 4 1-4h4l-3 7a6 6 0 1 1-4 0zm5 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.star}</svg>`;

function home() {
  const feat = group('featured');
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-bg" aria-hidden="true"><div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div></div>
  <div class="wrap hero-inner">
    <p class="kicker"><span class="blink" aria-hidden="true">▮</span> ${esc(S.heroKicker)}</p>
    <h1 id="hero-title" class="hero-title"><span class="ht-line" data-text="Derick">Derick</span><span class="ht-line ht-2" data-text="Janssen">Janssen</span></h1>
    <p class="hero-role">${esc(S.title)} <span class="sep">//</span> Santa Barbara Games</p>
    <p class="hero-tag">${esc(S.tagline)}</p>
    <div class="hero-cta">
      <a class="btn primary" href="#work">See the work</a>
      <a class="btn" href="#contact">Get in touch</a>
    </div>
    <ul class="stats">${S.stats.map((s, i) => `<li class="stat reveal" style="--i:${i}"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></li>`).join('')}</ul>
  </div>
</section>

<section id="work" class="sec wrap" aria-labelledby="work-h">
  <header class="sec-head reveal"><p class="sec-num">01</p><h2 id="work-h">Featured work</h2><p class="sec-sub">Shipped and shipping: AAA, live, and multiplayer.</p></header>
  <div class="feat-grid">${feat.map(featuredCard).join('')}</div>
</section>

<section id="earlier" class="sec wrap" aria-labelledby="earlier-h">
  <header class="sec-head reveal"><p class="sec-num">02</p><h2 id="earlier-h">Earlier games</h2><p class="sec-sub">S2 Games, the SMU Guildhall, and the neuroevolution game that started it all.</p></header>
  <div class="small-grid">${group('earlier').map(smallCard).join('')}</div>
</section>

<section id="lab" class="sec wrap" aria-labelledby="lab-h">
  <header class="sec-head reveal"><p class="sec-num">03</p><h2 id="lab-h">Tech, AI & side projects</h2><p class="sec-sub">Engines, neuroevolution, agents, tools, and homebrew.</p></header>
  <div class="small-grid">${group('lab').map(smallCard).join('')}</div>
  <h3 class="sub-h reveal">Game jams <span>· at least one a year</span></h3>
  <ol class="jams">${data.jams.map((j, i) => `<li class="jam reveal" style="--i:${i % 6}">${j.image ? img(j.image, { sizes: '96px', alt: '', cls: 'jam-img' }) : '<span class="jam-img glyph" aria-hidden="true"></span>'}<div><b>${j.url ? `<a href="${esc(j.url)}" rel="noopener">${esc(j.title)}</a>` : esc(j.title)}</b><span class="jam-meta">${esc(j.event)}${j.engine ? ' · ' + esc(j.engine) : ''}</span><span class="jam-desc">${esc(j.desc)}</span></div></li>`).join('')}</ol>
</section>

<section id="awards" class="sec wrap" aria-labelledby="awards-h">
  <header class="sec-head reveal"><p class="sec-num">04</p><h2 id="awards-h">Achievements unlocked</h2></header>
  <ul class="awards">${data.awards.map((a, i) => `<li class="award reveal" style="--i:${i % 8}"><span class="award-ico">${icon(a.icon)}</span><div><b>${esc(a.title)}</b><span>${esc(a.project)}${a.year ? ' · ' + esc(a.year) : ''}</span></div></li>`).join('')}</ul>
</section>

<section id="about" class="sec wrap" aria-labelledby="about-h">
  <header class="sec-head reveal"><p class="sec-num">05</p><h2 id="about-h">About</h2></header>
  <div class="about">
    <div class="about-photo reveal">${img('derick', { sizes: '220px', alt: 'Derick Janssen' })}${todo(data.aboutTodo)}</div>
    <div class="about-text reveal">${data.about.map(p => `<p>${esc(p)}</p>`).join('')}
      <div class="skills">${Object.entries(data.skills).map(([k, v]) => `<div><h3>${esc(k)}</h3><ul class="chips">${v.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('')}</div>
      <details class="more"><summary>Competitive gaming record</summary><ul>${data.gaming.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>
      <details class="more"><summary>Talks</summary><ul>${data.talks.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>
    </div>
  </div>
</section>

<section id="contact" class="sec wrap" aria-labelledby="contact-h">
  <header class="sec-head reveal"><p class="sec-num">06</p><h2 id="contact-h">Resume & contact</h2></header>
  <div class="resume">
    <div class="timeline reveal">
      <h3>Experience</h3>
      <ol>${data.experience.map(e => `<li><b>${esc(e.company)}</b><span>${esc(e.role)} · ${esc(e.where)}</span><time>${esc(e.years)}</time></li>`).join('')}</ol>
      <h3>Education</h3>
      <ol>${data.education.map(e => `<li><b>${esc(e.school)}</b><span>${esc(e.degree)}</span><time>${esc(e.years)}</time><p>${esc(e.note)}</p></li>`).join('')}</ol>
    </div>
    <div class="contact-card reveal">
      <h3>Let's make something that feels great.</h3>
      <p>Open to conversations about gameplay, multiplayer, performance, tools, and agentic AI work.</p>
      <a class="btn primary big" href="mailto:${esc(S.email)}">${esc(S.email)}</a>
      <ul class="links">${S.links.filter(l => l.label !== 'Email').map(l => l.url ? `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)} ↗</a></li>` : (SHOW_TODOS ? `<li>${esc(l.label)} ${todo(l.todo)}</li>` : '')).join('')}</ul>
      <p class="resume-dl">${todo('TODO: export the resume to static/resume.pdf and link it here')}</p>
    </div>
  </div>
</section>`;
  return layout({ title: `${S.name} | ${S.title}`, desc: S.tagline, body, bodyClass: 'home', canonical: S.url + '/', home: true });
}

function projectPage(p, idx, list) {
  const prev = list[(idx - 1 + list.length) % list.length];
  const next = list[(idx + 1) % list.length];
  const meta = [['Studio', p.studio], ['Role', p.role], ['When', p.years], ['Tech', p.engine], ['Status', p.status]].filter(([, v]) => v);
  const gallery = (p.gallery || []).filter(k => IMG[k]);
  const body = `
<article class="proj" style="--accent:${p.accent}">
  <header class="proj-hero">
    ${p.image ? `<div class="proj-hero-img">${img(p.image, { sizes: '100vw', alt: `${p.title} key art`, eager: true, fit: p.imageFit })}</div>` : ''}
    <div class="wrap proj-hero-inner">
      <a class="back" href="${u('')}#${p.group === 'featured' ? 'work' : p.group === 'earlier' ? 'earlier' : 'lab'}">← Back to all work</a>
      <p class="kicker">${esc(p.studio)}</p>
      <h1 class="proj-title">${esc(p.title)}</h1>
      <p class="proj-sum">${esc(p.summary)}</p>
    </div>
  </header>
  <div class="wrap proj-body">
    <aside class="proj-meta reveal">
      <dl>${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${p.tags ? `<ul class="chips">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${p.links && p.links.length ? `<ul class="links">${p.links.map(l => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)} ↗</a></li>`).join('')}</ul>` : ''}
    </aside>
    <div class="proj-main">
      ${p.youtube ? `<div class="reveal">${yt(p.youtube, p.youtubeTitle)}</div>` : ''}
      ${p.bullets && p.bullets.length ? `<section class="reveal"><h2>What I did</h2><ul class="bullets">${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></section>` : ''}
      ${p.awards ? `<section class="reveal"><h2>Awards</h2><ul class="awards mini">${p.awards.map(a => `<li class="award"><span class="award-ico">${icon('trophy')}</span><div><b>${esc(a)}</b></div></li>`).join('')}</ul></section>` : ''}
      ${gallery.length ? `<section class="reveal"><h2>Gallery</h2><div class="gallery">${gallery.map(k => img(k, { sizes: '(min-width: 900px) 420px, 92vw', alt: `${p.title} screenshot` })).join('')}</div></section>` : ''}
      ${todos(p.todo)}
    </div>
  </div>
  <nav class="wrap pager" aria-label="More projects">
    <a href="${href(prev)}" class="btn">← ${esc(prev.title)}</a>
    <a href="${href(next)}" class="btn">${esc(next.title)} →</a>
  </nav>
</article>`;
  return layout({ title: `${p.title} | ${S.name}`, desc: p.summary, body, bodyClass: 'project', canonical: `${S.url}/projects/${p.slug}/` });
}

// ---- write ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'static'), OUT, { recursive: true, filter: s => !s.endsWith('.css') && !s.endsWith('images.json') });
fs.writeFileSync(path.join(OUT, 'index.html'), home());
const paged = projects.filter(hasPage);
paged.forEach((p, i) => {
  const dir = path.join(OUT, 'projects', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), projectPage(p, i, paged));
});
fs.writeFileSync(path.join(OUT, '404.html'), layout({ title: `404 | ${S.name}`, desc: 'Page not found', body: `<section class="sec wrap center"><h1 class="proj-title">404</h1><p>This page desynced. Rolling back…</p><p><a class="btn primary" href="${u('')}">Respawn at home</a></p></section>` }));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Built ${1 + paged.length + 1} pages -> ${OUT}${SHOW_TODOS ? ' (TODOs visible)' : ''}`);
