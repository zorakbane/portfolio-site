// HUD "BUGS" count must match the bugs actually on the board: click kills, splits, full-board clicks,
// starter trickle, Regression swarms, and rollback. (Derick's playtest: the count crept to ~100 on a clear
// screen because failed click/swarm spawns were queued as invisible backlog that never drained.)
//   TB=http://127.0.0.1:8080 node tests/test-hud-count.mjs   (needs puppeteer-core + Chrome)
import puppeteer from 'puppeteer-core';
const BASE = (process.env.TB || 'http://127.0.0.1:8080').replace(/\/$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 180000,
});
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${info ? ' — ' + info : ''}`); };
async function fresh(view) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (view) await page.setViewport(view);
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting);
  await page.evaluate(() => {
    const g = window.__bugHunt;
    window.__hud = () => { g.renderHud(true); return +(document.querySelector('.bh-hud [data-k=bugs]').textContent.replace(/[^0-9]/g, '') || 0); };
    window.__onBoard = () => g.bugs.filter(b => !b.entering && b.x >= -20 && b.x <= innerWidth + 20 && b.y >= -20 && b.y <= innerHeight + 20).length;
  });
  return page;
}
const snap = p => p.evaluate(() => ({ hud: window.__hud(), board: window.__onBoard(), arr: window.__bugHunt.bugs.length, backlog: window.__bugHunt.S.backlog }));

// ---------- real-click play: hatch, kill, split, full-board clicks ----------
{
  const p = await fresh();
  await p.evaluate(() => { const g = window.__bugHunt, S = g.S; g.optIn(); Object.assign(S, { loc: 900 }); g.setQuality(0); });
  // Mash empty space well past the cap (15 on desktop): each click tries to hatch a bug.
  for (let i = 0; i < 60; i++) { await p.mouse.click(300 + (i % 12) * 70, 300 + Math.floor(i / 12) * 60); }
  await p.evaluate(() => { const g = window.__bugHunt; for (let i = 0; i < 60; i++) g.step(1 / 30); });
  const full = await snap(p);
  ok('mashing empty space on a full board does not queue invisible bugs', full.hud === full.arr && full.backlog === 0 && full.arr <= 15, JSON.stringify(full));
  // Click-kill everything (bosses can't be clicked; there are none here). Splits re-enter the list.
  for (let round = 0; round < 40; round++) {
    const pts = await p.evaluate(() => window.__bugHunt.bugs.filter(b => !b.hatching && !b.boss).slice(0, 6).map(b => [b.x, b.y]));
    if (!pts.length) break;
    for (const [x, y] of pts) await p.mouse.click(x, y);
    await p.evaluate(() => { const g = window.__bugHunt; g.quietFor(30); for (let i = 0; i < 12; i++) g.step(1 / 30); });
  }
  const after = await snap(p);
  const splits = await p.evaluate(() => window.__bugHunt.spawnLog.filter(e => e.src === 'split').length);
  ok('after click-killing the board (with splits), the HUD reads what is on screen', after.hud === after.board && after.hud === after.arr && after.backlog === 0, JSON.stringify({ ...after, splits }));
  await p.browserContext().close();
}

// ---------- starter trickle ----------
{
  const p = await fresh();
  await p.evaluate(() => window.__bugHunt.optIn());
  await wait(8000);
  await p.evaluate(() => { const g = window.__bugHunt; for (let i = 0; i < 45; i++) g.step(1 / 30); });
  const s = await snap(p);
  ok('starter trickle: the HUD count matches the trickled bugs on screen', s.hud === s.board && s.hud >= 1 && s.hud <= 3 && s.backlog === 0, JSON.stringify(s));
  await p.browserContext().close();
}

// ---------- Regression swarm on a full board, then a full fight, then rollback ----------
{
  const p = await fresh();
  const r = await p.evaluate(() => {
    const g = window.__bugHunt, S = g.S;
    g.optIn();
    Object.assign(S, { derick: 1, agents: 6, agentic: 1, profiler: 1, ci: 1, movement: 1, sync: 1, collision: 1, qa: 1, rapid: 1, rollback: 1, autoRb: 0, subagent: 1, loc: 2000 });
    g.ensureDerick(); g.ensureAgents(); g.ensureSubs(); g.setQuality(0);
    g.startFinale({ force: true });
    for (let i = 0; i < 40; i++) g.step(1 / 30);
    // Pack the board to the fight cap, then drop three hardpoints: every overflow spawn used to land in backlog.
    while (g.bugs.length < g.fightCap()) { const b = g.spawnBug(innerWidth * Math.random(), innerHeight * (0.4 + Math.random() * 0.5), { force: true, swarm: true, tier: 1, src: 'test' }); if (!b) break; b.hatching = false; }
    const nodes = g.liveShipNodes().slice(0, 3);
    for (const n of nodes) g.destroyShipNode(n);
    for (let i = 0; i < 60; i++) g.step(1 / 30);
    const mid = { hud: window.__hud(), board: window.__onBoard(), arr: g.bugs.length, backlog: S.backlog };
    // Play the fight out; sample the HUD vs. board every second.
    let worst = 0, samples = 0, t = 0;
    while (t < 240 && g.shipBoss) {
      for (let i = 0; i < 30; i++) g.step(1 / 30);
      t += 1;
      g.econ(1);
      const h = window.__hud(), arr = g.bugs.length;
      worst = Math.max(worst, Math.abs(h - arr), S.backlog);
      samples++;
    }
    const won = !g.shipBoss;
    return { mid, worst, samples, won, t };
  });
  ok('Regression swarm on a full board: overflow is dropped, not queued as ghost bugs', r.mid.hud === r.mid.arr && r.mid.backlog === 0, JSON.stringify(r.mid));
  ok('across a whole release fight the HUD never drifts from the bugs on the board', r.worst === 0 && r.won, JSON.stringify(r));
  // Rollback empties everything, including queued hatches and debt.
  const rb = await p.evaluate(() => {
    const g = window.__bugHunt, S = g.S;
    g.hideShippedFanfare(); S.shipPending = null;
    for (let i = 0; i < 6; i++) { const b = g.spawnBug(400 + i * 50, 500, { force: true, tier: 2, src: 'test' }); if (b) b.hatching = false; }
    S.backlog = 3; S.debt = 4; g.requestHatch({ src: 'test' }); g.requestHatch({ src: 'test' });
    S.rbAt = 0; g.rollback(false);
    for (let i = 0; i < 30; i++) g.step(1 / 30);
    return { hud: window.__hud(), arr: g.bugs.length, backlog: S.backlog, q: g.hatchQ.length, debt: S.debt };
  });
  ok('rollback clears the board, backlog, hatch queue and debt; the HUD reads 0', rb.hud === 0 && rb.arr === 0 && rb.backlog === 0 && rb.q === 0 && rb.debt === 0, JSON.stringify(rb));
  await p.browserContext().close();
}

// ---------- ghost count can't block shipping or the launch gate ----------
{
  const p = await fresh();
  const g8 = await p.evaluate(() => {
    const g = window.__bugHunt, S = g.S;
    g.optIn();
    Object.assign(S, { derick: 1, agents: 4, rollback: 1, loc: 99999, commits: 0 });
    g.ensureDerick(); g.ensureAgents();
    g.bugs.splice(0); S.backlog = 0; g.clearHatchQ();
    // Old bug path: forced/swarm/click overflow on a full board. None of it should touch backlog now.
    while (g.bugs.length < g.fightCap()) { const b = g.spawnBug(300, 400, { force: true, swarm: true, tier: 1, src: 'test' }); if (!b) break; }
    for (let i = 0; i < 50; i++) { g.spawnBug(300, 400, { fromClick: true, src: 'click' }); g.spawnBug(300, 400, { force: true, src: 'force' }); g.spawnBug(300, 400, { force: true, swarm: true, src: 'swarm' }); }
    const backlogAfter = S.backlog;
    g.bugs.splice(0);
    const launch = !!g.startFinale();
    const ok = !!g.shipBoss;
    if (g.shipBoss) g.winFinale();
    return { backlogAfter, launch, ok, liveAtWin: S.shipPending ? S.shipPending.liveBugs : null };
  });
  ok('overflow from clicks, forced spawns and swarms never inflates backlog, so the ≤3 launch gate opens on a clear board', g8.backlogAfter === 0 && g8.launch && g8.ok, JSON.stringify(g8));
  await p.browserContext().close();
}

ok('no page errors', !errs.length, errs.join(' | '));
console.log(`--- ${pass}/${pass + fail} passed ---`);
await browser.close();
process.exit(fail ? 1 : 0);
