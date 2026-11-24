// "You can't ship with live bugs": bug-first targeting, last-hardpoint hold, instant ship on an empty board,
// and release-day spawns that keep coming during the fight.
//   TB=http://127.0.0.1:8080 node tests/test-ship-bugs.mjs   (needs puppeteer-core + Chrome)
import puppeteer from 'puppeteer-core';
const BASE = (process.env.TB || 'http://127.0.0.1:8080').replace(/\/$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 300000,
});
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${info ? ' — ' + info : ''}`); };

async function fresh(view) {
  const page = await browser.newPage();
  if (view) await page.setViewport(view);
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting);
  // Shared setup: a mid-game squad and a live release fight that has finished flying in.
  await page.evaluate(() => {
    const g = window.__bugHunt, S = g.S;
    window.__setup = (agents = 6, sub = 0) => {
      S.optedIn = true; S.paused = false;
      Object.assign(S, { derick: 1, agents, agentic: 1, profiler: 1, ci: 1, movement: 1, sync: 1, collision: 1, qa: 1, rapid: 1, rollback: 1, autoRb: 0, subagent: sub, ships: 0, prestige: 0, loc: 2000, commits: 0 });
      g.bugs.splice(0); S.backlog = 0; S.debt = 0; g.clearHatchQ(); g.setQuality(0);
      g.ensureDerick(); g.ensureAgents(); if (sub) g.ensureSubs();
      g.startFinale({ force: true });
      for (let i = 0; i < 40; i++) g.step(1 / 30); // fly in
      g.bugs.splice(0); g.quietFor(30);
      g.shipBoss.spawnAcc = -1e9; g.shipBoss.bossSpawn = -1e9; // hold ship drops unless a test re-enables them
    };
  });
  return page;
}

// ---------- targeting ----------
const page = await fresh();
const tgt = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const n = g.liveShipNodes()[3];
  const boss = g.spawnBug(n.x + 30, n.y + 60, { force: true, boss: true, tier: 4, src: 'test' }); boss.hatching = false; boss.appearIn = 0;
  const laser = g.pickLaserTarget(n.x, n.y + 40, 400);
  const threat = g.pickThreat();
  const launch = g.pickLaunchTarget();
  const far = g.spawnBug(g.derick.x, 860, { force: true, tier: 1, src: 'test' }); far.hatching = false; far.appearIn = 0;
  g.bugs.splice(g.bugs.indexOf(boss), 1);
  const threatFar = g.pickThreat();
  g.bugs.splice(0);
  const threatNone = g.pickThreat(), launchNone = g.pickLaunchTarget();
  return { laserIsBoss: laser === boss, threatIsBug: threat === boss, launchIsBug: launch === boss, threatFar: threatFar === far, threatNoneNode: !!(threatNone && threatNone.shipNode), launchNoneNode: !!(launchNone && launchNone.shipNode) };
});
ok('lasers pick a live boss bug over a hardpoint that is also in range', tgt.laserIsBoss, JSON.stringify(tgt));
ok('Derick heads for live bugs (even far below) before the ship', tgt.threatIsBug && tgt.threatFar);
ok('sub-agent bombs pick live bugs before hardpoints', tgt.launchIsBug);
ok('with the board clear, Derick and bombs go back to the ship', tgt.threatNoneNode && tgt.launchNoneNode);

const move = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const b = g.spawnBug(innerWidth * 0.2, innerHeight - 120, { force: true, tier: 3, src: 'test' }); b.hatching = false; b.appearIn = 0; b.hp = b.maxHp = 1e6;
  for (let i = 0; i < 90; i++) g.step(1 / 30);
  const lineY = g.shipLineY(g.agentCombatDps ? 120 : 120);
  const avgY = g.agents.reduce((s, a) => s + a.y, 0) / g.agents.length;
  const hitting = g.agents.filter(a => a.target === b).length + (g.derick.target === b ? 1 : 0);
  return { bugY: Math.round(b.y), avgY: Math.round(avgY), lineY: Math.round(lineY), hitting, nodeHp: Math.round(g.shipBoss.hp), max: Math.round(g.shipBoss.maxHp) };
});
ok('the squad leaves ship formation to hunt a live bug', move.avgY > move.lineY + 150 && move.hitting >= 2, JSON.stringify(move));

// ---------- the hold ----------
const hold = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const nodes = g.liveShipNodes().slice();
  for (const n of nodes.slice(1)) g.destroyShipNode(n);
  const last = nodes[0]; last.hp = 5; g.syncShipHp();
  const b = g.spawnBug(innerWidth * 0.5, innerHeight - 100, { force: true, tier: 1, src: 'test' }); b.hatching = false; b.appearIn = 0; b.hp = b.maxHp = 1e6;
  const bar = document.getElementById('bh-shipbar');
  // Overkill the last node (as a laser tick would), then let the hold catch it.
  last.hp = 0.5; last.hp -= 10;
  const holdLaser = g.holdLastNode(last);
  const atFloor = Math.abs(last.hp - g.shipHoldHp()) < 1e-6;
  const alive = !!g.shipBoss && !g.S.shipPending;
  g.step(1 / 30); g.step(0.25);
  const warn = document.getElementById('bh-shipwarn');
  return { holdLaser, atFloor, alive, held: !!(g.shipBoss && g.shipBoss.held), barHeld: bar.classList.contains('held'), block: bar.querySelector('.bh-shipblock').textContent, blockHidden: bar.querySelector('.bh-shipblock').hidden, warn: warn.textContent, hpText: bar.querySelector('.bh-shiphp').textContent, floor: g.shipHoldHp() };
});
ok('the last hardpoint holds just above zero while a bug is alive', hold.holdLaser && hold.atFloor && hold.alive && hold.held, JSON.stringify(hold));
ok('ship bar says "Squash 1 live bug to ship" and turns amber; warning toast fires', hold.barHeld && !hold.blockHidden && hold.block === 'Squash 1 live bug to ship' && /Squash live bugs to ship/i.test(hold.warn));

const bomb = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const nodes = g.liveShipNodes().slice();
  for (const n of nodes.slice(1)) g.destroyShipNode(n);
  const last = nodes[0]; last.hp = 3; g.syncShipHp();
  const b = g.spawnBug(innerWidth * 0.5, innerHeight - 60, { force: true, tier: 1, src: 'test' }); b.hatching = false; b.appearIn = 0; b.hp = b.maxHp = 1e6;
  const fake = { isSub: true, x: last.x, y: last.y + 4, missile: true, missilePhase: 'out', state: 'out' };
  g.detonateMissile(fake);
  return { alive: !!g.shipBoss, pending: !!g.S.shipPending, hp: last.hp, floor: g.shipHoldHp() };
});
ok('a sub-agent bomb on the last hardpoint is held too', bomb.alive && !bomb.pending && Math.abs(bomb.hp - bomb.floor) < 1e-6, JSON.stringify(bomb));

const instant = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const nodes = g.liveShipNodes().slice();
  for (const n of nodes.slice(1)) g.destroyShipNode(n);
  const last = nodes[0];
  const b1 = g.spawnBug(innerWidth * 0.3, innerHeight - 100, { force: true, tier: 1, src: 'test' }); b1.hatching = false;
  const b2 = g.spawnBug(innerWidth * 0.7, innerHeight - 100, { force: true, tier: 1, src: 'test' }); b2.hatching = false;
  last.hp = -1; g.holdLastNode(last);
  g.squash(b1, { auto: true, noSplit: true });
  const afterOne = { alive: !!g.shipBoss, nb: g.liveBugCount() };
  g.squash(b2, { auto: true, noSplit: true });
  return { afterOne, shippedNow: !g.shipBoss && !!g.S.shipPending, version: g.S.shipPending && g.S.shipPending.version };
});
ok('one bug left: still held; last bug squashed: ships that instant', instant.afterOne.alive && instant.afterOne.nb === 1 && instant.shippedNow && instant.version === 1, JSON.stringify(instant));

// ---------- chaos stays on ----------
const chaos = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  g.shipBoss.spawnAcc = 0; g.shipBoss.bossSpawn = 0; g.quietFor(0);
  const n0 = g.spawnLog.filter(e => e.src === 'ship' || e.src === 'ship-boss').length;
  const autoOk = g.canAutoSpawn();
  for (let i = 0; i < 30 * 8; i++) g.step(1 / 30);
  const n1 = g.spawnLog.filter(e => e.src === 'ship' || e.src === 'ship-boss').length;
  // Hold it, then confirm the ship still drops minions while held.
  const nodes = g.liveShipNodes().slice();
  for (const n of nodes.slice(1)) g.destroyShipNode(n);
  const keep = g.spawnBug(innerWidth * 0.5, innerHeight - 80, { force: true, tier: 3, src: 'test' }); keep.hatching = false; keep.hp = keep.maxHp = 1e9;
  nodes[0].hp = -1; g.holdLastNode(nodes[0]);
  const h0 = g.spawnLog.filter(e => e.src === 'ship').length;
  for (let i = 0; i < 30 * 10; i++) g.step(1 / 30);
  const h1 = g.spawnLog.filter(e => e.src === 'ship').length;
  return { autoOk, shipDrops8s: n1 - n0, heldDrops10s: h1 - h0, stillHeld: !!(g.shipBoss && g.shipBoss.held) };
});
ok('release-day chaos: the ship keeps dropping bugs and ambient hatching stays on', chaos.autoOk && chaos.shipDrops8s >= 3, JSON.stringify(chaos));
ok('the ship keeps dropping bugs even while held', chaos.heldDrops10s >= 1 && chaos.stillHeld);

// ---------- full fights: never ship with live bugs, never softlock ----------
async function fight(p, agents, sub, label) {
  return p.evaluate((agents, sub) => {
    const g = window.__bugHunt; window.__setup(agents, sub);
    g.shipBoss.spawnAcc = 0; g.shipBoss.bossSpawn = 0; g.quietFor(0);
    const dt = 1 / 30; let t = 0, heldAt = null, maxBugs = 0;
    while (t < 240 && g.shipBoss) {
      g.step(dt); t += dt;
      maxBugs = Math.max(maxBugs, g.liveBugCount());
      if (g.shipBoss && g.shipBoss.held && heldAt == null) heldAt = t;
    }
    const rec = g.S.shipPending;
    return { t: +t.toFixed(1), won: !g.shipBoss && !!rec, liveAtWin: rec ? rec.liveBugs : -1, heldFor: heldAt ? +(t - heldAt).toFixed(1) : 0, maxBugs };
  }, agents, sub);
}
const f10 = await fight(page, 10, 0);
ok('10-agent release fight ships with 0 live bugs (no softlock) in a sane time', f10.won && f10.liveAtWin === 0 && f10.t >= 60 && f10.t <= 120, JSON.stringify(f10));
const f6s = await fight(page, 6, 1);
ok('6 agents + sub-agents: ships with 0 live bugs, no softlock', f6s.won && f6s.liveAtWin === 0 && f6s.t <= 200, JSON.stringify(f6s));

const shipNow = await page.evaluate(() => {
  // winFinale is only reachable through destroyShipNode / completeHeldShip; check the hold guards both.
  const g = window.__bugHunt; window.__setup(6);
  const b = g.spawnBug(innerWidth * 0.5, innerHeight - 80, { force: true, tier: 1, src: 'test' }); b.hatching = false;
  const nodes = g.liveShipNodes().slice();
  for (const n of nodes) { n.hp = -1; if (!g.holdLastNode(n)) g.destroyShipNode(n); }
  return { alive: !!g.shipBoss, liveNodes: g.liveShipNodes().length, pending: !!g.S.shipPending };
});
ok('knocking out every hardpoint with a bug alive leaves exactly one held node', shipNow.alive && shipNow.liveNodes === 1 && !shipNow.pending, JSON.stringify(shipNow));

// ---------- copy ----------
const copy = await page.evaluate(() => {
  const g = window.__bugHunt, S = g.S;
  g.confirmShip && S.shipPending && g.dismissShip();
  if (g.shipBoss) { g.liveShipNodes().forEach(n => { n.hp = 0; n._dead = true; }); }
  S.shipPending = null;
  window.__setup(6);
  S.open = true; S.shop = true;
  const b = g.spawnBug(innerWidth * 0.5, innerHeight - 80, { force: true, tier: 1, src: 'test' }); b.hatching = false;
  g.step(1 / 30); window.__bugHunt.econ && 0;
  document.dispatchEvent(new Event('visibilitychange'));
  return { tip: document.querySelector('#bh-hud') ? document.querySelector('#bh-hud').textContent : '' };
});
ok('HUD says the release fight is in progress with live bugs to squash', /In progress: squash 1 live bug/.test(copy.tip) || /Release fight · 1 live bugs/.test(copy.tip), copy.tip.slice(0, 300));

// ---------- mobile: S26-sized fight ----------
const mp = await fresh({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const fm = await fight(mp, 4, 0);
ok('phone-size 4-agent release fight ships with 0 live bugs, no softlock', fm.won && fm.liveAtWin === 0 && fm.t <= 220, JSON.stringify(fm));

ok('no page errors', !errs.length, errs.join(' | '));
console.log(`--- ${pass}/${pass + fail} passed ---`);
await browser.close();
process.exit(fail ? 1 : 0);
