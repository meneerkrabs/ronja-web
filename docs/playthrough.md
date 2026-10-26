# QA playthrough: "Nieuw spel" to the credits

Scripted, headless playthrough of the browser port following `docs/re/game-logic.md` §1.1 (30 steps, acts 1-3). Everything goes
through real input (mouse clicks on the canvas, the verb coin by holding the button, the bag with right click, the map, the choice
lines of the dialogues, the ESC menu, the "Sla over" button). Dev hooks (`globalThis.__ronja`, `?scene=&act=&g=&inv=`, `?debug=1`
state handles) are only used to *read* state, to find click targets (info-map regions) and, where noted, to finish a minigame
quickly.

## How to run

```
# own dev server with HMR and the file watcher off (restart after every source edit!)
node node_modules/vite/bin/vite.js --config /tmp/vite.qa.config.mjs        # port 5320, server: { hmr: false, watch: null }
# the whole game, from the logo to the credits (30+ minutes headless):
node tools/browse.mjs "http://localhost:5320/?mute=1&play=1&debug=1" tools/steps/playthrough.mjs --size 640x480
# resume a phase: QA_PHASES=a2 QA_FROM=11 with dev URL parameters (?scene=KOKET&act=2&g=...&inv=...)
```

* `tools/steps/playthrough.mjs`: orchestrator (`QA_PHASES=new,a1,a2,a3,x1,x2`, `QA_FROM=<step>`, `QA_PRE=<js>`).
* `tools/steps/pt/{new,act1,act2,act3,extras}.mjs`: the steps, one `step(n, title, fn)` per walkthrough step.
* `tools/steps/qa-lib.mjs`: helpers: `settle` (waits until nothing happens, presses movie skips), `verbRegion`/`clickRegion` (clicks the
  centre of an info-map region, scrolling the camera first by walking to the screen edge), `useItem` (bag, pick, drop), `combineItems`,
  `choose`/`converse` (dialogue choice lines), `goTo` (route over the exits), `mapTravel`, `saveLoadCheck`, `trySkip`, bots (river BFS,
  ski lane planner, cone/snowball aimers).
* Use 640x480 for speed: the 1280x960 page renders at 4 fps in the headless swiftshader and the movie-based ski run then plays at a
  quarter of the speed.

## What was played

