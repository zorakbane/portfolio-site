// Zero-dependency static site builder.
//   node build.mjs              -> dist/ (TODO notes visible)
//   node build.mjs --hide-todos -> dist/ with TODO notes stripped
//   BASE=/repo-name/ node build.mjs  (when hosting under a sub-path)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const BASE = process.env.BASE || '/';
const SHOW_TODOS = !process.argv.includes('--hide-todos');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects.json'), 'utf8'));
const IMG = JSON.parse(fs.readFileSync(path.join(ROOT, 'static/img/images.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(ROOT, 'static/css/site.css'), 'utf8');
const hashOf = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const CSS_HASH = hashOf(CSS);
const MAIN_HASH = hashOf(fs.readFileSync(path.join(ROOT, 'static/js/main.js')));
const GAME_HASH = hashOf(fs.readFileSync(path.join(ROOT, 'static/js/game.js')));
const CF_WEB_ANALYTICS_TOKEN = 'd32b06ba149348ff889364285db9fec3';
const S = data.site;

// Baked Inter 900 outlines with overlaps removed (variable-font A/N are
// built from overlapping stems + bars; stroking those raw looked like a
// doubled A). removeOverlaps unions each glyph to outer + counters.
const JANSSEN_OUTLINE = `<svg class="ht-outline" viewBox="0 0 593 98" preserveAspectRatio="xMinYMid meet" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" d="M37.33 90.18Q23.25 90.18 15.63 83.41Q8 76.64 8 64.07V59.08H29.7V64.5Q29.7 68.91 31.69 71.11Q33.67 73.31 37.33 73.31Q40.98 73.31 42.91 71.11Q44.85 68.91 44.85 64.4V9.07H66.22V63.97Q66.22 76.59 58.73 83.38Q51.24 90.18 37.33 90.18ZM81.85 89.1 107.79 9.07H137.44L164.35 89.1H139.75L135.13 73.74H110.53L106.13 89.1ZM130.3 57.52Q127.4 47.69 124.82 37.06Q123.58 31.9 122.4 26.8Q121.27 31.9 120.2 37.06Q117.94 47.69 115.15 57.52ZM179.98 89.1V9.07H203.61L222.68 40.5Q225.15 44.58 227.3 48.66Q229.44 52.74 231.49 57.63Q232.34 59.83 233.26 62.3Q233.15 60.74 233.04 59.03Q232.61 53.33 232.29 47.77Q231.97 42.21 231.97 38.4V9.07H254.31V89.1H230.68L212.9 59.88Q209.89 54.89 207.61 50.57Q205.33 46.24 203.23 41.41Q202.21 39.15 201.08 36.52Q201.25 38.99 201.46 41.46Q201.84 47.05 202.08 51.83Q202.32 56.61 202.32 59.88V89.1ZM305.17 90.07Q294.75 90.07 286.99 86.98Q279.23 83.89 274.93 77.45Q270.64 71 270.58 60.96H291.21Q291.42 64.61 293.06 67.14Q294.7 69.66 297.68 70.95Q300.66 72.24 304.85 72.24Q308.34 72.24 310.71 71.38Q313.07 70.52 314.28 68.99Q315.49 67.46 315.49 65.47Q315.49 63.64 314.33 62.27Q313.18 60.91 310.54 59.78Q307.91 58.65 303.46 57.74L295.4 56.02Q284.82 53.76 278.72 48.31Q272.62 42.86 272.62 33.46Q272.62 25.83 276.76 20.11Q280.9 14.39 288.17 11.2Q295.45 8 304.96 8Q314.68 8 321.74 11.25Q328.81 14.5 332.65 20.38Q336.49 26.26 336.54 34.1H315.7Q315.43 30.18 312.83 28.01Q310.22 25.83 304.96 25.83Q301.63 25.83 299.48 26.61Q297.33 27.39 296.31 28.79Q295.29 30.18 295.29 31.96Q295.29 33.83 296.39 35.26Q297.49 36.68 299.88 37.73Q302.27 38.78 306.03 39.58L312.59 40.98Q319.19 42.38 323.95 44.68Q328.7 46.99 331.73 50.08Q334.77 53.17 336.19 57.04Q337.62 60.91 337.62 65.47Q337.62 73.37 333.72 78.87Q329.83 84.38 322.58 87.22Q315.33 90.07 305.17 90.07ZM386.44 90.07Q376.02 90.07 368.25 86.98Q360.49 83.89 356.2 77.45Q351.9 71 351.85 60.96H372.47Q372.69 64.61 374.32 67.14Q375.96 69.66 378.94 70.95Q381.92 72.24 386.11 72.24Q389.6 72.24 391.97 71.38Q394.33 70.52 395.54 68.99Q396.75 67.46 396.75 65.47Q396.75 63.64 395.59 62.27Q394.44 60.91 391.81 59.78Q389.17 58.65 384.72 57.74L376.66 56.02Q366.08 53.76 359.98 48.31Q353.89 42.86 353.89 33.46Q353.89 25.83 358.02 20.11Q362.16 14.39 369.44 11.2Q376.71 8 386.22 8Q395.94 8 403.01 11.25Q410.07 14.5 413.91 20.38Q417.75 26.26 417.8 34.1H396.96Q396.69 30.18 394.09 28.01Q391.48 25.83 386.22 25.83Q382.89 25.83 380.74 26.61Q378.59 27.39 377.57 28.79Q376.55 30.18 376.55 31.96Q376.55 33.83 377.65 35.26Q378.75 36.68 381.15 37.73Q383.54 38.78 387.29 39.58L393.85 40.98Q400.45 42.38 405.21 44.68Q409.96 46.99 413 50.08Q416.03 53.17 417.45 57.04Q418.88 60.91 418.88 65.47Q418.88 73.37 414.98 78.87Q411.09 84.38 403.84 87.22Q396.59 90.07 386.44 90.07ZM435.15 89.1V9.07H492.83V26.58H456.85V40.12H489.83V57.2H456.85V71.59H492.62V89.1ZM510.56 89.1V9.07H534.19L553.26 40.5Q555.73 44.58 557.88 48.66Q560.02 52.74 562.06 57.63Q562.92 59.83 563.84 62.3Q563.73 60.74 563.62 59.03Q563.19 53.33 562.87 47.77Q562.55 42.21 562.55 38.4V9.07H584.89V89.1H561.26L543.48 59.88Q540.47 54.89 538.19 50.57Q535.91 46.24 533.81 41.41Q532.79 39.15 531.66 36.52Q531.83 38.99 532.04 41.46Q532.42 47.05 532.66 51.83Q532.9 56.61 532.9 59.88V89.1Z"/></svg>`;
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const u = p => BASE + p.replace(/^\//, '');
const resumeDownload = (cls) =>
  `<a class="${cls}" href="${u('resume.pdf')}" download="Derick-Janssen-Resume.pdf">Download resume</a>`;
const isTodo = s => typeof s === 'string' && /^TODO\b/.test(s);
const todo = s => (SHOW_TODOS && s ? `<span class="todo">${esc(s)}</span>` : '');
const todos = arr => (SHOW_TODOS && arr && arr.length ? `<div class="todos">${arr.map(todo).join('')}</div>` : '');
// Project `niceToHave[]` is documentation-only and is never rendered.
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
<meta name="asset-rev" content="css:${CSS_HASH};js:${MAIN_HASH};game:${GAME_HASH}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">
<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="icon" href="${u('favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<style>${CSS}</style>
<script>document.documentElement.classList.add('js')</script>
<script src="${u('js/main.js')}?v=${MAIN_HASH}" defer data-game="${u('js/game.js')}?v=${GAME_HASH}"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${u('')}"><span class="brand-mark" aria-hidden="true">DJ</span><span class="brand-name">Derick Janssen</span></a>
  <nav class="nav" aria-label="Sections">${nav}</nav>
  ${resumeDownload('btn top-resume')}
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <p>© ${new Date().getFullYear()} Derick Janssen · Built by hand, fast on purpose. <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>
</footer>
<div class="wipe" aria-hidden="true"></div>
<template id="bh-wordmark-outline">${JANSSEN_OUTLINE}</template>
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${CF_WEB_ANALYTICS_TOKEN}"}'></script>
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
      ${hasPage(p) ? `<span class="card-cta">Details <span aria-hidden="true">→</span></span>` : (p.url ? `<span class="card-cta">${esc(p.linkLabel || 'Open')} <span aria-hidden="true">↗</span></span>` : '')}
      ${todos(p.todo)}
    </div>`;
  const cardHref = hasPage(p) ? href(p) : (p.url || '');
  const cardInner = cardHref
    ? `<a class="card-link" href="${esc(cardHref)}"${hasPage(p) ? '' : ' target="_blank" rel="noopener"'}">${inner}</a>`
    : `<div class="card-link">${inner}</div>`;
  return `<article class="card small reveal" style="--accent:${p.accent};--i:${i % 6}">${cardInner}</article>`;
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
    <h1 id="hero-title" class="hero-title"><span class="ht-line" data-text="Derick">Derick</span><span class="ht-line ht-2" data-text="Janssen">${JANSSEN_OUTLINE}<span class="ht-sr">Janssen</span></span></h1>
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
    <div class="about-text reveal">${S.location ? `<p class="about-location">${esc(S.location)}</p>` : ''}${data.about.map(p => `<p>${esc(p)}</p>`).join('')}
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
      <ul class="links">${S.links.filter(l => l.label !== 'Email').map(l => l.url ? `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a></li>` : (SHOW_TODOS ? `<li>${esc(l.label)} ${todo(l.todo)}</li>` : '')).join('')}</ul>
      <p class="resume-dl">${resumeDownload('btn primary')}</p>
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
fs.cpSync(path.join(ROOT, 'static'), OUT, {
  recursive: true,
  filter: src => !src.endsWith('.css') && !src.endsWith('images.json') && path.basename(src) !== 'CNAME'
});
// CNAME publishes the GitHub Pages custom domain. Keep it out of preview / default
// builds until go-live is approved; set PUBLISH_CNAME=1 for the production deploy.
if (process.env.PUBLISH_CNAME === '1') {
  fs.copyFileSync(path.join(ROOT, 'static/CNAME'), path.join(OUT, 'CNAME'));
}
fs.writeFileSync(path.join(OUT, 'index.html'), home());
const paged = projects.filter(hasPage);
paged.forEach((p, i) => {
  const dir = path.join(OUT, 'projects', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), projectPage(p, i, paged));
});
fs.writeFileSync(path.join(OUT, '404.html'), layout({ title: `404 | ${S.name}`, desc: 'Page not found', body: `<section class="sec wrap center"><h1 class="proj-title">404</h1><p>This page desynced. Rolling back…</p><p><a class="btn primary" href="${u('')}">Respawn at home</a></p></section>` }));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const origin = String(S.url || 'https://derickjanssen.com').replace(/\/$/, '');
const atRoot = BASE === '/' || BASE === '';
if (atRoot) {
  const sitemapUrls = [origin + '/', ...paged.map(p => `${origin}/projects/${p.slug}/`)];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + sitemapUrls.map(loc => `  <url><loc>${loc}</loc></url>`).join('\n')
    + '\n</urlset>\n');
}
fs.writeFileSync(path.join(OUT, 'robots.txt'), atRoot
  ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
  : `User-agent: *\nDisallow: /\n`);
console.log(`Built ${1 + paged.length + 1} pages -> ${OUT}${SHOW_TODOS ? ' (TODOs visible)' : ''}${process.env.PUBLISH_CNAME === '1' ? ' (CNAME included)' : ''}`);
