/* Bug Hunt: a tiny persistent idle/clicker about programmer life.
   Tap empty space -> write code. Code spawns slime bugs. Tap bugs -> they split, then splat.
   5 squashes unlocks Auto: AI agents (more code, more bugs), QA agents, CI, rollback...
   State persists across pages in localStorage. Never calls preventDefault, ignores links/buttons. */
(() => {
  if (window.__bugHunt) return;
  const KEY = 'dj-bughunt-v1';
  const d = document, W = window;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();
  let qaAcc = 0, last = now(), raf = 0, dirty = true, lastShop = '';

  const DEF = { v: 1, loc: 0, cash: 0, squashed: 0, spawned: 0, debt: 0, ai: 0, qa: 0, tests: 0, ci: 0, orch: 0, rollback: 0, autoRb: 0, ships: 0, unlocked: false, open: true, hidden: false, bugs: [], backlog: 0, t: Date.now(), rbAt: 0, intro: false };
  let S, fresh = false;
  try { const raw = localStorage.getItem(KEY); fresh = !raw; S = Object.assign({}, DEF, JSON.parse(raw || '{}')); } catch { S = Object.assign({}, DEF); fresh = true; }
  if (fresh && (COARSE || innerWidth < 700)) S.open = false; // stay a one-line pill on phones until Auto unlocks

  // ---------- economy ----------
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
  const mult = () => 1 + S.ships * 0.5;
  const locPerSec = () => S.ai * 1.2 * (S.orch ? 2.5 : 1) * (1 + S.ships * 0.25);
  const bugsPerLoc = () => 0.34 * Math.pow(0.8, S.tests) * (S.orch ? 0.6 : 1) * (S.ci ? 0.8 : 1);
  const qaPerSec = () => S.qa * 0.45 * (S.ci ? 2 : 1);
  const shipGoal = () => Math.round(1500 * Math.pow(S.ships + 1, 1.6));
  const RB_CD = 30000;
  const cost = {
    ai: () => Math.ceil(10 * Math.pow(1.32, S.ai)),
    qa: () => Math.ceil(28 * Math.pow(1.38, S.qa)),
    tests: () => Math.ceil(45 * Math.pow(2.1, S.tests)),
    ci: () => 220, orch: () => 650, rollback: () => 380, autoRb: () => 2200,
  };
  const ITEMS = [
    { id: 'ai', name: 'Hire AI coding agent', desc: () => `+1.2 LOC/s each. Writes bugs too. (${S.ai})`, show: () => S.unlocked },
    { id: 'qa', name: 'QA test agent', desc: () => `Auto-squashes bugs. (${S.qa})`, show: () => S.ai >= 1 },
    { id: 'tests', name: 'Write unit tests', desc: () => `-20% bugs per line. (${S.tests}/5)`, show: () => S.squashed >= 12, max: 5 },
    { id: 'ci', name: 'CI pipeline', desc: () => 'QA agents run 2× faster; catches 20% of bugs pre-merge.', show: () => S.qa >= 2, once: true },
    { id: 'orch', name: 'Agent orchestrator', desc: () => 'Coding agents drive in-game sub-agents that verify their own work: 2.5× code, 40% fewer bugs.', show: () => S.ai >= 3, once: true },
    { id: 'rollback', name: 'Deterministic rollback', desc: () => 'Unlocks ⟲ Rollback: rewind to the last good frame, clearing every bug. 30s cooldown.', show: () => S.ci || S.spawned >= 50, once: true },
    { id: 'autoRb', name: 'Rollback netcode', desc: () => 'Rollback fires itself when 8+ bugs are live.', show: () => S.rollback, once: true },
  ];

  // ---------- DOM ----------
  const cv = d.createElement('canvas'); cv.id = 'bh-canvas'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  const hud = d.createElement('section'); hud.className = 'bh-hud'; hud.setAttribute('aria-label', 'Bug Hunt mini-game');
  hud.innerHTML = `<div class="bh-bar">
      <div class="bh-title"><b>BUG HUNT</b><span class="bh-stat"><i>LOC</i> <span data-k="loc">0</span></span><span class="bh-stat"><i>BUGS</i> <span data-k="bugs">0</span></span><span class="bh-stat"><i>$</i> <span data-k="cash">0</span></span></div>
      <button class="bh-btn" type="button" data-act="auto" hidden>⚡ Auto</button>
      <button class="bh-btn" type="button" data-act="rb" hidden title="Rollback">⟲</button>
      <button class="bh-btn" type="button" data-act="min" aria-label="Minimize Bug Hunt">–</button>
      <button class="bh-btn" type="button" data-act="hide" aria-label="Hide Bug Hunt">✕</button>
    </div>
    <div class="bh-body"><p class="bh-log" aria-live="polite"></p><p class="bh-tip"></p><div class="bh-shop"></div></div>`;
  d.body.append(cv, hud);
  const $ = s => hud.querySelector(s);
  const el = { loc: $('[data-k=loc]'), bugs: $('[data-k=bugs]'), cash: $('[data-k=cash]'), auto: $('[data-act=auto]'), rb: $('[data-act=rb]'), min: $('[data-act=min]'), hide: $('[data-act=hide]'), log: $('.bh-log'), tip: $('.bh-tip'), shop: $('.bh-shop') };

  let Wd = 0, Hd = 0, DPR = 1;
  function resize() { DPR = Math.min(2, W.devicePixelRatio || 1); Wd = innerWidth; Hd = innerHeight; cv.width = Wd * DPR; cv.height = Hd * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); kick(); }
  addEventListener('resize', resize, { passive: true }); resize();

  // ---------- entities ----------
  const R = [0, 8, 13, 19];
  const SPEED = [0, 62, 44, 30];
  const HUE = [0, 145, 110, 300];
  const cap = () => (COARSE || Wd < 700 ? 8 : 15);
  let bugs = (S.bugs || []).map(b => ({ ...b, x: b.x * Wd, y: b.y * Hd, ox: b.x * Wd, oy: b.y * Hd, pop: 1, sq: 0, flash: 0, ph: Math.random() * 6 }));
  const parts = [], splats = [], zaps = [], ghosts = [];
  let shake = 0, freezeUntil = 0, flash = 0;

  function mkBug(tier, x, y, a) {
    a = a ?? Math.random() * Math.PI * 2;
    return { tier, x, y, ox: x, oy: y, a, ph: Math.random() * 6, pop: 0.2, sq: 0, flash: 0, turn: 0 };
  }
  function edgePoint() {
    const s = Math.floor(Math.random() * 4), m = 10;
    return s === 0 ? [Math.random() * Wd, -m] : s === 1 ? [Wd + m, Math.random() * Hd] : s === 2 ? [Math.random() * Wd, Hd + m] : [-m, Math.random() * Hd];
  }
  function spawnBug(x, y) {
    S.spawned++;
    if (bugs.length >= cap()) { S.backlog++; return; }
    const p3 = Math.min(0.6, 0.15 + S.loc / 2500);
    const tier = Math.random() < p3 ? 3 : Math.random() < 0.7 ? 2 : 1;
    if (x == null) [x, y] = edgePoint();
    const b = mkBug(tier, x, y, Math.atan2(Hd / 2 - y, Wd / 2 - x) + (Math.random() - .5));
    bugs.push(b);
    kick();
  }
  function addCode(n, x, y) {
    S.loc += n;
    S.debt += n * bugsPerLoc();
    let guard = 0;
    while (S.debt >= 1 && guard++ < 50) { S.debt -= 1; spawnBug(x != null ? x + (Math.random() - .5) * 40 : null, y != null ? y + (Math.random() - .5) * 40 : null); }
  }

  // ---------- juice ----------
  function burst(x, y, hue, n, spd = 260, life = 0.6) {
    if (RM) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, r: 2 + Math.random() * 3.5, hue: hue + (Math.random() - .5) * 30 });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  let gains = 0;
  function gain(x, y, text, color) {
    if (gains > 10) return;
    gains++;
    const g = d.createElement('span'); g.className = 'bh-gain'; g.textContent = text;
    g.style.left = x + 'px'; g.style.top = y + 'px'; if (color) g.style.color = color;
    d.body.appendChild(g); setTimeout(() => { g.remove(); gains--; }, 720);
  }
  function punch(strength) {
    if (RM) return;
    shake = Math.max(shake, strength);
    hud.classList.remove('shake'); void hud.offsetWidth; hud.classList.add('shake');
    if (strength >= 8) { const m = d.querySelector('main'); if (m) { m.classList.remove('punch-body'); void m.offsetWidth; m.classList.add('punch-body'); } }
  }
  function log(msg) { el.log.textContent = msg; }

  // ---------- squashing ----------
  function squash(b, auto) {
    const i = bugs.indexOf(b); if (i < 0) return;
    const val = Math.round(b.tier * mult());
    S.cash += val; S.squashed++;
    burst(b.x, b.y, HUE[b.tier], 6 + b.tier * 4, 180 + b.tier * 50);
    splats.push({ x: b.x, y: b.y, r: R[b.tier] * 1.4, hue: HUE[b.tier], life: 1.6, max: 1.6 });
    if (splats.length > 40) splats.shift();
    if (!auto) { freezeUntil = now() + (b.tier === 3 ? 75 : 45); punch(b.tier * 3); }
    gain(b.x, b.y - R[b.tier], `+$${val}`, auto ? '#3de0ff' : null);
    bugs.splice(i, 1);
    if (b.tier > 1) {
      for (let k = 0; k < 2; k++) {
        const a = b.a + (k ? 1 : -1) * (Math.PI / 2 + Math.random() * .6);
        const c = mkBug(b.tier - 1, b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6, a);
        c.boost = 3.2; c.pop = 0.4; c.sq = 1; bugs.push(c);
      }
    }
    if (!S.unlocked && S.squashed >= 5) unlock();
    kick(); dirty = true;
  }
  function unlock() {
    S.unlocked = true; S.open = true;
    log('⚡ AUTO unlocked! Hire an AI agent to write code for you.');
    hud.classList.remove('pop'); void hud.offsetWidth; hud.classList.add('pop');
    burst(Wd - 60, Hd - 40, 50, 24, 340, .8); punch(6);
  }
  function rollback(auto) {
    if (!S.rollback || Date.now() - S.rbAt < RB_CD) return;
    S.rbAt = Date.now();
    let n = bugs.length + S.backlog, cash = 0;
    bugs.forEach(b => { cash += b.tier; ghosts.push({ x: b.x, y: b.y, tx: b.ox, ty: b.oy, r: R[b.tier], hue: HUE[b.tier], t: 0 }); });
    cash = Math.round((cash + S.backlog) * 0.5 * mult());
    S.cash += cash; S.squashed += n; S.backlog = 0; bugs = [];
    flash = 1; punch(10);
    log(`⟲ Rolled back to the last good frame${auto ? ' (netcode)' : ''}. ${n} bugs never happened. +$${fmt(cash)}`);
    kick(); dirty = true;
  }
  function ship() {
    if (S.loc < shipGoal() || bugs.length + S.backlog > 3) return;
    S.ships++;
    const lines = ['Shipped! Reviews are in: Game of the Year.', 'Shipped v' + (S.ships) + '.0! Players love the feel.', 'Shipped! Most Innovative Gameplay.', 'Shipped! Zero desyncs reported.'];
    log(`🏆 ${lines[(S.ships - 1) % lines.length]} All bounties +50%.`);
    for (let i = 0; i < 5; i++) burst(Math.random() * Wd, Hd * 0.3 + Math.random() * Hd * 0.3, Math.random() * 360, 18, 420, 1.2);
    punch(12); kick(); dirty = true;
  }

  // ---------- input (never swallow) ----------
  const IGNORE = 'a,button,input,textarea,select,summary,label,iframe,video,audio,[role=button],[contenteditable],.bh-hud,.yt';
  let downX = 0, downY = 0, downT = 0;
  d.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = now(); }, { passive: true });
  d.addEventListener('pointerup', e => {
    if (S.hidden || (e.button && e.button !== 0)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10 || now() - downT > 600) return; // drag/scroll/select
    if (e.target.closest && e.target.closest(IGNORE)) return;
    const sel = W.getSelection && W.getSelection(); if (sel && String(sel).length) return;
    const x = e.clientX, y = e.clientY, pad = e.pointerType === 'touch' ? 16 : 8;
    let best = null, bd = 1e9;
    for (const b of bugs) { const dd = Math.hypot(b.x - x, b.y - y); if (dd < R[b.tier] + pad && dd < bd) { bd = dd; best = b; } }
    if (best) { squash(best, false); return; }
    // missed: write code at the cursor
    addCode(1, x, y);
    burst(x, y, 190, 4, 120, .35);
    gain(x, y, '+1 LOC', '#ececf6');
    if (!S.intro) { S.intro = true; log('Code written. Code has bugs. Squash them!'); }
    dirty = true; kick();
  }, { passive: true });

  hud.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act, buy = b.dataset.buy;
    if (act === 'min') S.open = !S.open;
    else if (act === 'auto') S.open = true;
    else if (act === 'hide') { S.hidden = !S.hidden; if (!S.hidden) kick(); }
    else if (act === 'rb') rollback(false);
    else if (act === 'ship') ship();
    else if (buy) {
      const it = ITEMS.find(i => i.id === buy); const c = cost[buy]();
      if (S.cash >= c && !(it.once && S[buy]) && !(it.max && S[buy] >= it.max)) {
        S.cash -= c; S[buy] = (S[buy] || 0) + 1;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 50, 10, 200, .5);
        log({ ai: 'Agent hired. It writes code. Lots of code.', qa: 'QA agent online. Hunting bugs.', tests: 'Tests written. Fewer bugs per line.', ci: 'CI is green. Mostly.', orch: 'Orchestrator live: agents now test their own work in-game.', rollback: 'Rollback unlocked. Press ⟲ when it gets bad.', autoRb: 'Rollback netcode: it fixes itself now.' }[buy]);
      }
    }
    dirty = true; render(true);
  });

  // ---------- HUD render ----------
  function render(force) {
    d.documentElement.classList.toggle('bh-hidden', S.hidden);
    hud.classList.toggle('bh-min', !S.open);
    el.hide.textContent = S.hidden ? '🐛' : '✕';
    el.hide.setAttribute('aria-label', S.hidden ? 'Show Bug Hunt' : 'Hide Bug Hunt');
    el.min.textContent = S.open ? '–' : '+';
    el.loc.textContent = fmt(S.loc);
    el.bugs.textContent = fmt(bugs.length + S.backlog);
    el.cash.textContent = fmt(S.cash);
    el.auto.hidden = !S.unlocked || S.open;
    el.rb.hidden = !S.rollback;
    if (S.rollback) { const left = Math.max(0, RB_CD - (Date.now() - S.rbAt)); el.rb.disabled = left > 0; el.rb.textContent = left > 0 ? `⟲ ${Math.ceil(left / 1000)}s` : '⟲ Rollback'; }
    el.tip.textContent = !S.unlocked
      ? (S.squashed ? `Squash ${5 - S.squashed} more bug${5 - S.squashed === 1 ? '' : 's'} to unlock Auto.` : (COARSE ? 'Tap' : 'Click') + ' empty space to write code. Code spawns bugs. Tap bugs to squash them.')
      : `${S.backlog ? `Backlog: ${fmt(S.backlog)} bugs · ` : ''}${locPerSec() ? fmt(locPerSec()) + ' LOC/s · ' : ''}Ship at ${fmt(shipGoal())} LOC with ≤3 bugs.`;
    if (!S.open && !force) return;
    let html = '';
    if (S.unlocked) {
      for (const it of ITEMS) {
        if (!it.show()) continue;
        const owned = S[it.id], done = (it.once && owned) || (it.max && owned >= it.max);
        if (done) continue;
        const c = cost[it.id]();
        html += `<button class="bh-btn bh-item" type="button" data-buy="${it.id}" ${S.cash < c ? 'disabled' : ''}><span>${it.name}</span><small>${it.desc()}</small><em>$${fmt(c)}</em></button>`;
      }
      const ok = S.loc >= shipGoal() && bugs.length + S.backlog <= 3;
      if (S.loc >= shipGoal() * 0.5) html += `<button class="bh-btn bh-item bh-ship" type="button" data-act="ship" ${ok ? '' : 'disabled'}><span>🚀 Ship v${S.ships + 1}.0</span><small>${ok ? 'No blockers. Ship it!' : `Needs ${fmt(shipGoal())} LOC and ≤3 open bugs.`}</small><em>🏆 ${S.ships}</em></button>`;
    }
    if (html !== lastShop) { el.shop.innerHTML = html; lastShop = html; }
  }

  // ---------- sim ----------
  function econ(dt) {
    const lps = locPerSec();
    if (lps) addCode(lps * dt);
    // drain backlog into view
    while (S.backlog > 0 && bugs.length < cap()) { S.backlog--; S.spawned--; spawnBug(); }
    qaAcc += qaPerSec() * dt;
    while (qaAcc >= 1) {
      qaAcc -= 1;
      const visible = !S.hidden && bugs.length;
      if (visible) {
        const hr = hud.getBoundingClientRect();
        let t = bugs[0], bd = 1e9; for (const b of bugs) { const dd = Math.hypot(b.x - hr.left, b.y - hr.top); if (dd < bd) { bd = dd; t = b; } }
        zaps.push({ x1: hr.left + 20, y1: hr.top, x2: t.x, y2: t.y, life: .18 });
        squash(t, true);
      } else if (S.backlog > 0) { S.backlog--; S.cash += Math.round(2 * mult()); S.squashed++; }
      else if (bugs.length) { squash(bugs[0], true); }
    }
    if (S.autoRb && bugs.length + S.backlog >= 8) rollback(true);
  }
  function step(dt) {
    for (const b of bugs) {
      b.ph += dt * (8 - b.tier);
      b.turn += (Math.random() - .5) * dt * 6; b.turn *= 0.96; b.a += b.turn * dt * 3;
      const sp = SPEED[b.tier] * (b.boost || 1); if (b.boost) b.boost = Math.max(1, b.boost - dt * 6);
      b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
      const m = R[b.tier];
      if (b.x < m) { b.x = m; b.a = Math.PI - b.a; } else if (b.x > Wd - m) { b.x = Wd - m; b.a = Math.PI - b.a; }
      if (b.y < m + 56) { b.y = m + 56; b.a = -b.a; } else if (b.y > Hd - m) { b.y = Hd - m; b.a = -b.a; }
      b.pop += (1 - b.pop) * Math.min(1, dt * 10);
      b.sq *= Math.pow(0.002, dt); b.flash = Math.max(0, b.flash - dt * 6);
    }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 700 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= dt; if (splats[i].life <= 0) splats.splice(i, 1); }
    for (let i = zaps.length - 1; i >= 0; i--) { zaps[i].life -= dt; if (zaps[i].life <= 0) zaps.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt * 2.6; if (g.t >= 1) ghosts.splice(i, 1); }
    shake *= Math.pow(0.0005, dt); if (shake < .3) shake = 0;
    flash = Math.max(0, flash - dt * 2.5);
  }
  function drawBug(b) {
    const r = R[b.tier] * b.pop, w = Math.sin(b.ph) * 0.13;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.scale(1 + w + b.sq * .5, 1 - w - b.sq * .4);
    const h = HUE[b.tier];
    // legs
    ctx.strokeStyle = `hsla(${h},90%,35%,.9)`; ctx.lineWidth = Math.max(1.2, r * .12); ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { const o = Math.sin(b.ph * 2 + k) * r * .25; ctx.beginPath(); ctx.moveTo(k * r * .45, -r * .6); ctx.lineTo(k * r * .45 + o, -r * 1.15); ctx.moveTo(k * r * .45, r * .6); ctx.lineTo(k * r * .45 - o, r * 1.15); ctx.stroke(); }
    // body (slime blob)
    ctx.fillStyle = b.flash > 0 ? '#fff' : `hsla(${h},95%,55%,.93)`;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsla(${h},100%,85%,.55)`; ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .45, r * .22, -.3, 0, Math.PI * 2); ctx.fill();
    // antennae + eyes
    ctx.strokeStyle = `hsla(${h},90%,35%,1)`; ctx.beginPath(); ctx.moveTo(r * .9, -r * .2); ctx.lineTo(r * 1.5, -r * .6); ctx.moveTo(r * .9, r * .2); ctx.lineTo(r * 1.5, r * .6); ctx.stroke();
    ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(r * .6, -r * .28, r * .17, 0, 7); ctx.arc(r * .6, r * .28, r * .17, 0, 7); ctx.fill();
    ctx.restore();
  }
  function draw() {
    ctx.save(); ctx.clearRect(0, 0, Wd, Hd);
    if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    for (const s of splats) { ctx.globalAlpha = (s.life / s.max) * .5; ctx.fillStyle = `hsl(${s.hue},90%,40%)`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.3, s.r * .8, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const g of ghosts) { const e = 1 - Math.pow(1 - g.t, 3); ctx.globalAlpha = 1 - g.t; ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, g.r * (1 - g.t * .8), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const b of bugs) drawBug(b);
    for (const z of zaps) { ctx.globalAlpha = z.life / .18; ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(z.x1, z.y1); const mx = (z.x1 + z.x2) / 2 + (Math.random() - .5) * 30, my = (z.y1 + z.y2) / 2 + (Math.random() - .5) * 30; ctx.lineTo(mx, my); ctx.lineTo(z.x2, z.y2); ctx.stroke(); }
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `hsl(${p.hue},95%,60%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (flash) { ctx.fillStyle = `rgba(61,224,255,${flash * .25})`; ctx.fillRect(-20, -20, Wd + 40, Hd + 40); ctx.fillStyle = `rgba(61,224,255,${flash * .3})`; for (let y = 0; y < Hd; y += 6) ctx.fillRect(0, y, Wd, 1); }
    ctx.restore();
  }
  function frame() {
    raf = 0;
    const t = now(); let dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (t < freezeUntil) dt = 0; // hit-stop
    step(dt); draw();
    if (!S.hidden && (bugs.length || parts.length || splats.length || zaps.length || ghosts.length || shake || flash)) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, Wd, Hd);
  }
  function kick() { if (!raf && !S.hidden && !d.hidden) { last = now(); raf = requestAnimationFrame(frame); } }

  // offline / between-page progress
  (() => {
    const dt = Math.min(900, Math.max(0, (Date.now() - (S.t || Date.now())) / 1000));
    if (dt > 1 && locPerSec()) {
      const loc = locPerSec() * dt; S.loc += loc;
      const nb = loc * bugsPerLoc(); S.backlog += Math.floor(nb); S.spawned += Math.floor(nb);
      const k = Math.min(S.backlog, Math.floor(qaPerSec() * dt)); S.backlog -= k; S.squashed += k; S.cash += Math.round(k * 2 * mult());
      if (dt > 20) log(`While you were away: +${fmt(loc)} LOC, QA squashed ${fmt(k)} bugs.`);
    }
  })();

  let lastEcon = now();
  setInterval(() => { const t = now(); econ((t - lastEcon) / 1000); lastEcon = t; render(); if (bugs.length) kick(); }, 250);
  function save() {
    S.t = Date.now();
    S.bugs = bugs.slice(0, 20).map(b => ({ tier: b.tier, x: +(b.x / Wd).toFixed(4), y: +(b.y / Hd).toFixed(4), a: +b.a.toFixed(2), turn: 0 }));
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  }
  setInterval(save, 1500);
  addEventListener('pagehide', save); addEventListener('bh-save', save);
  d.addEventListener('visibilitychange', () => { if (d.hidden) save(); else kick(); });

  // first visit: one bug wanders in to say hi
  if (!S.loc && !S.squashed && !bugs.length) setTimeout(() => { if (!bugs.length) { spawnBug(); log('A wild bug appeared!'); render(); } }, 2500);
  render(true); kick();

  // debug / test hook
  W.__bugHunt = { S, get bugs() { return bugs; }, spawnBug, squash, addCode, rollback, ship, reset() { localStorage.removeItem(KEY); location.reload(); } };
})();
