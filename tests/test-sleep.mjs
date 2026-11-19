// Sleep mode + fast-forward tests for Bug Hunt.
// Usage (needs puppeteer-core and Chrome, like the other workspace tests):
//   TB=http://127.0.0.1:8080 node tests/test-sleep.mjs
import puppeteer from 'puppeteer-core';
const BASE = (process.env.TB || 'http://127.0.0.1:8080').replace(/\/$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (n, p, d = '') => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  defaultViewport: { width: 1440, height: 900 }, protocolTimeout: 120000,
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
// Instrument: a switchable fake document.hidden (so "hidden" is deterministic and rAF would still fire if the
// game forgot to stop), plus counters for rAF callbacks and interval ticks.
await page.evaluateOnNewDocument(() => {
  let fakeHidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return fakeHidden; } });
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { return fakeHidden ? 'hidden' : 'visible'; } });
  window.__setHidden = h => { fakeHidden = !!h; document.dispatchEvent(new Event('visibilitychange')); };
  window.__cnt = { raf: 0, iv: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { window.__cnt.raf++; cb(t); });
  const si = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...r) => si((...a) => { window.__cnt.iv++; typeof fn === 'function' ? fn(...a) : 0; }, ms, ...r);
});
const G = (fn, ...a) => page.evaluate(fn, ...a);
const boot = () => page.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting, { timeout: 8000 });
const setupRun = () => G(() => {
  const g = window.__bugHunt, S = g.S;
  if (!g.stats().econId) g.optIn();
  Object.assign(S, { optedIn: true, paused: false, hidden: false, intro: true, hintSeen: true, derick: 1, agents: 4, loc: 800, commits: 100 });
  g.ensureDerick(); g.ensureAgents(); g.kick();
});

