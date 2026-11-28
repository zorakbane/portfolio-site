// Zero-dependency checks for the machine-readable layer and content facts.
//   node build.mjs && node tests/test-content.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const D = p => fs.readFileSync(path.join(ROOT, 'dist', p), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info && !cond ? ' — ' + info : ''}`); };

const home = D('index.html');
const ld = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
const person = ld.find(o => o['@type'] === 'Person');
ok('home has a JSON-LD Person', !!person);
ok('Person name/jobTitle/worksFor match the site', person && person.name === data.site.name && person.jobTitle === 'Principal Engineer' && person.worksFor.name === 'Santa Barbara Games');
ok('Person sameAs are the visible profile links', person && person.sameAs.every(u => data.site.links.some(l => l.url === u)));
ok('hero tagline mentions teams of up to 12 engineers', home.includes('led teams of up to 12 engineers'));
for (const [slug, s] of [['skyrim-vr', '12 engineers'], ['starfield', '6 direct reports'], ['rise-of-elements', '3 engineers'], ['voidwood', '12-person studio']]) {
  ok(`${slug}: team size on the home card and project page`, home.includes(s) && D(`projects/${slug}/index.html`).includes(s));
}
const sky = D('projects/skyrim-vr/index.html'), f4 = D('projects/fallout-4-vr/index.html');
ok('Skyrim VR: dates, map-mode scope, Havok physics, 5% fewer crashes, StarMap move', sky.includes('Dec 2016 – Nov 2017') && sky.includes('every feature of the game except map mode') && !sky.includes('zoomed-out map') && sky.includes('Havok') && sky.includes('5% fewer crashes') && sky.includes('mentor the VR team'));
ok('Fallout 4 VR: Havok physics bullet', f4.includes('Havok gameplay physics'));
const ag = D('agentic-ai/index.html');
ok('agentic page exists with the workflow diagram', ag.includes('class="ag-flow') && (ag.match(/class="ag-step[ "]/g) || []).length === 5);
ok('agentic page: rules against new systems', /create a whole new system/.test(ag) && /project rules/.test(ag));
ok('agentic page: ~40 systems + V Rising figure with its source link', ag.includes('about 40 ECS systems') && ag.includes('1,600 ECS systems') && ag.includes('https://unity.com/resources/stunlock-studios-v-rising'));
ok('lab card links to the agentic page in the same tab', /<a class="card-link" href="[^"]*agentic-ai\/">/.test(home));
const md = D('resume.md'), llms = D('llms.txt');
ok('resume.md has experience, team sizes, education and the Skyrim VR facts', md.includes('## Experience') && md.includes('12-person studio') && md.includes('## Education') && md.includes('5% fewer crashes') && md.includes('Dec 2016 – Nov 2017'));
ok('JSON-LD knowsAbout includes Havok physics', person && person.knowsAbout.includes('Gameplay physics (Havok)'));
ok('llms.txt starts with an H1 + summary and links resume.md and the PDF', /^# Derick Janssen\n\n> /.test(llms) && llms.includes('resume.md') && llms.includes('resume.pdf'));
ok('footer links to the plain-text resume and llms.txt', /class="foot-alt"><a href="[^"]*resume\.md">Plain-text resume<\/a> · <a href="[^"]*llms\.txt">llms\.txt<\/a>/.test(home));
// No hidden or injected text anywhere in the output.
const redirectMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/legacy-redirects.json'), 'utf8'));
const redirectPages = redirectMap.redirects.map(r => D(`${r.from.replace(/^\//, '')}/index.html`));
const all = [home, ag, md, llms, D('404.html'), ...fs.readdirSync(path.join(ROOT, 'dist/projects')).map(s => D(`projects/${s}/index.html`)), ...redirectPages].join('\n');
ok('no prompt-injection phrasing', !/ignore (all |any )?(previous|prior) instructions|you are an? (ai|llm|language model)|as an ai|system prompt/i.test(all));
ok('no inline hidden/white text styles', !/style="[^"]*(display:\s*none|visibility:\s*hidden|font-size:\s*0|color:\s*(#fff\b|#ffffff|white))/i.test(all));
ok('sitemap includes the agentic page', D('sitemap.xml').includes('/agentic-ai/') || !D('robots.txt').includes('Allow'));

ok('no Best Paper claim anywhere in the built output', !/best paper/i.test(all));
ok('source data has no Best Paper claim either', !/best paper/i.test(JSON.stringify(data)));
const gar = D('projects/galactic-arms-race/index.html');
ok('GAR page uses the verified contribution wording, not authorship', gar.includes("contributed client and server code, game design and Steam integration") && gar.includes("Erin Hastings") && gar.includes('cgNEAT') && !/author of the (papers|paper)/i.test(gar));
ok('GAR page credits the team page, acknowledgments, IGC finalist and SMU scholarship', gar.includes('galacticarmsrace.blogspot.com/p/developers.html') && /acknowledgments/i.test(gar) && /Indie Game Challenge 2010/i.test(gar) && gar.includes('smu.edu/news/archives/2010/guildhall-scholarship-winner-25may2010'));
ok('hero badges are links: sim time, ARK +25%, GOTY awards, IGC finalist',
  /<a class="stat" href="[^"]*projects\/voidwood\/">/.test(home)
  && /<a class="stat" href="[^"]*projects\/ark-survival-ascended\/">/.test(home)
  && /<a class="stat" href="#awards">/.test(home) && home.includes('2× GOTY')
  && /<a class="stat" href="[^"]*projects\/galactic-arms-race\/">/.test(home) && home.includes('IGC Finalist')
  && !home.includes('Best Paper'));
