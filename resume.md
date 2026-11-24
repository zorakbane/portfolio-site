# Derick Janssen

Principal Engineer · Game Programmer · Santa Barbara Games

This is the plain-text version of the resume at https://derickjanssen.com/. The designed PDF is /portfolio-site/resume.pdf.

- Email: zorakbane@yahoo.com
- Location: Based in the Greater Tampa Bay area · open to remote (hybrid/relocation for the right fit)
- GitHub: https://github.com/zorakbane
- LinkedIn: https://www.linkedin.com/in/derick-janssen-070137b
- Global Game Jam: https://globalgamejam.org/users/zorakbane

## Summary

An award-winning gameplay programmer who has led teams of up to 12 engineers. Passionate about gameplay, feel, tools, performance, and multiplayer. Excels at rapid prototyping and communication.

I'm a game programmer who loves the parts players feel: tight controls, juicy feedback, rock-solid multiplayer, and frame times that never hitch. I've led Skyrim VR from conception to launch, led Starfield's StarMap, and today I own Voidwood's deterministic rollback simulation at Santa Barbara Games.

Lately I've been building agentic AI workflows where coding agents drive in-game sub-agents to test and verify their own work. To me, reading code and understanding exactly what it does at a low level now matters more than typing it.

I work in Cursor and Claude Code every day, and I also use GitHub Copilot and ChatGPT. I've given talks in person at GR Dev Night in Grand Rapids (sold out), and at KVCC, MSU, WMU, and UCF.

Off the clock I'm a competitive gamer (8th of ~80,000 in GameStop's Super Smash Bros. Brawl national grand finals; Evolve Top 100 Goliath), a game jam regular, and happiest on a river in a canoe.

## Highlights

- ~1.5 ms: mean sim time, V-Rising-size world (Voidwood rollback ECS)
- +25%: server performance in my first week (ARK: Survival Ascended)
- 2× GOTY: Skyrim VR (Steam VR GOTY 2018) · Starfield (Xbox GOTY 2023)
- IGC Finalist: Indie Game Challenge 2010 · SMU Guildhall scholarship (Galactic Arms Race)

## Experience

- **Santa Barbara Games**, Principal Engineer (Remote), Jan 2025 – Present
- **Wicked Fox Games**, Senior / Lead Programmer (Remote), May 2024 – Jan 2026 (part-time, about 3 hrs/week, from Jan 2025)
- **Studio Wildcard**, Senior Programmer (Remote), Feb 2024 – May 2024
- **Bethesda Game Studios**, Senior / Lead Programmer (Dallas, TX), Jun 2016 – Jan 2024
- **S2 Games**, Senior Programmer (Kalamazoo, MI), Jun 2012 – Jun 2016
- **Evolutionary Games**, Programmer (Orlando, FL), Jul 2008 – May 2010

## Selected projects

### Voidwood, Santa Barbara Games

Principal Engineer · 12-person studio · reports to the CEO · Jan 2025 – Present · Unity · C# · ECS

1–4 player co-op survival horror. I own the deterministic multiplayer rollback netcode simulation, built on Unity ECS.

- Owner of the deterministic multiplayer rollback netcode simulation in ECS.
- Built a V-Rising-size world with a mean simulation time of ~1.5 ms.
- Foundation work: optimized, multithreaded finite-state machines that cut how many ECS systems the game needs. Voidwood runs on about 40 systems.
- Kept a performant build with no crashes or desyncs at each milestone.
- I use and build on Voidwood's AWS backend in Python: a game-data wrapper over the AWS database service, matchmaking, live ops, Photon Quantum webhooks, analytics, and build scripts that hook into Unreal Build Accelerator (UBA). I didn't write the UBA builder itself. The backend isn't public.
- Principal Engineer in a 12-person studio, reporting to the CEO.
- My agentic AI workflow lets 10 non-engineers ship pull requests. I run their process and review their PRs through it.
- Everyone at the studio except the CFO and the community manager uses my tools.
- Agent project rules keep coding agents from creating new systems by default.
- Built agentic AI workflows: a human asks a coding agent for a change, and the coding agent issues commands to in-game sub-agents that run in the game, verify the results, and do their own testing.

### Rise of Elements, Wicked Fox Games

Senior / Lead Programmer · Team of 20 · led 3 engineers · May 2024 – Jan 2026 (part-time, about 3 hrs/week, from Jan 2025) · Unity · C#

A PvP match-3 puzzle-battler with a PvE story mode — a faithful recreation of Force of Elements. I worked on nearly every part of the game except backend AWS server scaling.

