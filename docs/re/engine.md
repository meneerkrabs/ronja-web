# Ronja de Roversdochter (2001) — engine behaviour specification

Reverse-engineered from `Game.exe` (MSVC 5 / MFC, 800 256 bytes, file date 31 Oct 1998) of the Dutch release
(O2Games/Malmberg, published by Halloween). Goal: enough detail to re-implement the game faithfully in
TypeScript for the browser. This document covers the **engine** (program flow, world model, rendering,
interaction, audio, timing). The **story, puzzles, per-scene scripts and minigames** are in
[`game-logic.md`](game-logic.md); the **byte-level file formats** are in [`formats.md`](formats.md).
The static dialogue/event database extracted from the exe is in [`data/dialog-events.json`](data/dialog-events.json);
the hard-wired asset handle tables, track callbacks and follow-up tracks are in `src/data/ronja.hw.json`
(see formats.md §1).

Conventions
* Addresses are virtual addresses in `Game.exe` (image base 0x400000). `FUN_xxxxxxxx` = Ghidra function,
  `LAB_xxxxxxxx` = code only present in the disassembly. "L1234" = line in the Ghidra dump `Game.c`.
* Track/subani handles: `T<n>` = track HW handle `0x900000+n`, `S<n>` = subani HW handle `0x800000+n`
  (names: `src/data/ronja.hw.json`). Event `#n` = dialog event id n (data/dialog-events.json); `G<n>` = hotspot group n.
* gVar fields are written `g8xx` = byte/int at `0x4cf8xx` (see game-logic.md §2 for the full table).
* **UNCERTAIN** marks inferences that were not fully verified. Numbers without that mark were read from code.
* Original source files (from assertion strings): `GEngine\HWLayers\DirectX\DXLayer\DXLayer.cpp`,
  `...\SmackerIntf\smkintf.cpp`, `...\DXSurface\DDSurf.cpp`, `GEngine\RLayers\2DSprite\2dsprite.cpp`,
  `...\Ani2DSprite\Ani2DSprite.cpp`, `...\GenericTextWriter\GenericTextWriter.cpp`, `GEngine\ResourceMan\...`,
  `GEngine\Scurr\Scurr.cpp`, `...\ScurrPortals.cpp`, `Ronja\APCpacker\APC.cpp`, `Ronja\Game\GameDlg.cpp`,
  `SceneTab.cpp`, `TracksTab.cpp`, `scurrCon.cpp`, `Ronja\Scurr\gVar.cpp`, `ronja.cpp`, `scurrImp.cpp`,
  `scurrimp.inl`, `serials.cpp`, `tracksHWfunc.cpp`, `CursorCallback_NormalGame.inl`,
  `SceneInitCallback_NormalGame.inl`, `Ronja\SCURR\tatita.inl`. Credits strings name the programmers:
  Ulrik Lindahl (main programming, SCURR and UI) and Tobias Andersson (script & sound programming).

Address map (code)

| range | module | content |
|---|---|---|
| 0x401000-0x408200 | GameDlg.cpp, tatita.inl | CGameDlg: window, init, main-loop thread, input, cursor, verb coin, inventory/map/menu UI, choice lines, cheats |
| 0x408000-0x41a700 | GEngine RLayers/HWLayers | sprites, APC decoder, DirectDraw layer (blit list, dirty rects, Smacker), font |
| 0x41a5f0-0x41b4b0 | path finder | BFS on the R layer |
| 0x41c000-0x421000 | gVar.cpp | event/dialog tables, language.str loader, gVar serialisation, RONJA object class + timer dispatch, LabyrintList/stone tables |
| 0x421000-0x431800 | ronja.cpp | minigames (labyrinth, rivers, dice, lake, cave, ski, snowball) as methods of RONJA |
| 0x431800-0x44ff00 | static initialisers | 746 events, 827 says, 173 alts, 143 hotspot groups (+ snowball code at 0x432720) |
| 0x44ff00-0x452000 | serials.cpp | name/serial/handle tables, subani/track/sound registration |
| 0x451bf0-0x454640 | tracksHWfunc.cpp (asm only) | 128 track hooks (story side effects) |
| 0x452000-0x45a600 | Scurr.cpp | theScurrOS, objects, tracks, walking, timers, sound requests; portal & object static ctors |
| 0x45aeb0-0x45d650 | SceneInitCallback_NormalGame.inl | per-scene enter scripts |
| 0x45d650 | scurrimp.inl | SetCurrentScene |
| 0x45e010-0x46a540 | CursorCallback_NormalGame.inl + scurrImp | per-mode/per-scene cursor, click, item-use handlers |
| 0x46a540-0x46fc00 | scurrImp.cpp | init, dialog engine, inventory list, save/load, PlaySmackerFile |
| 0x46fce0 | ScurrPortals.cpp | scene transitions |
| 0x470000-0x478f40 | TracksTab.cpp etc. | in-game developer track editor (unused by the game) |
| 0x479000-0x47c000 | smkintf / sound | Smacker + Miles Sound System wrappers |

---------------------------------------------------------------------------------------------------

## 1. Program flow

### 1.1 Launcher and installation
- CD autorun (`AUTORUN.INF`: `OPEN=start.exe`) runs **start.exe**, a Macromedia Director projector (`edit_start.txt`: Lingo `new(script "main", [#file_name:"ronja.exe"])`), which shows the CD menu and launches `ronja.exe`.
- **Ronja.exe** (identical in CD root and `ronja/`; MFC dialog, `Ronja.c` FUN_00401580): reads `HKLM\Software\O2Games\Ronja` (`SCURRglobExePath`, `SCURRglobSmackerPath`, …). Buttons "Ronja de Roversdochter installeren" / "Ronja de Roversdochter starten", quit confirm "Ronja de Roversdochter afsluiten?". Start: checks the CD by opening `<SmackerPath>\logo.smk`, looping with "Doe de cd-rom van Ronja de Roversdochter in de cd-romspeler…" (Cancel aborts); then `ShellExecute("%sgame.exe")`; on failure "Het was niet mogelijk het spel te starten. Wil je Ronja de Roversdochter opnieuw installeren?" → `install.exe`. If not installed: runs `install.exe`.
`Game.exe` reads its data paths from the registry key `HKLM\Software\O2Games\Ronja`: `SCURRglobSubanisPath`
(default `subanis`), `SCURRglobTracksPath` (`tracks`), `SCURRglobSoundsPath` (`sounds`), `SCURRglobSmackerPath`
(`smacker`); `language.str`, `scene.nfo`, `normalFont.*` and the save games `RONJAS<n>.sav` live in the
current directory. A port only needs the data files; the launcher is not needed.

### 1.2 Windows message map (CGameDlg, table 0x4825b8)

| msg | handler | role |
|---|---|---|
| WM_PAINT | 0x4017a0 | 1st call: MoveWindow; 2nd call: full engine init (see §1.3); later: `updateWholeScreen` |
| WM_SETCURSOR | 0x404e70 | `SetCursor(NULL)` — Windows cursor hidden; a software cursor sprite is drawn |
| WM_DESTROY / WM_CLOSE | 0x403140 / 0x403170 | shutdown 0x403300 |
| WM_KEYDOWN | 0x405710 | ESC menu, Ctrl+Q, cheat codes (§4.8) |
| WM_KEYUP | 0x405c40 | clears the Ctrl-held flag (0x4c80ec) |
| WM_LBUTTONDOWN | 0x405db0 | §4.1 |
| WM_LBUTTONUP | 0x4063f0 | §4.1 |
| WM_RBUTTONDOWN | 0x4065e0 | inventory toggle (§4.5) |
| WM_MOUSEMOVE | 0x404e80 | stores cursor pos (dlg+0x358/0x35c, clamped 0..639 / 0..479) and applies cursor clamps (§4.1, §4.6, §4.7) |

### 1.3 Start-up sequence
1. **OnInitDialog 0x4016b0**: window topmost, 640x480, title "Ronja Game"; clears all UI flags; `FUN_00407720` builds the font metric table (16x16 cells, per-glyph widths, then overwritten by `normalFont.sz`, 0x1400 bytes); `FUN_00406730` starts the **main-loop thread** (`AfxBeginThread(0x4067b0, dlg, priority 2)`); `srand(time())`.
2. **First WM_PAINT** only moves/invalidates the window. **Second WM_PAINT** (0x4017a0, L423-1600):
   - Registry `HKLM\Software\O2Games\Ronja` (FUN_00401640): `SCURRglobSubanisPath` (default `subanis`), `SCURRglobTracksPath` (`tracks`), `SCURRglobSoundsPath` (`sounds`), `SCURRglobSmackerPath` (`smacker`).
   - `FUN_00403190`: sound system, `initSerials`, DirectDraw init, **fullscreen 640x480x16**, clear screen.
   - QPC timer reset (ms clock `DAT_004c4270`, FUN_00401420; pause/resume 0x4014b0/0x4014d0).
   - `RonjaSCURRInitialize` 0x46b5d0; `normalFont.fnt`; 640x100 off-screen text surface.
   - Sprites/blit surfaces (z-order value in brackets): cursor sprite [25] (starts with `___###_stdCursor` 542, replaced on the first frame); **tatita** sprite 112x103 [23] with subanis 550 normal, 553 TittaHilite, 551 TaHilite, 552 TalaHilite, 541 `_main__###_USure`; **inventory** sprite 640x480 at (0,0) [21] with 539 `_inv__###_MainGfx`, 540 `_main__###_MainGfx`, maps 508..529 (530 map23 is *not* pre-added, see §4.6); **20 inventory item sprites** 70x70 [22]; **5 text-line blit surfaces** 640x20 [15] at screen y = 380, 400, 420, 440, 460 (source rows 0,20,40,60,80 of the text surface).
   - Clear text lines (0x46cdc0), clear "dialog busy" flag (0x404e60).
   - Default track sets (8 directions, index 0=N,1=NW,2=W,3=SW,4=S,5=SE,6=E,7=NE): RONJA stand = stillNorr, stillNV, stillVast, stillSV, stillSyd, stillSO, stillOst, stillNO (T 559,554,558,556,560,555,557,553); walk = GoN, goNV, goVast, GoSV, GoS, GoSO, GoO, GoNO (T 148,150,137,138,139,147,146,149); talk = talNV,talNV,talSV,talSV,talSO,talSO,talNO,talNO. BIRK stand = birk stillNorr..stillNordOst (T 524,523,529,528,526,527,525,522), walk = birk Go* (T 495,497,494,501,499,500,498,496), talk = talSO/talSV alternating.
   - `SetCurrentScene(&BORGGARDEN, true, 0, true)` (L1565) → scroll 640 (FUN_0046b530) → main loop enabled (dlg+0x5fa = 1).
3. **BORGGARDEN scene-init callback 0x45bb80** decides what happens (SetCurrentScene calls it synchronously):
   - gVar **0x911 == 0** (fresh launch): scroll 640, `PlaySmackerFile("logo.smk", cb 0x45bb60, 0, 0)`. Callback: 0x911 = 1 and **open the main menu** (0x404230). Because 0x912 == 0 the menu uses frame 3 ("Bewaar spel" greyed out/disabled).
   - else gVar **0x912 == 0** (new game not started yet): scroll 640, `PlaySmackerFile("intro.smk", cb 0x45ba30, 64, 69)`. Callback 0x45ba30 (game start): STEGE track 0x45e (`STEGE_2a_gen_LiggandeStege`) or 0x45f (`Stege_2a_gen_restStege`, if 0x8dc set and not the chapter-2 d5/d6/d7 state); HINDER track 0x2a5 (`HINDER_2a_625A1_VaktPaMuren`); scroll 640; RONJA track 0x2c6 (`RONJA_2A_002A1_Formaning`); `DoDialogAni(event 0 "_2a_002A1_Formaning", cb 0x45ba00)` (cb puts MATTIS on `mattis_2a_gen_PaBorggarden`); LOVIS `Lovis_2a_gen_PaBorggarden`; **0x912 = 1**; music `dls_borggarden__` (loop, vol 0x7f).
   - else: normal BORGGARDEN entry (chapter music `dls_borggarden__` / `dls_borggardenvinter__`, actor placement — see game-logic.md §3).
4. So the visible order is: **logo.smk → main menu → (Nieuw spel or ESC) → intro.smk → BORGGARDEN, event "Formaning"**. Closing the initial menu with ESC also starts the intro (0x404520 plays intro.smk whenever 0x912 == 0 and the game is not ending).

