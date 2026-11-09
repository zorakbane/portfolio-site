/* Bug Hunt — original idle/clicker for derickjanssen.com.
   Opt-in arcade prompt → click empty space to write code → code spawns slime bugs.
   Squash bugs; unlock Hire Derick (edge lasers), Agentic Workflow, coding agents,
   Hire QA (reveals + targets largest for destroy-without-split), tests, CI, rollback.
   State persists in localStorage across pages and visits. Never preventDefault.
   All game logic, art, and code-snippet corpus written fresh for this site. */
(() => {
  if (window.__bugHunt) return;
  const KEY = 'dj-bughunt-v2';
  const d = document, W = window;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();
  let derickAcc = 0, qaRevealAcc = 0, last = now(), raf = 0, dirty = true, lastShop = '';
  let hintUntil = 0;

  const DEF = {
    v: 2, optedIn: false, paused: false,
    loc: 0, cash: 0, squashed: 0, spawned: 0, debt: 0,
    derick: 0, agentic: 0, ai: 0, qa: 0, tests: 0, ci: 0, orch: 0, rollback: 0, autoRb: 0, ships: 0,
    shop: false, open: true, hidden: false,
    bugs: [], backlog: 0, t: Date.now(), rbAt: 0, intro: false, hintSeen: false, codeIdx: 0
  };
  let S, fresh = false;
  try {
    const raw = localStorage.getItem(KEY);
    fresh = !raw;
    S = Object.assign({}, DEF, JSON.parse(raw || '{}'));
  } catch { S = Object.assign({}, DEF); fresh = true; }
  // Drop legacy v1 silently — new opt-in flow.
  try { localStorage.removeItem('dj-bughunt-v1'); } catch {}
  if (fresh && (COARSE || innerWidth < 700)) S.open = false;

  // ---------- economy ----------
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
  const mult = () => 1 + S.ships * 0.5;
  const locPerSec = () => {
    let v = S.ai * 1.35 * (S.orch ? 2.4 : 1) * (1 + S.ships * 0.25);
    if (S.agentic) v += S.derick * 0.35 * S.agentic; // sub-agents drafting while lasers fire
    return v;
  };
  const bugsPerLoc = () => 0.38 * Math.pow(0.82, S.tests) * (S.orch ? 0.65 : 1) * (S.ci ? 0.85 : 1);
  const derickRate = () => {
    if (!S.derick) return 0;
    const base = 0.55 + S.derick * 0.35;
    return base * (1 + S.agentic * 0.85) * (S.ci ? 1.15 : 1);
  };
  const derickBeams = () => Math.min(6, 1 + S.derick + (S.agentic ? 1 + S.agentic : 0));
  const qaRevealPerSec = () => S.qa * 0.55 * (S.ci ? 1.6 : 1);
  const shipGoal = () => Math.round(1600 * Math.pow(S.ships + 1, 1.55));
  const RB_CD = 30000;
  const cost = {
    derick: () => Math.ceil(12 * Math.pow(1.45, S.derick)),
    agentic: () => Math.ceil(55 * Math.pow(1.7, S.agentic)),
    ai: () => Math.ceil(18 * Math.pow(1.34, S.ai)),
    qa: () => Math.ceil(32 * Math.pow(1.4, S.qa)),
    tests: () => Math.ceil(48 * Math.pow(2.05, S.tests)),
    ci: () => 240, orch: () => 720, rollback: () => 400, autoRb: () => 2400,
  };
  const ITEMS = [
    { id: 'derick', name: 'HIRE DERICK', desc: () => `Lasers from off-screen auto-kill bugs. (${S.derick})`, show: () => S.shop },
    { id: 'agentic', name: 'AGENTIC WORKFLOW', desc: () => `More emitters, faster volleys, multi-target beams + draft LOC. (${S.agentic})`, show: () => S.derick >= 1 },
    { id: 'ai', name: 'Hire coding agent', desc: () => `+1.35 LOC/s each. Writes bugs too. (${S.ai})`, show: () => S.derick >= 1 },
    { id: 'qa', name: 'HIRE QA', desc: () => `Reveals more bugs & marks largest for destroy-no-split. Does not squash. (${S.qa})`, show: () => S.ai >= 1 || S.derick >= 2 },
    { id: 'tests', name: 'Write unit tests', desc: () => `-18% bugs per line. (${S.tests}/5)`, show: () => S.squashed >= 12, max: 5 },
    { id: 'ci', name: 'CI pipeline', desc: () => 'Derick + QA find faster; 15% fewer bugs pre-merge.', show: () => S.qa >= 1 || S.derick >= 3, once: true },
    { id: 'orch', name: 'Agent orchestrator', desc: () => 'Coding agents verify each other: 2.4× code, fewer bugs.', show: () => S.ai >= 3, once: true },
    { id: 'rollback', name: 'Deterministic rollback', desc: () => '⟲ Rollback clears every bug. 30s cooldown.', show: () => S.ci || S.spawned >= 40, once: true },
    { id: 'autoRb', name: 'Rollback netcode', desc: () => 'Rollback fires when 8+ bugs are live.', show: () => S.rollback, once: true },
  ];
  const BUY_LOG = {
    derick: 'Derick hired. Lasers inbound from off-screen.',
    agentic: 'Agentic workflow online: sub-agents amplify every laser volley.',
    ai: 'Coding agent hired. It writes code. Lots of code.',
    qa: 'QA online. Hunting for bugs — targets painted on the biggest ones.',
    tests: 'Tests written. Fewer bugs per line.',
    ci: 'CI is green. Mostly.',
    orch: 'Orchestrator live: agents verify their own work.',
    rollback: 'Rollback unlocked. Press ⟲ when it gets bad.',
    autoRb: 'Rollback netcode: it fixes itself now.',
  };

  // Original snippet corpus (game-engine / automation flavored). NOT from hackertyper.
  const CORPUS = [
    '// rollback: restore sim to last good frame\nvoid RollbackNet::Restore(Frame f) {\n  state = archive.At(f);\n  inputs.Rewind(f);\n}\n',
    'def spawn_agent(task):\n    agent = CodingAgent(model="local")\n    agent.plan(task)\n    return agent.run_with_verify()\n',
    'function SquashBug(bug)\n  if bug.tier > 1 then\n    Split(bug, bug.tier - 1)\n  else\n    Splat(bug)\n  end\nend\n',
    'class ParallaxLayer {\n  float depth;\n  void Draw(Camera cam) {\n    float ox = cam.x * depth;\n    blit(tex, ox, 0);\n  }\n};\n',
    'async function orchestrate(jobs) {\n  const kids = jobs.map(j => subAgent(j));\n  const out = await Promise.all(kids);\n  return mergeVerified(out);\n}\n',
    '-- LOD: pick mesh by camera distance\nlocal function pickLod(d)\n  if d < 12 then return hi\n  elseif d < 40 then return mid\n  else return lo end\nend\n',
    'bool BSP_Trace(const Ray& r, Hit& h) {\n  Node* n = root;\n  while (n && !n->leaf) n = n->Child(r);\n  return n && n->Test(r, h);\n}\n',
    'qa.findBugs = (build) => {\n  const suspects = fuzz(build);\n  return suspects.filter(isRepro);\n};\n',
    'fn auto_laser(target: Bug) {\n  beam.from(edge_of_screen());\n  beam.fire(target.pos);\n  target.kill(split: false);\n}\n',
    'local sim = DeterministicSim.new()\nsim:step(inputs)\nif desync then sim:rollback(lastGood) end\n',
    'struct AgentJob { string prompt; Vec<Job> kids; };\nvoid RunAgentic(AgentJob& j) {\n  for (auto& k : j.kids) Spawn(k);\n}\n',
    '# collision editor export\nmesh = bake_convex(hull)\nwrite_bin("col.bin", mesh.verts, mesh.idx)\n',
  ].join('');

  // ---------- DOM ----------
  const codeCv = d.createElement('canvas'); codeCv.id = 'bh-code'; codeCv.setAttribute('aria-hidden', 'true');
  const codeCtx = codeCv.getContext('2d');
  const cv = d.createElement('canvas'); cv.id = 'bh-canvas'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  const ready = d.createElement('div');
  ready.id = 'bh-ready';
  ready.innerHTML = `<button type="button" class="bh-ready-btn" data-act="ready"><span class="bh-ready-pulse"></span><span class="bh-ready-label">PLAYER 1 READY?</span><small>start Bug Hunt</small></button>`;
  const hud = d.createElement('section'); hud.className = 'bh-hud'; hud.setAttribute('aria-label', 'Bug Hunt mini-game');
  hud.hidden = true;
  hud.innerHTML = `<div class="bh-bar">
      <div class="bh-title"><b>BUG HUNT</b><span class="bh-stat"><i>LOC</i> <span data-k="loc">0</span></span><span class="bh-stat"><i>BUGS</i> <span data-k="bugs">0</span></span><span class="bh-stat"><i>$</i> <span data-k="cash">0</span></span></div>
      <button class="bh-btn" type="button" data-act="pause" title="Pause">❚❚</button>
      <button class="bh-btn" type="button" data-act="rb" hidden title="Rollback">⟲</button>
      <button class="bh-btn" type="button" data-act="min" aria-label="Minimize Bug Hunt">–</button>
      <button class="bh-btn" type="button" data-act="quit" aria-label="Quit Bug Hunt">✕</button>
    </div>
    <div class="bh-body"><p class="bh-log" aria-live="polite"></p><p class="bh-tip"></p><div class="bh-shop"></div>
    <div class="bh-footer"><button class="bh-btn bh-reset" type="button" data-act="reset">Reset progress</button></div></div>`;
  const hint = d.createElement('div'); hint.id = 'bh-hint'; hint.hidden = true;
  hint.textContent = (COARSE ? 'Tap' : 'Click') + ' empty space to write code… uh oh, bugs.';
  d.body.append(codeCv, cv, ready, hud, hint);
  const $ = s => hud.querySelector(s);
  const el = {
    loc: $('[data-k=loc]'), bugs: $('[data-k=bugs]'), cash: $('[data-k=cash]'),
    pause: $('[data-act=pause]'), rb: $('[data-act=rb]'), min: $('[data-act=min]'), quit: $('[data-act=quit]'),
    log: $('.bh-log'), tip: $('.bh-tip'), shop: $('.bh-shop')
  };

  let Wd = 0, Hd = 0, DPR = 1;
  let typed = Math.min(S.codeIdx || 0, CORPUS.length * 4);
  let codeDirty = true;

  // ---------- hackertyper-style background (canvas, original corpus) ----------
  function typeCode(n) {
    typed += n;
    S.codeIdx = typed;
    codeDirty = true;
    paintCode();
  }
  function paintCode(force) {
    if (!force && !codeDirty) return;
    codeDirty = false;
    codeCtx.clearRect(0, 0, Wd, Hd);
    if (!S.optedIn || S.paused || typed <= 0) return;
    const fs = COARSE ? 11 : 12;
    const lh = fs + 3;
    const cols = Math.max(1, Math.floor(Wd / (fs * 0.62)));
    const rows = Math.ceil(Hd / lh) + 1;
    const maxChars = Math.min(typed, cols * rows);
    codeCtx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    codeCtx.fillStyle = 'rgba(57,255,136,0.11)';
    codeCtx.textBaseline = 'top';
    let i = Math.max(0, (typed - maxChars) % CORPUS.length);
    let drawn = 0, x = 8, y = 8;
    while (drawn < maxChars && y < Hd) {
      const ch = CORPUS[i % CORPUS.length];
      i++;
      if (ch === '\n' || x > Wd - 20) { x = 8; y += lh; if (ch === '\n') { drawn++; continue; } }
      codeCtx.fillText(ch, x, y);
      x += fs * 0.62;
      drawn++;
    }
    // caret blink at end
    if (!RM && (Math.floor(now() / 400) % 2)) {
      codeCtx.fillStyle = 'rgba(61,224,255,0.35)';
      codeCtx.fillRect(x, y, 7, fs);
    }
  }

  function resize() {
    DPR = Math.min(2, W.devicePixelRatio || 1);
    Wd = innerWidth; Hd = innerHeight;
    for (const c of [cv, codeCv]) { c.width = Wd * DPR; c.height = Hd * DPR; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    codeCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    paintCode(true); kick();
  }
  addEventListener('resize', resize, { passive: true });

  // ---------- entities ----------
  const R = [0, 8, 13, 19];
  const SPEED = [0, 62, 44, 30];
  const HUE = [0, 145, 110, 300];
  const cap = () => (COARSE || Wd < 700 ? 8 : 15);
  let bugs = [];
  if (S.optedIn && !S.paused && S.bugs && S.bugs.length) {
    bugs = S.bugs.map(b => ({ ...b, x: b.x * Wd, y: b.y * Hd, ox: b.x * Wd, oy: b.y * Hd, pop: 1, sq: 0, flash: 0, ph: Math.random() * 6, targeted: !!b.targeted }));
  }
  const parts = [], splats = [], lasers = [], ghosts = [], codeBursts = [];
  let shake = 0, freezeUntil = 0, flash = 0;

  function mkBug(tier, x, y, a) {
    a = a ?? Math.random() * Math.PI * 2;
    return { tier, x, y, ox: x, oy: y, a, ph: Math.random() * 6, pop: 0.2, sq: 0, flash: 0, turn: 0, targeted: false };
  }
  function edgePoint() {
    const s = Math.floor(Math.random() * 4), m = 10;
    return s === 0 ? [Math.random() * Wd, -m] : s === 1 ? [Wd + m, Math.random() * Hd] : s === 2 ? [Math.random() * Wd, Hd + m] : [-m, Math.random() * Hd];
  }
  function laserOrigin() {
    // Prefer off-screen edges; with agentic, also fire from corners / mid-edges
    if (S.agentic && Math.random() < 0.55) {
      const corners = [[-20, -20], [Wd + 20, -20], [-20, Hd + 20], [Wd + 20, Hd + 20],
        [Wd / 2, -30], [-30, Hd / 2], [Wd + 30, Hd / 2], [Wd / 2, Hd + 30]];
      return corners[Math.floor(Math.random() * corners.length)];
    }
    return edgePoint();
  }
  function spawnBug(x, y, opts = {}) {
    S.spawned++;
    if (bugs.length >= cap()) { S.backlog++; return null; }
    const p3 = Math.min(0.55, 0.12 + S.loc / 2800);
    const tier = opts.tier || (Math.random() < p3 ? 3 : Math.random() < 0.7 ? 2 : 1);
    if (x == null) [x, y] = edgePoint();
    const b = mkBug(tier, x, y, Math.atan2(Hd / 2 - y, Wd / 2 - x) + (Math.random() - .5));
    if (opts.reveal) { b.pop = 0.05; b.flash = 1; }
    bugs.push(b);
    kick();
    return b;
  }
  function addCode(n, x, y, fromClick) {
    S.loc += n;
    typeCode(Math.max(2, Math.floor(n * 14)));
    S.debt += n * bugsPerLoc();
    // Player clicks always hatch at least one bug at the cursor so cause→effect is obvious.
    if (fromClick && x != null) {
      spawnBug(x + (Math.random() - .5) * 20, y + (Math.random() - .5) * 20);
      S.debt = Math.max(0, S.debt - 1);
    }
    let guard = 0;
    while (S.debt >= 1 && guard++ < 50) {
      S.debt -= 1;
      const bx = x != null ? x + (Math.random() - .5) * 36 : null;
      const by = y != null ? y + (Math.random() - .5) * 36 : null;
      spawnBug(bx, by);
    }
  }

  // ---------- juice ----------
  function burst(x, y, hue, n, spd = 260, life = 0.6) {
    if (RM) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, r: 2 + Math.random() * 3.5, hue: hue + (Math.random() - .5) * 30 });
    }
    if (parts.length > 360) parts.splice(0, parts.length - 360);
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
  function codeBurstAt(x, y) {
    codeBursts.push({ x, y, life: 0.55, max: 0.55 });
    if (codeBursts.length > 24) codeBursts.shift();
    burst(x, y, 190, 5, 110, .4);
  }

  // ---------- targeting (QA) ----------
  function retarget() {
    for (const b of bugs) b.targeted = false;
    if (!S.qa || !bugs.length) return;
    const n = Math.min(bugs.length, S.qa);
    const sorted = bugs.slice().sort((a, b) => b.tier - a.tier || (b.x * b.y) - (a.x * a.y));
    for (let i = 0; i < n; i++) sorted[i].targeted = true;
  }

  // ---------- squashing ----------
  function squash(b, opts = {}) {
    const i = bugs.indexOf(b); if (i < 0) return;
    const auto = !!opts.auto;
    const noSplit = !!opts.noSplit || !!b.targeted;
    const val = Math.round(b.tier * mult() * (b.targeted ? 1.35 : 1));
    S.cash += val; S.squashed++;
    burst(b.x, b.y, b.targeted ? 50 : HUE[b.tier], 6 + b.tier * 4, 180 + b.tier * 50);
    splats.push({ x: b.x, y: b.y, r: R[b.tier] * 1.4, hue: b.targeted ? 50 : HUE[b.tier], life: 1.6, max: 1.6 });
    if (splats.length > 40) splats.shift();
    if (!auto) { freezeUntil = now() + (b.tier === 3 ? 75 : 45); punch(b.tier * 3); }
    gain(b.x, b.y - R[b.tier], `+$${val}`, auto ? '#3de0ff' : (b.targeted ? '#ffd166' : null));
    bugs.splice(i, 1);
    if (!noSplit && b.tier > 1) {
      for (let k = 0; k < 2; k++) {
        const a = b.a + (k ? 1 : -1) * (Math.PI / 2 + Math.random() * .6);
        const c = mkBug(b.tier - 1, b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6, a);
        c.boost = 3.2; c.pop = 0.4; c.sq = 1; bugs.push(c);
      }
    } else if (noSplit && b.tier > 1) {
      // juicy destroy — no children
      burst(b.x, b.y, 50, 14, 320, .7);
      punch(auto ? 4 : 7);
    }
    if (!S.shop && S.squashed >= 5) openShop();
    retarget();
    kick(); dirty = true;
  }
  function openShop() {
    S.shop = true; S.open = true;
    log('HIRE DERICK unlocked — lasers from off-screen.');
    hud.classList.remove('pop'); void hud.offsetWidth; hud.classList.add('pop');
    burst(Wd - 60, Hd - 40, 50, 24, 340, .8); punch(6);
  }
  function fireLasers() {
    if (!S.derick || !bugs.length || S.paused || !S.optedIn) return;
    const beams = derickBeams();
    // Prefer targeted, then largest
    const pool = bugs.slice().sort((a, b) => (b.targeted - a.targeted) || (b.tier - a.tier));
    const hits = Math.min(beams, pool.length);
    for (let i = 0; i < hits; i++) {
      const t = pool[i];
      const [ox, oy] = laserOrigin();
      lasers.push({ x1: ox, y1: oy, x2: t.x, y2: t.y, life: 0.22, max: 0.22, wide: 2 + S.agentic });
      squash(t, { auto: true, noSplit: !!t.targeted });
    }
    if (S.agentic) {
      // chaining spark between targets
      for (let i = 0; i < hits - 1; i++) {
        const a = pool[i], b = pool[i + 1];
        if (!a || !b) break;
        lasers.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, life: 0.16, max: 0.16, wide: 1.5, chain: true });
      }
    }
    kick();
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
    const lines = ['Shipped! Reviews are in: Game of the Year.', 'Shipped v' + S.ships + '.0! Players love the feel.', 'Shipped! Most Innovative Gameplay.', 'Shipped! Zero desyncs reported.'];
    log(`🏆 ${lines[(S.ships - 1) % lines.length]} All bounties +50%.`);
    for (let i = 0; i < 5; i++) burst(Math.random() * Wd, Hd * 0.3 + Math.random() * Hd * 0.3, Math.random() * 360, 18, 420, 1.2);
    punch(12); kick(); dirty = true;
  }

  // ---------- opt-in / pause / quit ----------
  function syncShell() {
    const playing = S.optedIn && !S.paused;
    ready.hidden = S.optedIn && !S.paused;
    ready.classList.toggle('bh-resume', S.optedIn && S.paused);
    const label = ready.querySelector('.bh-ready-label');
    const small = ready.querySelector('small');
    if (S.optedIn && S.paused) {
      if (label) label.textContent = 'RESUME?';
      if (small) small.textContent = 'continue Bug Hunt';
    } else {
      if (label) label.textContent = 'PLAYER 1 READY?';
      if (small) small.textContent = 'start Bug Hunt';
    }
    hud.hidden = !S.optedIn;
    d.documentElement.classList.toggle('bh-playing', playing);
    d.documentElement.classList.toggle('bh-hidden', S.hidden);
    if (!playing) {
      // clear live bugs from view when paused/quit — state kept in S via save
      if (S.paused || !S.optedIn) {
        ctx.clearRect(0, 0, Wd, Hd);
      }
    }
    paintCode(true);
  }
  function optIn() {
    S.optedIn = true; S.paused = false; S.hidden = false; S.open = true;
    if (!S.hintSeen) {
      S.hintSeen = true;
      hint.hidden = false;
      hintUntil = now() + 5500;
    }
    log(S.squashed || S.loc ? 'Welcome back. Squash continues.' : 'Insert coin. Write some code.');
    syncShell(); render(true); kick(); dirty = true; save();
  }
  function pauseGame() {
    if (!S.optedIn) return;
    S.paused = true;
    save();
    syncShell();
    log('Paused. Progress saved.');
  }
  function quitGame() {
    if (!S.optedIn) return;
    S.paused = true;
    save();
    syncShell();
    log('Quit to title. Progress kept.');
  }
  function resetAll() {
    if (!confirm('Reset Bug Hunt progress? This cannot be undone.')) return;
    try { localStorage.removeItem(KEY); } catch {}
    location.reload();
  }

  syncShell();
  if (S.optedIn && !S.paused && !S.hintSeen && !S.intro) {
    hint.hidden = false; hintUntil = now() + 5500; S.hintSeen = true;
  }

  // ---------- input (never swallow) ----------
  const IGNORE = 'a,button,input,textarea,select,summary,label,iframe,video,audio,[role=button],[contenteditable],.bh-hud,#bh-ready,.yt';
  let downX = 0, downY = 0, downT = 0;
  d.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = now(); }, { passive: true });
  d.addEventListener('pointerup', e => {
    if (!S.optedIn || S.paused || S.hidden || (e.button && e.button !== 0)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10 || now() - downT > 600) return;
    if (e.target.closest && e.target.closest(IGNORE)) return;
    const sel = W.getSelection && W.getSelection(); if (sel && String(sel).length) return;
    const x = e.clientX, y = e.clientY, pad = e.pointerType === 'touch' ? 16 : 8;
    let best = null, bd = 1e9;
    for (const b of bugs) { const dd = Math.hypot(b.x - x, b.y - y); if (dd < R[b.tier] + pad && dd < bd) { bd = dd; best = b; } }
    if (best) { squash(best, {}); return; }
    // empty space → write code at cursor (spawns bugs from that spot)
    addCode(1, x, y, true);
    codeBurstAt(x, y);
    gain(x, y, '+1 LOC', '#ececf6');
    if (!S.intro) {
      S.intro = true;
      log('Code written. Code has bugs. Squash them!');
      hint.hidden = true;
    }
    dirty = true; kick();
  }, { passive: true });

  ready.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'ready') optIn();
  });

  hud.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act, buy = b.dataset.buy;
    if (act === 'min') S.open = !S.open;
    else if (act === 'pause') pauseGame();
    else if (act === 'quit') quitGame();
    else if (act === 'reset') resetAll();
    else if (act === 'rb') rollback(false);
    else if (act === 'ship') ship();
    else if (buy) {
      const it = ITEMS.find(i => i.id === buy); const c = cost[buy]();
      if (S.cash >= c && !(it.once && S[buy]) && !(it.max && S[buy] >= it.max)) {
        S.cash -= c; S[buy] = (S[buy] || 0) + 1;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 50, 10, 200, .5);
        log(BUY_LOG[buy] || 'Purchased.');
        if (buy === 'qa') retarget();
        if (buy === 'derick' || buy === 'agentic') kick();
      }
    }
    dirty = true; render(true); save();
  });

  // ---------- HUD render ----------
  function render(force) {
    syncShell();
    if (!S.optedIn) return;
    hud.classList.toggle('bh-min', !S.open);
    el.min.textContent = S.open ? '–' : '+';
    el.pause.textContent = S.paused ? '▶' : '❚❚';
    el.loc.textContent = fmt(S.loc);
    el.bugs.textContent = fmt(bugs.length + S.backlog);
    el.cash.textContent = fmt(S.cash);
    el.rb.hidden = !S.rollback;
    if (S.rollback) {
      const left = Math.max(0, RB_CD - (Date.now() - S.rbAt));
      el.rb.disabled = left > 0;
      el.rb.textContent = left > 0 ? `⟲ ${Math.ceil(left / 1000)}s` : '⟲ Rollback';
    }
    const tap = COARSE ? 'Tap' : 'Click';
    if (!S.shop) {
      el.tip.textContent = S.squashed
        ? `Squash ${Math.max(0, 5 - S.squashed)} more bug${5 - S.squashed === 1 ? '' : 's'} to unlock HIRE DERICK.`
        : `${tap} empty space to write code. Bugs crawl out of what you write.`;
    } else {
      el.tip.textContent = `${S.backlog ? `Backlog: ${fmt(S.backlog)} · ` : ''}${locPerSec() ? fmt(locPerSec()) + ' LOC/s · ' : ''}${S.derick ? 'Lasers armed · ' : ''}Ship at ${fmt(shipGoal())} LOC with ≤3 bugs.`;
    }
    if (!S.open && !force) return;
    let html = '';
    if (S.shop) {
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
    if (!S.optedIn || S.paused) return;
    const lps = locPerSec();
    if (lps) addCode(lps * dt);
    while (S.backlog > 0 && bugs.length < cap()) { S.backlog--; S.spawned--; spawnBug(); }
    // Derick lasers
    derickAcc += derickRate() * dt;
    while (derickAcc >= 1) { derickAcc -= 1; fireLasers(); }
    // QA reveals more bugs (does NOT squash)
    qaRevealAcc += qaRevealPerSec() * dt;
    while (qaRevealAcc >= 1) {
      qaRevealAcc -= 1;
      const b = spawnBug(null, null, { reveal: true, tier: Math.random() < 0.45 ? 3 : 2 });
      if (b) {
        gain(b.x, b.y, 'QA found!', '#ffd166');
        log('QA revealed a bug.');
      } else {
        S.backlog++; // still "found"
      }
      retarget();
    }
    if (S.autoRb && bugs.length + S.backlog >= 8) rollback(true);
  }
  function step(dt) {
    if (!S.optedIn || S.paused) {
      for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
      return;
    }
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
    for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt * 2.6; if (g.t >= 1) ghosts.splice(i, 1); }
    for (let i = codeBursts.length - 1; i >= 0; i--) { codeBursts[i].life -= dt; if (codeBursts[i].life <= 0) codeBursts.splice(i, 1); }
    shake *= Math.pow(0.0005, dt); if (shake < .3) shake = 0;
    flash = Math.max(0, flash - dt * 2.5);
    if (hintUntil && now() > hintUntil) { hint.hidden = true; hintUntil = 0; }
  }
  function drawBug(b) {
    const r = R[b.tier] * b.pop, w = Math.sin(b.ph) * 0.13;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.scale(1 + w + b.sq * .5, 1 - w - b.sq * .4);
    const h = HUE[b.tier];
    ctx.strokeStyle = `hsla(${h},90%,35%,.9)`; ctx.lineWidth = Math.max(1.2, r * .12); ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { const o = Math.sin(b.ph * 2 + k) * r * .25; ctx.beginPath(); ctx.moveTo(k * r * .45, -r * .6); ctx.lineTo(k * r * .45 + o, -r * 1.15); ctx.moveTo(k * r * .45, r * .6); ctx.lineTo(k * r * .45 - o, r * 1.15); ctx.stroke(); }
    ctx.fillStyle = b.flash > 0 ? '#fff' : `hsla(${h},95%,55%,.93)`;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsla(${h},100%,85%,.55)`; ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .45, r * .22, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${h},90%,35%,1)`; ctx.beginPath(); ctx.moveTo(r * .9, -r * .2); ctx.lineTo(r * 1.5, -r * .6); ctx.moveTo(r * .9, r * .2); ctx.lineTo(r * 1.5, r * .6); ctx.stroke();
    ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(r * .6, -r * .28, r * .17, 0, 7); ctx.arc(r * .6, r * .28, r * .17, 0, 7); ctx.fill();
    ctx.restore();
    if (b.targeted) {
      const tr = R[b.tier] * 1.55 * b.pop;
      const pulse = 0.65 + Math.sin(now() / 120) * 0.35;
      ctx.save();
      ctx.strokeStyle = `rgba(255,209,102,${0.85 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, tr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      const tick = tr + 4;
      ctx.moveTo(b.x - tick, b.y); ctx.lineTo(b.x - tick + 6, b.y);
      ctx.moveTo(b.x + tick, b.y); ctx.lineTo(b.x + tick - 6, b.y);
      ctx.moveTo(b.x, b.y - tick); ctx.lineTo(b.x, b.y - tick + 6);
      ctx.moveTo(b.x, b.y + tick); ctx.lineTo(b.x, b.y + tick - 6);
      ctx.stroke();
      ctx.restore();
    }
  }
  function draw() {
    ctx.save(); ctx.clearRect(0, 0, Wd, Hd);
    if (!S.optedIn || S.paused) { ctx.restore(); return; }
    if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    for (const s of splats) { ctx.globalAlpha = (s.life / s.max) * .5; ctx.fillStyle = `hsl(${s.hue},90%,40%)`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.3, s.r * .8, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const g of ghosts) { const e = 1 - Math.pow(1 - g.t, 3); ctx.globalAlpha = 1 - g.t; ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, g.r * (1 - g.t * .8), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // code-burst glyphs at click points
    for (const c of codeBursts) {
      const a = c.life / c.max;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#39ff88';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText('{ code++ }', c.x - 28, c.y - 18 * (1 - a));
      ctx.fillStyle = '#3de0ff';
      ctx.fillText('bug?', c.x + 8, c.y + 14 * (1 - a));
    }
    ctx.globalAlpha = 1;
    for (const b of bugs) drawBug(b);
    for (const z of lasers) {
      const a = z.life / z.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = z.chain ? '#ffd166' : '#39ff88';
      ctx.lineWidth = (z.wide || 2.5) + a * 2;
      ctx.shadowColor = z.chain ? '#ffd166' : '#39ff88';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      const mx = (z.x1 + z.x2) / 2 + (Math.random() - .5) * 18;
      const my = (z.y1 + z.y2) / 2 + (Math.random() - .5) * 18;
      ctx.lineTo(mx, my); ctx.lineTo(z.x2, z.y2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(z.x2, z.y2, 3 + a * 4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `hsl(${p.hue},95%,60%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (flash) { ctx.fillStyle = `rgba(61,224,255,${flash * .25})`; ctx.fillRect(-20, -20, Wd + 40, Hd + 40); }
    ctx.restore();
  }
  function frame() {
    raf = 0;
    const t = now(); let dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (t < freezeUntil) dt = 0;
    step(dt); draw();
    if (!RM) paintCode(); // caret blink
    const live = S.optedIn && !S.paused && !S.hidden &&
      (bugs.length || parts.length || splats.length || lasers.length || ghosts.length || codeBursts.length || shake || flash);
    if (live) raf = requestAnimationFrame(frame);
    else if (S.optedIn && !S.paused) ctx.clearRect(0, 0, Wd, Hd);
  }
  function kick() {
    if (!raf && S.optedIn && !S.paused && !S.hidden && !d.hidden) {
      last = now(); raf = requestAnimationFrame(frame);
    }
  }

  // offline progress only while opted in
  (() => {
    if (!S.optedIn || S.paused) return;
    const dt = Math.min(900, Math.max(0, (Date.now() - (S.t || Date.now())) / 1000));
    if (dt > 1 && locPerSec()) {
      const loc = locPerSec() * dt; S.loc += loc; typeCode(Math.floor(loc * 8));
      const nb = loc * bugsPerLoc(); S.backlog += Math.floor(nb); S.spawned += Math.floor(nb);
      // Derick lasers chew backlog/offline bugs
      const kills = Math.min(S.backlog, Math.floor(derickRate() * dt));
      S.backlog -= kills; S.squashed += kills; S.cash += Math.round(kills * 2 * mult());
      // QA reveals add to backlog offline
      const found = Math.floor(qaRevealPerSec() * dt);
      if (found) S.backlog += found;
      if (dt > 20) log(`While you were away: +${fmt(loc)} LOC, lasers cleared ${fmt(kills)}, QA found ${fmt(found)}.`);
    }
  })();

  let lastEcon = now();
  setInterval(() => {
    const t = now();
    econ((t - lastEcon) / 1000);
    lastEcon = t;
    render();
    if (bugs.length || lasers.length) kick();
  }, 250);

  function save() {
    S.t = Date.now();
    if (S.optedIn && !S.paused) {
      S.bugs = bugs.slice(0, 20).map(b => ({
        tier: b.tier, x: +(b.x / Math.max(1, Wd)).toFixed(4), y: +(b.y / Math.max(1, Hd)).toFixed(4),
        a: +b.a.toFixed(2), turn: 0, targeted: !!b.targeted
      }));
    }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  }
  setInterval(save, 1500);
  addEventListener('pagehide', save);
  addEventListener('bh-save', save);
  d.addEventListener('visibilitychange', () => { if (d.hidden) save(); else kick(); });

  // NO free bug on load — bugs only after clicking empty space
  resize();
  render(true);
  if (S.optedIn && !S.paused) kick();

  W.__bugHunt = {
    S, get bugs() { return bugs; },
    spawnBug, squash, addCode, rollback, ship, fireLasers, optIn, pauseGame, quitGame,
    reset() { localStorage.removeItem(KEY); location.reload(); }
  };
})();
