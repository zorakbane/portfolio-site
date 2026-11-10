/* Bug Hunt — original idle/clicker for derickjanssen.com.
   Opt-in arcade prompt → click empty space to write code → code spawns slime bugs.
   Squash bugs; unlock Hire Derick (edge lasers), coding agents, Hire QA, then
   Agentic Workflow. QA reveals & paints destroy-no-split targets. Bosses (big
   merges) ignore player taps and fall to lasers. State in localStorage.
   Never preventDefault. All logic, art, and snippet corpus written for this site. */
(() => {
  if (window.__bugHunt && !window.__bugHunt.__booting) return;
  window.__bugHunt = { __booting: true };

  const KEY = 'dj-bughunt-v2';
  const d = document, W = window;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();

  const BOSS_MASS = 8;
  const CORPUS_CAP = 0; // set after CORPUS

  let derickAcc = 0, idleAcc = 0, qaRevealAcc = 0, last = now(), raf = 0, lastShop = '';
  let hintUntil = 0, econId = 0, saveId = 0, lastEcon = now();
  let quality = RM ? 1 : 3, qHold = 0, drawDpr = 1, codePaintAge = 0, mergeLock = false;
  const frameTimes = [];
  let hiddenAt = 0;

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
  try { localStorage.removeItem('dj-bughunt-v1'); } catch {}
  if (fresh && (COARSE || innerWidth < 700)) S.open = false;

  // ---------- economy ----------
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
  const mult = () => 1 + S.ships * 0.5;
  const locPerSec = () => {
    let v = S.ai * 1.35 * (S.orch ? 2.4 : 1) * (1 + S.ships * 0.25);
    if (S.agentic) v += S.derick * 0.35 * S.agentic;
    return v;
  };
  const bugsPerLoc = () => 0.38 * Math.pow(0.82, S.tests) * (S.orch ? 0.65 : 1) * (S.ci ? 0.85 : 1);
  const derickRate = () => {
    if (!S.derick) return 0;
    const base = 0.55 + S.derick * 0.35;
    return base * (1 + S.agentic * 0.85) * (S.ci ? 1.15 : 1);
  };
  const derickBeams = () => Math.min(6, 1 + S.derick + (S.agentic ? 1 + S.agentic : 0));
  const idleCodeRate = () => {
    if (!S.derick) return 0;
    return (0.5 + S.derick * 0.4) * (1 + S.agentic * 0.7);
  };
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
  // show = purchasable; tease = visible as ??? when close but locked
  const ITEMS = [
    { id: 'derick', name: 'HIRE DERICK', desc: () => `Lasers from off-screen auto-kill bugs. Idle: writes code. (${S.derick})`,
      show: () => S.shop, tease: () => false },
    { id: 'ai', name: 'Hire coding agent', desc: () => `+1.35 LOC/s each. Writes bugs too. (${S.ai})`,
      show: () => S.derick >= 1, tease: () => S.shop && !S.derick },
    { id: 'qa', name: 'HIRE QA', desc: () => `Reveals more bugs & marks largest (incl. bosses) for destroy-no-split. Does not squash. (${S.qa})`,
      show: () => S.ai >= 1, tease: () => S.derick >= 1 && S.ai < 1 },
    { id: 'tests', name: 'Write unit tests', desc: () => `-18% bugs per line. (${S.tests}/5)`,
      show: () => S.ai >= 1 && S.squashed >= 12, tease: () => S.ai >= 1 && S.squashed >= 6 && S.squashed < 12, max: 5 },
    { id: 'agentic', name: 'AGENTIC WORKFLOW', desc: () => `More emitters, faster volleys, multi-target beams + draft LOC. Idle lasers write more code. (${S.agentic})`,
      show: () => S.derick >= 1 && S.ai >= 2, tease: () => S.derick >= 1 && S.ai >= 1 && S.ai < 2 },
    { id: 'ci', name: 'CI pipeline', desc: () => 'Derick + QA find faster; 15% fewer bugs pre-merge.',
      show: () => S.qa >= 1, tease: () => S.ai >= 1 && !S.qa, once: true },
    { id: 'orch', name: 'Agent orchestrator', desc: () => 'Coding agents verify each other: 2.4× code, fewer bugs.',
      show: () => S.ai >= 3, tease: () => S.ai >= 2 && S.ai < 3, once: true },
    { id: 'rollback', name: 'Deterministic rollback', desc: () => '⟲ Rollback clears every bug. 30s cooldown.',
      show: () => !!S.ci, tease: () => S.qa >= 1 && !S.ci, once: true },
    { id: 'autoRb', name: 'Rollback netcode', desc: () => 'Rollback fires when 8+ bugs are live.',
      show: () => !!S.rollback, tease: () => !!S.ci && !S.rollback, once: true },
  ];
  const BUY_LOG = {
    derick: 'Derick hired. Lasers inbound — and they write code when the board is clear.',
    agentic: 'Agentic workflow online: sub-agents amplify every laser volley and idle drafts.',
    ai: 'Coding agent hired. It writes code. Lots of code.',
    qa: 'QA online. Hunting for bugs — targets painted on the biggest ones.',
    tests: 'Tests written. Fewer bugs per line.',
    ci: 'CI is green. Mostly.',
    orch: 'Orchestrator live: agents verify their own work.',
    rollback: 'Rollback unlocked. Press ⟲ when it gets bad.',
    autoRb: 'Rollback netcode: it fixes itself now.',
  };

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
  const CORPUS_MOD = CORPUS.length * 4;

  // ---------- DOM ----------
  const codeCv = d.createElement('canvas'); codeCv.id = 'bh-code'; codeCv.setAttribute('aria-hidden', 'true');
  const codeCtx = codeCv.getContext('2d', { alpha: true });
  const cv = d.createElement('canvas'); cv.id = 'bh-canvas'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d', { alpha: true });
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
  let typed = Math.min(S.codeIdx || 0, CORPUS_MOD);
  let codeDirty = true;
  const codeCache = d.createElement('canvas');
  const cacheCtx = codeCache.getContext('2d', { alpha: true });
  let cacheKey = '';

  function currentDpr() {
    const cap = quality >= 3 ? 2 : quality >= 2 ? 1.5 : quality >= 1 ? 1 : 0.7;
    return Math.min(cap, W.devicePixelRatio || 1);
  }
  function resize(force) {
    const next = currentDpr();
    Wd = innerWidth; Hd = innerHeight;
    if (!force && next === DPR && cv.width === Math.floor(Wd * next)) return;
    DPR = next; drawDpr = next;
    for (const c of [cv, codeCv]) { c.width = Math.floor(Wd * DPR); c.height = Math.floor(Hd * DPR); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    codeCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cacheKey = ''; codeDirty = true; paintCode(true); kick();
  }
  addEventListener('resize', () => resize(), { passive: true });

  // ---------- code rain (cached; typd is capped) ----------
  function typeCode(n) {
    typed = (typed + Math.max(1, n | 0)) % CORPUS_MOD;
    S.codeIdx = typed;
    codeDirty = true;
  }
  function paintCode(force) {
    if (!S.optedIn || S.paused) { if (force) codeCtx.clearRect(0, 0, Wd, Hd); return; }
    if (!force && !codeDirty && quality < 2) return;
    const fs = COARSE ? 11 : 12, lh = fs + 3;
    const key = typed + ':' + Wd + 'x' + Hd + ':' + DPR + ':' + quality;
    if (codeDirty || cacheKey !== key) {
      cacheKey = key; codeDirty = false;
      const cw = Math.max(1, Math.floor(Wd * DPR)), ch = Math.max(1, Math.floor(Hd * DPR));
      if (codeCache.width !== cw) { codeCache.width = cw; codeCache.height = ch; }
      cacheCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cacheCtx.clearRect(0, 0, Wd, Hd);
      if (typed > 0 && quality > 0) {
        const cols = Math.max(1, Math.floor(Wd / (fs * 0.62)));
        const rows = Math.ceil(Hd / lh) + 1;
        const maxChars = Math.min(typed, cols * rows);
        cacheCtx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        cacheCtx.fillStyle = 'rgba(57,255,136,0.11)';
        cacheCtx.textBaseline = 'top';
        let i = Math.max(0, (typed - maxChars) % CORPUS.length);
        let drawn = 0, x = 8, y = 8;
        while (drawn < maxChars && y < Hd) {
          const ch = CORPUS[i % CORPUS.length];
          i++;
          if (ch === '\n' || x > Wd - 20) { x = 8; y += lh; if (ch === '\n') { drawn++; continue; } }
          cacheCtx.fillText(ch, x, y);
          x += fs * 0.62;
          drawn++;
        }
      }
    }
    codeCtx.clearRect(0, 0, Wd, Hd);
    if (typed > 0 && quality > 0) codeCtx.drawImage(codeCache, 0, 0, Wd, Hd);
    if (!RM && quality >= 2 && (Math.floor(now() / 400) % 2)) {
      codeCtx.fillStyle = 'rgba(61,224,255,0.35)';
      codeCtx.fillRect(12, 8, 7, fs);
    }
  }

  // ---------- entities ----------
  const SPEED = [0, 62, 44, 30, 22];
  const HUE = [0, 145, 110, 300, 20];
  const softCap = () => (COARSE || Wd < 700 ? 10 : 16);
  const hardCap = () => (COARSE || Wd < 700 ? 16 : 24);
  const maxMass = () => (S.derick ? 48 : BOSS_MASS - 1);

  function massOf(b) { return b.mass || b.tier || 1; }
  function isBoss(b) { return massOf(b) >= BOSS_MASS; }
  function radius(b) { return Math.min(isBoss(b) ? 42 : 32, 7 + Math.sqrt(massOf(b)) * 5.5); }
  function hueOf(b) { return isBoss(b) ? 20 : (HUE[Math.min(3, b.tier || 1)] || 145); }
  function speedOf(b) { return Math.max(16, 70 / Math.sqrt(massOf(b))) * (b.boost || 1); }

  let bugs = [];
  if (S.optedIn && !S.paused && S.bugs && S.bugs.length) {
    bugs = S.bugs.map(b => ({
      ...b,
      mass: b.mass || b.tier || 1,
      hp: b.hp || b.mass || b.tier || 1,
      x: b.x * Wd, y: b.y * Hd, ox: b.x * Wd, oy: b.y * Hd,
      pop: 1, sq: 0, flash: 0, ph: Math.random() * 6, targeted: !!b.targeted, glorp: 0
    }));
  }
  const parts = [], splats = [], lasers = [], ghosts = [], codeBursts = [], shields = [], merges = [];
  let shake = 0, freezeUntil = 0, flash = 0;

  function mkBug(tier, x, y, a, mass) {
    a = a ?? Math.random() * Math.PI * 2;
    mass = mass || tier || 1;
    return { tier: Math.min(3, Math.max(1, tier || 1)), mass, hp: mass, x, y, ox: x, oy: y, a, ph: Math.random() * 6, pop: 0.2, sq: 0, flash: 0, turn: 0, targeted: false, glorp: 0, boost: 0 };
  }
  function edgePoint() {
    const s = Math.floor(Math.random() * 4), m = 10;
    return s === 0 ? [Math.random() * Wd, -m] : s === 1 ? [Wd + m, Math.random() * Hd] : s === 2 ? [Math.random() * Wd, Hd + m] : [-m, Math.random() * Hd];
  }
  function laserOrigin() {
    if (S.agentic && Math.random() < 0.55) {
      const corners = [[-20, -20], [Wd + 20, -20], [-20, Hd + 20], [Wd + 20, Hd + 20],
        [Wd / 2, -30], [-30, Hd / 2], [Wd + 30, Hd / 2], [Wd / 2, Hd + 30]];
      return corners[Math.floor(Math.random() * corners.length)];
    }
    return edgePoint();
  }
  function spawnBug(x, y, opts = {}) {
    S.spawned++;
    if (!opts.force && bugs.length >= hardCap()) { S.backlog++; return null; }
    const p3 = Math.min(0.55, 0.12 + S.loc / 2800);
    const tier = opts.tier || (Math.random() < p3 ? 3 : Math.random() < 0.7 ? 2 : 1);
    let mass = opts.mass || tier;
    if (!S.derick) mass = Math.min(mass, BOSS_MASS - 1);
    if (x == null) [x, y] = edgePoint();
    const b = mkBug(tier, x, y, Math.atan2(Hd / 2 - y, Wd / 2 - x) + (Math.random() - .5), mass);
    if (opts.reveal) { b.pop = 0.05; b.flash = 1; }
    bugs.push(b);
    if (!opts.force && bugs.length > softCap()) tryMerges(true);
    kick();
    return b;
  }
  function addCode(n, x, y, fromClick) {
    S.loc += n;
    typeCode(Math.max(2, Math.floor(n * 14)));
    S.debt += n * bugsPerLoc();
    if (fromClick && x != null) {
      spawnBug(x + (Math.random() - .5) * 20, y + (Math.random() - .5) * 20);
      S.debt = Math.max(0, S.debt - 1);
    }
    let guard = 0;
    while (S.debt >= 1 && guard++ < 20) {
      S.debt -= 1;
      const bx = x != null ? x + (Math.random() - .5) * 36 : null;
      const by = y != null ? y + (Math.random() - .5) * 36 : null;
      spawnBug(bx, by);
    }
  }

  // ---------- juice (quality-scaled, no layout thrash on low q) ----------
  function partBudget() { return quality >= 3 ? 220 : quality >= 2 ? 90 : quality >= 1 ? 36 : 0; }
  function burst(x, y, hue, n, spd = 260, life = 0.6) {
    if (quality < 1 || RM) n = Math.min(n, quality < 1 ? 0 : 3);
    else n = Math.ceil(n * (quality >= 3 ? 1 : quality >= 2 ? 0.5 : 0.25));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, r: 2 + Math.random() * 3.5, hue: hue + (Math.random() - .5) * 30 });
    }
    const capP = partBudget();
    if (parts.length > capP) parts.splice(0, parts.length - capP);
  }
  let gains = 0;
  function gain(x, y, text, color) {
    if (quality < 1 || gains > (quality >= 3 ? 8 : 4)) return;
    gains++;
    const g = d.createElement('span'); g.className = 'bh-gain'; g.textContent = text;
    g.style.left = x + 'px'; g.style.top = y + 'px'; if (color) g.style.color = color;
    d.body.appendChild(g); setTimeout(() => { g.remove(); gains--; }, 720);
  }
  function punch(strength) {
    if (RM || quality < 2) return;
    shake = Math.max(shake, strength * (quality >= 3 ? 1 : 0.5));
    // avoid forced reflow / class thrash at lower quality
    if (quality >= 3) {
      hud.classList.remove('shake'); hud.classList.add('shake');
    }
  }
  function log(msg) { el.log.textContent = msg; }
  function codeBurstAt(x, y) {
    if (quality < 1) return;
    codeBursts.push({ x, y, life: 0.55, max: 0.55 });
    if (codeBursts.length > 16) codeBursts.shift();
    burst(x, y, 190, 5, 110, .4);
  }

  // ---------- targeting / merge / bosses ----------
  function retarget() {
    for (const b of bugs) b.targeted = false;
    if (!S.qa || !bugs.length) return;
    const n = Math.min(bugs.length, S.qa);
    const sorted = bugs.slice().sort((a, b) => massOf(b) - massOf(a) || (b.tier - a.tier));
    for (let i = 0; i < n; i++) sorted[i].targeted = true;
  }
  function mergePair(a, b) {
    const mass = Math.min(maxMass(), massOf(a) + massOf(b));
    const leftover = massOf(a) + massOf(b) - mass;
    const x = (a.x * massOf(a) + b.x * massOf(b)) / (massOf(a) + massOf(b));
    const y = (a.y * massOf(a) + b.y * massOf(b)) / (massOf(a) + massOf(b));
    a.mass = mass; a.hp = mass; a.tier = Math.min(3, Math.max(a.tier, b.tier, mass >= 4 ? 3 : mass >= 2 ? 2 : 1));
    a.x = x; a.y = y; a.pop = 0.4; a.sq = 1; a.glorp = 1; a.flash = 0.6;
    a.targeted = a.targeted || b.targeted;
    if (quality >= 2) {
      merges.push({ x, y, r: radius(a) * 1.4, life: 0.35, max: 0.35 });
      if (merges.length > 12) merges.shift();
      burst(x, y, hueOf(a), 8, 140, .4);
    }
    const i = bugs.indexOf(b); if (i >= 0) bugs.splice(i, 1);
    if (leftover >= 1 && S.derick) S.backlog += leftover; // value preserved in backlog if mass capped
    return a;
  }
  function collapseTo(n) {
    if (bugs.length <= n) return;
    const groups = Array.from({ length: n }, () => []);
    bugs.forEach((b, i) => groups[i % n].push(b));
    const next = [];
    for (const g of groups) {
      if (!g.length) continue;
      let mass = 0, x = 0, y = 0, targeted = false, tier = 1;
      for (const b of g) { mass += massOf(b); x += b.x; y += b.y; targeted = targeted || b.targeted; tier = Math.max(tier, b.tier || 1); }
      const capM = maxMass();
      const leftover = Math.max(0, mass - capM);
      mass = Math.min(capM, mass);
      const c = mkBug(tier, x / g.length, y / g.length, Math.random() * 6, mass);
      c.pop = 1; c.glorp = quality >= 2 ? 1 : 0; c.targeted = targeted;
      if (leftover >= 1) S.backlog += leftover;
      next.push(c);
    }
    bugs = next;
    if (quality >= 2 && next[0]) merges.push({ x: next[0].x, y: next[0].y, r: 40, life: 0.3, max: 0.3 });
  }
  function tryMerges(force) {
    if (mergeLock && !force) return;
    if (bugs.length < 2) return;
    const hard = hardCap(), soft = softCap();
    const target = (force || bugs.length > soft) ? soft : hard;
    if (bugs.length > target * 2) { collapseTo(target); retarget(); return; }
    // overlap merges (n is small here)
    for (let i = 0; i < bugs.length; i++) {
      const a = bugs[i]; const ra = radius(a);
      for (let j = i + 1; j < bugs.length; j++) {
        const b = bugs[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < (ra + radius(b)) * 0.72) {
          mergePair(a, b); j--;
          if (bugs.length < 2) { retarget(); return; }
        }
      }
    }
    while (bugs.length > target && bugs.length >= 2) {
      let bi = 0, bj = 1, bd = 1e15;
      for (let i = 0; i < bugs.length; i++) {
        for (let j = i + 1; j < bugs.length; j++) {
          const dd = Math.hypot(bugs[i].x - bugs[j].x, bugs[i].y - bugs[j].y);
          if (dd < bd) { bd = dd; bi = i; bj = j; }
        }
      }
      mergePair(bugs[bi], bugs[bj]);
    }
    while (bugs.length > hard && bugs.length >= 2) mergePair(bugs[0], bugs[1]);
    retarget();
  }

  function squash(b, opts = {}) {
    const i = bugs.indexOf(b); if (i < 0) return;
    const auto = !!opts.auto;
    const noSplit = !!opts.noSplit || !!b.targeted;
    const m = massOf(b);
    const val = Math.round(m * mult() * (b.targeted ? 1.35 : 1));
    S.cash += val; S.squashed++;
    burst(b.x, b.y, b.targeted ? 50 : hueOf(b), quality >= 2 ? 6 + Math.min(8, m) : 3, 180 + Math.min(8, m) * 20);
    if (quality >= 1) {
      splats.push({ x: b.x, y: b.y, r: radius(b) * 1.4, hue: b.targeted ? 50 : hueOf(b), life: 1.2, max: 1.2 });
      if (splats.length > 24) splats.shift();
    }
    if (!auto && quality >= 2) { freezeUntil = now() + (isBoss(b) ? 70 : 40); punch(Math.min(10, 2 + m)); }
    if (quality >= 1) gain(b.x, b.y - radius(b), `+$${val}`, auto ? '#3de0ff' : (b.targeted ? '#ffd166' : null));
    bugs.splice(i, 1);
    if (!noSplit && m > 1) {
      const left = Math.floor(m / 2), right = m - left;
      const kids = [left, right].filter(v => v > 0);
      if (bugs.length + kids.length <= hardCap()) {
        kids.forEach((km, k) => {
          const ang = b.a + (k ? 1 : -1) * (Math.PI / 2 + Math.random() * .6);
          const c = mkBug(Math.min(3, km), b.x + Math.cos(ang) * 8, b.y + Math.sin(ang) * 8, ang, km);
          c.boost = 3.2; c.pop = 0.4; c.sq = 1; bugs.push(c);
        });
      }
      // if at cap, mass is just gone as a clean kill (perf)
    } else if (noSplit && m > 1) {
      burst(b.x, b.y, 50, 12, 300, .6);
    }
    if (!S.shop && S.squashed >= 5) openShop();
    retarget();
    kick();
  }
  function laserHit(b) {
    const dmg = 1 + (S.agentic ? S.agentic : 0);
    if (isBoss(b)) {
      b.hp = (b.hp ?? massOf(b)) - dmg;
      b.flash = 1;
      if (b.hp > 0) return; // still standing
    }
    squash(b, { auto: true, noSplit: !!b.targeted });
  }
  function clink(b, x, y) {
    const ang = Math.atan2(b.y - y, b.x - x);
    b.a = ang; b.boost = 4.2; b.flash = 1; b.sq = 0.8;
    shields.push({ x: b.x, y: b.y, r: radius(b) + 6, life: 0.4, max: 0.4 });
    if (shields.length > 8) shields.shift();
    if (quality >= 1) gain(b.x, b.y - radius(b), 'clink', '#ffd166');
    log('Too armored to squash by hand. Lasers (and QA targets) will drop it.');
    kick();
  }
  function openShop() {
    S.shop = true; S.open = true;
    log('HIRE DERICK unlocked — lasers from off-screen.');
    if (quality >= 3) { hud.classList.remove('pop'); hud.classList.add('pop'); }
    burst(Wd - 60, Hd - 40, 50, 18, 300, .7); punch(6);
  }
  function fireLasers() {
    if (!S.derick || !bugs.length || S.paused || !S.optedIn) return;
    const beams = derickBeams();
    const pool = bugs.slice().sort((a, b) => (b.targeted - a.targeted) || (massOf(b) - massOf(a)));
    const hits = Math.min(beams, pool.length);
    for (let i = 0; i < hits; i++) {
      const t = pool[i];
      const [ox, oy] = laserOrigin();
      lasers.push({ x1: ox, y1: oy, x2: t.x, y2: t.y, life: 0.2, max: 0.2, wide: 2 + S.agentic });
      laserHit(t);
    }
    if (S.agentic) {
      for (let i = 0; i < hits - 1; i++) {
        const a = pool[i], b = pool[i + 1];
        if (!a || !b) break;
        lasers.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, life: 0.14, max: 0.14, wide: 1.5, chain: true });
      }
    }
    const capL = quality >= 3 ? 18 : quality >= 2 ? 10 : 6;
    if (lasers.length > capL) lasers.splice(0, lasers.length - capL);
    kick();
  }
  function idleWrite(dt) {
    if (!S.derick || bugs.length || S.paused || !S.optedIn) return;
    idleAcc += idleCodeRate() * dt;
    let n = 0;
    while (idleAcc >= 1 && n++ < 4) {
      idleAcc -= 1;
      addCode(1);
      if (quality >= 2 && gains < 4) {
        const [ox, oy] = laserOrigin();
        const x = Math.max(16, Math.min(Wd - 16, ox < 0 ? 18 : ox > Wd ? Wd - 18 : ox));
        const y = Math.max(20, Math.min(Hd - 20, oy < 0 ? 24 : oy > Hd ? Hd - 24 : oy));
        gain(x, y, '+1 LOC', '#39ff88');
        codeBursts.push({ x, y, life: 0.3, max: 0.3, idle: true });
        if (codeBursts.length > 16) codeBursts.shift();
      }
    }
  }
  function rollback(auto) {
    if (!S.rollback || Date.now() - S.rbAt < RB_CD) return;
    S.rbAt = Date.now();
    let n = bugs.length + S.backlog, cash = 0;
    bugs.forEach(b => { cash += massOf(b); if (quality >= 2) ghosts.push({ x: b.x, y: b.y, tx: b.ox, ty: b.oy, r: radius(b), hue: hueOf(b), t: 0 }); });
    cash = Math.round((cash + S.backlog) * 0.5 * mult());
    S.cash += cash; S.squashed += n; S.backlog = 0; bugs = [];
    flash = quality >= 1 ? 1 : 0; punch(10);
    log(`⟲ Rolled back to the last good frame${auto ? ' (netcode)' : ''}. ${n} bugs never happened. +$${fmt(cash)}`);
    kick();
  }
  function ship() {
    if (S.loc < shipGoal() || bugs.length + S.backlog > 3) return;
    S.ships++;
    const lines = ['Shipped! Reviews are in: Game of the Year.', 'Shipped v' + S.ships + '.0! Players love the feel.', 'Shipped! Most Innovative Gameplay.', 'Shipped! Zero desyncs reported.'];
    log(`🏆 ${lines[(S.ships - 1) % lines.length]} All bounties +50%.`);
    if (quality >= 2) for (let i = 0; i < 3; i++) burst(Math.random() * Wd, Hd * 0.3 + Math.random() * Hd * 0.3, Math.random() * 360, 12, 360, 1);
    punch(12); kick();
  }

  // ---------- opt-in / pause / loops ----------
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
    if (!playing) { ctx.clearRect(0, 0, Wd, Hd); }
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
    ctx.clearRect(0, 0, Wd, Hd);
  }
  function optIn() {
    S.optedIn = true; S.paused = false; S.hidden = false; S.open = true;
    if (!S.hintSeen) { S.hintSeen = true; hint.hidden = false; hintUntil = now() + 5500; }
    log(S.squashed || S.loc ? 'Welcome back. Squash continues.' : 'Insert coin. Write some code.');
    syncShell(); render(true); startLoops(); save();
  }
  function pauseGame() {
    if (!S.optedIn) return;
    S.paused = true; save(); stopLoops();
    syncShell(); render(true);
    log('Paused. Progress saved.');
  }
  function quitGame() {
    if (!S.optedIn) return;
    S.paused = true; save(); stopLoops(); syncShell(); render(true);
    log('Quit to title. Progress kept.');
  }
  function resetAll() {
    if (!confirm('Reset Bug Hunt progress? This cannot be undone.')) return;
    stopLoops();
    try { localStorage.removeItem(KEY); } catch {}
    location.reload();
  }

  syncShell();
  if (S.optedIn && !S.paused && !S.hintSeen && !S.intro) {
    hint.hidden = false; hintUntil = now() + 5500; S.hintSeen = true;
  }

  // ---------- input (never swallow; interactive elems = site only) ----------
  const IGNORE = 'a,button,input,textarea,select,summary,label,iframe,video,audio,[role=button],[contenteditable],.bh-hud,#bh-ready,.yt';
  let downX = 0, downY = 0, downT = 0;
  d.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = now(); }, { passive: true });
  d.addEventListener('pointerup', e => {
    if (!S.optedIn || S.paused || S.hidden || (e.button && e.button !== 0)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10 || now() - downT > 600) return;
    if (e.target.closest && e.target.closest(IGNORE)) return; // site handles the click
    const sel = W.getSelection && W.getSelection(); if (sel && String(sel).length) return;
    const x = e.clientX, y = e.clientY, pad = e.pointerType === 'touch' ? 16 : 8;
    let best = null, bd = 1e9;
    for (const b of bugs) {
      const dd = Math.hypot(b.x - x, b.y - y);
      if (dd < radius(b) + pad && dd < bd) { bd = dd; best = b; }
    }
    if (best) {
      if (isBoss(best)) { clink(best, x, y); return; }
      squash(best, {});
      return;
    }
    addCode(1, x, y, true);
    codeBurstAt(x, y);
    if (quality >= 1) gain(x, y, '+1 LOC', '#ececf6');
    if (!S.intro) {
      S.intro = true;
      log('Code written. Code has bugs. Squash them!');
      hint.hidden = true;
    }
    kick();
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
      const it = ITEMS.find(i => i.id === buy); if (!it || !it.show()) return;
      const c = cost[buy]();
      if (S.cash >= c && !(it.once && S[buy]) && !(it.max && S[buy] >= it.max)) {
        S.cash -= c; S[buy] = (S[buy] || 0) + 1;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 50, 8, 180, .4);
        log(BUY_LOG[buy] || 'Purchased.');
        if (buy === 'qa') retarget();
        if (buy === 'derick' || buy === 'agentic') kick();
      }
    }
    render(true); save();
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
      el.tip.textContent = `${S.backlog ? `Backlog: ${fmt(S.backlog)} · ` : ''}${locPerSec() || (S.derick && !bugs.length) ? fmt(locPerSec() + (bugs.length ? 0 : idleCodeRate())) + ' LOC/s · ' : ''}${S.derick ? 'Lasers armed · ' : ''}Ship at ${fmt(shipGoal())} LOC with ≤3 bugs.`;
    }
    if (!S.open && !force) return;
    let html = '';
    if (S.shop) {
      for (const it of ITEMS) {
        const owned = S[it.id], done = (it.once && owned) || (it.max && owned >= it.max);
        if (done) continue;
        if (it.show()) {
          const c = cost[it.id]();
          html += `<button class="bh-btn bh-item" type="button" data-buy="${it.id}" ${S.cash < c ? 'disabled' : ''}><span>${it.name}</span><small>${it.desc()}</small><em>$${fmt(c)}</em></button>`;
        } else if (it.tease && it.tease()) {
          html += `<button class="bh-btn bh-item tease" type="button" disabled><span>???</span><small>Locked — keep upgrading.</small><em>—</em></button>`;
        }
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
    while (S.backlog > 0 && bugs.length < hardCap()) { S.backlog--; S.spawned--; spawnBug(); }
    if (bugs.length) {
      derickAcc += derickRate() * dt;
      while (derickAcc >= 1) { derickAcc -= 1; fireLasers(); }
    } else {
      derickAcc = 0;
      idleWrite(dt);
    }
    qaRevealAcc += qaRevealPerSec() * dt;
    while (qaRevealAcc >= 1) {
      qaRevealAcc -= 1;
      const b = spawnBug(null, null, { reveal: true, tier: Math.random() < 0.45 ? 3 : 2 });
      if (b) {
        if (quality >= 2) gain(b.x, b.y, 'QA found!', '#ffd166');
        log('QA revealed a bug.');
      } else S.backlog++;
      retarget();
    }
    if (S.autoRb && bugs.length + S.backlog >= 8) rollback(true);
    tryMerges(false);
  }
  function econTick() {
    if (d.hidden) return;
    const t = now();
    econ((t - lastEcon) / 1000);
    lastEcon = t;
    render();
    if (codeDirty && (quality < 2 || !raf)) paintCode();
    if (bugs.length || lasers.length || parts.length) kick();
  }

  function step(dt) {
    if (!S.optedIn || S.paused) return;
    tryMerges(false);
    for (const b of bugs) {
      b.ph += dt * Math.max(2, 8 - Math.min(4, massOf(b) / 2));
      b.turn += (Math.random() - .5) * dt * 6; b.turn *= 0.96; b.a += b.turn * dt * 3;
      const sp = speedOf(b); if (b.boost) b.boost = Math.max(1, b.boost - dt * 6);
      b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
      const m = radius(b);
      if (b.x < m) { b.x = m; b.a = Math.PI - b.a; } else if (b.x > Wd - m) { b.x = Wd - m; b.a = Math.PI - b.a; }
      if (b.y < m + 56) { b.y = m + 56; b.a = -b.a; } else if (b.y > Hd - m) { b.y = Hd - m; b.a = -b.a; }
      b.pop += (1 - b.pop) * Math.min(1, dt * 10);
      b.sq *= Math.pow(0.002, dt); b.flash = Math.max(0, b.flash - dt * 6);
      b.glorp = Math.max(0, b.glorp - dt * 4);
    }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 700 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= dt; if (splats[i].life <= 0) splats.splice(i, 1); }
    for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt * 2.6; if (g.t >= 1) ghosts.splice(i, 1); }
    for (let i = codeBursts.length - 1; i >= 0; i--) { codeBursts[i].life -= dt; if (codeBursts[i].life <= 0) codeBursts.splice(i, 1); }
    for (let i = shields.length - 1; i >= 0; i--) { shields[i].life -= dt; if (shields[i].life <= 0) shields.splice(i, 1); }
    for (let i = merges.length - 1; i >= 0; i--) { merges[i].life -= dt; if (merges[i].life <= 0) merges.splice(i, 1); }
    shake *= Math.pow(0.0005, dt); if (shake < .3) shake = 0;
    flash = Math.max(0, flash - dt * 2.5);
    if (hintUntil && now() > hintUntil) { hint.hidden = true; hintUntil = 0; }
  }

  function drawBug(b) {
    const r = radius(b) * b.pop, w = Math.sin(b.ph) * 0.13;
    const boss = isBoss(b);
    const h = hueOf(b);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.scale(1 + w + b.sq * .5 + b.glorp * .35, 1 - w - b.sq * .4);
    ctx.strokeStyle = `hsla(${h},90%,35%,.9)`; ctx.lineWidth = Math.max(1.2, r * .12); ctx.lineCap = 'round';
    const legs = boss ? 2 : 1;
    for (let k = -legs; k <= legs; k++) { const o = Math.sin(b.ph * 2 + k) * r * .25; ctx.beginPath(); ctx.moveTo(k * r * .4, -r * .6); ctx.lineTo(k * r * .4 + o, -r * 1.15); ctx.moveTo(k * r * .4, r * .6); ctx.lineTo(k * r * .4 - o, r * 1.15); ctx.stroke(); }
    ctx.fillStyle = b.flash > 0 ? '#fff' : (boss ? `hsla(${h},90%,42%,.96)` : `hsla(${h},95%,55%,.93)`);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .85, 0, 0, Math.PI * 2); ctx.fill();
    if (boss) {
      ctx.strokeStyle = 'rgba(255,209,102,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.22, r * .92, 0, 0, Math.PI * 2); ctx.stroke();
      // crown
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.moveTo(-r * .4, -r * .9); ctx.lineTo(-r * .25, -r * 1.35); ctx.lineTo(0, -r * .95); ctx.lineTo(r * .25, -r * 1.35); ctx.lineTo(r * .4, -r * .9); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = `hsla(${h},100%,85%,.55)`; ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .45, r * .22, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${h},90%,35%,1)`; ctx.beginPath(); ctx.moveTo(r * .9, -r * .2); ctx.lineTo(r * 1.5, -r * .6); ctx.moveTo(r * .9, r * .2); ctx.lineTo(r * 1.5, r * .6); ctx.stroke();
    ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(r * .6, -r * .28, r * .17, 0, 7); ctx.arc(r * .6, r * .28, r * .17, 0, 7); ctx.fill();
    ctx.restore();
    if (b.targeted) {
      const tr = radius(b) * 1.55 * b.pop;
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
    for (const m of merges) {
      ctx.globalAlpha = m.life / m.max;
      ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1.2 - m.life / m.max), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const g of ghosts) { const e = 1 - Math.pow(1 - g.t, 3); ctx.globalAlpha = 1 - g.t; ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, g.r * (1 - g.t * .8), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const c of codeBursts) {
      const a = c.life / c.max;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = c.idle ? '#39ff88' : '#39ff88';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(c.idle ? 'draft++' : '{ code++ }', c.x - 28, c.y - 18 * (1 - a));
      if (!c.idle) { ctx.fillStyle = '#3de0ff'; ctx.fillText('bug?', c.x + 8, c.y + 14 * (1 - a)); }
    }
    ctx.globalAlpha = 1;
    for (const b of bugs) drawBug(b);
    for (const z of lasers) {
      const a = z.life / z.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = z.chain ? '#ffd166' : '#39ff88';
      ctx.lineWidth = (z.wide || 2.5) + a * 2;
      // no shadowBlur — it degrades over time on lots of strokes
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      const jx = quality >= 2 ? (Math.random() - .5) * 14 : 0;
      const jy = quality >= 2 ? (Math.random() - .5) * 14 : 0;
      ctx.lineTo((z.x1 + z.x2) / 2 + jx, (z.y1 + z.y2) / 2 + jy); ctx.lineTo(z.x2, z.y2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(z.x2, z.y2, 3 + a * 4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of shields) {
      const a = s.life / s.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (1 - a) * 10, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(255,209,102,${0.15 * a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `hsl(${p.hue},95%,60%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (flash) { ctx.fillStyle = `rgba(61,224,255,${flash * .25})`; ctx.fillRect(-20, -20, Wd + 40, Hd + 40); }
    ctx.restore();
  }

  function applyQuality() { resize(true); }
  function noteFrame(ms) {
    frameTimes.push(ms); if (frameTimes.length > 45) frameTimes.shift();
    if (frameTimes.length < 18) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 21 && quality > 0) {
      if (++qHold > 8) { quality--; qHold = 0; frameTimes.length = 0; applyQuality(); }
    } else if (avg < 13.5 && quality < (RM ? 1 : 3)) {
      if (--qHold < -24) { quality++; qHold = 0; frameTimes.length = 0; applyQuality(); }
    } else if (qHold > 0) qHold--; else if (qHold < 0) qHold++;
  }

  function hasFx() {
    return bugs.length || parts.length || splats.length || lasers.length || ghosts.length || codeBursts.length || shields.length || merges.length || shake || flash;
  }
  function frame() {
    raf = 0;
    const t = now(); let dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (t < freezeUntil) dt = 0;
    step(dt); draw();
    noteFrame(dt * 1000);
    codePaintAge += dt;
    const rainEvery = quality >= 3 ? 0.2 : quality >= 2 ? 0.45 : 1.2;
    if (codeDirty && codePaintAge >= rainEvery) { paintCode(); codePaintAge = 0; }
    const live = S.optedIn && !S.paused && !S.hidden && !d.hidden && hasFx();
    if (live) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      if (S.optedIn && !S.paused) { /* leave last frame; rain may still tick from econ */ }
    }
  }
  function kick() {
    if (!raf && S.optedIn && !S.paused && !S.hidden && !d.hidden) {
      last = now(); raf = requestAnimationFrame(frame);
    }
  }

  function catchUp() {
    if (!S.optedIn || S.paused) return;
    const t0 = hiddenAt || S.t || Date.now();
    const dt = Math.min(900, Math.max(0, (Date.now() - t0) / 1000));
    hiddenAt = 0;
    if (dt > 1 && (locPerSec() || idleCodeRate())) {
      const loc = (locPerSec() + (S.derick ? idleCodeRate() * 0.5 : 0)) * dt;
      S.loc += loc; typeCode(Math.floor(Math.min(400, loc * 8)));
      const nb = loc * bugsPerLoc(); S.backlog += Math.floor(nb); S.spawned += Math.floor(nb);
      const kills = Math.min(S.backlog, Math.floor(derickRate() * dt));
      S.backlog -= kills; S.squashed += kills; S.cash += Math.round(kills * 2 * mult());
      const found = Math.floor(qaRevealPerSec() * dt);
      if (found) S.backlog += found;
      if (dt > 20) log(`While you were away: +${fmt(loc)} LOC, lasers cleared ${fmt(kills)}, QA found ${fmt(found)}.`);
    }
  }

  // boot offline catch-up once
  hiddenAt = S.t || Date.now();
  catchUp();

  function save() {
    S.t = Date.now();
    S.codeIdx = typed % CORPUS_MOD;
    if (S.optedIn && !S.paused) {
      S.bugs = bugs.slice(0, hardCap()).map(b => ({
        tier: b.tier, mass: massOf(b), hp: b.hp, x: +(b.x / Math.max(1, Wd)).toFixed(4), y: +(b.y / Math.max(1, Hd)).toFixed(4),
        a: +b.a.toFixed(2), turn: 0, targeted: !!b.targeted
      }));
    }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  }

  addEventListener('pagehide', () => { save(); stopLoops(); });
  addEventListener('pageshow', () => { if (S.optedIn && !S.paused) { catchUp(); startLoops(); } });
  addEventListener('bh-save', save);
  d.addEventListener('visibilitychange', () => {
    if (d.hidden) { hiddenAt = Date.now(); save(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else { catchUp(); lastEcon = now(); if (S.optedIn && !S.paused) startLoops(); }
  });

  resize(true);
  render(true);
  if (S.optedIn && !S.paused) startLoops();

  function forceSwarm(n, opts = {}) {
    const mass = opts.mass || 1, tier = opts.tier || 1;
    for (let i = 0; i < n; i++) {
      const x = 20 + (i % 20) * (Wd / 22), y = 80 + Math.floor(i / 20) * 36;
      const b = mkBug(tier, x, y, 0, mass);
      b.pop = 1;
      bugs.push(b);
    }
    tryMerges(true);
    if (opts.kick !== false) kick();
    return bugs.length;
  }
  // Headless-safe frame-cost probe: times step+draw without waiting on rAF.
  function bench(n = 60) {
    const frames = [];
    const prevPaused = S.paused;
    S.paused = false;
    mergeLock = true;
    const cols = Math.max(1, Math.ceil(Math.sqrt(bugs.length)));
    bugs.forEach((b, i) => {
      b.x = 40 + (i % cols) * Math.max(40, (Wd - 80) / cols);
      b.y = 90 + Math.floor(i / cols) * 70;
      b.pop = 1; b.glorp = 0; b.boost = 0;
    });
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      step(1 / 60);
      draw();
      frames.push(performance.now() - t0);
    }
    mergeLock = false;
    S.paused = prevPaused;
    const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
    return { n: frames.length, avg, fps: avg > 0 ? 1000 / avg : 999, bugs: bugs.length, quality, cap: hardCap() };
  }

  W.__bugHunt = {
    S, get bugs() { return bugs; },
    spawnBug, squash, addCode, rollback, ship, fireLasers, econ, optIn, pauseGame, quitGame,
    isBoss, massOf, radius, tryMerges, clink, laserHit, idleWrite, forceSwarm, bench,
    softCap, hardCap, BOSS_MASS, ITEMS,
    get quality() { return quality; },
    setQuality(q) { quality = Math.max(0, Math.min(3, q | 0)); applyQuality(); },
    stats() {
      return {
        bugs: bugs.length, backlog: S.backlog, parts: parts.length, lasers: lasers.length,
        splats: splats.length, ghosts: ghosts.length, bursts: codeBursts.length, shields: shields.length,
        merges: merges.length, typed, raf: !!raf, econId: !!econId, saveId: !!saveId,
        quality, dpr: DPR, fps: frameTimes.length ? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length) : 0,
        shopItems: ITEMS.filter(i => i.show()).map(i => i.id),
        teasers: ITEMS.filter(i => !i.show() && i.tease && i.tease()).map(i => i.id),
      };
    },
    reset() { stopLoops(); localStorage.removeItem(KEY); location.reload(); }
  };
})();