- Led 3 engineers on a team of 20.
- Client/server game logic.
- UI.
- Added a cvar system that pulls from an online config.
- Added a debug board editor, and copy/paste of board states to help repro issues faster.
- Implemented a whole tutorialization and story-manager scripting system for the in-game tutorial and story mode.
- Touched nearly every aspect of the game except backend AWS server scaling.

### ARK: Survival Ascended, Studio Wildcard

Senior Programmer · Feb 2024 – May 2024 · Unreal Engine 5 · C++

Optimization, tools, and bug fixes on the Unreal Engine 5 remaster of ARK, including 25% more server performance in my first week.

- Gained 25% server performance in my first week.
- Identified Nanite/Lumen performance problems that severely limited client framerate.
- Optimization, tools, and bug fixes.

### Starfield, Bethesda Game Studios

Lead / Senior Programmer · 6 direct reports, incl. a junior UI artist and a junior producer I mentored · Released 2023 · Proprietary C++ engine

Feature lead for the StarMap. I later worked on Ship Building, Localization, Optimizations, and Outposts.

- Lead for the StarMap feature.
- Moved over from Skyrim VR after its launch, and kept mentoring the VR team.
- Six direct reports, including a junior UI artist and a junior producer whom I mentored hands-on.
- Later worked on Ship Building, Localization, Optimizations, and Outposts.
- Awards: Xbox Game of the Year 2023; Most Innovative Gameplay 2023

### Fallout 76, Bethesda Game Studios

Senior Programmer · Post-launch · Proprietary C++ engine

Brought on to ship post-release features: bulldozing, vending, and CAMP decorating. I also worked on the Nuclear Winter battle-royale mode.

- Shipped post-release features: bulldozing, vending, and CAMP decorating.
- Worked on the Nuclear Winter battle-royale game mode.

### Skyrim VR, Bethesda Game Studios

Lead Programmer · 12 engineers, all direct reports · Dec 2016 – Nov 2017 · Proprietary C++ engine

I spearheaded Skyrim VR from conception until launch, on both PSVR and Vive.

- Spearheaded the project from conception until launch (Dec 2016 – Nov 2017, PSVR launch).
- Led a team of 12 engineers, all direct reports.
- Touched or led every feature of the game except map mode.
- Did all of the Havok gameplay physics on Skyrim VR and Fallout 4 VR: wand-based weapon mapping for melee and projectile weapons, VR gestures, Doom VR-style lerp teleport movement, and player collision and bounds that keep players in the world across multiple movement techniques, with a snapback based on a Vitruvian Man golden-ratio body calculation.
- Team result: Sony asked us to port our PSVR stability changes back to the original Skyrim release after Skyrim VR showed 5% fewer crashes.
- Shipped on both PSVR and Vive.
- After launch, moved to lead Starfield's StarMap while continuing to mentor the VR team.
- Awards: Steam VR Game of the Year 2018; Golden Joystick Award 2018

### Fallout 4 VR, Bethesda Game Studios

Senior Game Programmer · Released 2017 · Proprietary C++ engine · AS3 UI

I built VR melee, polished teleporting and movement, created the Workshop mode in VR, and many new UI elements in AS3.

- Did all of the Havok gameplay physics (shared with Skyrim VR): wand-based melee and projectile weapon mapping, gestures, lerp teleport movement, and player collision and bounds.
- Created VR melee.
- Polished teleporting and movement.
- Created the Workshop mode in VR.
- Built many new UI elements in AS3.

### Agentic AI workflows

At Santa Barbara Games, my agentic workflow lets 10 non-engineers ship pull requests. Everyone at the 12-person studio except the CFO and the community manager uses my tools.

1. **Teammate**: A teammate who isn't an engineer asks for a change in plain language.
2. **Coding agent + project rules**: The coding agent works inside project rules: extend the existing systems and don't create new ones by default.
3. **In-game sub-agents**: The coding agent commands sub-agents inside the running game. They exercise the change, verify the results, and do their own testing.
4. **Pull request**: The change arrives as a PR, routed through the same workflow.
5. **My review**: I review their PRs and manage their process through the workflow.

Left alone, most coding agents want to create a whole new system for every request, which bloats an ECS codebase fast.
Our agent project rules make reuse the default: a request extends the existing systems, and a new system is never the agent's first move.

