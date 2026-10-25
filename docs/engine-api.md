# Engine API (phase 1 core) — how to add scenes, hooks, minigames

The core in `src/game/` reproduces the engine of Game.exe (`docs/re/engine.md`). Per-scene logic, the 119 track hooks and the 8
minigames are *data you register*, never edits of the core. Everything you need is exported from **`src/game/api.ts`**:

```ts
import { O, T, g, setG, dispatch, usePortal, registerScene, hook, ... } from '../api.ts';   // from scenes/, hooks/, minigames/
```

Conventions: TypeScript with explicit `.ts` import extensions, `erasableSyntaxOnly` (no enums, parameter properties, namespaces),
`noUnusedLocals`. Quote the exe address / doc section of what you port in a comment (`FUN_0045bb80`, `game-logic.md §3.5`). Flags are
written like the documentation: `g(0x8d5)` = "g8d5", `setG(0x90d, 1)`. Tracks/subanis: `T(n)` / `S(n)` = name of HW handle `T<n>` / `S<n>`;
every function that takes a track accepts a Track, a **name** (case-insensitive) or a **HW handle number** (`O.MATTIS.loop(947)`).

## Files

| file | role |
|---|---|
| `engine.ts` | boot, `enterScene` (SetCurrentScene), click dispatch to scene scripts, minigame framework (`startMinigame`/`endMinigame`), main loop, skip offer, new game / quit |
| `world.ts` | the 49 `Obj`ects (`O.RONJA`, ...), track player (`setTrack`/`updateTrack`/hooks), walking (`walkTo`/`standStill`/`walkStep`), camera (`setPan`, `updateCamera`), `regionAt`, `inInv` |
| `pathfinder.ts` | BFS path finder on the scene's R map (4x4 px cells) + line-of-sight smoothing (the original's `walk` logic lives in `Obj.walkStep`) |
| `render.ts` | 12-bit ARGB4444 composition: background, objects sorted far->near, depth test vs. the Z layer, perspective scaling, UI blits |
| `dialog.ts` | hotspot groups + use counters, events, voice lines + lip sync (`playSound`), choice lines, `doDialogAni`, `dispatch` |
| `input.ts` | mouse/keyboard, cursors, verb coin (hold on the red-brown cursor 500 ms), inventory right click, ESC |
| `inventory.ts`, `map.ts`, `menu.ts`, `saves.ts` | inventory (16 items), map + travel, ESC menu + confirm box, 16 localStorage save slots (+thumbnail) |
| `portals.ts` | the 42 exits (`EXIT_<A>_to_<B>`), `usePortal`/`leavePortal`/`transition` |
| `audio-game.ts`, `music.ts`, `movies.ts` | single sample channel, master fade; XMIDI + DLS music; Smacker movies |
| `state.ts` | gVar (`gv`, `g`/`setG`, `F` flag names), use counters, `busy`, `lastDialog` |
| `registry.ts` | `registerScene`, `registerMinigame`, `hook`, `onNewGame` |
| `scenes/*.ts`, `hooks/*.ts`, `minigames/*.ts` | **auto-imported** (`register-all.ts`, `import.meta.glob`): add files here |
| `assets.ts`, `files.ts`, `inflate.ts` | data access (apc/trk/nfo/language/font, sync zlib), case-insensitive VFS wrapper |

Reference implementations (read these first): `scenes/borggarden.ts` (start sequence, groups, callbacks, item use),
`scenes/storasalen.ts` (remap, act/winter conditions), `scenes/koket.ts` (many pick-ups, item combinations), `hooks/act1-castle.ts`,
`hooks/act1-kitchen.ts`.

## Adding a scene script

One file per scene: `src/game/scenes/<scene>.ts`. Port the three parts the documentation lists per scene: **init**, **cursor**, **walk /
verbs / use item** (game-logic.md §3.x). Region ids are those of the scene's info map (`I` layer).

```ts
import { O, T, g, setG, inInv, dispatch, doDialogAni, usePortal, playMusic, registerScene, type SceneScript } from '../api.ts';

const script: SceneScript = {
  enter() {                       // SceneInitCallback: all objects are hidden, gfx is loaded; place/show things, start loops + music
    O.ELD2.loop(T(1286));         // loop a track forever
    if (!inInv(O.FNOSKE)) O.FNOSKE.setTrack(T(335));
    playMusic('dls_eld_40_', 127, 33.33);   // name, volume 0..127, tempo %
  },
  remap(r) { return r === 11 ? 7 : r; },     // optional: rewrite region ids by state before every handler
  cursor(r, x, y) { return r === 2 ? 'V' : 'normal'; },   // 'normal' | 'hilite' | 'N' 'NO' 'O' 'S' 'V' 'NV' | 'invisible'
  walk(r, x, y) {                 // plain click (verb 1): exits through portals, otherwise walk
    if (r === 2) return usePortal('EXIT_KOKET_to_STORASALEN');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },
  mouth: (r, x, y) => { if (r === 3) dispatch(88, 0, null, O.RONJA); },   // verb coin MOUTH (tala);  hand: HAND (ta);  eye: EYE (titta)
  useItem(item, r, x, y) { if (r === 6 && item === O.FNOSKE) doDialogAni(557, null, O.RONJA, false); },
};
registerScene('KOKET', script);
```

