import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--disable-gpu'], protocolTimeout: 600000 });
const runs = +(process.env.RUNS || 2);
const L = JSON.parse(process.env.L || '[[10,1,0],[4,0,1],[6,1,0],[4,0,0]]');
for (const [agents, sub, mobile] of L) for (let r = 0; r < runs; r++) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport(mobile ? { width: 412, height: 915, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  await p.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting);
  const o = await p.evaluate((agents, sub) => {
    const g = window.__bugHunt, S = g.S;
    S.optedIn = true; S.paused = false;
    Object.assign(S, { derick: 1, agents, agentic: 1, profiler: 1, ci: 1, movement: 1, sync: 1, collision: 1, qa: 1, rapid: 1, rollback: 1, autoRb: 0, subagent: sub, ships: 0, prestige: 0, loc: 2000, commits: 0 });
    g.bugs.splice(0); S.backlog = 0; S.debt = 0; g.clearHatchQ(); g.setQuality(0);
    g.ensureDerick(); g.ensureAgents(); if (sub) g.ensureSubs();
    g.startFinale({ force: true });
    const dt = 1 / 30; let t = 0, sb;
    while (t < 300 && g.shipBoss) { sb = g.shipBoss; g.step(dt); t += dt; }
    return { t: +t.toFixed(1), won: !g.shipBoss, shieldT: +(sb.shieldT || 0).toFixed(1), patches: sb.patches || 0, live: S.shipPending ? S.shipPending.liveBugs : -1 };
  }, agents, sub);
  console.log(JSON.stringify({ agents, sub, mobile, ...o }));
  await ctx.close();
}
await browser.close();