Much of my foundation work on Voidwood went into optimized, multithreaded finite-state machines. They handle work that would otherwise be spread across more ECS systems, so the game needs fewer of them.
Voidwood runs on about 40 ECS systems, with survival gameplay similar to V Rising. For scale, Unity's case study on V Rising cites 1,600 ECS systems. They're different games with different scopes, so it isn't a like-for-like count, but it shows how much a strong shared foundation removes.
The same world simulates in a mean of about 1.5 ms per tick.

Source for the V Rising figure: Unity: “V Rising: Behind the vampire realm built on 1,600 ECS systems” (Dec 9, 2024), https://unity.com/resources/stunlock-studios-v-rising

More: /portfolio-site/agentic-ai/

### Earlier games

- **Unannounced project** (Bethesda Game Studios, Senior Programmer): A multiplayer third-person game. Can't talk much about this one (NDA).
- **Savage: Resurrection** (S2 Games, Senior Game Programmer): A first- and third-person FPS/RTS hybrid. I did all of the commander coding, all of the combat and gun/spell logic, cosmetics, some UI, and character controls.
- **Strife** (S2 Games, Senior Game Programmer): A top-down 'second generation' MOBA with a ground-up reduced-toxicity design. I worked closely with designers and built ways for them to achieve what they wanted.
- **Force of Elements** (Side project, Programmer): Helped a friend ship a multiplayer versus puzzle-fighter game. Rise of Elements is a faithful recreation of it.
- **Chroma** (SMU Guildhall capstone, Lead Programmer (did all the programming)): A third-person multiplayer deathmatch with wall-walking on every level. Code-named Death Blossom.
- **Puppies In Spaaace!** (SMU Guildhall, Lead Programmer (did all the programming)): An all-ages first-person shooter. You play Puddles, a dog with shoulder-mounted tennis ball launchers, in a 3-stage boss battle against a vacuum cleaner piloted by a cat.
- **Cell** (SMU Guildhall, Lead Programmer (did all the programming)): A fast-paced 2D puzzle arcade shooter with RPG elements, started in Torque X 2D and converted to XNA.
- **Galactic Arms Race** (Evolutionary Games · Erin Hastings's research game (UCF), Programmer): I contributed client and server code, game design and Steam integration to Erin Hastings's research game on evolved procedural content (cgNEAT neural-network weapons). It's a 32-player online space shooter.

## Skills

- Languages: C++, C#, C, Python, Lua, ActionScript 3, Blueprint, UnrealScript, Java, JavaScript
- Engines: Unity (incl. ECS), Unreal 5 and 4 (also UDK, UEFN), Proprietary C++ engines, XNA, Torque
- Focus: Deterministic rollback netcode, Gameplay & game feel, Gameplay physics (Havok), Performance & optimization, Tools & pipelines, VR, Agentic coding & AI
- Infrastructure: AWS backend in Python (game-data DB wrapper, matchmaking, live ops, Photon Quantum webhooks, analytics), UBA build scripts (I use and build on them; I didn't write the UBA builder itself), CI on JanssEngine
- AI tools: Cursor and Claude Code daily, GitHub Copilot, ChatGPT

## Awards

- Steam VR Game of the Year (2018), Skyrim VR
- Golden Joystick Award (2018), Skyrim VR
- Xbox Game of the Year (2023), Starfield
- Most Innovative Gameplay (2023), Starfield
- Editor's Pick — Best AI in an Independent Game (2009), Galactic Arms Race · AIGameDev.com Awards — https://web.archive.org/web/20100317005917/http://aigamedev.com/open/editorial/2009-awards-results/
- Indie Game Challenge Finalist (2010), Galactic Arms Race
- SMU Guildhall Scholarship (2010), Galactic Arms Race · $50,000 scholarship announced by SMU, May 25, 2010
- AI Battle (school AI competition): 2nd place overall, Student AI DLLs under time and memory limits

## Education

- **SMU Guildhall**, Master's, Interactive Technology (programming track), 2010 – 2012. Full scholarship. Built our own engine and renderer from the ground up, and shipped games in Torque, UDK, and proprietary engines.
- **University of Central Florida**, B.S. Computer Science, minor in Mathematics, 2007 – 2010. President's List. Focused on AI, including graduate-level courses. Member of Upsilon Pi Epsilon (CS) and Pi Mu Epsilon (math) honor societies.

## Talks

- All of these talks were given in person. There are no public recordings.
- GR Dev Night, Grand Rapids — Game development (sold out)
- KVCC — Game industry primer
- MSU — How to transition from education to industry
- WMU — So you want to make games?
- UCF — Galactic Arms Race: NEAT and making games with it