* Without a `walk` handler a plain click walks to the point; the other verbs do nothing by default (like the original: unhandled combinations are silent).
* `dispatch(group, v, doneCb, actor, force)`: v = 0 MOUTH, 1 HAND, 2 EYE of hotspot group `group`; picks the event by the group's use counter (last
  event with `minUse <= uses+1`, else the first) and plays it. `doneCb(cancelled)` runs once after the whole event chain; inside it
  `lastDialog.event` (last event id played) and `lastDialog.alt` (index of the chosen alt in that event, -1 none) are valid.
* `doDialogAni(eventId, doneCb, actor, force)`: with an `actor`, he walks to the start of the event's animation track (the track named like the
  event, first of its sync group) unless `force`, plays it, then the voice lines, then the choices / next event. `actor = null`: voices only.
* Coordinates passed to handlers are **scene** coordinates (screen x + pan). Find region ids with `tools/steps/regions.mjs` (below).
* Use `registeredScenes()` to make an exit conditional on another scene being ported (see `borgporten.ts`).
* Scenes without a script still load and are walkable (no exits): port them one by one.
* The gfx variant (winter, lit cellar, dimmed forest ...) is chosen in `engine.ts: sceneGfx()` by story state (already complete for all scenes).

### Objects (`O.NAME`, class `Obj`)
All 49 objects are global; `enterScene` hides all of them and stops their tracks (interrupted callbacks fire). The enter script re-shows what belongs.

| member | meaning |
|---|---|
| `holder` | `O.RONJA` = in the inventory, another object = carried/inserted, `null` = lying in its scene (story state, saved) |
| `x, y, z`, `scale`, `hidden`, `currDirec` | position (anchor = feet), depth (height-map z), perspective scale, visibility, facing 0..7 (0 N, 1 NW, 2 W, 3 SW, 4 S, 5 SE, 6 E, 7 NE) |
| `setTrack(track, flags?, cb?, sound?)` | start a track (shows the object); `cb(interrupted, track)` at its end/replacement. Flags: `TF_LOOP` (+`(n<<4)` = n+1 plays), `TF_HIDE_AT_END`, `TF_TALK`, `TF_KEEP_CB` |
| `loop(track)` | `setTrack(track, TF_LOOP)` |
| `stopTrack()`, `show()`, `hide()` | |
| `setPosition(x, y, z)`, `moveRelative(dx, dy, dz)` | position (recomputes depth/scale); relative moves are multiplied by the scale |
| `standStill(x, y, z, dir=-1, interrupted=true)` | stand at the point facing `dir` (-1 keep) with the stand track; fires and clears a pending move callback |
| `walkTo(x, y, z=0, cb?, finalDir=-1)` | walk along the path (R map); `cb(false)` on arrival, `cb(true)` if interrupted; < 16 px: turns/stands and arrives at once; unreachable: nothing |
| `walkToTrackStart(track, cb)`, `walkAndPlay(track, done?)` | walk to where a track begins (key 0), then play it |
| `playing` | current `Track` or null (`.name`); `walking` |
| `hitTest(sx, sy)` | pixel-accurate test at a *screen* point (for the act 3 Birk clicks) |

Only RONJA and BIRK have stand/walk/talk track sets (`setDefaultTrackSets`, engine.md §1.3); other objects are driven by explicit tracks.
`O.RONJA.walkStep()` runs in the main loop every 66 ms for RONJA and BIRK only.

### Portals
`usePortal('EXIT_A_to_B', leave?, arrive?)` walks Ronja to the exit, plays its leave track (`undefined` = default of the table, `null` = none, a
name = override), then `transition`: `enterScene(B)` -> pan = floor(x/640)*640 -> Ronja at the partner portal facing its direction mask, plays the
partner's arrive track. `leavePortal(...)` skips the walking (ladder). `transition(...)` skips walking and leave track (map travel).
In act 3 Birk is placed at the partner's Birk position. The table is `PORTALS` in `portals.ts` (all 42 rows of engine.md §3.7).

