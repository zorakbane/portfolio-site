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
      // Tear down any fight / SHIPPED card left by the previous test.
      if (g.shipBoss) g.winFinale();
      g.hideShippedFanfare(); S.shipPending = null;
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
  g.bugs.splice(0); // node-down bursts/swarms are tested separately
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
  g.bugs.splice(0); // node-down bursts/swarms are tested separately
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
  g.bugs.splice(0); // node-down bursts/swarms are tested separately
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
  g.bugs.splice(0); // node-down bursts/swarms are tested separately
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

// ---------- node down: a 'Regression' boss from the node + a swarm from offscreen ----------
const nd = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(10, 1);
  const W = innerWidth, H = innerHeight;
  const counts = new Set(); let badCount = 0;
  for (let i = 0; i < 60; i++) { const c = g.regressionKids(); counts.add(c); if (c < 3 || c > 5) badCount++; }
  const n = g.liveShipNodes()[2];
  g.destroyShipNode(n);
  const regs = g.bugs.filter(b => b.regression);
  const reg = regs[0];
  const swarmSnap = g.bugs.filter(b => b.entering);
  const regOk = regs.length === 1 && reg.name === 'Regression' && reg.boss && Math.hypot(reg.x - n.x, reg.y - n.y) < 40 && reg.regShed === 0;
  const swarm = g.bugs.filter(b => b.entering);
  const swarmOffscreen = swarm.every(b => b.y < 0); // pours in from the top
  // Counts as a live bug: bugs-first targeting picks it over hardpoints, and it's huntable.
  g.bugs.splice(0, g.bugs.length, reg);
  const targeted = g.pickThreat() === reg && g.pickLaunchTarget() === reg && g.pickLaserTarget(reg.x, reg.y - 30, 400) === reg && g.liveBugCount() === 1;
  // Chip it down step by step: kids shed at HP thresholds, the last one on death.
  for (const b of g.bugs) if (b !== reg) b.hp = b.maxHp = 1e9;
  const k = reg.regKids, shedLog = [];
  for (let f = 1; f < k; f++) {
    reg.hp = reg.maxHp * (1 - f / k) - 0.01; g.regressionShed(reg, false); shedLog.push(reg.regShed);
  }
  const before = g.bugs.filter(b => !b.regression).length;
  g.squash(reg, { auto: true });
  const kids = g.bugs.filter(b => !b.regression).length;
  const total = reg.regShed;
  // swarm: watch it walk in (fresh node drop)
  g.bugs.splice(0);
  g.destroyShipNode(g.liveShipNodes()[1]);
  const sw = g.bugs.filter(b => b.entering);
  for (const b of g.bugs) b.hp = b.maxHp = 1e9;
  for (let i = 0; i < 120; i++) g.step(1 / 30);
  const inside = sw.filter(b => !b.entering && b.x >= 0 && b.x <= W && b.y >= 56 && b.y <= H).length;
  // The Regression keeps the last node held until it's squashed.
  g.bugs.splice(0);
  const nodes = g.liveShipNodes();
  for (const m of nodes.slice(1)) g.destroyShipNode(m);
  const afterAll = g.bugs.length;
  const regAlive = g.bugs.some(b => b.regression);
  nodes[0].hp = -1; const held = g.holdLastNode(nodes[0]);
  g.bugs.splice(0); g.completeHeldShip();
  return { counts: [...counts].sort(), badCount, regOk, targeted, k, shedLog, before, kids, total, swarm: swarm.length, size: g.swarmSize(), swarmOffscreen, inside, swN: sw.length, fightCap: g.fightCap(), afterAll, regAlive, held, shipped: !g.liveShipNodes().length };
});
ok('a downed hardpoint drops one boss labeled "Regression" out of the node', nd.regOk, JSON.stringify(nd));
ok('a Regression counts as a live bug: picked over hardpoints by lasers, Derick and bombs', nd.targeted);
ok('the Regression sheds 3–5 bugs over its life, one per HP threshold and the last on death', nd.badCount === 0 && nd.counts[0] === 3 && nd.counts[nd.counts.length - 1] === 5 && nd.total === nd.k && nd.kids === nd.k && nd.before === nd.k - 1 && nd.shedLog.every((v, i) => v === i + 1));
ok('…and calls in a swarm that starts above the top edge (desktop, 10 agents: 6+ bugs)', nd.swarm === nd.size && nd.swarm >= 6 && nd.swarmOffscreen);
ok('swarm bugs are on the board within 4s', nd.inside === nd.swN, `${nd.inside}/${nd.swN}`);
ok('node-down spawns respect the fight cap, and a live Regression blocks shipping', nd.afterAll <= nd.fightCap && nd.regAlive && nd.held && nd.shipped);
const mshed = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(10, 1);
  // A single huge missile hit from full to dead still sheds every kid (none skipped).
  const r = g.spawnRegression(innerWidth / 2, innerHeight / 2); const k = r.regKids;
  g.bugs.splice(0, g.bugs.length, r);
  r.hp = -1; g.squash(r, { auto: true });
  return { k, kids: g.bugs.length };
});
ok('a Regression one-shot from full HP still drops all of its kids', mshed.kids === mshed.k, JSON.stringify(mshed));
const lastNode = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  const nodes = g.liveShipNodes();
  for (const m of nodes.slice(1)) { m.hp = -1; g.destroyShipNode(m); }
  g.bugs.splice(0);
  nodes[0].hp = -1; g.destroyShipNode(nodes[0]); // final node: ship goes out, no swarm
  return { bugs: g.bugs.length, won: !g.liveShipNodes().length };
});
ok('the final hardpoint ships the release without spawning a swarm', lastNode.won && lastNode.bugs === 0, JSON.stringify(lastNode));