ok('Voidwood mentions the Python AWS backend without claiming UBA itself',
  D('projects/voidwood/index.html').includes('Photon Quantum') && D('projects/voidwood/index.html').includes('UBA builder itself') && md.includes('Photon Quantum') && md.includes("didn't write the UBA builder"));
ok('Wicked Fox is labeled part-time after Jan 2025', home.includes('part-time, about 3 hrs/week, from Jan 2025') && md.includes('part-time, about 3 hrs/week, from Jan 2025'));
ok('skills include Cursor/Claude Code, AWS/Python, and CI on JanssEngine',
  home.includes('Cursor and Claude Code daily') && home.includes('CI on JanssEngine') && md.includes('Cursor and Claude Code daily'));
ok('talks are in person and listed in about + resume.md', home.includes('given talks in person at GR Dev Night') && md.includes('GR Dev Night, Grand Rapids') && md.includes('All of these talks were given in person'));
ok('JanssEngine page mentions CI', D('projects/janssengine/index.html').includes('continuous integration'));
ok('Voidwood short bullet cites V Rising 1,600 with the Unity case study, a scope caveat, and agent sprawl rules',
  (() => { const vw = D('projects/voidwood/index.html'); return vw.includes('about 40') && vw.includes('1,600') && vw.includes('https://unity.com/resources/stunlock-studios-v-rising') && /different scopes/.test(vw) && /multithreaded finite-state machines/.test(vw) && /agents default to creating new systems/i.test(vw) && /href="https:\/\/unity.com\/resources\/stunlock-studios-v-rising"/.test(vw); })());

ok('Best AI Editor\'s Pick is restored with AIGameDev.com source',
  home.includes("Editor's Pick") && home.includes('Best AI in an Independent Game') && home.includes('AIGameDev.com')
  && home.includes('web.archive.org/web/20100317005917/http://aigamedev.com/open/editorial/2009-awards-results/')
  && md.includes("Editor's Pick") && md.includes('aigamedev.com/open/editorial/2009-awards-results/')
  && D('projects/galactic-arms-race/index.html').includes('aigamedev.com/open/editorial/2009-awards-results/'));
ok('awards strip lists AI Battle as a confirmed school competition, 2nd place overall',
  /id="awards"[\s\S]*AI Battle \(school AI competition\): 2nd place overall[\s\S]*id="about"/.test(home)
  && home.includes('time and memory limits') && home.includes('ran matches deterministically')
  && md.includes('AI Battle (school AI competition): 2nd place overall'));