| act | steps | how |
|---|---|---|
| start | logo.smk (skipped with the skip button), menu, Nieuw spel + JA, intro.smk (skipped), Formaning #0 (played out) | real clicks |
| 1 | 1 strap (HAND, REM), 2 tinder / flint / fire steel / rat trap, 3 drawer (EYE then HAND), key, chest (NYCKEL on the chest), map | verb coin, bag, drops |
| 1 | 4 tarn cones (mode 2), 5 river (mode 1), map travel back to BORGPORTEN, 6 ladder, Birk at Hell's Gap, REM on Birk | cones: real throws then dev win; river: complete by bot with real clicks |
| 1 -> 2 | ESC menu: save slot 0, move, load slot 0: scene, act, inventory, flags restored | real clicks |
| 2 | 7 Mattis (#80 -> #81), 8 Skalle-Per (#92 -> alt 2, #94, g8d7), 9 tarn: Birk stumbles #303, MOUTH Birk, fog (dimman.smk), REM on Birk (#520) | choice lines clicked |
| 2 | 10 ski run: skip offer during the 44 s intro, real steering with mouse moves, crashes and restarts from the checkpoints | real steering for 2 minutes, then `__ski.finish()` (see remaining issues) |
| 2 | 11 torch from Skalle-Per, stove (tinder, flint + steel combined in the bag, steel on the stove), torch lit; 12 Lovis helped (#58); 13 cellar lit (kallare.smk), cheese, carrots; 14 cheese in the trap, trap set, leave and re-enter, rat | bag, drops |
| 2 | 15 RATTA on the robbers + MOROTTER on the horses -> snowball fight (mode 5) | real throws, then dev win |
| 2 | 16 labyrinth (mode 4) by following the flame hints, prison, stone heap (#246, fangelse.smk, #256), Skalle-Per meeting (#228, SpelaTarning), dice (mode 8, clicks on the cup, "leave" answer), bread cake, bread to Birk -> spring.smk, act 3 | all real clicks |
| 2 -> 3 | ESC menu save slot 1 / load | real clicks |
| 3 | 18 hall, 19 Birk joins (#313), 20 GROTTANUTE: ask Birk (#416 -> alt 3 -> #419 -> alt 2 -> #421), stone pushed, cave defence (mode 6) | cave: real throws then dev win |
| 3 | 21 fire (tinder + ELDSTAL), 22 net, cast, leave and re-enter, salmon, 23 roast and eat the salmon, 24 vessel, fill at the spring, deliver -> summer.smk + grottan.smk, save/load in the cave | real clicks |
| 3 | 26 Lill-Klippen, 27 moss on the mare, horses, 28 river with the bird witch (mode 7) by bot, 29 Lovis (#480), 30 Mattis at the spring -> outro.smk -> eftertext.smk -> start screen | real clicks, movies skipped with the skip button |
| extras | x1: "Sla over" on the ladder dialogue (#172), the climb cutscene ("Sla over") and the Birk meeting #201; x2: talking to Birk with MOUTH/HAND/EYE in the act 3 forest scenes | |

Result of the last runs: see "Status" at the end.

## Fixes (file and reason)

1. `src/game/minigames/ski.ts`, `src/game/registry.ts`, `src/game/engine.ts`: the 44 s story part of `winter.smk` (frames 0-661)
   had no skip offer. New optional `Minigame.skipOffer()`; the engine's `skipOffer()` asks the running minigame first; the ski
   game offers "Sla film over" while the video has not reached the pause frame 0x296: it decodes silently up to that frame
   (`SkiVideo.fastForward`) and restarts the sound (`startAudio`). Checked: after the press the skiing starts within a second.
2. `src/game/world.ts` `Obj.standStill`: `standStillAtDestination` (FUN_00456e80) returns an error code without placing the object
   or reporting arrival when `dir == -1` and the facing is unset. In the original every object has learnt a facing from its first
   Still/Walk/Talk track; here BIRK has not before he first stands somewhere, so a walk with unset facing never reported
   arrival (callbacks of `walkTo`, `walkToTrackStart`, `usePortal`, dialogues hung). The object now stands facing S (not stored)
   and reports arrival. The workaround in `src/game/scenes/tjaernen.ts` (`BIRK.currDirec = 3` before the first act 2 visit) is removed.
3. `src/game/hooks/castle-cellar.ts` (`RONJA_7_132A1Say1_slapaStenar` end): the continuation after `fangelse.smk` was skipped when
   the movie callback got `aborted = true` (movie file unavailable), which left Ronja hidden for ever; it now always continues.
4. Dev/QA only (no gameplay effect): `src/game/index.ts` exposes `__ronja.dev` (dialogue, engine, registry, inventory and ui
   internals); `src/game/minigames/_mg.ts` `devHandle()` publishes minigame state in `globalThis.__mg` when `?debug=1`
   (`lake`, `cave`, `snowball`, `lab`, `dice`; each with a `win()` where useful); `__ski.finish()`.

## Findings that are not bugs (checked against the data / the decompile)

* BORGGARDEN has no KOKET exit region (region 2) in the winter map and KOKET's cursor region 2 is "normal" in winter: after the
  ski run the kitchen is reached through STORASALEN only.
* The GLUPAFALLET -> GROTTANUTE exit lies behind the river: it is only reachable by winning the river game; the way back is
  GROTTANUTE -> GLAENTAN -> KAELLAN.
* After a ski crash Ronja is placed at x = 320 and steers towards (mouse x + offset); the offset melts when the mouse moves (the
  browser cannot warp the cursor). A bot that does not move the mouse enough keeps crashing at the same obstacle.
* "Sla gesprek over" skips the running dialogue chain; the next dialogue event of a sequence (e.g. the ladder #172, then #201 at
  Hell's Gap) offers it again.

## Remaining known issues / not covered

* In the act 2 run the ski run is played for two minutes with real steering (crashes included) and then ended with `__ski.finish()`.
  The whole course with its natural end is covered by `tools/steps/ski-crash.mjs` (640x480). The ski run has no lose condition in
  the original (game-logic §5.7), a crash only costs time, so the test first leaves the mouse on x=320: Ronja falls at 794 and 810
  (no seek before 812, the video runs on during the fall), then at 977 (only the left lane is free at 977-981) again and again, each
  time back to checkpoint 812: without steering she never gets further (furthest frame 992). Then the lane bot steers from that
  checkpoint without a crash to the forced end crash at 2055, the end of winter.smk (Birk saves Ronja) plays and the video-end
  callback ends the run by itself: g8e0, BORGGARDEN, Ronja (400,400); no console errors. (The lane bot in `qa-lib.mjs` used to
  move to the lane of its plan's first lane change at once, also when the plan meant to wait first; that made it fall at 958 in
  the left lane every time. Fixed: the bot now takes the plan's action at the current frame.)
* Lake, cave and snowball: real throws (3-4 hits, 1 hit, 2 robbers) but the win is forced by the dev handle (`win()`); the
  lose path of the lake was seen (4 dwarves at the rock -> dialogue -> back at the tarn). The lose path of the cave game is
  covered by `tools/steps/cave-lose.mjs`: idling, the grey dwarves win after ~12 s (>= 5 at the rock), the game returns to
  GLAENTAN with Ronja (275,317) and Birk (227,319), g8df stays 0, walking back to GROTTANUTE and clicking the cave mouth starts
  the defence again; no console errors. The river-with-witch lose path is covered by `tools/steps/river-witch-lose.mjs`: on a stone in one of the witch's
  lanes (the start stone 46 is in lane D, where she only dives at a raft, so standing there is safe) the witch knocks Ronja
  into the water three times (~30 s), then carries her off (attack, catch, fall: river states 3 -> 10 after ~50 s); the game
  ends without g8e2, Ronja stands in GLUPAFALLET, Birk walks back, and clicking the river starts the game again; no console
  errors.
  The snowball fight has no lose condition in the original (game-logic §5.8); its "failure" is the 30 s recovery timer, covered
  by `tools/steps/snowball-timeout.mjs`: after 2 hits the throwing stops, the "Allafryser" warning plays ~23 s later (< 300
  ticks), at ~29 s every robber stands up again (hit/sit bits 0) and the fight goes on; the throw bot then got 4 of 5 robbers
  down three times and each time saw them recover 30 s after the last hit, so the win was again forced with `win()` (repeated:
  a single `win()` stalls when Fjosok is off screen, because he only sits down while visible). After the win: g8de, back in
  BORGGARDEN with Ronja at (478,341); no console errors.
* Only one order of the free parts of act 2 (7, 8, 9) and act 3 (21, 22, 23, 24) was played.
* Headless timing: on this machine the page ran at 4-30 fps depending on the load, so every wait in the scripts is generous.

## Status (last runs)

The whole game was played from "Nieuw spel" to the credits (outro.smk, eftertext.smk, back to the start screen) in **chained
segments**; each segment starts in the state the previous one ended in (resumed with `?scene=&act=&g=&inv=` only because a
single uninterrupted headless run does not fit in this environment, see below):

| segment | steps | result |
|---|---|---|
| S1 | new game, 1-6, save/load, 7-9, ski start (one browser session) | passed |
| S2 | 10 (skip offer, real steering) - 14 | passed |
| S3 | 15 (snowball) - 16 (labyrinth, prison, dice, bread) -> act 3 (spring.smk), save/load | passed (step 16 re-run after the last script change: labyrinth, prison, Skalle-Per, dice, bread, spring.smk, save/load OK) |
| S4 | 18-24 (Birk, stone, cave defence, fire, salmon, vessel, summer), save/load in the cave | passed |
| S5 | 26-30 (Lill-Klippen, mare, horses, river with the witch, Lovis, Mattis, outro, credits) | passed |
| x1 / x2 | "Sla over" on dialogue and cutscene (ladder, #201); map travel (BORGPORTEN, GLUPAFALLET, GROTTANUTE) | passed |

No console errors in any segment (`console errors: 0`). No stuck states other than those caused by the test harness (see below).

Environment notes for re-running: the Mac that ran this froze for 15-60 minutes at a time (sleep/suspend) while a run was in
flight, which made wall-clock time-outs fire and once reloaded the page; `qa-lib.mjs` therefore uses a `clock()` that ignores
gaps > 15 s. Run the segments one by one (`QA_PHASES`, `QA_FROM`) if a complete run is interrupted.
