// Site onboarding bits: starter bug trickle at 0 LOC, scroll-to-write LOC (wheel + touch), and the shop gliding a new
// unlock into view.   TB=http://127.0.0.1:8080 node tests/test-onboarding.mjs   (needs puppeteer-core + Chrome)
import puppeteer from 'puppeteer-core';
const BASE = (process.env.TB || 'http://127.0.0.1:8080').replace(/\/$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 120000,
});
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${info ? ' — ' + info : ''}`); };
async function fresh(view, rm) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (view) await page.setViewport(view);
  if (rm) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting);
  return page;
}

// ---------- starter trickle ----------
{
  const p = await fresh();
  const pre = await p.evaluate(() => window.__bugHunt.bugs.length + window.__bugHunt.hatchQ.length);
  await p.evaluate(() => window.__bugHunt.optIn());
  await wait(9000);
  const t = await p.evaluate(() => {
    const g = window.__bugHunt;
    return { loc: g.S.loc, n: g.bugs.length + g.hatchQ.length, trickle: g.spawnLog.filter(e => e.src === 'trickle').length };
  });
  ok('before opting in, nothing spawns', pre === 0);
  ok('at 0 LOC, bugs start wandering in on their own within ~9s', t.loc === 0 && t.n >= 1 && t.trickle >= 1, JSON.stringify(t));
  const cap = await p.evaluate(() => {
    const g = window.__bugHunt; g.quietFor(0);
    let max = 0;
    for (let i = 0; i < 300; i++) { g.trickle(1); g.step(1 / 30); max = Math.max(max, g.bugs.length + g.hatchQ.length); }
    g.bugs.splice(0); g.clearHatchQ(); g.S.derick = 1; g.ensureDerick();
    for (let i = 0; i < 50; i++) g.trickle(1);
    return { max, afterDerick: g.hatchQ.length, TRICKLE_MAX: g.TRICKLE_MAX };
  });
  ok('the trickle never puts more than 3 bugs on the board', cap.max <= cap.TRICKLE_MAX && cap.TRICKLE_MAX === 3, JSON.stringify(cap));
  ok('the trickle stops once Derick is hired', cap.afterDerick === 0);
  await p.browserContext().close();
}

// ---------- scroll writes LOC (wheel / desktop) ----------
{
  const p = await fresh();
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await p.evaluate(() => { scrollTo(0, 300); scrollTo(0, 0); });
  const locBefore = await p.evaluate(() => window.__bugHunt.S.loc);
  await p.evaluate(() => window.__bugHunt.optIn());
  // Read down the page at a normal pace: 3s of wheel scrolling.
  for (let i = 0; i < 15; i++) { await p.mouse.wheel({ deltaY: 220 }); await wait(200); }
  const read = await p.evaluate(() => ({ loc: window.__bugHunt.S.loc, y: scrollY }));
  // Farming: jiggle up/down as fast as possible for 3s.
  const l0 = read.loc;
  const jig = await p.evaluate(() => new Promise(res => {
    const t0 = performance.now(); let j = 0;
    const tick = () => { scrollTo({ top: j++ % 2 ? 600 : 100, behavior: 'instant' }); if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(j); };
    tick();
  }));
  const farm = await p.evaluate(() => window.__bugHunt.S.loc);
  ok('scrolling before opting in writes nothing', locBefore === 0, `scrollable ${H}px`);
  ok('scrolling the page writes LOC (no click needed)', read.loc >= 3 && read.y > 0, JSON.stringify(read));
  ok('jiggling the scroll can\'t farm: ≤ 2 LOC/s plus a small burst', farm - l0 <= 2 * 3 + 4 + 1 && jig > 50, `${farm - l0} LOC from ${jig} jiggles in 3s`);
  const cap = await p.evaluate(() => ({ max: window.__bugHunt.SCROLL_PAGE_MAX, used: window.__bugHunt.scrollLocPage }));
  ok('scroll LOC is capped per page view', cap.max === 80 && cap.used <= cap.max, JSON.stringify(cap));
  await p.browserContext().close();
}

// ---------- scroll writes LOC (touch / phone) ----------
{
  const p = await fresh({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.evaluate(() => window.__bugHunt.optIn());
  for (let k = 0; k < 4; k++) {
    await p.touchscreen.touchStart(200, 760);
    for (let i = 1; i <= 12; i++) { await p.touchscreen.touchMove(200, 760 - i * 40); await wait(16); }
    await p.touchscreen.touchEnd();
    await wait(500);
  }
  const t = await p.evaluate(() => ({ loc: window.__bugHunt.S.loc, y: scrollY }));
  ok('touch-scrolling on a phone writes LOC', t.loc >= 3 && t.y > 0, JSON.stringify(t));
  await p.browserContext().close();
}

// ---------- shop glides a new unlock into view ----------
async function shopCase(rm) {
  const p = await fresh({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, rm);
  await p.evaluate(() => {
    const g = window.__bugHunt, S = g.S;
    g.optIn();
    Object.assign(S, { shop: true, open: true, derick: 1, agents: 3, tests: 1, profiler: 0, collision: 0, commits: 5, squashed: 10, loc: 50 });
    g.ensureDerick(); g.ensureAgents();
    g.renderHud(true);
    const body = document.querySelector('.bh-hud .bh-body'); body.style.maxHeight = '90px'; body.scrollTop = 0;
  });
  const r = await p.evaluate(async rm => {
    const g = window.__bugHunt, S = g.S;
    const body = document.querySelector('.bh-hud .bh-body');
    const n0 = g.shopFocusN, y0 = scrollY;
    S.profiler = 1; // → COLLISION EDITOR shows up at the bottom of the list
    g.renderHud(true);
    const immediate = body.scrollTop;
    await new Promise(r => setTimeout(r, 900));
    const btn = document.querySelector('.bh-shop [data-buy=collision]');
    const br = body.getBoundingClientRect(), fr = btn.getBoundingClientRect();
    return { focusN: g.shopFocusN - n0, immediate, top: body.scrollTop, visible: fr.top >= br.top - 1 && fr.bottom <= br.bottom + 1, flash: btn.classList.contains('bh-new'), pageMoved: scrollY !== y0, stole: document.activeElement === btn };
  }, rm);
  // Player scrolled the list just now → leave it alone.
  const r2 = await p.evaluate(async () => {
    const g = window.__bugHunt, S = g.S;
    const body = document.querySelector('.bh-hud .bh-body');
    body.scrollTop = 0; body.dispatchEvent(new WheelEvent('wheel', { deltaY: -10 }));
    S.collision = 1; S.tests = 5; // → CI PIPELINE
    g.renderHud(true);
    await new Promise(r => setTimeout(r, 600));
    return { top: body.scrollTop };
  });
  await p.browserContext().close();
  return { r, r2 };
}
{
  const { r, r2 } = await shopCase(false);
  ok('a new unlock glides into view in the shop list and flashes once', r.focusN === 1 && r.top > 0 && r.visible && r.flash, JSON.stringify(r));
  ok('…smoothly (not an instant jump), without moving the page or stealing focus', r.immediate < r.top && !r.pageMoved && !r.stole);
  ok('…and leaves the list alone right after the player scrolled it', r2.top === 0, JSON.stringify(r2));
  const rm = await shopCase(true);
  ok('with prefers-reduced-motion it jumps straight there (no glide)', rm.r.immediate > 0 && rm.r.visible, JSON.stringify(rm.r));
}

ok('no page errors', !errs.length, errs.join(' | '));
console.log(`--- ${pass}/${pass + fail} passed ---`);
await browser.close();
process.exit(fail ? 1 : 0);
