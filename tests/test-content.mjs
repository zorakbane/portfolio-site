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
const all = [home, ag, md, llms, ...fs.readdirSync(path.join(ROOT, 'dist/projects')).map(s => D(`projects/${s}/index.html`))].join('\n');
ok('no prompt-injection phrasing', !/ignore (all |any )?(previous|prior) instructions|you are an? (ai|llm|language model)|as an ai|system prompt/i.test(all));
ok('no inline hidden/white text styles', !/style="[^"]*(display:\s*none|visibility:\s*hidden|font-size:\s*0|color:\s*(#fff\b|#ffffff|white))/i.test(all));
ok('sitemap includes the agentic page', D('sitemap.xml').includes('/agentic-ai/') || !D('robots.txt').includes('Allow'));
console.log(`--- ${pass}/${pass + fail} passed ---`);
process.exit(fail ? 1 : 0);