Init order inside `FUN_00403190` (L1686): `SCURR_initializeSoundSystem` (0x47a470) → `initSerials` (0x44ff00:
loads `subanis.apc` directory, `tracks.trk`, scans `sounds\`, resolves the HW handle tables, resets the
143×3 use counters) → DirectDraw init → `setFullscreenMode(640,480,16)` → `clearScreen`. Then
`RonjaSCURRInitialize` (0x46b5d0): creates theScurrOS, the 49 objects (§3.1), the 21 scenes (reads `scene.nfo`),
the 640×480 scene-background surface, loads `language.str`, installs the 50 Hz timer hook. It places nothing:
initial positions come from the scene scripts.

### 1.4 Main loop (game thread)
The real game loop is an MFC worker thread `LAB_004067b0` (asm only, priority HIGHEST, started by
`FUN_00406730` from OnInitDialog). The UI thread only receives Windows messages and sets state.
Per iteration (`dlg+0x5fb` = "inside frame"; if not initialised: Sleep 500; if suspended by SetCurrentScene,
`dlg+0x5fa==0`: Sleep 50):
1. Update the real-ms clock and the game clock (§6).
2. `walkAcc += realNow − realPrev`, clamped to 0..1000 ms. **While `walkAcc > 66`: walk step for RONJA and BIRK**
   (`FUN_00457190`), `walkAcc −= 66` → fixed 66 ms walk tick (~15 steps/s). No other object walks on paths.
3. `updateTrack` (`FUN_00456360` → `FUN_00455cc0`) for all 49 objects in objId order (RONJA … VILDVITTRA).
4. Camera (§3.9).
5. Ronja-over-video overlay position (`FUN_0041a000`, only used by the ski game, §2.9).
6. Cursor/UI update `FUN_00404f60` (§4.2).
7. `FUN_0046ce30(0)`: re-blit every object whose dirty flag (+0x265) is set (`FUN_004567b0`).
8. Render `FUN_004194f0` (scene composition, or the current Smacker frame while a movie plays).
9. Frame cap: if the frame took < **40 ms**, `Sleep(40 − elapsed)` → **max 25 fps** (no sleep during movies).
10. `dlg+0x21a` (end credits finished) → `OnOK` → program exits.

Minigame logic does not run in this loop: it runs in RONJA's 20 ms SCURR timer, driven by the Miles 50 Hz
timer thread (§6). Game thread and timer thread share data under the critical section `DAT_004e1ff0`
(all track calls). A port can run everything in one `requestAnimationFrame` loop with accumulators:
walk 66 ms, minigame 20 ms, render ≤ 25 fps (or faster; animation timing is per key in ms).

### 1.5 Movies, credits and game end
Movie files (all Smacker 2, header rate 15 fps, forced to 15 fps by the game):

| file | w x h | frames | ~duration | audio | drawn at (x,y) |
|---|---|---|---|---|---|
| logo.smk | 640x480 | 337 | 22.5 s | none | 0,0 |
| intro.smk | 512x344 | 2868 | 191 s | 44.1k 16b st | 64,69 |
| kallare.smk | 640x480 | 30 | 2.0 s | none | 0,0 |
| fangelse.smk | 640x480 | 39 | 2.6 s | none | 0,0 |
| grottan.smk | 640x480 | 45 | 3.0 s | none | 0,0 |
| helvetesgapet.smk | 512x344 | 1130 | 75 s | 44.1k | 64,69 |
| dimman.smk | 512x344 | 357 | 24 s | 22.05k | 64,69 |
| spring.smk | 512x344 | 2922 | 195 s | 44.1k | 64,69 |
| summer.smk | 512x344 | 401 | 27 s | 22.05k | 64,69 |
| winter.smk | 640x344 | 2896 | 193 s | 44.1k | 0,84 (sledding minigame) |
| outro.smk | 512x344 | 1685 | 112 s | 44.1k | 64,69 |
| eftertext.smk | 512x344 | 2475 | 165 s | 22.05k | 64,69 (end credits) |

Every `PlaySmackerFile` call (`FUN_0046f840(name, endCb, x, y)`; x,y = screen position, **not** frame numbers):

| file (size, length) | at | caller / trigger | before | after (callback) |
|---|---|---|---|---|
| logo.smk 640x480, 22 s | 0,0 | BORGGARDEN init 0x45bdc8, first launch | scroll 640 | 0x45bb60: gVar 0x911=1, open main menu |
| intro.smk 512x344, 191 s | 64,69 | BORGGARDEN init 0x45bda3 (0x912==0) and menu close 0x4045fc | scroll 640 | 0x45ba30: game start (§1.3), 0x912=1 |
| helvetesgapet.smk 512x344, 75 s | 64,69 | end of track `ronja_3_106A1Say1_KrangPaDejB` (TracksTab cb 0x454330; start marker hides Birk) | end dialog, **chapter = 2**, scroll 0, `SetCurrentScene(STORASALEN)`, hide Ronja | 0x4543f0: show Ronja, stand (320,370) dir 5, gVar 0x913=1, music `dls_eld_40_` |
| kallare.smk 640x480, 2 s | 0,0 | end of track `ronja_6_081a1_tandkallarenb` (cb 0x4536c0) | gVar 0x8ed=1, `SetCurrentScene(KAELLARE)`, hide Ronja | 0x453680: Ronja stand (316,394,1395) dir 1, show |
| fangelse.smk 640x480, 2.6 s | 0,0 | end of track `RONJA_7_132A1Say1_slapaStenar` (cb 0x4537a0; marker 1 hides HINDER) | gVar 0x8f5=1, `SetCurrentScene(FANGELSEHALOR)`, hide Ronja | 0x453740: Ronja stand (432,392,0) dir 3, show, gVar 0x8e4=1, DoDialogAni(event 256 `_7_136A1_halBirk`, cb 0x462920) |
| winter.smk 640x344, 193 s | 0,84 | sled minigame init 0x430210 (mode 3, BORGGARDEN) | hide Ronja | used as the **interactive background** of the sled ride: plays to frame 662, pauses, then the game seeks/pauses frames (0x4306c0, `FUN_00419fd0` seek, `0x419fc0` pause); end cb 0x4301b0: sled loop stopped (0x4e93d1=0), `FUN_00430f90` (sled end logic), Ronja stand (400,400) dir 5. (0x430130 = separate exit of the sled game: mode 0, `SetCurrentScene(TJAERNEN)`, music `dls_tjarnensyrsor_40_70vol`.) |
| spring.smk 512x344, 195 s | 64,69 | 0x41fb10 (after the snowball fight) and 0x462990: if gVar 0x8de and (0x8f4 or BRODKAKA held by BIRK) | **chapter = 3**, scroll 0, `SetCurrentScene(STORASALEN)`, hide Ronja | 0x41fa70: show Ronja, 0x915=1, Ronja track T936, music `dls_eld_40_`, RATTBUR.holder = MATTIS. (Else 0x41fb10 returns to BORGGARDEN, Ronja at (478,341).) |
| dimman.smk 512x344, 24 s | 64,69 | end of TJAERNEN events 306/307/534/535 (`_14_180A2/180B1/404A2/404B1_talaBirk`, cb 0x4675f0) | gVar 0x8e5=1, scroll 0, `SetCurrentScene(SKOGEN)` (fog variant), hide Ronja | 0x467690: show Ronja, gVar 0x914=1 |
| summer.smk 512x344, 27 s | 64,69 | 0x468ac0 if gVar 0x90e and 0x90b and chapter 3 | gVar 0x8f7=1, hide Ronja | 0x468a70: plays **grottan.smk** |
| grottan.smk 640x480, 3 s | 0,0 | chained from summer | hide Ronja | 0x468a00: show Ronja, stand (120,400) dir 5; show Birk, stand (200,400) dir 3 |
| outro.smk 512x344, 112 s | 64,69 | end of track `MATTIS_10_315A1SAY6_EGENTLIGENKLAOPP` (cb 0x4538b0) | `FUN_0047aa60(1)` (stop music, UNCERTAIN), end dialog, scroll 0, hide Ronja | 0x453930 → `FUN_004030b0` |
| eftertext.smk 512x344, 165 s (credits) | 64,69 | `FUN_004030b0` (after outro, or menu "Afsluiten" + JA) | DAT_004c41f8=1 (credits mode), hide Ronja, stop all sound | 0x403090: dlg+0x21a=1 → main loop calls OnOK → **program exits** |

So the game end is outro → credits → exit to Windows (no return to the menu); quitting from the menu also shows the full credits (skippable with Space/ESC).

Movie behaviour (smkintf / DXLayer):
* **`PlaySmackerFile(name, endCb, x, y)` 0x46f840 (L85461): args 3/4 are the screen position of the movie, NOT frame
  numbers.** `PlaySmackerFile("winter.smk", cb, 0, 84)` draws the 640x344 movie at y=84 (84 px black above, 52 below).
  If x or y != 0 it calls `clearScreen(true)` twice (both flip buffers black); path = `SCURRglobSmackerPath`
  (registry, default "smacker") + "\\" + name; stores endCb (DAT_004ee768); `SmackFrameRate(15)` before and after
  `SMK_SetSmkFile(path,x,y)` 0x419cc0. The engine never centres; callers pass (64,69) for 512x344 movies (true
  vertical centre would be 68), (0,0) for full-screen ones.
* `SMK_SetSmkFile` 0x419cc0: stop previous movie, `StartSmackingFile` 0x479a90 = `SmackOpen(name, 0x3fe480 =
  SMACKTRACKS(all)|SMACKNOSKIP|SMACKFRAMERATE|SMACKYNONE, ...)`, rejects movies > 640x480. Clamp: x<0 / y<0 -> 0;
  x+w>640 -> x=640-w; (bug: y+h>480 writes x=480-h; never triggered). Creates an offscreen DD surface of movie size.
* Pixel format/palette: SMACKW32 converts the 8-bit palettized frames to the 16-bit screen format itself
  (`SmackDDSurfaceType(primary)`); the game has no palette code. A port just decodes SMK to RGB.
* Per frame (`FUN_004194f0` -> `SMK_Play` 0x419e60): while a movie is open the normal scene composition is
  **skipped entirely**; if `FrameNum >= Frames-1` the movie is stopped (the last frame is not held); else if
  `SmackWait()==0` (Smacker's own clock) and the window has focus: `SmackToBuffer`, `SmackDoFrame`, BltFast the whole
  movie rect to the back buffer at (x,y), `SmackNextFrame`; then optional Ronja overlay (§2.9) and Flip.
  The 40 ms main-loop Sleep is skipped during movies (busy polling of SmackWait). Frame time 66.67 ms (15 fps).
* End: the first loop iteration after the movie closed calls `0x46f970(0)` -> `SMK_Stop`, `endCb(0)`, then
  `updateWholeScreen()` redraws the scene. Callbacks receive one byte (0 = normal end) and return if non-zero.
* Audio: `SmackSoundUseMSS(digitalDriver)` at sound init; all tracks enabled, default (full) volume, mixed by MSS
  at 22050 Hz output. Game samples/music are not muted automatically, but movie triggers normally change scene
  first (which stops all sound) or stop music explicitly.
* Frame range: there is no start/end-frame playback API use except the sledding minigame (`SmackGoto`
  0x419fd0 and pause flag 0x419fc0); `0x419fa0` returns the current frame.
* **Skipping**: input is ignored while a movie plays (mouse handlers FUN_00405db0/0x4063f0/0x4065e0 return when
  smacking). Only Space/Esc during the end-credits (`DAT_004c41f8 != 0`) quits the program; Ctrl+Q quits any time.
  Logo/intro/story movies cannot be skipped.
* Game logic keeps running during movies (walk steps, track updates, SCURR 20 ms timers, game clock not paused);
  only scene rendering and input stop.

### 1.6 Quitting
* Menu "Afsluiten" + "JA" → `FUN_004030b0` → end credits (`eftertext.smk`, skippable with Space/ESC) → exit.
* Ctrl+Q at any time → immediate exit (no confirmation, no credits).
* End of the game (outro) → credits → exit to Windows. There is no return to the menu.

---------------------------------------------------------------------------------------------------

## 2. Rendering

### 2.1 Display mode and colour depth
* GameDlg init `FUN_00403190` (L1686..): `SCURR_initializeSoundSystem` -> `initSerials` (0x44ff00) ->
  `dxhwlayer.initializeDXHWLayer(hwnd)` (0x417760) -> `resetLayerWithDriver(NULL)` (0x417830, `DirectDrawCreate`,
  QueryInterface DirectDraw2) -> **`setFullscreenMode(640,480,16)`** (0x4178a0, L1728) -> `clearScreen()` (0x418040).
  Cooperative level 0x13 (FULLSCREEN|EXCLUSIVE|ALLOWREBOOT), `SetDisplayMode(640,480,16)`.
* `FUN_004180f0` (L28879) builds surfaces: fullscreen => primary with 1 back buffer (flip chain, caps 0x4218);
  windowed branch (dxhwlayer+0x4c == 0, never used by the game) => primary + offscreen back buffer + clipper.
  8-bit display branch builds a palette (unused, game always asks 16 bpp).
* Pixel format detection `FUN_004150d0`: 16 bpp with masks F800/07E0/001F => id 0x05650010 (RGB565),
  7C00/03E0/001F => 0x05550010 (RGB555); 24 bpp 888 => 0x08880018. Stored in `DAT_004cf630`.
* **calcConvTables `FUN_00418630` (L29205)**: works generically from the primary surface's R/G/B/A bit masks
  (`FUN_00418560` = mask -> (shift,width)), so **565 and 555 are both handled** (any mask). Two tables:
  1. `DAT_004cb620[4096]` (u32): 12-bit `0x0RGB` (R=bits 11-8, G=7-4, B=3-0) -> native screen pixel,
     channel scaling `dst = c4 * (2^n - 1) / 15` (integer division), e.g. 565: R5=r*31/15, G6=g*63/15, B5=b*31/15.
  2. `DAT_004cf634` (64K x u16, 128 KB aligned): premultiply table for ARGB4444:
     `T[a<<12 | r<<8 | g<<4 | b] = ((r*a)/15)<<8 | ((g*a)/15)<<4 | (b*a)/15` (alpha nibble a = 0..15).

**Key fact for a port: the whole game composes in 12-bit colour (ARGB4444 / RGB444).** All game graphics
(APC streams) are ARGB4444; the software back buffer is a 640x480 ARGB4444 "custom" surface
(`myCustomBlitSoftwareBackBuffer`, dxhwlayer+0x128, format id 0x44440010, created with flags 0x30020c i.e.
with a 16-bit z-buffer plane) and only the dirty rectangles are converted through table 1 into the DirectDraw
back buffer (`myCustomBlitBackBuffer`, dxhwlayer+0xe8) and then flipped. A port can expand c4 -> c8 = c4*17.

### 2.2 Blit primitives (software composition)
Source is always ARGB4444. Flags: 1 = clip (with 0x1041 the FX block supplies a clip rect), 2 = z-test,
4 = alpha, 0x20 = copy incl. z plane. `FX[0]` (short) = sprite depth for the z-test.

| flags | dest 4444 | dest native (screen) |
|---|---|---|
| none / 1 | opaque copy `d = s` (FUN_00416260) | `d = conv[s & 0xfff]` (FUN_00416130) |
| 4 (alpha) | **alpha blend** `if a!=0: d = T[(15-a)<<12 | d.rgb] + T[s]` (FUN_00415f80) | binary key: `if a!=0: d = conv[s&0xfff]` (FUN_004161c0) |
| 2 (z) + zbuf | `if FX0 < Z[x,y]: d = s & 0xfff` (FUN_00415ec0, opaque, alpha ignored) | - |
| 2+4 (z+alpha) + zbuf | `if a!=0 && FX0 < Z[x,y]: d = blend` (FUN_00415dc0) | - |
| 0x20 | copy pixels and z plane (FUN_00416040) | - |

* Alpha: 4-bit, `out = dst*(15-a)/15 + src*a/15` per channel with truncation (premultiply table); a=0 fully
  transparent, a=15 opaque. There is **no colour key** other than alpha=0.
* **Z-test: a sprite pixel is drawn only where `spriteDepth < backgroundZ[x][y]` (strict)**. The z-buffer is never
  written by sprites (no inter-sprite z-buffering; sprites are sorted instead, see §2.4).
* **StretchBlit `FUN_00416450` / kernel `FUN_00416b30`**: nearest-neighbour scaling with 16.16 fixed point
  (step = 0x40000000/(srcW>>2) ... i.e. src/dst ratio), **only implemented for z-test+alpha (flags 2|4) from a
  4444 surface without its own z plane into a 4444 surface with z plane**. Same blend and z rule as above.
  Any other combination falls back to an unscaled `BlitToSurface` (i.e. a sprite with flags 2 only is not scaled,
  just clipped to the dest size — engine quirk).

### 2.3 Blit-surface list and screen layers
`addBlitSurface` = `FUN_00418ee0(surfHandle, x, y, srcRect, z, flags, FX)` -> `FUN_00418f70` inserts a node
(0x88 bytes) into a list sorted ascending by `z` (insert before first node with z >= new z), returns a blit handle.
Node fields: dest rect, surface handle, src rect, flags, FX[5], handle, z, visible, changed, current/old update rect.
`showBlitSurface(h, bool)` 0x4192e0, `changeInBlitSurface(h, destRect, srcRect, flags(-1=keep), FX)` 0x419220,
`removeBlitSurface` 0x419140.

Layers used by the game (lowest drawn first):

| z | what | created at | flags | position |
|---|---|---|---|---|
| -10 | scene background (`SceneBackground` 0x4ee6d8, ARGB4444, alpha stripped `&0xfff`) | `setBackgroundSurface` 0x419af0 called from RonjaSCURRInitialize 0x46b5d0 (`setBackgroundSurface(SceneBackgroundHandle, 0)`) | 1 (opaque) | src rect = (panX,panY, panX+640, panY+480) |
| 0 | all SCURR objects/characters (one blit surface per object) | ScurrObjectInitialize 0x46a840 L81929 | 6 (z+alpha) or 2 (z only) | see §2.4 |
| 15 | 5 dialog-choice text lines (from one 640x100 text surface `textAlternatives` 0x4c5a20) | GameDlg 0x4017a0 L1321..1349 | 5 (alpha) | x=0, y = 380, 400, 420, 440, 460 (each 640x20; src rows 0-20, 20-40 ...) |
| 21 (0x15) | inventory panel | L907 | 4 | (0,0) |
| 22 (0x16) | inventory item sprites (array, stride 300 bytes up to 0x4c5a20) | L1282 | 4 | |
| 23 (0x17) | TATITA verb coin (talk/take/look) | L726 | 4 | initially (320,240) |
| 25 (0x19) | mouse cursor (8x8 initial, resized per cursor subani) | L677 | 4 | initially (320,240) |

The **z-buffer is attached only to layer 0**: `setBackgroundSurface(handle, zLayer=0)` stores the layer number
(dxhwlayer+0x168). While composing (`parseUpdateRegions`, below) the software back buffer's z pointer is set to
`background.zbuf + panX*2` (pitch = background z pitch) when drawing the group whose z equals that layer, and to
NULL for every other group, so only scene objects are depth-tested/scaled; UI layers are plain alpha blits.

### 2.4 Scene objects: depth test, painter's order, perspective scaling
* Per object update `FUN_004567b0` (L69186): `depth = FUN_00456620(obj) + obj[+0x244]` (z offset) -> FX[0];
  scale `s = obj[+0x278]`; src rect = current frame bounding rect (`getDirtyRect`, obj+0x22c);
  anchor = (obj+0x23c, obj+0x240); position (x,y) = obj+0xf0/+0xf4 (float):
  `dest = ( x + (src.l - ax)*s - panX , y + (src.t - ay)*s - panY , x + (src.r - ax)*s - panX , y + (src.b - ay)*s - panY )`.
* `FUN_00456620` depth/scale: if obj+0x262 ("use height map") the depth is read from the scene **height map**
  `SceneHeightMap[y][x]` (u16, full-res, `<scene>H`, 0x4ee720) at the object's (x,y) (clamped), and stored to
  obj+0xf8 (z); otherwise depth = (int)obj z (+0xf8). Scale: if `obj[+0x263] & 1` -> 1.0 (never scaled);
  else `s = scene.K / (scene.off + z)` with `K` = scene+0xf0, `off` = scene+0xf4; if `off+z < 1.0` => s = 10.0;
  clamp s <= 10.0. Scenes are created with K = 1000.0 (ctor 0x457890) and then overwritten from **scene.nfo**
  (21 records {int recSize=12, float K, float off}; `FUN_0046a9b0` L81960). Values (off is 0.0 for all):

  | scene | K | scene | K | scene | K |
  |---|---|---|---|---|---|
  | SKALLEPERSRUM | 784 | VAPENHUS | 1000 | SKOGEN | 1445 |
  | LOVISMATTISRUM | 783 | HELVETESGAPET | 717 | KAELLAN | 877 |
  | STORASALEN | 1673 | TORNET | 811 | GLAENTAN | 1566 |
  | KOKET | 742 | UTSIKTSKOGEN | 1000 | GLUPAFALLET | 1854 |
  | BORGGARDEN | 2234 | KAELLARE | 1258 | TJAERNEN | 850 |
  | BORGPORTEN | 983 | FANGELSEHALOR | 730 | GROTTANUTE | 745 |
  | GROTTANINNE | 893 | LABYRINT | 700 | BRAEDSPEL | 661 |

  So **scale = K / heightMapValue** (a height-map value equal to K gives 1:1). The same scale is applied to walk
  speed (`FUN_00456710`: `x += dx * s`) — see §3.4.
* Within layer 0 the blit list group is **bubble-sorted by FX[0] (depth) descending** before drawing
  (`blitBlitSurfaces` 0x419340), i.e. painter's order far (large depth) -> near (small depth); the background z
  plane additionally hides sprite pixels behind scenery (pixel drawn iff depth < Z).
* Blit flags per object: `FUN_00455750` L68459: if the current sub-animation stream's header flag bit 1 is set
  ("opaque" stream) -> flags 2 (z, no alpha, no scaling - see quirk above), else 6 (z+alpha, scaled).
* Hit testing of objects under the mouse (`FUN_00456940`) uses the same scaled dest rect.

Note on the Z test: a sprite pixel is drawn only where `spriteDepth < Z[x][y]` of the background, where
`spriteDepth = objectZ + cZ` (cZ = per-key depth bias, typically −50 for Ronja; −110 is used to put the torch
flame behind Ronja in the labyrinth). Because sprites never write depth, overlaps *between* sprites are
resolved only by the per-frame sort (far → near by depth).

### 2.5 Sprite animation frames (APC, behaviour)
* `APCsetFrame(stream, dest, target, current)` 0x4095d0: frames are **cumulative deltas**: to show frame N the
  engine applies frames (current+1 .. N) onto the sprite buffer; if N < current it restarts from frame 0
  (current = -1). In delta frames the value 0x0F00 means "keep previous pixel"; runs (RLE) fill a colour.
  So a port must decode sequentially (or pre-decode all frames). Frame header carries a sub-rect (x,y,w,h)
  and a bounding/dirty rect used as the sprite's source rect.
* `Ani2DSprite.getFrameGfxToSprite` 0x4082f0: the sprite surface is resized to the stream's full size, then the
  frame is decoded in place (state cached in sprite+0xfc/0x100 = current frame/stream).

### 2.6 Dirty rectangles and screen update
* `addUpdateRegion(rect)` 0x418bc0: clip to 640x480, append to the *pending* list (two lists at dxhwlayer+0x18c /
  +0x198, swapped under a critical section, so the game thread can add while the renderer drains).
  `rect==NULL` => drop all pending and add the full screen.
* `addMovingUpdateRegion(cur, old)` 0x418d70: if the two rects overlap and `area(union) - 200 < area(cur)+area(old)`
  add the union, else add both separately.
* Per frame `FUN_004194f0` (called once per main-loop iteration at 0x407303): for every blit node remember
  old rect, take new dest rect; if node changed this frame or last frame (`changed`/`wasChanged`) add moving update
  region(new, old). Then `parseUpdateRegions` 0x4196e0: for each dirty rect, walk the z-sorted list, gather the
  visible nodes intersecting it per z group, set the z-buffer pointer (layer 0 only), `blitBlitSurfaces` clipped to
  the rect into the ARGB4444 back buffer, then convert the rect to the screen back buffer. Finally `updateScreen()`
  0x417f80 = `Flip(DDFLIP_WAIT)` (fullscreen) / Blt (windowed).
* `updateWholeScreen()` 0x419c10 re-sets the background node's dest rect, forcing a full redraw (used after scene
  load, after a movie, after menus).
* `clearScreen(bool)` 0x418040: DDBLT_COLORFILL with 0 (black) on the back buffer; with `true` also flips and clears
  the other buffer. Used at start-up and twice before playing a Smacker movie (PlaySmackerFile 0x46f840 L85471).
* **No fades, no palette/gamma effects** exist in the engine (no such code/strings; palette only for 8-bit modes).

A port can simply redraw the whole 640×480 frame every tick; the dirty-rect system is an optimisation
without visible effect (except that nothing ever fades: there are no fades or palette effects anywhere).

### 2.7 Background panning
Panoramas are 640, 1280 or 1920 px wide and scroll horizontally only, **by jumps** (§3.9). `setPan(p)`
(`FUN_0046b530`) clamps p to `0..sceneWidth−640`, stores it in `scene+0xf8` and `DAT_004ee730`, moves the
background source rect (`setBackgroundSurfacePan` 0x419b80) and marks all objects dirty.
Scroll-edge cursors: with the normal cursor, mouse x < 10 and pan > 0 shows `riktadV` (S549) pinned to the left
edge; x > 630 and pan < max shows `riktadO` (S543) at x=542. They are only feedback: the camera still moves
only by Ronja's position. Scripted re-centring (`FUN_00425200`, `FUN_00426aa0`, river games): pan follows Ronja
when `Ronja.x − pan` leaves 316..324 (UNCERTAIN exact formula, probably `Ronja.x − 320`).

### 2.8 Font and text
* Init (GameDlg L625): `normalFont.setFont("normalFont.fnt", normalFontStart=DAT_004c9600 (=0, BSS),
  normalFontLength=0x100, normalFontLetters=&DAT_004c8200)`; the letter table is filled earlier by
  `fread(DAT_004c8200, 0x1400, 1, "normalFont.sz")` (L4633). `setFont` 0x41a3a0 loads the .fnt 2D image into an
  offscreen ARGB4444 surface (`getFromImage`, flags 5) and stores start/length/table at +0xf0/+0xf4/+0xf8.
* `normalFont.sz` = 256 records x 20 bytes `{int srcX, srcY, width, height, ascent}` indexed by
  `(unsigned char)c - start` (cp1252 codes; chars outside [start, start+length) are rejected with an error).
  Glyphs sit in a 16x16 grid of 16x16 cells of a 256x256 image: srcX = (c%16)*16, srcY = (c/16)*16.
  height is 15 for all glyphs (space: w=5,h=1). widths: e.g. 'A' 13, 'B' 10, 'I' 6, 'M' 14, 'W' 14, 'a' 9,
  'i' 6, 'l' 6, 'm' 14, 'w' 15, ',' 6, '.' 5, '0'-'9' 8..10, space 5; undefined glyphs default 15.
  ascent mostly 13; descenders smaller ('g' 11, 'j' 10, 'p' 10, 'q' 10, 'y' 10, ',' 10), digits 3-7,9 = 12.
* `writeTextToSurface(text, destSurf, x, y, &endX)` 0x41a4e0: for each byte c:
  `rec = table[c-start]; blit glyph rect (srcX,srcY,width,height) to (x, y + 16 - ascent); x += width`.
  **No kerning, no extra spacing, single line, no wrapping**; line height of the UI is 20 px. Returns the end x.
* Glyph blit uses `HWLayer.blitToSurface` (vtable+0x14 = `FUN_00417d20`) with flags 1 => **opaque copy of the whole
  glyph rectangle, including its background pixels**, into the text surface. Glyph cells: background
  white with alpha 0x44 (=ARGB4444 0x4FFF), glyph = opaque light fill (~RGB 234,233,182) with a dark brown
  outline (~49,37,8) (from normalFont.fnt pixels; the image is stored bottom-up). The text line surface itself is
  cleared to `0x40FFFFFF` (ARGB8888 -> 0x4FFF, translucent white, 4/15 opacity) when choices are shown
  (`FUN_004073c0` L4300), and to 0x00FFFFFF (fully transparent) initially, then composited with flags 5 (alpha) at
  z 15. Result: a translucent white strip behind light text with dark outline.
* Choice lines (`FUN_004073c0`): the surface is 640x100 = 5 rows of 20 px; with n choices the first 5-n rows are
  hidden and the n texts are written at text-surface y = 20*row, x = 0 (left aligned); each row's blit surface is
  shown only if the text has non-zero width; the returned end-x of each line is kept (DAT_004c80d8[5]) for hit
  testing. Screen rows are y = 380, 400, 420, 440, 460 (so the choices are bottom-aligned).

### 2.9 Ronja over a movie
During movie playback the per-frame SMK blit (0x419e60) additionally draws one blit surface on top of the movie:
the main loop passes `(RONJA sprite surface 0x4e91d8, Ronja.x - anchorX, Ronja.y - anchorY)` via `FUN_0041a000`
(dxhwlayer+0x17c..0x184), or -1 (none) when 0x4e925c/0x4c41f8 are set; it is blitted unscaled with flags 4
into the native-format back buffer, i.e. `FUN_004161c0`: pixels with alpha>0 are copied opaque, alpha 0 skipped
(no blending), at that absolute screen position (no pan subtracted). Used by the sledding minigame on
winter.smk (ski game, game-logic.md); all other movie triggers hide Ronja first.

---------------------------------------------------------------------------------------------------

## 3. World model (SCURR)

### 3.1 Objects
All characters and props are 49 global SCURR objects, created once (`ScurrObjectInitialize` 0x46a840, sprite
8×8 initially, hidden blit surface on layer 0) and **reused across scenes**. Scene scripts show, position and
animate them on entry; `SetCurrentScene` hides all of them and stops their tracks. Several objects are
re-purposed in minigames and scenes (e.g. BIRK is the torch flame in the labyrinth and the score display in the
dice game; MATTIS/SKALLEPER are rafts in the river game; ASKEN/TARNING/VILDVITTRA/GRADVARG are extra wall
torches in the great hall). Holder `+0xec` is the story "location" of an item: `&RONJA` = inventory, another
object = carried/inserted (e.g. OST in RATTBUR, FLINTA in ELDSTAL), `&MATTIS` is used as a "consumed/placed"
sentinel (eaten salmon, net in the rapids, water given, rat trap removed), NULL = lying in its scene.

| objId | object | VA | meaning |
|---|---|---|---|
| 1 | RONJA | 0x4e8ff8 | player (derived class, vtable 0x482990, carries all minigame state after +0x360) |
| 2 | BIRK | 0x4edb58 | Birk; companion in act 3 |
| 3 | MATTIS | 0x4e7d18 | Mattis (also raft 1, falling cone, "consumed" holder) |
| 4 | LOVIS | 0x4e40c8 | Lovis (also the attacking bird witch in river 2) |
| 5 | BERATTAREN | 0x4e6f70 | narrator (voice only) |
| 6 | SKALLEPER | 0x4e9dd0 | Skalle-Per / Kale Per (also raft 2) |
| 7..11 | LILLKLIPPEN, FJOSOK, STURKAS, TJEGGE, LABAS | | robbers |
| 12, 13 | BORKA, BORKAROV | | Borka, Borka's robbers — voice actors only (no scene use) |
| 14 | ASKEN | 0x4e6720 | box/drawer in the tower |
| 15 | BRODKAKA | 0x4e4450 | bread cake (item) |
| 16..18 | DJUR1, DJUR2, DJUR3 | | animals (horses; DJUR3 = the injured mare); dice in the dice game |
| 19 | ELDSTAL | 0x4ec448 | fire steel (item) |
| 20..23 | ELD1..ELD4 | | fires, wall torches, water animations |
| 24 | FACKLA | 0x4ebc38 | torch (item) |
| 25 | FISKNAT | 0x4e5cc8 | fishing net (item) |
| 26 | FLINTA | 0x4e50a8 | flint (item) |
| 27 | FNOSKE | 0x4e47b0 | tinder (item) |
| 28 | GRADVARG | 0x4e8518 | grey dwarf ("onderaardse") |
| 29 | HINDER | 0x4e95d8 | obstacles (guard on the wall, stones, birch, branch) |
| 30 | KARTAN | 0x4e5768 | map (item) |
| 31 | KISTLOCK | 0x4ecb80 | chest lock — never used by scripts |
| 32 | KNIV | 0x4e8878 | knife |
| 33 | KOTTE | 0x4ecf18 | pine cone projectile |
| 34 | LAX | 0x4e8c98 | salmon (item) |
| 35 | MOROTTER | 0x4eb860 | carrots (item) |
| 36 | NYCKEL | 0x4ead38 | key (item) |
| 37 | OST | 0x4eb500 | cheese (item) |
| 38 | RATTA | 0x4ec7e0 | rat (item) |
| 39 | RATTBUR | 0x4e4c48 | rat trap (item) |
| 40 | REM | 0x4eb198 | leather strap (item) |
| 41 | RUMPNISSE | 0x4ebfa0 | rump-goblins; the bird witch in the cave game |
| 42 | SKUMTROLL | 0x4e36a8 | never used by scripts |
| 43 | SNOBOLL | 0x4e5408 | snowball / Birk's cone |
| 44 | STEGE | 0x4e2020 | ladder |
| 45 | TARNING | 0x4e3a08 | dice (also wall torch) |
| 46 | UNDERJORD | 0x4e8078 | never used by scripts (the fog creatures are drawn with ELD1-3) |
| 47 | VATTENKARL | 0x4e9938 | water vessel (item) |
| 48 | VITMOSSA | 0x4e6098 | white moss (item) |
| 49 | VILDVITTRA | 0x4ee270 | bird witch |

Object fields (ScurrObject, vtable 0x482e10, ctor `FUN_00456400`):

| off | meaning |
|---|---|
| +0xe4 | owning theScurrOS |
| +0xe8 | objId (1..49) |
| +0xec | holder (scene/object; ==&RONJA ⇒ inventory) |
| +0xf0,+0xf4,+0xf8 | **posX, posY, posZ** (float). x,y = scene pixel coords of the anchor ("feet"); z = depth (see §3.5) |
| +0xfc | mySprite (RLayers sprite; +0x1e0 sprite surface, +0x1e8 HW layer) |
| +0x228 | blit handle in dxhwlayer |
| +0x22c..+0x238 | current frame rect inside sprite (L,T,R,B) |
| +0x23c,+0x240,+0x244 | **anchor cX, cY and depth bias cZ** of current key (key `cXYZ`, ftol) |
| +0x248 | current track serial (0 = none) |
| +0x24c | current key index; +0x250 last update time (game ms); +0x254 ms accumulated in key |
| +0x258 | sound serial attached to track; +0x261 sound-started flag |
| +0x25c | loops remaining (−1 = infinite) |
| +0x260 | hide-at-end (flag 2) |
| +0x262 | z-from-heightmap (track flag bit1) |
| +0x263 | current key flags (bit0 = draw unscaled) |
| +0x264 | **hidden** (1 = not drawn / not hit-testable) |
| +0x265 | dirty (needs re-blit) |
| +0x268 | track flags passed to setTrack |
| +0x26c,+0x270 | track end callback + user data |
| +0x274 | movement callback |
| +0x278 | current perspective scale |
| +0x27c.. +0x284 | path (list head at +0x280, node count +0x284; nodes = {short gx, short gy} grid cells) |
| +0x288 | final direction; +0x28c,+0x290,+0x294 final x,y,z of the walk |
| +0x298 | **currDirec** 0..7 (−1 unknown) |
| +0x29c[8] | StillTracks; +0x2bc[8] WalkTracks; +0x2dc[8] TalkTracks |
| +0x2fc[8],+0x31c[8],+0x33c[8] | first subani of each Still/Walk/Talk track (to recognise direction) |
| +0x35c | walk frame counter (`currentInteractionTrackFrame`) |
| +0x360,+0x364 | RONJA only: 20 ms timer handle, tick count |

Object vtable (0x482e10): +0xc onCreated, +0x14 onTimeout, +0x20 talk (`FUN_00457640`),
+0x24 **moveRelative(dx,dy,dz)** (`FUN_00456710`), +0x28 reblit (`FUN_004567b0`),
+0x2c **setAniFrame(subAni, frame)** (`FUN_00456ae0`), +0x30 hitTest(x,y) (`FUN_00456940`),
+0x40 **setPosition(x,y,z)** (`FUN_00456770`).
Hidden/"parked" convention: when an invisible RONJA/BIRK is saved its position is set to
(3000, 5000, 7000) (`FUN_0046f0d0`).
Hit test (`FUN_00456940`, also `FUN_00455680`): point inside the scaled screen rect and the sprite pixel
at that spot has non-zero alpha (`FUN_00417120(...) >> 24`).

theScurrOS (`*0x4ee73c`, vtable 0x482ed8): object list, scene list, timer list; `addScurrObj` (0x457c90),
`addScurrScene` (0x457dc0), find by id (0x457d70/0x457ea0), timers (0x457ff0 add, 0x457ef0 service).

### 3.2 Directions
0 = N (Norr, away from camera), 1 = NW, 2 = W, 3 = SW, 4 = S (towards camera), 5 = SE, 6 = E, 7 = NE.
Direction from a vector (`FUN_004570d0`): `a = atan2(dy, dx)` in [0,2π) (screen y down, computed as
`atan2(p−t) + π`); sectors of 45° centred on: E=0 → 6, π/4 → 5 (SE), π/2 → 4 (S), 3π/4 → 3, π → 2,
5π/4 → 1, 3π/2 → 0 (N), 7π/4 → 7. Boundaries at π/8 + k·π/4 (constants 0x482e88..0x482ea4).
Portal facing flags: bit k (1<<k) = direction k (`FUN_0046fa50`).

Normal Ronja sets (set in `FUN_004017a0` L1460-1515 at game start and `FUN_00422230`; BIRK likewise):
* Still (`FUN_004576e0`, +0x29c): ronja__gen_stillNorr, stillNV, stillVast, stillSV, stillSyd, stillSO,
  stillOst, stillNO (handles 0x90022f,22a,22e,22c,230,22b,22d,229).
* Walk (`FUN_00457770`, +0x2bc): Gen_GoN, goNV, GoVast, GoSV, GoS, GoSO, GoO, GoNO
  (0x900094,96,89,8a,8b,93,92,95).
* Talk (`FUN_00457800`, +0x2dc): only diagonals: N,NW→talNV; W,SW→talSV; S,SE→talSO; E,NE→talNO
  (0x9001a1,0x900009,0x90010f,0x900172).
* BIRK: still 0x90020a.., walk 0x9001ee..0x9001f5, talk alternates 0x900212/0x900213.
* Labyrinth (`FUN_00421240`) swaps Ronja's still/walk sets to ronja_17_Gen_stop*/ronja_17_Gen_* .

### 3.3 Tracks (animation timelines)
A track is a list of keys; each key shows one frame of one subani for `frameTime` ms and may move the
object. Track names start with the owning actor (`ronja_…`, `birk_…`); everything after the first `_` is
the "dialog animation" key used by DoDialogAni (§4.3b). File layout: formats.md §3.
`+4` owner objId, `+8` key array, `+0xc` key count, `+0x18` byte **relative**, `+0x19` byte
**zFromHeightMap** (both from the first tail int: bit0, bit1 – `FUN_00454d40`), `+0x1c` soundFrame,
`+0x20` lipLoopStart, `+0x24` lipLoopEnd (tail ints 2..4; −1 = none).
Key (0x2c bytes): `+4/+8/+0xc moveXYZ` (float), `+0x10 subAniID`, `+0x14 subAniFrame`,
`+0x24 frameTime` (ms), `+0x18/+0x1c/+0x20 cXYZ` (anchor x, y, depth bias), `+0x28 flags`
(bit0 = no perspective scaling, scale 1.0). (Text dump labels in `FUN_00454820`:
`frm, moveXYZ, subAniID subAniFrame, frameTime, cXYZ, flags`.)

Position semantics:
* key 0 of a **non-relative** track: `pos = key0.moveXYZ` absolute (z only if !zFromHeightMap).
* every other key (and key 0 of relative tracks): `moveRelative(mx, my, zFromHeightMap ? 0 : mz)`
  = `x += mx*scale; y += my*scale; z += mz` (`FUN_00456710`) — x/y deltas are **multiplied by the
  current perspective scale**.
  Examples: ronja__Gen_GoO: flags 3, 10 keys, moveX = 10, 83 ms; RONJA_1A_614A1_garUppITorn: flags 2,
  key0 = (306,268) then (−8,−4..−6) per key; RONJA_2A_624A1_garNerStege: flags 0, key0 = (1760,313,0),
  key flags bit0 (unscaled).
* applied **when the key becomes current**; then `setAniFrame(subAniID, subAniFrame)` and
  anchor/bias (+0x23c..+0x244) are taken from the key.

#### setTrack(serial, flags, endCb, user, soundSerial)  (`FUN_00456310` → `FUN_00455990`)
Critical section `DAT_004e1ff0` around all track calls (game thread vs timer thread).
1. Track hook `FUN_00451b20(serial, 0x100000)` ("started").
2. flags 0x004: preload all subanis of the track first (`FUN_004558b0`).
3. Unless flags 0x800: the previous end callback is fired as `cb(oldTrack, 1 /*interrupted*/, user)`
   and replaced by (endCb, user).
4. flags 0x200 with soundFrame < 0 → start the sound now (`FUN_0047aed0(sound,0,0x40,100)`).
   flags 0x400 is dropped if lipLoopStart or lipLoopEnd < 0.
5. Show the sprite (hidden=0), apply key 0 (subani/frame, position as described above), key index 0,
   accumulator 0, start time = game clock.
6. Loop: if flags&1: loops = (flags>>4)&0xf, or **−1 (infinite) if those bits are 0**; else 0.
   So `((n<<4)&0xf0)|1` = play the track n+1 times; `1` = loop forever.
7. flags&2 → hide object when the track ends.
8. Empty track (0 keys): only hook 0x200000.
Other flags seen: 0x100 (portal enter tracks, talk 0x700) has no effect inside setTrack (UNCERTAIN).

#### updateTrack (`FUN_00455cc0`, every frame)
`acc += gameNow − last`; while `key[cur].frameTime < acc`: `acc −= frameTime; cur++`; hook
`0x400000|cur`; then:
* flags 0x200: when `cur−1 == soundFrame` (i.e. after key soundFrame finished) start the sound once.
* flags 0x400 (lip-sync): if the sound is still playing and `cur−1 == lipLoopEnd` → `cur = lipLoopStart`;
  if the sound has ended and lipLoopStart ≤ cur−1 ≤ lipLoopEnd → `cur = lipLoopEnd+1` (skip the
  rest of the mouth loop). Example ronja__Gen_talSV: tail (3,1,1,11): sound starts after key 1, keys
  1..11 loop while the line plays.
* end reached (`cur >= count`): if loops != 0 → cur = 0, loops−− (key 0 re-applies the absolute
  position of non-relative tracks); else: track cleared, hide if flag 2, hook 0x200000, then
  **chained next track** (`FUN_00451b40`, table at 0x4ba6c8, 46 pairs e.g.
  `RONJA_2A_005A1_taMattisA → …B → …C`, `ronja_2a_086a1_tastegea → …b`): `setTrack(next, 0x800 |
  (hideAtEnd?2:0))` keeping the callback; otherwise `endCb(0, 0, user)`.
* the newly current key is applied (see position semantics above).
Frame rate is therefore per key (`frameTime` ms; common values 83 (~12 fps), 120, 166, 249, 332).

**Track hooks** (`FUN_00451b20`, table 0x4ba2c4, 128 entries name→function, built in `FUN_00450b30`
L67041): called with `0x100000` (start), `0x400000|keyIndex` (key reached), `0x200000` (end). They
implement item pick-ups at a given key, e.g. `RONJA_6_112A1_TAOST` (0x452030) at key 8 hides OST and
sets OST.holder = RONJA; `RONJA_2A_624A1_GARNERSTEGE` (0x453e20) at end:
`RONJA.standStill(1721, 343, 0, dir 5)`; `RONJA_17_GEN_STOP*` (0x451bf0..) at end call the labyrinth
step `FUN_004218f0(dir)`. (Hook bodies: game-logic.md §4.)

Other track calls: `stopTrack` `FUN_004563d0/4562a0` → clears track, `cb(0, 1, user)`.
`preloadTrack` `FUN_004562e0`. `setTrackFrame(n, applyAni)` `FUN_00456390/456120`: clamp n to
[0,count−1], reset accumulator and start time, key flags; if applyAni → `setAniFrame` (position NOT
changed). `setAniFrame` `FUN_00456ae0`: if subAni is the first subani of a Still/Walk/Talk track for
direction d → currDirec = d; then sprite.setFrame (subani loaded on demand with the game clock paused,
`FUN_00455750`), dirty rect and blit mode updated.
`GetPosAndDirFromTrack` `FUN_00456b30`: key0 position + direction of key0's subani.
`walkToTrackStart(track, cb)` `FUN_00456e00`: setMovementDestination(key0 x,y,z, cb, thatDir) (used by
DoDialogAni before playing an event track).

### 3.4 Walking and the path finder
#### setMovementDestination(x, y, z, cb, finalDir)  (`FUN_00456bd0`, 5 args)
1. Previous movement callback fired with `cb(1)` (interrupted) and replaced by the new `cb`.
2. `thePathFinder.GetPath(posX/4, posY/4, x/4, y/4, path)` (grid = 4×4 px cells, see path finder below).
3. If distance(pos, (x,y))² ≥ **256** (≥ 16 px): store finalDir, final point = **last path node×4**
   (cell corner, not the exact click), final z = z, walk frame = 0. Walking starts on the next walk tick.
4. Else (closer than 16 px) the object does not move: path cleared; if |dx|<1.5 and |dy|<1.5 it just
   stands (keeps direction); otherwise it turns to face the point (`standStill…(pos, dirOf(target))`),
   and cb(0) fires immediately.
If the destination is unreachable but walkable, the path is empty and nothing happens (walk tick
needs ≥1 node).

#### Walk step (`FUN_00457190`, every 66 ms, RONJA and BIRK)
1. Next target node = the nearest of the next ≤5 path nodes that is more than 2 cells (8 px) away
   (`FUN_00457000`); earlier nodes are dropped. No node left → arrive (`standStill` at final x,y,z, final
   dir, cb(0)).
2. `nearFinal = dist²(pos, final) < 256`.
3. dir = sector of (target − pos); if current track != WalkTracks[dir] → `setTrack(WalkTracks[dir], 0)`.
4. `setPosition(pos)` (recomputes scale and heightmap z), walkFrame = (walkFrame+1) mod frameCount,
   `setTrackFrame(walkFrame, true)` (so the walk animation is driven by the 66 ms tick, not by key
   frameTimes – the tick resets the key timer every 66 ms < 83 ms).
5. Step: `moveRelative(cos a · WalkTracks[6].key[walkFrame].moveX, sin a · WalkTracks[4].key[walkFrame]
   .moveY, 0)`, i.e. the E track supplies the horizontal speed and the S track the vertical speed,
   both multiplied by the perspective scale. For Ronja: **10 px/step horizontally, 4 px/step vertically**
   at scale 1.0 ⇒ ≈150 px/s horizontal, ≈60 px/s vertical (elliptical speed – depth moves slower).
6. If the target lies on the step segment (projection t in (−0.01, 1.01)): if nearFinal and the miss
   distance² < **64** → arrive (standStill at final point/dir, cb(0)); if not nearFinal and miss² < **16**
   → snap position to the node.

#### standStillAtDestination(x,y,z,dir) (`FUN_00456fe0` → `FUN_00456e80(x,y,z,dir,1)`)
dir −1 = keep current direction (error if currDirec<0), else dir&7. Clears the path, shows the sprite,
`setPosition(x,y,z)`, `setTrack(StillTracks[dir], 0)`, then fires the movement callback with the 5th
arg: 1 for the public standStill/`_ExitMovement` (`FUN_00457640`), 0 when a walk arrives normally.
Movement callback signature: `cb(int interrupted)`.

Path finder (`thePathFinder` 0x4e4428, code 0x41a5f0-0x41b4b0):
* Grid (`FUN_0041b320`): (W/4)×(H/4) cells (160×120 for 640×480, 480×120 for 1920). Cell value
  0x7f = blocked, 0 = free (`FUN_0041b3f0`, from the R layer).
* `GetPath(sx,sy,dx,dy,list)` (`FUN_0041ad30`): clamp both to the grid; clear marks. If the start cell
  is blocked → start = nearest free cell (squared Euclidean). **Breadth-first flood** from the start
  (ring-buffer queue, 8-neighbourhood in order E, SE, S, SW, W, NW, N, NE), parent pointers stored per
  cell; stops when the destination cell is dequeued. If the queue empties and the destination cell is
  **blocked**, the visited cell with the smallest squared distance to the destination is used instead
  (click on a wall → walk to the nearest reachable point). If the destination is free but unreachable
  → empty path.
* Path build + smoothing (`FUN_0041ab20`): nodes from start to destination; if > 3 nodes, greedy
  line-of-sight pruning: from an anchor node advance until the Bresenham line (`FUN_0041a6f0`,
  callback 0x41aae0 flags any blocked/out-of-grid cell) is blocked or the end is reached, then delete
  the nodes between the anchor and the node two before the failing one; that node becomes the anchor.
* The walker additionally skips nodes closer than 2 cells (walk step above).

### 3.5 Scenes
`+0xe8` sceneId (0x1001+i), `+0xf0` **perspective constant F** (default 1000.0), `+0xf4` z offset
(default 0), `+0xf8` panX (`objPanX`), `+0xfc` panY (always 0).

**scene.nfo** (`ScurrSceneInitialize` `FUN_0046a9b0`): 21 records `{int size=12, float F, float zOff}`
read into +0xf0/+0xf4. The float is **not** a panorama width – it is the depth at which a sprite is drawn
1:1 (scale = F / (zOff + z)). All zOff = 0.

#### Layers (LoadSceneGfx `FUN_0046aab0(0, base)`; sprintf "%sZ", "%sH", "%sR", "%sI")

| layer | size | use |
|---|---|---|
| base | scene W×480, 16 bit (ARGB4444) | background picture; each pixel `&= 0x0fff` (alpha stripped) into `SceneBackground` (0x4ee6d8), whose size = W×480 → `DAT_004ee728/72c` = scene width/height |
| Z | W×480, 16 bit | **depth buffer** of the background (`SceneBackground.Get_lpCustomBltZBuf`, `DAT_004ee6ec`): sprites are blitted with a per-object depth (z + cZ) and are occluded where the background is nearer (compare direction UNCERTAIN – renderer) |
| H | W×480, 16 bit | **height/depth map** `SceneHeightMap` (`DAT_004ee720`): z of an object standing at (x,y) = H[y][x] when its track has zFromHeightMap (all walk/still tracks) → used for scaling and depth sorting (`FUN_00456620`) |
| R | W/4×H/4, 16 bit | **restriction (walk) map** → path-finder grid: value 0 = blocked (0x7f), non-zero = walkable |
| I | W/4×H/4, 8 bit | **info/region map** `SceneInfoMap` (`DAT_004ee724`): byte region id per 4×4 px cell, sampled by `FUN_0046d120(x,y)` = `I[(y>>2)*(W>>2) + (x>>2)]` (x,y clamped to the scene) → per-scene click/cursor handlers (exits, hotspots) |

Labyrinth rooms (15: A01b A02a A03b A04a A05b A06a A07b A08a A09b S01a S13a S20b S21b S30b S34a)
have the same 5 layers, 640×480.

#### Perspective scale and depth (`FUN_00456620`)
If zFromHeightMap: `z = H[clampY][clampX]` (stored into posZ). Scale = 1.0 if key flag bit0; else
`d = scene.zOff + z; scale = d < 1 ? 10 : F/d; if scale > 10 → 10`.
Drawing (`FUN_004567b0`): dest rect = `(frameRect − (cX,cY)) * scale + (x − panX, y − panY)`;
blit depth = `int(z) + cZ` (cZ typically −50 for Ronja's tracks).

Scene table:

| id | name (Swedish) | Dutch | gfx base (`_n__###_SceneGFX…`) & variants | W | F | music (init cb) |
|---|---|---|---|---|---|---|
| 0x1001 | SKALLEPERSRUM | kamer van Schalle-Per | `_1a_SkallePersRum`; `…KISTAN` (de kist) if gVar 0x4cf90f | 640 | 784 | – |
| 0x1002 | LOVISMATTISRUM | kamer van Lovis en Mattis | `_1b_MattisLovis` | 640 | 783 | – |
| 0x1003 | STORASALEN | grote zaal | `_1c_StoraSalen` | 1280 | 1673 | dls_salen_112 / dls_eld_40 |
| 0x1004 | KOKET | keuken | `_1d_Koket` if !0x4cf8d7 or chapter==3; else `_1d_KoketKallarenVINTER` if chapter==2 && d5 && d6; else `_1d_KoketKallaren` (keuken met kelderluik) | 640 | 742 | dls_eld_40 |
| 0x1005 | BORGGARDEN | binnenplaats van de burcht | `_2a_Borggarden`; `…VINTER` if chapter==2 && d5 && d6 && d7 | 1920 | 2234 | dls_borggarden / dls_borggardenvinter |
| 0x1006 | VAPENHUS | wapenhuis | `_2b_Vapenhuset` – **no such gfx in subanis.apc: unused scene** | – | 1000 | – |
| 0x1007 | HELVETESGAPET | Hellegat (de kloof) | `_3_Helevtesgapet` | 640 | 717 | – |
| 0x1008 | TORNET | toren | `_4_Tornet` | 640 | 811 | – |
| 0x1009 | UTSIKTSKOGEN | uitkijkbos | `_5_Utsiktskogen` – **unused (no gfx)** | – | 1000 | – |
| 0x100a | KAELLARE | kelder | `_6_Kallaren` if 0x4cf8ed else `_6_KallarenSlackt` (gedoofd/donker) | 1280 | 1258 | – |
| 0x100b | FANGELSEHALOR | kerkerholen | `_7_Fangelset2` if 0x4cf8f5; else `_7_Fangelset` if 0x4cf8f3; else `_7_Fangelset3` | 640 | 730 | – |
| 0x100c | BORGPORTEN | burchtpoort | `_8_Borgporten`; `…VINTER` if chapter==2 && d5 && d6 && d7 | 640 | 983 | – |
| 0x100d | SKOGEN | bos | `_9_Skogen`; `_9_SkogenDIMMA` (mist) if chapter==2 && 0x4cf8fc && !d5 && 0x4cf8e5 | 1280 | 1445 | dls_skogenSommar_40 (vol 100) / dls_underjordiska_120_80 (vol 0x50) |
| 0x100e | KAELLAN | bron | `_10_Kaellan` | 640 | 877 | dls_kallan_40_40vol |
| 0x100f | GLAENTAN | open plek in het bos | `_12_Glaentan`; `…VINTER` requested if chapter==2&&d5&&d6&&d7 but **that gfx does not exist** (condition presumably never true there) | 1280 | 1566 | dls_skogenSommar_40 |
| 0x1010 | GLUPAFALLET | Glupa-waterval | `_13_Forsen` (stroomversnelling) | 1920 | 1854 | dls_forsenBrus_30_100vol |
| 0x1011 | TJAERNEN | bosmeertje | `_14_Tjaernen` | 640 | 850 | dls_tjarnensyrsor_40_70vol (vol 0x46) |
| 0x1012 | GROTTANUTE | buiten de grot | `_15_Grottanute` | 640 | 745 | dls_Forsengrottan_30_60vol (vol 0x37) |
| 0x1013 | GROTTANINNE | in de grot | `_16_Grottaninne` | 640 | 893 | dls_eld_40 (if fire lit) |
| 0x1014 | LABYRINT | doolhof | `_17_Labyrint` + room code (mode 4 only) | 640 | 700 | – |
| 0x1015 | BRAEDSPEL | bordspel | `_18_Braedspel` (mode 8 only) | 640 | 661 | – |

"chapter" = gVar 0x4cf8c4; d5/d6/d7 = gVar bytes 0x4cf8d5/6/7. Scene ids are stored in gVar 0x4cf8c8.

Location numbers: every asset, event and track name uses the **location number** of the scene as prefix
(1a SKALLEPERSRUM, 1b LOVISMATTISRUM, 1c STORASALEN, 1d KOKET, 2a BORGGARDEN, 2b VAPENHUS, 3 HELVETESGAPET,
4 TORNET, 5 UTSIKTSKOGEN, 6 KAELLARE, 7 FANGELSEHALOR, 8 BORGPORTEN, 9/9a/9b SKOGEN, 10 KAELLAN, 11 ski run,
12 GLAENTAN, 13 GLUPAFALLET, 14 TJAERNEN, 15 GROTTANUTE, 16 GROTTANINNE, 17 LABYRINT, 18 BRAEDSPEL). These are
not story chapters; the story act is `g8c4` (game-logic.md §1). The sound folder names (`ronja_1a_.wav` …)
follow the same numbering.

### 3.6 SetCurrentScene
1. If !force and scene == current → return.
2. If !arg4: stop the game thread (`FUN_004066d0`) and `Sleep(100)`.
3. Stop all audio: samples & sequences (`FUN_0047b030`), voice queue (`FUN_0047add0`), music
   (`FUN_0047ab30`).
4. For **every** object: hide sprite, hidden=1, stopTrack (end callbacks fire with interrupted=1),
   unload all its subanis (`FUN_00408940`). ⇒ objects are global; a scene's init callback must re-show
   and re-position whatever belongs there.
5. Game mode `gVar 0x4cf8c0`:
   * 0 (normal): pause clock; LoadSceneGfx(variant per the scene table, §3.5); resume clock; `DAT_004ee718 = scene`;
     `gVar 0x4cf8c8 = sceneId`; `NormalGame_SceneInitCallback_<id>` via `FUN_0045d3b0` (switch on
     sceneId → 0x45aeb0, 0x45b0a0, 0x45b290, 0x45b770, 0x45bb80, (none for 2B), 0x45be10, 0x45bf00,
     (none for 5), 0x45c080, 0x45c330, 0x45c4a0, 0x45c510, 0x45c6d0, 0x45c890, 0x45cc80, 0x45cea0,
     0x45d090, 0x45d270, (none for 17)). Callbacks are parameterless, return 0; they start music, place
     and show objects and set tracks.
   * mini-games (no init callback, gVar 0x4cf8c8 unchanged): 1 → Forsen gfx, scene GLUPAFALLET;
     2 → Tjaernen/TJAERNEN; 3 and 5 → BorgportenVINTER/BORGPORTEN; 4 → `"%s%s"(_17_Labyrint,
     roomSuffix)`/LABYRINT; 6 → Grottanute/GROTTANUTE; 7 → Forsen/GLUPAFALLET; 8 → Braedspel/BRAEDSPEL.
6. Restart the game thread (`FUN_00406720`, always).
SetCurrentScene does **not** set the pan; callers do (`FUN_0046b530`). New game (`FUN_004017a0`
L1563): `SetCurrentScene(&BORGGARDEN, true, 0, true)`, `pan = 640`. Load game (`FUN_0046efd0`):
saved sceneId + pan → `SetCurrentScene(scene, true, 0, false)`, `setPan(saved)`; RONJA (and BIRK
if chapter==3) restored with standStill(x,y,z,dir) + StillTracks[dir] (`FUN_0046f0d0`).

Scene enter scripts (`FUN_0045d3b0`, switch on sceneId): 0x1001 0x45aeb0, 0x1002 0x45b0a0, 0x1003 0x45b290,
0x1004 0x45b770, 0x1005 0x45bb80, 0x1007 0x45be10, 0x1008 0x45bf00, 0x100a 0x45c080, 0x100b 0x45c330,
0x100c 0x45c4a0, 0x100d 0x45c510, 0x100e 0x45c6d0, 0x100f 0x45c890, 0x1010 0x45cc80, 0x1011 0x45cea0,
0x1012 0x45d090, 0x1013 0x45d270; VAPENHUS, UTSIKTSKOGEN, LABYRINT: none; BRAEDSPEL: not in the switch.
Their content (placement, music, conditional scripted dialogs) is in game-logic.md §3.

### 3.7 Portals (exits)
Static ctors are at 0x459560-0x45a5c0: FUN_0046fab0 (10 args, no Birk) and FUN_0046fb60 (15 args, with Birk xy).
Fields: +0 scene, +4 target portal, +0xc dirmask (arrival facing; bit n → direction n), +0x10 actor (always RONJA), +0x14 second actor (BIRK, used only in act 3), +0x18 leave-track name, +0x1c arrive-track name, +0x28/+0x2c Ronja x,y, +0x30/+0x34 Birk x,y.

| portal name | addr | Ronja xy | dirmask | leave-track (played at this exit) | arrive-track (played when arriving here) | Birk xy | target |
|---|---|---|---|---|---|---|---|
| EXIT_SKALLEPERSRUM_to_TORNET | 0x4e6f30 | (306,268) | 0x20 | ronja_1a_614a1_garuppitorn | - | - | 0x4e6ef8 |
| EXIT_SKALLEPERSRUM_to_LOVISMATTISRUM | 0x4e6b28 | (486,271) | 0x08 | - | - | - | 0x4e6570 |
| EXIT_LOVISMATTISRUM_to_SKALLEPERSRUM | 0x4e6570 | (355,179) | 0x10 | - | - | - | 0x4e6b28 |
| EXIT_LOVISMATTISRUM_to_STORASALEN | 0x4e6a80 | (500,378) | 0x08 | ronja_1b_618a1_garstorasal | - | - | 0x4e6af0 |
| EXIT_STORASALEN_to_LOVISMATTISRUM | 0x4e6af0 | (192,352) | 0x20 | ronja_1c_619A1_garLovisMattis | - | - | 0x4e6a80 |
| EXIT_STORASALEN_to_BORGGARDEN | 0x4ec410 | (362,229) | 0x10 | - | - | - | 0x4e6b60 |
| EXIT_STORASALEN_to_KOKET | 0x4ed278 | (1070,263) | 0x08 | - | - | - | 0x4e4b10 |
| EXIT_KOKET_to_STORASALEN | 0x4e4b10 | (125,235) | 0x40 | - | - | - | 0x4ed278 |
| EXIT_KOKET_to_BORGGARDEN | 0x4e8c48 | (241,244) | 0x10 | - | - | - | 0x4e6028 |
| EXIT_KOKET_to_KAELLARE | 0x4e6ab8 | (224,344) | 0x80 | ronja_1d_620a1_garnerkallare | - | - | 0x4e8c10 |
| EXIT_BORGGARDEN_to_BORGPORTEN | 0x4ee230 | (413,320) | 0x40 | - | - | - | 0x4ee0f0 |
| EXIT_BORGGARDEN_to_KOKET | 0x4e6028 | (761,272) | 0x10 | - | - | - | 0x4e8c48 |
| EXIT_BORGGARDEN_to_STORASALEN | 0x4e6b60 | (1140,305) | 0x08 | - | - | - | 0x4ec410 |
| EXIT_BORGGARDEN_to_HELVETESGAPET | 0x4ea2a8 | (1720,341) | 0x08 | RONJA_2A_086A1_KlattraStege | RONJA_2A_624A1_garNerStege | - | 0x4ed680 |
| EXIT_HELVETESGAPET_to_BORGGARDEN | 0x4ed680 | (10,270) | 0x40 | - | - | - | 0x4ea2a8 |
| EXIT_TORNET_to_SKALLEPERSRUM | 0x4e6ef8 | (166,317) | 0x20 | ronja_4_615a1_garnerfrantorn | - | - | 0x4e6f30 |
| EXIT_KAELLARE_to_KOKET | 0x4e8c10 | (208,411) | 0x20 | ronja_6_622a1_garuppkallare | ronja_6_621a1_garnerkallare | - | 0x4e6ab8 |
| EXIT_KAELLARE_to_FANGELSEHALOR | 0x4e65e8 | (782,342) | 0x10 | ronja_6_123A1_taHylla | - | - | 0x4ecee0 |
| EXIT_KAELLARE_to_FANGELSEHALOR_2 | 0x4ea9a0 | (782,342) | 0x10 | ronja_6_123A1_taHylla | - | - | 0x4ecee0 |
| EXIT_FANGELSEHALOR_to_KAELLARE | 0x4ecee0 | (226,244) | 0x10 | - | - | - | 0x4e65e8 |
| EXIT_BORGPORTEN_to_BORGGARDEN | 0x4ee0f0 | (28,264) | 0x20 | - | - | - | 0x4ee230 |
| EXIT_BORGPORTEN_to_SKOGEN | 0x4e8bd8 | (539,418) | 0x08 | - | - | - | 0x4ed648 |
| EXIT_SKOGEN_to_BORGPORTEN | 0x4ed648 | (179,197) | 0x20 | - | - | - | 0x4e8bd8 |
| EXIT_SKOGEN_to_KAELLAN | 0x4e9c98 | (748,215) | 0x10 | - | - | 755,219 | 0x4e7be0 |
| EXIT_SKOGEN_to_GLAENTAN | 0x4ebbc0 | (525,236) | 0x08 | - | - | 543,234 | 0x4edfb8 |
| EXIT_SKOGEN_to_GLUPAFALLET | 0x4ec7a8 | (1234,240) | 0x08 | - | - | 1248,236 | 0x4e83e0 |
| EXIT_KAELLAN_to_SKOGEN | 0x4e7be0 | (597,152) | 0x08 | - | - | 620,152 | 0x4e9c98 |
| EXIT_KAELLAN_to_GLAENTAN | 0x4ea130 | (48,234) | 0x80 | - | - | 60,234 | 0x4e65a8 |
| EXIT_KAELLAN_to_TJAERNEN | 0x4ebc00 | (272,222) | 0x08 | - | - | 300,200 | 0x4e6438 |
| EXIT_GLAENTAN_to_KAELLAN | 0x4e65a8 | (506,244) | 0x10 | - | - | 500,250 | 0x4ea130 |
| EXIT_GLAENTAN_to_GROTTANUTE | 0x4ecb48 | (158,270) | 0x20 | - | - | 171,263 | 0x4e2490 |
| EXIT_GLAENTAN_to_SKOGEN | 0x4edfb8 | (880,207) | 0x20 | - | - | 900,226 | 0x4ebbc0 |
| EXIT_GLUPAFALLET_to_SKOGEN | 0x4e83e0 | (509,156) | 0x08 | - | - | 482,152 | 0x4ec7a8 |
| EXIT_GLUPAFALLET_to_TJAERNEN | 0x4ed610 | (474,262) | 0x08 | ronja_13_gen_uppforbro | ronja_13_gen_nerforbro | 504,240 | 0x4e6060 |
| EXIT_GLUPAFALLET_to_GROTTANUTE | 0x4ea270 | (1526,200) | 0x10 | - | - | 1526,200 | 0x4e63f8 |
| EXIT_TJAERNEN_to_KAELLAN | 0x4e6438 | (29,408) | 0x80 | - | - | 33,418 | 0x4ebc00 |
| EXIT_TJAERNEN_to_GLUPAFALLET | 0x4e6060 | (570,301) | 0x04 | - | - | 549,292 | 0x4ed610 |
| EXIT_GROTTANUTE_to_GLAENTAN | 0x4e2490 | (387,251) | 0x10 | - | - | 387,251 | 0x4ecb48 |
| EXIT_GROTTANUTE_to_GLUPAFALLET | 0x4e63f8 | (14,420) | 0x40 | - | - | 14,420 | 0x4ea270 |
| EXIT_GROTTANUTE_to_GROTTANINNE | 0x4edb20 | (146,268) | 0x20 | ronja_15_608a1_garingrotta | - | 138,283 | 0x4e7b90 |
| EXIT_GROTTANINNE_to_GROTTANUTE | 0x4e7b90 | (502,126) | 0x08 | ronja_16_609a1_garutgrotta | - | 490,140 | 0x4edb20 |

There are no portals for VAPENHUS, UTSIKTSKOGEN, LABYRINT or BRAEDSPEL (entered by code only). Facing on
arrival = direction bit in the dirmask (0x20 = SE, 0x08 = SW, 0x10 = S, 0x40 = E, 0x80 = NE, 0x04 = W).

### 3.8 Using an exit / scene transition
* Per-scene "walk" click handler (mode 0: `FUN_004697b0` case 1 → e.g. `FUN_0045f1a0`
  SKALLEPERSRUM, `FUN_004617a0` BORGGARDEN) samples the **I region** at the clicked scene point
  (mouse + pan); exit regions call `usePortal(&endpoint, −1, −1)` (`FUN_0045e460`), anything else
  `RONJA.setMovementDestination(x, y, 0, 0, −1)`. E.g. SKALLEPERSRUM region 2 → 0x4e6f30, region 3 →
  0x4e6b28; BORGGARDEN 1 → Borgporten, 2 → Koket, 3 → Storasalen, 6 → ladder 0x4ea2a8 (only if
  gVar 0x4cf8dc and not winter), 9 → 4 in the winter state (chapter 2 && d5..d8 && !d9 && !de) else 1,
  12 → 3 if 0x4cf8d4 else 10; HELVETESGAPET region 1 → back to Borggarden unless chapter 1 &&
  0x4cf8ea.
* `usePortal(ep, exitTrackOverride, enterTrackOverride)`: if `ep->walker == 0` → immediate transition
  (`FUN_0045e410`, which also interrupts the current movement callback with cb(1)). Else walker walks
  to (ep.x, ep.y) with callback `FUN_0045e4e0`, finalDir −1.
* On arrival (cb(0); interrupted → nothing): input lock `DAT_004ee744 |= 1`; exit track = override or
  `ep->exitTrack`; if none → transition now; else `setTrack(exitTrack, 0, LAB_0045e580)` and the
  transition happens when that track ends (normally).
* `FUN_0045e5d0(ep, …)` = same but without walking (play exit track where the walker stands).
* **Transition** `FUN_0046fcc0(ep) → FUN_0046fce0(ep->partner, walker, enterTrack)`:
  1. `walker.standStill(dest.x, dest.y, 0, keep dir)`; if chapter (0x4cf8c4) == 3 and the endpoint has
     a companion: `BIRK.standStill(x2, y2, 4000.0, −1)`.
  2. `SetCurrentScene(dest.scene, false, 0, false)` (hides everything, runs the scene init callback).
  3. `setPan((dest.x / 640) * 640)` – the screen page that contains the entry point.
  4. walker shown, zFromHeightMap = 1, currDirec = dest facing, `setPosition(x, y, 0)`,
     `setTrack(StillTracks[dir])`; if an enter track exists: `setTrack(enterTrack, 0x100, LAB_0046fff0)`
     (clears input lock bit 0 at its end); otherwise the input lock is cleared at once.
  5. Chapter 3: BIRK placed the same way at (x2,y2) with its still track (enter track for BIRK always
     none).

Helpers (CursorCallback_NormalGame.inl):
- `usePortal(portal, leaveTrack=-1, arriveTrack=-1)` = FUN_0045e460 (L75548). If the portal has no actor (+0x10==0) it transitions at once (FUN_0045e410). Otherwise it remembers the portal (DAT_004e83d8) and walks the actor (RONJA) to the portal's (x,y), z=0, with callback FUN_0045e4e0. On arrival (not aborted) it sets DAT_004ee744|=1 (input locked) and picks a track: the override, or the portal's leave-track name (+0x18, resolved by name via FUN_004500b0). With no track it transitions now. Otherwise it calls `setTrack(actor, track, 0, cb 0x45e580)` and transitions when that track finishes.
- Transition: FUN_0046fcc0(portal,-1,arrive) → FUN_0046fce0(**target portal**, …) (ScurrPortals.cpp). The actor stands still at the target (x,y). In **act 3 only** (g8c4==3) the portal's second object (BIRK) is placed at the target's Birk (x,y) and shown. Then SetCurrentScene(target scene), scrollX = (x/640)*640, face = direction from the dirmask, and the target's arrive-track (+0x1c) or the override is played (flag 0x100, cb 0x46fff0). DAT_004ee744 bit0 is cleared when there is no arrive-track.
- `FUN_0045e5d0(portal, leaveTrack, arriveTrack)`: same, but **no walking**. It cancels the actor's pending movement callback (actor+0x274, called with 1 = aborted) and plays the leave-track from the current spot. Used by the ladder in BORGGARDEN.
- `FUN_0045e410(portal, arriveTrack)`: immediate transition without walking or a leave-track.
- `FUN_0045e640(track)` / `FUN_0045e710(track)`: compute the start position (x,y,z) and the 8-direction index of the first frame of `track` for RONJA / BIRK. They write DAT_004e7bd4/d0/d8 + DAT_004ee748 (Ronja) and DAT_004ec300/04/08 + DAT_004ee74c (Birk). For a track with no position data they use the actor's current position.
- `FUN_0045e7e0(track)`: Ronja walks to the start of `track`, then plays it (cb LAB_0045e820: setTrack(RONJA, track, 0,0,0,0)).
- `FUN_0045e870(trackR, trackB)`: Ronja and Birk each walk to their track start. LAB_0045e920/LAB_0045e9d0 set bits 1/2 of DAT_004ee75c. When both have arrived (==3) both tracks start together. While waiting, DAT_004ee744|=2 and the first to arrive stands still.
- `FUN_0045ea70(eventId, trackR, trackB, doneCb)`: synchronised R+B walk to their track starts, then `DoDialogAni(eventId, doneCb, RONJA, 1)` (LAB_0045eb50/LAB_0045ebf0). Used with events 347/348 (12_212/213) and 442 (16_285 ataLax).
- `FUN_0045ec80(group, verb, trackR, trackB, doneCb)`: synchronised R+B walk, then `Dispatch(group, verb, doneCb, RONJA, 1)` (LAB_0045ed70/LAB_0045ee10). Used with groups 0x38/0x39/0x88.
- DAT_004ee744: bit0 = portal transition in progress (input locked), bit1 = waiting for the R+B walk sync.

### 3.9 Camera
* `setPan(p)` `FUN_0046b530`: `p = clamp(p, 0, sceneWidth − 640)`; `scene.panX = p`, panY = 0;
  `dxhwlayer.setBackgroundSurfacePan(p, 0)` (`FUN_00419b80`: just moves the background source rect);
  all objects marked dirty and re-blitted. The jump is **instantaneous** (no smooth scrolling).
* Camera rule (per frame, only if Ronja visible and `DAT_004c41f8` (end/"freeze camera", set by the
  final video `FUN_004030b0`) is 0), `pan` = current pan, `x` = Ronja.posX, `d` = currDirec:
  * while walking (path non-empty): `x < pan+25` and d ∈ {N,NW,W,SW,S} → new pan = pan − 320;
    `x > pan+615` and d ∈ {N,S,SE,E,NE} → pan + 320;
  * always: `x < pan+25` and d ∈ {NW,W,SW} → pan − 320; `x > pan+615` and d ∈ {SE,E,NE} → pan + 320.
  → half-screen (320 px) flips when Ronja comes within 25 px of the left/right screen edge while
  heading that way. Panoramas: 640 (no scroll), 1280, 1920 px wide.

---------------------------------------------------------------------------------------------------

## 4. Interaction

### 4.1 Mouse input and the verb coin ("tatita" = TA/TITTA/TALA)
#### Left button
- **WM_LBUTTONDOWN 0x405db0** (ignored while a Smacker movie plays, `FUN_0041a030`): priority order:
  1. Confirmation box open → §4.7; 2. map open → §4.6; 3. ESC menu open → §4.7; 4. choice lines shown → §4.4 text click; 5. otherwise **record a press**: dlg+0x4a1 = 1, dlg+0x4a4 = now (ms).
- **Hold → verb coin**: in the per-frame cursor routine 0x404f60 (L3212): if the computed cursor is the hotspot cursor `PEKARE__gen_###_hilite` (548) **and** a press is pending **and** `now − pressTime > 500 ms` → open the tatita (0x4033d0) at the current cursor position. Holding over a non-hotspot never opens it.
- **WM_LBUTTONUP 0x4063f0** (ignored during movie, menu, confirm box, dialog-busy dlg+0x5ee, or engine-busy `DAT_004ee744 != 0`):
  - tatita open → hide it and dispatch the selected verb (0x403710, below).
  - else if a press was pending (= short click):
    - inventory closed: item on cursor → `FUN_0046a4c0(sceneX, sceneY, objId)` = **use item on scene** (only in mode gVar 0x4cf8c0 == 0; per-scene handler table 0x46a020), cursor item dropped afterwards; otherwise `FUN_0046a3d0(sceneX, sceneY, 1)` = **verb 1 (walk / default action)**. The position used is the last cursor position seen by the frame update (dlg+0x350/0x354).
    - inventory open: no item held → pick up the item under the cursor (dlg+0x5f0 = slot+1; nothing if not on a slot); item held and cursor on a slot → **combine** `FUN_0046a4f0(heldObj, targetObj)`, refresh inventory, drop the held item.

#### Verb coin geometry (tatita.inl)
- Graphic `TATITA__gen_###_normal` 112x103: hand at the top, eye lower-left, mouth lower-right. Shown with top-left at (cx−58, cy−55), i.e. centred on the press point (cx,cy) (0x4033d0; dlg+0x498/0x49c = centre).
- While open the cursor is `PEKARE__gen_###_tatita` (560) and **0x403510** selects the verb from the vector (dx,dy) = cursor − centre (screen y down, angle = atan2(dy,dx), normalised to 0..2π):
  - distance ≤ 13 px → frame 550 (no verb);
  - distance > 50 px → cursor is pulled back onto the circle of radius 50 (`SetCursorPos(cx+50cos, cy+50sin)`);
  - angle ∈ [330°, 360°) ∪ [0°, 90°] (right / lower-right) → **TALA = mouth** (552 TalaHilite), verb code 2;
  - angle ∈ (90°, 210°] (down-left / left) → **TITTA = eye** (553 TittaHilite), verb code 4;
  - angle ∈ (210°, 330°) (up) → **TA = hand** (551 TaHilite), verb code 3.
- **Release (0x403710)**: if inventory closed → `FUN_0046a3d0(cx+scrollX, cy+scrollY, verb)` — the verb is applied at the **coin centre**, not at the release point. If released on the 13-px dead zone, nothing happens.
  If the inventory is open, slot = slot under the coin centre, obj = its objId:
  - EYE: KARTAN (30) → open map; else `FUN_0046a540(obj, 4)` (look at item).
  - MOUTH: `FUN_0046a540(obj, 2)` then rebuild inventory.
  - HAND: KARTAN → open map; else pick up as cursor, but the slot is taken from the **current cursor position** (which is up to 50 px above the centre) — quirk: can pick the item one row higher.
- **Verb dispatch** `FUN_0046a3d0(x, y, verb)` switches on gVar **0x4cf8c0 (UI mode)**: 0 = normal → `FUN_004697b0` = per-scene handler table indexed by gVar **0x4cf8c8 (current sceneId)** and verb 1 walk / 2 mouth / 3 hand / 4 eye (e.g. SKALLEPERSRUM 0x1001: 0x45f1a0/0x45f200/0x45f3f0/0x45f5f0; BORGGARDEN 0x1005: 0x4617a0/0x4618d0/0x461a20/0x461bc0; scenes without own handlers use 0x461e10). Handlers sample the region mask (`FUN_0046d120`) and call `FUN_0046dbb0(group, verb−2, …)`. Modes 1..8 are minigames with their own handlers (1: 0x4250f0, 2: 0x42e450, 3: none (sled), 4: 0x421d10, 5: 0x432720, 6: 0x42b380, 7: 0x426840, 8: 0x429e10).

### 4.2 Cursors
Hotspot (hx,hy) = point of the sprite placed at the mouse; sprite drawn at (mouse − hotspot).

| situation | subani | hotspot |
|---|---|---|
| engine busy (`DAT_004ee744 != 0`, e.g. portal transition) or dialog running without choice lines (dlg+0x5ee) | 557 `PEKARE__gen_###_invisible` | 0,0 |
| dialog with choice lines | 544 normal (+ y clamp, §4.4) | 32,24 |
| ESC menu or confirm box | 544 normal | 32,24 |
| verb coin open | 560 `PEKARE__gen_###_tatita` | 32,24 |
| inventory open | 548 hilite over an occupied slot, else 544 | 32,24 |
| map open | directional cursor over an available region (§4.6), else 544 | 52,32 / 32,24 |
| normal scene, mode 0 | scene cursor function `FUN_004694b0` (per sceneId; returns 544 / 548 hilite / riktad* exits) | per scene (normal 32,24, riktad 52,32) |
| minigame modes | 1,7,8: 555 `PEKARE__forsen_###_hilite` over targets; 2,6: 559 `prickaKotteCursor` (14,12); 3: 557 invisible (16,16); 4: riktadV/N/NO/O by region (labyrinth); 5: 556 `prickaRovareCursor` (16,16) | |
| item held (dlg+0x5f0>0) | the item's inventory sprite | 32,32 |
| cursor normal and x < 10 and scrollX > 0 | 549 riktadV pinned to the left edge (hotspot x+5,32) | |
| cursor normal and x > 630 and scrollX < maxScroll | 543 riktadO pinned at x=542 (hotspot x−542,32) | |

Cursor sprite sizes: PEKARE normal/hilite/tatita 64x48, riktad* 104x64, item icons 25x39..64x64.

Cursor sprites (subani, hotspot):

| cursor | subani | hot (x,y) |
|---|---|---|
| normal | 544 `PEKARE__gen_###_normal` | (32,24) |
| hilite (hotspot) | 548 `PEKARE__gen_###_hilite` | (32,31) |
| exit west | 549 `…_riktadV` | (52,32) |
| exit north | 545 `…_riktadN` | (52,32) |
| exit north-east | 546 `…_riktadNO` | (52,32) |
| exit north-west | 547 `…_riktadNV` | (52,32) |
| exit east | 543 `…_riktadO` | (52,32) |
| exit south | 558 `pekare__gen_###_riktadS` | (52,32) |
| mini-game hilite | 555 `PEKARE__forsen_###_hilite` | (32,24) |
| invisible | 557 | (16,16) |
| aim robbers | 556 `prickaRovareCursor` | (16,16) |
| aim pine cone | 559 `prickaKotteCursor` | (14,12) |

"Roodbruin" (the manual's red-brown cursor = "something to discover") is `PEKARE__gen_###_hilite` (S548): the
scene cursor function returns it over regions whose hotspot is active in the current state; exits return the
directional arrows `riktad*`.

### 4.3 Region masks and per-scene handlers
There are no per-scene callback tables or function pointers in the scene objects. Everything is hard-coded `if/switch` chains on the current scene id. The current scene id is `*(curScene+0xe8)`, where `curScene` = DAT_004ee718, or the copy in gVar `g8c8` (0x4cf8c8, written by SetCurrentScene at 0x45dcc8).

`FUN_0046d120(x,y)` returns `I[(y>>2)*(W>>2) + (x>>2)]` (byte per 4×4 px cell of the scene's `I` layer, coordinates
clamped, 0 if no mask). Region 0 is never a hotspot. Several scenes remap region ids by state before switching.
In act 3, forest handlers first pixel-hit-test BIRK (`FUN_00456940` on his current frame) and treat a hit as
synthetic region 0x80.

Mode dispatch (`g8c0` = game mode; 0 = adventure, 1..8 = minigames):

| g8c0 | mini-game (set by) | cursor fn | click fn (any verb) |
|---|---|---|---|
| 0 | normal | FUN_004694b0 → per-scene cursor | FUN_004697b0 → per-scene verb handlers |
| 1 | Forsen 1: rapids jumping, GLUPAFALLET (FUN_00424ad0; ends FUN_00425c40 sets g8e1) | FUN_0045e190 | FUN_0045e230 → FUN_004250f0(RONJA) |
| 2 | Gråvargar at the tarn (scene 14): throwing pine cones (start FUN_0042d4e0 called from TJAERNEN code; per-tick update FUN_0042efc0 sets g8dd at 0x42feec on success; exit 0x430130) | FUN_0045e090 (prickaKotteCursor) | FUN_0045e0c0 → FUN_0042e450 |
| 3 | Ski run (FUN_00430210; plays winter.smk, SetCurrentScene BORGGARDEN; ends FUN_00430f90 sets g8e0) | FUN_0045e060 (invisible cursor) | FUN_00403110 (no-op) |
| 4 | Labyrinth (FUN_00421240 → LABYRINT; ends FUN_00422230 sets g8f1) | FUN_0045e310 (direction cursors by region) | FUN_0045e3f0 → FUN_00421d10 |
| 5 | Snowball fight "Pricka rövarna" (FUN_00431010, music dls_prickaRovarna; ends 0x432810 sets g8de) | FUN_0045e010 (prickaRovareCursor) | FUN_0045e040 → FUN_00432720 |
| 6 | Gråvargar in scene 15 (cave front): pine cones (start FUN_0042a440; update FUN_0042c8e0 sets g8df at 0x42d323; exit 0x42d3f0) | FUN_0045e090 (prickaKotteCursor) | FUN_0045e0e0 → FUN_0042b380 |
| 7 | Forsen 3: Vildvittra attack at the rapids (FUN_00425d10; ends FUN_00427e00 sets g8e2) | FUN_0045e250 | FUN_0045e2f0 → FUN_00426840 |
| 8 | Tärningsspel (dice) with Skalle-Per (FUN_00427ed0, SetCurrentScene(0)) | FUN_0045e100 | FUN_0045e170 → FUN_00429e10 |

Entry points (called from GameDlg):
- **Cursor**: `FUN_0046a2a0(worldX, worldY, &hotX, &hotY)` stores the mouse in DAT_004e9360/64, picks the cursor by mode and returns the cursor sub-ani serial. `*hotX,*hotY` = the cursor hot-spot inside the sprite.
- **Click**: `FUN_0046a3d0(worldX, worldY, verb)`. verb 1 = plain left click (walk/exit). verbs 2/3/4 come from the verb coin: GameDlg FUN_00403710 maps cursor sub-ani 0x800228 → 2 (MOUTH, tala), 0x800227 → 3 (HAND, ta) and 0x800229 → 4 (EYE, titta). The coordinates are world coordinates (screen + scene scroll `curScene+0xf8/+0xfc`).
- **Use inventory item on scene**: `FUN_0046a4c0(worldX, worldY, objId)` only works in mode 0 and calls FUN_0046a020. objId comes from the inventory slot table DAT_004c8024[slot].
- **Combine two inventory items**: `FUN_0046a4f0(idA, idB)`: OST(0x25)+RATTBUR(0x27) gives `OST.holder=&RATTBUR` (cheese put in the trap); FLINTA(0x1a)+ELDSTAL(0x13) gives `FLINTA.holder=&ELDSTAL`. Every other pair does nothing. EYE on an inventory item is `FUN_0046a540` (groups 0x66..).

Per-scene handlers in mode 0 (columns walk/MOUTH/HAND/EYE = click verbs 1/2/3/4 → `FUN_004697b0`; cursor →
`FUN_004694b0`; use item → `FUN_0046a020`; `nop` = FUN_00461e10 (does nothing), `none` = FUN_00403110, `stdcur` = always
the normal cursor):

| scene | cursor | walk(1) | MOUTH(2) | HAND(3) | EYE(4) | use item |
|---|---|---|---|---|---|---|
| 1A SKALLEPERSRUM | 45f040 | 45f1a0 | 45f200 | 45f3f0 | 45f5f0 | 45f7e0 |
| 1B LOVISMATTISRUM | 45f8d0 | 45fa20 | 45fa80 | 45fad0 | 45fb20 | nop |
| 1C STORASALEN | 45fdd0 | 4601e0 | 4602b0 | 4604f0 | 460690 | 460830 |
| 1D KOKET | 460930 (asm only, Ghidra missed it) | 460c50 | 460d00 | 460e60 | 460fc0 | 461120 |
| 2A BORGGARDEN | 461430 | 4617a0 | 4618d0 | 461a20 | 461bc0 | 461d10 |
| 2B VAPENHUS | stdcur | none | nop | nop | nop | nop |
| 3 HELVETESGAPET | 461e30 | 461f50 | 461fe0 | 462020* | 462060* | 4620a0* |
| 4 TORNET | 462220* | 462320* | 462370* | 4623c0* | 462410* | nop |
| 5 UTSIKTSKOGEN | stdcur | none | nop | nop | nop | nop |
| 6 KAELLARE | 462480* | 462650* | 462720* | 4627d0* | 462880* | nop |
| 7 FANGELSEHALOR | 462a60* | 462b50* | 462ba0* | 462bf0* | 462c40* | 462c90* |
| 8 BORGPORTEN | 462d00* | 462d90* | nop | nop | nop | nop |
| 9 SKOGEN | 4631f0* | 463440* | 463660* | 463850* | 463a40* | 463c30* |
| 10 KAELLAN | 463cc0* | 463f20* | 464070* | 464320* | 4645d0* | 464880* |
| 12 GLAENTAN | 464c60* | 464f60* | 4650c0* | 465590* | 465a60* | 465f30* |
| 13 GLUPAFALLET | 4660f0* | 466400* | 4665d0* | 4668e0* | 466c00* | 466f10* |
| 14 TJAERNEN | 466f90* | 467250* | 4672f0* | 4676c0* | 4679d0* | 4689c0* |
| 15 GROTTANUTE | 467da0* | 468010* | 468100* | 468410* | 4686f0* | 4689c0* |
| 16 GROTTANINNE | 468b40* | 468c60* | 468ce0* | 468ef0* | 469100* | 469320* |
| 17 LABYRINT | stdcur | none | nop | nop | nop | nop |

A handler typically: samples the region at the clicked scene point; for exits calls `usePortal`; for hotspots calls
the dispatcher `FUN_0046dbb0(group, verb−2, doneCb, &RONJA, 0)` choosing the hotspot group by game state; for
anything else walks (`setMovementDestination(x, y, 0, 0, −1)`). Item drops test region + item objId + state and
start events/tracks; **unhandled combinations do nothing** (no generic "that doesn't work" line is ever played:
events #618-#621 `_507A1_OstenRattfallan`, `_508A1_EldstaletFlintan`, `_509A1_FelSaker`, `_510A1_FelSakerAlternativ`
are dead data).

### 4.3b Interaction database: hotspot groups, events, voice lines, choices

All dialogue and verb reactions are **static data compiled into Game.exe** (generated C++ in `gVar.cpp`,
static constructors at 0x431800-0x44f000). The extracted tables are in `src/data/dialog-events.json` (choice texts excluded; they come from language.str at runtime).

| Table | VA | Count | Constructor | Content |
|---|---|---|---|---|
| hotspot groups | PTR 0x4990b8 | 143 (idx 0..142, named by Roman numerals "0","I".."CXLIII") | 0x41cdb0 | 4 event lists: +0x08 verb 1 (scripted), +0x14 verb 2 MOUTH, +0x20 verb 3 HAND, +0x2c verb 4 EYE |
| events | PTR 0x4992f8 (count 0x4992f4) | 746 | 0x41cf00(this, &group, minUse, id, verb, name, nextName) | +0 id, +4 name, +0xc next event name, +0x1c minUse, +0x24 say list, +0x30 alt list |
| says (voice lines) | PTR 0x499ea8 (count 0x499ea0) | 827 (484 distinct sounds) | 0x41ce80(this, &event, idx, soundName) | +8 sound name |
| alts (choices) | PTR 0x49ab98 (count 0x49ab94) | 173 (91 distinct) | 0x41ceb0(this, &event, idx, soundName, nextName) | +4 Dutch text, +8 sound name, +0xc next event name ("0" = none) |

* Event names follow `_<loc>_<nnn><branch><k>_<desc>` where `<loc>` is the **location number** used everywhere in
  asset names (1a Skalle-Pers room, 1b Mattis/Lovis room, 1c great hall, 1d kitchen/cellar, 2a castle yard, 3 Hell's Gap,
  4 tower, 6 cellar, 7 prison, 8 castle gate, 9a/9b forest, 10 spring (källan), 11 ski run, 12 glade, 13 river,
  14 lake, 15 cave outside, 16 cave inside, 17 labyrinth, 18 dice board). `<desc>` starts with the verb in Swedish:
  `titta` (look/EYE), `tala` (talk/MOUTH), `ta` (take/HAND), `ge` (give = use item), others are scripted.
* Event "minUse" (field +0x1c, called *kind* in the tables): 0 = scripted, 1 = first use, 2 = second use, 3 = third and later.
  Typical pattern: `tittaX` (minUse 1, a real remark) + a minUse-3 event that plays the generic
  `RONJA_2a_338A1Say1_FarAtPipsvangen` remark.
* `language.str` (UTF: cp1252) = u32 count (173) then `key\0text\0` pairs. **The loader 0x41cc40 ignores the keys and
  assigns texts positionally** to alt 0..172 (order verified identical to the key order in the file). Says have no text:
  **there are no subtitles**; only choices are displayed.
* Every say/alt name resolves (case-insensitive) to `sounds/**/<name>.wav` (all 484+91 resolve; the alt is spoken by
  Ronja after it is clicked).

#### Verb dispatch (0x46dbb0)

`dispatch(group, v, doneCb, actor, force)` with v: 0 = MOUTH, 1 = HAND, 2 = EYE.
1. `n = useCount[group*3+v]++` (array 0x4e08e0, 143*3 int32, reset at init 0x44ff00; saved in the save game).
2. Walk the group's list for that verb; choose the **last** event whose `minUse <= n+1` (lists are in declaration order,
   i.e. ascending minUse). If no event qualifies, the **first** event of the list is used (a group whose only event
   has minUse 3 therefore plays it from the first click). An empty list does nothing.
3. `DoDialogAni(event.id, doneCb, actor, force)`.
Scene code (per-scene click handlers, see game-logic.md) decides *which* group to dispatch based on region id and game state;
the region mask does not encode group numbers directly.

#### Playing an event: DoDialogAni 0x46da60 / step 0x46d780 / end 0x46d530

State: current event 0x4ee268, say index 0x4e8c80, chosen alt 0x4ed6b8 (-1 = none), done callback 0x4eb4f8, actor 0x4ea268.
1. `DoDialogAni(id, cb, actor, force)`: disables the UI (0x404d80), resets state. If `actor` != null, look up the
   *dialog animation track*: tracks are indexed by the part of their name after the first `_` (map 0x4e08d8 built
   in 0x450b30), so event `_1c_034A1_tittaMattis` finds track `ronja_1c_034A1_tittaMattis`. If not found, retry with
   suffix `A` (`"%sA"`, 0x4bfbd4). If found: unless `force`, the actor first **walks to the track's start position**
   (0x456e00) and then starts the track (setTrack(serial, 0x100, cb 0x46d720)); with `force` the track starts at once.
   When the track reaches its end/marker the step function runs. If no actor or no track: step immediately.
2. Step 0x46d780:
   * while `sayIdx < event.sayCount`: play say[sayIdx] sound (playSound 0x458090, end callback 0x46d5a0 → sayIdx++ → step).
     A cancelled sound (callback flag != 0) ends the dialog (0x46d530(1)).
   * else, if the event has alts and none chosen: clear the 5 text lines (0x46cdc0) and add one line per alt
     (max 5, AddTextInputLine 0x46ccc0 with callbacks 0x46d680..0x46d700 that set chosen = 0..4 and re-enter step).
   * else, if an alt was chosen: play the alt's sound (callback 0x46d5f0); afterwards, if the alt has a next event
     → `DoDialogAni(next, cb, actor, force=1)`, else end.
   * else (no alts): if `event.next` → `DoDialogAni(next, cb, actor, 0)`, else end.
3. End 0x46d530(cancelled): clear state, call `doneCb(cancelled)` if set, re-enable UI (0x404e60).
Note: the done callback is carried through the whole chain of next events, so scene code gets one callback per
conversation (used to set flags / give items after a conversation).

Dialog-done callbacks: before `doneCb(aborted)` runs, `DAT_004bc000` = id of the last event played in the chain and
`DAT_004bc004` = index of the last chosen alt (or −1); both are reset to −1 afterwards. Scene scripts branch on
them (e.g. "if the conversation ended with event #93 → start the dice game").

Statistics: 746 events (168 EYE, 157 MOUTH, 156 HAND, 265 scripted/continuations), 827 voice lines
(484 distinct WAVs), 173 choices (91 distinct texts), 143 hotspot groups. Speakers by WAV count: Ronja 325,
Birk 70, Mattis 42, Skalle-Per 39, Lill-Klippen 24, Lovis 20, others < 10.

### 4.4 Choice lines (dialogue menu at the bottom)
- `AddTextInputLine(text, cb, param)` 0x46ccc0: max 5 lines (6th returns −1), empty text → −2; appends to a list and re-renders (0x4073c0). Only callers: dialog choices (0x46d780: up to 5 alts with callbacks 0x46d680/6a0/6c0/6e0/700) and the cheat texts. **No subtitles exist** (`writeTextToSurface` is only used for these lines).
- Rendering 0x4073c0: the text strip is filled with ARGB 0x40FFFFFF (translucent white, UNCERTAIN exact alpha) and lines are **bottom-aligned**: with n lines, rows 5−n..4 are used (first list entry = topmost); row r is shown at screen y = 380+20r, 640x20; text written at x = 0 with `normalFont`; the returned text width `w[r]` is stored (DAT_004c80d8[r]). Showing lines closes the inventory and sets dlg+0x5ed.
- **No hover highlight.** Cursor = normal arrow, and the mouse is clamped so y ≥ top line (380/400/420/440/460) (0x404d90).
- Click (0x405db0): row r selected if 380+20r ≤ y < 400+20r and **x < w[r]** (clicks right of the text are ignored) → `cb(param)`. Choices pick the alt (sound + next event, §4.3b); cheat lines use 0x401790 = clear all lines.
Rendering details: §2.8. The texts come from `language.str` (positional), e.g. alt 0 "Hoe weet ik wat vogelheksen,
onderaardsen en Borkarovers zijn?".

### 4.5 Inventory
- **Open**: right-click (0x4065e0) when no movie/menu/confirm box, gVar 0x4cf8c0 == 0 (no minigame) and engine not busy. Right-click while holding an item just drops the item (inventory stays). Right-click with inventory open and no item → close. During a running dialog (dlg+0x5ee) right-click only closes the inventory and drops the item.
- **Display** (0x4038e0): closes menu/map, shows `_inv__###_MainGfx` (640x480 parchment) centred at (320,240); `ReturnObjectsInInventory` builds the list; item i drawn **centred at (180 + 70·(i mod 5), 100 + 70·(i div 5))** (5 columns, up to 20 slots, sprite drawn at its own size). If the cursor is outside x 20..620 / y 20..460 it is warped to (320,240).
- **Slot hit test 0x403e00**: valid only for 50 < x < 590 and 50 < y < 430; slot = (x−145) div 70 + ((y−65) div 70)·5 (C integer division truncating toward 0), must be < item count. Quirks: x 76..144 and y 51..64 still map to column/row 0; columns ≥5 (x ≥ 495) wrap into the next row's first slots.
- **Auto-close**: moving the cursor to x ≤ 15, x ≥ 625, y ≤ 15 or y ≥ 465 (0x404e80, not while the coin is open); opening the map, the menu, or choice lines also close it.
- **ReturnObjectsInInventory 0x46d180**: fixed order (not pickup order); an object is listed when `obj+0xec == &RONJA`:

| # | object (id) | icon subani | condition / variant |
|---|---|---|---|
| 1 | BRODKAKA (15) | S1 brodkaka__inv | |
| 2 | ELDSTAL (19) | S38 eldstal__inv_medflinta if FLINTA.holder == ELDSTAL, else S2 eldstal__inv | |
| 3 | FACKLA (24) | S7 fackla__inv_tand if gVar 0x90d, else S6 fackla__inv_slackt | |
| 4 | FISKNAT (25) | S10 | |
| 5 | FLINTA (26) | S3 | |
| 6 | FNOSKE (27) | S12 | |
| 7 | KARTAN (30) | S39 karta__inv | |
| 8 | LAX (34) | S15 | |
| 9 | MOROTTER (35) | S16 | |
| 10 | OST (37) | S21 | |
| 11 | NYCKEL (36) | S13 | |
| 12 | RATTA (38) | S22 | |
| 13 | RATTBUR (39) | S25 rattfalla_medRatta if RATTA.holder == RATTBUR; S24 rattfalla_laddad if OST.holder == RATTBUR; else S23 | |
| 14 | REM (40) | S34 | |
| 15 | VATTENKARL (47) | S29 vattenkarl_fullt if gVar 0x90e, else S30 tomt | |
| 16 | VITMOSSA (48) | S32 | |

  Arrays: `DAT_004c8028[slot]` = objId, `DAT_004c8080[slot]` = icon serial (also used as the held-item cursor).
- **Combine 0x46a4f0** (only two recipes, no feedback for others): OST(37)+RATTBUR(39) either order → `OST.holder = RATTBUR` (loaded rat trap); FLINTA(26)+ELDSTAL(19) → `FLINTA.holder = ELDSTAL` (fire steel with flint). (Events `OstenRattfallan`, `EldstaletFlintan`, `FelSaker` exist in group 120 but are not played from here.)
- **Look / talk at items 0x46a540** (`FUN_0046dbb0(group, verb−2)`; only EYE events exist, so MOUTH/HAND normally do nothing): RATTA→102 tittaRatta; RATTBUR→104 tittaLaddadRattfalla if OST in it, else 103 tittaTomRattfalla; NYCKEL→105; OST→106; FNOSKE→107; ELDSTAL→108; FLINTA→109; FACKLA→111 (lit, 0x90d) / 110; MOROTTER→112; BRODKAKA→114; VATTENKARL→116 (full, 0x90e) / 115; FISKNAT→117; LAX→118; VITMOSSA→119; REM→120 (tittaSkinnrem); KARTAN with MOUTH → group 141.

### 4.6 The map (kartan)
EYE or HAND on KARTAN in the inventory (0x403710) → 0x403e70: closes inventory/menu, picks the picture by gVar **0x4cf8d0 (map bitmask)**, shows it centred (587x440 → top-left (27,20)) on the inventory sprite, dlg+0x5ec = 1. Closes when the cursor leaves x 20..619 / y 20..459 (cursor routine), or after a travel click.

#### Map bits and pictures
Bits (set in the scene-init callback when the place is first entered): 0x01 SKOGEN (0x45c510), 0x02 KAELLAN (0x45c6d0), 0x04 TJAERNEN (0x45cea0), 0x08 GLUPAFALLET (0x45cc80), 0x10 GLAENTAN (0x45c890), 0x20 GROTTANUTE (0x45d090).
Picture per value: 1→map2, 3→map3, 7→map4, 9→map12, 0x0b→map8, 0x0d→map20, 0x0f→map5, 0x13→map16, 0x17→map18, 0x19→map13, 0x1b→map9, 0x1f→map6, 0x29→map15, 0x2b→map11, 0x2d→map21, 0x2f→map23, 0x33→map17, 0x37→map19, 0x39→map14, 0x3b→map10, 0x3d→map22, 0x3f→map7 (all coloured); any other value, or chapter 2 with gVar 0x8d5 & 0x8d6 & 0x8d7 all set → map1 (nothing coloured). (map23 is never pre-loaded with addSubAni; it may fail to show — UNCERTAIN.)

#### Map hotspots (screen coords, exclusive bounds) and travel (0x405db0 / 0x405c60)

| place (map label) | rect x / y | needs bit | hover cursor |
|---|---|---|---|
| BORGPORTEN "Mattisburcht" | 93..270 / 80..181 | none | 547 riktadNV |
| SKOGEN "Woud" | 86..219 / 205..279 | 0x01 | 549 riktadV |
| KAELLAN "Bron" | 234..339 / 203..270 | 0x02 | 545 riktadN |
| TJAERNEN "Meer" | 234..352 / 292..344 | 0x04 | 545 riktadN |
| GLUPAFALLET "Stroomversnelling" | 185..406 / 361..407 | 0x08 | 558 riktadS |
| GLAENTAN "Open plek" | 388..540 / 152..221 | 0x10 | 546 riktadNO |
| GROTTANUTE "Berenhol" | 385..494 / 245..309 | 0x20 | 543 riktadO |

("Waterval" on the picture has no hotspot.) Click order: BORGPORTEN is tested first and always works. Then: chapter 2 with 0x8d5/6/7 set → no other travel. Special states — (scene SKOGEN, chapter 2, 0x8fc, !0x8d5, 0x8e5) or (scene HELVETESGAPET, chapter 1, 0x8dd, 0x8e1, REM carried, !0x8ec, 0x8ea) — any further click closes the map and sends a verb-1 click at scene (10,10) (scripted refusal/event; UNCERTAIN).
Travel `FUN_00405c60(destSceneId)`: the current location gets a bit (SKOGEN 1, KAELLAN 2, TJAERNEN 4, GLUPAFALLET 8, GLAENTAN 0x10, GROTTANUTE 0x20, BORGPORTEN 0x40, GROTTANINNE 0x100, anything else = castle 0x80); the first table entry whose "from"-mask contains it is used through `FUN_0045e410(portal,-1)` (engine busy flag, portal transition = like walking through that exit; you arrive at the portal's partner). Tables 0x48a210 (masks) / 0x48a268 (portals):

| destination | from-mask → portal used (portal scene → arrives at) |
|---|---|
| BORGPORTEN | 0x13f (all forest + GROTTANINNE) → 0x4ed648 SKOGEN→BORGPORTEN (539,418); 0x80 (castle) → 0x4ee230 BORGGARDEN→BORGPORTEN (28,264) |
| SKOGEN | 0xc0 → 0x4e8bd8 BORGPORTEN→SKOGEN (179,197); 0x136 → 0x4e7be0 KAELLAN→SKOGEN (748,215); 0x08 → 0x4e83e0 GLUPAFALLET→SKOGEN (1234,240) |
| KAELLAN | 0xc1 → 0x4e9c98 SKOGEN→KAELLAN (597,152); 0x0c → 0x4e6438 TJAERNEN→KAELLAN (272,222); 0x130 → 0x4e65a8 GLAENTAN→KAELLAN (48,234) |
| TJAERNEN | 0x1f3 → 0x4ebc00 KAELLAN→TJAERNEN (29,408); 0x08 → 0x4ed610 GLUPAFALLET→TJAERNEN (570,301) |
| GLAENTAN | 0xcf → 0x4ea130 KAELLAN→GLAENTAN (506,244); 0x120 → 0x4e2490 GROTTANUTE→GLAENTAN (158,270) |
| GLUPAFALLET | 0x136 → 0x4e6060 TJAERNEN→GLUPAFALLET (474,262); 0xc1 → 0x4ec7a8 SKOGEN→GLUPAFALLET (509,156) |
| GROTTANUTE | 0xdf → 0x4ecb48 GLAENTAN→GROTTANUTE (387,251); 0x100 → 0x4e7b90 GROTTANINNE→GROTTANUTE (146,268) |

Clicking the place you are in (no matching mask) just closes the map. Portal coordinates are from the portal definitions (FUN_0046fab0/0x46fb60, L72336-72738).

### 4.7 ESC main menu, save and load
#### Keyboard
- **ESC** (0x405710) — ignored while a movie plays, during dialog (dlg+0x5ee) and in minigame modes (gVar 0x4cf8c0 != 0): confirm box open → close it; menu open in a slot screen → back to main page (frame 0, or 3 if game not started); menu main page → close menu (plays intro.smk if 0x912 == 0); otherwise open menu.
- **Ctrl+Q**: immediate quit (no confirmation, no credits) → 0x403070 shutdown/OnOK. Ctrl state tracked by KEYDOWN/KEYUP of VK 0x11.
- **Space or ESC during the end credits** (DAT_004c41f8 set, movie playing, mode 0): immediate quit.
- Movies are otherwise **not skippable**: all mouse handlers and the key handler ignore input while `FUN_0041a030` (Smacker active) is true.

#### Menu (0x404230)
Opening: hide coin, inventory, map; take a **thumbnail** of the current screen (80x60, each pixel = average of an 8x8 block, stored as 12-bit RGB 4:4:4, buffer 0x4c1c78); show subani 540 (640x480 parchment) frame **0** if gVar 0x912 (game started) else frame **3** (same art with "Bewaar spel" defaced). Buttons (screen, exclusive bounds, all x 160 < x < 480):

| y range | label | action |
|---|---|---|
| 165 < y < 215 | Laad spel | frame 1 (load page), mode 1 |
| 239 < y < 289 | Bewaar spel | only if 0x912: frame 2 (save page), mode 2 |
| 305 < y < 355 | Nieuw spel | confirm box kind 3 |
| 372 ≤ y ≤ 420 | Afsluiten | confirm box kind 4 |

- **Slot pages** (frame 1 "Laad spel" / frame 2 "Bewaar spel"): 16 squares, 4x4; square (col c, row r), slot = 4r+c, rect x 141+90c .. 221+90c, y 87+80r .. 147+80r (80x60, exclusive). On entering, 0x404610 reads `RONJAS0.sav`..`RONJAS15.sav` (cwd); each readable file's first 9600 bytes (the thumbnail) are drawn into its square; a bitmask of existing slots is kept.
  - Load page: click occupied slot → confirm kind 1; empty → nothing.
  - Save page: click occupied → confirm kind 2 (overwrite); empty → save immediately.
- Save (0x4049d0): `fopen("RONJAS%d.sav","wb")`, write the 9600-byte thumbnail, `SaveRONJA`, close menu. Load (0x404920): read thumbnail (discarded), `LoadRONJA`, close menu.

#### Confirmation box ("Weet je het zeker?  JA  NEE")
`_main__###_USure` (300x90) shown on the tatita sprite centred at (320,240) (0x404a80, kind stored in dlg+0x5e8). While open the mouse is clamped to centre ±100 x / ±35 y (220..420, 205..275). Click (0x404c80): dx = x−320, dy = y−240; if dy > 0 and dx < −20 → **JA**; if dy > 0 and dx > 20 → **NEE** (box closes, nothing happens); else ignored. JA executes kind: 1 = load slot, 2 = save slot (overwrite), 3 = **new game**, 4 = **quit** (`FUN_004030b0`: plays the end credits, see §1.6).
- **New game** (kind 3): `FUN_0041e500(gVar)` resets mode 0, chapter 1, ints 0x8c8/0x8cc/0x8d0 = 0, all byte flags 0x8d4..0x917 **except 0x8d9** (not cleared — original quirk), and all 143×3 use counters; gVar 0x911 = 1; `SetCurrentScene(&BORGGARDEN, true, 0, false)` (→ intro.smk path, because 0x912 is still 0 at that moment); scroll 640; 0x912 = 1; close menu. Objects (holders/positions) are **not** reset here (UNCERTAIN whether scene scripts restore them; a port should reset objects to their initial state).

#### Save-game contents (in file order) — SaveRONJA 0x46f640 / LoadRONJA 0x46f740
0. 9600-byte thumbnail (written by the menu, not by SaveRONJA).
1. **gVar** (`FUN_0041e6e0`): 5 int32 at gVar+0xe8..0xf8 (0x4cf8c0 mode, 0x4cf8c4 chapter, 0x4cf8c8 sceneId, 0x4cf8cc, 0x4cf8d0 map bits), then the 68 byte flags 0x4cf8d4..0x4cf917, then magic int32 0x58 (load fails if different).
2. **Objects** (`SerializeObjects` 0x46e5c0 → `Serialize_One_Object` 0x46e020) for all 49 objects in objId order 1..49 (RONJA..VILDVITTRA): objId (must match), holder id (objId or sceneId of `+0xec`, 0 = none), position x,y,z (floats +0xf0/+0xf4/+0xf8), int32 fields +0x22c, +0x234, +0x230, +0x238, +0x23c, +0x240, +0x244 (UNCERTAIN meaning: track/animation state), field +0x248 cleared on load, bytes +0x262, +0x263, **hidden flag +0x264** (on load: if set the sprite is hidden), int32 +0x278.
3. **Scene** (0x46efd0): current sceneId and scrollX; load → `SetCurrentScene(scene, true, 0, false)` + scroll.
4. **Ronja & Birk** (0x46f0d0): x, y, z, direction for RONJA then BIRK. On save, a hidden Ronja/Birk is first moved to (3000, 5000, 7000) (live state is modified). On load Ronja is placed with `standStillAtDestination` and her stand track for that direction; **Birk is only restored when chapter == 3**.
5. **Use counters** (0x46f4d0): count (143), then 143 × {MOUTH, HAND, EYE} int32 dispatcher counters (missing entries zeroed).
Save-file byte layout: formats.md §8.

### 4.8 Keyboard cheats / easter eggs
Every key-down (virtual-key code, not during movies) is pushed into a 16-byte history, **newest first**; strings are compared case-insensitively against the start of the history, so the code is typed in **reverse** of the stored string:

| type these keys | stored string | effect |
|---|---|---|
| U L L L R I C H T O B I E | `eibothcirlllu` (13) | lines "Special mode, with LOVE from" / "   Ulrik Lindahl & " / "   Tobias Andersson"; STURKAS plays track `STURKAS_8_888_FlyNakenV` positioned at x = scrollX+640 (flies in from the right); patches fields +0x20/+0x24 of track T461 to 0x11/0x12 (UNCERTAIN) |
| M T R O P O L I S | `siloportm` (9) | "Let Quark burn in hell I tells ya!" / "                     - Tobbe" |
| D E C R E D S | `sderced` (7) | "Special Creds from Ulrico -Dr.Love- Di Corleone", " ", " Ulrik Lindahl   -   main programming, SCURR and UI", " Tobias Andersson   -   script & sound programming " |
| C A L L 6 4 0 4 0 0 1 | `1004046llac` compared over 13 chars | "For a good time, call 6400401", "But dont expect them to deliver for a very, very, very", 2× "very, …", "very, very, very, very, very, very, long time". Because 13 chars are compared against an 11-char string, it only matches when these are the **first 11 keys pressed since launch** (history byte 11 must still be 0) — quirk. |

All cheat lines are normal choice lines; clicking any one clears them. Max 5 lines, so later AddTextInputLine calls fail silently when full.

### 4.9 UI state reference (CGameDlg)
dlg+0x4a0 coin open; +0x4a1 press pending; +0x4a4 press time; +0x498/0x49c coin centre; +0x5d8 inventory open; +0x5d9 menu open; +0x5dc menu page (0 main, 1 load, 2 save); +0x5e0 selected slot; +0x5e4 confirm box open; +0x5e8 confirm kind; +0x5ec map open; +0x5ed choice lines shown; +0x5ee dialog busy (set by DoDialogAni 0x46da60 via 0x404d80, cleared at dialog end 0x46d530); +0x5f0 held item (slot+1); +0x350/0x354 cursor pos used by logic; +0x358/0x35c raw mouse pos; +0x34c current cursor serial; +0x5fa loop enabled; +0x21a quit request. `DAT_004c41f8` end-credits mode. `DAT_004ee744` engine-busy bitmask (bit0 portal transition, bit 0x80 set by some track callbacks) → invisible cursor, clicks ignored.

### 4.10 Minigame input
Minigames (modes 1-8) install their own cursor and click handlers (jump tables 0x46a3a8 / 0x46a498); ESC, the
inventory and the verb coin are disabled while `g8c0 != 0`. See game-logic.md §5 for each game.

---------------------------------------------------------------------------------------------------

## 5. Audio
### Init / deinit
* `SCURR_initializeSoundSystem` 0x47a470 (L89806): `AIL_startup`; digital driver `FUN_0047a580(2ch, 22050 Hz,
  16 bit)` via `AIL_waveOutOpen(WAVE_MAPPER)`; if the device is "Emulated" DirectSound retry with
  `AIL_set_preference(15,1)` (UNCERTAIN: DIG_USE_WAVEOUT); on failure halve the rate down to 11025, else fail.
  MIDI driver A = `AIL_midiOutOpen(dev 0)` (a sequence is initialised on it but never started); MIDI driver B =
  MIDI_NULL_DRIVER + `AIL_DLS_open(drvB, dig, NULL, 0, 22050, 16, 2)` (software DLS synth into the digital mix);
  `SmackSoundUseMSS(dig)`; `AIL_register_timer` + `AIL_set_timer_frequency(50 Hz)` + start (see §6).
* **Output: 22050 Hz, 16-bit, stereo.** Master volume never set (Miles default).
* Deinit 0x47b080: end all samples/sequences, free cache, `AIL_DLS_close`, release music, stop timers, `AIL_shutdown`.
* Every `SetCurrentScene` 0x45d650 first calls `FUN_0047b030` (end all samples + sequences), `FUN_0047add0`
  (free sample cache), `FUN_0047ab30` (release music) -> **scene change silences everything**.

### Sound names -> files (serials 0x400000+N)
* Root = registry `SCURRglobSoundsPath` (default "sounds"). `SCURR_initializeScurrSounds` 0x451aa0 ->
  `FUN_00451900` recursively enumerates `*.wav`; the `DIALOUGE.wav`, `EFFECT.wav`, `MUSIC.wav`,
  `DIALOUGE.wav/<actor>_<chapter>_.wav` entries are **plain directories** (they match the pattern), not
  containers. Each real file is one sound, read whole on demand (`AIL_file_read`, cached in a linked list,
  game clock paused while reading); cache freed only at scene change.
* Sound name = file name up to the first '.', registered only if it has exactly 3 underscores
  (`dls_Skogenvinter_70vol` is therefore never registered, and never used). Lookup is case-insensitive
  (`_stricmp` hash). Serial = 0x400000 + registration index.
* Per sound: actor = objId of the name prefix before the first '_' (RONJA 1, BIRK 2, ..., EFFEKT/DLS/ROVARNA/
  GRADVARGARNA = 0 = no actor); lip-sync track list = [track named exactly like the sound (or +"A")] + the
  other actors' tracks with the same suffix after the first '_'.
* Counts: RONJA 325, BIRK 70, MATTIS 42, SKALLEPER 39, EFFEKT 39, LILLKLIPPEN 24, LOVIS 20, DLS 19, others < 10.

### Digital samples
* `playSample(serial, loops, pan, vol)` 0x47aed0: **one sample handle (slot 0 of 3; index 0x4f199c is never
  written) => only one sample at a time; voices and effects share it.** A different serial releases/re-inits the
  handle (cuts the old sound); same serial restarts it. Rate set to 22050 then the WAV header decides; pan and vol
  clamped 0..127 (pan 64 = centre); loop count = loops+1 (callers pass 0 = once).
* Status 0x47ae70: 1 playing, -1 stopped, 0 done/other serial. Effects check "nothing playing" first, so **effects
  never interrupt a sound; they are skipped**. No EOS callback: end of sample is polled.
* `theScurrOS->playSound(serial, cb, param)` 0x458090 (only used by dialogs):
  1. if the sound has a lip-sync track list: first track `setTrack(track, 0x700, cb, param, sound)` on the actor
     object in the current scene, further tracks with flags 0x400 (no callback);
  2. else if it has an actor: that actor's generic talk track for its current facing (`obj+0x2dc[dir]`,
     FUN_00457640) with 0x700; if that fails: `playSample(serial,0,64,100)` and cb immediately;
     actor not in scene -> nothing played and cb never called (dialog would stall; UNCERTAIN in practice);
  3. no actor (EFFEKT_/ROVARNA_/GRADVARGARNA_): `playSample(serial,0,64,100)`, cb immediately.
  Voice lines: **vol 100, pan 64**.
* Track sound flags (setTrack 0x455990 / tick 0x455cc0): 0x200 = start the attached sound at key
  `track+0x1c` (<0 = at start) with (vol 100, pan 64); 0x400 = while that sample is playing, reaching key
  `track+0x24` jumps back to `track+0x20` (talk loop); once it stopped, jump past the loop to finish.
  At the track's end (and no follow-up track from table 0x4ba6c8) `cb(track, 0, param)`; a track replaced
  without flag 0x800 calls `cb(track, 1 = interrupted, param)`.
* **Dialog advance** (DoDialog step 0x46d780): each say line -> `playSound(sound, Dialog_TrackSay_CB
  0x46d5a0)`; the callback (end of the talk animation = end of the voice sample) advances `sayIdx`; after all says
  up to 5 choices are shown; a chosen alt plays with `Dialog_TrackAlt_CB 0x46d5f0` -> DoDialogAni(next event) or
  end dialog. Interrupted callback -> end dialog(1).

### Music (XMIDI + embedded DLS)
* `playMusic(name, loops, vol)` 0x47a870: always stops/releases the previous sequence first (so even the same tune
  restarts); `AIL_file_read` the `dls_*` file, `AIL_extract_DLS` -> XMI + DLS; `AIL_init_sequence` on the DLS
  driver; `AIL_DLS_load_memory`; `AIL_set_sequence_loop_count(loops+1)` (all callers pass -1 => 0 = **loop
  forever**); `AIL_set_sequence_volume(vol)` (0..127); `AIL_start_sequence`. Usually followed by
  `FUN_0047aa30(tempoPct)` = `AIL_set_sequence_tempo(seq, pct)` (100 = normal).
* Stop 0x47aa60; music volume fade `FUN_0047aac0(vol, ms)` = `AIL_set_sequence_volume(seq, vol, ms)`;
  `FUN_0047ab00` = current volume (fade-outs poll it, then stop).
* **No crossfade**: scene change kills music; the new scene's init callback (dispatcher 0x45d3b0) restarts it from
  the beginning. Music persists only when SetCurrentScene returns early (same scene, no force).
* **File-name numbers are NOT parsed** (no sscanf/atoi); tempo and volume are literals at each call site.
  Observed rule: **tempo% = N/1.2** (N = number in the name, i.e. BPM relative to 120; UNCERTAIN meaning),
  "NNvol" ~ intended volume (matches in most cases, not all):

| music | vol | tempo % | name numbers |
|---|---|---|---|
| dls_eld_40_ | 127 | 33.33 | 40 |
| dls_labyrinten_224_ | 125 | 186.67 | 224 |
| dls_forsen1_88_ | 100 | 73.33 | 88 |
| dls_forsen3_113_5 | 100 | 94.58 | 113.5 |
| dls_forsenBrus_30_100vol | 100 | 25 | 30 / 100vol |
| dls_Forsengrottan_30_60vol | **55** | 25 | 30 / 60vol |
| dls_grottan_105_ | 100 | 87.5 | 105 |
| dls_kallan_40_40vol | **100** | 33.33 | 40 / 40vol |
| dls_prickaRovarna_116_ | 60 then fade to 115 over 1000 ms | 96.67 | 116 |
| dls_salen_112_ | 127 | 93.33 | 112 |
| dls_skidspelet_150_ | 125 | 125 | 150 |
| dls_skogenSommar_40_ | 100 | 33.33 | 40 |
| dls_spelaTarning_150_ | 80 | 125 | 150 |
| dls_tjarnen_155_105vol | 105 | 129.17 | 155 / 105vol |
| dls_tjarnensyrsor_40_70vol | 70 | 33.33 | 40 / 70vol |
| dls_underjordiska_120_80 | 80 | 100 | 120 / 80 |
| dls_borggarden__, dls_borggardenvinter__ | 127 | 100 (no tempo call) | - |

### Per-scene music (scene init callbacks, normal mode gVar 0x4cf8c0 == 0)

| scene | callback | condition | music |
|---|---|---|---|
| SKALLEPERSRUM, LOVISMATTISRUM | 0x45aeb0 / 0x45b0a0 | - | none |
| STORASALEN | 0x45b290 | chapter 1 | dls_salen_112_ (+ Labbas/Lillklippen "RovarMusik" tracks) |
| | | chapter 2 && 0x4cf913 / chapter 3 && 0x4cf915 (fire lit) | dls_eld_40_ |
| KOKET | 0x45b770 | 0x4cf8e8 (hearth lit) | dls_eld_40_ |
| BORGGARDEN | 0x45bb80 | logo/intro not seen | movies (intro end starts dls_borggarden__) |
| | | chapter 2 && 0x4cf8d5 && 0x4cf8d6 && 0x4cf8d7 (winter) | dls_borggardenvinter__ |
| | | else | dls_borggarden__ |
| VAPENHUS, UTSIKTSKOGEN, HELVETESGAPET, TORNET, KAELLARE, FANGELSEHALOR, BORGPORTEN | - | - | none |
| SKOGEN | 0x45c510 | chapter 2 && 0x4cf8fc && !0x4cf8d5 && 0x4cf8e5 | dls_underjordiska_120_80 |
| | | else (also winter) | dls_skogenSommar_40_ |
| KAELLAN | 0x45c6d0 | always | dls_kallan_40_40vol |
| GLAENTAN | 0x45c890 | always | dls_skogenSommar_40_ |
| GLUPAFALLET | 0x45cc80 | always | dls_forsenBrus_30_100vol |
| TJAERNEN | 0x45cea0 | always | dls_tjarnensyrsor_40_70vol |
| GROTTANUTE | 0x45d090 | always | dls_Forsengrottan_30_60vol |
| GROTTANINNE | 0x45d270 | 0x4cf90a (fire) | dls_eld_40_ |
| LABYRINT | minigame start 0x421240 | mode 4 | dls_labyrinten_224_ (first room only; room changes re-enter the scene and kill it — from code, verify in game) |

In-scene changes: STORASALEN chapter 1, clicking Labbas/Lillklippen stops the music for the dialog, restarted on
normal dialog end (LAB_0045fb70). Track callbacks also start dls_eld_40_ (kitchen hearth 0x4531f0, cave 0x454510).
Minigames (mode = gVar 0x4cf8c0): 1 forsen1 -> forsenBrus; 7 forsen3 -> forsenBrus; 2 Tjarnen: scream
`gradvargarna_14_319a1say1_gradvargaralla`, 101 ticks later dls_tjarnen, fade 0 over 10000/1000 ms; 6 grotta:
scream, 51 ticks later dls_grottan, fade 500 ms; 3 skiing dls_skidspelet; 5 snowball dls_prickaRovarna;
8 dice dls_spelaTarning (fade 0 over 1500 ms at state 5).

### Volume, effects, ambience
* **Master fade** `FUN_0047a710(target, ms)`: ignored if a fade is running; ms<=0 sets directly; else linear per
  20 ms timer tick. Used: (0,2000) minigame fail, (127,500) minigame exit, (0,1000) skiing end, (127,2) after dice.
  Scales samples and DLS music (and probably Smacker audio).
* Positional effects (minigames): vol = `depthVol(z)` 0x41fdc0: z<1000 -> 120 - max(z,0)/25; z>=1000 ->
  88 - (min(z,3000)-1000)/25; pan ~ screenX/5 - 1 (screenX = obj.x - panX).
* Labyrinth ambience (0x421f80, every 20 ms when silent): r = rand%300; r<8 -> drip/wind
  (0 droppe1, 1 droppe2, 2/7 droppe3, 3 droppe4, 4 droppe5, 5 droppe6, 6 vind2) with per-room pan/vol from the
  room table (e.g. (105,100), (55,60), quiet rooms vol 10).
* Other effect sounds and their (vol, pan) are minigame specific (EFFEKT_13_* waterfall: depthVol/posPan,
  vildvittraskrik 110; EFFEKT_14_* gradvarg; EFFEKT_8_888_* snowball; EFFEKT_18_1_tarningarskak dice 100/95 or 34;
  djur1_12_195a1say1_vildtoringenfrustar 110/115 in GLAENTAN).
* **No options menu, no sound on/off, no volume setting stored.** Pause menu does not pause audio (no API).
* Unused files: EFFEKT_11_1_{fall,longL,longR,shortL,shortR,skidljud,stop}, EFFEKT_14_1_ground, EFFEKT_17_1_vind3,
  EFFEKT_8_888_BollIMarken, dls_Skogenvinter_70vol.

---------------------------------------------------------------------------------------------------

## 6. Timing
### Clocks (GameDlg)
* QPC start/frequency set in first OnPaint `FUN_004017a0` (L597-602).
* `FUN_00401420`: `realMs` (DAT_004c4270) = (QPC - start)*1000/freq (never paused).
* `FUN_00401480`: `gameMs` (DAT_004e2010) = realMs - totalPaused (DAT_004c41fc), only updated while not paused.
* Pause `FUN_004014b0`: if not paused, pauseStart = realMs (non-nesting). Resume `FUN_004014d0`:
  totalPaused += realMs - pauseStart. Used around every blocking load (lazy subani load in setTrack /
  setTrackFrame / key advance, LoadSceneGfx in SetCurrentScene, sample file reads) so loading never advances
  animations. Not used around movies.

### Main loop (MFC worker thread 0x4067b0, priority HIGHEST, started from first OnPaint via FUN_00406730)
Per iteration (if not initialised: Sleep 500; if suspended by SetCurrentScene: Sleep 50):
1. update realMs/gameMs;
2. **walk: fixed 66 ms step** with accumulator (clamped 0..1000 ms) -> `FUN_00457190` on RONJA and BIRK;
3. **track animation: variable delta** `0x456360` for all 49 SCURR objects (fixed order RONJA ... VILDVITTRA);
4. auto-pan (§3.9); 5. movie overlay setup (§2.9); 6. cursor update 0x404f60; 7. sprite blit update 0x46ce30(0);
8. render `FUN_004194f0`; 9. **frame cap: Sleep(40 - elapsed) if elapsed < 40 ms (max 25 Hz)**, no sleep while a
movie plays; 10. quit flag -> exit.

### Animation rate
No global fps: each track key has its own duration in ms (tracks.trk). Distribution over 15,720 keys: **83 ms
(~12 fps) 10,171 keys**, 166: 2,401, 120: 1,190, 60: 698, 332: 367, 249: 341, others 40..2324. Advance
(`FUN_00455cc0`): acc += gameMs - last; while duration[idx] < acc: acc -= duration, idx++ (events 0x400000|idx);
end of keys -> loop (count in setTrack flags bits 4-7, 0 = infinite, bit0 loop) or hide (bit1), follow-up
track, or done callback. Key 0 shown immediately at setTrack. Remainders carry over, so the average rate is exact
even with 40 ms ticks.

### Walking speed
`FUN_00457190`, one step per 66 ms (~15.15 steps/s): heading via atan2 to the next path node, 8 directions
(0=N 1=NW 2=W 3=SW 4=S 5=SE 6=E 7=NE), walk frame advances by 1 per step, displacement taken from the key offsets
of the E (x) / S (y) walk tracks (formula partly UNCERTAIN, FPU operands lost). Ronja: E dx=+10, W dx=-12, N/S
dy=+-4, diagonals (+-8,+-4) per step => ~150 px/s horizontally, ~61 px/s vertically, 10-frame cycle = 660 ms;
multiplied by the perspective scale (§2.4).

### SCURR timers (minigames): 50 Hz from the Miles timer thread
`AIL_set_timer_frequency(50)`; every 20 ms the hook 0x46a800 runs `theScurrOS.serviceTimers(gameMs delta)`
(0x457ef0: per timer acc += delta, while acc >= interval fire `obj->vtbl[0x14](id)`), then the master-fade step.
Only RONJA registers a timer (20 ms, FUN_0041fcd0); its handler 0x41fd10 dispatches on gVar 0x4cf8c0:
1 0x425200, 2 0x42efc0, 3 0x4306c0, 4 0x421f80, 5 0x431720, 6 0x42c8e0, 7 0x426aa0, 8 0x429ef0.
=> minigame logic is a fixed 20 ms step in game time.

| quantity | value |
|---|---|
| main loop period | >= 40 ms (<= 25 Hz) |
| walk step | fixed 66 ms, catch-up clamp 1000 ms |
| animation keys | per key; 83 ms dominant |
| minigame tick | 20 ms (MSS timer) |
| Smacker | forced 15 fps (66.67 ms) |
| auto-pan | 25 px edge zone, 320 px jump |

---------------------------------------------------------------------------------------------------

## 7. Game state overview
* **gVar** (0x4cf7d8; serialised fields 0x4cf8c0..0x4cf917): 5 int32 (`g8c0` game mode, `g8c4` act 1/2/3,
  `g8c8` current sceneId, `g8cc` unused, `g8d0` map-discovered bitmask) and 68 byte flags. Full list with meaning,
  writers and readers: game-logic.md §2.
* **Object state**: holder, position, visibility, current frame of the 49 objects (§3.1).
* **Use counters**: 143×3 int32 (`0x4e08e0`) for the hotspot dispatcher (§4.3).
* **Current scene + pan**, Ronja's and Birk's position/direction.
* All of the above is what the save game stores (§4.7, formats.md §8). Nothing else persists (no options).
* New game (`FUN_0041e500`) resets gVar (mode 0, act 1, all flags except `g8d9` — original bug) and the use
  counters, but **not** the objects; a port should reset objects to their initial holders (all NULL) on new game.

---------------------------------------------------------------------------------------------------

## 8. Porting notes and risks
* **Music**: XMIDI sequences with embedded DLS instrument banks played by the Miles DLS synthesiser (software,
  22 kHz). Needs an XMIDI→MIDI converter plus a DLS-capable synth in WebAudio (or offline pre-rendering of the
  19 tunes to Ogg with a DLS/SF2 renderer — easiest and most faithful; tempo per call site, see §5).
* **Colour**: everything is ARGB4444; reproduce the 4-bit alpha blend and the z-test against the background Z layer
  to get identical occlusion; scale sprites with nearest-neighbour by `F / H[y][x]`, clamp 10.
* **Timing**: three clocks (66 ms walk tick, per-key track timing in game ms, 20 ms minigame tick); the game clock
  pauses during loads — a port that preloads never needs that.
* **Single sample channel**: voices and effects cut each other / effects are skipped while anything plays. Replicate
  (minigame sounds depend on it) or consciously improve.
* **Movies**: 12 Smacker 2 files (two of them 57-59 MB); `winter.smk` is interactive (seek/pause, frame-indexed
  collision table) — the decoder must support random access to keyframes or decode sequentially and cache.
* **Track hooks**: 128 named C++ callbacks implement most story side effects (pick-ups at key 8/9, flags, scene
  changes); they must be re-implemented by name (game-logic.md §4).
* **Original bugs** worth knowing (do not replicate unless desired): new game does not reset objects/`g8d9`; saving
  while Ronja/Birk are hidden moves them to (3000,5000,7000); loading restores Birk only in act 3; inventory hit-test
  quirks; HAND on an inventory item uses the cursor position (one row too high); labyrinth hang when re-targeting
  after choosing a back/Birk exit; map23 never preloaded; the CALL6404001 cheat only works as the very first keys typed (§4.8).
