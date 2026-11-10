/* Bug Hunt — idle/clicker for derickjanssen.com.
   Opt-in → click empty space to write LOC → bugs hatch → squash for Commits.
   Hire Derick (one roaming laser), stackable agent turrets, tools, Agentic Workflow,
   command mode at 10 agents, rollback, Ship. Persist in localStorage. Never preventDefault. */
(() => {
  if (window.__bugHunt && !window.__bugHunt.__booting) return;
  window.__bugHunt = { __booting: true };
  const KEY = 'dj-bughunt-v3';
  const d = document, W = window;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();
  let last = now(), raf = 0, dirty = true, lastShop = '', hintUntil = 0;
  let pulseAcc = 0, bossAcc = 0, hatchAcc = 0, idleAcc = 0, clearAcc = 0;
  let quality = RM ? 1 : 3, qHold = 0, econId = 0, saveId = 0, lastEcon = now();
  let spawnQuietUntil = 0;
  const frameTimes = [];
  const spawnLog = [];

  const DEF = {
    v: 3, optedIn: false, paused: false,
    loc: 0, commits: 0, squashed: 0, spawned: 0, debt: 0,
    derick: 0, agents: 0, agentic: 0, tests: 0, ci: 0, qa: 0,
    profiler: 0, collision: 0, movement: 0, sync: 0, rapid: 0,
    rollback: 0, autoRb: 0, ships: 0,
    shop: false, open: true, hidden: false,
    bugs: [], backlog: 0, t: Date.now(), rbAt: 0, intro: false, hintSeen: false, codeIdx: 0
  };
  function migrateV2(v2) {
    const agents = Math.max(0, v2.ai | 0);
    return {
      v: 3,
      optedIn: !!v2.optedIn, paused: !!v2.paused,
      loc: v2.loc || 0, commits: v2.commits != null ? v2.commits : (v2.cash || 0),
      squashed: v2.squashed || 0, spawned: v2.spawned || 0, debt: v2.debt || 0,
      derick: v2.derick ? 1 : 0, agents, agentic: v2.agentic ? 1 : 0,
      tests: Math.min(5, v2.tests || 0), ci: v2.ci ? 1 : 0, qa: v2.qa ? 1 : 0,
      profiler: 0, collision: 0, movement: 0, sync: 0, rapid: 0,
      rollback: v2.rollback ? 1 : 0, autoRb: v2.autoRb ? 1 : 0, ships: v2.ships || 0,
      shop: !!v2.shop, open: v2.open !== false, hidden: !!v2.hidden,
      bugs: Array.isArray(v2.bugs) ? v2.bugs.slice(0, 20).map(b => ({
        tier: (b.boss || (b.mass >= 8)) ? 4 : Math.min(3, Math.max(1, b.tier || 1)),
        x: b.x, y: b.y, a: b.a, targeted: !!b.targeted,
        boss: !!(b.boss || (b.mass >= 8)), name: b.name || null,
        hp: b.hp, maxHp: b.maxHp
      })) : [],
      backlog: v2.backlog || 0, t: v2.t || Date.now(), rbAt: v2.rbAt || 0,
      intro: !!v2.intro, hintSeen: !!v2.hintSeen, codeIdx: v2.codeIdx || 0
    };
  }
  let S, fresh = false;
  function isUnused(s) { return s && !s.optedIn && !s.loc && !s.squashed && !s.derick && !s.shop; }
  try {
    const raw = localStorage.getItem(KEY);
    const v2raw = localStorage.getItem('dj-bughunt-v2');
    let parsed = raw ? JSON.parse(raw) : null;
    if (v2raw && (!parsed || isUnused(parsed))) {
      S = Object.assign({}, DEF, migrateV2(JSON.parse(v2raw)));
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    } else if (parsed) {
      S = Object.assign({}, DEF, parsed);
    } else {
      S = Object.assign({}, DEF); fresh = true;
    }
  } catch { S = Object.assign({}, DEF); fresh = true; }
  try { localStorage.removeItem('dj-bughunt-v1'); } catch {}
  if (fresh && (COARSE || innerWidth < 700)) S.open = false;

  // ---------- economy ----------
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
  const mult = () => 1 + S.ships * 0.5;
  const costScale = () => (S.rapid ? 0.78 : 1);
  const bugsPerLoc = () => 0.38 * Math.pow(0.82, Math.min(5, S.tests)) * (S.ci ? 0.85 : 1);
  const shipGoal = () => Math.round(1600 * Math.pow(S.ships + 1, 1.55));
  const RB_CD = 30000;

  // Derick: starts at 2s kill on small (HP=2), improves with tools/ships
  const derickKillTime = () => {
    let t = 2.0;
    t *= Math.pow(0.88, S.ships);
    if (S.ci) t *= 0.82;
    if (S.profiler) t *= 0.92;
    if (S.agentic) t *= 0.9;
    return Math.max(0.35, t);
  };
  const derickRange = () => {
    let r = COARSE ? 110 : 140;
    r += S.profiler * 36 + S.agentic * 28 + S.ships * 18;
    if (S.agents >= 10) r = Math.min(r, 160); // command corner focus
    return r;
  };
  const derickDps = () => 2 / derickKillTime(); // HP/s vs small
  const agentDps = () => 1; // 2s on small (HP=2)
  const agentRange = () => (COARSE ? 78 : 92) + (S.profiler ? 22 : 0);
  const chaseSpeed = () => 95 + (S.movement ? 70 : 0) + S.ships * 12;

  const cost = {
    derick: () => Math.ceil(25 * costScale()),
    agent: () => Math.ceil(40 * Math.pow(1.32, S.agents) * costScale()),
    tests: () => Math.ceil(55 * Math.pow(1.95, S.tests) * costScale()),
    profiler: () => Math.ceil(80 * costScale()),
    collision: () => Math.ceil(120 * costScale()),
    movement: () => Math.ceil(100 * costScale()),
    ci: () => Math.ceil(180 * costScale()),
    qa: () => Math.ceil(150 * costScale()),
    rapid: () => Math.ceil(200 * costScale()),
    sync: () => Math.ceil(250 * costScale()),
    agentic: () => Math.ceil(300 * costScale()),
    rollback: () => Math.ceil(400 * costScale()),
    autoRb: () => Math.ceil(800 * costScale()),
  };

  // Progression gate: only the next unlock appears (Hire agent stays buyable after the first).
  // Order: Derick → agent → tests (1+) → profiler → collision → movement → ci → qa →
  // rapid → sync → agentic → rollback → autoRb → Ship.
  const SEQ = ['tests', 'profiler', 'collision', 'movement', 'ci', 'qa', 'rapid', 'sync', 'agentic', 'rollback', 'autoRb'];
  function seqDone(id) {
    if (id === 'tests') return S.tests >= 1; // one purchase unlocks the next tool
    return !!S[id];
  }
  function nextUnlock() {
    if (!S.derick) return S.shop ? 'derick' : null;
    if (S.agents < 1) return 'agent';
    for (const id of SEQ) if (!seqDone(id)) return id;
    return null;
  }
  const ITEMS = [
    { id: 'derick', name: 'HIRE DERICK', desc: () => 'One engineer. Thin laser. Roams and squashes.', once: true, show: () => nextUnlock() === 'derick' },
    { id: 'agent', name: 'HIRE AGENT', desc: () => `Static turret · 2s small kills. (${S.agents})`, show: () => S.derick && (S.agents < 1 ? nextUnlock() === 'agent' : true) },
    { id: 'tests', name: 'UNIT TESTS', desc: () => `Fewer bugs per LOC. (${S.tests}/5)`, max: 5, show: () => nextUnlock() === 'tests' || (S.tests >= 1 && S.tests < 5 && ['profiler', 'collision', 'movement', 'ci'].includes(nextUnlock())) },
    { id: 'profiler', name: 'PROFILER', desc: () => 'Reveal hatching bugs · larger agent radius.', once: true, show: () => nextUnlock() === 'profiler' },
    { id: 'collision', name: 'COLLISION EDITOR', desc: () => 'Agent lasers pierce to a second bug.', once: true, show: () => nextUnlock() === 'collision' },
    { id: 'movement', name: 'MOVEMENT TUNING', desc: () => 'Chasing agents move faster.', once: true, show: () => nextUnlock() === 'movement' },
    { id: 'ci', name: 'CI PIPELINE', desc: () => 'Faster lasers · fewer bugs pre-merge.', once: true, show: () => nextUnlock() === 'ci' },
    { id: 'qa', name: 'QA', desc: () => 'Marks big & boss bugs: die without splitting.', once: true, show: () => nextUnlock() === 'qa' },
    { id: 'rapid', name: 'RAPID PROTOTYPE', desc: () => 'Tool builds cost ~22% less.', once: true, show: () => nextUnlock() === 'rapid' },
    { id: 'sync', name: 'MULTIPLAYER SYNC', desc: () => 'One pulse chains to several agents.', once: true, show: () => nextUnlock() === 'sync' },
    { id: 'agentic', name: 'AGENTIC WORKFLOW', desc: () => 'Derick pulses an agent to chase & clear a lineage.', once: true, show: () => nextUnlock() === 'agentic' },
    { id: 'rollback', name: 'ROLLBACK NETCODE', desc: () => '⟲ Clears the screen. 30s cooldown.', once: true, show: () => nextUnlock() === 'rollback' },
    { id: 'autoRb', name: 'AUTO ROLLBACK', desc: () => 'Rollback fires when 8+ bugs are live.', once: true, show: () => nextUnlock() === 'autoRb' },
  ];

  const CORPUS = [
    '// rollback: restore sim to last good frame\nvoid RollbackNet::Restore(Frame f) {\n  state = archive.At(f);\n  inputs.Rewind(f);\n}\n',
    'def spawn_agent(task):\n    agent = CodingAgent(model="local")\n    agent.plan(task)\n    return agent.run_with_verify()\n',
    'function SquashBug(bug)\n  if bug.tier > 1 then\n    Split(bug, bug.tier - 1)\n  else\n    Splat(bug)\n  end\nend\n',
    'class ParallaxLayer {\n  float depth;\n  void Draw(Camera cam) {\n    float ox = cam.x * depth;\n    blit(tex, ox, 0);\n  }\n};\n',
    'bool BSP_Trace(const Ray& r, Hit& h) {\n  Node* n = root;\n  while (n && !n->leaf) n = n->Child(r);\n  return n && n->Test(r, h);\n}\n',
    'qa.findBugs = (build) => {\n  const suspects = fuzz(build);\n  return suspects.filter(isRepro);\n};\n',
    'fn thin_laser(target: Bug) {\n  beam.width = 1.0;\n  beam.fire(self.pos, target.pos);\n}\n',
    'local sim = DeterministicSim.new()\nsim:step(inputs)\nif desync then sim:rollback(lastGood) end\n',
    '# collision editor export\nmesh = bake_convex(hull)\nwrite_bin("col.bin", mesh.verts, mesh.idx)\n',
    'struct Pulse { Agent* a; Bug* target; };\nvoid Agentic(Derick& d, Pulse p) { d.send(p); p.a->chase(p.target); }\n',
  ].join('');

  // ---------- DOM ----------
  const codeCv = d.createElement('canvas'); codeCv.id = 'bh-code'; codeCv.setAttribute('aria-hidden', 'true');
  const codeCtx = codeCv.getContext('2d');
  const cv = d.createElement('canvas'); cv.id = 'bh-canvas'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  const ready = d.createElement('div');
  ready.id = 'bh-ready';
  ready.innerHTML = `<button type="button" class="bh-ready-btn" data-act="ready"><span class="bh-ready-pulse"></span><span class="bh-ready-label">Play Bug Hunt</span><small>mini-game</small></button>`;
  const hud = d.createElement('section'); hud.className = 'bh-hud'; hud.setAttribute('aria-label', 'Bug Hunt mini-game');
  hud.hidden = true;
  hud.innerHTML = `<div class="bh-bar">
      <div class="bh-title">
        <b>BUG HUNT</b>
        <span class="bh-stat" title="Lines of code written this run — the build counter. Writing LOC hatches bugs."><i>LOC</i> <span data-k="loc">0</span></span>
        <span class="bh-stat"><i>BUGS</i> <span data-k="bugs">0</span></span>
        <span class="bh-stat" title="Commits earned by squashing bugs."><i>COMMITS</i> <span data-k="commits">0</span></span>
      </div>
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
    loc: $('[data-k=loc]'), bugs: $('[data-k=bugs]'), commits: $('[data-k=commits]'),
    pause: $('[data-act=pause]'), rb: $('[data-act=rb]'), min: $('[data-act=min]'), quit: $('[data-act=quit]'),
    log: $('.bh-log'), tip: $('.bh-tip'), shop: $('.bh-shop')
  };

  let Wd = 0, Hd = 0, DPR = 1;
  const CORPUS_MOD = CORPUS.length * 4;
  let typed = Math.min(S.codeIdx || 0, CORPUS_MOD);
  let codeDirty = true;

  function typeCode(n) {
    typed = (typed + Math.max(1, n | 0)) % CORPUS_MOD;
    S.codeIdx = typed;
    codeDirty = true;
    if (!raf) paintCode();
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
    if (!RM && (Math.floor(now() / 400) % 2)) {
      codeCtx.fillStyle = 'rgba(61,224,255,0.35)';
      codeCtx.fillRect(x, y, 7, fs);
    }
  }

  function currentDpr() {
    const capD = quality >= 3 ? 2 : quality >= 2 ? 1.5 : quality >= 1 ? 1 : 0.7;
    return Math.min(capD, W.devicePixelRatio || 1);
  }
  function resize(force) {
    const next = currentDpr();
    Wd = innerWidth; Hd = innerHeight;
    if (!force && next === DPR && cv.width === Math.floor(Wd * next)) return;
    DPR = next;
    for (const c of [cv, codeCv]) { c.width = Wd * DPR; c.height = Hd * DPR; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    codeCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Keep entities on-screen
    if (derickEnt) { derickEnt.x = clamp(derickEnt.x, 20, Wd - 20); derickEnt.y = clamp(derickEnt.y, 60, Hd - 20); }
    for (const a of agents) { a.homeX = clamp(a.homeX, 24, Wd - 24); a.homeY = clamp(a.homeY, 70, Hd - 24); if (!a.chasing) { a.x = a.homeX; a.y = a.homeY; } }
    paintCode(true); kick();
  }
  addEventListener('resize', resize, { passive: true });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- entities ----------
  const R = [0, 8, 13, 19, 28]; // 4 = boss
  const SPEED = [0, 62, 44, 30, 22];
  const HUE = [0, 145, 110, 300, 0];
  const HP = [0, 2, 4.5, 8, 22];
  const BOSS_NAMES = ['Desync', 'Memory Leak', 'Race Condition', 'Null Pointer', 'Frame Spike', 'Packet Loss', 'Rollback Ghost', 'Stale Snapshot'];
  const cap = () => (COARSE || Wd < 700 ? 8 : 15);
  function isBoss(b) { return !!(b && (b.boss || b.tier >= 4)); }
  function noteSpawn(src) {
    spawnLog.push({ src, t: now(), n: bugs.length });
    if (spawnLog.length > 80) spawnLog.shift();
  }
  function quietFor(sec) { spawnQuietUntil = Math.max(spawnQuietUntil, now() + sec * 1000); }
  function canAutoSpawn() { return now() >= spawnQuietUntil; }
  function mergeIfOver() {
    while (bugs.length > cap() && bugs.length >= 2) {
      let bi = 0, bj = 1, bd = 1e15;
      for (let i = 0; i < bugs.length; i++) {
        if (isBoss(bugs[i])) continue;
        for (let j = i + 1; j < bugs.length; j++) {
          if (isBoss(bugs[j])) continue;
          const dd = Math.hypot(bugs[i].x - bugs[j].x, bugs[i].y - bugs[j].y);
          if (dd < bd) { bd = dd; bi = i; bj = j; }
        }
      }
      const a = bugs[bi], b = bugs[bj];
      a.tier = Math.min(3, Math.max(a.tier, b.tier));
      a.hp = Math.min(HP[a.tier] || a.hp, a.hp + (b.hp || 0) * 0.5);
      a.maxHp = HP[a.tier] || a.maxHp;
      a.pop = 1; a.flash = 0.5;
      bugs.splice(bj, 1);
    }
  }

  let bugs = [];
  let derickEnt = null;
  let agents = [];
  const parts = [], splats = [], lasers = [], ghosts = [], codeBursts = [], pulses = [], hatches = [], shields = [];
  let shake = 0, freezeUntil = 0, flash = 0;

  function mkBug(tier, x, y, a, opts = {}) {
    a = a ?? Math.random() * Math.PI * 2;
    const boss = tier >= 4;
    return {
      tier, x, y, ox: x, oy: y, a, ph: Math.random() * 6, pop: 0.2, sq: 0, flash: 0, turn: 0,
      targeted: false, hp: HP[tier] || 2, maxHp: HP[tier] || 2,
      boss, name: opts.name || (boss ? BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)] : null),
      hatching: !!opts.hatching, hatchT: opts.hatching ? 1.2 : 0
    };
  }
  function edgePoint() {
    const s = Math.floor(Math.random() * 4), m = 10;
    return s === 0 ? [Math.random() * Wd, -m] : s === 1 ? [Wd + m, Math.random() * Hd] : s === 2 ? [Math.random() * Wd, Hd + m] : [-m, Math.random() * Hd];
  }
  function spawnBug(x, y, opts = {}) {
    S.spawned++;
    if (!opts.force && !opts.fromClick && !canAutoSpawn()) { S.backlog++; return null; }
    if (bugs.length >= cap()) { S.backlog++; return null; }
    let tier = opts.tier;
    if (!tier) {
      if (opts.boss) tier = 4;
      else {
        const p3 = Math.min(0.5, 0.1 + S.loc / 3000);
        tier = Math.random() < p3 ? 3 : Math.random() < 0.7 ? 2 : 1;
      }
    }
    if (x == null) [x, y] = edgePoint();
    const b = mkBug(tier, x, y, Math.atan2(Hd / 2 - y, Wd / 2 - x) + (Math.random() - .5), opts);
    if (opts.reveal || opts.hatching) { b.pop = 0.05; b.flash = 1; }
    bugs.push(b);
    noteSpawn(opts.src || (opts.fromClick ? 'click' : opts.reveal ? 'qa' : opts.boss ? 'boss' : opts.force ? 'force' : 'spawn'));
    kick();
    return b;
  }
  function addCode(n, x, y, fromClick) {
    S.loc += n;
    typeCode(Math.max(2, Math.floor(n * 14)));
    // Empty-space clicks still hatch immediately. Automatic LOC (idle / leftover debt)
    // only hatches slowly, and never during the post-kill quiet window.
    if (fromClick && x != null) {
      S.debt += n * bugsPerLoc();
      const hbOpts = { fromClick: true, src: 'click', hatching: !!(S.profiler && Math.random() < 0.55) };
      const hb = spawnBug(x + (Math.random() - .5) * 20, y + (Math.random() - .5) * 20, hbOpts);
      if (hb && hb.hatching) hatches.push(hb);
      S.debt = Math.max(0, S.debt - 1);
    } else {
      // ~1 bug per 8 LOC automatically, not 1:1 with kills
      S.debt += n * bugsPerLoc() * 0.32;
    }
    if (!fromClick && !canAutoSpawn()) return;
    let guard = 0;
    while (S.debt >= 1 && guard++ < 8) {
      S.debt -= 1;
      const bx = x != null ? x + (Math.random() - .5) * 36 : null;
      const by = y != null ? y + (Math.random() - .5) * 36 : null;
      spawnBug(bx, by, { src: fromClick ? 'click-debt' : 'debt', hatching: !!(S.profiler && Math.random() < 0.4) });
    }
  }

  function ensureDerick() {
    if (!S.derick) { derickEnt = null; return; }
    if (!derickEnt) {
      derickEnt = { x: Wd * 0.2, y: Hd * 0.35, tx: Wd * 0.2, ty: Hd * 0.35, target: null, aimX: 0, aimY: 0, beam: 0 };
    }
  }
  function ensureAgents() {
    while (agents.length < S.agents) {
      const ang = (agents.length * 2.4) + Math.random();
      const rad = Math.min(Wd, Hd) * (0.22 + (agents.length % 5) * 0.05);
      const hx = clamp(Wd / 2 + Math.cos(ang) * rad, 40, Wd - 40);
      const hy = clamp(Hd / 2 + Math.sin(ang) * rad, 80, Hd - 40);
      agents.push({
        x: hx, y: hy, homeX: hx, homeY: hy,
        target: null, chaseRoot: null, chasing: false, beam: 0, aimX: hx, aimY: hy, pierce: null
      });
    }
    while (agents.length > S.agents) agents.pop();
  }
  function commandMode() { return S.derick && S.agents >= 10; }
  function commandCorner() {
    // Park away from HUD (bottom-right): use top-left
    return { x: 48, y: 88 };
  }

  // ---------- juice ----------
  function burst(x, y, hue, n, spd = 260, life = 0.6) {
    if (quality < 1 || RM) n = Math.min(n, quality < 1 ? 0 : 3);
    else n = Math.ceil(n * (quality >= 3 ? 1 : quality >= 2 ? 0.5 : 0.25));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, r: 1.5 + Math.random() * 2.5, hue: hue + (Math.random() - .5) * 30 });
    }
    const capP = quality >= 3 ? 220 : quality >= 2 ? 90 : 36;
    if (parts.length > capP) parts.splice(0, parts.length - capP);
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
    if (RM || quality < 2) return;
    shake = Math.max(shake, strength * (quality >= 3 ? 0.55 : 0.3));
    if (quality >= 3) { hud.classList.remove('shake'); hud.classList.add('shake'); }
  }
  function log(msg) { el.log.textContent = msg; }
  function codeBurstAt(x, y) {
    codeBursts.push({ x, y, life: 0.55, max: 0.55 });
    if (codeBursts.length > 24) codeBursts.shift();
    burst(x, y, 190, 4, 110, .35);
  }
  function addLaser(x1, y1, x2, y2, opts = {}) {
    lasers.push({
      x1, y1, x2, y2,
      life: opts.life || 0.12, max: opts.life || 0.12,
      wide: opts.wide || 1, color: opts.color || '#39ff88', soft: true
    });
    if (lasers.length > 40) lasers.shift();
  }
  function sendPulse(from, agent, target) {
    pulses.push({
      x: from.x, y: from.y, tx: agent.x, ty: agent.y,
      agent, target, life: 0.45, max: 0.45, arrived: false
    });
    if (pulses.length > 16) pulses.shift();
  }

  function retargetQA() {
    for (const b of bugs) b.targeted = false;
    if (!S.qa || !bugs.length) return;
    const pool = bugs.filter(b => b.tier >= 3 || b.boss).sort((a, b) => b.tier - a.tier || b.maxHp - a.maxHp);
    const n = Math.min(pool.length, 1 + S.qa);
    for (let i = 0; i < n; i++) if (pool[i]) pool[i].targeted = true;
  }

  function squash(b, opts = {}) {
    const i = bugs.indexOf(b); if (i < 0) return;
    const auto = !!opts.auto;
    const noSplit = !!opts.noSplit || !!b.targeted || (b.boss && !!opts.qaBoss);
    const val = Math.round((b.boss ? 18 : b.tier * 3) * mult() * (b.targeted ? 1.25 : 1));
    S.commits += val; S.squashed++;
    burst(b.x, b.y, b.boss ? 8 : (b.targeted ? 50 : HUE[b.tier]), 5 + b.tier * 3, 160 + b.tier * 40);
    splats.push({ x: b.x, y: b.y, r: R[b.tier] * 1.3, hue: b.boss ? 8 : (b.targeted ? 50 : HUE[b.tier]), life: 1.4, max: 1.4 });
    if (splats.length > 36) splats.shift();
    if (!auto) { freezeUntil = now() + (b.boss ? 90 : b.tier === 3 ? 55 : 35); punch(b.tier * 2.2); }
    gain(b.x, b.y - R[b.tier], `+${val}`, auto ? '#3de0ff' : (b.targeted ? '#ffd166' : null));
    // Clear chase roots pointing at this bug
    for (const a of agents) {
      if (a.chaseRoot === b || a.target === b) {
        if (a.chasing && a.chaseRoot === b) { /* keep chasing splits via retarget below */ }
        a.target = null;
      }
    }
    bugs.splice(i, 1);
    if (auto) quietFor(bugs.length ? 0.7 : 3.2);
    else if (!bugs.length) quietFor(1.2);
    if (!noSplit && b.tier > 1 && b.tier < 4) {
      const kids = [];
      if (bugs.length + 2 <= cap()) {
        for (let k = 0; k < 2; k++) {
          const a = b.a + (k ? 1 : -1) * (Math.PI / 2 + Math.random() * .6);
          const c = mkBug(b.tier - 1, b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6, a);
          c.boost = 3.2; c.pop = 0.4; c.sq = 1; bugs.push(c); kids.push(c);
          noteSpawn('split');
        }
      }
      // Chasing agents continue onto splits from this lineage
      for (const ag of agents) {
        if (ag.chasing && ag.chaseRoot === b) {
          ag.chaseRoot = kids[0] || null;
          ag.target = kids[0] || null;
          if (!kids[0]) { ag.chasing = false; ag.chaseRoot = null; }
        }
      }
    } else if ((noSplit && b.tier > 1) || b.boss) {
      burst(b.x, b.y, b.boss ? 8 : 50, 12, 280, .65);
      punch(auto ? 3 : 6);
      for (const ag of agents) {
        if (ag.chaseRoot === b) { ag.chasing = false; ag.chaseRoot = null; ag.target = null; }
      }
    } else {
      for (const ag of agents) {
        if (ag.chaseRoot === b) { ag.chasing = false; ag.chaseRoot = null; ag.target = null; }
      }
    }
    if (!S.shop && S.squashed >= 5) openShop();
    mergeIfOver();
    retargetQA();
    kick(); dirty = true;
  }

  function damageBug(b, dps, dt, attacker) {
    if (!b || b.hatching) return;
    b.hp -= dps * dt;
    b.flash = Math.max(b.flash, 0.35);
    if (attacker) {
      attacker.beam = 1;
      attacker.aimX = b.x; attacker.aimY = b.y;
    }
    if (b.hp <= 0) {
      const qaBoss = isBoss(b) && b.targeted;
      squash(b, { auto: true, noSplit: !!b.targeted || qaBoss, qaBoss });
    }
  }
  function clink(b, x, y) {
    const ang = Math.atan2(b.y - y, b.x - x);
    b.a = ang; b.boost = 3.6; b.flash = 1; b.sq = 0.7;
    // negligible chip that can never finish the boss
    if (b.hp > 1) b.hp = Math.max(1, b.hp - 0.05);
    shields.push({ x: b.x, y: b.y, r: (R[Math.min(4, b.tier)] || 28) + 6, life: 0.4, max: 0.4 });
    if (shields.length > 8) shields.shift();
    if (quality >= 1) gain(b.x, b.y - 20, 'clink', '#ffd166');
    log('Too armored to squash by hand. Derick or an agent will drop it.');
    kick();
  }

  function openShop() {
    S.shop = true; S.open = true;
    log('Hire Derick unlocked.');
    hud.classList.remove('pop'); void hud.offsetWidth; hud.classList.add('pop');
    burst(Wd - 60, Hd - 40, 50, 16, 300, .7); punch(5);
  }

  function rollback(auto) {
    if (!S.rollback || Date.now() - S.rbAt < RB_CD) return;
    S.rbAt = Date.now();
    let n = bugs.length + S.backlog, gainC = 0;
    bugs.forEach(b => { gainC += b.boss ? 8 : b.tier; ghosts.push({ x: b.x, y: b.y, tx: b.ox, ty: b.oy, r: R[b.tier], hue: HUE[Math.min(3, b.tier)], t: 0 }); });
    gainC = Math.round((gainC + S.backlog) * 0.5 * mult());
    S.commits += gainC; S.squashed += n; S.backlog = 0; bugs = [];
    for (const a of agents) { a.chasing = false; a.target = null; a.chaseRoot = null; a.x = a.homeX; a.y = a.homeY; }
    flash = 1; punch(8);
    log(`⟲ Rolled back${auto ? ' (auto)' : ''}. ${n} bugs never happened. +${fmt(gainC)} commits`);
    kick(); dirty = true;
  }
  function ship() {
    if (S.loc < shipGoal() || bugs.length + S.backlog > 3) return;
    S.ships++;
    log(`Shipped v${S.ships}.0 — permanent +50% commit bounty.`);
    for (let i = 0; i < 4; i++) burst(Math.random() * Wd, Hd * 0.3 + Math.random() * Hd * 0.3, Math.random() * 360, 12, 360, 1);
    punch(10); kick(); dirty = true;
  }

  // ---------- opt-in / pause / quit ----------
  function syncShell() {
    const playing = S.optedIn && !S.paused;
    ready.hidden = S.optedIn && !S.paused;
    ready.classList.toggle('bh-resume', S.optedIn && S.paused);
    const label = ready.querySelector('.bh-ready-label');
    const small = ready.querySelector('small');
    if (S.optedIn && S.paused) {
      if (label) label.textContent = 'Resume Bug Hunt';
      if (small) small.textContent = 'continue';
    } else {
      if (label) label.textContent = 'Play Bug Hunt';
      if (small) small.textContent = 'mini-game';
    }
    hud.hidden = !S.optedIn;
    d.documentElement.classList.toggle('bh-playing', playing);
    d.documentElement.classList.toggle('bh-hidden', S.hidden);
    if (!playing && (S.paused || !S.optedIn)) ctx.clearRect(0, 0, Wd, Hd);
    paintCode(true);
  }
  function optIn() {
    S.optedIn = true; S.paused = false; S.hidden = false; S.open = true;
    if (!S.hintSeen) { S.hintSeen = true; hint.hidden = false; hintUntil = now() + 5500; }
    log(S.squashed || S.loc ? 'Welcome back.' : 'Write some code. Squash the bugs.');
    ensureDerick(); ensureAgents();
    syncShell(); render(true); startLoops(); dirty = true; save();
  }
  function pauseGame() {
    if (!S.optedIn) return;
    S.paused = true; save(); stopLoops(); syncShell(); log('Paused. Progress saved.');
  }
  function quitGame() {
    if (!S.optedIn) return;
    S.paused = true; save(); stopLoops(); syncShell(); log('Quit. Progress kept.');
  }
  function resetAll() {
    if (!confirm('Reset Bug Hunt progress? This cannot be undone.')) return;
    try { localStorage.removeItem(KEY); } catch {}
    location.reload();
  }

  syncShell();
  if (S.optedIn && !S.paused) { ensureDerick(); ensureAgents(); }
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
    const x = e.clientX, y = e.clientY, pad = e.pointerType === 'touch' ? 20 : 12;
    let best = null, bd = 1e9;
    for (const b of bugs) {
      if (b.hatching) continue;
      const dd = Math.hypot(b.x - x, b.y - y);
      if (dd < (R[b.tier] || 8) + pad && dd < bd) { bd = dd; best = b; }
    }
    if (best) {
      if (isBoss(best)) { clink(best, x, y); return; }
      squash(best, {});
      return;
    }
    addCode(1, x, y, true);
    codeBurstAt(x, y);
    gain(x, y, '+1 LOC', '#ececf6');
    if (!S.intro) { S.intro = true; log('Code written. Bugs crawl out. Squash them!'); hint.hidden = true; }
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
      const key = buy === 'agent' ? 'agents' : buy;
      if (S.commits >= c && !(it.once && S[key]) && !(it.max && S[key] >= it.max)) {
        S.commits -= c;
        S[key] = (S[key] || 0) + 1;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 50, 8, 180, .45);
        if (buy === 'derick') { ensureDerick(); log('Derick hired.'); }
        else if (buy === 'agent') { ensureAgents(); log(`Agent #${S.agents} online.`); }
        else if (buy === 'agentic') log('Agentic Workflow online.');
        else if (buy === 'rollback') log('Rollback unlocked.');
        else if (buy === 'qa') { retargetQA(); log('QA marking big bugs.'); }
        else log(`${it.name} unlocked.`);
        if (S.agents >= 10 && buy === 'agent') log('Command mode: Derick directing from the corner.');
        kick();
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
    el.commits.textContent = fmt(S.commits);
    el.rb.hidden = !S.rollback;
    if (S.rollback) {
      const left = Math.max(0, RB_CD - (Date.now() - S.rbAt));
      el.rb.disabled = left > 0;
      el.rb.textContent = left > 0 ? `⟲ ${Math.ceil(left / 1000)}s` : '⟲';
    }
    const tap = COARSE ? 'Tap' : 'Click';
    if (!S.shop) {
      el.tip.textContent = S.squashed
        ? `Squash ${Math.max(0, 5 - S.squashed)} more to unlock Hire Derick.`
        : `${tap} empty space to write LOC. Bugs hatch from what you write.`;
    } else {
      const bits = [];
      if (S.backlog) bits.push(`Backlog ${fmt(S.backlog)}`);
      if (S.derick) bits.push(`Derick ${derickKillTime().toFixed(1)}s`);
      if (S.agents) bits.push(`${S.agents} agent${S.agents === 1 ? '' : 's'}`);
      if (commandMode()) bits.push('CMD');
      bits.push(`Ship ${fmt(shipGoal())} LOC ≤3 bugs`);
      el.tip.textContent = bits.join(' · ');
    }
    if (!S.open && !force) return;
    let html = '';
    if (S.shop) {
      for (const it of ITEMS) {
        if (!it.show()) continue;
        const key = it.id === 'agent' ? 'agents' : it.id;
        const ownedN = S[key] || 0;
        const done = (it.once && ownedN) || (it.max && ownedN >= it.max);
        if (done) continue;
        const c = cost[it.id]();
        html += `<button class="bh-btn bh-item" type="button" data-buy="${it.id}" ${S.commits < c ? 'disabled' : ''}><span>${it.name}</span><small>${it.desc()}</small><em>${fmt(c)}</em></button>`;
      }
      const ok = S.loc >= shipGoal() && bugs.length + S.backlog <= 3;
      if (S.rollback && S.loc >= shipGoal() * 0.45) {
        html += `<button class="bh-btn bh-item bh-ship" type="button" data-act="ship" ${ok ? '' : 'disabled'}><span>Ship v${S.ships + 1}.0</span><small>${ok ? 'No blockers.' : `Need ${fmt(shipGoal())} LOC & ≤3 bugs.`}</small><em>🏆 ${S.ships}</em></button>`;
      }
    }
    if (html !== lastShop) { el.shop.innerHTML = html; lastShop = html; }
  }

  // ---------- combat AI ----------
  function nearestBug(x, y, range, pred) {
    let best = null, bd = range;
    for (const b of bugs) {
      if (b.hatching) continue;
      if (pred && !pred(b)) continue;
      const dd = Math.hypot(b.x - x, b.y - y);
      if (dd < bd) { bd = dd; best = b; }
    }
    return best;
  }

  function updateDerick(dt) {
    ensureDerick();
    if (!derickEnt || !S.derick) return;
    const cmd = commandMode();
    if (cmd) {
      const c = commandCorner();
      derickEnt.tx = c.x; derickEnt.ty = c.y;
    } else {
      // roam toward densest / largest threat
      const threat = bugs.filter(b => !b.hatching).sort((a, b) => (b.boss - a.boss) || (b.tier - a.tier) || (Math.hypot(a.x - derickEnt.x, a.y - derickEnt.y) - Math.hypot(b.x - derickEnt.x, b.y - derickEnt.y)))[0];
      if (threat) {
        const ang = Math.atan2(threat.y - derickEnt.y, threat.x - derickEnt.x);
        const prefer = derickRange() * 0.55;
        derickEnt.tx = threat.x - Math.cos(ang) * prefer;
        derickEnt.ty = threat.y - Math.sin(ang) * prefer;
      } else {
        derickEnt.tx += (Math.random() - .5) * 40 * dt;
        derickEnt.ty += (Math.random() - .5) * 40 * dt;
      }
      derickEnt.tx = clamp(derickEnt.tx, 30, Wd - 30);
      derickEnt.ty = clamp(derickEnt.ty, 70, Hd - 30);
    }
    const sp = cmd ? 140 : 120;
    derickEnt.x += (derickEnt.tx - derickEnt.x) * Math.min(1, dt * (sp / 40));
    derickEnt.y += (derickEnt.ty - derickEnt.y) * Math.min(1, dt * (sp / 40));

    const range = cmd ? Math.min(derickRange(), 150) : derickRange();
    const t = nearestBug(derickEnt.x, derickEnt.y, range, b => true);
    derickEnt.target = t;
    derickEnt.beam = Math.max(0, derickEnt.beam - dt * 4);
    if (t) {
      addLaser(derickEnt.x, derickEnt.y, t.x, t.y, { wide: 1, life: 0.1, color: 'rgba(57,255,136,0.75)' });
      damageBug(t, derickDps() * (S.ci ? 1.1 : 1), dt, derickEnt);
    }

    // Agentic pulses
    if (S.agentic && agents.length) {
      pulseAcc += dt * (cmd ? 0.55 : 0.35) * (1 + S.sync * 0.5);
      while (pulseAcc >= 1) {
        pulseAcc -= 1;
        const idle = agents.filter(a => !a.chasing);
        const pool = idle.length ? idle : agents;
        const n = Math.min(pool.length, S.sync ? 3 : 1);
        // Prefer boss / large
        const prey = bugs.filter(b => !b.hatching).sort((a, b) => (b.boss - a.boss) || (b.tier - a.tier))[0];
        if (!prey) break;
        for (let i = 0; i < n; i++) {
          const ag = pool[Math.floor(Math.random() * pool.length)];
          sendPulse(derickEnt, ag, prey);
        }
      }
    }
  }

  function activateChase(agent, target) {
    if (!agent || !target) return;
    agent.chasing = true;
    agent.chaseRoot = target;
    agent.target = target;
  }

  function updatePulses(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.life -= dt;
      const e = 1 - Math.max(0, p.life) / p.max;
      p.x = p.x + (p.tx - p.x) * Math.min(1, dt * 8);
      p.y = p.y + (p.ty - p.y) * Math.min(1, dt * 8);
      if (!p.arrived && Math.hypot(p.x - p.tx, p.y - p.ty) < 10) {
        p.arrived = true;
        if (p.agent && p.target && bugs.includes(p.target)) activateChase(p.agent, p.target);
      }
      if (p.life <= 0) pulses.splice(i, 1);
    }
  }

  // ---------- sim ----------
  function idleCodeRate() {
    if (!S.derick && !S.agents) return 0;
    return (S.derick ? 0.28 : 0) + S.agents * 0.07 + (S.agentic ? 0.12 : 0);
  }
  function idleWrite(dt) {
    if (S.paused || !S.optedIn) return;
    if (bugs.length) { clearAcc = 0; idleAcc = 0; return; }
    clearAcc += dt;
    if (clearAcc < 3) return;
    const rate = idleCodeRate();
    if (!rate) return;
    idleAcc += rate * dt;
    let n = 0;
    while (idleAcc >= 1 && n++ < 2) {
      idleAcc -= 1;
      S.loc += 1;
      typeCode(8);
      S.debt += bugsPerLoc() * 0.2; // slow, not 1:1
      if (quality >= 2 && derickEnt && n === 1) {
        gain(derickEnt.x, derickEnt.y - 14, '+1 LOC', '#39ff88');
        codeBursts.push({ x: derickEnt.x, y: derickEnt.y, life: 0.35, max: 0.35 });
        if (codeBursts.length > 16) codeBursts.shift();
      }
    }
    if (canAutoSpawn() && S.debt >= 1) {
      S.debt -= 1;
      spawnBug(null, null, { src: 'idle' });
    }
  }
  function econ(dt) {
    if (!S.optedIn || S.paused) return;
    if (canAutoSpawn()) {
      while (S.backlog > 0 && bugs.length < cap()) {
        S.backlog--; S.spawned--;
        spawnBug(null, null, { src: 'backlog' });
      }
    }
    // Occasional boss (never before Hire Derick; never during post-kill quiet)
    bossAcc += dt * (0.015 + Math.min(0.04, S.loc / 50000));
    if (bossAcc >= 1 && canAutoSpawn() && bugs.length < cap() && S.derick) {
      bossAcc = 0;
      const b = spawnBug(null, null, { boss: true, tier: 4, src: 'boss' });
      if (b) { log(`${b.name} appeared.`); retargetQA(); }
    }
    mergeIfOver();
    idleWrite(dt);
    if (S.autoRb && bugs.length + S.backlog >= 8) rollback(true);
  }

  function step(dt) {
    if (!S.optedIn || S.paused) {
      for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
      return;
    }
    for (const b of bugs) {
      if (b.hatching) {
        b.hatchT -= dt;
        b.pop = Math.max(0.15, 1 - b.hatchT / 1.2);
        b.flash = 0.5 + Math.sin(now() / 80) * 0.5;
        if (b.hatchT <= 0) { b.hatching = false; b.pop = 1; }
        continue;
      }
      b.ph += dt * (8 - Math.min(3, b.tier));
      b.turn += (Math.random() - .5) * dt * 6; b.turn *= 0.96; b.a += b.turn * dt * 3;
      const sp = SPEED[Math.min(4, b.tier)] * (b.boost || 1); if (b.boost) b.boost = Math.max(1, b.boost - dt * 6);
      b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
      const m = R[Math.min(4, b.tier)];
      if (b.x < m) { b.x = m; b.a = Math.PI - b.a; } else if (b.x > Wd - m) { b.x = Wd - m; b.a = Math.PI - b.a; }
      if (b.y < m + 56) { b.y = m + 56; b.a = -b.a; } else if (b.y > Hd - m) { b.y = Hd - m; b.a = -b.a; }
      b.pop += (1 - b.pop) * Math.min(1, dt * 10);
      b.sq *= Math.pow(0.002, dt); b.flash = Math.max(0, b.flash - dt * 6);
    }

    updateDerick(dt);
    // agents with correct pierce
    ensureAgents();
    const range = agentRange();
    for (const a of agents) {
      a.beam = Math.max(0, a.beam - dt * 4);
      if (a.chasing) {
        let t = a.chaseRoot && bugs.includes(a.chaseRoot) ? a.chaseRoot : null;
        if (!t) {
          t = nearestBug(a.x, a.y, 240, b => true);
          if (t) a.chaseRoot = t; else { a.chasing = false; a.chaseRoot = null; a.target = null; }
        }
        a.target = t;
        if (t) {
          const ang = Math.atan2(t.y - a.y, t.x - a.x);
          a.x += Math.cos(ang) * chaseSpeed() * dt;
          a.y += Math.sin(ang) * chaseSpeed() * dt;
        }
      } else {
        a.x += (a.homeX - a.x) * Math.min(1, dt * 3);
        a.y += (a.homeY - a.y) * Math.min(1, dt * 3);
        a.target = nearestBug(a.x, a.y, range, b => true);
      }
      const t = a.target && bugs.includes(a.target) ? a.target : null;
      if (t && Math.hypot(t.x - a.x, t.y - a.y) <= (a.chasing ? 9999 : range)) {
        addLaser(a.x, a.y, t.x, t.y, { wide: 0.9, life: 0.09, color: 'rgba(61,224,255,0.65)' });
        damageBug(t, agentDps() * (S.ci ? 1.08 : 1), dt, a);
        if (S.collision) {
          const second = nearestBug(t.x, t.y, range * 0.9, b => b !== t);
          if (second) {
            addLaser(t.x, t.y, second.x, second.y, { wide: 0.7, life: 0.08, color: 'rgba(61,224,255,0.4)' });
            damageBug(second, agentDps() * 0.55, dt, null);
          }
        }
      }
    }
    updatePulses(dt);

    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 700 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= dt; if (splats[i].life <= 0) splats.splice(i, 1); }
    for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt * 2.6; if (g.t >= 1) ghosts.splice(i, 1); }
    for (let i = codeBursts.length - 1; i >= 0; i--) { codeBursts[i].life -= dt; if (codeBursts[i].life <= 0) codeBursts.splice(i, 1); }
    for (let i = shields.length - 1; i >= 0; i--) { shields[i].life -= dt; if (shields[i].life <= 0) shields.splice(i, 1); }
    for (let i = hatches.length - 1; i >= 0; i--) { if (!hatches[i].hatching) hatches.splice(i, 1); }
    shake *= Math.pow(0.0005, dt); if (shake < .3) shake = 0;
    flash = Math.max(0, flash - dt * 2.5);
    if (hintUntil && now() > hintUntil) { hint.hidden = true; hintUntil = 0; }
  }

  function drawBug(b) {
    const tier = Math.min(4, b.tier);
    const r = R[tier] * b.pop, w = Math.sin(b.ph) * 0.13;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.scale(1 + w + b.sq * .5, 1 - w - b.sq * .4);
    const h = b.boss ? 8 : HUE[tier];
    if (b.hatching) {
      ctx.globalAlpha = 0.35 + b.flash * 0.4;
      ctx.strokeStyle = `hsla(${h},90%,60%,.9)`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * .9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = `hsla(${h},90%,35%,.9)`; ctx.lineWidth = Math.max(1, r * .1); ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { const o = Math.sin(b.ph * 2 + k) * r * .25; ctx.beginPath(); ctx.moveTo(k * r * .45, -r * .6); ctx.lineTo(k * r * .45 + o, -r * 1.15); ctx.moveTo(k * r * .45, r * .6); ctx.lineTo(k * r * .45 - o, r * 1.15); ctx.stroke(); }
    ctx.fillStyle = b.flash > 0 ? '#fff' : `hsla(${h},95%,${b.boss ? 48 : 55}%,.93)`;
    ctx.beginPath(); ctx.ellipse(0, 0, r * (b.boss ? 1.25 : 1.15), r * (b.boss ? 1 : .85), 0, 0, Math.PI * 2); ctx.fill();
    if (b.boss) {
      ctx.strokeStyle = 'rgba(255,80,80,.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * 1.15, 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = `hsla(${h},100%,85%,.55)`; ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .45, r * .22, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${h},90%,35%,1)`; ctx.beginPath(); ctx.moveTo(r * .9, -r * .2); ctx.lineTo(r * 1.5, -r * .6); ctx.moveTo(r * .9, r * .2); ctx.lineTo(r * 1.5, r * .6); ctx.stroke();
    ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(r * .6, -r * .28, r * .17, 0, 7); ctx.arc(r * .6, r * .28, r * .17, 0, 7); ctx.fill();
    ctx.restore();
    if (b.boss && b.name) {
      ctx.save();
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,100,100,.9)';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x, b.y - R[tier] * b.pop - 10);
      // hp bar
      const bw = 36, pct = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(b.x - bw / 2, b.y - R[tier] * b.pop - 6, bw, 3);
      ctx.fillStyle = '#ff5a5a'; ctx.fillRect(b.x - bw / 2, b.y - R[tier] * b.pop - 6, bw * pct, 3);
      ctx.restore();
    }
    if (b.targeted) {
      const tr = R[tier] * 1.5 * b.pop;
      const pulse = 0.65 + Math.sin(now() / 120) * 0.35;
      ctx.save();
      ctx.strokeStyle = `rgba(255,209,102,${0.8 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, tr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawDerick() {
    if (!derickEnt || !S.derick) return;
    const x = derickEnt.x, y = derickEnt.y;
    ctx.save();
    // subtle soft glow
    ctx.fillStyle = 'rgba(57,255,136,0.12)';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = '#39ff88';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#04120a';
    ctx.font = '800 7px ui-monospace, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DJ', x, y + 0.5);
    if (commandMode()) {
      ctx.strokeStyle = 'rgba(61,224,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAgent(a) {
    ctx.save();
    ctx.strokeStyle = a.chasing ? 'rgba(61,224,255,0.7)' : 'rgba(61,224,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.stroke();
    ctx.fillStyle = a.chasing ? 'rgba(61,224,255,0.55)' : 'rgba(61,224,255,0.28)';
    ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, 7); ctx.fill();
    // tiny radius hint when profiler
    if (S.profiler && !a.chasing) {
      ctx.strokeStyle = 'rgba(61,224,255,0.08)';
      ctx.beginPath(); ctx.arc(a.x, a.y, agentRange(), 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.save(); ctx.clearRect(0, 0, Wd, Hd);
    if (!S.optedIn || S.paused) { ctx.restore(); return; }
    if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    for (const s of splats) { ctx.globalAlpha = (s.life / s.max) * .45; ctx.fillStyle = `hsl(${s.hue},90%,40%)`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.2, s.r * .75, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const g of ghosts) { const e = 1 - Math.pow(1 - g.t, 3); ctx.globalAlpha = 1 - g.t; ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, g.r * (1 - g.t * .8), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const c of codeBursts) {
      const a = c.life / c.max;
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = '#39ff88';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillText('{ ++loc }', c.x - 24, c.y - 16 * (1 - a));
    }
    ctx.globalAlpha = 1;
    for (const b of bugs) drawBug(b);
    // thin lasers
    for (const z of lasers) {
      const a = z.life / z.max;
      ctx.globalAlpha = a * 0.75;
      ctx.strokeStyle = z.color || '#39ff88';
      ctx.lineWidth = (z.wide || 1) * (0.7 + a * 0.4);
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(z.x2, z.y2, 1.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of shields) {
      const a = s.life / s.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (1 - a) * 8, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // pulses
    for (const p of pulses) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = '#3de0ff';
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 + (1 - a) * 6, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(61,224,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const a of agents) drawAgent(a);
    drawDerick();
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `hsl(${p.hue},95%,60%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (flash) { ctx.fillStyle = `rgba(61,224,255,${flash * .22})`; ctx.fillRect(-20, -20, Wd + 40, Hd + 40); }
    ctx.restore();
  }

  function noteFrame(ms) {
    frameTimes.push(ms); if (frameTimes.length > 45) frameTimes.shift();
    if (frameTimes.length < 18) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 21 && quality > 0) {
      if (++qHold > 8) { quality--; qHold = 0; frameTimes.length = 0; resize(true); }
    } else if (avg < 13.5 && quality < (RM ? 1 : 3)) {
      if (--qHold < -24) { quality++; qHold = 0; frameTimes.length = 0; resize(true); }
    } else if (qHold > 0) qHold--; else if (qHold < 0) qHold++;
  }
  function frame() {
    raf = 0;
    const t = now(); const raw = t - last; last = t;
    let dt = Math.min(0.05, raw / 1000);
    if (t < freezeUntil) dt = 0;
    step(dt); draw();
    noteFrame(raw);
    if (!RM && quality >= 2) paintCode();
    const live = S.optedIn && !S.paused && !S.hidden &&
      (bugs.length || parts.length || splats.length || lasers.length || ghosts.length || codeBursts.length || pulses.length || shields.length || shake || flash || S.derick || S.agents);
    if (live) raf = requestAnimationFrame(frame);
    else if (S.optedIn && !S.paused) { raf = 0; }
  }
  function kick() {
    if (!raf && S.optedIn && !S.paused && !S.hidden && !d.hidden) {
      last = now(); raf = requestAnimationFrame(frame);
    }
  }
  function startLoops() {
    if (!econId) { lastEcon = now(); econId = setInterval(econTick, 250); }
    if (!saveId) saveId = setInterval(save, 2000);
    kick();
  }
  function stopLoops() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (econId) { clearInterval(econId); econId = 0; }
    if (saveId) { clearInterval(saveId); saveId = 0; }
  }
  function econTick() {
    if (d.hidden) return;
    const t = now();
    econ((t - lastEcon) / 1000);
    lastEcon = t;
    render();
    if (bugs.length || lasers.length || S.derick || S.agents) kick();
  }

  // offline
  (() => {
    if (!S.optedIn || S.paused) return;
    const dt = Math.min(900, Math.max(0, (Date.now() - (S.t || Date.now())) / 1000));
    if (dt > 2 && S.derick) {
      // Approximate auto kills while away
      const kills = Math.min(40, Math.floor(derickDps() * dt * 0.25 + S.agents * 0.15 * dt));
      if (kills) {
        S.squashed += kills;
        S.commits += Math.round(kills * 2 * mult());
        S.backlog = Math.max(0, S.backlog - kills);
        if (dt > 20) log(`While away: lasers cleared ${fmt(kills)} · +${fmt(kills * 2)} commits`);
      }
    }
  })();

  function save() {
    S.t = Date.now();
    if (S.optedIn && !S.paused) {
      S.bugs = bugs.slice(0, 20).map(b => ({
        tier: b.tier, x: +(b.x / Math.max(1, Wd)).toFixed(4), y: +(b.y / Math.max(1, Hd)).toFixed(4),
        a: +b.a.toFixed(2), targeted: !!b.targeted, boss: !!b.boss, name: b.name || null,
        hp: +b.hp.toFixed(2), maxHp: b.maxHp
      }));
    }
    try {
      if (S.optedIn || S.shop || S.loc || S.squashed || localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, JSON.stringify(S));
      }
    } catch {}
  }
  addEventListener('pagehide', () => { save(); stopLoops(); });
  addEventListener('bh-save', save);
  d.addEventListener('visibilitychange', () => {
    if (d.hidden) { save(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else { lastEcon = now(); if (S.optedIn && !S.paused) startLoops(); }
  });

  resize(true);
  // restore bugs after resize so Wd/Hd are valid
  if (S.optedIn && !S.paused && S.bugs && S.bugs.length) {
    bugs = S.bugs.map(b => {
      const tier = b.boss ? 4 : b.tier;
      const nb = mkBug(tier, b.x * Wd, b.y * Hd, b.a, { name: b.name });
      nb.targeted = !!b.targeted;
      if (b.hp != null) nb.hp = b.hp;
      return nb;
    });
  }
  render(true);
  if (S.optedIn && !S.paused) startLoops();

  W.__bugHunt = {
    S, get bugs() { return bugs; }, get derick() { return derickEnt; }, get agents() { return agents; },
    spawnBug, squash, addCode, rollback, ship, econ, optIn, pauseGame, quitGame,
    isBoss, clink, cap, idleWrite, idleCodeRate,
    get quality() { return quality; },
    setQuality(q) { quality = Math.max(0, Math.min(3, q | 0)); resize(true); },
    get spawnLog() { return spawnLog; },
    quietFor, noteFrame,
    stats() {
      return {
        bugs: bugs.length, backlog: S.backlog, parts: parts.length, lasers: lasers.length,
        splats: splats.length, ghosts: ghosts.length, bursts: codeBursts.length, shields: shields.length,
        pulses: pulses.length, hatches: hatches.length, typed, raf: !!raf, econId: !!econId, saveId: !!saveId,
        quality, dpr: DPR, fps: frameTimes.length ? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length) : 0,
        shopItems: ITEMS.filter(i => i.show()).map(i => i.id),
        clearAcc, spawnQuiet: Math.max(0, spawnQuietUntil - now()),
      };
    },
    reset() { stopLoops(); localStorage.removeItem(KEY); location.reload(); }
  };
})();
