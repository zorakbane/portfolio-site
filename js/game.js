/* Bug Hunt — idle/clicker for derickjanssen.com.
   Opt-in → click empty space to write LOC → bugs hatch → squash for Commits.
   Hire Derick (one roaming laser), stackable agent turrets, tools, Agentic Workflow
   (escorts + pulses that stack Derick's power; regular agents never bomb),
   Sub-Agent Workflow (the only bombers), Movement Tuning / Multiplayer Sync,
   command mode at 10 agents (faster pulses, no parking), rollback, Ship finale + prestige.
   Click DJ for hearts / Heartbeat buff. Play Space after 25 player actions.
   Persist in localStorage. Never preventDefault. */
(() => {
  if (window.__bugHunt && !window.__bugHunt.__booting) return;
  window.__bugHunt = { __booting: true };
  const KEY = 'dj-bughunt-v3';
  const SAVE_KEYS = [KEY, 'dj-bughunt-v2', 'dj-bughunt-v1'];
  let suppressSave = false;
  const d = document, W = window;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();
  let last = now(), raf = 0, dirty = true, lastShop = '', hintUntil = 0;
  let pulseAcc = 0, bossAcc = 0, hatchAcc = 0, idleAcc = 0, clearAcc = 0, qaRevealAcc = 0;
  let quality = RM ? 1 : 3, qHold = 0, econId = 0, saveId = 0, lastEcon = now();
  let spawnQuietUntil = 0;
  let escortPhase = 0;
  const PLAY_UNLOCK = 25;
  let playScrollX = 0, playScrollY = 0;
  let shipBoss = null;
  let djPokes = 0, konamiArmed = false, blameReady = false;
  let hbTimes = [];
  let heartbeatUntil = 0, heartbeatCdUntil = 0;
  const HEARTS = [];
  let heartN = 0;
  let heartSprite = null;
  const frameTimes = [];
  const spawnLog = [];
  const hatchQ = [];
  let hatchWait = 0, hatchReadyAt = 0;
  let lastCodePaint = 0, lastHudAt = 0, lastHbHud = 0, lastShipBar = 0;
  const _liveNodes = [];
  const textSprites = new Map();

  const DEF = {
    v: 3, optedIn: false, paused: false,
    loc: 0, commits: 0, squashed: 0, spawned: 0, debt: 0,
    derick: 0, agents: 0, agentic: 0, tests: 0, ci: 0, qa: 0,
    profiler: 0, collision: 0, movement: 0, sync: 0, rapid: 0,
    subagent: 0, rollback: 0, autoRb: 0, ships: 0,
    shop: false, open: true, hidden: false,
    bugs: [], backlog: 0, t: Date.now(), rbAt: 0, intro: false, hintSeen: false, codeIdx: 0,
    lastBoss: null,
    clicks: 0, playSpace: false, playUnlocked: false,
    prestige: 0,
    shipPending: null
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
      subagent: 0, rollback: v2.rollback ? 1 : 0, autoRb: v2.autoRb ? 1 : 0, ships: v2.ships || 0,
      shop: !!v2.shop, open: v2.open !== false, hidden: !!v2.hidden,
      bugs: Array.isArray(v2.bugs) ? v2.bugs.slice(0, 20).map(b => ({
        tier: (b.boss || (b.mass >= 8)) ? 4 : Math.min(3, Math.max(1, b.tier || 1)),
        x: b.x, y: b.y, a: b.a, targeted: !!b.targeted,
        boss: !!(b.boss || (b.mass >= 8)), name: b.name || null,
        hp: b.hp, maxHp: b.maxHp
      })) : [],
      backlog: v2.backlog || 0, t: v2.t || Date.now(), rbAt: v2.rbAt || 0,
      intro: !!v2.intro, hintSeen: !!v2.hintSeen, codeIdx: v2.codeIdx || 0,
      lastBoss: v2.lastBoss || null,
      clicks: v2.clicks || 0, playSpace: !!v2.playSpace, playUnlocked: !!v2.playUnlocked,
      prestige: v2.prestige || v2.ships || 0
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
  if (!S.prestige && S.ships) S.prestige = S.ships;

  // ---------- economy ----------
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
  const mult = () => 1 + (S.prestige || S.ships || 0) * 0.5;
  const costScale = () => (S.rapid ? 0.78 : 1);
  const bugsPerLoc = () => 0.38 * Math.pow(0.82, Math.min(5, S.tests)) * (S.ci ? 0.85 : 1);
  const shipGoal = () => Math.round(1600 * Math.pow((S.prestige || 0) + 1, 1.55) * Math.pow(1.08, S.prestige || 0));
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
    if (commandMode()) r = Math.min(r, 160); // tighter focus, not a park
    return r;
  };
  const derickDps = () => 2 / derickKillTime(); // HP/s vs small
  const agentDps = () => 1; // 2s on small (HP=2)
  const agentRange = () => (COARSE ? 78 : 92) + (S.profiler ? 22 : 0);
  const chaseSpeed = () => 95 + (S.movement ? 70 : 0) + S.ships * 12;
  const qaRevealPerSec = () => (S.qa ? 0.55 * (S.ci ? 1.6 : 1) : 0);
  const IDLE_DERRICK = 1.4;
  const IDLE_AGENT = 0.35;
  const IDLE_AGENTIC = 0.60; // added to Derick's draft rate when Agentic is owned
  const IDLE_DEBT = 0.045; // was 0.2; tuned down so 5× idle LOC does not refill the board
  const HATCH_MIN = 0.18;
  const HATCH_SPAN = 0.17; // jittered 180–350ms between automatic hatches
  const HB_CLICKS = 5;
  const HB_WINDOW = 5000;
  const HB_DURATION = 60000;
  const HB_COOLDOWN = 60000;
  const HB_MULT = 5;
  const SUB_ORBIT = 16;
  const SUB_RESPAWN = 4;
  const HEART_DJ_SCALE = 1.8;
  const SHIP_NODES = 7;
  // Named so they are easy to swap. Red is reserved for bosses.
  const LASER_COLOR = {
    derick: 'rgba(57,255,136,0.85)',   // site accent green
    agent: 'rgba(62,198,255,0.92)',    // bright electric blue
    buffed: 'rgba(255,177,66,0.95)',   // orange/amber
  };
  function derickScale() { return (COARSE || Wd < 700) ? 2.0 : 2.4; }
  function derickRadius() { return 6 * derickScale(); }
  function derickCombatRange() { return commandMode() ? Math.min(derickRange(), 150) : derickRange(); }
  function derickCombatDps() { return derickDps() * (S.ci ? 1.1 : 1); }
  function pulseBuffActive(a) {
    return !!(a && a.buffUntil && a.buffUntil > now());
  }
  function agentBuffed(a) {
    if (!a) return false;
    if (pulseBuffActive(a) || a.chasing) return true; // pulsed: any range
    if (!S.derick || !derickEnt) return false;
    return Math.hypot(a.x - derickEnt.x, a.y - derickEnt.y) <= derickCombatRange();
  }
  function escorting(a) { return !!(S.agentic && a && !a.chasing); }
  function escortCount() {
    let n = 0;
    for (const a of agents) if (!a.chasing) n++;
    return n;
  }
  function escortRadius(n) {
    n = Math.max(1, n == null ? agents.length : n);
    return Math.min((COARSE || Wd < 700) ? 72 : 88, 38 + Math.sqrt(n) * 14);
  }
  function escortSlot(i, n, phase) {
    n = Math.max(1, n == null ? agents.length : n);
    const ang = (i / n) * Math.PI * 2 + (phase == null ? escortPhase : phase);
    const r = escortRadius(n);
    const cx = derickEnt ? derickEnt.x : Wd * 0.5;
    const cy = derickEnt ? derickEnt.y : Hd * 0.4;
    return { x: clamp(cx + Math.cos(ang) * r, 24, Math.max(25, Wd - 24)), y: clamp(cy + Math.sin(ang) * r, 64, Math.max(65, Hd - 24)) };
  }
  const ESCORT_AURA = 0.25; // modest share of Derick DPS while holding formation
  const MISSILE_BOSS_FRAC = 0.35; // one blast never deletes a full-health boss
  const PULSE_BUFF = 5000; // ms a pulse stacks Derick's full DPS on an escort
  function missileSpeed0() { return 220 + (S.movement ? 50 : 0) + S.ships * 8; }
  function missileSpeedMax() { return 520 + (S.movement ? 90 : 0) + S.ships * 16; }
  function missileRadius() {
    return Math.min(150, ((COARSE || Wd < 700) ? 54 : 68) + derickCombatDps() * 12);
  }
  function missileDamage() { return 3.6 * derickCombatDps(); }
  function agentCombatDps(a) {
    const base = agentDps() * (S.ci ? 1.08 : 1);
    // Outbound bombs (sub-agents only) do not also fire a stacked laser.
    if (a && a.missile && (a.missilePhase === 'out' || a.isSub)) return base;
    if (!agentBuffed(a)) return base;
    // A pulse stacks Derick's full combat DPS on the agent's own laser.
    if (pulseBuffActive(a) || (a && a.chasing && !a.missile)) return base + derickCombatDps();
    // Escorts live inside the aura. A modest +25% of Derick's combat DPS each —
    // not a full extra Derick per agent. Static turrets (before Agentic) still
    // get the full personal add because pulses do not exist yet.
    if (escorting(a)) {
      // Heartbeat upgrades the usual modest escort share to Derick's full DPS
      // for anyone actually standing inside his range.
      if (heartbeatActive() && agentBuffed(a)) return base + derickCombatDps();
      return base + derickCombatDps() * ESCORT_AURA;
    }
    return base + derickCombatDps();
  }

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
    subagent: () => Math.ceil(380 * costScale()),
    rollback: () => Math.ceil(400 * costScale()),
    autoRb: () => Math.ceil(800 * costScale()),
  };

  // Progression gate: only the next unlock appears (Hire agent stays buyable after the first).
  // Order: Derick → agent → tests (1+) → profiler → collision → ci → qa →
  // rapid → agentic (requires 5 agents) → movement → sync → subagent → rollback → autoRb → Ship.
  // Movement Tuning and Multiplayer Sync both require chasing/pulses, so they come
  // after Agentic Workflow (the upgrade that actually makes agents move).
  // Pulses buff escorts until Sub-Agent Workflow, which is the only source of bombs.
  const SEQ = ['tests', 'profiler', 'collision', 'ci', 'qa', 'rapid', 'agentic', 'movement', 'sync', 'subagent', 'rollback', 'autoRb'];
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
    { id: 'agent', name: 'HIRE AGENT', desc: () => S.subagent ? `Escort · orbiting sub-agent bomber. (${S.agents})` : S.agentic ? `Escort · fires from Derick's ring. (${S.agents})` : `Static turret · 2s small kills. (${S.agents})`, show: () => S.derick && (S.agents < 1 ? nextUnlock() === 'agent' : true) },
    { id: 'tests', name: 'UNIT TESTS', desc: () => `Fewer bugs per LOC. (${S.tests}/5)`, max: 5, show: () => nextUnlock() === 'tests' || (S.tests >= 1 && S.tests < 5 && ['profiler', 'collision', 'ci', 'qa'].includes(nextUnlock())) },
    { id: 'profiler', name: 'PROFILER', desc: () => 'Reveal hatching bugs · larger agent radius.', once: true, show: () => nextUnlock() === 'profiler' },
    { id: 'collision', name: 'COLLISION EDITOR', desc: () => 'Agent lasers pierce to a second bug.', once: true, show: () => nextUnlock() === 'collision' },
    { id: 'movement', name: 'MOVEMENT TUNING', desc: () => 'Pulses arrive faster, and bombs launch and fly faster.', once: true, show: () => nextUnlock() === 'movement' },
    { id: 'ci', name: 'CI PIPELINE', desc: () => 'Faster lasers · fewer bugs pre-merge.', once: true, show: () => nextUnlock() === 'ci' },
    { id: 'qa', name: 'QA', desc: () => 'Reveals more bugs & marks the largest (incl. bosses) to die without splitting.', once: true, show: () => nextUnlock() === 'qa' },
    { id: 'rapid', name: 'RAPID PROTOTYPE', desc: () => 'Tool builds cost ~22% less.', once: true, show: () => nextUnlock() === 'rapid' },
    { id: 'sync', name: 'MULTIPLAYER SYNC', desc: () => 'One pulse chains to several agents.', once: true, show: () => nextUnlock() === 'sync' },
    { id: 'agentic', name: 'AGENTIC WORKFLOW', desc: () => 'Derick gathers escorts and pulses them with his full power.', once: true, show: () => nextUnlock() === 'agentic' && S.agents >= 5 },
    { id: 'subagent', name: 'SUB-AGENT WORKFLOW', desc: () => 'Each escort grows a sub-agent bomber. Only subs fly out as bombs; escorts stay in the ring.', once: true, show: () => nextUnlock() === 'subagent' },
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
        <span class="bh-stat bh-hb" data-k="hbwrap" hidden title="Heartbeat: DJ writes 5× LOC and nearby agents share his full aura."><i>♥</i> <span data-k="hb">60s</span></span>
      </div>
      <button class="bh-btn" type="button" data-act="pause" title="Pause">❚❚</button>
      <button class="bh-btn" type="button" data-act="rb" hidden title="Rollback">⟲</button>
      <button class="bh-btn bh-playbtn" type="button" data-act="playspace" hidden title="Play Space">Play Space</button>
      <button class="bh-btn" type="button" data-act="min" aria-label="Minimize Bug Hunt">–</button>
      <button class="bh-btn" type="button" data-act="quit" aria-label="Quit Bug Hunt">✕</button>
    </div>
    <div class="bh-body"><p class="bh-log" aria-live="polite"></p><p class="bh-tip"></p><div class="bh-shop"></div>
    <div class="bh-footer"><button class="bh-btn bh-reset" type="button" data-act="reset">Reset progress</button></div></div>`;
  const hint = d.createElement('div'); hint.id = 'bh-hint'; hint.hidden = true;
  hint.textContent = (COARSE ? 'Tap' : 'Click') + ' empty space to write code… uh oh, bugs.';
  const playScene = d.createElement('div');
  playScene.id = 'bh-playscene';
  playScene.hidden = true;
  const playMark = d.createElement('div');
  playMark.id = 'bh-playmark';
  playMark.hidden = true;
  playMark.setAttribute('aria-hidden', 'true');
  playMark.innerHTML = '<span class="bh-play-derick">Derick</span><span class="bh-play-janssen"></span>';
  const promote = d.createElement('div');
  promote.id = 'bh-promote';
  promote.hidden = true;
  promote.textContent = 'Promoted: Play Space unlocked';
  const shipBar = d.createElement('div');
  shipBar.id = 'bh-shipbar';
  shipBar.hidden = true;
  shipBar.innerHTML = '<div class="bh-shipname"></div><div class="bh-shiptrack"><i></i></div><div class="bh-shiphp"></div>';
  const shipWarn = d.createElement('div');
  shipWarn.id = 'bh-shipwarn';
  shipWarn.hidden = true;
  const shipped = d.createElement('div');
  shipped.id = 'bh-shipped';
  shipped.hidden = true;
  shipped.innerHTML = '<div class="bh-shipped-card">'
    + '<div class="bh-shipped-banner" data-k="shipped-banner">SHIPPED v1.0!</div>'
    + '<ul class="bh-shipped-stats">'
    + '<li>Time to kill <b data-k="shipped-ttk">0s</b></li>'
    + '<li>LOC <b data-k="shipped-loc">0</b></li>'
    + '<li>Bugs squashed <b data-k="shipped-squash">0</b></li>'
    + '</ul>'
    + '<button type="button" class="bh-btn bh-shipped-go" data-act="confirm-ship">Ship 2.0?</button>'
    + '</div>';
  d.body.append(codeCv, cv, playScene, playMark, ready, hud, hint, promote, shipBar, shipWarn, shipped);
  const $ = s => hud.querySelector(s);
  const el = {
    loc: $('[data-k=loc]'), bugs: $('[data-k=bugs]'), commits: $('[data-k=commits]'),
    pause: $('[data-act=pause]'), rb: $('[data-act=rb]'), min: $('[data-act=min]'), quit: $('[data-act=quit]'),
    play: $('[data-act=playspace]'),
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
    // Coarse/phone: ~5Hz. Desktop: ~7Hz. Keep dirty so a skipped frame paints later.
    if (!force && now() - lastCodePaint < (COARSE ? 200 : 140)) return;
    codeDirty = false;
    lastCodePaint = now();
    codeCtx.clearRect(0, 0, Wd, Hd);
    if (!S.optedIn || S.paused || typed <= 0) return;
    const fs = COARSE ? 11 : 12;
    const lh = fs + 3;
    const cols = Math.max(1, Math.floor(Wd / (fs * 0.62)));
    const rows = Math.ceil(Hd / lh) + 1;
    const budget = COARSE ? Math.min(cols * rows, 960) : Math.min(cols * rows, 2800);
    const maxChars = Math.min(typed, budget);
    codeCtx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    codeCtx.fillStyle = 'rgba(57,255,136,0.11)';
    codeCtx.textBaseline = 'top';
    let i = Math.max(0, (typed - maxChars) % CORPUS.length);
    let drawn = 0, x = 8, y = 8;
    let line = '', lx = 8, ly = 8;
    const cw = fs * 0.62;
    const flush = () => {
      if (line) { codeCtx.fillText(line, lx, ly); line = ''; }
    };
    while (drawn < maxChars && y < Hd) {
      const ch = CORPUS[i % CORPUS.length];
      i++;
      if (ch === '\n' || x > Wd - 20) {
        flush();
        x = 8; y += lh;
        lx = 8; ly = y;
        if (ch === '\n') { drawn++; continue; }
      }
      if (!line) { lx = x; ly = y; }
      line += ch;
      x += cw;
      drawn++;
    }
    flush();
    if (!RM && (Math.floor(now() / 400) % 2)) {
      codeCtx.fillStyle = 'rgba(61,224,255,0.35)';
      codeCtx.fillRect(x, y, 7, fs);
    }
  }

  function dprCapFor(q, coarse) {
    let capD = q >= 3 ? 2 : q >= 2 ? 1.5 : q >= 1 ? 1 : 0.7;
    if (coarse) capD = Math.min(capD, q >= 3 ? 1.5 : q >= 2 ? 1.25 : capD);
    return capD;
  }
  function currentDpr() {
    return Math.min(dprCapFor(quality, COARSE), W.devicePixelRatio || 1);
  }
  function resize(force) {
    const next = currentDpr();
    Wd = innerWidth; Hd = innerHeight;
    if (!force && next === DPR && cv.width === Math.floor(Wd * next)) return;
    DPR = next;
    textSprites.clear();
    for (const c of [cv, codeCv]) { c.width = Wd * DPR; c.height = Hd * DPR; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    codeCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Keep entities on-screen
    if (derickEnt) { derickEnt.x = clamp(derickEnt.x, 20, Wd - 20); derickEnt.y = clamp(derickEnt.y, 60, Hd - 20); }
    for (const a of agents) {
      a.homeX = clamp(a.homeX, 24, Wd - 24); a.homeY = clamp(a.homeY, 70, Hd - 24);
      if (!a.chasing && !a.missile && !S.agentic) { a.x = a.homeX; a.y = a.homeY; }
    }
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
  const PRESTIGE_BOSSES = [
    'Day-One Patch', 'Server Queue', 'Desync Storm', 'Shader Compile Stutter',
    'Crunch Time', 'Cert Failure', 'Save Corruption', 'Loot Box Backlash'
  ];
  function prestigeBossPool(prestige) {
    const p = prestige == null ? (S.prestige || 0) : prestige;
    if (p < 1) return [];
    return PRESTIGE_BOSSES.slice(0, Math.min(PRESTIGE_BOSSES.length, p * 2));
  }
  function pickBossName() {
    if ((S.prestige >= 1 || blameReady) && Math.random() < (blameReady ? 0.35 : 0.08)) {
      blameReady = false;
      return 'git blame';
    }
    const extra = prestigeBossPool();
    const all = BOSS_NAMES.concat(extra);
    const pool = all.filter(n => n !== S.lastBoss);
    const src = pool.length ? pool : all;
    return src[Math.floor(Math.random() * src.length)];
  }
  const cap = () => (COARSE || Wd < 700 ? 8 : 15);
  function isBoss(b) { return !!(b && (b.boss || b.tier >= 4)); }
  function noteSpawn(src) {
    spawnLog.push({ src, t: now(), n: bugs.length });
    if (spawnLog.length > 80) spawnLog.shift();
  }
  function quietFor(sec) {
    if (sec <= 0) { spawnQuietUntil = 0; return; }
    spawnQuietUntil = Math.max(spawnQuietUntil, now() + sec * 1000);
  }
  function canAutoSpawn() { return !S.shipPending && now() >= spawnQuietUntil; }
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
  const parts = [], splats = [], lasers = [], ghosts = [], codeBursts = [], pulses = [], hatches = [], shields = [], explosions = [], flashes = [];
  let partN = 0;
  let shake = 0, freezeUntil = 0, flash = 0;
  const SPARK = {};
  function sparkSprite(color) {
    if (SPARK[color]) return SPARK[color];
    const c = d.createElement('canvas'); c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(8, 8, 0, 8, 8, 7);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(8, 8, 7, 0, 7); x.fill();
    SPARK[color] = c; return c;
  }
  function sparkColor(hue) {
    const h = ((hue % 360) + 360) % 360;
    if (h < 25 || h > 330) return 'rgba(255,90,90,0.95)';
    if (h < 70) return 'rgba(255,177,66,0.95)';
    if (h < 160) return 'rgba(57,255,136,0.95)';
    if (h < 230) return 'rgba(61,224,255,0.95)';
    return 'rgba(255,80,160,0.95)';
  }
  function partCap() { return quality >= 3 ? 140 : quality >= 2 ? 70 : quality >= 1 ? 28 : 0; }

  function mkBug(tier, x, y, a, opts = {}) {
    a = a ?? Math.random() * Math.PI * 2;
    const boss = tier >= 4;
    return {
      tier, x, y, ox: x, oy: y, a, ph: Math.random() * 6, pop: 0.2, sq: 0, flash: 0, turn: 0,
      targeted: false, hp: HP[tier] || 2, maxHp: HP[tier] || 2,
      boss, name: opts.name || (boss ? pickBossName() : null),
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
    if (b.boss && b.name) S.lastBoss = b.name;
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
      enqueueDebt('click-debt');
    } else {
      // ~1 bug per 8 LOC automatically, not 1:1 with kills
      S.debt += n * bugsPerLoc() * 0.32;
      enqueueDebt('debt');
    }
  }

  function ensureDerick() {
    if (!S.derick) { derickEnt = null; return; }
    if (!derickEnt) {
      derickEnt = { x: Wd * 0.2, y: Hd * 0.35, tx: Wd * 0.2, ty: Hd * 0.35, target: null, aimX: 0, aimY: 0, beam: 0, idleAcc: Math.random() * 0.85, idlePhase: Math.random() };
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
        target: null, chaseRoot: null, chasing: false, beam: 0, aimX: hx, aimY: hy, pierce: null, idleAcc: Math.random() * 0.85, idlePhase: Math.random()
      });
    }
    while (agents.length > S.agents) agents.pop();
    if (S.subagent) ensureSubs();
    else for (const a of agents) a.sub = null;
  }
  function mkSub(agent, i) {
    return {
      parent: agent, isSub: true,
      x: agent.x + SUB_ORBIT, y: agent.y,
      ang: (i || 0) * 1.7 + Math.random(),
      state: 'orbit', cd: 0,
      vx: 0, vy: 0, trail: [], flight: 0,
      missile: false, missilePhase: null, chasing: false,
      chaseRoot: null, target: null,
      reserved: null, reservedAmt: 0,
      idleAcc: Math.random() * 0.85, idlePhase: Math.random(), pop: 1
    };
  }
  function ensureSubs() {
    if (!S.subagent) return;
    agents.forEach((a, i) => { if (!a.sub) a.sub = mkSub(a, i); });
  }
  function commandMode() { return S.derick && S.agents >= 10; }

  // ---------- juice ----------
  function burst(x, y, hue, n, spd = 260, life = 0.6) {
    if (quality < 1 || RM) n = Math.min(n, quality < 1 ? 0 : 3);
    else n = Math.ceil(n * (quality >= 3 ? 0.7 : quality >= 2 ? 0.4 : 0.22));
    const capP = partCap();
    for (let i = 0; i < n; i++) {
      if (partN >= capP) break;
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random());
      let p = parts[partN];
      if (!p) { p = {}; parts[partN] = p; }
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 80;
      p.life = life; p.max = life;
      p.r = 1.5 + Math.random() * 2.5;
      p.hue = hue + (Math.random() - .5) * 30;
      p.color = sparkColor(p.hue);
      partN++;
    }
  }
  function heartCap() { return quality >= 3 ? 36 : quality >= 2 ? 18 : quality >= 1 ? 8 : 0; }
  function getHeartSprite() {
    if (heartSprite) return heartSprite;
    const c = d.createElement('canvas'); c.width = 20; c.height = 20;
    const x = c.getContext('2d');
    x.fillStyle = '#ff3d81';
    pathHeart(x, 10, 10, 6.8);
    x.fill();
    x.fillStyle = 'rgba(255,245,248,0.55)';
    pathHeart(x, 10, 9.3, 4.0);
    x.fill();
    heartSprite = c;
    return c;
  }
  function spitHearts(x, y) {
    let n = quality >= 3 ? 7 : quality >= 2 ? 5 : quality >= 1 ? 3 : 0;
    if (RM) n = Math.min(n, 2);
    const capH = heartCap();
    for (let i = 0; i < n; i++) {
      if (heartN >= capH) break;
      let h = HEARTS[heartN];
      if (!h) { h = {}; HEARTS[heartN] = h; }
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
      const v = 90 + Math.random() * 150;
      h.x = x; h.y = y;
      h.vx = Math.cos(a) * v;
      h.vy = Math.sin(a) * v - 50;
      h.life = 0.65 + Math.random() * 0.3;
      h.max = h.life;
      h.r = 5 + Math.random() * 5;
      h.spin = (Math.random() - 0.5) * 7;
      h.rot = Math.random() * 6;
      heartN++;
    }
  }
  function boomFlash(x, y, str) {
    if (RM || quality < 1) return;
    flashes.push({ x, y, r: 70 + str * 50, life: 0.16, max: 0.16 });
    if (flashes.length > 6) flashes.shift();
    if (quality >= 3) flash = Math.max(flash, Math.min(0.22, str * 0.35));
  }
  function hitStop(ms) {
    if (RM || quality < 2) return;
    const cap = quality >= 3 ? 26 : 16;
    freezeUntil = Math.max(freezeUntil, now() + Math.min(ms, cap));
  }
  let gains = 0;
  function gain(x, y, text, color) {
    if (gains > (quality >= 3 ? 8 : 4)) return;
    if (quality < 1) return;
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
  function sendPulse(from, agent, target, reservedAmt) {
    pulses.push({
      x: from.x, y: from.y, tx: agent.x, ty: agent.y,
      agent, target, reservedAmt: reservedAmt || 0,
      life: 0.45, max: 0.45, arrived: false, handed: false
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
    if (!auto) { hitStop(b.boss ? 50 : b.tier === 3 ? 32 : 20); punch(b.tier * 2.2); }
    if (!auto || quality >= 2) gain(b.x, b.y - R[b.tier], `+${val}`, auto ? '#3de0ff' : (b.targeted ? '#ffd166' : null));
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
        if (ag.chaseRoot === b) {
          ag.chaseRoot = null; ag.target = null;
          if (!ag.missile) ag.chasing = false;
        }
      }
    } else {
      for (const ag of agents) {
        if (ag.chaseRoot === b) {
          ag.chaseRoot = null; ag.target = null;
          if (!ag.missile) ag.chasing = false;
        }
      }
    }
    if (!S.shop && S.squashed >= 5) openShop();
    mergeIfOver();
    retargetQA();
    kick(); dirty = true;
  }

  function damageBug(b, dps, dt, attacker) {
    if (!b || b.hatching) return;
    if (b.shipNode) {
      if (b.hp <= 0) return;
      b.hp -= dps * dt;
      b.flash = Math.max(b.flash || 0, 0.55);
      if (attacker) { attacker.beam = 1; attacker.aimX = b.x; attacker.aimY = b.y; }
      syncShipHp();
      if (b.hp <= 0) destroyShipNode(b);
      return;
    }
    if (b.ship) {
      const n = pickShipNode(attacker ? attacker.x : b.x, attacker ? attacker.y : b.y);
      if (n) { damageBug(n, dps, dt, attacker); return; }
      return;
    }
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
    // negligible chip that can never finish the boss / a ship node
    if (b.ship && !b.shipNode) {
      /* hull clink is visual only — HP lives on the nodes */
    } else if (b.hp > 1) {
      b.hp = Math.max(1, b.hp - 0.05);
      if (b.shipNode) syncShipHp();
    }
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
    for (const a of agents) {
      a.chasing = false; a.missile = false; a.missilePhase = null;
      a.target = null; a.chaseRoot = null; a.vx = 0; a.vy = 0; a.trail = [];
      a.x = a.homeX; a.y = a.homeY;
    }
    flash = 1; punch(8);
    log(`⟲ Rolled back${auto ? ' (auto)' : ''}. ${n} bugs never happened. +${fmt(gainC)} commits`);
    kick(); dirty = true;
  }
  function finaleDpsEstimate() {
    const dDps = derickCombatDps();
    const n = Math.max(0, S.agents);
    const baseA = agentDps() * (S.ci ? 1.08 : 1);
    const one = baseA + (S.agentic ? dDps * ESCORT_AURA : (S.derick ? dDps : 0));
    const pulseRate = S.agentic
      ? ((commandMode() ? 0.55 : 0.35) * (1 + S.sync * 0.5) * (S.sync ? Math.min(3, Math.max(1, n)) : 1))
      : 0;
    return dDps + one * n * 0.55 + pulseRate * missileDamage() * 0.85;
  }
  function finaleMaxHp() { return Math.max(500, finaleDpsEstimate() * 106); }
  function shipName() { return `Ship v${(S.prestige || 0) + 1}.0`; }
  function syncShipBar(force) {
    const on = !!(shipBoss && shipBoss.hp > 0);
    if (!force && now() - lastShipBar < 200 && shipBar.hidden === !on) return;
    lastShipBar = now();
    shipBar.hidden = !on;
    if (!on) return;
    const name = shipBar.querySelector('.bh-shipname');
    const fill = shipBar.querySelector('i');
    const hp = shipBar.querySelector('.bh-shiphp');
    const pct = Math.max(0, shipBoss.hp / shipBoss.maxHp);
    if (name) name.textContent = shipBoss.name || shipName();
    if (fill) fill.style.transform = `scaleX(${pct})`;
    if (hp) hp.textContent = `${Math.max(0, Math.ceil(shipBoss.hp))} / ${Math.ceil(shipBoss.maxHp)}`;
    if (!hud.hidden) {
      const box = hud.getBoundingClientRect();
      const raise = Math.max(0, (W.innerHeight || Hd) - box.top) + 10;
      shipBar.style.bottom = raise + 'px';
    } else {
      shipBar.style.bottom = '';
    }
  }
  function showShipWarn(text) {
    shipWarn.textContent = text;
    shipWarn.hidden = false;
    shipWarn.classList.remove('in');
    void shipWarn.offsetWidth;
    shipWarn.classList.add('in');
    setTimeout(() => { shipWarn.hidden = true; shipWarn.classList.remove('in'); }, 2800);
  }
  function liveShipNodes() {
    _liveNodes.length = 0;
    if (shipBoss && shipBoss.nodes) {
      for (const n of shipBoss.nodes) if (n && n.hp > 0 && !n._dead) _liveNodes.push(n);
    }
    return _liveNodes;
  }
  function syncShipNodePositions() {
    const s = shipBoss;
    if (!s || !s.nodes) return;
    for (let i = 0; i < s.nodes.length; i++) {
      const n = s.nodes[i];
      n.x = s.x + (-s.w * 0.28 + i * s.w * 0.093);
      n.y = s.y - s.h * 0.12;
    }
  }
  function makeShipNodes(s) {
    if (!s) return;
    const share = s.maxHp / SHIP_NODES;
    s.nodes = [];
    for (let i = 0; i < SHIP_NODES; i++) {
      s.nodes.push({
        i, ship: true, shipNode: true, boss: true, hatching: false, tier: 5,
        name: (s.name || 'Ship') + ' hardpoint',
        x: s.x, y: s.y, r: 16,
        hp: share, maxHp: share,
        flash: 0, _pending: 0, _dead: false
      });
    }
    syncShipNodePositions();
  }
  function syncShipHp() {
    if (!shipBoss || !shipBoss.nodes) return;
    shipBoss.hp = shipBoss.nodes.reduce((sum, n) => sum + Math.max(0, n.hp || 0), 0);
  }
  function destroyShipNode(n) {
    if (!n || n._dead) return;
    n._dead = true;
    n.hp = 0;
    n.flash = 1;
    if (!RM) {
      punch(quality >= 3 ? 4 : quality >= 2 ? 3 : 2);
      burst(n.x, n.y, 190, quality >= 3 ? 14 : quality >= 2 ? 8 : 4, 280, 0.55);
      burst(n.x, n.y, 42, quality >= 2 ? 6 : 0, 200, 0.4);
      boomFlash(n.x, n.y, 0.75);
      if (quality >= 2) hitStop(16);
    }
    gain(n.x, n.y - 16, 'DOWN', '#3de0ff');
    syncShipHp();
    if (!liveShipNodes().length) winFinale();
  }
  function nodeFocus(n) {
    if (!n) return 0;
    let c = (n._pending || 0) / Math.max(1, n.hp || 1);
    if (derickEnt && derickEnt.target === n) c += 1;
    for (const a of agents) {
      if (a.target === n || a.chaseRoot === n) c += 1;
      if (a.sub && (a.sub.target === n || a.sub.chaseRoot === n)) c += 1;
    }
    return c;
  }
  function pickShipNode(fromX, fromY, opts = {}) {
    const nodes = liveShipNodes();
    let best = null, bestKey = 1e15;
    for (const n of nodes) {
      if (opts.uncovered && targetHasCover(n)) continue;
      const dist = Math.hypot(n.x - (fromX || 0), n.y - (fromY || 0));
      const key = nodeFocus(n) + dist * 0.0001;
      if (key < bestKey) { best = n; bestKey = key; }
    }
    return best;
  }
  function canReachShip(x, y, range) {
    return !!(shipBoss && shipBoss.hp > 0 && preyDist(x, y, shipBoss) <= range);
  }
  function inLaserRange(x, y, t, range) {
    if (!t) return false;
    if (t.shipNode && canReachShip(x, y, range)) return true;
    return preyDist(x, y, t) <= range;
  }
  function pickLaserTarget(x, y, range) {
    if (canReachShip(x, y, range)) {
      const n = pickShipNode(x, y, { uncovered: true }) || pickShipNode(x, y);
      if (n) return n;
    }
    return nearestBug(x, y, range, b => !b.shipNode);
  }
  function startFinale(opts = {}) {
    if (S.shipPending) return null;
    if (shipBoss && shipBoss.hp > 0) return shipBoss;
    if (!opts.force && (S.loc < shipGoal() || bugs.length + S.backlog > 3)) return null;
    S.playUnlocked = true;
    S.playSpace = true;
    applyPlaySpace();
    const hp = finaleMaxHp();
    shipBoss = {
      ship: true, boss: true, hatching: false, tier: 5,
      name: shipName(),
      x: Wd * 0.5, y: -110, w: Math.max(280, Wd - 24), h: 100,
      hp, maxHp: hp, flash: 0, pop: 1, sq: 0, a: 0, ph: 0,
      enter: 0, spawnAcc: 0, bossSpawn: 0, nodes: [],
      startedAt: now(), elapsed: 0
    };
    makeShipNodes(shipBoss);
    showShipWarn('⚠ ' + shipBoss.name + ' incoming');
    punch(10); boomFlash(Wd * 0.5, 80, 1.2); hitStop(26);
    log(`${shipBoss.name} incoming. Lasers and missiles only.`);
    kick(); dirty = true;
    syncShipBar(true);
    return shipBoss;
  }
  function ship() { return startFinale(); }
  function prestigeReset() {
    hideShippedFanfare();
    S.shipPending = null;
    const next = (S.prestige || 0) + 1;
    const keepClicks = S.clicks || 0;
    Object.keys(S).forEach(k => { delete S[k]; });
    Object.assign(S, DEF, {
      t: Date.now(),
      optedIn: true, paused: false, shop: true, open: true, squashed: 5,
      derick: 1, prestige: next, ships: next,
      playUnlocked: true, playSpace: true,
      clicks: keepClicks, intro: true, hintSeen: true
    });
    bugs = []; S.backlog = 0;
    agents.length = 0;
    derickEnt = null;
    ensureDerick();
    shipBoss = null;
    syncShipBar(true);
    applyPlaySpace();
    log(`Shipped. Prestige ${next + 1}.0 — DJ's all heart now.`);
  }
  function fmtTtk(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec >= 60) return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    return sec + 's';
  }
  const CONFETTI = [];
  let confettiN = 0;
  function startShipConfetti() {
    if (RM || quality < 1) return;
    const n = quality >= 3 ? 72 : quality >= 2 ? 40 : 18;
    for (let i = 0; i < n; i++) {
      const c = CONFETTI[confettiN] || (CONFETTI[confettiN] = {});
      c.x = Math.random() * Wd;
      c.y = -16 - Math.random() * 90;
      c.vx = (Math.random() - 0.5) * 200;
      c.vy = 70 + Math.random() * 240;
      c.life = 1.5 + Math.random() * 1.3;
      c.max = c.life;
      c.spin = (Math.random() - 0.5) * 10;
      c.rot = Math.random() * 6;
      c.w = 3.5 + Math.random() * 5;
      c.h = 2.5 + Math.random() * 4;
      c.color = ['#39ff88', '#3de0ff', '#ff3d81', '#ffb142', '#ececf6'][i % 5];
      confettiN++;
    }
    if (quality >= 2) {
      const hues = [145, 190, 330, 42, 50];
      const bursts = quality >= 3 ? 5 : 3;
      for (let k = 0; k < bursts; k++) {
        burst(Wd * (0.18 + Math.random() * 0.64), Hd * (0.18 + Math.random() * 0.32), hues[k % hues.length], quality >= 3 ? 14 : 8, 260, 0.65);
      }
    }
  }
  function updateConfetti(dt) {
    for (let i = confettiN - 1; i >= 0; i--) {
      const c = CONFETTI[i];
      c.life -= dt;
      if (c.life <= 0) { CONFETTI[i] = CONFETTI[confettiN - 1]; CONFETTI[confettiN - 1] = c; confettiN--; continue; }
      c.vy += 420 * dt;
      c.vx *= 0.99;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot = (c.rot || 0) + (c.spin || 0) * dt;
    }
  }
  function drawConfetti() {
    if (!confettiN) return;
    ctx.save();
    for (let i = 0; i < confettiN; i++) {
      const c = CONFETTI[i];
      const a = Math.max(0, c.life / c.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot || 0);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.restore();
  }
  function showShippedFanfare(fresh) {
    const rec = S.shipPending;
    if (!rec || !shipped) return;
    const ver = rec.version || ((S.prestige || 0) + 1);
    const next = rec.nextVersion || (ver + 1);
    const banner = shipped.querySelector('[data-k=shipped-banner]');
    const ttkEl = shipped.querySelector('[data-k=shipped-ttk]');
    const locEl = shipped.querySelector('[data-k=shipped-loc]');
    const sqEl = shipped.querySelector('[data-k=shipped-squash]');
    const btn = shipped.querySelector('[data-act=confirm-ship]');
    if (banner) banner.textContent = 'SHIPPED v' + ver + '.0!';
    if (ttkEl) ttkEl.textContent = fmtTtk(rec.ttk);
    if (locEl) locEl.textContent = fmt(rec.loc || 0);
    if (sqEl) sqEl.textContent = fmt(rec.squashed || 0);
    if (btn) btn.textContent = 'Ship ' + next + '.0?';
    shipped.hidden = false;
    shipped.classList.toggle('in', true);
    shipped.classList.toggle('rm', !!RM);
    if (fresh && !RM) {
      punch(12);
      flash = Math.max(flash, 0.45);
      startShipConfetti();
    }
  }
  function hideShippedFanfare() {
    if (!shipped) return;
    shipped.hidden = true;
    shipped.classList.remove('in');
    confettiN = 0;
  }
  function confirmShip() {
    if (!S.shipPending) return false;
    hideShippedFanfare();
    S.shipPending = null;
    prestigeReset();
    save();
    render(true);
    kick();
    return true;
  }
  function winFinale() {
    if (!shipBoss) return;
    const defeated = shipBoss;
    defeated.hp = 0;
    const ttk = defeated.elapsed || Math.max(0, (now() - (defeated.startedAt || now())) / 1000);
    const rec = {
      version: (S.prestige || 0) + 1,
      nextVersion: (S.prestige || 0) + 2,
      name: defeated.name || shipName(),
      ttk,
      loc: S.loc,
      squashed: S.squashed,
      at: Date.now()
    };
    if (!RM) {
      punch(12);
      flash = Math.max(flash, 0.45);
      burst(defeated.x, Math.max(80, defeated.y), 330, 24, 380, 0.8);
      burst(defeated.x, Math.max(80, defeated.y), 42, 16, 300, 0.6);
    }
    shipBoss = null;
    syncShipBar(true);
    bugs = [];
    S.backlog = 0;
    S.debt = 0;
    hatchQ.length = 0;
    S.shipPending = rec;
    showShippedFanfare(true);
    log('SHIPPED v' + rec.version + '.0 — ' + fmtTtk(ttk) + '.');
    save();
    kick(); dirty = true;
  }
  function updateFinale(dt) {
    if (!shipBoss || shipBoss.hp <= 0) return;
    shipBoss.elapsed = (shipBoss.elapsed || 0) + dt;
    shipBoss.enter = Math.min(1, shipBoss.enter + dt / 1.15);
    const e = 1 - Math.pow(1 - shipBoss.enter, 3);
    shipBoss.w = Math.max(280, Wd - 24);
    shipBoss.x = Wd * 0.5;
    shipBoss.y = -110 + (72 + 110) * e;
    shipBoss.flash = Math.max(0, (shipBoss.flash || 0) - dt * 4);
    shipBoss.ph += dt * 3;
    if (shipBoss.nodes) for (const n of shipBoss.nodes) n.flash = Math.max(0, (n.flash || 0) - dt * 4);
    syncShipNodePositions();
    if (shipBoss.enter < 1) return;
    const live = liveShipNodes();
    if (!live.length) return;
    shipBoss.spawnAcc += dt;
    shipBoss.bossSpawn += dt;
    const spawnWait = 0.55 * (SHIP_NODES / live.length);
    if (shipBoss.spawnAcc >= spawnWait && bugs.length < cap()) {
      shipBoss.spawnAcc = 0;
      const node = live[Math.floor(Math.random() * live.length)];
      const b = spawnBug(node.x, node.y + 10, { force: true, tier: Math.random() < 0.35 ? 2 : 1, src: 'ship' });
      if (b) { b.hatching = false; b.y = node.y + 18; }
    }
    const bossWait = 6.2 * (SHIP_NODES / live.length);
    if (shipBoss.bossSpawn >= bossWait && bugs.length < cap()) {
      shipBoss.bossSpawn = 0;
      const node = live[Math.floor(Math.random() * live.length)];
      const b = spawnBug(node.x, node.y + 12, { force: true, boss: true, tier: 4, src: 'ship-boss' });
      if (b) { b.hatching = false; log(`${b.name} dropped from ${shipBoss.name}.`); }
    }
  }
  function drawShip() {
    if (!shipBoss || shipBoss.hp <= 0) return;
    const s = shipBoss;
    const x = s.x, y = s.y, w = s.w, h = s.h;
    ctx.save();
    ctx.translate(x, y);
    if (s.flash) ctx.globalAlpha = 0.75 + s.flash * 0.25;
    // hull
    ctx.fillStyle = '#141428';
    ctx.strokeStyle = S.prestige ? 'rgba(255,61,129,0.85)' : 'rgba(57,255,136,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.15);
    ctx.lineTo(-w * 0.42, -h * 0.45);
    ctx.lineTo(w * 0.42, -h * 0.45);
    ctx.lineTo(w * 0.5, -h * 0.15);
    ctx.lineTo(w * 0.46, h * 0.42);
    ctx.lineTo(-w * 0.46, h * 0.42);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // canopy stripe
    ctx.fillStyle = S.prestige ? 'rgba(255,61,129,0.25)' : 'rgba(57,255,136,0.18)';
    ctx.fillRect(-w * 0.38, -h * 0.22, w * 0.76, h * 0.18);
    // hardpoint nodes (the old window dots, now individually targetable)
    syncShipNodePositions();
    const nodes = s.nodes || [];
    for (let i = 0; i < SHIP_NODES; i++) {
      const n = nodes[i];
      const lx = -w * 0.28 + i * w * 0.093;
      const ly = -h * 0.12;
      ctx.save();
      ctx.translate(lx, ly);
      if (!n || n.hp <= 0 || n._dead) {
        ctx.fillStyle = 'rgba(16,18,28,0.95)';
        ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(90,96,120,0.85)';
        ctx.lineWidth = 1.15;
        ctx.beginPath(); ctx.moveTo(-3.2, -3.2); ctx.lineTo(3.2, 3.2); ctx.moveTo(3.2, -3.2); ctx.lineTo(-3.2, 3.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 6.2, 0, 7); ctx.stroke();
      } else {
        const pulse = 0.55 + 0.28 * Math.sin((s.ph || 0) + i * 0.7);
        const flash = n.flash || 0;
        ctx.fillStyle = flash ? 'rgba(255,255,255,0.95)' : `rgba(61,224,255,${0.42 + pulse * 0.4})`;
        ctx.beginPath(); ctx.arc(0, 0, 5.6 + flash * 2.2, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(190,250,255,${0.55 + flash * 0.4})`;
        ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.arc(0, 0, 7.1, 0, 7); ctx.stroke();
        const pct = Math.max(0, n.hp / (n.maxHp || 1));
        if (pct < 0.999) {
          ctx.strokeStyle = 'rgba(255,90,120,0.9)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, 8.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    const nameFont = `800 ${Math.max(14, Math.min(28, w * 0.035))}px ui-monospace, sans-serif`;
    drawCachedText(ctx, s.name, nameFont, '#ececf6', 0, h * 0.16, 'center');
    ctx.restore();
  }
  function pathHeart(ctx, x, y, s) {
    // Symmetric round heart. (x, y) is the visual center.
    // Width and height are both ~2s so it does not read as a wide pancake
    // at any scale. Pulse/DPR apply a uniform scale only.
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.98);
    ctx.bezierCurveTo(x + s * 0.18, y + s * 0.50, x + s * 0.98, y + s * 0.22, x + s * 0.98, y - s * 0.26);
    ctx.bezierCurveTo(x + s * 0.98, y - s * 0.78, x + s * 0.40, y - s * 0.98, x, y - s * 0.46);
    ctx.bezierCurveTo(x - s * 0.40, y - s * 0.98, x - s * 0.98, y - s * 0.78, x - s * 0.98, y - s * 0.26);
    ctx.bezierCurveTo(x - s * 0.98, y + s * 0.22, x - s * 0.18, y + s * 0.50, x, y + s * 0.98);
    ctx.closePath();
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
    applyPlaySpace();
    syncShell(); render(true); startLoops(); dirty = true; save();
  }
  function pauseGame() {
    if (!S.optedIn) return;
    S.paused = true; save(); stopLoops(); syncShell(); log('Paused. Progress saved.');
  }
  function quitGame() {
    if (!S.optedIn) return;
    // ✕ from Play Space always returns to the site so chrome is never hidden
    // without a way back. Pause leaves Play Space as-is.
    if (S.playSpace) {
      S.playSpace = false;
      applyPlaySpace();
    }
    S.paused = true; save(); stopLoops(); syncShell(); log('Quit. Progress kept.');
  }
  function clearSaveKeys() {
    for (const k of SAVE_KEYS) {
      try { localStorage.removeItem(k); } catch {}
    }
  }
  function wipeProgress() {
    // Stop timers first, then drop every save key and in-memory state so a
    // pagehide / visibilitychange / interval save cannot rewrite the old run
    // before reload (the bug that made Reset appear to do nothing on phones).
    suppressSave = true;
    stopLoops();
    clearSaveKeys();
    Object.keys(S).forEach(k => { delete S[k]; });
    Object.assign(S, DEF, { t: Date.now(), optedIn: false, paused: true, shop: false, shipPending: null });
    hideShippedFanfare();
  }
  function resetAll() {
    if (!window.confirm('Reset Bug Hunt progress? This cannot be undone.')) return;
    wipeProgress();
    location.reload();
  }
  function fillPlayWordmark() {
    const slot = playMark.querySelector('.bh-play-janssen');
    if (!slot || slot.querySelector('svg')) return;
    const tpl = d.getElementById('bh-wordmark-outline');
    if (tpl && tpl.content) slot.append(tpl.content.cloneNode(true));
    else {
      const hero = d.querySelector('.ht-outline');
      if (hero) slot.append(hero.cloneNode(true));
    }
  }
  function applyPlaySpace() {
    const on = !!(S.playSpace && S.optedIn);
    const was = d.body.classList.contains('bh-play');
    if (on && !was) {
      playScrollX = W.scrollX || 0;
      playScrollY = W.scrollY || 0;
    }
    d.body.classList.toggle('bh-play', on);
    playScene.hidden = !on;
    playMark.hidden = !on;
    if (on) fillPlayWordmark();
    if (!on && was) {
      // Lifting overflow:hidden can leave the page unscrollable until layout
      // flushes, and html { scroll-behavior: smooth } would animate from 0.
      // Force a reflow and an instant jump back to the saved site position.
      void d.body.offsetHeight;
      const root = d.documentElement;
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      W.scrollTo(playScrollX, playScrollY);
      root.style.scrollBehavior = prev;
    }
    if (el.play) {
      el.play.hidden = !S.playUnlocked;
      el.play.textContent = S.playSpace ? 'Site' : 'Play Space';
      el.play.title = S.playSpace ? 'Back to the site' : 'Open Play Space';
    }
  }
  function showPromote() {
    promote.hidden = false;
    promote.classList.remove('in');
    void promote.offsetWidth;
    promote.classList.add('in');
    log('Promoted: Play Space unlocked.');
    setTimeout(() => { promote.hidden = true; promote.classList.remove('in'); }, 3400);
  }
  function notePlayerClick() {
    if (!S.optedIn) return;
    S.clicks = (S.clicks || 0) + 1;
    if (!S.playUnlocked && S.clicks >= PLAY_UNLOCK) {
      S.playUnlocked = true;
      S.playSpace = true;
      showPromote();
      applyPlaySpace();
      save();
    }
  }

  syncShell();
  applyPlaySpace();
  if (S.optedIn && !S.paused) { ensureDerick(); ensureAgents(); }
  if (S.optedIn && !S.paused && !S.hintSeen && !S.intro) {
    hint.hidden = false; hintUntil = now() + 5500; S.hintSeen = true;
  }

  function heartbeatActive() { return heartbeatUntil > now(); }
  function heartbeatCooling() { return !heartbeatActive() && heartbeatCdUntil > now(); }
  function pollHeartbeat() {
    if (heartbeatUntil && now() >= heartbeatUntil) {
      heartbeatUntil = 0;
      heartbeatCdUntil = now() + HB_COOLDOWN;
      log('Heartbeat faded. Cooling down.');
    }
  }
  function startHeartbeat() {
    hbTimes = [];
    heartbeatUntil = now() + HB_DURATION;
    heartbeatCdUntil = 0;
    blameReady = true;
    punch(5);
    log('Heartbeat! LOC ×5 for 60s. Nearby agents share Derick’s full aura.');
    if (derickEnt) gain(derickEnt.x, derickEnt.y - 22, 'HEARTBEAT', '#ff3d81');
    syncHbHud(true);
    kick();
  }
  function derickHitRadius() {
    const extra = S.prestige >= 1 ? derickRadius() * HEART_DJ_SCALE * 0.8 : 0;
    return derickRadius() + 10 + extra;
  }
  function derickDraftRate() {
    const base = IDLE_DERRICK + (S.agentic ? IDLE_AGENTIC : 0);
    return base * (heartbeatActive() ? HB_MULT : 1);
  }
  function syncHbHud(force) {
    pollHeartbeat();
    if (!force && now() - lastHbHud < 200) return;
    lastHbHud = now();
    const wrap = hud.querySelector('[data-k=hbwrap]');
    const lab = hud.querySelector('[data-k=hb]');
    if (!wrap) return;
    if (heartbeatActive()) {
      wrap.hidden = false;
      wrap.classList.add('on');
      const sec = Math.max(0, Math.ceil((heartbeatUntil - now()) / 1000));
      if (lab) lab.textContent = sec >= 60 ? (Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')) : (sec + 's');
    } else {
      wrap.hidden = true;
      wrap.classList.remove('on');
    }
  }
  function noteDjPoke(x, y) {
    if (!derickEnt) return;
    djPokes++;
    spitHearts(derickEnt.x, derickEnt.y);
    pollHeartbeat();
    const t = now();
    if (!heartbeatActive() && !heartbeatCooling()) {
      hbTimes.push(t);
      hbTimes = hbTimes.filter(ts => t - ts <= HB_WINDOW);
      if (hbTimes.length >= HB_CLICKS) startHeartbeat();
    }
    kick(); dirty = true;
  }

  // ---------- input (never swallow) ----------
  const IGNORE = 'a,button,input,textarea,select,summary,label,iframe,video,audio,[role=button],[contenteditable],.bh-hud,#bh-ready,#bh-shipped,.yt';
  let downX = 0, downY = 0, downT = 0;
  d.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = now(); }, { passive: true });
  d.addEventListener('pointerup', e => {
    if (!S.optedIn || S.paused || S.hidden || (e.button && e.button !== 0)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10 || now() - downT > 600) return;
    if (e.target.closest && e.target.closest(IGNORE)) return;
    const sel = W.getSelection && W.getSelection(); if (sel && String(sel).length) return;
    const x = e.clientX, y = e.clientY, pad = e.pointerType === 'touch' ? 20 : 12;
    if (derickEnt && S.derick && Math.hypot(derickEnt.x - x, derickEnt.y - y) <= derickHitRadius()) {
      noteDjPoke(x, y);
      return;
    }
    if (shipBoss && shipBoss.hp > 0) {
      let hitNode = null, nd = 20;
      for (const n of liveShipNodes()) {
        const dd = Math.hypot(n.x - x, n.y - y);
        if (dd < nd) { nd = dd; hitNode = n; }
      }
      if (hitNode) { clink(hitNode, x, y); return; }
      if (preyDist(x, y, shipBoss) < 12) { clink(shipBoss, x, y); return; }
    }
    let best = null, bd = 1e9;
    for (const b of bugs) {
      if (b.hatching) continue;
      const dd = Math.hypot(b.x - x, b.y - y);
      if (dd < (R[b.tier] || 8) + pad && dd < bd) { bd = dd; best = b; }
    }
    if (best) {
      if (isBoss(best)) { clink(best, x, y); return; }
      squash(best, {});
      notePlayerClick();
      return;
    }
    addCode(1, x, y, true);
    notePlayerClick();
    codeBurstAt(x, y);
    gain(x, y, '+1 LOC', '#ececf6');
    if (!S.intro) { S.intro = true; log('Code written. Bugs crawl out. Squash them!'); hint.hidden = true; }
    dirty = true; kick();
  }, { passive: true });

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiBuf = [];
  d.addEventListener('keydown', e => {
    konamiBuf.push(e.key);
    if (konamiBuf.length > KONAMI.length) konamiBuf.shift();
    const ok = KONAMI.every((k, i) => konamiBuf[i] && String(konamiBuf[i]).toLowerCase() === k.toLowerCase());
    if (!ok) return;
    konamiBuf = [];
    konamiArmed = true; blameReady = true;
    if (S.optedIn && !S.paused && agents.length) {
      let n = 0;
      for (const a of agents) {
        if (n >= 5) break;
        const prey = pickLaunchTarget();
        if (!prey) break;
        if (launchPulseShot(a, prey, 0)) n++;
      }
      log(n ? '↑↑↓↓←→←→BA — extra pulse volley.' : '↑↑↓↓ Konami armed.');
    } else log('↑↑↓↓ Konami armed.');
    punch(6); kick();
  }, { passive: true });

  ready.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'ready') optIn();
  });

  shipped.addEventListener('click', e => {
    const b = e.target.closest('[data-act=confirm-ship]');
    if (b) confirmShip();
  });
  hud.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act, buy = b.dataset.buy;
    if (act === 'min') S.open = !S.open;
    else if (act === 'pause') pauseGame();
    else if (act === 'quit') quitGame();
    else if (act === 'reset') resetAll();
    else if (act === 'playspace' && S.playUnlocked) { S.playSpace = !S.playSpace; applyPlaySpace(); }
    else if (act === 'rb') rollback(false);
    else if (act === 'ship') ship();
    else if (buy) {
      const it = ITEMS.find(i => i.id === buy);
      if (!it || !it.show()) { dirty = true; render(true); save(); return; }
      const c = cost[buy]();
      const key = buy === 'agent' ? 'agents' : buy;
      if (S.commits >= c && !(it.once && S[key]) && !(it.max && S[key] >= it.max)) {
        S.commits -= c;
        S[key] = (S[key] || 0) + 1;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 50, 8, 180, .45);
        if (buy === 'derick') { ensureDerick(); log('Derick hired.'); }
        else if (buy === 'agent') { ensureAgents(); log(`Agent #${S.agents} online.`); }
        else if (buy === 'agentic') log('Agentic Workflow online. Agents falling in around Derick.');
        else if (buy === 'subagent') { ensureAgents(); log('Sub-Agent Workflow online. Escorts grow orbiting bombers.'); }
        else if (buy === 'rollback') log('Rollback unlocked.');
        else if (buy === 'qa') { retargetQA(); log('QA marking big bugs.'); }
        else log(`${it.name} unlocked.`);
        if (S.agents >= 10 && buy === 'agent') log('Command mode: faster pulses. Agents escort Derick.');
        kick();
      }
    }
    dirty = true; render(true); save();
  });

  // ---------- HUD render ----------
  function render(force) {
    syncShell();
    if (!S.optedIn) return;
    if (!force && now() - lastHudAt < 200) return;
    lastHudAt = now();
    hud.classList.toggle('bh-min', !S.open);
    el.min.textContent = S.open ? '–' : '+';
    el.pause.textContent = S.paused ? '▶' : '❚❚';
    if (el.play) {
      el.play.hidden = !S.playUnlocked;
      el.play.textContent = S.playSpace ? 'Site' : 'Play Space';
      el.play.title = S.playSpace ? 'Back to the site' : 'Open Play Space';
    }
    const titleB = hud.querySelector('.bh-title b');
    if (titleB) titleB.textContent = S.prestige ? `BUG HUNT v${S.prestige + 1}.0` : 'BUG HUNT';
    el.loc.textContent = fmt(S.loc);
    el.bugs.textContent = fmt(bugs.length + S.backlog);
    el.commits.textContent = fmt(S.commits);
    syncHbHud();
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
      if (heartbeatActive()) bits.push('♥ Heartbeat');
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
        html += `<button class="bh-btn bh-item bh-ship" type="button" data-act="ship" ${ok ? '' : 'disabled'}><span>Ship v${(S.prestige || 0) + 1}.0</span><small>${ok ? 'No blockers. Lasers & missiles only.' : `Need ${fmt(shipGoal())} LOC & ≤3 bugs.`}</small><em>🏆 ${S.prestige || 0}</em></button>`;
      }
    }
    if (html !== lastShop) { el.shop.innerHTML = html; lastShop = html; }
  }

  // ---------- combat AI ----------
  function preyAlive(t) {
    if (!t) return false;
    if (t.shipNode) return !!(shipBoss && t.hp > 0 && !t._dead);
    if (t.ship) return !!(shipBoss && shipBoss === t && shipBoss.hp > 0);
    return bugs.includes(t);
  }
  function preyDist(x, y, t) {
    if (!t) return 1e9;
    if (t.ship && !t.shipNode) {
      const dx = Math.max(0, Math.abs(x - t.x) - (t.w || 0) * 0.5);
      const dy = Math.max(0, Math.abs(y - t.y) - (t.h || 0) * 0.5);
      return Math.hypot(dx, dy);
    }
    return Math.hypot(t.x - x, t.y - y);
  }
  function nearestBug(x, y, range, pred) {
    let best = null, bd = range;
    const consider = b => {
      if (!b || b.hatching) return;
      if (b.ship && b.hp <= 0) return;
      if (pred && !pred(b)) return;
      const dd = preyDist(x, y, b);
      if (dd < bd) { bd = dd; best = b; }
    };
    for (const b of bugs) consider(b);
    for (const n of liveShipNodes()) consider(n);
    return best;
  }
  function pickThreat() {
    let best = null;
    const score = b => (b.ship ? 100 : 0) + (b.boss ? 10 : 0) + (b.tier || 0);
    const consider = b => {
      if (!b || b.hatching || (b.ship && b.hp <= 0)) return;
      if (!best) { best = b; return; }
      const ds = score(b) - score(best);
      if (ds > 0) { best = b; return; }
      if (ds < 0 || !derickEnt) return;
      if (preyDist(derickEnt.x, derickEnt.y, b) < preyDist(derickEnt.x, derickEnt.y, best)) best = b;
    };
    for (const b of bugs) consider(b);
    for (const n of liveShipNodes()) consider(n);
    return best;
  }

  function updateDerick(dt) {
    ensureDerick();
    if (!derickEnt || !S.derick) return;
    const cmd = commandMode();
    // Always roam toward the biggest threat. Never park — it made DJ look lazy.
    const threat = pickThreat();
    if (threat) {
      const ang = Math.atan2(threat.y - derickEnt.y, threat.x - derickEnt.x);
      const prefer = derickRange() * 0.55;
      derickEnt.tx = threat.x - Math.cos(ang) * prefer;
      derickEnt.ty = threat.y - Math.sin(ang) * prefer;
    } else {
      // No targets: ease back to the play-area center and hover there.
      const cx = Wd * 0.5, cy = Hd * 0.5;
      derickEnt.tx += (cx - derickEnt.tx) * Math.min(1, dt * 1.8);
      derickEnt.ty += (cy - derickEnt.ty) * Math.min(1, dt * 1.8);
      const t = now() / 1000;
      derickEnt.tx += Math.sin(t * 1.4) * 10 * dt;
      derickEnt.ty += Math.cos(t * 1.1) * 8 * dt;
    }
    derickEnt.tx = clamp(derickEnt.tx, 30, Wd - 30);
    derickEnt.ty = clamp(derickEnt.ty, 70, Hd - 30);
    const sp = cmd ? 140 : 120;
    derickEnt.x += (derickEnt.tx - derickEnt.x) * Math.min(1, dt * (sp / 40));
    derickEnt.y += (derickEnt.ty - derickEnt.y) * Math.min(1, dt * (sp / 40));

    const range = derickCombatRange();
    const t = pickLaserTarget(derickEnt.x, derickEnt.y, range);
    derickEnt.target = t;
    derickEnt.beam = Math.max(0, derickEnt.beam - dt * 4);
    if (t && inLaserRange(derickEnt.x, derickEnt.y, t, range)) {
      addLaser(derickEnt.x, derickEnt.y, t.x, t.y, { wide: 1, life: 0.1, color: LASER_COLOR.derick });
      damageBug(t, derickCombatDps(), dt, derickEnt);
    }

    // Agentic pulses
    if (S.agentic && agents.length) {
      pulseAcc += dt * (cmd ? 0.55 : 0.35) * (1 + S.sync * 0.5);
      while (pulseAcc >= 1) {
        pulseAcc -= 1;
        const ready = agents.filter(agentReadyForPulse);
        if (!ready.length) break;
        const n = Math.min(ready.length, S.sync ? 3 : 1);
        const used = [];
        for (let i = 0; i < n; i++) {
          const free = ready.filter(a => !used.includes(a));
          if (!free.length) break;
          const ag = free[Math.floor(Math.random() * free.length)];
          used.push(ag);
          if (S.subagent) {
            const prey = pickLaunchTarget();
            if (!prey) break;
            const amt = predictedMissileDamage(prey);
            reserveOn(prey, amt);
            sendPulse(derickEnt, ag, prey, amt);
          } else {
            sendPulse(derickEnt, ag, null, 0);
          }
        }
      }
    }
  }

  function predictedMissileDamage(t) {
    if (!t) return 0;
    let dmg = missileDamage();
    if (isBoss(t) && !t.ship) dmg = Math.min(dmg, t.maxHp * MISSILE_BOSS_FRAC);
    return dmg;
  }
  function pendingOn(t) { return (t && t._pending) || 0; }
  function reserveOn(t, amt) {
    if (!t || !amt) return;
    t._pending = (t._pending || 0) + amt;
  }
  function releaseOn(t, amt) {
    if (!t || !amt) return;
    t._pending = Math.max(0, (t._pending || 0) - amt);
  }
  function releaseReserve(proj) {
    if (!proj) return;
    if (proj.reserved) releaseOn(proj.reserved, proj.reservedAmt || 0);
    proj.reserved = null;
    proj.reservedAmt = 0;
  }
  function targetHasCover(t) { return !t || pendingOn(t) >= t.hp - 1e-6; }
  function pickLaunchTarget() {
    let best = null;
    const score = b => (b.ship ? 100 : 0) + (b.boss ? 10 : 0) + (b.tier || 0);
    const consider = b => {
      if (!b || b.hatching || (b.ship && b.hp <= 0)) return;
      if (targetHasCover(b)) return;
      if (!best) { best = b; return; }
      const ds = score(b) - score(best);
      if (ds > 0) { best = b; return; }
      if (ds < 0 || !derickEnt) return;
      if (preyDist(derickEnt.x, derickEnt.y, b) < preyDist(derickEnt.x, derickEnt.y, best)) best = b;
    };
    for (const b of bugs) consider(b);
    const fromX = derickEnt ? derickEnt.x : 0;
    const fromY = derickEnt ? derickEnt.y : 0;
    const node = pickShipNode(fromX, fromY, { uncovered: true });
    if (node) return node;
    return best;
  }
  function agentReadyForPulse(a) {
    if (!a) return false;
    if (S.subagent) return !!(a.sub && a.sub.state === 'orbit');
    return !pulseBuffActive(a);
  }
  function applyPulseBuff(agent) {
    if (!agent || agent.isSub) return false;
    agent.buffUntil = now() + PULSE_BUFF;
    agent.chasing = false;
    agent.missile = false;
    agent.missilePhase = null;
    if (!RM && quality >= 2) {
      punch(2.4);
      if (quality >= 2) gain(agent.x, agent.y - 16, 'BUFF', '#ffb142');
    }
    return true;
  }
  function startMissile(proj, target) {
    if (!proj || !target) return;
    // Regular agents never fly out as bombs — only sub-agents do.
    if (!proj.isSub) { applyPulseBuff(proj); return; }
    proj.chasing = true;
    proj.missile = true;
    proj.missilePhase = 'out';
    proj.chaseRoot = target;
    proj.target = target;
    proj.flight = 0;
    const ang = Math.atan2(target.y - proj.y, target.x - proj.x);
    const side = proj.kickSign || (Math.random() < 0.5 ? -1 : 1);
    proj.kickSign = -side;
    const s0 = missileSpeed0();
    proj.vx = Math.cos(ang) * s0 + Math.cos(ang + Math.PI / 2) * side * 210;
    proj.vy = Math.sin(ang) * s0 + Math.sin(ang + Math.PI / 2) * side * 210;
    proj.trail = [];
  }
  function endMissile(agent) {
    if (!agent) return;
    releaseReserve(agent);
    agent.chasing = false;
    agent.missile = false;
    agent.missilePhase = null;
    agent.chaseRoot = null;
    agent.target = null;
    agent.vx = 0; agent.vy = 0;
    agent.trail = [];
    agent.flight = 0;
  }
  function launchMissile(agent, target) {
    if (!agent) return;
    if (agent.isSub) {
      if (!target || (agent.missile && agent.missilePhase === 'out')) return;
      startMissile(agent, target);
      const amt = predictedMissileDamage(target);
      reserveOn(target, amt);
      agent.reserved = target;
      agent.reservedAmt = amt;
      return;
    }
    launchPulseShot(agent, target, 0);
  }
  function launchPulseShot(agent, target, reservedAmt) {
    if (!agent) return false;
    if (agent.isSub) {
      let t = target && preyAlive(target) ? target : null;
      let amt = reservedAmt || 0;
      if (!t) {
        if (amt && target) releaseOn(target, amt);
        t = pickLaunchTarget();
        amt = 0;
      }
      if (!t) return false;
      if (!amt) { amt = predictedMissileDamage(t); reserveOn(t, amt); }
      startMissile(agent, t);
      agent.reserved = t;
      agent.reservedAmt = amt;
      return true;
    }
    if (S.subagent) {
      let t = target && preyAlive(target) ? target : null;
      let amt = reservedAmt || 0;
      if (!t) {
        if (amt && target) releaseOn(target, amt);
        t = pickLaunchTarget();
        amt = 0;
      }
      if (!t) return false;
      if (!amt) { amt = predictedMissileDamage(t); reserveOn(t, amt); }
      const sub = agent.sub;
      if (!sub || sub.state !== 'orbit') {
        releaseOn(t, amt);
        return false;
      }
      startMissile(sub, t);
      sub.state = 'out';
      sub.reserved = t;
      sub.reservedAmt = amt;
      return true;
    }
    if (reservedAmt && target) releaseOn(target, reservedAmt);
    return applyPulseBuff(agent);
  }
  function activateChase(agent, target) { return launchPulseShot(agent, target, 0); }
  function detonateMissile(agent) {
    if (!agent) return;
    releaseReserve(agent);
    const x = agent.x, y = agent.y;
    const rad = missileRadius();
    const base = missileDamage();
    const blast = bugs.slice();
    for (const n of liveShipNodes()) blast.push(n);
    for (const b of blast) {
      if (!b || b.hatching) continue;
      const dist = preyDist(x, y, b);
      if (dist > rad) continue;
      const fall = 1 - (dist / rad) * 0.45;
      let dmg = base * fall;
      if (isBoss(b) && !b.ship) dmg = Math.min(dmg, b.maxHp * MISSILE_BOSS_FRAC);
      b.hp -= dmg;
      b.flash = 1;
      b.sq = Math.max(b.sq || 0, 0.85);
      if (!b.ship) {
        const bang = Math.atan2(b.y - y, b.x - x) || 0;
        b.a = bang;
        b.boost = isBoss(b) ? 1.8 : 3.4;
      }
      if (b.hp <= 0) {
        if (b.shipNode) {
          destroyShipNode(b);
          if (!shipBoss) break;
        } else if (b.ship) winFinale();
        else {
          const qaBoss = isBoss(b) && b.targeted;
          squash(b, { auto: true, noSplit: !!b.targeted || qaBoss, qaBoss });
        }
      } else if (b.shipNode) {
        syncShipHp();
      }
    }
    if (!RM) {
      if (quality >= 1) punch(quality >= 3 ? 5 : quality >= 2 ? 3.5 : 2);
      boomFlash(x, y, quality >= 3 ? 0.9 : 0.55);
      if (quality >= 3) hitStop(22);
      const n = quality >= 3 ? 14 : quality >= 2 ? 8 : quality >= 1 ? 4 : 0;
      if (n) burst(x, y, 42, n, 280, 0.55);
      if (n && quality >= 2) burst(x, y, 195, Math.ceil(n * 0.5), 200, 0.4);
    }
    explosions.push({ x, y, r: rad, life: 0.42, max: 0.42 });
    if (explosions.length > 10) explosions.shift();
    if (agent.isSub) {
      agent.missile = false;
      agent.missilePhase = null;
      agent.chasing = false;
      agent.chaseRoot = null;
      agent.target = null;
      agent.trail = [];
      agent.state = 'cd';
      agent.cd = SUB_RESPAWN;
      return;
    }
    const spd = Math.hypot(agent.vx || 0, agent.vy || 0) || 200;
    const hang = Math.atan2(agent.vy || 0, agent.vx || 1);
    agent.vx = -Math.cos(hang) * Math.min(340, spd * 0.55);
    agent.vy = -Math.sin(hang) * Math.min(340, spd * 0.55);
    agent.missilePhase = 'back';
    agent.flight = 0;
    agent.chaseRoot = null;
    agent.target = null;
  }
  function updateMissile(a, dt) {
    if (!a || !a.missile) return;
    if (a.missilePhase === 'out') {
      a.flight = (a.flight || 0) + dt;
      let t = a.chaseRoot && preyAlive(a.chaseRoot) ? a.chaseRoot : null;
      if (!t || t.hatching) {
        releaseReserve(a);
        t = nearestBug(a.x, a.y, 320, b => !targetHasCover(b));
        if (!t) t = nearestBug(a.x, a.y, 320, b => true);
        a.chaseRoot = t;
        a.target = t;
        if (t) {
          const amt = predictedMissileDamage(t);
          reserveOn(t, amt);
          a.reserved = t;
          a.reservedAmt = amt;
        }
      }
      if (t) {
        const dx = t.x - a.x, dy = t.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const aimX = t.x + (dx / dist) * 22;
        const aimY = t.y + (dy / dist) * 22;
        const desired = Math.atan2(aimY - a.y, aimX - a.x);
        const cur = Math.atan2(a.vy, a.vx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = clamp(diff, -8 * dt, 8 * dt);
        const spd = Math.hypot(a.vx, a.vy);
        const nspd = Math.min(missileSpeedMax(), spd + 980 * dt);
        const nang = cur + turn;
        a.vx = Math.cos(nang) * nspd;
        a.vy = Math.sin(nang) * nspd;
      } else {
        const spd = Math.hypot(a.vx, a.vy);
        const nspd = Math.min(missileSpeedMax(), spd + 400 * dt);
        const ang = Math.atan2(a.vy, a.vx);
        a.vx = Math.cos(ang) * nspd;
        a.vy = Math.sin(ang) * nspd;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < 16) { a.x = 16; a.vx = Math.abs(a.vx) * 0.6; }
      if (a.x > Wd - 16) { a.x = Wd - 16; a.vx = -Math.abs(a.vx) * 0.6; }
      if (a.y < 56) { a.y = 56; a.vy = Math.abs(a.vy) * 0.6; }
      if (a.y > Hd - 16) { a.y = Hd - 16; a.vy = -Math.abs(a.vy) * 0.6; }
      if (quality >= 1 && !RM) {
        a.trail = a.trail || [];
        a.trail.push({ x: a.x, y: a.y, life: 0.28 });
        const capT = quality >= 3 ? 16 : 8;
        if (a.trail.length > capT) a.trail.shift();
      }
      if (a.trail) for (const p of a.trail) p.life -= dt;
      const hitR = t ? (t.ship ? 18 : (R[Math.min(4, t.tier)] || 8) + 12) : 0;
      const close = t && preyDist(a.x, a.y, t) <= hitR;
      if ((close && a.flight >= 0.08) || a.flight >= 2.4 || (!t && a.flight >= 0.35)) {
        detonateMissile(a);
      }
    } else if (a.missilePhase === 'back') {
      a.flight = (a.flight || 0) + dt;
      a.vx *= Math.pow(0.08, dt);
      a.vy *= Math.pow(0.08, dt);
      const idx = Math.max(0, agents.indexOf(a));
      const slot = (derickEnt && S.agentic)
        ? escortSlot(idx, Math.max(1, agents.length))
        : { x: a.homeX, y: a.homeY };
      a.x += (slot.x - a.x) * Math.min(1, dt * 6) + a.vx * dt;
      a.y += (slot.y - a.y) * Math.min(1, dt * 6) + a.vy * dt;
      if (a.trail) {
        let w = 0;
        for (let i = 0; i < a.trail.length; i++) {
          a.trail[i].life -= dt;
          if (a.trail[i].life > 0) a.trail[w++] = a.trail[i];
        }
        a.trail.length = w;
      }
      if (Math.hypot(slot.x - a.x, slot.y - a.y) < 10 || a.flight > 1.8) endMissile(a);
    }
  }

  function updateSub(a, dt) {
    const s = a && a.sub;
    if (!s) return;
    if (s.state === 'cd') {
      s.cd -= dt;
      if (s.cd <= 0) {
        s.state = 'orbit';
        s.ang = Math.random() * Math.PI * 2;
        s.x = a.x + Math.cos(s.ang) * SUB_ORBIT;
        s.y = a.y + Math.sin(s.ang) * SUB_ORBIT;
        s.pop = 0.15;
        s.missile = false; s.missilePhase = null; s.chasing = false;
        s.trail = [];
        if (quality >= 2 && !RM) burst(s.x, s.y, 200, 3, 80, 0.28);
      }
      return;
    }
    if (s.state === 'out') {
      updateMissile(s, dt);
      return;
    }
    s.ang += dt * 2.5;
    s.pop += (1 - (s.pop || 1)) * Math.min(1, dt * 8);
    s.x = a.x + Math.cos(s.ang) * SUB_ORBIT;
    s.y = a.y + Math.sin(s.ang) * SUB_ORBIT;
  }
  function updatePulses(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.life -= dt;
      if (p.agent) { p.tx = p.agent.x; p.ty = p.agent.y; }
      const pul = S.movement ? 11 : 8;
      p.x = p.x + (p.tx - p.x) * Math.min(1, dt * pul);
      p.y = p.y + (p.ty - p.y) * Math.min(1, dt * pul);
      if (!p.arrived && Math.hypot(p.x - p.tx, p.y - p.ty) < 10) {
        p.arrived = true;
        p.handed = !!(p.agent && launchPulseShot(p.agent, p.target, p.reservedAmt || 0));
      }
      if (p.life <= 0) {
        if (!p.arrived && !p.handed && p.target && p.reservedAmt) releaseOn(p.target, p.reservedAmt);
        pulses.splice(i, 1);
      }
    }
  }

  // ---------- sim ----------
  function nextHatchDelay() { return HATCH_MIN + Math.random() * HATCH_SPAN; }
  function requestHatch(opts) {
    if (hatchQ.length >= 48) return;
    if (typeof opts === 'string') opts = { src: opts };
    hatchQ.push(opts || { src: 'debt' });
  }
  function enqueueDebt(src) {
    while (S.debt >= 1 && hatchQ.length < 48) {
      S.debt -= 1;
      requestHatch({ src: src || 'debt' });
    }
  }
  function tryHatchOne() {
    if (!hatchQ.length || !canAutoSpawn() || bugs.length >= cap()) return false;
    const opts = hatchQ[0];
    const b = spawnBug(null, null, opts);
    if (!b) return false;
    hatchQ.shift();
    if (opts && opts.src === 'qa') { log('QA revealed a bug.'); retargetQA(); }
    return true;
  }
  function pumpHatches(dt) {
    dt = dt || 0;
    if (dt >= 0.4) {
      hatchWait -= dt;
      let n = 0;
      while (hatchWait <= 0 && n < 12) {
        if (!tryHatchOne()) {
          if (hatchWait < 0) hatchWait = 0;
          break;
        }
        hatchWait += nextHatchDelay();
        n++;
      }
      hatchReadyAt = now() + Math.max(0, hatchWait) * 1000;
      return n;
    }
    const t = now();
    if (t < hatchReadyAt) return 0;
    if (!tryHatchOne()) return 0;
    const d = nextHatchDelay();
    hatchReadyAt = t + d * 1000;
    hatchWait = d;
    return 1;
  }
  function idleRampSec(unit) {
    const phase = (unit && unit.idlePhase != null) ? unit.idlePhase : Math.random();
    return 0.45 + phase * 0.7;
  }
  function seedIdleFromFire(unit, rate) {
    unit.idleAcc = Math.max(unit.idleAcc || 0, 1 - rate * idleRampSec(unit));
  }
  function idleCodeRate() {
    if (!S.derick && !S.agents) return 0;
    const d = S.derick ? derickDraftRate() : 0;
    const a = S.agents * IDLE_AGENT;
    const subs = S.subagent ? agents.filter(ag => ag.sub && ag.sub.state === 'orbit').length * IDLE_AGENT : 0;
    return d + a + subs;
  }
  function unitLasering(unit, isDerick) {
    if (!unit) return false;
    if (unit.missile && unit.missilePhase === 'out') return true;
    if (isDerick) return !!(unit.target && preyAlive(unit.target));
    const t = unit.target && preyAlive(unit.target) ? unit.target : null;
    if (!t) return false;
    return preyDist(unit.x, unit.y, t) <= (unit.chasing ? 9999 : agentRange());
  }
  function draftAt(unit, dt, rate) {
    if (!unit || !rate) return 0;
    unit.idleAcc = (unit.idleAcc || 0) + rate * dt;
    let n = 0;
    while (unit.idleAcc >= 1 && n++ < 2) {
      unit.idleAcc -= 1;
      S.loc += 1;
      typeCode(8);
      S.debt += bugsPerLoc() * IDLE_DEBT; // tuned so 5× idle LOC does not instantly refill
      if (quality >= 2) {
        codeBursts.push({ x: unit.x, y: unit.y, life: 0.4, max: 0.4, tick: true });
        if (codeBursts.length > 24) codeBursts.shift();
      }
    }
    return n;
  }
  function idleWrite(dt) {
    if (S.paused || !S.optedIn) return;
    ensureDerick();
    ensureAgents();
    if (S.derick && derickEnt) {
      const rate = derickDraftRate();
      const firing = unitLasering(derickEnt, true);
      if (firing) derickEnt._firing = true;
      else {
        if (derickEnt._firing) {
          derickEnt._firing = false;
          seedIdleFromFire(derickEnt, rate);
        }
        draftAt(derickEnt, dt, rate);
      }
    }
    for (const a of agents) {
      const firing = unitLasering(a, false);
      if (firing) a._firing = true;
      else {
        if (a._firing) {
          a._firing = false;
          seedIdleFromFire(a, IDLE_AGENT);
        }
        draftAt(a, dt, IDLE_AGENT);
      }
      if (S.subagent && a.sub && a.sub.state === 'orbit') draftAt(a.sub, dt, IDLE_AGENT);
    }
    enqueueDebt('idle');
  }
  function econ(dt) {
    if (!S.optedIn || S.paused) return;
    if (canAutoSpawn()) {
      while (S.backlog > 0 && bugs.length + hatchQ.length < cap()) {
        S.backlog--; S.spawned--;
        requestHatch({ src: 'backlog' });
      }
    }
    // Occasional boss (never before Hire Derick; never during post-kill quiet)
    bossAcc += dt * (0.015 + Math.min(0.04, S.loc / 50000));
    if (bossAcc >= 1 && canAutoSpawn() && bugs.length < cap() && S.derick && !shipBoss) {
      bossAcc = 0;
      const b = spawnBug(null, null, { boss: true, tier: 4, src: 'boss' });
      if (b) { log(`${b.name} appeared.`); retargetQA(); }
    }
    mergeIfOver();
    idleWrite(dt);
    if (S.qa && canAutoSpawn()) {
      qaRevealAcc += qaRevealPerSec() * dt;
      while (qaRevealAcc >= 1 && bugs.length + hatchQ.length < cap()) {
        qaRevealAcc -= 1;
        requestHatch({ reveal: true, src: 'qa', tier: Math.random() < 0.45 ? 3 : 2 });
      }
    }
    pumpHatches(dt);
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
    updateFinale(dt);
    // agents with correct pierce
    ensureAgents();
    if (S.agentic && derickEnt) escortPhase += dt * 0.45;
    const range = agentRange();
    const ringN = escortCount();
    let escortI = 0;
    for (const a of agents) {
      a.beam = Math.max(0, a.beam - dt * 4);
      if (a.missile) {
        updateMissile(a, dt);
      } else if (S.agentic && derickEnt) {
        const slot = escortSlot(escortI++, ringN);
        a.x += (slot.x - a.x) * Math.min(1, dt * 5);
        a.y += (slot.y - a.y) * Math.min(1, dt * 5);
        a.target = pickLaserTarget(a.x, a.y, range);
      } else {
        a.x += (a.homeX - a.x) * Math.min(1, dt * 3);
        a.y += (a.homeY - a.y) * Math.min(1, dt * 3);
        a.target = pickLaserTarget(a.x, a.y, range);
      }
      if (a.missile) continue;
      const t = a.target && preyAlive(a.target) ? a.target : null;
      const boosted = agentBuffed(a);
      if (t && inLaserRange(a.x, a.y, t, range)) {
        addLaser(a.x, a.y, t.x, t.y, { wide: 0.9, life: 0.09, color: boosted ? LASER_COLOR.buffed : LASER_COLOR.agent, boosted });
        damageBug(t, agentCombatDps(a), dt, a);
        if (S.collision) {
          const second = nearestBug(t.x, t.y, range * 0.9, b => b !== t);
          if (second) {
            addLaser(t.x, t.y, second.x, second.y, { wide: 0.7, life: 0.08, color: boosted ? LASER_COLOR.buffed : LASER_COLOR.agent });
            damageBug(second, agentDps() * 0.55, dt, null);
          }
        }
      }
    }
    updatePulses(dt);
    if (S.subagent) for (const a of agents) updateSub(a, dt);
    pollHeartbeat();
    syncHbHud();
    pumpHatches(dt);

    for (let i = partN - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[partN - 1]; parts[partN - 1] = p; partN--; continue; }
      p.vy += 700 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = heartN - 1; i >= 0; i--) {
      const h = HEARTS[i];
      h.life -= dt;
      if (h.life <= 0) { HEARTS[i] = HEARTS[heartN - 1]; HEARTS[heartN - 1] = h; heartN--; continue; }
      h.vy += 220 * dt; h.vx *= 0.99;
      h.x += h.vx * dt; h.y += h.vy * dt;
      h.rot = (h.rot || 0) + (h.spin || 0) * dt;
    }
    for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= dt; if (splats[i].life <= 0) splats.splice(i, 1); }
    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }
    for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].life -= dt; if (lasers[i].life <= 0) lasers.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt * 2.6; if (g.t >= 1) ghosts.splice(i, 1); }
    for (let i = codeBursts.length - 1; i >= 0; i--) { codeBursts[i].life -= dt; if (codeBursts[i].life <= 0) codeBursts.splice(i, 1); }
    for (let i = shields.length - 1; i >= 0; i--) { shields[i].life -= dt; if (shields[i].life <= 0) shields.splice(i, 1); }
    for (let i = explosions.length - 1; i >= 0; i--) { explosions[i].life -= dt; if (explosions[i].life <= 0) explosions.splice(i, 1); }
    for (let i = hatches.length - 1; i >= 0; i--) { if (!hatches[i].hatching) hatches.splice(i, 1); }
    shake *= Math.pow(0.0005, dt); if (shake < .3) shake = 0;
    flash = Math.max(0, flash - dt * 2.5);
    if (hintUntil && now() > hintUntil) { hint.hidden = true; hintUntil = 0; }
    if (shipBoss) syncShipBar();
    updateConfetti(dt);
  }

  function getTextSprite(text, font, color) {
    const key = text + '\0' + font + '\0' + color + '\0' + DPR;
    let spr = textSprites.get(key);
    if (spr) return spr;
    const m = d.createElement('canvas').getContext('2d');
    m.font = font;
    const w = Math.ceil(m.measureText(text).width) + 6;
    const h = 32;
    const scale = Math.max(1, DPR);
    const c = d.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const cx = c.getContext('2d');
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    cx.font = font;
    cx.fillStyle = color;
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText(text, 3, h / 2);
    spr = { c, w, h };
    if (textSprites.size > 36) textSprites.clear();
    textSprites.set(key, spr);
    return spr;
  }
  function drawCachedText(context, text, font, color, x, y, align) {
    const spr = getTextSprite(text, font, color);
    const dx = align === 'center' ? x - spr.w / 2 : x;
    context.drawImage(spr.c, dx, y - spr.h / 2, spr.w, spr.h);
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
      drawCachedText(ctx, b.name, '700 10px ui-monospace, monospace', 'rgba(255,100,100,.9)', b.x, b.y - R[tier] * b.pop - 10, 'center');
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
    const sc = derickScale();
    const body = 6 * sc;
    ctx.save();
    if (heartbeatActive()) {
      const pulse = 1 + 0.16 * Math.sin(now() / 180);
      const glowR = (S.prestige >= 1 ? body * 3.6 : 20 * sc) * pulse;
      ctx.fillStyle = 'rgba(255,61,129,0.20)';
      ctx.beginPath(); ctx.arc(x, y, glowR, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,61,129,${0.38 + 0.22 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, glowR * 0.7, 0, 7); ctx.stroke();
    }
    if (S.prestige >= 1) {
      const beat = 1 + 0.12 * Math.sin(now() / 280);
      const s = body * HEART_DJ_SCALE * beat;
      ctx.fillStyle = 'rgba(255,61,129,0.2)';
      pathHeart(ctx, x, y, s * 1.14);
      ctx.fill();
      ctx.fillStyle = '#ff3d81';
      pathHeart(ctx, x, y, s);
      ctx.fill();
      drawCachedText(ctx, 'DJ', `800 ${Math.round(7.2 * sc)}px ui-monospace, sans-serif`, '#fff5f8', x, y + s * 0.06, 'center');
    } else {
      ctx.fillStyle = 'rgba(57,255,136,0.14)';
      ctx.beginPath(); ctx.arc(x, y, 14 * sc, 0, 7); ctx.fill();
      ctx.fillStyle = '#39ff88';
      ctx.beginPath(); ctx.arc(x, y, body, 0, 7); ctx.fill();
      drawCachedText(ctx, 'DJ', `800 ${Math.round(7 * sc)}px ui-monospace, sans-serif`, '#04120a', x, y + 0.5, 'center');
    }
    if (commandMode()) {
      ctx.strokeStyle = S.prestige ? 'rgba(255,61,129,0.5)' : 'rgba(61,224,255,0.5)';
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(x, y, body + 4 * sc, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  function drawRangeRings() {
    if (quality < 2 || !S.profiler) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(62,198,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (derickEnt && S.derick) {
      const rr = derickCombatRange();
      ctx.moveTo(derickEnt.x + rr, derickEnt.y);
      ctx.arc(derickEnt.x, derickEnt.y, rr, 0, 7);
    }
    const ar = agentRange();
    for (const a of agents) {
      if (a.chasing || a.missile) continue;
      ctx.moveTo(a.x + ar, a.y);
      ctx.arc(a.x, a.y, ar, 0, 7);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawAgent(a) {
    const boosted = agentBuffed(a);
    if (a.trail && a.trail.length) {
      ctx.save();
      for (const p of a.trail) {
        const al = Math.max(0, p.life / 0.28);
        ctx.globalAlpha = al * 0.6;
        ctx.fillStyle = a.missilePhase === 'out' ? 'rgba(255,177,66,0.95)' : 'rgba(62,198,255,0.8)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + al * 2.4, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    if (a.missile && a.missilePhase === 'out') {
      const ang = Math.atan2(a.vy || 0, a.vx || 1);
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.scale(1.65, 0.62);
      ctx.fillStyle = 'rgba(255,177,66,0.28)';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = LASER_COLOR.buffed;
      ctx.lineWidth = 1.35;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,140,0.95)';
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = boosted ? LASER_COLOR.buffed : (a.chasing ? 'rgba(62,198,255,0.85)' : 'rgba(62,198,255,0.55)');
    ctx.lineWidth = 1.15;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.stroke();
    ctx.fillStyle = boosted ? 'rgba(255,177,66,0.7)' : (a.chasing ? 'rgba(62,198,255,0.6)' : 'rgba(62,198,255,0.3)');
    ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, 7); ctx.fill();
    // Range rings are batched in drawRangeRings (skipped at low quality).
    ctx.restore();
    drawSub(a);
  }
  function drawSub(a) {
    const s = a && a.sub;
    if (!s || s.state === 'cd') return;
    ctx.save();
    if (s.trail && s.trail.length) {
      for (const p of s.trail) {
        const al = Math.max(0, p.life / 0.28);
        ctx.globalAlpha = al * 0.55;
        ctx.fillStyle = 'rgba(255,80,160,0.95)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.2 + al * 2, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (s.state === 'out' || (s.missile && s.missilePhase === 'out')) {
      const ang = Math.atan2(s.vy || 0, s.vx || 1);
      ctx.translate(s.x, s.y);
      ctx.rotate(ang);
      ctx.scale(1.45, 0.58);
      ctx.fillStyle = 'rgba(255,80,160,0.28)';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff3d81';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,230,0.95)';
      ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, 7); ctx.fill();
    } else {
      const pop = s.pop || 1;
      ctx.fillStyle = 'rgba(255,61,129,0.22)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 7 * pop, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,61,129,0.85)';
      ctx.lineWidth = 1.05;
      ctx.beginPath(); ctx.arc(s.x, s.y, 3.3 * pop, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,180,200,0.95)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 * pop, 0, 7); ctx.fill();
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
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#39ff88';
      if (c.tick) {
        drawCachedText(ctx, '{}', 'bold 9px ui-monospace, monospace', '#39ff88', c.x, c.y - 10 * (1 - a), 'center');
      } else {
        drawCachedText(ctx, '{ ++loc }', 'bold 10px ui-monospace, monospace', '#39ff88', c.x, c.y - 16 * (1 - a), 'center');
      }
    }
    ctx.globalAlpha = 1;
    for (const b of bugs) drawBug(b);
    drawShip();
    drawRangeRings();
    // thin lasers
    for (const z of lasers) {
      const a = z.life / z.max;
      if (z.boosted) {
        ctx.globalAlpha = a * 0.3;
        ctx.strokeStyle = LASER_COLOR.buffed;
        ctx.lineWidth = (z.wide || 1) * 3.1;
        ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
      }
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = z.color || LASER_COLOR.derick;
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
    if (quality >= 1) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,177,66,0.22)';
      let anyAura = false;
      for (const a of agents) {
        if ((a.missile && a.missilePhase === 'out') || !agentBuffed(a)) continue;
        ctx.moveTo(a.x + 10, a.y);
        ctx.arc(a.x, a.y, 10, 0, 7);
        anyAura = true;
      }
      if (anyAura) ctx.fill();
    }
    for (const a of agents) drawAgent(a);
    drawDerick();
    for (const e of explosions) {
      const u = Math.max(0, e.life / e.max);
      const r = e.r * (0.22 + (1 - u) * 0.85);
      ctx.globalAlpha = u * 0.7;
      ctx.strokeStyle = 'rgba(255,177,66,0.95)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.stroke();
      ctx.globalAlpha = u * 0.14;
      ctx.fillStyle = 'rgba(255,177,66,0.9)';
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.88, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < partN; i++) {
      const p = parts[i];
      const a = Math.max(0, p.life / p.max);
      const spr = sparkSprite(p.color || sparkColor(p.hue));
      const sz = p.r * 2.4;
      ctx.globalAlpha = a;
      ctx.drawImage(spr, p.x - sz, p.y - sz, sz * 2, sz * 2);
    }
    ctx.globalAlpha = 1;
    if (heartN) {
      const spr = getHeartSprite();
      for (let i = 0; i < heartN; i++) {
        const h = HEARTS[i];
        const a = Math.max(0, h.life / h.max);
        const sz = h.r;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot || 0);
        ctx.drawImage(spr, -sz, -sz, sz * 2, sz * 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of flashes) {
      const u = Math.max(0, f.life / f.max);
      ctx.globalAlpha = u * 0.22;
      ctx.fillStyle = 'rgba(255,177,66,0.9)';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.45 + (1 - u) * 0.7), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (flash && quality >= 2) {
      ctx.fillStyle = `rgba(61,224,255,${flash * .10})`;
      ctx.fillRect(-20, -20, Wd + 40, Hd + 40);
    }
    drawConfetti();
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
      (bugs.length || partN || heartN || splats.length || lasers.length || ghosts.length || codeBursts.length || pulses.length || shields.length || flashes.length || shipBoss || shake || flash || heartbeatActive() || S.derick || S.agents || S.shipPending || confettiN);
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
    if (suppressSave) return;
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
  if (S.shipPending) showShippedFanfare(false);
  if (S.optedIn && !S.paused) startLoops();

  W.__bugHunt = {
    S, get bugs() { return bugs; }, get derick() { return derickEnt; }, get agents() { return agents; },
    spawnBug, squash, addCode, rollback, ship, econ, optIn, pauseGame, quitGame,
    isBoss, clink, cap, idleWrite, idleCodeRate, qaRevealPerSec, mergeIfOver,
    pickBossName, agentBuffed, agentCombatDps, derickCombatDps, derickCombatRange,
    derickScale, derickRadius, LASER_COLOR, commandMode, escortRadius, escortSlot, updateDerick,
    escortCount, escorting, notePlayerClick, applyPlaySpace, PLAY_UNLOCK,
    launchMissile, detonateMissile, updateMissile, missileRadius, missileDamage,
    ESCORT_AURA, MISSILE_BOSS_FRAC, ensureDerick, ensureAgents,
    startFinale, winFinale, prestigeReset, confirmShip, showShippedFanfare, hideShippedFanfare,
    finaleMaxHp, finaleDpsEstimate, PULSE_BUFF, pulseBuffActive, applyPulseBuff,
    shipGoal, step, IDLE_DERRICK, IDLE_AGENT, IDLE_AGENTIC, IDLE_DEBT,
    get shipBoss() { return shipBoss; },
    pickThreat, noteDjPoke, pathHeart, PRESTIGE_BOSSES, prestigeBossPool,
    get blameReady() { return blameReady; },
    setBlameReady(v) { blameReady = !!v; },
    get konamiArmed() { return konamiArmed; },
    get djPokes() { return djPokes; },
    get heartN() { return heartN; },
    heartbeatActive, startHeartbeat, pollHeartbeat, spitHearts,
    HB_CLICKS, HB_WINDOW, HB_DURATION, HB_COOLDOWN, HB_MULT, HEART_DJ_SCALE,
    SUB_ORBIT, SUB_RESPAWN,
    forceHeartbeat() { heartbeatUntil = now() + HB_DURATION; heartbeatCdUntil = 0; },
    expireHeartbeat() { heartbeatUntil = 1; pollHeartbeat(); },
    clearHeartbeatCd() { heartbeatCdUntil = 0; hbTimes = []; },
    pickLaunchTarget, predictedMissileDamage, pendingOn, reserveOn, releaseOn, targetHasCover,
    launchPulseShot, ensureSubs, agentReadyForPulse,
    derickDraftRate, derickHitRadius,
    SHIP_NODES, liveShipNodes, pickShipNode, pickLaserTarget, makeShipNodes,
    syncShipNodePositions, syncShipHp, destroyShipNode, canReachShip, inLaserRange,

    get quality() { return quality; },
    setQuality(q) { quality = Math.max(0, Math.min(3, q | 0)); resize(true); },
    get spawnLog() { return spawnLog; },
    get hatchQ() { return hatchQ; },
    clearHatchQ() { hatchQ.length = 0; hatchWait = 0; hatchReadyAt = 0; },
    requestHatch, pumpHatches, enqueueDebt,
    HATCH_MIN, HATCH_SPAN, dprCapFor, currentDpr,
    get coarse() { return COARSE; },
    quietFor, noteFrame,
    stats() {
      return {
        bugs: bugs.length, backlog: S.backlog, parts: partN, lasers: lasers.length,
        splats: splats.length, ghosts: ghosts.length, bursts: codeBursts.length, shields: shields.length,
        pulses: pulses.length, hatches: hatches.length, typed, raf: !!raf, econId: !!econId, saveId: !!saveId,
        quality, dpr: DPR, fps: frameTimes.length ? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length) : 0,
        shopItems: ITEMS.filter(i => i.show()).map(i => i.id),
        nextUnlock: nextUnlock(),
        lastBoss: S.lastBoss,
        derickScale: derickScale(),
        commandMode: commandMode(),
        clicks: S.clicks, playSpace: !!S.playSpace, playUnlocked: !!S.playUnlocked,
        prestige: S.prestige || 0, ships: S.ships || 0,
        clearAcc, spawnQuiet: Math.max(0, spawnQuietUntil - now()),
      };
    },
    reset() { wipeProgress(); location.reload(); }
  };
})();