const origin = String(data.site.url || 'https://derickjanssen.com').replace(/\/$/, '');
const ogAbs = `${origin}/img/og-1200x630.jpg`;
const layoutPages = [home, ag, D('404.html'), ...fs.readdirSync(path.join(ROOT, 'dist/projects')).map(s => D(`projects/${s}/index.html`))];
for (const [label, html] of [['home', home], ['agentic', ag], ['404', D('404.html')], ['skyrim-vr', D('projects/skyrim-vr/index.html')]]) {
  ok(`${label} has og:image and twitter:card summary_large_image`,
    html.includes(`property="og:image" content="${ogAbs}"`)
    && html.includes('property="og:image:width" content="1200"')
    && html.includes('property="og:image:height" content="630"')
    && html.includes('name="twitter:card" content="summary_large_image"')
    && html.includes(`name="twitter:image" content="${ogAbs}"`));
}
ok('every layout page uses the same 1200x630 og:image', layoutPages.every(html => html.includes(`property="og:image" content="${ogAbs}"`) && html.includes('summary_large_image')));

const ogFile = path.join(ROOT, 'dist/img/og-1200x630.jpg');
ok('og image is in the build output', fs.existsSync(ogFile));
const jpegSize = (buf) => {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = (buf[i + 2] << 8) + buf[i + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: (buf[i + 5] << 8) + buf[i + 6], width: (buf[i + 7] << 8) + buf[i + 8] };
    }
    i += 2 + len;
  }
  return null;
};
const dim = jpegSize(fs.readFileSync(ogFile));
ok('og image is a 1200x630 JPEG', dim && dim.width === 1200 && dim.height === 630, dim ? `${dim.width}x${dim.height}` : 'unreadable');

const sitemap = D('sitemap.xml');
const urlBlocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
ok('sitemap has a lastmod date on every URL', urlBlocks.length > 0 && urlBlocks.every(b => /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(b) && /<loc>https:\/\/derickjanssen\.com\//.test(b)));
ok('sitemap does not list legacy redirect paths', redirectMap.redirects.every(r => !sitemap.includes(`${origin}${r.from}`)));
const today = new Date();
const todayStamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
ok('sitemap lastmod dates are not in the future', urlBlocks.every(b => {
  const m = b.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/);
  return m && m[1] <= todayStamp;
}));

const requiredFrom = [
  '/about-me', '/major-game-projects', '/individual-projects',
  '/individual-projects/engine', '/individual-projects/networking-and-multiplayer',
  '/individual-projects/artificial-intelligence', '/individual-projects/available-source-downloads',
  '/gaming', '/resume', '/networking', '/engine', '/ui', '/small-game-projects',
];
ok('redirect map covers every requested old Google Sites path', requiredFrom.every(f => redirectMap.redirects.some(r => r.from === f)));

const destHref = (to, base = '/') => {
  const hash = to.includes('#') ? to.slice(to.indexOf('#')) : '';
  const pathPart = to.includes('#') ? to.slice(0, to.indexOf('#')) : to;
  const u = p => base + p.replace(/^\//, '');
  const destPath = (!pathPart || pathPart === '/') ? u('') : u(pathPart.replace(/^\//, ''));
  return destPath + hash;
};
const canonUrl = (to) => {
  const hash = to.includes('#') ? to.slice(to.indexOf('#')) : '';
  const pathPart = to.includes('#') ? to.slice(0, to.indexOf('#')) : to;
  const destPath = (!pathPart || pathPart === '/') ? '/' : pathPart;
  return origin + destPath + hash;
};

for (const { from, to } of redirectMap.redirects) {
  const html = D(`${from.replace(/^\//, '')}/index.html`);
  const href = destHref(to, '/');
  const canon = canonUrl(to);
  const name = `redirect ${from} → ${to}`;
  ok(`${name}: noindex, canonical, meta refresh 0, JS replace, visible link`,
    /<meta name="robots" content="noindex, follow">/.test(html)
    && html.includes(`<link rel="canonical" href="${canon}">`)
    && html.includes(`<meta http-equiv="refresh" content="0;url=${href}">`)
    && html.includes(`location.replace(${JSON.stringify(href)})`)
    && html.includes(`<a href="${href}">${canon}</a>`));
  ok(`${name}: no game or main script`, !html.includes('js/game.js') && !html.includes('js/main.js') && !html.includes('bugHunt') && !html.includes('Bug Hunt'));
}

console.log(`--- ${pass}/${pass + fail} passed ---`);
process.exit(fail ? 1 : 0);