await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await G(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' }); await boot();
await setupRun(); await wait(600);

// ---------- math ----------
const math = await G(() => {
  const g = window.__bugHunt;
  const r = { locPerSec: 2, commitsPerSec: 0.5 };
  const c = ms => g.offlineCredit(ms, r);
  return { m10: c(10 * 60e3), tiny: c(1500), neg: c(-3600e3), nan: c(NaN), cap: c(30 * 3600e3), edge: c(2000), FF_CAP_S: g.FF_CAP_S, FF_MIN_S: g.FF_MIN_S };
});
ok('fast-forward credits rate × time (10 min at 2 LOC/s, 0.5 commits/s)', math.m10.sec === 600 && math.m10.loc === 1200 && math.m10.commits === 300, JSON.stringify(math.m10));
ok('gaps under 2s credit nothing', math.tiny.sec === 0 && math.tiny.loc === 0 && math.edge.sec === 2, JSON.stringify({ tiny: math.tiny, edge: math.edge }));
ok('negative (clock skew) and NaN gaps credit nothing', !math.neg.loc && !math.neg.commits && !math.nan.loc, JSON.stringify({ neg: math.neg, nan: math.nan }));
ok('offline credit caps at 24h', math.cap.sec === 86400 && math.cap.capped && math.cap.loc === 172800, JSON.stringify(math.cap));

const rates = await G(() => {
  const g = window.__bugHunt, S = g.S, r = g.passiveRates();
  const expectLoc = g.IDLE_DERRICK + S.agents * g.IDLE_AGENT;
  const live = g.idleCodeRate();
  return { r, expectLoc, live };
});
ok('passive LOC rate matches the live idle drafting rate', Math.abs(rates.r.locPerSec - rates.expectLoc) < 1e-9 && Math.abs(rates.r.locPerSec - rates.live) < 1e-9 && rates.r.commitsPerSec > 0, JSON.stringify(rates));

// ---------- sleep ----------
await G(() => { window.__cnt.raf = 0; window.__cnt.iv = 0; });
await wait(500);
const awake = await G(() => ({ ...window.__cnt }));
await G(() => window.__setHidden(true));
await wait(100); // a callback already queued for the current frame may still run once; anything after is a leak
await G(() => { window.__cnt.raf = 0; window.__cnt.iv = 0; });
await wait(1500);
const slept = await G(() => { const g = window.__bugHunt, s = g.stats(); return { cnt: { ...window.__cnt }, asleep: g.asleep, raf: g.rafId, econ: s.econId, saveIv: s.saveId }; });
ok('awake: game loop and timers are running', awake.raf > 15 && awake.iv > 0, JSON.stringify(awake));
ok('hidden tab: no rAF callbacks, no interval ticks, loops cleared', slept.asleep && slept.raf === 0 && !slept.econ && !slept.saveIv && slept.cnt.raf === 0 && slept.cnt.iv === 0, JSON.stringify(slept));

// wake after a (pretend) 5-minute nap: credit + no dt spike + exactly one loop
const before = await G(() => { const g = window.__bugHunt, S = g.S; S.lastActive = Date.now() - 5 * 60e3; return { loc: S.loc, commits: S.commits, r: g.passiveRates() }; });
await G(() => window.__setHidden(false));
await wait(80);
const woke = await G(() => { const g = window.__bugHunt, S = g.S; return { loc: S.loc, commits: S.commits, away: g.lastAway, card: !document.getElementById('bh-away').hidden, text: document.querySelector('#bh-away [data-k=away]').textContent, asleep: g.asleep, raf: !!g.rafId }; });
const expLoc = Math.floor(before.r.locPerSec * 300);
ok('wake: credits ~5 min of passive LOC and commits', Math.abs((woke.loc - before.loc) - expLoc) <= Math.ceil(before.r.locPerSec * 2) + 2 && woke.commits > before.commits && woke.away && Math.abs(woke.away.sec - 300) < 2, JSON.stringify({ gained: woke.loc - before.loc, expLoc, commits: woke.commits - before.commits, away: woke.away }));
ok('wake: welcome-back card shows the credit', woke.card && /\+[\d,.k]+ LOC · \+[\d,.k]+ commits \(5m\)/.test(woke.text), woke.text);
ok('wake: loop restarted', !woke.asleep && woke.raf, JSON.stringify(woke));

// rapid hide/show cycles must not stack loops: game frames per second ≈ display frames per second
for (let i = 0; i < 12; i++) { await G(() => window.__setHidden(true)); await G(() => window.__setHidden(false)); }
await setupRun();
const loops = await G(() => new Promise(res => {
  const g = window.__bugHunt; let disp = 0, t0 = performance.now();
  const s0 = window.__cnt.raf;
  const r = () => { disp++; if (performance.now() - t0 < 1000) requestAnimationFrame(r); else res({ disp, allCallbacks: window.__cnt.raf - s0, gameFps: g.stats().fps, maxDt: Math.max(...[0]) }); };
  requestAnimationFrame(r);
}));
// allCallbacks counts this probe + the game loop (+ hero grid if visible). Stacked loops would multiply it.
ok('no stacked rAF loops after 12 hide/show cycles', loops.allCallbacks <= loops.disp * 3 + 5 && loops.gameFps < 75, JSON.stringify(loops));
const spike = await G(async () => {
  const g = window.__bugHunt, S = g.S;
  window.__setHidden(true);
  S.lastActive = Date.now() - 3600e3; // pretend the nap was an hour
  await new Promise(r => setTimeout(r, 300));
  const loc0 = S.loc, b0 = g.bugs.length;
  window.__setHidden(false);
  // first frames after waking: the sim must see a normal dt (no hour-long step)
  const dts = [];
  await new Promise(r => { let n = 0; let l = performance.now(); const f = t => { dts.push(t - l); l = t; if (++n < 10) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  return { gained: S.loc - loc0, bugsDelta: g.bugs.length - b0, away: g.lastAway, frameMax: Math.max(...dts.slice(1)) };
});
ok('waking after an hour: credit once, no bug flood, no dt spike', spike.away && Math.abs(spike.away.sec - 3600) < 3 && spike.bugsDelta <= 3 && spike.frameMax < 100, JSON.stringify(spike));
await G(() => window.__bugHunt.hideAway());
ok('dismiss hides the card', await G(() => document.getElementById('bh-away').hidden));

// paused game: no credit
const paused = await G(() => { const g = window.__bugHunt, S = g.S; g.pauseGame(); window.__setHidden(true); S.lastActive = Date.now() - 600e3; const l0 = S.loc; window.__setHidden(false); const r = { gained: S.loc - l0 }; S.paused = false; g.optIn(); return r; });
ok('a paused game earns nothing while away', paused.gained === 0, JSON.stringify(paused));

// ---------- reload path ----------
await setupRun(); await wait(300);
const saved = await G(() => { const g = window.__bugHunt, S = g.S; dispatchEvent(new Event('bh-save')); const raw = JSON.parse(localStorage.getItem('dj-bughunt-v3')); return { hasLastActive: typeof raw.lastActive === 'number' && Math.abs(raw.lastActive - Date.now()) < 3000, rate: g.passiveRates() }; });
ok('save persists lastActive', saved.hasLastActive, JSON.stringify(saved));
// Rewrite the save as if the tab was closed 20 minutes ago, then reload without letting pagehide overwrite it.
await G(() => {
  const g = window.__bugHunt;
  window.__setHidden(true); // tab "hidden" → sleep(); keeps the unload's visibilitychange from waking it
  g.sleep(); // (no-op if already asleep) loops stopped; we write the save after this
  const raw = JSON.parse(localStorage.getItem('dj-bughunt-v3'));
  raw.lastActive = Date.now() - 20 * 60e3; raw.t = raw.lastActive; raw.loc = 1000; raw.commits = 50;
  window.__frozenSave = JSON.stringify(raw);
  localStorage.setItem('dj-bughunt-v3', window.__frozenSave);
  window.__bugHunt.S.lastActive = raw.lastActive; Object.assign(window.__bugHunt.S, { loc: 1000, commits: 50 });
});
await page.reload({ waitUntil: 'networkidle0' }); await boot();
const reload = await G(() => { const g = window.__bugHunt, S = g.S; return { loc: S.loc, commits: S.commits, away: g.lastAway, card: !document.getElementById('bh-away').hidden, r: g.passiveRates(), la: S.lastActive, now: Date.now() }; });
const expReload = Math.floor(reload.r.locPerSec * 1200);
ok('reload with a saved game fast-forwards ~20 min', reload.away && Math.abs(reload.away.sec - 1200) < 5 && Math.abs((reload.loc - 1000) - expReload) <= Math.ceil(reload.r.locPerSec * 5) + 2 && reload.commits > 50 && reload.card, JSON.stringify({ gained: reload.loc - 1000, expReload, commits: reload.commits - 50, away: reload.away, log: reload.log }));
await page.reload({ waitUntil: 'networkidle0' }); await boot();
const again = await G(() => ({ away: window.__bugHunt.lastAway, card: !document.getElementById('bh-away').hidden }));
ok('an immediate second reload credits nothing', !again.away && !again.card, JSON.stringify(again));

// ---------- real tab switch (no fake document.hidden) ----------
{
  const rp = await browser.newPage();
  rp.on('pageerror', e => errs.push(e.message));
  await rp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await rp.waitForFunction(() => window.__bugHunt && !window.__bugHunt.__booting);
  await rp.evaluate(() => { const g = window.__bugHunt; if (!g.stats().econId) g.optIn(); Object.assign(g.S, { paused: false, derick: 1, agents: 3 }); g.ensureDerick(); g.ensureAgents(); g.kick(); });
  await wait(300);
  const other = await browser.newPage(); await other.bringToFront(); await wait(500);
  const h = await rp.evaluate(() => ({ hidden: document.hidden, asleep: window.__bugHunt.asleep, raf: window.__bugHunt.rafId, econ: window.__bugHunt.stats().econId }));
  await rp.evaluate(() => { window.__bugHunt.S.lastActive = Date.now() - 120e3; });
  await rp.bringToFront(); await wait(300);
  const v = await rp.evaluate(() => ({ asleep: window.__bugHunt.asleep, raf: !!window.__bugHunt.rafId, text: document.querySelector('#bh-away [data-k=away]').textContent }));
  ok('real tab switch: background tab sleeps, foreground wakes with credit', h.hidden && h.asleep && !h.raf && !h.econ && !v.asleep && v.raf && /\(2m\)/.test(v.text), JSON.stringify({ h, v }));
  await other.close(); await rp.close();
}

ok('no page errors', !errs.length, errs.join(' | '));
const pass = results.filter(r => r.p).length;
console.log(`\n--- ${pass}/${results.length} passed ---`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