// ---------- Regression swarm shield ----------
const sh = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(10, 1);
  const H = innerHeight;
  const n0 = g.liveShipNodes()[2];
  g.destroyShipNode(n0);
  const swarm = g.bugs.filter(b => b.entering);
  const fromTop = swarm.length > 0 && swarm.every(b => b.y < 0);
  // Fast entry: everyone's on the board in ~1.5s.
  for (const b of g.bugs) b.hp = b.maxHp = 1e9;
  let tIn = 0; while (tIn < 4 && g.bugs.some(b => b.entering)) { g.step(1 / 30); tIn += 1 / 30; }
  const shielded = g.shipShielded();
  const nodes = g.liveShipNodes(); const n = nodes[0];
  const hp0 = nodes.map(x => x.hp);
  g.bugs.splice(0); // only the shield-holders matter for the next checks: rebuild a small swarm
  const r = g.spawnRegression(n.x, n.y + 60);
  const laser = g.pickLaserTarget(n.x, n.y + 20, 2000);
  const threat = g.pickThreat(), launch = g.pickLaunchTarget();
  g.bugs.splice(g.bugs.indexOf(r), 1);
  const r2 = g.spawnRegression(innerWidth * 0.1, H - 40); // far from every node
  const laserFar = g.pickLaserTarget(n.x, n.y + 20, 120);
  const threatFar = g.pickThreat();
  g.damageBug(n, 1e6, 1, null);
  g.detonateMissile({ isSub: true, x: n.x, y: n.y + 4, missile: true, missilePhase: 'out', state: 'out' });
  const t1 = g.spawnBug(n.x, n.y + 40, { force: true, tier: 1, src: 'test' }); t1.hatching = false;
  g.shipBoss.chipBank = 0;
  const chip = g.chipShip(t1);
  const bank = g.shipBoss.chipBank;
  g.bugs.splice(g.bugs.indexOf(t1), 1);
  const hp1 = nodes.map(x => x.hp);
  const untouched = hp1.every((v, i) => v === hp0[i]);
  const barText = (document.querySelector('#bh-shipbar .bh-shipblock') || {}).textContent || '';
  // Clear it: the shield drops and the banked fixes land as one patch (× PATCH_BONUS).
  g.shipBoss.chipBank = g.shipBoss.maxHp * 0.01;
  g.bugs.splice(0);
  const before = g.liveShipNodes().reduce((s, x) => s + x.hp, 0);
  const patches0 = g.shipBoss.patches || 0;
  g.step(1 / 30);
  const after = g.liveShipNodes().reduce((s, x) => s + x.hp, 0);
  return { fromTop, tIn: +tIn.toFixed(2), shielded, laserIsReg: laser === r, threatIsReg: threat === r, launchIsReg: launch === r, laserFar: laserFar ? (laserFar.shipNode ? 'node' : 'bug') : null, threatFar: threatFar ? (threatFar.shipNode ? 'node' : 'bug') : null, chip, bank: +bank.toFixed(2), untouched, barText, patched: before - after, expect: g.shipBoss ? g.shipBoss.maxHp * 0.01 * g.PATCH_BONUS : 0, patches: (g.shipBoss.patches || 0) - patches0, shieldAfter: g.shipShielded() };
});
ok('the swarm pours in from the top and is on the board within ~1.5s', sh.fromTop && sh.tIn <= 1.6, JSON.stringify(sh));
ok('while the Regression swarm is up the ship is shielded: no node is picked by lasers, Derick or bombs', sh.shielded && sh.laserIsReg && sh.threatIsReg && sh.launchIsReg && sh.laserFar === null && sh.threatFar === 'bug');
ok('shielded nodes take no laser, bomb or chip damage; squash chips are banked instead', sh.untouched && sh.chip === 0 && sh.bank > 0);
ok('ship bar says the ship is shielded', /Shielded · clear the Regression swarm/.test(sh.barText), sh.barText);
ok('clearing the swarm drops the shield and lands the banked patch (×1.5)', !sh.shieldAfter && sh.patches === 1 && Math.abs(sh.patched - sh.expect) < 1);