### Scene changes
`enterScene(name, { force?, minigame?, gfx? })` = SetCurrentScene: stops samples + music, hides all objects, loads gfx, runs the enter script.
It does **not** set the pan (callers do: `setPan(640)`); each scene remembers its last pan. After `enterScene` the caller places Ronja
(`R.followGround = true; R.standStill(x, y, 0, dir)`), see `hooks/act1-castle.ts` and `devJump` in `api.ts`.
Mid-script scene changes are allowed everywhere (hooks, dialog callbacks, minigame ends).

## Adding a track hook

`src/game/hooks/<anything>.ts`. The original binds 128 C++ callbacks to tracks by name (`docs/re/game-logic.md §4.2`: slot, trigger, effect, what starts the
track). A hook fires for **whatever object plays the track**, including lip-sync tracks of voice lines.

```ts
import { O, hook, setG } from '../api.ts';
hook('RONJA_1B_542A1_TASKINNREM', { start: () => O.REM.hide(), key: { 8: () => { O.REM.holder = O.RONJA; } } });
hook('RONJA_1D_428A1_TANDASPISB', { end: () => setG(0x8e8, 1) });
```
* `start` = track started (before key 0), `key: {n: fn}` = key n became current (n >= 1; fires on every loop pass), `end` = reached its end naturally.
  Interrupted tracks (replaced, `stopTrack`, scene change) fire **no** end hook. Raw form: `registerHook(track, (code, obj) => ...)` with
  `HOOK_START`, `hookKey(n)`, `HOOK_END`.
* Handlers get the object that plays the track. Registering a name twice: the last one wins (the original table has one such overwrite,
  `DJUR2_2a_094A1Say1_HastGnagg`, only the later effective entry exists).
* Hooks may call anything (`enterScene`, `setTrack`, `playMovie`, `finishDialog`). End hooks that change scene should call `finishDialog(false)` first when the
  original calls `dialogEnd(0)` (see `ronja_3_106A1Say1_KrangPaDejB`).

## Follow-up (chained) tracks
Nothing to register: the 46 pairs of `src/data/ronja.hw.json` (`trackFollowUps`) are applied by the track player: when A ends naturally, B starts on
the same object with `TF_KEEP_CB`, so the object's end callback fires only after the last track of the chain; the hook for A's end fires first.

## Adding a minigame

`src/game/minigames/<name>.ts`; mode 1..8 (g8c0). `_stubs.ts` registers placeholders (they never replace a real registration).

```ts
import { O, registerMinigame, endMinigame, enterScene, startMinigame, depthVol, sample, type Minigame } from '../api.ts';
registerMinigame({
  mode: 2,
  start(args) { /* scene gfx is loaded (TJAERNEN); objects hidden; set up state, show/position objects, play music */ },
  tick() { /* every 20 ms of game time (the 50 Hz timer) */ },
  click(x, y) { /* any verb, scene coordinates */ },
  cursor(x, y) { return 'prickaKotte'; },   // a CursorKind or 'forsenHilite' | 'prickaRovare' | 'prickaKotte'
  draw(r) { /* optional overlay: r.drawStream(name, frame, x, y), r.fillRect(...) */ },
  end() { /* cleanup, called by endMinigame() */ },
});
```
* Start from a scene script / hook with `startMinigame(mode, args?, scene?, gfx?)` (scene per mode: 1,7 GLUPAFALLET; 2 TJAERNEN; 3,5 BORGPORTEN winter gfx; 4 LABYRINT
  (pass the room: `startMinigame(4, args, 'LABYRINT', sceneGfx('LABYRINT', '<room>'))`); 6 GROTTANUTE; 8 BRAEDSPEL). It sets `gv.mode`, so **the normal
  handlers, ESC menu, inventory, verb coin and cursor logic are disabled** and `click`/`cursor`/`tick`/`draw` of the mode are used.
* Finish with `endMinigame()` (calls `end`, mode back to 0) and then switch scene / start the follow-up (`enterScene(...)`, place Ronja).
* Sounds: `sample.play(name, vol, pan, loops)`, `sample.effect(...)` (skipped while a sound plays — original semantics), `masterFade(target, ms)`, `depthVol(z)`.
* Timing: `tick` is called in a loop so it never loses steps (clamped to 25 per frame). Game time = `gameNow()`.