// ---------- z-order: bugs draw over the ship ----------
const zo = await page.evaluate(() => {
  const g = window.__bugHunt; window.__setup(6);
  g.setQuality(3);
  const n = g.liveShipNodes()[3];
  const r = g.spawnRegression(n.x, n.y + 4); r.entering = false; r.pop = 1; r.flash = 0; r.boost = 0;
  g.draw();
  const cv = document.getElementById('bh-canvas'); const k = cv.width / innerWidth;
  const px = cv.getContext('2d').getImageData(Math.round(r.x * k), Math.round(r.y * k), 1, 1).data;
  g.bugs.splice(0);
  return { rgb: [px[0], px[1], px[2]] };
});
ok('a Regression sitting on a hardpoint draws over the ship (red body on top)', zo.rgb[0] > 120 && zo.rgb[0] > zo.rgb[2] + 40, JSON.stringify(zo));

// ---------- copy ----------
await page.evaluate(() => {
  const g = window.__bugHunt, S = g.S;
  window.__setup(6);
  g.optIn(); S.open = true; S.shop = true; S.paused = false;
  const b = g.spawnBug(innerWidth * 0.5, innerHeight - 80, { force: true, tier: 3, src: 'test' }); b.hatching = false; b.hp = b.maxHp = 1e9;
});
await wait(900); // let the real econ tick render the HUD
const copy = await page.evaluate(() => {
  const hud = document.querySelector('.bh-hud');
  const ship = hud && hud.querySelector('[data-act=ship]');
  const out = { tip: hud ? hud.textContent : '', shipText: ship ? ship.textContent : '', disabled: !!(ship && ship.disabled) };
  window.__bugHunt.pauseGame();
  return out;
});
ok('upgrade button is disabled mid-fight and says to squash the live bugs first', copy.disabled && /In progress: squash \d+ live bugs?, then the hardpoints/.test(copy.shipText), JSON.stringify(copy).slice(0, 400));

// ---------- mobile: S26-sized fight ----------
const mp = await fresh({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const fm = await fight(mp, 4, 0);
const mnd = await mp.evaluate(() => {
  const g = window.__bugHunt; window.__setup(4);
  const n = g.liveShipNodes()[2]; g.destroyShipNode(n);
  return { total: g.bugs.length, swarm: g.bugs.filter(b => b.entering).length, regression: g.bugs.filter(b => b.regression).length, size: g.swarmSize(), fightCap: g.fightCap() };
});
ok('phone: one Regression + a smaller swarm (3–4), under the phone fight cap', mnd.regression === 1 && mnd.swarm >= 3 && mnd.swarm <= 4 && mnd.total <= mnd.fightCap && mnd.fightCap <= 13, JSON.stringify(mnd));
ok('phone-size 4-agent release fight ships with 0 live bugs, no softlock', fm.won && fm.liveAtWin === 0 && fm.t <= 220, JSON.stringify(fm));

ok('no page errors', !errs.length, errs.join(' | '));
console.log(`--- ${pass}/${pass + fail} passed ---`);
await browser.close();
process.exit(fail ? 1 : 0);