## State and flags (`state.ts`)
`gv.mode/act/scene/mapBits`, `g(addr)` / `setG(addr, v)`, `F.<name>` addresses (partial list), `winter()` (act 2 && d5 && d6 && d7), `inInv(obj)` (carried directly or
inside a carried item), `useCount` (143x3), `busy.bits` (non-zero = invisible cursor, clicks ignored; use `BUSY_*` from `types.ts`), `lastDialog`.
Everything above plus object holders/positions, scene, pan and Ronja/Birk is saved (`saves.ts`). New game: `onNewGame(fn)` runs after the gVar reset
(objects' holders are reset by the core).

## Dialogue, voice and choices (`dialog.ts`)
* Data: `EVENTS` (746), `eventById`, `eventByName('_2a_002A1_Formaning')`, `pickEvent(group, v, n)`. Says have no subtitles; only choices are shown (bottom, left aligned,
  max 5; click left of the end of the text).
* `playSound(name, cb)`: voice line + the lip-sync tracks of its sync group on their actors; talk loops run while the sample plays. Sounds are fetched on demand (the
  game clock pauses while loading; events prefetch their lines).
* `addChoiceLine(text, cb)` / `clearChoiceLines()` for custom choices (cheats-style lines), `dialogActive()`, `choosing()`, `finishDialog(cancelled)`, `abortDialog()`.
* "Sla over" while a dialogue runs fast-forwards its animations (hooks still fire).

## Audio (`audio-game.ts`, `music.ts`)
`sample.play(name, vol=100, pan=64, loops=0)` (voices: vol 100 pan 64; one channel — a new sound cuts the old one), `sample.effect(name, vol, pan)` (only if idle),
`sample.stop()`, `sample.playing(name?)`, `prefetchSounds(names)`. Sound names are file names without `.wav` (`RONJA_2a_003A1Say1_DetDarArMattis`, `EFFEKT_13_1_plask`).
`playMusic(name, vol, tempoPct)` always restarts and loops forever (names like `dls_borggarden__`); `stopMusic()`, `fadeMusic(vol, ms)`. Scene changes silence everything.

## Movies (`movies.ts`)
`playMovie('intro.smk', 64, 69, (aborted) => ...)`: x,y = top-left on a black screen ((64,69) for 512x344, (0,0) for 640x480); scene rendering and input are
suspended; the skip button ends it (callback still runs). Files stream from the ISO; `prefetchMovie(name)` starts early.

## Testing (headless — never use the user's browser)
```
npx vite --port 5299 --strictPort &                       # kill it when done
node tools/browse.mjs "http://localhost:5299/?mute=1&scene=KOKET&x=300&y=330&g=912,8e0&inv=REM" tools/steps/scenes.mjs --size 1280x960
```
Screenshots land in `/tmp/bdb-shots/*.png`. `tools/steps/*.mjs` are working examples (hold the coin, dialogues, portals, save/load, map, skip, minigame stub).
Steps get `{ click, down, up, move, key, wait, shot, evaluate, log, page }`; `click/move/down/up` take logical 640x480 coordinates (right button: `{button:'right'}`).
URL parameters: `mute=1`, `play=1` (skip the start screen), `scene=NAME` (jump; skips logo/intro) with `x`, `y`, `dir`, `act`, `g=8e6,90d` (flags, hex), `inv=REM,KARTAN`,
`mapbits=3`, `debug=1`, `source=archive` (stream from archive.org instead of `public/data/ronja/`). `globalThis.__ronja` exposes the whole API plus `world`, `gv`, `O`.
Dev data: copy the CD's `ronja/` folder to `public/data/ronja/` (gitignored) and run `node tools/make-dev-manifest.mjs`.
`tools/steps/regions.mjs` prints the info-map region ids of the current scene as a character grid (20 px) — use it to map regions to the doc's region table.

## Faithfulness notes / known gaps
* Implemented from decompiled code: track player (key timing, loops, hooks, follow-ups, sound start, lip-sync loop jumps), walk step (66 ms), path finder, depth + scale,
  dialogue engine, hotspot dispatch, coin geometry, inventory slot quirks, map, menu pages, save contents, camera jumps. Rendering is redrawn fully at <= 25 fps.
* Stream flag 2 sprites are opaque rectangles baked with the background: drawn unscaled, depth-tested, no alpha (engine.md §2.4).
* Inferred / not verified: the exact walk-step arrival test (decompile lost x87 operands, `Obj.walkStep`), BIRK's talk track set (`setDefaultTrackSets`),
  `standStill` callback argument convention (public calls report `interrupted=true`, walk arrival `false`).
* Not implemented: cheat codes (engine.md §4.8), the Ronja-over-movie overlay of the ski game, the interactive `winter.smk` seek/pause (minigame 3), stand-in
  placeholders for all 8 minigames (`minigames/_stubs.ts`), scenes other than SKALLEPERSRUM, LOVISMATTISRUM, STORASALEN, KOKET, BORGGARDEN, HELVETESGAPET, TORNET, BORGPORTEN,
  and the hooks of the other scenes. The credits (`eftertext.smk`) play after "Afsluiten" and return to the start screen.
* Per-key sprite cache: decoded frames are memoised per stream (`GameAssets.frame`) and trimmed at scene changes above ~350 MB.
