# Ronja de Roversdochter (2001) — game logic specification

Story structure, game state, per-scene scripts, puzzles, item rules, track hooks and minigames, reverse-engineered
from `Game.exe`. Engine mechanics (scenes, objects, tracks, dialog engine, UI, audio) are in [`engine.md`](engine.md);
file formats in [`formats.md`](formats.md). The full dialogue/event database (746 events with voice lines, choices,
Dutch choice texts, follow-up links, hotspot group, verb and use-count condition) is
[`data/dialog-events.json`](data/dialog-events.json).

Notation
* `g8xx` / `g9xx` = gVar field at `0x4cf8xx` / `0x4cf9xx` (§2). `act` = `g8c4` (1, 2, 3).
* `W` ("winter state") = `act==2 && g8d5 && g8d6 && g8d7`.
* `inInv(X)` = `X.holder == &RONJA || (X.holder && X.holder.holder == &RONJA)` (item carried directly or inside a
  carried item — the code tests exactly this everywhere).
* `#n name` = dialog event id n (`k1`/`k2`/`k3` after an event = its minUse); `Gn` = hotspot group n; dispatch verbs: MOUTH (tala), HAND (ta), EYE (titta);
  `Dispatch(G, verb)` = engine.md §4.3b (picks the group's event by use count). `DoDialogAni(#n, cb)` plays one event chain.
* `T<n>` / `S<n>` = track / subani HW handle; tracks are also named. `stillAt(obj,x,y,dir)` = standStillAtDestination;
  `walkTo` = setMovementDestination; `setPos` = setPosition. Directions 0=N 1=NW 2=W 3=SW 4=S 5=SE 6=E 7=NE.
* "Hide X" = blit surface hidden, X+0x264=1, track stopped; "show" = the reverse.
* Addresses are VAs in Game.exe; **UNCERTAIN** marks inferences.

---------------------------------------------------------------------------------------------------

## 1. Story structure

The game follows Astrid Lindgren's novel in three **acts**, stored in `g8c4` (set to 1 by new game). The
"chapter" numbers in asset names (`1a`, `2a`, `9b`, `15` …) are **location numbers** (engine.md §3.5), not story chapters.

| act | season | content | ends with |
|---|---|---|---|
| 1 | summer/autumn | Ronja explores the castle (Mattisborgen) and the forest alone; two forest trials (lake cones `g8dd`, river `g8e1`); rescues Birk at Hell's Gap with the leather strap | hook of `ronja_3_106A1Say1_KrangPaDejB` → act 2, `helvetesgapet.smk` |
| 2 | autumn → winter | three conditions make winter (`g8d5` Birk saved in the fog, `g8d6` Mattis talk, `g8d7` Skalle-Per shows the cellar); ski run; lit torch, lit cellar, Lovis helped; rat + carrots → snowball fight (`g8de`); labyrinth to Birk's prison, bread for Birk | the later of "snowball won" and "bread given to Birk" → act 3, `spring.smk` |
| 3 | spring → summer | Birk joins Ronja (follows through every exit); the bear cave (stone, cave defence `g8df`), fire, salmon, water → summer (`g8f7`, `summer.smk` + `grottan.smk`); the mare and horses, river with the bird witch (`g8e2`), Lovis visits the cave (`g905`), Mattis at the spring | Mattis' line "Egentligen…" → `outro.smk` → credits → exit |

Characters (Swedish names in the data → Dutch manual names): RONJA, BIRK (Birk Borkazoon), MATTIS, LOVIS, SKALLEPER (Kale
Per), LILLKLIPPEN (Kleine Klip), FJOSOK, STURKAS, TJEGGE, LABAS (Labbas), BORKA, VILDVITTRA (vogelheksen = bird witches),
GRADVARG (grey dwarves, called "Onderaardsen" in the manual), RUMPNISSE (rump-goblins, "Aardmannetjes"), the underground
creatures in the fog (`underjordiska`), BERATTAREN (narrator). There are **no "season events"**: the events `_264A1_Vintern`
(#406), `_286A1_SommarenKommer` (#443) and `_337A1_KartanVinter` (#530) exist in the data but are never played; seasons are flag
states (§1.2).

### 1.1 Walkthrough (new game → credits)

Format: **location** — action → result `[flags/items]` (events). "(flex)" = order within the act is free.
Exits: BORGGARDEN↔BORGPORTEN↔SKOGEN↔{KAELLAN, GLUPAFALLET, GLAENTAN (only after g904)}; KAELLAN↔{GLAENTAN, TJAERNEN};
GLUPAFALLET↔{TJAERNEN, GROTTANUTE}; GLAENTAN↔GROTTANUTE↔GROTTANINNE (engine.md §3.7).

#### Act 1 (act = 1, summer/autumn) — goal: rescue Birk at Hell's Gap
0. **New game** → BORGGARDEN, intro.smk, #0 `_2a_002A1_Formaning` (Mattis' warning); Mattis/Lovis stand in the courtyard
   until g8d4 is set by entering STORASALEN/KOKET/HELVETESGAPET/BORGPORTEN. Logo/intro flags g911/g912.
1. (flex) **LOVISMATTISRUM** — HAND on the leather strap (region 1) → #661 → **REM** to inventory (key 8). Optional hint: talk to
   Lovis (#49 … → #55 "Ronja, ta den"). First entry plays #46 LovisSpinner (g8e6).
2. (flex, optional now, needed later) **STORASALEN** HAND tinder → #130 → **FNOSKE**. **KOKET** HAND flint #135 → **FLINTA**,
   fire steel #139 → **ELDSTAL**, rat trap #143 → **RATTBUR**. (Knife: #159 Lovis takes it, g90c; flavour.)
3. (optional) **TORNET** — click the drawer → #592 `_4_462A1_tittaNerILada` (g910) → HAND → **NYCKEL**. **SKALLEPERSRUM** — use
   NYCKEL on the chest → #40 (key back to Skalle-Per, hook → g90f, open-chest gfx) → HAND map → #45 → **KARTAN** (map, fast
   travel to discovered forest places g8d0). Dice with Skalle-Per (#25 alt "Gärna spela") is optional; the result sets nothing.
4. (flex) **TJAERNEN** (via SKOGEN → KAELLAN) — HAND on the white moss → tarn cone game (mode 2); win (21 hits) → **g8dd**.
   Then HAND again → #265 → **VITMOSSA** (needed in act 3; can also be taken later).
5. (flex) **GLUPAFALLET** — click the start stone (region 0x3a) → river game (mode 1); reach stone 28 → **g8e1**, Ronja leaves via
   the GROTTANUTE exit.
6. **BORGGARDEN** — HAND on the ladder → #172 → Ronja climbs (`…tastegea→b`, hook → **g8dc**) → **HELVETESGAPET**.
   With `g8dd && g8e1 && inInv(REM)`: Birk appears (#201 `_3_100A1_moteBirk`, g8ea; first click near him #202, g8eb).
   The west exit is blocked from now on. Stand on the rescue spot (region 3) and use **REM** on Birk → #207 `_3_106A1_raddaBirk`
   (wrong spot: #206). Hook KrangPaDejB → **act = 2**, STORASALEN, helvetesgapet.smk, g913.

#### Act 2 (act = 2, autumn → winter) — goal: winter, then spring
7. (flex) **STORASALEN** — MOUTH Mattis → #80 → alt 1 "Vad är det?" → #81 → alt 1 → #82 or alt 2 → #83: Mattis' say sets **g8d6**.
8. (flex) **STORASALEN** — MOUTH Skalle-Per → #92 → alt 2 ("…de kelders te laten zien?") → #94: hook → **g8d7**, Ronja is moved
   to KOKET; the hatch to the cellar is now usable in act 2 (KAELLARE stays dark: #571 `_6_441A1_morkKallare`).
9. (flex) **TJAERNEN** — first visit: #303 `_14_178A1_snubblaBirk` (**g8fc**; visiting SKOGEN/KAELLAN/GLUPAFALLET afterwards sets
   g8fe). MOUTH Birk → #305/#533 → any choice → #306/#307/#534/#535 → LAB_004675f0: **g8e5**, SKOGEN, dimman.smk (g914).
   **SKOGEN in fog** — use **REM** on Birk (region 4) → #520 `_9b_326A1_hjalpaBirk`: hook → BORGPORTEN, **g8d5**.
   Clicking any fog exit instead → #521 (subterraneans, Mattis' voice) → BORGPORTEN without d5; BORGPORTEN clears g8e5, so the
   tarn talk has to be repeated.
10. **Winter** starts when d5, d6 and d7 are all set; the dialog that completes the set starts the **ski run** (mode 3,
    winter.smk; §1.2, §5.7) → **g8e0**, back in BORGGARDEN (winter). Map travel and the castle gate are closed from now on.
11. **KOKET** (winter, after g8e0) — Skalle-Per leaves the torches (#160, **g8e7**, unlit FACKLA on the wall) → HAND #164 →
    **FACKLA**. Light the stove (possible any time, even in act 1): use FNOSKE on the stove (**g8e9**, Ronja track T429), combine
    FLINTA with ELDSTAL in the inventory, use ELDSTAL on the stove → #559 → hook → **g8e8**. Use FACKLA on the lit stove → T1056 →
    hook → **g90d** (torch lit).
12. (flex) **LOVISMATTISRUM** with g90d — entering plays #58 `_1b_025A1_HjalpaLovis` → #59 (Lovis leaves) → **g8d8**. Now the
    robbers are back in STORASALEN and Lill-Klippen grooms the horses in BORGGARDEN.
13. (flex) **KAELLARE** with g90d — entering plays #165 → hook → **g8ed**, kallare.smk (cellar lit). HAND cheese #215 → **OST**,
    carrots #220 → **MOROTTER**.
14. (flex) **Rat**: combine OST with RATTBUR (cheese in trap); in KOKET use RATTBUR on the trap spot/rat hole → #145 (trap on the
    floor). Leave and re-enter KOKET → rat caught (init). HAND → #150 → **RATTA** + RATTBUR.
15. (flex, needs g8d8 for the horses) **STORASALEN** use **RATTA** on the robbers/fireplace → #131 → **g8da**.
    **BORGGARDEN** use **MOROTTER** on the horses → #196 → **g8d9**. The later of the two starts the **snowball fight**
    (mode 5, §1.2, §5.8). Win (all five robbers sitting) → #524 → **g8de** → FUN_0041fb10: spring if the bread is already with Birk,
    else back to BORGGARDEN.
16. (flex, needs the lit cellar) **KAELLARE** — HAND on the shelf → #227 (**g8db**) → **labyrinth** (mode 4) → Birk exit →
    **g8f1**; the shelf is now a passage. **FANGELSEHALOR** — first entry #167 (lit; **FACKLA** used up). HAND stone heap →
    #246 → hook: **g8f5**, fangelse.smk, #256 `_7_136A1_halBirk` (g8e4). Go back to KAELLARE (arrival x 782 > 640, g8f2 from the
    prison): Skalle-Per meets Ronja (#228 first time, #234 later). Choose alt 2 then "SpelaTarning" → #232/#238 → **g8f0**
    (bread cake on the shelf) + dice game (mode 8; ends in SKALLEPERSRUM; result irrelevant). Other choices: he leaves; visit the
    prison and come back to retry. Back in KAELLARE: HAND #243 → **BRODKAKA**. FANGELSEHALOR: use BRODKAKA on Birk → #258
    `_7_137A1_geBirkBrod` (BRODKAKA.holder=BIRK; KAELLARE init later sets **g8f4**).
17. **Spring**: when both 15 (g8de) and 16 (bread with Birk) are done, the later one triggers **act = 3**, STORASALEN,
    spring.smk → 0x41fa70 (g915, RATTBUR removed).

#### Act 3 (act = 3, spring → summer) — goal: life in the bear cave, reconciliation
18. **STORASALEN** — Skalle-Per (#310–#312; #312 "Du är mitt…" slap animation) is optional. The castle gate refuses the way back
    home (#579); leave towards the forest.
19. **TJAERNEN** — meeting Birk #313 `_14_187A1_motaBirk` → **BIRK.holder = &RONJA** (Birk follows; portals bring him along;
    region 0x80 Birk lines everywhere).
20. **GROTTANUTE** — MOUTH Birk (group 74) → #416 → alt 3 (`ForsokaHittaEn`) → #419 → alt 2 (`HjalpMej`) → #421
    `_15_274C3_talaBirk` → LAB_00467d40: both walk to their track starts and push the stone → hook **g907**. Walk into the
    cave mouth → **cave cone game** (mode 6, 23 hits) → **g8df** (lose → GLAENTAN, retry). Now GROTTANINNE is open, and the net
    (GLUPAFALLET) and the water vessel (KAELLAN) become visible.
21. (flex) **Fire** — GROTTANINNE: use FNOSKE on the fireplace → #437 (tinder used up, **g909**); use ELDSTAL (with FLINTA attached)
    → #438 → hook **g90a**.
22. (flex) **Salmon** — GLUPAFALLET: HAND net (region 4) → **FISKNAT**; use FISKNAT on the rapids → kastaNat tracks → net in the
    rapids (FISKNAT.holder=&MATTIS). Leave and re-enter GLUPAFALLET (init sets **g8fb**). HAND rapids → taFors 162 → **LAX**,
    **g900**, #286 (Birk). (HAND on the rapids without a ripe net plays the 165 variant, which puts the net back in the inventory.)
23. (needs 21+22) GROTTANINNE: use LAX on the fire → #440 → hook **g908** → click the fire → #442 `_16_285A1_ataLax` →
    LAX used up, **g90b**.
24. (flex) **Water** — KAELLAN: HAND vessel → #380 → **VATTENKARL**; use it on the spring (region 5) → FyllaVatten A/B → **g90e**.
    Enter GROTTANINNE carrying it → #707 (vessel used up, **g8fa**).
25. **Summer**: g90e && g90b (after 23 or 24, whichever is last) → **g8f7**, summer.smk, grottan.smk.
26. (optional) GROTTANUTE right after summer: Lill-Klippen waits (until GLAENTAN is visited, g8f8); talk → g8f9.
27. **GLAENTAN** (summer) — use **VITMOSSA** on the injured mare → #348 `_12_213A1_forbinderStoet` (moss + strap on the mare,
    **g901**). (optional) leave/re-enter (moss consumed by init) and HAND the mare → #355 → **g903**, REM back.
    HAND on the horses (Rackarn/Vildtoringen) → #352 `_12_216A1_taHastarnaA` → **g902**. (optional) HAND the birch #320 → g904
    (SKOGEN↔GLAENTAN shortcut).
28. (flex, any time in act 3 with Birk) **GLUPAFALLET** start stone → river with bird-witch (mode 7) → reach stone 28 → **g8e2**.
29. **GROTTANUTE** with g8e2 && g902 — Lovis is there; MOUTH/HAND on her → #480 `_15_296A1_talaLovis` → **g905** (she leaves).
30. **KAELLAN** — Mattis weeps at the spring. MOUTH (#503) or HAND (#504) → at "Egentligen…" the hook plays **outro.smk** →
    credits (eftertext.smk) → exit.

#### Order constraints summary
- Act 1: steps 1, 4, 5 in any order, then 6.
- Act 2: 7, 8, 9 in any order (the last starts the ski run); then 11; then 12 and 13 in any order; 14 after 13; 15 needs 12–14;
  16 needs 13 (lit cellar) and is independent of 12/14/15; spring after both 15 and 16.
- Act 3: 19 → 20 first; 21, 22, 24 any order (23 needs 21+22); 25 when 23 and 24 are done; 27 needs summer; 28 any time;
  29 needs 27 (g902) and 28; 30 needs 29.

### 1.2 How the seasons and the ending are triggered
#### Season events #406 `_264A1_Vintern`, #443 `_286A1_SommarenKommer`, #530 `_337A1_KartanVinter`: never triggered
- No `push 0x196 / 0x1bb / 0x212` precedes a call to DoDialogAni (0x46da60) or the RB-sync dialog 0x45ea70 anywhere
  (the only such immediates are assert line numbers at 0x40299d, 0x45dc77 and the static ctors 0x43d729…).
- Groups 71 (0x47) and 76 (0x4c) are never passed to Dispatch 0x46dbb0, the RB-sync dispatch 0x45ec80 or the Birk-talk helper 0x462e80.
- Group 88 (0x58) is dispatched (KOKET hatch, 0x460d2f/0x460e8f/0x460fef), but the dispatcher only uses the MOUTH/HAND/EYE
  lists (+0x14/+0x20/+0x2c, FUN_0046dbb0); #406/#443/#530 are verb-1 "scripted" entries and can only be played by id.
- No event `next` field or choice points to them (dialog `next` names are resolved by FUN_00451ad0 = case-insensitive scan of
  the event-name table 0x4a7d88; id = index).
So winter, spring and summer are **not** events. They are state changes:
- **Winter** = the condition W itself (g8d5 && g8d6 && g8d7 in act 2). It switches gfx (`…VINTER`), music
  (`dls_borggardenvinter__`), the map (no travel), BORGPORTEN (#523 refusal), and starts the ski run (see below).
- **Spring** = act 3, set in FUN_0041fb10 (snowball end) or LAB_00462950 (bread to Birk), whichever comes last; spring.smk.
- **Summer** = g8f7, set in FUN_00468ac0 (cave: water + salmon); summer.smk + grottan.smk.
- #530 (Ronja "Det går inte", `RONJA_inv_337A1Say1_DetGarInte`) was meant for using the map in winter; the map code just refuses silently.

#### Snowball fight (FUN_00431010, mode 5): all call sites

| site | context | condition |
|---|---|---|
| 0x4535c7 | end of track `STURKAS_1C_055A1_ROVAREFLYR`, chained after `STURKAS_1c_055A1Say1_RovarnaSkriker` (say of #131 `_1c_055A1_SkrammaRovare` = use **RATTA** in STORASALEN on the fireplace (region 4) or a robber (regions 8/9/10); no state check in the use-item handler 0x460830) | `act==2 && g8d5 && g8d6 && g8d7 && g8d8 && g8da && g8d9 && !g8de` (g8da was set by the RovarnaSkriker start hook) |
| 0x454167 | end of track `LILLKLIPPEN_2A_096A1SAY1_KOMMERDUMED` (say of #196 `_2a_096A1_geMorot` = use **MOROTTER** on the horses in BORGGARDEN during phase H = `act==2 && W && g8d8 && !g8d9 && !g8de`) | `act==2 && g8d5 && g8d6 && g8d7 && g8d8 && g8da && !g8de` (g8d9 set just before) |

So the snowball fight starts after **the later of** "rat scares the robbers" and "carrots for the horse", once Lovis has been
helped (g8d8). Both sites hide RONJA (and the scene actors) first. The fight runs on the BORGPORTEN winter gfx (engine.md §3.6).
Win → #524 `_8_331A1_RonjaVinter` (Lovis "Nu ska jag…") → 0x432810: **g8de = 1**, mode 0 → FUN_0041fb10 (§4.4).

#### Ski run (FUN_00430210, mode 3): all call sites

| site | context | condition |
|---|---|---|
| 0x45fcb8 | LAB_0045fc70 = done-callback of every STORASALEN dispatch on **Mattis** (region 12 → G9; also region 15 when not "Mattis sitting") and **Skalle-Per** (region 13 → G10 when act≠3), for MOUTH, HAND and EYE (0x4602b0/0x4604f0/0x460690) | not aborted; `lastEvent != #93` (#93 `_1c_039A2` "SpelaTarning" starts the dice game instead); `act==2 && g8d5 && g8d6 && g8d7` |
| 0x4631e1 | LAB_004631b0 = done-callback of #520 `_9b_326A1_hjalpaBirk` (REM used on Birk in the SKOGEN fog) | not aborted; `act==2 && g8d5 && g8d6 && g8d7` |

So the ski run starts as soon as the third winter condition is completed: after the Birk rescue in the fog (d5 last), after
the Mattis talk that sets d6 (d6 last), or after the Skalle-Per "cellar" talk #94 (d7 last; its hook has already moved Ronja
to KOKET). **There is no g8e0 guard**: in winter every later dialog with the Mattis/Skalle-Per regions of STORASALEN
restarts the ski run (whether those regions can still be clicked depends on the hall mask; UNCERTAIN). End:
FUN_00430f90 sets **g8e0 = 1** (ski done), mode 0, BORGGARDEN, Ronja (400,400) dir 5.
(`g8e0` = ski run done, set by the ski end FUN_00430f90; the snowball end is 0x432810 → `g8de`.)

#### Summer (FUN_00468ac0)
`if (g90e && g90b && act==3)`: **g8f7 = 1**, hide Ronja, PlaySmacker("summer.smk", 0x468a70, 64, 69) → grottan.smk (0,0) →
0x468a00: Ronja stands (120,400,0) dir 5, Birk (200,400,0) dir 3, both shown. Called from the DETVARGOTT hook end (0x4545d5,
right after eating) and from LAB_0045d260 (GROTTANINNE init, after #707 `_16_587A1_lamnaVatten` which sets
VATTENKARL.holder=&MATTIS and g8fa=1). Note: it tests g90e (vessel **filled**), not g8fa (delivered), and has **no !g8f7
guard**: if the salmon is eaten while a filled vessel is still carried, summer starts at once, and entering the cave later with
the vessel plays #707 and summer.smk a second time (quirk).

#### The ending
- Mattis appears at KAELLAN only in act 3 with **g905** (init 0x45c6d0: MATTIS T895 `MATTIS_10_313A1_MattisGrater` loop;
  cursor region 6 hilite iff g905).
- g905 is set in GROTTANUTE (0x4681da MOUTH / 0x4684ea HAND) when talking to Lovis (region 3 or 4 → group 80 →
  #480 `_15_296A1_talaLovis`), which needs Lovis present: `act==3 && g8e2 && g902 && !g905` (init 0x45d090).
  - g8e2 = river-with-bird-witch mini-game won (mode 7, GLUPAFALLET region 0x3a, act 3, Birk following).
  - g902 = horses handled in GLAENTAN (HAND on Rackarn/Vildtoringen, group 55 → #352 `_12_216A1_taHastarnaA`, cb LAB_00464910),
    which needs g901 (mare bandaged: VITMOSSA used on the mare in summer, #348 → LAB_004649e0), which needs **g8f7 (summer)**.
- At KAELLAN, MOUTH on Mattis → group 86 → #503 `_10_315A1_talaMattis`; HAND → #504 `_10_316A1_taMattis` (EYE #502 is only a
  remark). Both contain the say `MATTIS_10_315A1Say6_EgentligenKlaOpp`. At the end of its lip-sync track (T893) the hook
  0x4538b0 stops the music, ends the dialog, hides Ronja and plays **outro.smk** (64,69); its end cb 0x453930 calls
  FUN_004030b0 → credits **eftertext.smk** → program exit.
- Not required for the ending: g903 (mare healed), g8f9 (Lill-Klippen talk), the dice games, the map.

---------------------------------------------------------------------------------------------------

## 2. Game state: gVar fields

One global object `gVar` (0x4cf7d8) holds the story state. Serialised fields: 5 int32 at 0x4cf8c0..0x4cf8d0 and 68 byte flags 0x4cf8d4..0x4cf917 (save file: formats.md §8). New game (`FUN_0041e500`) sets mode 0, act 1, everything else 0 **except g8d9** (original bug). Objects' holders are the second half of the story state (§6).

W = writers (address = value), R = number of reading sites. † = track hook.

| field | best name | W | R / where |
|---|---|---|---|
| 8c0 int | mode (0 normal, 1 river, 2 tarn cones, 3 ski, 4 labyrinth, 5 snowball, 6 cave cones, 7 river+witch, 8 dice) | 41e502=0, 42125d=4, 422246=0, 424ae2=1, 425c97=0, 425d23=7, 427e57=0, 427ee5=8, 42a292=0, 42a454=6, 42d406=0, 42d4f4=2, 43013c=0, 43026e=3, 430fac=0, 431025=5, 432852=0 | 14: timer 41fd10, cursor/click 46a2a0/46a3d0/46a4c0, SetCurrentScene, GameDlg |
| 8c4 int | act (1, 2 winter half, 3 spring/summer) | reset=1, 45437f†=2, 41fb44=3, 462990=3 | 158 |
| 8c8 int | current scene id | 45dcc8 | 6 |
| 8cc int | unused | – | 0 |
| 8d0 int | map-discovered bits (1 SKOGEN, 2 KAELLAN, 4 TJAERNEN, 8 GLUPAFALLET, 0x10 GLAENTAN, 0x20 GROTTANUTE) | scene inits | 14 |
| 8d4 | courtyard intro over | inits of 1C/1D/3/8 | 7 |
| 8d5 | Birk saved in the fog (winter cond. 1) | 4542c7† | 54 |
| 8d6 | Mattis talk "du måste förstå" (winter cond. 2) | 4539a0† | 46 |
| 8d7 | Skalle-Per showed the cellar (winter cond. 3; hatch open) | 45338b† | 60 |
| 8d8 | Lovis helped (#58) | 45b27a | 17 |
| 8d9 | carrots given (not reset by new game) | 461de5, 454079† | 11 |
| 8da | robbers scared by the rat | 45344c† | 6 |
| 8db | shelf moved (taHylla) | 453130†, 46280f | 3 |
| 8dc | ladder raised | 45316f† | 6 |
| 8dd | tarn cone game won | 42feec | 5 |
| 8de | snowball fight won | 432821 | 18 |
| 8df | cave defended (mode 6 won) | 42d323 | 36 |
| 8e0 | ski run done | 430fa5 | 3 (LOVISMATTISRUM, KOKET init/cursor) |
| 8e1 | river 1 won | 425c80 | 4 |
| 8e2 | river 2 (with witch) won | 427e40 | 6 |
| 8e3 | Skalle-Per snore intro seen | 45b04b | 1 |
| 8e4 | Birk heard in prison (#256 played) | 453788†, 45c3de | 1 |
| 8e5 | fog active (after tarn talk) | 46761f=1; =0 in inits of 8/10/12/13/14 | 10 |
| 8e6 | Lovis-spinner intro seen | 4532c5† | 1 |
| 8e7 | Skalle-Per left the torches | 45b753 | 11 |
| 8e8 | kitchen stove lit | 45321d† | 3 |
| 8e9 | tinder in the stove | 461208 | 1 |
| 8ea | Birk met at Hell's Gap | 45bee9 | 4 |
| 8eb | "gapetBirk" remark played | 461f7f | 1 |
| 8ec | never written (rescue guard, always 0) | – | 4 |
| 8ed | cellar lit | 4536eb† | 4 |
| 8ee | "trappKnarr" played | 462a2a | 1 |
| 8ef | first cellar meeting with Skalle-Per seen | 45c245 | 1 |
| 8f0 | bread cake on the shelf | 45c067=1, 45c04f=0 (LAB_0045c040), 45214c†=0 | 3 |
| 8f1 | labyrinth done | 4223a8 | 2 |
| 8f2 | came from the prison | 45c335=1, 45c273=0, 45c04a=0 | 1 |
| 8f3 | prison lit intro seen | 45c351 | 2 |
| 8f4 | bread is with Birk | 45c1a0 (KAELLARE init) | 8 |
| 8f5 | prison stone heap moved | 453811† | 4 |
| 8f6 | unused | – | 0 |
| 8f7 | summer | 468ae9 | 112 |
| 8f8 | GLAENTAN visited in summer | 45cc66 | 5 |
| 8f9 | talked to Lill-Klippen at the cave | 468214 | 4 |
| 8fa | water delivered to the cave | 45d39d | 39 (Birk stage tables) |
| 8fb | net ripe (re-entered GLUPAFALLET with net set) | 45ce3c | 3 |
| 8fc | act-2 tarn: Birk stumbled (#303) | 45cf84 | 17 |
| 8fd | never written | – | 3 |
| 8fe | left the tarn after #303 | 45c53d, 45c760, 45cd10 | 5 |
| 8ff | write-only mirror of 8fd | 45c610, 45c77c, 45cd2c | 0 |
| 900 | salmon caught | 4526ba† | 21 |
| 901 | mare bandaged | 464a52 | 12 |
| 902 | horses handled (#352) | 4649d2 | 7 |
| 903 | mare healed, strap returned | 464afd | 6 |
| 904 | birch moved (SKOGEN↔GLAENTAN) | 464908 | 9 |
| 905 | Lovis visit done → Mattis at the spring | 4681da, 4684ea | 15 |
| 906 | GLAENTAN visited after g905 | 45cc76 | 1 |
| 907 | cave stone pushed aside | 45330b† | 6 |
| 908 | salmon roasting | 454620† | 6 |
| 909 | tinder laid in the cave | 469318 | 1 |
| 90a | cave fire burns | 4544c0† | 35 |
| 90b | salmon eaten | 4545a2†, 468b32 | 24 |
| 90c | knife taken by Lovis | 4531b9† | 2 |
| 90d | torch lit | 452310† | 6 |
| 90e | water vessel filled | 452910† | 5 |
| 90f | chest opened | 453c1b†, 45ef96 | 5 |
| 910 | tower drawer opened | 4621a6, 4621b6 | 4 |
| 911 | logo played | 405e4e, 45bb6e | 1 |
| 912 | intro played / game started | 405e91, 45bb46 | 5 |
| 913 | act-2 hall fire music | 454433† (cb) | 1 |
| 914 | dimman.smk seen (write-only) | 4676b2 | 0 |
| 915 | act-3 hall fire music | 41faa3 | 1 |
| 916, 917 | unused | – | 0 |

Other globals touched by hooks: DAT_004ee744 (busy bits 0x01/0x10/0x80), DAT_004bc000/004 (last event/alt), RONJA+0x4f8
(river-2 decoration flag), DAT_004f1960 (effect channel).

#### Fields that are never written
Full scan of direct references; the only gVar-relative code is the reset FUN_0041e500 and the serializer
(0x405e39, 0x41e460/80, 0x46f648/0x46f748 load `ecx = 0x4cf7d8`); there are no wide (word/dword) stores into the byte area
and no hook writes them. So these fields are **always 0** in a normal game (only a hand-edited save could change them):

| field | readers | consequence |
|---|---|---|
| 0x4cf8cc (int) | none | unused |
| 0x4cf8ec | 0x405f7f (map special case), 0x45be63 (HELVETESGAPET init), 0x461ea0 (cursor), 0x4620ff (use REM) | the `!g8ec` part of the Birk-rescue condition is always true; the rescue is "closed" by act becoming 2 instead |
| 0x4cf8f6 | none | unused |
| 0x4cf8fd | 0x45c607, 0x45c773, 0x45cd23 (SKOGEN/KAELLAN/GLUPAFALLET init, act 3) | g8ff is never set (and g8ff has no reader at all): dead pair |
| 0x4cf916, 0x4cf917 | none | unused |

Also never read: g8ff (written only), g914 (dimman.smk seen, written only). Bytes 0x8c1-3, 0x8c5-7, 0x8c9-f, 0x8d1-3 are the
upper bytes of the int fields.

---------------------------------------------------------------------------------------------------

## 3. Per-scene scripts

Every scene has an enter script (run by SetCurrentScene in game mode 0) and handlers for walk-click, MOUTH, HAND, EYE,
item drop and cursor shape (dispatch tables: engine.md §4.3). Handlers sample the scene's region mask (`I` layer) at
the clicked point. Exits are portals (engine.md §3.7). Region ids are per scene and per mask; several scenes remap
ids by state before use.

### 3.1 Scene 1A SKALLEPERSRUM (Skalle-Per's room, 0x1001)
**Init FUN_0045aeb0:**
- If `g90f` (chest opened) and !inInv(KARTAN): KARTAN plays `KARTAN_1a_gen_iKista` (T1276; the map lies in the open chest).
- Wall torches ELD1 T1290, ELD2 T1277, ELD3 T1278, ELD4 T1291 (`*_veggfackla`, loop).
- If `act==1 || W`: on the first entry (`g8e3==0`) it plays `DoDialogAni(#622 _1a_511A1_SkalleSnark)` and sets g8e3=1. Later entries play the SKALLEPER loop `SKALLEPER_1A_011A1Say1_SkalleSnark` (T1243, snoring). In act 2 before winter and in act 3 Skalle-Per is not here.
- (The gfx variant `SkallePersRum` vs `SkallePersRumKISTAN` depends on g90f, chosen in SetCurrentScene.)

**Regions:** 1 = chest (kista), 2 = exit NW to TORNET, 3 = exit NE to LOVISMATTISRUM, 4 = Skalle-Per (in bed), 5 = map inside the chest (kartan).

**Cursor FUN_0045f040:** 0 normal; 1 hilite; 2 riktadNV; 3 riktadNO; 4 hilite unless `(act==2 && !W) || act==3` (then normal); 5 hilite; other normal.

**Walk FUN_0045f1a0:** region 2 → `usePortal(EXIT_SKALLEPERSRUM_to_TORNET)` (leave-track ronja_1a_614a1_garuppitorn); region 3 → `usePortal(EXIT_SKALLEPERSRUM_to_LOVISMATTISRUM)`; else walkTo(click).

**Verbs (MOUTH/HAND/EYE: FUN_0045f200 / 0045f3f0 / 0045f5f0, identical except for the verb and callbacks):**
- Region 1 (chest): if `act==1 || W` → **G4** (14A1 tittaKista, 15A1 talaKista, 16A1 taKista; k3 variants 345/346/347; script #40 oppnaKista). Otherwise → **G100** (456/457 titta, 458/459 tala, 460/461 ta, #592 _4_462A1_tittaNerILada).
- Region 4 (Skalle-Per). doneCb LAB_0045eea0 for MOUTH and HAND, none for EYE.
  - If `act==2 && g8d7`: !inInv(KARTAN) → **G121** (515/516 titta, 517 tala, 518 ta …).
  - Else if !inInv(KARTAN) → **G3** (#21/#22 titta, #23 talaSkallePer, #24 taSkallePer → 013A2/013A3/013A4/013B1/013C*/013D1 chain).
  - Otherwise (the map is in the inventory) → **G122** (519..522).
- Region 5 (map in the chest):
  - If `act==1 || W`: !inInv(KARTAN) → **G5** (#41/#42 tittaKarta, #43/#44 talaKarta, #45 taKarta; HAND/MOUTH with doneCb LAB_0045eea0). Otherwise → **G123** (523..528 Kista texts, no cb).
  - Otherwise: !inInv(KARTAN) → **G99** (#580..#584, #584 = _1a_454A1_taKarta, with cb LAB_0045eea0). Otherwise → **G124** (529..534 + #655 LovisSpinner, #656 _1b_537A1_Skinnrem).

**LAB_0045eea0 (dialog done, Skalle-Per / map):**
- lastEvent #25 `_1a_013A2_taSkallePer` with alt 0 ("RONJA_1a_013A2Alt1_GarnaSpela") → start the **dice game** (FUN_00427ed0(RONJA): g8c0=8, SetCurrentScene(0), sets up DJUR1/DJUR2/DJUR3/GRADVARG as dice pieces). Same for #630 (518A2) alt 0, #639 (522A2) alt 0, and for lastEvent #28 / #633 / #641 (`013B1/518B1/522B1 … SpelaTarning`) with any alt.
- lastEvent #45 `_1a_020A1_taKarta` or #584 `_1a_454A1_taKarta` → **take the map**: hide KARTAN, `KARTAN.holder=&RONJA`, `g90f=1`, stillAt(RONJA, 470,422, dir 7). After #45 Skalle-Per snores again (T1243 loop). After #584 Skalle-Per is hidden.
- Any other event → Skalle-Per snoring loop (T1243).

**Use item FUN_0045f7e0:** region 1 (chest) and `!g90f` and item **NYCKEL (0x24)** → `DoDialogAni(#40 _1a_017A1_oppnaKista, actor RONJA)` and `NYCKEL.holder=&SKALLEPER` (the key goes back to Skalle-Per). Track cb `RONJA_1A_017A1_OPPNAKISTA` (0x453bf0) then sets `g90f=1` and reloads SKALLEPERSRUM (open-chest gfx). Any other item or region: no reaction.

### 3.2 Scene 1B LOVISMATTISRUM (Mattis and Lovis' room, 0x1002)
**Init FUN_0045b0a0:**
- Wall torches ELD1 T1279, ELD2 T1280, ELD3 T1281, ELD4 T1292.
- If !inInv(REM): REM plays `REM_1B_537A1_LovisSpinnerSkinnrem` (T1102; the strap lies by Lovis' spinning wheel).
- act ≠ 1: if `g8e0 && !g8d8 && g90d`: stillAt(RONJA, 500,378, dir 1), `g8d8=1`, `DoDialogAni(#58 _1b_025A1_HjalpaLovis)` (→ #59 LovisGarUt). Return.
- act == 1: LOVIS loop `lovis_1b_021A1_LovisSpinner` (T40). If `g8e6==0` it also plays `DoDialogAni(#46 _1b_021A1_LovisSpinner)` (g8e6 is set by the track cb MATTIS_1B_021A1SAY2_AHHANSKULLE, 0x453260, so this scene plays only until it has run once).

**Regions:** 1 = leather strap (skinnrem), 2 = exit N to SKALLEPERSRUM, 3 = exit NE to STORASALEN, 4 = Lovis.

**Cursor FUN_0045f8d0:** 1 → hilite if !inInv(REM) else normal; 2 riktadN; 3 riktadNO; 4 → hilite in act 1, else normal; other normal.

**Walk FUN_0045fa20:** 2 → usePortal(EXIT_LOVISMATTISRUM_to_SKALLEPERSRUM); 3 → usePortal(EXIT_LOVISMATTISRUM_to_STORASALEN) (leave-track ronja_1b_618a1_garstorasal); else walk.

**Verbs (FUN_0045fa80/0045fad0/0045fb20):** region 1 → **G125** (#657/#658 tittaSkinnrem, #659/#660 talaSkinnrem, #661 _1b_542A1_taSkinnrem; HAND pickup via track cb RONJA_1B_542A1_TASKINNREM: frame 8 → `REM.holder=&RONJA`). Region 4 → **G6** (#47/#48 tittaLovis, #49 talaLovis → 023A2/A3/B1/C1/D1/E1 chain, #56 taLovis, #57). MOUTH only has doneCb **LAB_0045f830**: if !inInv(REM) and lastEvent ∈ {#52 023B1, #53 023C1, #54 023D1} → `DoDialogAni(#55 _1b_023E1_talaLovis, cb LAB_0045f830)` (Lovis' follow-up line, voice "Lovis_1b_023E1Say1_RonjaTaDen" = "Ronja, take it"). Otherwise Lovis LovisSpinner loop (T40).

**Use item:** none (nop).

### 3.3 Scene 1C STORASALEN (great hall, 0x1003)
**Init FUN_0045b290:**
- `g8d4=1` ("left the courtyard intro", see flags).
- Wall torches ELD2 T1282, ELD3 T1283, ELD4 T1284. The objects ASKEN, TARNING, VILDVITTRA and GRADVARG are **reused as extra wall torches** (T1295/T1296/T1297/T1298 `ELD1_1C_gen_veggfackla[5-7]`).
- FNOSKE `fnoske__gen_still` (T335) if !inInv(FNOSKE).
- ELD1 `ELD1_1c_gen_OppenSpis` (T976) loop (open fireplace).
- **act 1:** music `dls_salen_112_` vol 127 tempo 93.33; LABAS `lab_1c_026A1_Rovarmusik` (T6) and LILLKLIPPEN `lillK_1c_026A1_RovarMusik` (T0) loops (the robbers play music).
- **act 2:** if `g913` → music `dls_eld_40_` vol 127 tempo 33.3.
  - !W → MATTIS loop `MATTIS_1c_033A1Say1_MattisSuck` (T20, sighing).
  - W && g8d8 && !g8da && !g8de → robbers are back: LABAS T10, STURKAS T11, TJEGGE T12 (`*_1c_041A1_RovareAter`), DJUR1 `DJUR1_1c_gen_mat` (T1103) loops.
  - W && g8e7 → MATTIS `MATTIS_1c_448A1_MattisSitter` (T919).
- **act 3:** if `g915` → eld music. SKALLEPER loop `SKALLEPER_1c_183A1_RonjaOchSkallePer` (T935).

**Region remap (all handlers):** region 11 → 7 (Lill-Klippen) in act 1, else → 9 (Sturkas). Region 15 → 14 (Mattis sitting) if `W && g8e7`, else → 12 (Mattis).
**Regions (after remap):** 1 = tinder (fnöske), 2 = exit W to LOVISMATTISRUM, 3 = exit N to BORGGARDEN, 4 = fireplace (only a use-item target), 5 = exit NE to KOKET, 6 = Labbas (act 1, musician), 7 = Lill-Klippen (act 1), 8 = Labbas (act 2, robbers back), 9 = Sturkas, 10 = Tjegge, 12 = Mattis, 13 = Skalle-Per, 14 = Mattis sitting.

**Cursor FUN_0045fdd0:**
- 1: hilite if !inInv(FNOSKE).
- 2 riktadV; 3 riktadN; 5 riktadNO.
- 6, 7: hilite in act 1.
- 8, 9, 10: hilite iff `act==2 && W && g8d8 && !g8da && !g8de`.
- 12: act≠2 → normal; act 2: hilite unless (g8d5 && g8d6 && g8d7).
- 13: hilite iff `(act==2 && !g8d7) || act==3`.
- 14: hilite iff `W && g8e7`.
- Everything else (0, 4, 11 after remap, …) normal.

**Walk FUN_004601e0:** 2 → usePortal(EXIT_STORASALEN_to_LOVISMATTISRUM) (leave-track ronja_1c_619A1_garLovisMattis); 3 → usePortal(EXIT_STORASALEN_to_BORGGARDEN); 5 → usePortal(EXIT_STORASALEN_to_KOKET); else walk.

**Verbs** (doneCb per verb in brackets M/H/E):

| region | group | callbacks |
|---|---|---|
| 1 | **G14** (#127 tittaFnoske, #128/#129 talaFnoske, #130 _1c_054A1_taFnoske → pickup cb sets FNOSKE.holder=RONJA at frame 9) | none |
| 6 | **G8** (#69/#70 tittaLabbas, #71 talaLabbas → 031A2/B1/C1, #75/#76 taLabbas, #77 MattisSuck) | M: first LABAS `LABBAS_1c_028A1_slutarSpela` (T269) + LILLKLIPPEN `LILLKLIPPEN_1c_028A1_slutarSpela` (T367) + stopMusic, cb LAB_0045fb70 |
| 7 | **G7** (#61/#62 titta, #63 talaLillKlippen → 028A2/B1/C1, #67/#68 ta) | M: same "stop playing" + cb LAB_0045fb70 |
| 8 | **G13** (#118/#119, #120 talaLabbas → 050A2/A3/A4/B1, #125/#126) | M,E: LAB_0045fc40 |
| 9 | **G11** (#99/#100, #101 talaSturkas → 043A2/B1/B2/B3, #106/#107/#108) | M,E: LAB_0045fbe0 |
| 10 | **G12** (#109/#110, #111 talaTjegge → 047*, #116/#117) | M,E: LAB_0045fc10 |
| 12 | **G9** (#78/#79 tittaMattis, #80 talaMattis → 035A2..A5/B1/C1, #87/#88/#89 taMattis) | M,H,E: LAB_0045fc70 |
| 13 | act≠3: **G10** (#90/#91, #92 talaSkallePer → 039A2/039B1/039C1, #96/#97, #98 RovareAter); act 3: **G48** (#310 tittaSkallePer 1c_184, #311 tala 185, #312 ta 186, #313.. motaBirk) | G10: LAB_0045fc70; G48: LAB_0045fd50 |
| 14 | **G98** (#573 titta, #574/#575 tala, #576/#577 ta, #578 MattisSitter, #579 RonjaVidBorgporten) | M,H,E: LAB_0045fcf0 |

Callbacks:
- LAB_0045fb70: restart the act 1 music: LABAS T6 + LILLKLIPPEN T0 loops, music dls_salen_112_ vol 127, tempo 93.33.
- LAB_0045fbe0: STURKAS T11 loop. LAB_0045fc10: TJEGGE T12 loop. LAB_0045fc40: LABAS T10 loop.
- **LAB_0045fc70** (Mattis/Skalle-Per): lastEvent #93 `_1c_039A2_talaSkallePer` → start the **dice game** (FUN_00427ed0). Else if `W` → FUN_00430210(RONJA) = **mini-game 3 (slalom, winter.smk)**. Else if lastEvent ≠ #94 (`039B1`) → MATTIS T20 MattisSuck loop. (#94's voice track cb SKALLEPER_1C_039B1SAY1_VISSTARDET sets **g8d7=1** and SetCurrentScene(KOKET).)
- LAB_0045fcf0: if W && g8e7 → MATTIS T919 MattisSitter loop.
- LAB_0045fd50: if SKALLEPER's current track == T946 `SKALLEPER_1c_186A1Say1_DuArMitt` → stillAt(RONJA, 596,412, dir 1). Then SKALLEPER T935 RonjaOchSkallePer loop.

**Use item FUN_00460830** (jump table: 0x460914/0x460924): region 4 (fireplace) with **FACKLA (0x18)** while `W && g8e7 && !g90d` → `DoDialogAni(#572 _1c_442A1_aktaEld)` (Mattis: "careful with the fire"). Regions 4, 8, 9, 10 with **RATTA (0x26)** → `DoDialogAni(#131 _1c_055A1_SkrammaRovare)` (scare the robbers with the rat). Its track cbs: STURKAS_1c_055A1Say1_RovarnaSkriker → `RATTA.holder=NULL`, g8da=…; STURKAS_1C_055A1_ROVAREFLYR → FUN_00431010 = mini-game 5. All other combinations: no reaction.

### 3.4 Scene 1D KOKET (kitchen with the cellar hatch, 0x1004)
**Init FUN_0045b770:**
- `g8d4=1`. Wall torches ELD2 T1286, ELD3 T1287, ELD4 T1285.
- KNIV `kniv_1d_gen_paBord` (T934) if `!g90c` (the knife is still on the table).
- ELDSTAL T334 / FLINTA T333 `*__gen_still` if not inInv.
- If `g8e8` (stove lit): ELD1 `ELD1_1d_gen_OppenSpis` (T977) loop + music dls_eld_40_ (127, tempo 33.3).
- If `g8e0 && FACKLA.holder==NULL`: if `!g8e7`, SKALLEPER plays `SKALLEPER_1d_077A1_lamnarFacklorna` (T416, flags 0x100, cb **LAB_0045b740** → `g8e7=1`, `DoDialogAni(#160 _1d_077A1_lamnarFacklorna)`). Otherwise FACKLA shows `fackla_1d_gen_slackt` (T965, unlit torch).
- Rat trap, if `RATTBUR.holder==NULL` (the trap stands on the floor): if `RATTA.holder==&RATTBUR` → `RATTBUR_1D_gen_medRatta` (T900). Else if `OST.holder==&RATTBUR` (cheese in the trap) → **the rat is caught on re-entry**: `RATTA.holder=&RATTBUR; OST.holder=&RATTA`; T900. Otherwise `RATTBUR_1D_gen_tom` (T898).

**Regions:** 1 = exit W to STORASALEN, 2 = exit N to BORGGARDEN, 3 = hatch (lucka) to the cellar, 4 = flint, 5 = fire steel, 6 = stove (spis), 7 = (nothing), 8 = sand bucket, 9 = rat-trap spot, 10 = rat hole, 11 = knife, 12 = torch.

**Cursor (asm-only function 0x460930, jump table 0x460c18):** 0 normal; 1 riktadV; 2 → normal if W (exit closed in winter) else riktadN; 3 → riktadS if `g8d7 && act==2`, else hilite; 4 → hilite unless inInv(FLINTA); 5 → hilite unless inInv(ELDSTAL); 6 → hilite unless `g8e8`; 7 normal; 8 hilite; 9 → hilite unless inInv(RATTBUR); 10 → hilite iff `RATTA.holder==NULL`; 11 → hilite iff `!g90c`; 12 → hilite iff `g8e0 && FACKLA.holder==NULL`.

**Walk FUN_00460c50:** 1 → usePortal(EXIT_KOKET_to_STORASALEN); 2 → usePortal(EXIT_KOKET_to_BORGGARDEN) unless W (then walk); 3 → usePortal(EXIT_KOKET_to_KAELLARE) (leave-track ronja_1d_620a1_garnerkallare) only if `g8d7 && act==2`, else walk; else walk.

**Verbs (FUN_00460d00/00460e60/00460fc0, no callbacks):**

| region | group |
|---|---|
| 3 | **G88** (#527 tittaLucka, #528 talaLucka, #529 taLucka; script #530 KartanVinter, #531 ravlyanBirk) |
| 4 | **G15** (#132 tittaFlinta, #133/#134 tala, #135 _1d_058A1_taFlinta → pickup cb frame 8 FLINTA.holder=RONJA) |
| 5 | **G16** (#136, #137/#138, #139 _1d_061A1_taEldstal → ELDSTAL.holder=RONJA) |
| 6 | **G95** (#552 tittaSpis, #553/#554 talaSpis, #555/#556 taSpis) |
| 8 | **G101** (#593 tittaSandhink, #594/#595, #596/#597/#598 taSandhink) |
| 9 | `RATTA.holder==&RATTBUR` → **G18** (#146 tittaRatta, #147/#148/#149 talaRatta, #150 _1d_070A1_taRatta → cb: RATTBUR+RATTA to inventory); else `OST.holder!=&RATTBUR` → **G17** (#140 tittaRattfalla, #141/#142, #143 _1d_064A1_taRattfalla → RATTBUR.holder=RONJA); else → **G97** (#566 tittaRattfallan, #567/#568, #569 taRattfallan) |
| 10 | **G96** (#560 tittaRatthalet, #561/#562, #563/#564/#565 taRatthalet) |
| 11 | **G20** (#155/#156 tittaKniv, #157/#158 talaKniv, #159 _1d_076A1_taKniv). Lovis takes the knife: cb lovis_1d_076a1_lovistarkniven sets KNIV.holder=LOVIS, LOVIS_1D_076A1_LOVISGARIN sets g90c=1 |
| 12 | **G21** (#161 tittaFacklan, #162/#163, #164 _1d_080A1_taFacklan → FACKLA.holder=RONJA) |

**Use item FUN_00461120:**
- Region 4 (flint on the table) with ELDSTAL (0x13) while !inInv(FLINTA) → `#664 _1d_545A1_felFlinta`.
- Region 5 (fire steel) with FLINTA (0x1a) while !inInv(ELDSTAL) → `#663 _1d_544A1_felEldstal`.
- Region 6 (stove):
  - Stove not lit (`!g8e8`) and tinder already placed (`g8e9`): item ELDSTAL **and** `FLINTA.holder==&ELDSTAL` (flint combined with steel) → `#559 _1d_428A1_TandaSpis` (its track cb RONJA_1D_428A1_TANDASPISB sets **g8e8=1**). Any other item → `#558 _1d_427A1_medFnoske`.
  - Stove not lit, no tinder yet: FNOSKE (0x1b) → `g8e9=1` and FUN_0045e7e0(T429 `RONJA_1D_424A1Say1_JagKanInte`). Ronja walks to that track's start and plays it, presumably the "put tinder in the stove" animation (UNCERTAIN, the name suggests a voice line). Any other item → `#557 _1d_426A1_utanFnoske`.
  - Stove lit (`g8e8`): FACKLA (0x18) and `!g90d` → FUN_0045e7e0(T1056 `RONJA_1D_439A1_tandaFacklan`) (cb sets **g90d=1**: torch lit). Other items: nothing.
- Regions 9 and 10 (trap spot / rat hole):
  - RATTBUR (0x27): if RATTA is in the trap → nothing. Else if the trap holds no cheese → `#144 _1d_065A1_placeraTomRattfalla`, otherwise `#145 _1d_066A1_placeraOstRattfalla`. Both track cbs set `RATTBUR.holder=NULL`: the trap is placed on the floor.
  - OST (0x25): if inInv(RATTBUR) → nothing. Otherwise → `#665 _1d_546A1_felRattfalla` (put the cheese in the trap in the inventory instead: OST+RATTBUR combine).

### 3.5 Scene 2A BORGGARDEN (castle yard, 0x1005)
**Init FUN_0045bb80:**
1. `!g911`: setScrollX(640), PlaySmacker("logo.smk", cb LAB_0045bb60), return. LAB_0045bb60: `g911=1`, FUN_00404230(lpMyGame) (re-show the game UI, UNCERTAIN).
2. Else `!g912`: setScrollX(640), PlaySmacker("intro.smk", cb LAB_0045ba30, 0x40, 0x45), return. **LAB_0045ba30**: STEGE T1118 `STEGE_2a_gen_LiggandeStege` if `W || !g8dc`, else T1119 `Stege_2a_gen_restStege`. HINDER `HINDER_2a_625A1_VaktPaMuren` (T677) loop. setScrollX(640). RONJA track T710 `RONJA_2A_002A1_Formaning`. `DoDialogAni(#0 _2a_002A1_Formaning, cb 0x45ba00 → MATTIS T947 mattis_2a_gen_PaBorggarden loop)`. LOVIS T948 loop. `g912=1`. Music dls_borggarden__ (127).
   (GameDlg 0x405db0 also sets g911/g912=1, probably when loading a game or skipping the intro.)
3. Else if W: music `dls_borggardenvinter__` (127).
   - !g8d8 → nothing else.
   - g8d8 && !g8d9 && !g8de → LILLKLIPPEN `LILLKLIPPEN_2a_512A1_ryktarHastar` (T577, grooming the horses) loop.
   - g8d8 && g8d9 && !g8de → DJUR2 `DJUR2_2a_096A1_Still` (T594) loop.
4. Else (not W): HINDER T677 loop (guard on the wall); STEGE T1118 if !g8dc else T1119; if `!g8d4` MATTIS T947 + LOVIS T948 loops (parents still in the courtyard); music dls_borggarden__.

Let H (horse phase) = `act==2 && W && g8d8 && !g8d9 && !g8de`.
**Region remap:** region 9 → 4 (horses) if H, else → 1 (exit). Region 12 → 3 (exit to STORASALEN) if `g8d4`, else → 10 (Lovis).
**Regions:** 1 = exit W to BORGPORTEN, 2 = exit N to KOKET, 3 = exit NE to STORASALEN, 4 = horses, 5 = ladder (stege), 6 = top of the ladder, exit up to HELVETESGAPET, 7 = Lill-Klippen, 8 = Fjosok, 10 = Lovis, 11 = Mattis.

**Cursor FUN_00461430:** 1 riktadV; 2 riktadN; 3 riktadNO; 4, 8 → hilite iff H; 5 → hilite iff `!W && !g8dc`; 6 → riktadN iff `!W && g8dc`; 7 → hilite iff H; 10, 11 → hilite iff `!g8d4`; else normal.

**Walk FUN_004617a0:** 1 → usePortal(EXIT_BORGGARDEN_to_BORGPORTEN); 2 → usePortal(EXIT_BORGGARDEN_to_KOKET); 3 → usePortal(EXIT_BORGGARDEN_to_STORASALEN); 6 → if `!W && g8dc` usePortal(EXIT_BORGGARDEN_to_HELVETESGAPET) (leave-track KlattraStege), else **nothing** (no walk either); other → walk.

**Verbs (FUN_004618d0/00461a20/00461bc0):**

| region | group | cb |
|---|---|---|
| 4 | **G25** (#191/#192 tittaHast, #193 talaHast, #194/#195 taHast) | LAB_00461360 |
| 5 | **G22** (#169 tittaStege, #170/#171 talaStege, #172 _2a_086A1_taStege) | HAND only, and only if `W \|\| !g8dc`: cb LAB_00461ba0 |
| 7 | **G23** (#173/#174, #175 talaLillKlippen → 088A2/A3/A4/B1, #180/#181) | LAB_00461360 |
| 8 | **G24** (#182/#183, #184 talaFjosok → 091A2/B1/B2/B3, #189/#190) | LAB_00461360 |
| 10 | **G2** (#15/#16 tittaLovis, #17 talaLovis, #18/#19/#20 taLovis) | LAB_004613e0 |
| 11 | **G1** (#1/#2 tittaMattis, #3 talaMattis → 004A2..A8/B1, #12/#13/#14 taMattis) | LAB_004613e0 |

- LAB_00461360: LILLKLIPPEN T577 ryktarHastar loop, then **hide DJUR2 and FJOSOK** (these objects only appear while a dialog animates them. Idle, they are part of Lill-Klippen's grooming animation. UNCERTAIN interpretation).
- LAB_004613e0: MATTIS T947 + LOVIS T948 idle loops.
- LAB_00461ba0: `FUN_0045e5d0(EXIT_BORGGARDEN_to_HELVETESGAPET,-1,-1)`: Ronja climbs at once (plays leave-track RONJA_2A_086A1_KlattraStege). That track's cb RONJA_2A_086A1_TASTEGEB sets **g8dc=1** (ladder raised) and she arrives in HELVETESGAPET.

**Use item FUN_00461d10:** region 4 (horses) and H: **MOROTTER (0x23)** → `DoDialogAni(#196 _2a_096A1_geMorot)` (next: #? _2a_633A1_LillKlippenFjosokGar) and `g8d9=1`. The voice-track cb RONJA_2a_096A1Say1_JagKanMata sets `MOROTTER.holder=&DJUR2`, and LILLKLIPPEN_2A_096A1SAY1_KOMMERDUMED sets g8d9 and calls FUN_00431010 (mini-game 5). Any other item → `DoDialogAni(#197 _2a_097A1_geFel, cb LAB_00461360)`.

### 3.6 Scenes 2B VAPENHUS (0x1006), 5 UTSIKTSKOGEN (0x1009), 17 LABYRINT (0x1014), 18 BRAEDSPEL (0x1015)
No init logic (FUN_00409c80), normal cursor everywhere (FUN_00469450), walk click does nothing (FUN_00403110) and the verbs are no-ops. They are only used by scripted sequences or mini-game 4 (labyrinth).
VAPENHUS and UTSIKTSKOGEN have no graphics in `subanis.apc`: they are unused. LABYRINT and BRAEDSPEL are only shown
by minigames 4 and 8 (§5).

### 3.7 Scene 3 HELVETESGAPET (Hell's Gap, 0x1007)
**Init FUN_0045be10:** `g8d4=1`. If `act==1 && g8dd && g8e1 && inInv(REM) && !g8ec`:
- `g8ea` (Birk already met) → BIRK `BIRK_3_100_hanger` (T1140, Birk hangs over the chasm).
- Else setPos(RONJA, 10,270,0), BIRK T809 `BIRK_3_100A1_moteBirk`, `DoDialogAni(#201 _3_100A1_moteBirk, cb LAB_0045bde0 → stillAt(RONJA, current pos, dir 5), actor RONJA)`, `g8ea=1`.

Birk therefore only appears after Ronja has done both forest mini-games of act 1 (g8dd = gray dwarves at the tarn, g8e1 = rapids) and carries the leather strap.

**Regions:** 1 = exit W to BORGGARDEN, 2 = Birk, 3 = the spot from which Birk can be rescued (tested at Ronja's own position).
**Cursor FUN_00461e30:** 1 → riktadV unless `act==1 && g8ea` (then normal: no leaving once Birk is met and not yet rescued); 2 → hilite iff `act==1 && g8dd && g8e1 && inInv(REM) && !g8ec`; else normal.
**Walk FUN_00461f50:** 1 → usePortal(EXIT_HELVETESGAPET_to_BORGGARDEN) unless `act==1 && g8ea`. Region 2 when `!g8eb` → `g8eb=1`, `DoDialogAni(#202 _3_101A1_gapetBirk)` **and** walk to the click. Other → walk.
**Verbs:** region 2 → **G26** (#203 tittaBirk, #204 talaBirk, #205 taBirk) for MOUTH (FUN_00461fe0), HAND (FUN_00462020) and EYE (FUN_00462060), no callbacks.
**Use item FUN_004620a0:** region 2, `act==1 && g8dd && g8e1 && inInv(REM) && !g8ec`, item **REM (0x28)** → if the region at Ronja's own position (RONJA+0xf0,+0xf4) is 3 → `#207 _3_106A1_raddaBirk` (rescue). Otherwise `#206 _3_105A1_felRaddaBirk` (wrong spot). The rescue's track cb `ronja_3_106A1Say1_KrangPaDejB` (0x454330) ends the dialog, sets **g8c4=2 (act 2)**, SetCurrentScene(STORASALEN), plays a Smacker (0x4bb8a8) and sets g913=1.

### 3.8 Scene 4 TORNET (tower, 0x1008)
FUN_0045bf00: ELD1 T1288, ELD2 T1289 wall torches. If `g910` (box discovered, set in the TORNET handler 0x4621a6): ASKEN (reused as the box/chest in the tower) → T1261 `ASKEN_4_gen_oppen` if inInv(NYCKEL) or g90f, else T1300 `ASKEN_4_gen_Nyckel` (box with the key).
- Cursor `FUN_00462220`: region 1 → riktadS arrow; region 4 → hilite if NYCKEL not in inventory and `!g90f`, else normal.
- Walk `FUN_00462320`: region 1 → portal 0x4e6ef8 (down to SKALLEPERSRUM); else walk.
- Region 4 (the drawer/box ASKEN), any verb (M/H/E: `462370/4623c0/462410`) while `!g910` → `DoDialogAni(#592 _4_462A1_tittaNerILada, cb LAB_00462160)`. `LAB_00462160`: `ASKEN.setTrack(ASKEN_4_gen_Nyckel)` (T1300) and `g910 = 1` (drawer opened, key visible).
- With `g910`: MOUTH → G27 `_4_108A1_talaNyckel` (k1) / `_4_383A1` (k3); EYE → `_4_107A1_tittaNyckel`; HAND → G27 `_4_109A1_taNyckel` with cb `LAB_004621c0`: **`NYCKEL.holder = &RONJA`** (key into inventory) and `ASKEN.setTrack(ASKEN_4_gen_oppen)` (T1261).
- No item handler.

### 3.9 Scene 6 KAELLARE (cellar, 0x100a)
**Init FUN_0045c080:**
- Cellar dark (`!g8ed`): if the torch is lit (`g90d`) → stillAt(RONJA, 209,412, dir 5) and `DoDialogAni(#165 _6_081A1_tandKallarenA, actor RONJA)`. Its track cb ronja_6_081a1_tandkallarenb sets `g8ed=1`, reloads KAELLARE (lit gfx), hides Ronja and plays kallare.smk.
- Cellar lit (`g8ed`):
  - If OST.holder==NULL: show OST, `ost__gen_still` (T311) loop. If MOROTTER.holder==NULL: show it, T312 `morotter_6_gen_still` loop.
  - If `g8f0 && !inInv(BRODKAKA) && !g8f4` → BRODKAKA T313 loop (bread cake on the shelf).
  - ELD1 `ELD1_6_gen_veggfackla` (T1202).
  - If BRODKAKA.holder==BIRK (directly or nested) → `g8f4=1`.
  - If !g8f4: if `g8f1 && RONJA.x > 640.0 && g8f2 && g8f5 && !g8f0 && !inInv(BRODKAKA)` → stillAt(RONJA, 830,415, dir 5). First time (`!g8ef`, then g8ef=1) `DoDialogAni(#228 _6_124A1_moteSkallePer, cb LAB_0045c040, RONJA, force=1)`, later `#234 _6_125A1_moteSkallePer`. Otherwise `g8f2=0`.
  - LAB_0045c040: `g8f2=0; g8f0=0`. If lastEvent ∈ {#232 _6_124B3, #238 _6_125B3} → `g8f0=1` and start the **dice game** (FUN_00427ed0). So winning or playing dice puts the bread cake on the shelf (g8f0); taking it (cb RONJA_6_128A1_TABRODKAKA) sets `BRODKAKA.holder=RONJA, g8f0=0`.
**Handlers:**
- Cursor `FUN_00462480`: 1 riktadN; 2 riktadN if `g8db` else hilite; 3 hilite while `OST.holder==0` (cheese still there); 4 hilite while `MOROTTER.holder==0`; 6 hilite iff `g8f0 && BRODKAKA not in inventory && !g8f4`; 7 riktadO; 8 hilite iff `!g8ed`; else normal.
- Walk `FUN_00462650`:
  - region 1 → portal 0x4e8c10 (up to KOKET).
  - region 2 (the shelf) → if `g8f1` → portal 0x4e65e8 to FANGELSEHALOR (exit track `ronja_6_123A1_taHylla`); else if `g8db` → `Dispatch(G31 HAND _6_123A1_taHylla, cb LAB_00462460)`; else nothing.
  - region 7 → if `!g8ed` → `#571 _6_441A1_morkKallare` ("too dark"); else nothing.
  - region 8 → nothing; others → walk.
- MOUTH `FUN_00462720`: 2 → `BIRK.setPosition(3000,9000,1000)` (offscreen; Birk is heard behind the shelf) then G31 `_6_122A1_talaHylla` (Ronja "Hallå är det…", BIRK "Ronja Ronja"); 3 → G28 talaOst (#213 k1 / #214 k3); 4 → G29 talaMorot (#217 k1, #218 k2, #219 k3); 6 → G32 (#241 k1, #242 k3).
- HAND `FUN_004627d0`: 2 → if `!g8db`: G31 `_6_123A1_taHylla` with cb `LAB_00462460` and **`g8db=1`**; else nothing. 3 → G28 `_6_112A1_taOst`; 4 → G29 `_6_116A1_taMorot`; 6 → G32 `_6_128A1_taBrodkaka` (pick-ups themselves happen in the events' track end-handlers, not here).
- EYE `FUN_00462880`: 2 tittaHylla #225, 3 tittaOst #212, 4 tittaMorot #216, 6 tittaBrodkaka #240.
- `LAB_00462460` (taHylla done) → `jmp FUN_00421240` = **labyrinth minigame** (mode 4; ronja.cpp:452 `SetCurrentScene(&LABYRINT, true, LabyrintList[startPos]->getFileName())`). Its end `FUN_00422230` sets `g8c0=0` and `g8f1=1` (0x4223a8) → afterwards the shelf is a passage to FANGELSEHALOR.
- No item handler (torch use is elsewhere).

### 3.10 Scene 7 FANGELSEHALOR (prison caves, 0x100b)
**Init FUN_0045c330:**
- First entry (`!g8f3`): `g8f3=1`, `DoDialogAni(#167 _7_082A1_tandFangelseA, cb LAB_0045c2c0, RONJA)`, `FACKLA.holder=&MATTIS` (the torch leaves the inventory). LAB_0045c2c0: SetCurrentScene(FANGELSEHALOR, 1) (reload with lit gfx) and stillAt(RONJA, current pos, dir 1).
- Later entries: ELD1 T1203 wall torch.
- `!g8f5` (stone not lifted yet): HINDER `HINDER_7_Gen_LyftSten` (T907), BIRK setPos(1000,1000,4000) (off-screen).
- `g8f5 && !g8f4` (Birk behind the stone, bread not yet given): if `g8e4` → BIRK `Birk_7_136A1_tyst` (T693) loop. Else `g8e4=1`, `DoDialogAni(#256 _7_136A1_halBirk, cb 0x462920 → BIRK T693 loop)`.
  (g8f5 is set by the track cb RONJA_7_132A1Say1_slapaStenar, which also reloads the scene and plays smk 0x4bb88c.)
**Handlers:**
- Cursor `FUN_00462a60`: 1 riktadN; 2 hilite iff `!g8f5`; 3 hilite iff `!g8f4`.
- Walk `FUN_00462b50`: region 1 → portal 0x4ecee0 (back to KAELLARE); else walk.
- Region 2 = stone heap (G33): MOUTH `_7_131A1_talaStenhog`, HAND `_7_132A1_taStenhog` (Birk + Ronja "slapaStenar"), EYE `_7_130A1_tittaStenhog`.
- Region 3 = Birk (G34): MOUTH `_7_134A1_talaBirk` with cb `LAB_00462a00`; HAND `_7_135A1/_388A1/_389A1_taBirk` (k1/k2/k3) with cb `LAB_00462920`; EYE `_7_133A1_tittaBirk`.
  - `LAB_00462a00`: first time (`!g8ee`) → `DoDialogAni(#717 _7_598A1_trappKnarr ("stairs creak, someone's coming"), cb LAB_00462920)`, `g8ee=1`; later → `BIRK.setTrack(Birk_7_136A1_tyst, loop)`.
  - `LAB_00462920`: `BIRK.setTrack(Birk_7_136A1_tyst, flags 1)`.
- ITEM `FUN_00462c90`: region 3 and `!g8f4`:
  - item 0x0f **BRODKAKA** → `DoDialogAni(#258 _7_137A1_geBirkBrod, cb LAB_00462950)` and **`BRODKAKA.holder = &BIRK`**.
  - any other item → `#260 _7_139A1_RonjaBirk` (Birk "Tvi för att…"), cb `LAB_00462920`.
- `LAB_00462950` (after giving bread): if `g8de` and (`g8f4` or BRODKAKA held by Birk) → **`g8c4 = 3`** (0x462990), scroll 0, `SetCurrentScene(STORASALEN)`, hide Ronja, `PlaySmackerFile("spring.smk", 0x41fa70, 64, 69)`. End callback `0x41fa70` (gVar.cpp): show Ronja, `g915=1`, `RONJA.setTrack(RONJA_1C_183A1_RonjaOchSkallePer)`, music `dls_eld_40_`, `RATTBUR.holder = &MATTIS` (rat trap removed).

### 3.11 Scene 8 BORGPORTEN (castle gate, 0x100c)
FUN_0045c4a0: `g8d4=1; g8e5=0`. If W: stillAt(RONJA, 28,265, dir 5), `DoDialogAni(#523 _8_330A1_RonjaVinter, cb LAB_0045c480 → usePortal(EXIT_BORGPORTEN_to_BORGGARDEN))`. In winter Ronja arrives, comments and walks back into the courtyard.
- Cursor `FUN_00462d00`: 1 riktadNV, 2 riktadNO.
- Walk `FUN_00462d90`: region 1 → if `g8c4==3` → `DoDialogAni(#579 _8_449A1_RonjaVidBorgporten ("Jag tänker aldrig…"), actor NULL)` (cannot go home in act 3); else portal 0x4ee0f0 to BORGGARDEN. Region 2 → portal 0x4e8bd8 to SKOGEN. Else walk. No verb/item handlers.

### 3.12 Scene 9 SKOGEN (forest, 0x100d)
FUN_0045c510: `g8d0 |= 1` (map: forest discovered).
- act 2: if `g8fc` then `g8fe=1`. If additionally `!g8d5 && g8e5` → music `dls_underjordiska_120_80` (vol 80, tempo 100), BIRK T994 `BIRK_9A_326A1_hjalpaBirk` and RONJA T993 `RONJA_9A_326A1_hjalpaBirk` (Birk lost in the fog / the underground creatures). Return. Otherwise music `dls_skogenSommar_40_` (vol 100, tempo 33.3).
- Other acts: music skogenSommar. act 3: `g8fd → g8ff=1`. If Birk is in the party (inInv(BIRK), i.e. BIRK.holder==RONJA) show Birk and walkTo(BIRK, 300,368, dir 5) if scrollX < 640, else (1016,364, dir 3). Otherwise hide Birk.
"Fog state" F := `g8c4==2 && g8fc && !g8d5 && g8e5`.
- Cursor `FUN_004631f0`: Birk hit (act 3) → hilite; 1 riktadNV; 2 riktadN; 3 riktadNO; 4 → hilite if F, else riktadN if `g904`, else normal; 5 riktadV; 6 riktadO.
- Walk `FUN_00463440`: regions 1/2/3 → if F → `FUN_004630e0` (fog sequence) else portals 0x4ed648 BORGPORTEN / 0x4e9c98 KAELLAN / 0x4ec7a8 GLUPAFALLET. Region 4 → if !F and `g904` → portal 0x4ebbc0 GLAENTAN, else nothing. Regions 5,6 → always `FUN_004630e0` (UNCERTAIN: these regions probably only exist in the fog mask). Birk → nothing. Else walk.
- `FUN_004630e0` "BirkOchDimman": `BIRK` walks to (700,300), cb `LAB_00463100`: ELD1/ELD2/ELD3 objects loop `HINDER_9a_gen_underjord1/2/3` (the subterraneans), Ronja walks to the start of `RONJA_9b_327A1_BirkOchDimman`, then (cb 0x463190) `DoDialogAni(#521 _9b_327A1_BirkOchDimman)` (Mattis' voice "Ronja, Ronja, försvinn…").
- MOUTH/HAND/EYE (`463660/463850/463a40`, identical except verb): region 4 → G87 (9b Birk: talaBirk #516 k1/#517 k2, taBirk #518, tittaBirk #515). Birk (act 3) → companion table (§3.19): A=36, B=37, C=38, D=39, E=126, F=82.
- ITEM `FUN_00463c30`: region 4, `g8c4==2`, `g8fc && !g8d5 && g8e5`, item 0x28 **REM** → `DoDialogAni(#520 _9b_326A1_hjalpaBirk, cb LAB_004631b0)`. `LAB_004631b0`: if `g8c4==2 && g8d5 && g8d6 && g8d7` → `jmp FUN_00430210` (mode 3 sequence: ski/slalom game "SkidSpel", ronja.cpp:5158 `SetCurrentScene(&BORGGARDEN,true)`). Any other item: nothing.

### 3.13 Scene 10 KAELLAN (the spring, 0x100e)
FUN_0045c6d0: `g8d0 |= 2; g8e5=0`. ELD1 `eld1_10_Gen_kaellaVatten` (T1237) loop. Music `dls_kallan_40_40vol` (vol 100, tempo 33.3).
- act 2: `g8fc → g8fe=1`, return.
- act 3: `g8fd → g8ff=1`. Birk in party → show and walkTo(BIRK, 74,343, dir 5), else hide. `VATTENKARL.holder==NULL && g8df` → VATTENKARL T864 `vattenkarl_10_gen_tomt`. `g905` → MATTIS T895 `MATTIS_10_313A1_MattisGrater` (Mattis weeping) loop.
- Cursor `FUN_00463cc0`: Birk → hilite; 1 NV, 2 N, 3 NO arrows; 4 → hilite iff `VATTENKARL.holder==0 && g8df` (vessel still lying there, after moving into the cave); 6 → hilite iff `g905` (Mattis present).
- Walk `FUN_00463f20`: 1 portal → GLAENTAN; 2 → SKOGEN; 3 → TJAERNEN; 6 and Birk → nothing; else walk.
- Region 4 (water vessel, G63): MOUTH #379 talaVattenkarl, HAND #380 taVattenkarl, EYE #378.
- Region 6 (Mattis, G86, chapter 10): MOUTH #503 `_10_315A1_talaMattis` ("Mitt barn…"), HAND #504 (cb no-op), EYE #502.
- Birk table: A=64, B=66, C=65, D=67, E=137, F=84.
- ITEM `FUN_00464880`: region 5 (water) and item 0x2f **VATTENKARL** and `!g90e` → `FUN_0045e7e0(RONJA_10_241A1_FyllaVattenA)` (fill the vessel; `g90e` = full is set by the track end-handler at 0x452910). Otherwise nothing.

### 3.14 Scene 12 GLAENTAN (glade with the horses, 0x100f)
FUN_0045c890: `g8d0 |= 0x10`. Music skogenSommar (100, tempo 33.3). `g8e5=0`. If VITMOSSA.holder==DJUR3 → VITMOSSA.holder=NULL (the moss given to the mare is consumed or reset).
- `!g904` → HINDER `HINDER_12_gen_Bjork` (T1268, fallen birch). ELD1 `HINDER_12_Gen_GlaentSten` (T908, stone) always.
- act 2: DJUR1 T1312 + DJUR2 T758 `*_12_513A1_HastarBetar` (horses grazing) loops.
- act 3 with Birk in party: if `g8f7` (summer): horses grazing. DJUR3 (the mare): T722 `DJUR3_12_gen_StillaFrisk` if `g901 && g903`; T721 `StillaForband` (bandaged) if g901 only; T700 `DJUR3_12_514A1_SkadatSto` (injured) otherwise. Then show Birk and walkTo(BIRK, 366,316, dir 3) if scrollX < 640, else (888,316, dir 5). act 3 without Birk → hide Birk.
- Always at the end: `g8f7 → g8f8=1`; `g905 → g906=1`.
Objects: DJUR1 = wild horse "Vildtoringen" (region 8), DJUR2 = "Rackarn" (region 7), DJUR3 = injured mare "stoet" (region 6), RUMPNISSE (rump-goblins).
- Cursor `FUN_00464c60`: 1 NV, 2 N; 3 riktadN iff `g904`; 4 → hilite if `!g904` else riktadN; 5 hilite; 6 hilite iff `g8c4==3 && g8f7`; 7 → normal if `g8c4!=2 && !g8f7` else hilite; 8 hilite iff `g8f7`; Birk hilite.
- Walk `FUN_00464f60`: 1 → portal GROTTANUTE; 2 → KAELLAN; 3/4 → if `g904` portal SKOGEN else walk; Birk → nothing; else walk.
- MOUTH `FUN_004650c0` (HAND 465590 / EYE 465a60 differ as noted):
  - region 4 (birch, G49) if `!g904` → G49 (talaBjork #318/#319; HAND taBjork #320 with cb `LAB_00464900` → **`g904=1`** (path to SKOGEN opened)).
  - region 5 (stone, G50): talaSten #322 / taSten #323,#324 / tittaSten #321 (rump-goblins answer).
  - region 6 (mare), via `FUN_0045ec80` (both walk to `RONJA_12_217A1_tittaStoet`/`BIRK_12_206A1_tittaStoet` starts), cb `LAB_00464ae0`:
    - `g8f7 && g901 && g903` → G57 (healed: "Det är lia…", "Nästa sommar").
    - `g8f7 && g901 && VITMOSSA.holder==0 && !g903` → G56 (`_12_219A1_taStoet` "Det har läkt").
    - `g8f7 && g901` → G136 (bandaged, "Hon verkar lugnare").
    - `g8f7` → G53 (injured: "Vi måste göra…").
    - `!g8f7` → falls into region-7 logic.
  - region 7 (Rackarn): `g901` → G55 Hastarna (`FUN_0045ec80`, tracks tittaVildtoringen; HAND uses `Ronja_12_216A1_TaHastarnaA`/`Birk_12_216_TaHastarnaA`), cb `LAB_00464910`; elif `g8f7` → G142 (Rackarn act-3 lines); elif `g8c4==2` → direct `Dispatch` MOUTH G52 talaRackarn / **HAND G51** taVildtoringenA (its only event has minUse 3; the dispatcher falls back to the first event, so it plays from the first click) / EYE G52 tittaRackarn, cb `LAB_00464910`; else nothing.
  - region 8 (Vildtoringen): `g901` → G55 as above; elif `g8f7` → G51 (HAND tracks `RONJA_12_196A1_taVildtoringenA`/`Birk_12_199A1_TaRackarnA`), cb `LAB_00464910`; else nothing.
  - Birk: if `g8f7`: `g901` → G58 (no cb); else G54 (MOUTH cb `LAB_00464aa0`, HAND/EYE no cb). If `!g8f7`: companion table A=59, B=60, C=61, D=62, E=135 (no F).
- ITEM `FUN_00465f30`:
  - region 6 (mare): item 0x30 **VITMOSSA** and `g8f7` → `FUN_0045ea70(#348 _12_213A1_forbinderStoet (bandage the mare), cb LAB_004649e0)`; **any other item (or moss before summer)** → `#347 _12_212A1_felBirk` (Birk "Nej det där…"), cb `LAB_00464ae0`.
  - region 7 (Rackarn), **any item**: `g8c4==2` → `#332 _12_201A1_geRackarn`; `g8c4==3` → `#745 _12_639A1_geRackarn`; cb `LAB_00464910`. (No item-id check; intended for carrots — UNCERTAIN whether the item is consumed, not done here.)
  - region 8 (Vildtoringen), any item: `#331 _12_199A1_geVildtoringen` (act 2) / `#744 _12_638A1_geVildtoringen` (act 3), cb `LAB_00464910`.
- Callbacks:
  - `LAB_00464900`: `g904 = 1`.
  - `LAB_00464910`: if `RONJA.x > 640` scroll to 640; DJUR1 and DJUR2 loop `*_12_513A1_HastarBetar` (grazing); if last event == #352 `_12_216A1_taHastarnaA` → **`g902 = 1`** (horses handled).
  - `LAB_004649e0` (moss applied): if `!g901`: RUMPNISSE plays `RUMPNISSE_15_gen_goBackO`; **`VITMOSSA.holder = REM.holder = &DJUR3`** (moss + strap bound on the mare); **`g901 = 1`**; scroll to 325; play sound `djur1_12_195a1say1_vildtoringenfrustar` (`FUN_0047aed0(serial,0,115,110)`); Ronja stands, dir 6.
  - `LAB_00464aa0`: if last event == #343 `_12_210A3_talaBirk` → portal 0x4ecb48 (to GROTTANUTE) and Birk walks to (154,265).
  - `LAB_00464ae0`: if last event == #355 `_12_219A1_taStoet` → **`g903 = 1`, `REM.holder = &RONJA`** (strap back); if `!g902` also scroll 325 + frustar sound + Ronja dir 6. Then DJUR3 track (loop): `g8f7&&g901&&g903` → `DJUR3_12_gen_StillaFrisk`; `g8f7&&g901` → `DJUR3_12_Gen_StillaForband`; `g8f7` → `DJUR3_12_514A1_SkadatSto`.

### 3.15 Scene 13 GLUPAFALLET (the rapids, 0x1010)
FUN_0045cc80: `g8d0 |= 8`. ELD1 `eld1_13_Gen_ForsVatten1` (T1235) loop. Music `dls_forsenBrus_30_100vol` (100, tempo 25). `g8e5=0`.
- act 2: `g8fc → g8fe=1`, return.
- act 3: `g8fd → g8ff=1`. Birk in party → HINDER `HINDER_13_gen_FlyrVittra` (T1234, harpies flying) loop, show Birk, walkTo(BIRK, 408,252, dir 5). Otherwise hide Birk.
- Fishing net, if !inInv(FISKNAT) && g8df: FISKNAT.holder==MATTIS → `fisknat_13_gen_Ifors` (T1314, net in the rapids) loop, and if `act==3 && !inInv(LAX) && !g908` also `g8fb=1`. FISKNAT.holder==NULL → `fisknat_13_gen_Torkar` (T1081, drying). Any other holder → nothing.
- Cursor `FUN_004660f0`: 1 N, 2 NO, 3 NV; 4 hilite iff `g8df && FISKNAT.holder==0`; 5 hilite iff `g8df && FISKNAT.holder==&MATTIS` (net placed in the rapids; MATTIS is used as a "placed/consumed" holder sentinel); region 0x3a → riktadS iff `g8c4==1` or (`g8c4==3` and Birk follows); Birk hilite iff following.
- Walk `FUN_00466400`: 1 → portal SKOGEN; 2 → TJAERNEN (bridge); 3 → GROTTANUTE; Birk → nothing; region 0x3a (river crossing) if `g8c4==1` or (act 3 and Birk follows): Ronja walks to (182,305, raw z 2894.0) then `g8c4!=3` → `LAB_004660b0` → `FUN_00424ad0` (mode 1: stone-jump game, `eld1_13_Gen_ForsVatten1`, `Ronja_13_GEN_StortHopp*`); act 3 → `LAB_004660d0` → `FUN_00425d10` (mode 7: same with VILDVITTRA and Birk).
- Region 4 (net, G40): MOUTH talaNat (#279/#280), EYE tittaNat #278, HAND → `FUN_0045e7e0(RONJA_13_158A1_taNat)` (take the net; done by the track).
- Region 5 (rapids): "salmon catchable" S := `g8c4==3 && FISKNAT.holder==&MATTIS && LAX not in inventory && !g908 && g8fb`. MOUTH/EYE: S → G41, else G42. HAND: S → `FUN_0045e870(RONJA_13_162A1_taForsA, birk_13_162A1_taForsA)` (Birk catches salmon, "Sostra mi av…"), else `FUN_0045e870(RONJA_13_165A1_taForsA, birk_13_165A1_taForsA)`.
- Birk table: A=130, B=132, C=131, D=133, E=134, F=83.
- ITEM `FUN_00466f10`: region 5 and item 0x19 **FISKNAT** → `FUN_0045e870(RONJA_13_159A1_kastaNatA, birk_13_159A1_kastaNatA)` (cast the net). No act check here. Other items: nothing.

### 3.16 Scene 14 TJAERNEN (forest lake, 0x1011)
FUN_0045cea0: `g8d0 |= 4; g8e5=0`. Music `dls_tjarnensyrsor_40_70vol` (vol 70, tempo 33.3). VITMOSSA T328 `vitmossa__gen_still` if !inInv and holder≠DJUR3.
- act 2:
  - First visit (`!g8fc`): BIRK T715 `birk_14_178A1_snubblaBirk`, DJUR1 T1093, `DoDialogAni(#303 _14_178A1_snubblaBirk, actor BIRK)`, `g8fc=1`.
  - Else `!g8fe` → stillAt(BIRK, 448,401, dir 3).
  - Else `!g8d5` → `DoDialogAni(#531 _14_402A1_ravlyanBirk)`.
- act 3: Birk in party → show, walkTo(BIRK, 470,400, dir 3). Otherwise **meeting Birk**: stillAt(BIRK, 225,405, dir 3), stillAt(RONJA, 124,405, dir 5), `DoDialogAni(#313 _14_187A1_motaBirk, cb LAB_0045ce80 → BIRK.holder=&RONJA)`, and `BIRK.holder=&RONJA` immediately as well (Birk joins the party).
- Cursor `FUN_00466f90`: 1 riktadV, 2 riktadO; 3 hilite unless VITMOSSA is in inventory; 4 hilite iff `g8c4==2 && g8fc && !g8d5`; Birk hilite iff following.
- Walk `FUN_00467250`: 1 → portal KAELLAN; 2 → GLUPAFALLET; Birk nothing; else walk.
- Region 3 (white moss, G35): MOUTH talaVitmossa #263/#264, EYE #262; HAND `FUN_004676c0`: if `!g8dd` → `FUN_0042d4e0` (mode 2: grey-dwarf "gradvarg" fight; its end `0x42efc0` sets `g8dd`); else G35 HAND `_14_143A1_taVitmossa` and **`VITMOSSA.holder = &RONJA`**.
- Region 4 (Birk in act 2): if `g8c4==2 && g8fc && !g8fe && !g8d5` → G47, else G89. MOUTH uses cb `LAB_004675f0`; HAND/EYE none.
  - `LAB_004675f0`: if last event ∈ {#306 `_14_180A2`, #307 `_14_180B1`, #534 `_14_404A2`, #535 `_14_404B1`} (all talaBirk branches) → **`g8e5 = 1`**, scroll 0, `SetCurrentScene(SKOGEN)`, hide Ronja, `PlaySmackerFile("dimman.smk", 0x467690, 64, 69)`; end cb `0x467690`: show Ronja, **`g914 = 1`**.
- Birk (act 3) table: A=130, B=132, C=131, D=133, E=134, F=83.

### 3.17 Scene 15 GROTTANUTE (outside the bear cave, 0x1012)
FUN_0045d090: `g8d0 |= 0x20`. Music `dls_Forsengrottan_30_60vol` (vol 55, tempo 25). HINDER T951 `hinder_15_628A1_stenForGrotta` if `!g907`, else T1265 `HINDER_15_628A1_StenBredvidGrotta` (stone rolled aside; g907 set by the track cb HINDER_15_274C3_TALABIRK). Return unless act 3. Then:
- If `g905 && !g906` → BIRK T984 `BIRK_15_294A1_LovisVantar` only.
- Else if `g8e2 && g902 && !g905` → LOVIS T374 `LOVIS_15_294A1_LovisVantar` and BIRK T984.
- Else if `g8f7 && !g8f8` → LILLKLIPPEN T477 + BIRK T981 `*_15_287A1_LillKlippenVantar`, stillAt(RONJA, 154,315, dir 5).
- Else Birk in party → show, walkTo(BIRK, 306,386, dir 3). Otherwise hide Birk.
- Cursor `FUN_00467da0`: 1 → riktadNV if `g907` (stone block removed) else hilite; Birk hilite; 2 riktadN; 3 hilite iff (`g8e2 && g902 && !g905`) or (`g8f7 && !g8f8`); 4 hilite iff `g8e2 && g902 && !g905`.
- Walk `FUN_00468010`: region 1 with `g907`: if `!g8df` → Ronja walks (344,368, raw z 978.0), Birk walks (274,368), `FUN_0042a440` (mode 6: gradvarg attack at the cave; `0x42c8e0` later sets `g8df`); else portal 0x4edb20 into GROTTANINNE. Region 2 → portal 0x4e2490 GLAENTAN. Everything else (also Birk, also region 1 without `g907`) → walk to the point.
- Region 1 (stone block HINDER): MOUTH `g8c4!=3` → G72 else G73 (HAND/EYE same groups).
- Region 3 (Lill-Klippen / Lovis visitors): MOUTH: if `g8e2 && g902 && !g905` → G80 `_15_296A1_talaLovis` and **`g905=1`**; elif `!g8f9` → **`g8f9=1`**, G77 `_15_289A1_talaLillKlippen`; else G78 `_611A1_talaLillKlippen`. HAND: Lovis case G80 + `g905=1`, else G77 (never G78). EYE: Lovis case G80 (no flag), else G77. Region 4: only the Lovis case (same as region 3).
- Birk (same for all verbs except the cb): `g905` → G81; elif `g8f9 && !g8f8` → G79; elif `!g907` → G74 (MOUTH cb `LAB_00467d40`); elif `g90a && !g90b` → G140 ("Jag är hungrig"); elif `g8df` → G75; elif act 3 && Birk follows && `!g8f7` → G130; elif `g8f7` → G83 (the G134 branch is unreachable).
- `LAB_00467d40`: if last event == #421 `_15_274C3_talaBirk` → counter `DAT_004ecb40=0`; Ronja and Birk walk to the starts of `ronja_15_274C3_talaBirk`/`birk_15_274C3_talaBirk` (cb `0x467cc0` each); when both arrived (counter reaches 2) Ronja, Birk and HINDER play `*_15_274C3_talaBirk` together (push the stone block away; `g907` is set by a track end-handler, 0x45330b).

### 3.18 Scene 16 GROTTANINNE (inside the cave, 0x1013)
FUN_0045d270: Birk is always shown and walks to (419,459, dir 3). ELD1 (campfire): `!g90a` → T752 `ELD1_16_gen_slackt`. Otherwise T751 `ELD1_16_gen_medLax` (salmon on the fire) if `g908 && !g90b`, else T750 `ELD1_16_gen_brinner`, plus music dls_eld_40_ (127, tempo 33.3).
If inInv(VATTENKARL) && `g90e` (bucket filled): RONJA T1077 `RONJA_16_587A1_lamnaVatten`, `DoDialogAni(#707 _16_587A1_lamnaVatten, cb LAB_0045d260 → FUN_00468ac0)`, `VATTENKARL.holder=&MATTIS`, `g8fa=1`. FUN_00468ac0: if `g90e && g90b && act==3` → `g8f7=1` (summer), hide Ronja, play summer.smk.
- Cursor `FUN_00468b40`: 1 riktadNO; 2 (fireplace) hilite iff `g908 && !g90b`; Birk hilite.
- Walk `FUN_00468c60`: 1 → portal 0x4e7b90 out; else walk (Birk too).
- Region 2, any verb (`468ce0/468ef0/469100` identical): `FUN_0045ea70(#442 _16_285A1_ataLax (eat salmon; Birk "Det var gott"), Ronja_16_285A1_ataLax, birk_16_285A1_ataLax, cb LAB_00468b20)`. No state check in code (UNCERTAIN whether the region is masked otherwise). `LAB_00468b20`: **`LAX.holder = &MATTIS`** (eaten), **`g90b = 1`**.
- Birk table: A=130, B=132, C=131, D=139, E=134, F=83.
- ITEM `FUN_00469320`, region 2 (fireplace):
  - `!g90a && !g909` and item 0x1b **FNOSKE** (tinder) → `#437 _16_282A1_laggaFnoske`, cb `LAB_00469310` → **`g909 = 1`** (tinder laid).
  - `!g90a && g909` and item 0x13 **ELDSTAL** and `FLINTA.holder == &ELDSTAL` (flint already combined with the fire-steel) → `#438 _16_283A1_tandaFnoske` (light the fire; `g90a` "fire burning" set by its track end-handler 0x4544c0).
  - `g90a` and item 0x22 **LAX** → Ronja walks to the start of `Ronja_16_285A1_ataLax` (dir 7) and `DoDialogAni(#440 _16_284A1_stekaLax, actor BIRK)` (roast the salmon; `g908` set by track handler 0x454620).
  - everything else → `#715 _16_595A1_felEld` ("Nej det går…").
- `FUN_00468ac0` (summer): if `g90e && g90b && g8c4==3` → **`g8f7 = 1`**, hide Ronja, `PlaySmackerFile("summer.smk", LAB_00468a70, 64, 69)`; `LAB_00468a70` hides Ronja and plays `grottan.smk` (cb 0x468a00); `0x468a00` shows Ronja standing at (120,400) dir 5 and Birk at (200,400) dir 3. Called from 0x4545d5 (right after `g90b=1` at 0x4545a2, i.e. after eating) and 0x45d268 (scene init).

### 3.19 Talking to Birk in act 3 (all forest scenes)
- `FUN_00462e80(grp, v, cb)` **"talk to Birk"** (L78023): if `|Rx−Bx|+|Ry−By| <= 200.0` (`0x482ee8`): set facing `RONJA+0x298`/`BIRK+0x298` (Birk left of Ronja: Ronja dir 3, or 1 if `By <= Ry+5`; Birk right: Ronja 7 if `By <= Ry+5` else 5; Birk's dir: left → 7 (5 if `By <= Ry−5`), right → 3 if `By <= Ry−5` else 1) and dispatch `(grp, v, cb, actor=NULL, 0)`. Otherwise Ronja walks to `(Bx−100, By)` (if `Bx−100 < 0` then `(Bx+100, By)`), callback `LAB_00462e10` applies the precomputed facings (normal case Ronja 7 / Birk 1, fallback Ronja 1 / Birk 7) and dispatches `(grp, v, cb, NULL, 0)`.
All forest scenes use the same staged condition chain (require `g8c4==3` and Birk following, i.e. `BIRK.holder` chain == RONJA), via `FUN_00462e80`:

| stage | condition | typical Birk line |
|---|---|---|
| A | `!g8df && !g8f7` | "Kan vi inte…" |
| B | `g8df && !g90a && !g8f7` | "Tror du att…" / "Mattis brukade säga" |
| C | `g8df && g90a && !g8fa && !g8f7` | "Vi måste ha…" / "Vi borde ta…" |
| D | `g8df && g90a && !g900 && !g8f7` | "Det finns gott…" |
| E | `!g90b && g8fa && g900 && !g8f7` | "Jag är hungrig" |
| F | otherwise if `g8f7` | "Det är varmt" (summer) |

(no match → nothing). Groups: SKOGEN 36/37/38/39/126/82; KAELLAN 64/66/65/67/137/84; GLAENTAN 59/60/61/62/135/–; GLUPAFALLET & TJAERNEN 130/132/131/133/134/83; GROTTANINNE 130/132/131/139/134/83; GROTTANUTE has its own chain (§3.17).

---------------------------------------------------------------------------------------------------

## 4. Track hooks and follow-up tracks (side effects of animations)

Most story side effects are not in the click handlers but in **track hooks**: C++ callbacks bound by name to 128 tracks (table 0x4ba2c8, code 0x451bf0-0x454640 = tracksHWfunc.cpp). They fire for whatever object plays the track, also for lip-sync tracks of voice lines (so a hook named after a say line fires in every event using that line).

### 4.1 Mechanism
#### Construction (FUN_00450b30, after the tracks file is loaded, L67041)
- `DAT_004e1fd4 = calloc(nTracks*4)`: one callback slot per track serial.
- Hook table: count dword at **0x4ba2c0 = 0x80 (128)**, then 128 pairs `{char* trackName, void (*cb)(int code)}` at
  **0x4ba2c8..0x4ba6c7**. For each pair: `slot[FUN_004500b0(name) - 0x200000] = cb`.
  `FUN_004500b0` is a **case-insensitive** hash lookup (FUN_0041a930 → `_stricmp`). When two names differ only in case,
  **the later entry overwrites the earlier one** (see the data quirks below).
- Chain table: NULL-terminated pairs `{nameA, nameB}` at **0x4ba6c8** (46 pairs, §4.3): `DAT_004e1fd0[serial(A)] = serial(B)`.
- An asset error leaves the name unresolved; no such case exists in the shipped data (all 128 names resolve, checked
  against handles.txt).

#### Dispatch (FUN_00451b20(serial, code) → `slot[serial](code)` if non-NULL)
Called from Scurr.cpp:

| code | when | caller |
|---|---|---|
| `0x100000` | **track started**, at the very beginning of setTrack (before the old end-callback is fired and before key 0 is applied). Chained tracks also fire it. | FUN_00455990 (0x4559bb) |
| `0x400000 \| n` | **key n became current** (n = new 0-based key index, so n ≥ 1; fires once per key change, also on each loop) | FUN_00455cc0 (0x455d4d) |
| `0x200000` | **track ended naturally** (after the last key; also immediately for a 0-key track). Fired **before** the chained track is started and before the object's end callback. | 0x4559d0, 0x455eef, 0x456109 |

Interrupted tracks (stopTrack, a new setTrack on the same object, SetCurrentScene clearing all objects) do **not**
fire 0x200000. So all "end" effects need the animation to play to its end.

Every callback uses the same filter: `if (code & 0x100000) → start branch; else if (code & 0x400000) → key branch
(n = code & 0xffff); else if (code & 0x200000) → end branch`. Hooks are **global per track**, not per object or scene:
any object playing that track triggers them. Say lines trigger hooks through their lip-sync tracks (playSound →
FUN_00450450 starts the tracks linked to a voice sample, engine.md §5). So a hook named after a say line fires in every
event that uses that say line (e.g. `MATTIS_10_315A1Say6…` is in both #503 and #504).
Dialog-event tracks are found by DoDialogAni through the name after the first `_`, with an `A` retry
(`_1d_428A1_TandaSpis` → `ronja_1d_428a1_tandaspisA`), and continue through the chain table.

`DAT_004ee744` (engine-busy bits; any set bit = invisible cursor, clicks ignored, engine.md §4.9) is used by hooks as a lock:
bit 0x01 (water filling), 0x10 (Ronja+Birk fishing/net sequences), 0x80 (Sturkas sequence).

### 4.2 Hook table
Columns: table slot, track (Tn), callback, trigger → effect, and what starts the track.
"key n" = code `0x400000|n`.

| slot | track | cb | trigger → effect | started by |
|---|---|---|---|---|
| 4ba2c8 | BIRK_13_165A1_TAFORSA (T1319) | 4526e0 | start: `744 \|= 0x10`. end: RONJA.setTrack(T1019 `ronja_13_165A1_taForsB`) | GLUPAFALLET HAND rapids when salmon **not** catchable (FUN_0045e870, 0x4669aa) |
| 4ba2d0 | BIRK_13_165A1_TAFORSC (T1320) | 452730 | end: `744 &= ~0x10`; stand(BIRK, own x,y, 0, dir 5) | 452780 below |
| 4ba2d8 | BIRK_13_162A1_TAFORSA (T1315) | 452580 | start: `744 \|= 0x10`. end: RONJA T1016 `ronja_13_162A1_taForsB` | HAND rapids when salmon catchable (0x466995) |
| 4ba2e0 | BIRK_13_162A1_TAFORSC (T1316) | 4525d0 | end: stand(BIRK, own x,y,0, dir 5); `744 &= ~0x10`; **DoDialogAni(#286 `_13_162A1_taFors`** = Birk "Sostra mi av…", no cb, no actor) | 452630 |
| 4ba2e8 | RONJA_16_282A1_LAGGAFNOSKE (T1054) | 454450 | end: **FNOSKE.holder = &MATTIS** (tinder used up) | #437 `_16_282A1_laggaFnoske` |
| 4ba2f0 | ronja_16_283a1_tandafnoskeb (T756) | 454480 | end: ELD1 T750 `ELD1_16_gen_brinner` (loop); **g90a = 1** (cave fire burns) | #438 `_16_283A1_tandaFnoske` (track A → chain B) |
| 4ba2f8 | BIRK_16_285A1_ataLax (T1272) | 4544d0 | start: BIRK.setTrack(T1273 `Ronja_16_285A1_ataLax`) (literally a Ronja-named track on Birk; UNCERTAIN whether the T1272/T1273 names are swapped in the data) | #442 via FUN_0045ea70 (0x468ec0…) |
| 4ba300 | birk_16_284A1_STEKALAX (T749) | 4545e0 | end: ELD1 T751 `ELD1_16_gen_medLax` (loop); **g908 = 1** (salmon on the fire) | #440 `_16_284A1_stekaLax` (track `Birk_16_284A1_stekaLaxA` → chain) |
| 4ba308 | BIRK_16_285A1SAY1_DETVARGOTT (T754) | 454510 | start: hide RONJA; ELD1 T750 loop; music `dls_eld_40_` vol 127, tempo 33.33. end: **g90b = 1**; show RONJA; RONJA T1274 `ronja_16_285A1_ReserSig`; **jmp FUN_00468ac0** (summer check, §1.2) | say in #442 |
| 4ba310 | RONJA_10_241A1_FYLLAVATTENB (T901) | 4528d0 | start: `744 \|= 1`. end: **g90e = 1** (vessel full); stand(RONJA, 243,312,0, dir 5); `744 &= ~1` | chain from FyllaVattenA |
| 4ba318 | RONJA_10_240A1_TAVATTENKARL (T990) | 452820 | key 7: hide VATTENKARL. end: **VATTENKARL.holder = &RONJA** | #380 `_10_240A1_taVattenkarl` |
| 4ba320 | RONJA_13_162A1_TAFORSB (T1016) | 452630 | start: hide BIRK, hide FISKNAT. end: **FISKNAT.holder = &LOVIS** (net gone), **LAX.holder = &RONJA**, **g900 = 1**; BIRK T1316 `birk_13_162A1_taForsC` | 452580 |
| 4ba328 | RONJA_13_165A1_TAFORSB (T1019) | 452780 | start: hide BIRK, hide FISKNAT. end: **FISKNAT.holder = &RONJA** (net back in the inventory, empty); BIRK T1320 | 4526e0 |
| 4ba330 | RONJA_13_158A1_TANAT (T342) | 452440 | key 8: hide FISKNAT, **FISKNAT.holder = &RONJA** | GLUPAFALLET HAND region 4 (FUN_0045e7e0, 0x46693a) |
| 4ba338 | BIRK_13_159A1_KASTANATA (T1317) | 4524a0 | start: `744 \|= 0x10`. end: RONJA T1018 `ronja_13_159A1_kastaNatB` | FISKNAT used on the rapids (0x466f5f) |
| 4ba340 | BIRK_13_159A1_KASTANATC (T1318) | 452730 | (same cb as TAFORSC) end: unlock 0x10, Birk stands dir 5 | 4524f0 |
| 4ba348 | RONJA_13_159A1_KASTANATB (T1018) | 4524f0 | start: hide BIRK. end: **FISKNAT.holder = &MATTIS** (net set in the rapids); FISKNAT T1314 `fisknat_13_gen_Ifors` (loop); BIRK T1318 (Ronja continues via chain → `ronja_13_159a1_kastanatc`) | 4524a0 |
| 4ba350 | RONJA_1C_186A1_SLAPPSKALLEPER (T1252) | 452bd0 | end: stand(RONJA, x+5, y+10, 0, dir 1) (constants −5/−10 at 0x482da8/0x482da4 subtracted) | 452b60 |
| 4ba358 | ronja_12_193a1_tasten (T905) | 452c20 | key 8: hide ELD1 (the glade stone). key 12: show ELD1 | #323 `_12_193A1_taSten` |
| 4ba360 | SKALLEPER_1C_186A1SAY1_DUARMITT (T946) | 452b60 | start: hide RONJA. end: RONJA T1252 `RONJA_1C_186A1_slappSkallePer` | say in #312 (act 3 hall) |
| 4ba368 | MATTIS_9b_327A1Say1_RonjaRonjaForsvinnFar (T1162) | 4542d0 | end: scroll 0; **SetCurrentScene(BORGPORTEN)**; RONJA T1033 `RONJA_8_326A1Say1_TackSkaDuHa` (no flag: failed fog) | say in #521 `_9b_327A1_BirkOchDimman` |
| 4ba370 | RONJA_14_179A1Say1_DetDarAr (T1208) | 454170 | start: if `act==2 && g8fc && !g8d5 && g8e5 && curScene==SKOGEN` → setPos(RONJA, 378,432,0); else setPos(RONJA, 360,401,0) | say in #304, #515, #532 (all "tittaBirk") |
| 4ba378 | birk_9b_326a1say1_laterdudej (T995) | 4541e0 | start: hide RONJA; ELD1/ELD2/ELD3 loop T1240/T1241/T1242 `HINDER_9a_gen_underjord1/2/3`. end: scroll 0; **SetCurrentScene(BORGPORTEN)**; RONJA T1033; **g8d5 = 1** | say in #520 `_9b_326A1_hjalpaBirk` |
| 4ba380 | DJUR2_2a_094A1Say1_HastGnagg (T1095) | 453a70 | end: hide DJUR2. **Dead**: overwritten by slot 4ba6b0 (same name, other case) | – |
| 4ba388 | RONJA_1C_044A1_TASTURKAS (T347) | 4535d0 | end: STURKAS T807 `STURKAS_1c_044A1_taSturkas` | #106 `_1c_044A1_taSturkas` |
| 4ba390 | STURKAS_1C_044A1_TASTURKAS (T807) | 453620 | start: `744 \|= 0x80`. end: `744 &= ~0x80`; STURKAS T11 `sturk_1c_041A1_RovareAter` (loop) | 4535d0 |
| 4ba398 | LOVIS_1D_076A1SAY1_VANTALITE (T635) | 453b10 | start: hide RONJA | say in #159 `_1d_076A1_taKniv` |
| 4ba3a0 | RONJA_1B_542A1_TASKINNREM (T459) | 4523e0 | start: hide REM. key 8: **REM.holder = &RONJA** | #661 `_1b_542A1_taSkinnrem` |
| 4ba3a8..4ba3e0 | RONJA_17_GEN_STOP{NORDVAST, NORR, NORDOST, OST, SYDOST, SYD, SYDVAST, VAST} (T163,165,161,166,173,169,175,171) | 451c20,451c50,451c80,451cb0,451ce0,451d10,451d40,451bf0 | end: **FUN_004218f0(dir)** with dir NORR 0, NORDOST 1, OST 2, SYDOST 3, SYD 4, SYDVAST 5, VAST 6, NORDVAST 7 (labyrinth torch-flame snap, §5.1) | labyrinth stand tracks (0x4213b7…) |
| 4ba3e8 | RONJA_7_132A1Say1_slapaStenar (T1201) | 4537a0 | key 1: hide HINDER (stone heap). end: **g8f5 = 1**; SetCurrentScene(FANGELSEHALOR, force); hide RONJA; **PlaySmacker("fangelse.smk", cb 0x453740, 0, 0)**. cb 0x453740 (not aborted): stand(RONJA, 432,392,0, dir 3); show RONJA; **g8e4 = 1**; DoDialogAni(#256 `_7_136A1_halBirk`, cb 0x462920 = BIRK T693 `Birk_7_136A1_tyst` loop) | say in #246 `_7_132A1_taStenhog` |
| 4ba3f0 | ronja_6_081a1_tandkallarenb (T1005) | 4536c0 | end: **g8ed = 1**; SetCurrentScene(KAELLARE, force); hide RONJA; **PlaySmacker("kallare.smk", cb 0x453680, 0, 0)**. cb 0x453680: stand(RONJA, 316,394,1395, dir 1); show RONJA | #165 `_6_081A1_tandKallarenA` (A → chain B) |
| 4ba3f8 | STURKAS_1c_055A1Say1_RovarnaSkriker (T962) | 4533c0 | start: hide RONJA, TJEGGE, LABAS; **RATTA.holder = NULL**; **g8da = 1**. end: scroll 0 (then chain → `sturkas_1c_055a1_rovareflyr`) | say in #131 `_1c_055A1_SkrammaRovare` |
| 4ba400 | STURKAS_1C_055A1_ROVAREFLYR (T966) | 453470 | end: scroll 640; stand(RONJA, 941,336,0, dir 3); hide STURKAS, TJEGGE, LABAS; **if `act==2 && g8d5 && g8d6 && g8d7 && g8d8 && g8da && g8d9 && !g8de`: hide DJUR1, hide RONJA, FUN_00431010 = snowball fight (mode 5)** | chain from 4ba3f8 |
| 4ba408 | MATTIS_1c_035A3Say2_DuMasteForsta (T281) | 453990 | start: **g8d6 = 1** | say in #82 `_1c_035A3_talaMattis` |
| 4ba410 | MATTIS_1c_035A4Say1_DuForstar (T282) | 453990 | start: **g8d6 = 1** | say in #83 `_1c_035A4_talaMattis` |
| 4ba418 | SKALLEPER_1C_039B1SAY1_VISSTARDET (T292) | 453360 | end: **g8d7 = 1**; SetCurrentScene(KOKET); stand(RONJA, 268,339,0, dir 3) | say in #94 `_1c_039B1_talaSkallePer` |
| 4ba420 | ronja_3_106A1Say1_KrangPaDejB (T975) | 454330 | start: hide BIRK. end: **dialogEnd(0)** (FUN_0046d530; remaining chain `_1c_033A1_MattisSuck` is not played); **act = 2**; scroll 0; SetCurrentScene(STORASALEN); scroll 0; hide RONJA; **PlaySmacker("helvetesgapet.smk", cb 0x4543f0, 64, 69)**. cb: show RONJA, stand(RONJA, 320,370,0, dir 5), **g913 = 1**, music `dls_eld_40_` vol 127 | chain from `…KrangPaDejA` (say in #207 `_3_106A1_raddaBirk`) |
| 4ba428 | DJUR1_14_178A1_SNUBBLABIRK (T1093) | 452ab0 | end: hide DJUR1 | TJAERNEN init act 2 (#303) |
| 4ba430 | RONJA_14_143A1_TAVITMOSSA (T332) | 452380 | key 9: hide VITMOSSA, **VITMOSSA.holder = &RONJA** | #265 `_14_143A1_taVitmossa` |
| 4ba438 | mattis_1c_442a1say1_aktadejfor (T920) | 453e60 | end: MATTIS T919 `MATTIS_1c_448A1_MattisSitter` (loop) | say in #572, #574 |
| 4ba440 | SKALLEPER_1D_077A1_LAMNARFACKLORNA (T416) | 452a60 | end: FACKLA T965 `fackla_1d_gen_slackt` (unlit torch on the wall) | KOKET init (0x45b970) / #160 |
| 4ba448, 458, 468 | LOVIS_15_296A1Say2_NejBrodFar / Say3_JaDaSlutar / Say4_InteNarHan (T879/883/884) | 453b10 | start: hide RONJA | says in #480 `_15_296A1_talaLovis` |
| 4ba450, 460, 470 | RONJA_15_296A1Say2_JagKommerAldrig / Say3_SkulleHanHoppa / Say4_LovisOmDu (T880/881/882) | 453b50 | start: hide LOVIS | says in #480 |
| 4ba478 | LOVIS_15_296A1Say5_NejDetSkulleA (T885) | 453b90 | start: hide RONJA. end: stand(RONJA, 230,444,0, dir 5) (chain → …B) | lip-sync track of #480's last Lovis line |
| 4ba480 | LOVIS_15_296A1Say5_NejDetSkulleB (T888) | 453c50 | end: hide LOVIS (Lovis leaves) | chain |
| 4ba488 | RONJA_15_290A1_TALILLKLIPPEN (T897) | 4529e0 | start: hide LILLKLIPPEN. end: show LILLKLIPPEN; stand(RONJA, own x,y,z, dir 5) | #471 `_15_290A1_taLillKlippen` |
| 4ba490 | HINDER_15_274C3_TALABIRK (T1108) | 4532d0 | end: **g907 = 1** (stone pushed from the cave mouth); stand(RONJA, own pos, dir 3); show BIRK; walk(BIRK, 306,386,0, no cb, dir 3) | GROTTANUTE cb 0x467cc0 after #421 |
| 4ba498 | RONJA_2a_096A1Say1_JagKanMata (T1026) | 453ac0 | end: RONJA T1094 `ronja_2A_096A1_geMorot` (flag 0x800 = keep cb); **MOROTTER.holder = &DJUR2** | say in #196 `_2a_096A1_geMorot` |
| 4ba4a0 | RONJA_2A_009A1_TALOVISC (T955) | 453a30 | start: LOVIS T957 `LOVIS_2A_009A1_taLovisC` | #18 taLovis (A→B→C chain) |
| 4ba4a8 | RONJA_2A_009A1_TALOVISB (T623) | 453b50 | start: hide LOVIS | chain |
| 4ba4b0 | RONJA_2A_005A1_taMattisC (T959) | 4539f0 | start: MATTIS T961 `MATTIS_2A_005A1_taMattisC` | #12 taMattis (A→B→C) |
| 4ba4b8 | RONJA_2A_005A1_taMattisB (T616) | 4539b0 | start: hide MATTIS | chain |
| 4ba4c0, 4d0, 4e0, 4f0 | SKALLEPER_1C_035A2SAY1_DETARMYCKET, 035A3Say1_SkalleFniss, 035A4Say1_JajaMensan, 035A4Say2_DuHarGott | 4539b0 | start: hide MATTIS (the speaker's lip-sync track draws the pair, UNCERTAIN) | says in #81–#83 |
| 4ba4c8, 4d8, 4e8, 4f8 | MATTIS_1C_035A2SAY1_DETLATERDU, 035A3SAY1_NUTIGERDU, 035A4Say2_JustDet, 035A4Say3_OmDuInte | 453950 | start: hide SKALLEPER | says in #81–#83 |
| 4ba500 | MATTIS_1B_021A1SAY2_AHHANSKULLE (T714) | 453260 | end: hide MATTIS; LOVIS T40 `lovis_1b_021A1_LovisSpinner` (loop); **g8e6 = 1** | say in #46 `_1b_021A1_LovisSpinner` |
| 4ba508 | MATTIS_14_318A1SAY1_FORSVINNGRADVARGAR (T645) | 451d70 | key 4: jmp FUN_0042ef40 (all active gradvargar fall; lake game lost, §5.5) | say in #506 |
| 4ba510 | RONJA_1C_054A1_TAFNOSKE (T275) | 452320 | key 9: hide FNOSKE, **FNOSKE.holder = &RONJA** | #130 `_1c_054A1_taFnoske` |
| 4ba518 | RONJA_1D_428A1_TANDASPISB (T1071) | 4531f0 | end: **g8e8 = 1** (stove lit); ELD1 T977 `ELD1_1d_gen_OppenSpis` (loop); music `dls_eld_40_` vol 127, tempo 33.33 | #559 `_1d_428A1_TandaSpis` (A→B→C) |
| 4ba520 | LOVIS_1D_076A1_LOVISGARIN (T1111) | 453190 | start: **g90c = 1**; setPos(LOVIS, RONJA x,y,z); LOVIS.setTrack(T555 `RONJA__gen_stillSO`) | chain from `ronja_1d_076a1say1_aj` (#159) |
| 4ba528 | lovis_1d_076a1_lovistarkniven (T460) | 452930 | key 5: hide KNIV, **KNIV.holder = &LOVIS**; RONJA T15 `ronja_1d_076A1_taKniv`, immediately replaced by RONJA T555 `RONJA__gen_stillSO` | chain from `lovis_1d_076a1say2_saronjamitt` |
| 4ba530 | RONJA_1D_439A1_TANDAFACKLAN (T1056) | 4522f0 | end: **g90d = 1** (torch lit) | KOKET use FACKLA on stove (0x4611ef) |
| 4ba538 | RONJA_1D_080A1_TAFACKLAN (T136) | 451f10 | key 8: hide FACKLA, **FACKLA.holder = &RONJA** | #164 `_1d_080A1_taFacklan` |
| 4ba540 | RONJA_1D_058A1_TAFLINTA (T109) | 451f70 | key 8: hide FLINTA, **FLINTA.holder = &RONJA** | #135 |
| 4ba548 | RONJA_1D_061A1_TAELDSTAL (T113) | 451fd0 | key 8: hide ELDSTAL, **ELDSTAL.holder = &RONJA** | #139 |
| 4ba550 | RONJA_1D_068A1_TALARATTA (T1120) | 453ca0 | key 6: hide RATTBUR | #147 `_1d_068A1_talaRatta` |
| 4ba558 | RONJA_1D_070A1_TARATTA (T124) | 4521c0 | key 9: hide RATTBUR; **RATTBUR.holder = RATTA.holder = &RONJA** | #150 |
| 4ba560 | RONJA_1D_066A1_PLACERAOSTRATTFALLA (T119) | 452290 | key 9: RATTBUR T899 `RATTBUR_1D_gen_laddad`; **RATTBUR.holder = NULL** (trap with cheese on the floor) | #145 |
| 4ba568 | RONJA_1D_065A1_PLACERATOMRATTFALLA (T118) | 452230 | key 9: RATTBUR T898 `RATTBUR_1D_gen_tom`; RATTBUR.holder = NULL | #144 |
| 4ba570 | RONJA_1D_064A1_TARATTFALLA (T117) | 452160 | key 9: hide RATTBUR, **RATTBUR.holder = &RONJA** | #143 |
| 4ba578 | RONJA_2A_086A1_TASTEGEB (T679) | 453140 | end: **g8dc = 1** (ladder raised); hide STEGE | #172 / portal leave-track (A → chain B) |
| 4ba580 | ronja_6_123A1_taHylla (T476) | 453110 | end: **g8db = 1** | #227, and the leave-track of EXIT_KAELLARE_to_FANGELSEHALOR |
| 4ba588 | RONJA_6_112A1_TAOST (T91) | 452030 | key 8: hide OST, **OST.holder = &RONJA** | #215 |
| 4ba590 | RONJA_6_116A1_TAMOROT (T92) | 452090 | key 8: hide MOROTTER, **MOROTTER.holder = &RONJA** | #220 |
| 4ba598 | RONJA_6_128A1_TABRODKAKA (T102) | 4520f0 | key 8: hide BRODKAKA, **BRODKAKA.holder = &RONJA**, **g8f0 = 0** | #243 |
| 4ba5a0 | RONJA_18_GEN_SKAKARC (T987) | 451db0 | key 2: jmp FUN_00428eb0 (hide Ronja's dice) | dice game |
| 4ba5a8 | SKALLEPER_18_321A2SAY1_GORSADU (T741) | 451df0 | end: jmp FUN_00428fb0 (dice → state 5, leave) | says in #510, #513 |
| 4ba5b0 | SKALLEPER_18_120A2SAY1_TJAJAGFAR (T762) | 451e20 | end: jmp FUN_00428fa0 (dice → state 3, play again) | say in #512 |
| 4ba5b8 | RONJA_18_321A1ALT1_JANUSKADU (T737) | 451e20 | end: same (play again) | alt 156 of #509 |
| 4ba5c0..4ba5f8 | RONJA_17_GEN_STOP* (second copy, same 8 callbacks) | – | identical duplicates (case-insensitive, overwrite with the same value) | – |
| 4ba600 | RONJA_1A_017A1_OPPNAKISTA (T34) | 453bf0 | end: **g90f = 1** (chest open); SetCurrentScene(SKALLEPERSRUM, force) (open-chest gfx); stand(RONJA, 470,422, RONJA.z, dir 7) | #40 `_1a_017A1_oppnaKista` |
| 4ba608 | LOVIS_1B_025A1_LOVISGARUT (T1002) | 453c50 | end: hide LOVIS | #59 `_1b_025A1_LovisGarUt` (A→B chain) |
| 4ba610 | RONJA_1D_068A1SAY1_VADGORDUHARLILLARATTA (T121) | 453ca0 | key 6: hide RATTBUR | say in #147 |
| 4ba618 | RATTA_1D_068A1SAY1_VADGORDUHARLILLAROVARDATTER (T928) | 453d00 | start: hide RONJA. key 6: RATTBUR T900 `RATTBUR_1D_gen_medRatta`. end: stand(RONJA, own x,y,0, dir 7); hide RATTA | say in #147 |
| 4ba620 | RATTA_1D_432A1SAY1_RATTAPIPER (T1248) | 453dd0 | end: hide RATTA | say in #563 `_1d_432A1_taRatthalet` |
| 4ba628 | RONJA_2A_624A1_GARNERSTEGE (T1154) | 453e20 | end: stand(RONJA, 1721,343,0, dir 5) | arrive-track of EXIT_BORGGARDEN_to_HELVETESGAPET |
| 4ba630 | RONJA_12_190A1_TABJORK (T929) | 452b00 | key 1: hide HINDER (the birch) | #320 `_12_190A1_taBjork` |
| 4ba638 | RONJA_12_213A1_FORBINDERSTOET (T695) | 452ca0 | start: hide BIRK, hide DJUR3 | #348 `_12_213A1_forbinderStoet` |
| 4ba640 | RUMPNISSE_12_213A1SAY1_VOFFORGORDI (T708) | 452d00 | end: DJUR3 T721 `DJUR3_12_Gen_StillaForband` (loop); stand(BIRK, own pos, dir 7) | say in #348 |
| 4ba648 | RONJA_12_216_TAHASTARNAB (T964) | 452d90 | start: scroll 640; hide DJUR1. key 7: BIRK T963 `Birk_12_216_TaHastarnaB`; hide DJUR2 | chain from `Ronja_12_216A1_TaHastarnaA` |
| 4ba650 | RONJA_12_196A1_TAVILDTORINGENB (T759) | 452f60 | start: scroll 640; hide DJUR1. key 5 **only if act==3**: BIRK T776 `Birk_12_199A1_TaRackarnB`; hide DJUR2 | chain from …A |
| 4ba658 | BIRK_12_216_TAHASTARNAC (T1041) | 452e40 | end: DJUR2 T758 `DJUR2_12_513A1_HastarBetar` (loop); show DJUR2 | chain |
| 4ba660 | RONJA_12_216_TAHASTARNAC (T1040) | 452ed0 | end: DJUR1 T1312 `DJUR1_12_513A1_HastarBetar` (loop); show DJUR1 | chain |
| 4ba668 | BIRK_12_199A1_TARACKARNB (T776) | 453010 | end: DJUR2 T758 (loop); stand(BIRK, 1095,405,0, dir 0); walk(BIRK, 1155,380,0, no cb, dir −1) | 452f60 / chain |
| 4ba670 | RONJA_12_196A1_TAVILDTORINGENC (T774) | 4530b0 | start: DJUR1 T1312 (loop) | chain |
| 4ba678 | BIRK_13_GEN_FLYRVITTRA (T1233) | 451e50 | key 23: if effect channel DAT_004f1960 idle → `EFFEKT_13_1_plask` (loops 0, pan 110, vol 110). key 29: hide HINDER. end: RONJA+0x4f8 = 0 (river-2 decoration may restart, §5.3) | river+witch init (0x426b08) |
| 4ba680 | MATTIS_10_315A1SAY6_EGENTLIGENKLAOPP (T893) | 4538b0 | end: **stopMusic(1); dialogEnd(0)** (says 573–582 of #503 are never played); scroll 0; hide RONJA; **PlaySmacker("outro.smk", cb 0x453930, 64, 69)**; cb (not aborted): `FUN_004030b0(lpMyGame)` = end credits `eftertext.smk` → program exit (engine.md §1.5) | say in #503 and #504 |
| 4ba688 | MATTIS_10_315A1SAY1_MITTBARN (T886) | 453860 | start: setPos(RONJA, 1000,1000,1000); hide RONJA (Mattis' track shows both) | say in #503 |
| 4ba690 | MATTIS_10_315A1SAY3_JASOMDU (T890) | 453860 | start: same | says in #503, #504 |
| 4ba698 | FJOSOK_2A_091A1SAY1_NAMENSERONJA (T589) | 453f70 | start: hide LILLKLIPPEN, DJUR2 | say in #184 |
| 4ba6a0 | DJUR2_2A_097A1SAY1_IRROHAST (T1096) | 453f10 | start: hide LILLKLIPPEN, FJOSOK | say in #197 `_2a_097A1_geFel` |
| 4ba6a8 | LILLKLIPPEN_2A_097A1SAY1_DENTYCKERINTE (T724) | 453eb0 | start: hide DJUR2, FJOSOK | say in #197 |
| 4ba6b0 | DJUR2_2A_094A1SAY1_HASTGNAGG (T1095) | 453f10 | start: hide LILLKLIPPEN, FJOSOK (effective entry for T1095) | say in #193 |
| 4ba6b8 | LILLKLIPPEN_2A_096A1SAY1_KOMMERDUMED (T1115) | 453fd0 | start: stand(RONJA, 374,468,0, dir 7). end: LILLKLIPPEN T1112, FJOSOK T1113, DJUR2 T1114 (`*_2A_633A1_LillklippenFjosokGar`, they leave with the horse); **g8d9 = 1**; **if `act==2 && g8d5 && g8d6 && g8d7 && g8d8 && g8da && !g8de`: hide DJUR2, LILLKLIPPEN, FJOSOK, RONJA; FUN_00431010 = snowball fight** | say in #196 `_2a_096A1_geMorot` |
| 4ba6c0 | RONJA_10_241A1_FYLLAVATTENA (T1269) | 452890 | start: `744 \|= 1`. end: `744 &= ~1` (chain → FyllaVattenB) | KAELLAN use VATTENKARL on water (FUN_0045e7e0, 0x4648d8) |

#### Hooks that change story state (summary)
gVar writes in hooks: g8c4=2 (0x45437f), g8d5 (0x4542c7), g8d6 (0x4539a0), g8d7 (0x45338b), g8d9 (0x454079), g8da (0x45344c),
g8db (0x453130), g8dc (0x45316f), g8e4 (0x453788), g8e6 (0x4532c5), g8e8 (0x45321d), g8ed (0x4536eb), g8f0=0 (0x45214c),
g8f5 (0x453811), g900 (0x4526ba), g907 (0x45330b), g908 (0x454620), g90a (0x4544c0), g90b (0x4545a2), g90c (0x4531b9),
g90d (0x452310), g90e (0x452910), g90f (0x453c1b), g913 (0x454433).
Scene changes: KOKET (VisstArDet), BORGPORTEN (laterdudej, ForsvinnFar), KAELLARE (tandkallarenb), FANGELSEHALOR (slapaStenar),
SKALLEPERSRUM (oppnaKista), STORASALEN (KrangPaDejB). Movies: kallare.smk, fangelse.smk, helvetesgapet.smk, outro.smk.
Mini-game starts: mode 5 (ROVAREFLYR, KOMMERDUMED). Dialogs started: #286 (salmon), #256 (prison).

#### Data quirks
- 8 `RONJA_17_GEN_STOP*` names appear twice with identical callbacks (harmless).
- `DJUR2_2a_094A1Say1_HastGnagg` (0x4ba380 → 0x453a70, "end: hide DJUR2") is overwritten by `DJUR2_2A_094A1SAY1_HASTGNAGG`
  (0x4ba6b0 → 0x453f10, "start: hide LK + FJOSOK"). Only the second behaviour exists in the game. Unique effective hooks: 119.

### 4.3 Follow-up (chained) tracks
setTrack(B, 0x800 | (A had hide-at-end ? 2 : 0)) keeps the object's end callback (engine.md §3.3). The object's callback fires only at
the end of the last track of the chain.

| # | A | → B |
|---|---|---|
| 1 | ronja_1d_076a1say1_aj | lovis_1d_076a1_lovisgarin |
| 2 | RONJA_1c_036A1_taMattisA | RONJA_1c_036A1_taMattisB |
| 3 | lovis_1d_076a1say2_saronjamitt | lovis_1d_076a1_lovistarkniven |
| 4 | lovis_1d_076a1_lovistarkniven | lovis_1d_076a1_lovisgarut |
| 5, 7 | ronja_1d_428a1_tandaspisA | ronja_1d_428a1_tandaspisB (pair listed twice) |
| 6, 8 | ronja_1d_428a1_tandaspisB | ronja_1d_428a1_tandaspisC (listed twice) |
| 9 | RONJA_2A_005A1_taMattisA | RONJA_2A_005A1_taMattisB |
| 10 | RONJA_2A_005A1_taMattisB | RONJA_2A_005A1_taMattisC |
| 11 | RONJA_2A_009A1_taLovisA | RONJA_2A_009A1_taLovisB |
| 12 | RONJA_2A_009A1_taLovisB | RONJA_2A_009A1_taLovisC |
| 13 | djur2_2a_633a1_lillklippenfjosokgar | DJUR2_2A_096A1_Still |
| 14 | BIRK_3_100A1Say1_BirkSkrikA | BIRK_3_100A1Say1_BirkSkrikB |
| 15 | BIRK_3_100A1Say1_BirkSkrikB | birk_3_100_hanger |
| 16 | LOVIS_15_296A1Say5_NejDetSkulleA | LOVIS_15_296A1Say5_NejDetSkulleB |
| 17 | ronja_3_106A1Say1_KrangPaDejA | ronja_3_106A1Say1_KrangPaDejB |
| 18 | skalleper_1d_077a1say1_ronjamitthjartas | skalleper_1d_077a1_skallepergarut |
| 19 | STURKAS_1c_055A1Say1_RovarnaSkriker | sturkas_1c_055a1_rovareflyr |
| 20 | ronja_6_081a1_tandkallarena | ronja_6_081a1_tandkallarenb |
| 21 | ronja_2a_086a1_tastegea | ronja_2a_086a1_tastegeb |
| 22 | lovis_1b_025a1say1_ronjamittbarn | lovis_1b_025a1_lovisgarut |
| 23, 26 | skalleper_6_124a2say1_detarbra | skalleper_6_124_skallepergarut |
| 24, 27 | skalleper_6_124b2say1_detvarsynd | skalleper_6_124_skallepergarut |
| 25, 28 | skalleper_6_124c1say1_hanainteen | skalleper_6_124_skallepergarut |
| 29 | ronja_13_159a1_kastanatb | ronja_13_159a1_kastanatc |
| 30 | ronja_13_162a1_taforsb | ronja_13_162a1_taforsc |
| 31 | ronja_13_165a1_taforsb | ronja_13_165a1_taforsc |
| 32 | ronja_10_241a1_fyllavattena | ronja_10_241a1_fyllavattenb |
| 33 | Birk_12_216_TaHastarnaA | Birk_12_216_TaHastarnaB |
| 34 | Birk_12_216_TaHastarnaB | Birk_12_216_TaHastarnaC |
| 35 | Birk_12_216_TaHastarnaC | Birk_12_216_TaHastarnaD |
| 36 | Ronja_12_216A1_TaHastarnaA | Ronja_12_216_TaHastarnaB |
| 37 | Ronja_12_216_TaHastarnaB | Ronja_12_216_TaHastarnaC |
| 38 | Ronja_12_216_TaHastarnaC | Ronja_12_216_TaHastarnaD |
| 39 | Birk_12_199A1_TaRackarnA | Birk_12_199A1_TaRackarnB |
| 40 | RONJA_12_196A1_taVildtoringenA | RONJA_12_196A1_taVildtoringenB |
| 41 | RONJA_12_196A1_taVildtoringenB | RONJA_12_196A1_taVildtoringenC |
| 42 | ronja_16_283a1_tandafnoskea | ronja_16_283a1_tandafnoskeb |
| 43 | ronja_16_283a1_tandafnoskeb | ronja_16_283a1_tandafnoskec |
| 44 | Birk_16_284A1_stekaLaxA | Birk_16_284A1_stekaLax |
| 45 | Birk_16_284A1_stekaLax | birk_16_285A1_ReserSig |
| 46 | birk_16_285A1Say1_DetVarGott | birk_16_285A1_ReserSig |

The table has 46 pairs but only 38 distinct ones (#5–8 and #23–28 repeat).

### 4.4 gVar.cpp runtime helpers (0x41e500-0x421000)

| function | what it does |
|---|---|
| **FUN_0041e500(gVar)** "reset" (L34775) | Called from the gVar ctor FUN_0041e490 (static init) and from GameDlg "Nieuw spel" (0x405e39; then g911=1 and SetCurrentScene(BORGGARDEN,true)). Sets mode (0x4cf8c0) = 0, **act = 1**, ints 0x8c8/0x8cc/0x8d0 = 0, every byte 0x8d4..0x917 = 0 **except 0x8d9** (gVar+0x101 is missing from the list, verified in asm 0x41e51d…), and zeroes the 143×3 use counters 0x4e08e0..0x4e0f94. It does **not** reset object holders/positions. Quirk: after a second "new game" in one session g8d9 (carrots given) stays 1, so the horse step is skipped and the robber-rat scare alone starts the snowball fight. |
| FUN_0041e6e0 | SerializeVarsToFromFile (save/load; engine.md §4.7). The only other place that writes 0x8cc, 0x8ec, 0x8f6, 0x8fd, 0x916, 0x917. |
| **0x41fa70** (asm only) spring.smk end cb | If not aborted: show RONJA; **g915 = 1**; RONJA.setTrack(T936 `RONJA_1C_183A1_RonjaOchSkallePer`) (assert gVar.cpp:0x111); music `dls_eld_40_` vol 127, tempo 33.33; **RATTBUR.holder = &MATTIS** (rat trap removed). |
| **FUN_0041fb10** (snowball end, reached from 0x43285c after the win dialog #524) | If `g8de && (g8f4 \|\| BRODKAKA.holder==&BIRK \|\| BRODKAKA.holder->holder==&BIRK)`: **act = 3**, scroll 0, SetCurrentScene(STORASALEN), scroll 0, hide RONJA, PlaySmacker("spring.smk", 0x41fa70, 64, 69). Else: SetCurrentScene(BORGGARDEN), scroll 0, stand(RONJA, 478,341,0, dir 5). |
| FUN_0041fc70 | Constructor of the RONJA object class (only for RONJA, 0x4583e7): ScurrObject ctor, vtable 0x482990, +0x278 = 1.0f (scale). FUN_0041fca0/fcc0 = destructor. |
| **FUN_0041fcd0** (vtable slot 3, "added to the OS") | If the object is attached to an OS (`+0xe4`) whose timer service is active (`OS+0x130`): register a periodic timer `FUN_00457ff0(OS, this, 20, 1)` → id at +0x360, tick count +0x364 = 0. Returns −1 on failure. So the mini-game clock is **20 ms (50 Hz)**. |
| **0x41fd10** (vtable slot 5, timer callback, asm only) | If the timer id == +0x360: +0x364++; then by mode: 1 → FUN_00425200 (river), 2 → 0x42efc0 (tarn cones), 3 → 0x4306c0 (ski), 4 → 0x421f80 (labyrinth), 5 → 0x431720 (snowball), 6 → 0x42c8e0 (cave cones), 7 → 0x426aa0 (river + witch), 8 → 0x429ef0 (dice). Mode 0 does nothing. |
| **FUN_0041fdc0(z)** depth → volume | z<1000: `120 − max(z,0)/25` (120..80); 1000..3000: `88 − (min(z,3000)−1000)/25` (88..8). Used for positional effect volume in the mini-games. |
| **FUN_0041fe30(x,y,w,h,px,py)** | Point-in-rect test, inclusive: `x ≤ px ≤ x+w && y ≤ py ≤ y+h`. |
| **FUN_0041fe70(obj,px,py)** | Scaled hit test: frame rect (+0x22c..0x238) minus anchor (+0x23c/+0x240), times scale +0x278, around (obj.x,obj.y). Returns obj.z (+0xf8) if hit, else 0.0. Used by the cone games to pick a target depth. |
| **FUN_0041ff80(px,py,obj)** | Unscaled frame-rect hit test; false if obj.x < −100.0 (parked objects never hit). Used by the river cursors (§5.2). |
| **FUN_00420030(volAdj, obj)** | Gradvarg hit cry: picks `EFFEKT_14_{1,2,3}_gradvargaj` by `rnd%3`; only if the effect channel DAT_004f1960 is idle; volume = depthVol(obj.z) + volAdj; pan = obj.x·0.2 − 1. Returns 1. |
| 0x420170 | static init of a small struct at 0x4d0630 (fields −1/0, 10, font ptr 0x4c80f0; UNCERTAIN purpose, text-writer state). |
| 0x4201d0..0x4211a3 | **LabyrintList node static initializers**: 36 tiny functions, each writes one 40-byte node (exit indices, flame/pan values, room-gfx suffix "S01A", "A03B", … "S34A"). §5.1 has the decoded node table. Nothing is computed at run time. |

---------------------------------------------------------------------------------------------------

## 5. Minigames

All minigames are methods of the RONJA object (state in RONJA+0x360..0x5e0), selected by the game mode `g8c0`
(1..8). While `g8c0 != 0` the normal scene handlers, ESC menu, inventory and verb coin are disabled, the mode's own
cursor and click handlers are used, and RONJA's SCURR timer calls the mode's tick function every **20 ms of game
time** (dispatcher 0x41fd10; RONJA+0x364 = tick counter):

| mode | game | start | tick | click | cursor | end (flag on success) |
|---|---|---|---|---|---|---|
| 1 | river (De rivier), GLUPAFALLET | 0x424ad0 | 0x425200 | 0x4250f0 | 0x45e190 | 0x425c40 (`g8e1`) |
| 2 | lake (Het meer) cones vs grey dwarves, TJAERNEN | 0x42d4e0 | 0x42efc0 | 0x42e450 | 0x45e090 prickaKotteCursor | 0x430130 (`g8dd`) |
| 3 | skiing on winter.smk | 0x430210 | 0x4306c0 | none | 0x45e060 invisible | 0x430f90 (`g8e0`) |
| 4 | cellar labyrinth, LABYRINT | 0x421240 | 0x421f80 | 0x421d10 | 0x45e310 arrows | 0x422230 (`g8f1`) |
| 5 | snowball fight with the robbers | 0x431010 | 0x431720 | 0x432720 | 0x45e010 prickaRovareCursor | 0x432810 (`g8de`) |
| 6 | cave-entrance defence with Birk, GROTTANUTE | 0x42a440 | 0x42c8e0 | 0x42b380 | 0x45e090 prickaKotteCursor | 0x42d3f0 (`g8df`) |
| 7 | river with the bird witch (act 3, with Birk) | 0x425d10 | 0x426aa0 | 0x426840 | 0x45e250 | 0x427e00 (`g8e2`) |
| 8 | dice "21" with Skalle-Per, BRAEDSPEL | 0x427ed0 | 0x429ef0 | 0x429e10 | 0x45e100 | 0x42a280 (no flag) |

Shared helpers: random `r = FUN_00401510()` = `(rand() + (QPC & 0xffff)) & 0x7fff` (0..32767); positional sound pan
≈ `(objX − scrollX)/5 − 1`, volume `depthVol(z)` = `z<1000 ? 120 − z/25 : 88 − (min(z,3000)−1000)/25` (0x41fdc0);
effects only start when the single sample channel is idle. Several "objects" are reused as props (noted per game).

### 5.1 Cellar labyrinth (mode 4)
#### Entry
The entry is in KAELLARE (scene 0x100a):
* The HAND handler 0x4627d0, region 2 (the shelf, hotspot group 31 "Hylla", ch. 6) dispatches group 31 / HAND with callback LAB_00462460. The first time it also sets gVar **0x4cf8db = 1** (shelf moved, passage open).
* Later, a normal click on region 2 (0x462650) does one of two things:
  * if gVar **0x4cf8f1** (Birk already reached) is set, it uses portal 0x4e65e8 directly ("next times you come straight to him");
  * else, if 0x4cf8db is set, it dispatches group 31 HAND with LAB_00462460 again.
* LAB_00462460 (when the dialog is not interrupted) calls **FUN_00421240 = start labyrinth**.

#### RONJA members
(Member name confirmed by the assert string "RONJA.Labyrinten_GoToScene".)

| offset (abs) | meaning |
|---|---|
| +0x5c8 (0x4e95c0) | active |
| +0x5cc (0x4e95c4) | state: 0 = inside, 1 = leaving to cellar chosen, 2 = Birk exit chosen, 10 = leave now |
| +0x5d0 (0x4e95c8) | current node index |
| +0x5d4 (0x4e95cc) | **Labyrinten_GoToScene** (target node) |
| +0x5d8 (0x4e95d0) | busy (byte, set only during the arrival callback) |
| +0x5dc (0x4e95d4) | flame-direction index for flame placement |

#### Start: FUN_00421240 (ronja.cpp:452–464)
1. active = 0, clear text lines, mode = 4.
2. `SetCurrentScene(&LABYRINT, true, LabyrintList[1]->getFileName())`. Node 1 is "S01A". The engine loads `_17__###_SceneGFXLabyrint`+name+{"",I,Z,R,H} layers.
3. state 0, current 1, goto 0, busy 0.
4. Preload flame tracks on the **BIRK object, which is used as the torch flame** (assert text "BIRK.preloadTrack"): T792 ELD1_17_Gen_rak, T396 ELD1_17_Gen_vast, T790 ELD1_17_Gen_norr, T791 ELD1_17_Gen_ost.
5. Ronja's 8-direction track sets switch to the torch-carrying set:
   * stand: T161/163/165/166/169/171/173/175 `ronja_17_Gen_stop*`
   * walk: T160/162/164/167/168/170/172/174 `ronja_17_Gen_*`
6. Ronja stands at (118,310) dir 5. Flame index = 6, flame placed at Ronja+(29s,-141s).
7. Ronja walks to (138,330) dir 5. Scroll 0.
8. Music `dls_labyrinten_224_` (vol 0x7d). active = 1.

#### Cursor: 0x45e310
Region under the mouse (`FUN_0046d120`):

| region | cursor | handle |
|---|---|---|
| 1 | PEKARE__gen_###_riktadV | S549 |
| 2, 3 | riktadN | S545 |
| 4 | riktadNO | S546 |
| 5 | riktadO | S543 |
| other | normal | S544 |

Hotspot size is 0x34×0x20 for the arrows and 0x20×0x18 for the normal cursor.

#### Click: FUN_00421d10(x,y)
Ignored if not active, busy, or state == 10. Region r = mask at the mouse:
* r not in 1..5: walk to (x, min(y,390)), no callback.
* r in 1..5:
  * goto = node.exits[r-1].
  * If goto == 0, state = 1 (back to the cellar). If goto == 100, state = 2 (Birk).
  * Walk to the exit point with callback LAB_00421ab0:

| r | exit point |
|---|---|
| 1 | (118,317) |
| 2 | (307,268) |
| 3 | (399,269) |
| 4 | (471,291) |
| 5 | (587,346) |

Notes:
* An exit value of -1 would index LabyrintList[-1] (a null pointer) on arrival. The region masks must contain only real exits.
* Clicking again while walking just retargets. Choosing a 0/100 exit and then clicking a normal exit before arrival leaves state at 10 with a normal node, which hangs the game (latent bug; do not replicate).

#### Arrival callback LAB_00421ab0 (asm only, 0x421ab0–0x421cf3)
* If interrupted, return.
* Set busy, and place the flame for Ronja's current direction (+0x298).
* **If state == 0:**
  1. `SetCurrentScene(LABYRINT,true,LabyrintList[goto]->file)` (ronja.cpp:0x23f).
  2. e = 1-based index of the old node in the new node's exit list (FUN_004211e0), 0 if not found.
  3. current = goto, goto = 0.
  4. Ronja appears at the entry exit e and steps in (table below), then the flame is placed.
* **If state is 1 or 2:** current = goto, goto = 0, state = 10.
* Clear busy.

| e | stand at (dir) | then walk to (dir) | flame index |
|---|---|---|---|
| 0 | (332,348) d0 | (332,328) d0 | 3 |
| 1 | (118,317) d5 | (138,337) d5 | 6 |
| 2 | (307,268) d4 | (307,288) d4 | 7 |
| 3 | (399,269) d4 | (399,296) d4 | 7 |
| 4 | (471,291) d3 | (491,311) d3 | 8 (no placement case) |
| 5 | (587,346) d2 | (567,346) d2 | 1 |

#### Per tick: FUN_00421f80
Runs only if active and not busy.

**a) Flame direction (the hint).** Only when the flame object's track has finished (BIRK+0x248 == 0), so it is re-chosen once per flame-animation loop:
1. Find p = which exit rectangle contains **Ronja's own position** (FUN_00421ea0, rects x,y,w,h, inclusive):

| exit | rect (x,y,w,h) |
|---|---|
| 1 | (72,277,136,89) |
| 2 | (243,210,104,96) |
| 3 | (354,225,81,80) |
| 4 | (435,241,96,77) |
| 5 | (478,300,129,65) |

2. If p ≠ 0 and p == node.correctExit (node+0x24; FUN_00421220):
   * p = 1 → T791 `ELD1_17_Gen_ost`
   * p = 2 or 3 → T790 `ELD1_17_Gen_norr`
   * p = 4 or 5 → T396 `ELD1_17_Gen_vast`
3. Otherwise → T792 `ELD1_17_Gen_rak` (flame straight up).

So the flame bends away from the exit (left exit → flame leans east, right exits → flame leans west) only while Ronja walks into, or stands in, the correct passage. Everywhere else it burns straight up.

**b) Flame placement every tick** (FUN_004215b0). The position comes from Ronja's current walk/stop track. s = scale (+0x278), z offset 0 unless stated:

| facing | offset (dx, dy) | z offset |
|---|---|---|
| W (T170/171) | (-42s, -144s) | 0 |
| NW (162/163) | (-32s, -141s) | 0 |
| N (164/165) | (21s, -144s) | 0 |
| NE (160/161) | (29s, -141s) | 0 |
| E (166/167) | (37s, -144s) | 0 |
| SE (172/173) | (23s, -141s) | -110 (flame drawn behind Ronja) |
| S (168/169) | (-22s, -142s) | -110 |
| SW (174/175) | (-41s, -144s) | 0 |

FUN_004218f0(dir) uses the same table indexed 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW. It is also called from the track-event callbacks of every `RONJA_17_GEN_STOP*` track (table 0x4ba3a8/0x4ba5c0 → 0x451bf0…0x451d40), so the flame snaps into place when Ronja stops.

**c) Ambient sounds**, if state == 0 and the effect channel is free. Each tick r = rand. If `r % 300 < 8`, play by `r % 300`:

| r % 300 | sound |
|---|---|
| 0 | EFFEKT_17_1_droppe1 |
| 1 | droppe2 |
| 2 | droppe3 |
| 3 | droppe4 |
| 4 | droppe5 |
| 5 | droppe6 |
| 6 | EFFEKT_17_1_vind2 |
| 7 | droppe3 |

Pan = node+0x18, volume = node+0x1c. That is a probability of 8/300 per tick.

**d) Leaving (state 10).** Stop the effect, stop music, then FUN_00422230(success = current==100):
1. active = 0, music off, mode = 0.
2. Restore the normal track sets:
   * stand T553–560 `RONJA__gen_still*`
   * walk T137–139, 146–150 `Ronja__Gen_Go*`
3. **Success:** gVar **0x4cf8f1 = 1**, Ronja pos (226,244,0), `SetCurrentScene(FANGELSEHALOR)` (Birk's prison).
4. **Back (exit value 0):** `SetCurrentScene(KAELLARE)`, scroll 640, Ronja stands at (828,352) dir 5.

There is no fail state and no timer: you can walk around indefinitely.

#### LabyrintList (0x491b90, 37 entries)
Node struct (0x28 bytes): +0 id, +4..+0x14 exits[5] (index = click region 1..5), +0x18 sound pan, +0x1c sound volume, +0x20 gfx name, +0x24 correct exit (1..5, 0 = none).

Exit values: -1 = no exit, 0 = back to the cellar (KAELLARE), 100 = Birk's prison.

Region meaning: 1 = left/W, 2 = rear-left/N, 3 = rear-right/N, 4 = right-rear/NE, 5 = right/E.

| node | gfx | exits r1..r5 | correct | pan/vol |
|---|---|---|---|---|
| 0 | (dummy "cellar") | – | – | – |
| 1 (start) | S01a | 0, 4, -, 5, 2 | 4 | 105/100 |
| 2 | A03b | -, 1, -, 3, - | – | 55/60 |
| 3 | A01b | 2, -, -, -, - | – | -1/10 |
| 4 | A02a | -, -, -, 1, - | – | 105/60 |
| 5 | A05b | -, 1, 7, -, 6 | 3 | 80/100 |
| 6 | A01b | 5, -, -, -, - | – | 20/60 |
| 7 | A06a | 8, 9, -, 5, - | 2 | 55/100 |
| 8 | A02a | -, -, -, 7, - | – | 105/60 |
| 9 | A09b | 7, 11, 12, 13, 10 | 4 | 105/100 |
| 10 | A01b | 9, -, -, -, - | – | 20/60 |
| 11 | A02a | -, -, -, 9, - | – | 105/60 |
| 12 | A02a | -, -, -, 9, - | – | 105/60 |
| 13 | S13a | 9, -, 17, 15, 14 | 3 | 80/100 |
| 14 | A03b | -, 13, -, 16, - | – | 55/60 |
| 15 | A03b | -, 13, -, 16, - | – | 55/60 |
| 16 | A04a | 15, -, 14, -, - | – | 20/10 |
| 17 | A08a | 20, 18, 19, -, 13 | 1 | 20/100 |
| 18 | A01b | 17, -, -, -, - | – | 20/60 |
| 19 | A01b | 17, -, -, -, - | – | 20/60 |
| 20 | S20b | 23, 24, 25, 21, 17 | 4 | 105/100 |
| 21 | A03b | -, 20, -, 22, - | 4 | 105/100 |
| 22 | A05b | -, 21, 26, -, 29 | 5 | 80/100 |
| 23 | S21b | 27, -, 28, 20, - | – | 105/60 |
| 24 | A02a | -, -, -, 20, - | – | 105/60 |
| 25 | A01b | 20, -, -, -, - | – | 20/60 |
| 26 | A02a | -, -, -, 22, - | – | 105/60 |
| 27 | A02a | -, -, -, 23, - | – | 105/10 |
| 28 | A01b | 23, -, -, -, - | – | 20/10 |
| 29 | A05b | -, 22, 33, -, 30 | 3 | 80/100 |
| 30 | A01b | 29, -, -, -, - | – | 20/60 |
| 31 | A02a | -, -, -, 32, - | – | 105/60 |
| 32 | S34a | 31, 34, 33, **100**, - | 4 | 105/100 |
| 33 | S30b | 32, 35, 36, -, 29 | 1 | 20/100 |
| 34 | A03b | -, 32, -, 35, - | 2 | 55/100 |
| 35 | A04a | 34, -, 33, -, - | 1 | 20/100 |
| 36 | A01b | 33, -, -, -, - | – | 20/60 |

Notes on the graph:
* Many nodes reuse the same picture: A01b = dead end with one exit on the left; A02a = dead end with its exit at region 4. The maze is a graph, not a map.
* `SceneGFXLabyrintA07b` exists in the strings but no node uses it.

**Correct route (12 steps, the flame bends at each one):**
1 –r4→ 5 –r3→ 7 –r2→ 9 –r4→ 13 –r3→ 17 –r1→ 20 –r4→ 21 –r4→ 22 –r5→ 29 –r3→ 33 –r1→ 32 –r4→ **Birk (100)**.
A side loop also has correct-exit hints: 33 –r2→ 35 –r1→ 34 –r2→ 32. Region 1 of node 1 leads back to the cellar.

### 5.2 The river (mode 1, act 1)
#### Entry
GLUPAFALLET click handler 0x466400, region 0x3a (58 = stone 46, the start stone):
* If gVar int **0x4cf8c4** (chapter) == 1, Ronja walks to (182,305, z 2894) and LAB_004660b0 → **FUN_00424ad0**.
* If chapter == 3 and BIRK is following Ronja (BIRK holder == RONJA, or holder's holder == RONJA), it uses LAB_004660d0 → **FUN_00425d10** (section 3) instead.

#### RONJA members

| offset | meaning |
|---|---|
| +0x4e4 | active river 1 |
| +0x4fc (0x4e94f4) | state |
| +0x500 | end counter |
| +0x504 (0x4e94fc) | current stone |
| +0x508 | jump direction |
| +0x50c | scroll direction ±1 |
| +0x510/+0x540/+0x570 | per-frame dx/dy/dz arrays [12] |
| +0x5a0..+0x5ac | raft offsets |
| +0x5b0 | active raft (0 none, 1 = MATTIS obj, 2 = SKALLEPER obj) |
| +0x5b4 | slip / respawn timer |
| +0x5b8 | raft-sinks flag |
| +0x5b9/+0x5b2/+0x5b1 | one-shot sound flags |
| +0x5bc | slip time limit |
| +0x5c0/+0x5c4 | raft objects |

#### Init: FUN_00424ad0 (ronja.cpp:1471–1528)
1. mode = 1. ELD1 plays T1235 `eld1_13_Gen_ForsVatten1` (loop).
2. state = -2, stone = -1, raft = 0, timer = -1, slip limit = 60 (FUN_00424930).
3. Raft offsets (Ronja relative to raft): raft 1 = (+50,-20), raft 2 = (+45,-10).
4. **The two rafts are the MATTIS and SKALLEPER objects** reused as drifting things:
   * raft 1 plays T862 `HINDER_13_gen_Stock` (log)
   * raft 2 plays T863 `HINDER_13_gen_Vass` (reed bundle)
   * both are parked at (-200,475,1675)
5. Music `dls_forsen1_88_` vol 100. active = 1.

#### Cursor 0x45e190 and click 0x4250f0
Only when the state is 0 (on a stone) or 4 (on a raft).

Mask region ≥ 12 ⇒ stone index = region-12 (47 stones). Region < 12 ⇒ check the mouse against the two raft objects' current frame rects (FUN_0041ff80). The cursor is `PEKARE__forsen_###_hilite` (S555) over any stone or raft, else normal (S544).
* State 0 + stone click: FUN_00423a80(current, clicked) – jump only if clicked ∈ current.neighbours.
* State 0 + raft click, if a raft is active and that raft is still x < 864 and not sinking: FUN_004241a0(raft). Allowed only from stones {3,6,11,16,18,21,26}. With d = RonjaX - raftX:
  * 100 < d < 210 → jump SV (T214)
  * -115 < d < 65 → jump SO (T158)
  * then stone = 100, state = 6.
* State 4 (on raft) + stone click: FUN_00424400. Only stones {3,6,11,16,18,21,26,29,43}, with d = RonjaX - stone.x:
  * -110 < d < -40 → jump NO (T211, dir 0)
  * 40 ≤ d < 110 → jump NV (T159, dir 5)
  * then state = 1.

#### Jump: FUN_00423a80(src, dst)
* dir = index of dst in src.nb[6], in order 0 NO, 1 O, 2 SO, 3 SV, 4 V, 5 NV.
* Tracks: `Ronja_13_GEN_StortHopp{NO,O,SO,SV,V,NV}` (T211, T157, T158, T214, T213, T159).
* The track does not move Ronja; the code adds the displacement itself, which lands her exactly on the target:
  * diagonal jumps: (dst - src - trackOffset·k)/7 on track frames 2..8
  * O/V jumps: /8 on frames 1..8
  * k = (scale + perspA/(perspB+dst.z))/2 (scene+0xf0/+0xf4)
  * trackOffset (x,y): NO (70,-43), O (144,0), SO (64,43), SV (-56,43), V (-144,0), NV (-66,-43)
  * the deltas are applied only on frames whose track-frame field +4 ≠ 0
* Effects: state = 1, stone = dst (set immediately). EFFEKT_13_1_LANDA2 plays at frame ≥ 8 (vol = depthVol-25).

#### State machine: FUN_00425200, per tick

| state | behaviour |
|---|---|
| -2 (start) | Put Ronja on stone 46 (182,305,2894) facing SV, then auto-jump 46→2 (state 1). |
| 0 idle on stone | If timer ≥ 0 (slippery stone): timer++. When timer > slipLimit: track T209 `RONJA_13_gen_Halkar` (slip), timer = -2, state = 5, sound EFFEKT_13_1_RAMLA. |
| 1 jumping | Apply the per-frame deltas. At track end: stand on the stone with the direction's still track (FUN_00423fc0: dir 1 stillOst T557, 2 stillSO T555, 3 stillSV T556, 4 stillVast T558, 5 stillNV T554, 0 = keep). Timer = 0 if stone.type == 1 (**slippery**) else -1. Scroll check (below) → state 2 or 0. If the stone is 28 (far bank), 44, 45 or 46 (north/start bank), state = 10. |
| 2 scroll | Scroll = RonjaX - 320, then state 0. |
| 4 on raft | Ronja rides the raft (see rafts). |
| 5 fallen | Splash `EFFEKT_13_1_PLASK` at Halkar frames 10..13. At track end: hide Ronja and respawn at a checkpoint: RonjaX ≤ 527 → stone 0 (74,353); ≤ 1385 → stone 10 (527,386); else stone 24 (1385,394). Timer = 100 and counts to 200 (100 ticks invisible; at 150, scroll to her). At 200: T210 `RONJA_13_gen_UppUrFors` (climb out) + `effekt_13_1_uppurvattnet`, timer = -3. When that ends: stand SO, state 0. **No limit on falls.** |
| 6 jumping onto raft | Like state 1, with sound LANDA1. At end: state 4, Ronja track T1117 `ronja_13_gen_PaHinderSO` (loop). With `r%6+1 < 3` (probability 1/3) the raft is flagged to sink. |
| 10 end | Fade music to 0 over 2000 ms. Once faded, counter++ each tick. If an active raft is off-screen (x > scroll+640) it is cleared, otherwise it is flagged to sink. When no raft is active and counter > 80: if stone ≠ 28, reset rafts and scroll 0. Then FUN_00425c40(stone == 28). |

**Scroll check (FUN_004246b0).** With d = RonjaX - scrollX:
* d > 500 and scroll < 1280 → scroll +1, slip limit 140
* d < 140 and scroll > 0 → scroll -1, slip limit 140
* otherwise slip limit **60** ticks

**Rafts** (same code in both rivers):
* Spawning: while there is no raft and the state ∈ {1,4,6} (Ronja mid-jump), each tick `r%50+1 < 3` ⇒ raft = `r%50+1`, i.e. 1/50 chance each for raft 1 or raft 2.
* An active raft drifts with velocity (1,0,0) per tick from x = -200, y = 475. If Ronja is on it (state 4) she is placed at raft + offset, and the view follows with scroll = X - 141 while 140 < X < 1780.
* When raft.x ≥ **864** (river 1; **1658** in river 2) or the sink flag is set, the raft sinks with velocity (0,0.2,0).
  * If Ronja is on it she sinks too; at RonjaY > 478 she falls in (Halkar, state 5, RAMLA).
  * When raft.y > 510 both rafts reset to (-200,475,1675) and the flag clears.

So the log and the reeds behave identically: either one may sink at once (1/3 chance on landing) or carry Ronja right until x = 864 (river 1) / 1658 (river 2). The manual's "two kinds" is therefore only cosmetic in code (UNCERTAIN only in that the art differs).

**Exit (FUN_00425c40(win)).**
* Always: inactive, music off, fade back to 127 over 500 ms, mode = 0, music `dls_forsenBrus_30_100vol` vol 100.
* **Win** (stone 28): gVar **0x4cf8e1 = 1**, `FUN_0045e460(portal 0x4ea270)` = Ronja leaves through GLUPAFALLET's region-3 exit.
* **Not win** (jumped back to the bank, stones 44/45/46): restart the water animation T1235; Ronja stays on the bank in normal mode and can click the start stone again.

#### River stone table (StenList 0x491c28, 47 stones, 0x30 bytes)
Struct: +0 id, +4..+0x18 nb[6] (NO,O,SO,SV,V,NV), +0x1c/+0x20/+0x24 x,y,z, +0x28 slippery.

| stone | nb (NO,O,SO,SV,V,NV) | x, y, z | slippery |
|---|---|---|---|
| 0 | 2,4,1,-,-,- | 74,353,2184 | |
| 1 | 4,-,3,-,-,0 | 127,381,1985 | S |
| 2 | 46,-,4,0,-,- | 144,318,2681 | S |
| 3 | -,6,-,-,-,1 | 179,421,1699 | |
| 4 | -,5,-,1,0,2 | 207,353,2241 | S |
| 5 | 7,-,8,-,4,- | 317,356,2234 | S |
| 6 | 8,-,-,-,3,- | 330,426,1742 | S |
| 7 | 45,9,-,5,-,- | 362,328,2554 | |
| 8 | -,10,-,6,-,5 | 391,390,1990 | |
| 9 | -,-,10,-,7,- | 448,338,2488 | S |
| 10 | 12,13,11,-,8,9 | 527,386,2097 | |
| 11 | 13,-,-,-,-,10 | 574,434,1751 | S |
| 12 | -,-,13,10,-,- | 580,366,2263 | S |
| 13 | 14,15,-,11,10,12 | 653,390,2043 | |
| 14 | -,-,15,13,-,44 | 709,351,2444 | |
| 15 | 38,17,16,-,13,14 | 774,385,2081 | S |
| 16 | 17,18,-,-,-,15 | 833,427,1800 | S |
| 17 | 39,-,18,16,15,38 | 895,395,2071 | S |
| 18 | -,-,-,-,16,17 | 973,430,1770 | |
| 19 | -,-,20,-,39,- | 1071,358,2448 | |
| 20 | -,22,21,-,-,19 | 1137,389,2113 | |
| 21 | 22,-,-,-,-,20 | 1204,427,1811 | S |
| 22 | 23,24,-,21,20,- | 1277,391,2018 | |
| 23 | 42,-,24,22,-,41 | 1329,364,2366 | S |
| 24 | 25,-,26,-,22,23 | 1385,394,2079 | |
| 25 | -,27,-,24,-,42 | 1440,360,2410 | S |
| 26 | -,29,-,-,-,24 | 1467,424,1801 | S |
| 27 | -,-,-,-,25,- | 1539,358,2436 | |
| **28 goal** | -,30,-,-,-,- | 1558,309,3182 | |
| 29 | 31,35,-,-,26,- | 1600,427,1748 | |
| 30 | -,34,32,-,28,- | 1638,309,3187 | |
| 31 | 33,-,35,29,-,- | 1671,396,2042 | |
| 32 | 34,36,33,-,-,30 | 1686,332,2774 | S |
| 33 | 36,-,-,31,-,32 | 1732,353,2474 | S |
| 34 | -,-,36,32,30,- | 1730,304,3258 | |
| 35 | -,43,-,-,29,31 | 1748,438,1768 | |
| 36 | -,-,-,33,32,34 | 1780,327,2849 | S |
| 37 | -,-,-,43,-,- | 1869,392,2093 | |
| 38 | -,-,17,15,-,- | 831,362,2411 | |
| 39 | -,19,-,17,-,- | 956,361,2437 | |
| 40 | -,41,-,-,-,- | 1191,336,2702 | |
| 41 | -,-,23,-,40,- | 1292,335,2694 | |
| 42 | -,-,25,23,-,- | 1386,334,2755 | |
| 43 | 37,-,-,-,35,- | 1844,445,1697 | |
| 44 bank | none | 632,306,2754 | |
| 45 bank | none | 409,318,2785 | |
| 46 start bank | -,-,-,2,-,- | 182,305,2894 | |

* Edges 7→45 and 14→44 are one-way: they lead onto the north bank and end the game without a win.
* Shortest route: 46→2→4→5→8→10→13→15→17→39→19→20→22→24→26→29→31→33→32→30→**28**. Every stone is reachable without a raft.

### 5.3 The river with the bird witch (mode 7, act 3)
#### Init: FUN_00425d10 (ronja.cpp:1949–2030)
Same as river 1, with these differences:
* mode = 7, active flag +0x4e5.
* state = **-4**.
* Bird-witch fields: +0x4e8 witch state = 0, +0x4ec knock-down count = 0, +0x4f0 dive-armed = 0, +0x4f4 witch lane z = -1.0, +0x4f8 = 1 (branch prop off).
* Ronja is placed on stone 46 facing SV with **no** auto-jump.
* Preloads:
  * witch: VILDVITTRA T1084 `_gen_FallVittra`, T1010 `_gen_O`, T1011 `_gen_DykO`
  * attacker: LOVIS T1085 `VILDVITTRA_13_Gen_AttackO` (the LOVIS object is the second, attacking witch)
  * Ronja: T1086 `ronja_13_Gen_VittranFangarO`, T580 `RONJA_13_Gen_FangadAvVittraV`, T1083 `RONJA_13_gen_FallVittra`, T581 `DuckaVittraV` (preloaded, unused here)
  * Birk: T537 `Birk_13_Gen_StortHoppSO`
* Music `dls_forsen3_113_5_`.
* Click handler 0x426840 and cursor 0x45e250 are identical to river 1, but the raft-sink limit is 1658.

#### Intro states

| state | behaviour |
|---|---|
| -4 | BIRK walks to (408,312) with callback **LAB_00426a80**; state -3. |
| -3 | Wait. LAB_00426a80 (asm only) sets state -2 when not interrupted. |
| -2 | BIRK plays T1233 `Birk_13_gen_flyrVittra`; state -1. |
| -1 | When Birk's track ends: Birk stands at (1613,274) dir 3 (waits on the far bank); state 0. |

The callback table entry `BIRK_13_GEN_FLYRVITTRA` (0x451e50) handles markers of that track:
* sound marker 0x17 → `EFFEKT_13_1_plask` (pan 110, vol 110)
* marker 0x1d → hide HINDER
* track end → +0x4f8 = 0

FUN_00426a00 runs every tick while +0x4f8 == 0. If HINDER has no track: place it at (0,365,0) and play T861 `HINDER_13_gen_Gren` (a floating branch). Once HINDER.x ≥ 440: play T1234 `HINDER_13_gen_FlyrVittra` and set +0x4f8 = 1. This is decoration.

States 0, 1, 2, 5, 6 and the rafts work as in river 1. Additions:
* While jumping (states 1 and 6), dive-armed (+0x4f0) is cleared every tick.
* After climbing out (state 5 → stand): state = (knocks < 3) ? 0 : **3** (frozen).

#### Bird witch (VILDVITTRA object 0x4ee270), per tick, state +0x4e8
* **0:** becomes 1 as soon as the river state ∈ {0,1,4,6}.
* **1 (patrol):**
  1. If there is no lane yet, FUN_004265e0(0) picks a lane from Ronja's current stone and places the witch off-screen left:
  2. If the witch has no track, play T1010 `VILDVITTRA_13_gen_O` (the track flies her east).
  3. While her screen x is in (-100,100), FUN_004249b0 has chance `r%6+1 < 3` (1/3) per call to laugh `VILDVITTRA_13_333A1SAY1_HOHOLILL…` (vol 106, pan follows her).
  4. When x > scroll+1100, or scroll == 1280 and x > 2000 and the channel is free: hide her, lane = -1, state 0 (a new pass starts).
  5. **Dive test** FUN_004265e0(1) → FUN_004265a0: the witch is in Ronja's current lane and 100 < RonjaX - witchX < 120 (< 180 when Ronja is on stone 4). If true: armed = 1, state 2, T1011 `VILDVITTRA_13_gen_DykO`, sound `EFFEKT_13_1_VILDVITTRASKRIK` (vol 110).

Lane table:

| lane | stones | lane z | spawn (x, y) |
|---|---|---|---|
| A (front row) | 3,6,11,16,18,21,26,29,35,43 | 1759 | (scroll-250, 200) |
| B (middle) | 0,8,10,13,15,17,20,22,24,31,37 | 2056 | (scroll-250, 190) |
| C (back) | 2,7,9,14,19,23,25,27,33,38,39 | 2370 | (scroll-250, 170) |
| D (any other stone, or the raft) | – | 1639 | (scroll-150, 215) |

Lane D only dives while Ronja is on a raft (state 4).

* **2 (diving):** if the witch's frame is 7..12, the river state ∈ {0,4} (standing on a stone or raft) and armed == 1, Ronja is knocked into the water (T209 Halkar, state 5, RAMLA) and **knocks++**. When the dive track ends: state 1. **Jumping during the dive avoids the hit.**
* **On the 3rd knock**, when Ronja climbs out (timer 200), LOVIS plays T1085 `VILDVITTRA_13_Gen_AttackO` at respawnStone + offset (offsets below) and the witch state becomes 3.

| respawn stone | offset (x, y) |
|---|---|
| 0 | (-198, -510) |
| 10 | (-200, -523) |
| 24 | (-208, -517) |

* **3:** T1010 keeps flying; the witch is hidden when off-screen. When LOVIS's track ends: state 4, Ronja T1086 `VittranFangarO` (the witch grabs her), hide LOVIS.
* **4:** say `VILDVITTRA_13_317A1SAY2_BLODETFL…` (pan 64, vol 106). When Ronja's track ends: scroll 0, Ronja T580 `FangadAvVittraV`; state 5.
* **5:** when that ends: Ronja T1083 `RONJA_13_gen_FallVittra` + witch T1084 `VILDVITTRA_13_gen_FallVittra`; state 6.
* **6:** when both end: hide the witch; river state = 10.

#### End (state 10)
1. Fade music over 2000 ms. If the witch is idle and (stone == 28 or the witch state ≠ 6), she flies off (T1010).
2. When the fade is done: stop the effect, counter++.
3. When there is no raft, counter > 25, the witch is gone (FUN_00426950 hides her) and +0x4f8 ≠ 0:
   * If stone ≠ 28: reset rafts, hide the witch, scroll 0, Birk stands at (405,134) dir 4 and walks to (308,226) (callback FUN_00403110); state 11.
   * Then FUN_00427e00(stone == 28).
4. FUN_00427e00 works like FUN_00425c40. **Win:** gVar **0x4cf8e2 = 1** and Ronja leaves via portal 0x4ea270. **Lose** (bank reached, or carried off by the witch after 3 knocks): water animation restarts and Ronja stays in the scene.

### 5.4 Dice game "21" with Skalle-Per (mode 8)
#### Launch
FUN_00427ed0 is entered from three places:
* dialog-done callback 0x45c040: last event 0xe8 `_6_124B3_moteSkallePer` or 0xee `_6_125B3_moteSkallePer` (Ronja's choice "SpelaTarning"); sets gVar 0x4cf8f0 = 1, after first clearing 0x4cf8f0 and 0x4cf8f2;
* 0x45fc70: last event 0x5d (93) `_1c_039A2_talaSkallePer` ("SpelaTarning");
* 0x45ec80 → 0x45f028: events 25/28 `_1a_013A2/B1_taSkallePer`, 630/633 `_1a_518…`, 639/641 `_1a_522…`.

#### Init: FUN_00427ed0 (ronja.cpp:2744–2845)
1. Clear text, mode = 8, `SetCurrentScene(0)` (UNCERTAIN: the dice table is shown without a scene, probably the BRAEDSPEL view set by the caller). Scroll 0.
2. State (+0x4bc) = -2, rank (+0x4c4) = 0, sub (+0x4c8) = 0, timer (+0x4cc) = 0.
3. Dice objects ("Tarning[i]"): [0] = DJUR1 (Ronja die A), [1] = DJUR2 (Ronja die B), [2] = DJUR3 (Skalle-Per die A), [3] = GRADVARG (Skalle-Per die B).
4. Score marker = **BIRK object**, hidden (FUN_00429060(0)).
5. Preloads:
   * Ronja: T732 `ronja_18_gen_tittar`, T734/T821/T987 `skakarA/B/C`, T736 `320A1Say1_HogstVinner`, T738
   * Skalle-Per: T730/T833/T988 `skakarA/B/C`, T761/762/739/740/741
   * dice faces T806–T845; scores T1211–T1231
6. Music `dls_spelaTarning_150_` vol 80. Ronja plays T732. Wall torches ELD1 T1204 / ELD2 T1205 `_18_gen_veggfackla`.
7. active (+0x4b8) = 1.

#### Flow (per tick FUN_00429ef0)

| state | behaviour |
|---|---|
| -2 | DoDialogAni(508 `_18_320A1_TarningsSpel`: Ronja "Högst vinner", Skalle-Per "Just så") with callback **LAB_00428fc0** (asm only: sets state 0 when not interrupted). State -1 while it plays. |
| 0 | Wait for a click on **Ronja's cup**: rect x 330..445, y 240..360. The cursor there is `PEKARE__forsen_###_hilite` (0x45e100). On click (0x429e10): put Skalle-Per's cup back (FUN_00428f30), Ronja T734 `skakarA`, sound `EFFEKT_18_1_tarningarskak` pan 95 vol 100; state 1. |
| 1 Ronja's roll | When skakarA ends: **roll** (below) against the previous rank, show `TARNING_18_gen_RonjasA<d1>` / `RonjasB<d2>`, Ronja T821 `skakarB` (lift cup). Then sub 2: from tick 11 the score marker shows the rank. After 100 ticks: evaluate (FUN_00429dc0, isRonja = 1). |
| 2 Skalle-Per's roll | Same with `SkpsA/B`, T833. Evaluated after 25 ticks (isRonja = 0). Before this state starts, Ronja's cup goes back (T987 `skakarC`; its sound marker 2 hides Ronja's dice via callback `RONJA_18_GEN_SKAKARC` → 0x428eb0), and Skalle-Per plays T730 `skakarA` + shake sound (pan 34). |
| 3 | Hide the marker, rank = 0, state 0 (new game). |
| 5 → 6 → 7 → 8 | Fade music over 1500 ms, wait 51 ticks, then FUN_0042a280: mode 0, `SetCurrentScene(SKALLEPERSRUM)`, Ronja stands at (320,300) dir 5. |
| 10 | Waiting for the result dialog. |

**Roll.** FUN_00429c70: d1 = `r%6+1`, d2 = `r%6+1` (two calls). value = 10·max + min.

**Rank.** FUN_00429cc0: position in the ranking table, from rank 1 to rank 21:
`31,32,41,42,43,51,52,53,54,61,62,63,64,65,11,22,33,44,55,66,21`
(so 21 is rank 21, i.e. a 2 and a 1).

The roll **counts only if rank > previous rank** (the opponent's last rank; 0 at the start). Otherwise its rank is 0.

**Evaluation.** FUN_00429dc0(rank, isRonja):
* rank 0 → the roller loses.
* rank 21 → the roller wins immediately.
* otherwise the turn passes (Ronja → state 2, Skalle-Per → state 0).

Skalle-Per has no AI and no choices: he simply rolls.

**Ronja wins** (Skalle-Per fails to beat her, or Ronja rolls 21): FUN_00428fe0(0) resets the cups and hides Ronja's dice, then plays event **511 `_18_120A1_TarningsSpel`** (Skp "Nå nu får det…"). Choices:
* 158 "Lieve Kale Per. De volgende keer gooi jij zeker 21!" → 512 (Skp "Tja jag får…"). The voice end triggers callback 0x451e20 → FUN_00428fa0 → state 3 = **play again**.
* 159 "Ja, nu moet ik gaan." → 513 (Skp "Gör så du"). Its end triggers callback 0x451df0 → FUN_00428fb0 → state 5 = **leave**.

**Ronja loses** (she fails to beat him, or he rolls 21): FUN_00428fe0(1), then event **509 `_18_321A1_TarningsSpel`** (Skp "Ska vi spela…"). Choices:
* 156 "Ja, nu zal je iemand zien die 21 kan gooien!" → callback `RONJA_18_321A1ALT1_JANUSKADU` → state 3 (play again).
* 157 "Nee, nu moet ik gaan." → 510 "Gör så du" → state 5 (leave).

No gVar flag is set by the result.
Display details: the lit score engraving is the BIRK object playing `TARNING_18_gen_poang<value>` (S `Poang_18_gen_###_NN`);
Ronja's dice show for 100 ticks (2.0 s) before evaluation, Skalle-Per's for 25 ticks (0.5 s); the shake sound
`EFFEKT_18_1_tarningarskak` uses pan 95 (Ronja) / 34 (Skalle-Per), volume 100.

### 5.5 The lake: pine cones against the grey dwarves (mode 2)
Entry: TJAERNEN scene click handler (0x46771a): if gVar `0x4cf8dd` (Tjärnen won) → Dispatch(group 35 `taVitmossa`, HAND)
(you can now take the white moss); else **FUN_0042d4e0** init (L43822): +0x444 active=0, clear text lines, mode 2,
stop music, gradvarg state[0..9](+0x410..) = 0, active count +0x408=0, hits +0x40c=0, vittra state +0x454/+0x458=0,
phase +0x448 = **0x14**. gradvarg[0..9] (+0x3e0..) = DJUR1, DJUR2, DJUR3, GRADVARG, STURKAS, TJEGGE, LABAS, SKALLEPER,
LILLKLIPPEN, FJOSOK (object reuse). Projectile = KOTTE (anchor 16,16; hidden).

Per-slot tracks (walk / fall / stamp / roll): 0 `gradvarg_14_1_NO`/`gradvarg_14_1_FallNO`/`LOVIS__Gen_stampNO`/`gradvarg_14_1_RullNO`;
1 `14_2_NO`(same NO set); 2 `14_1_NV` (NV set); 3 `14_2_NV`; 4 `14_1_O` (FallO/StampO/RullO); 5 `Gradvarg_14_2_SO` (SO set);
6 `Gradvarg_14_3_SO` (**slot 6 never spawns**: FUN_0042e910 returns at once); 7 `Gradvarg_14_1_Sv` (SV set); 8 `Gradvarg_14_3_Sv`; 9 `gradvarg_14_1_V` (V set).

**Phases (+0x448)**, tick FUN_0042efc0 (L45138):
* 0x14: effect `gradvargarna_14_319a1say1_gradvargaralla` (pan 0x40, vol 100) → 0x15.
* 0x15: wait 101 ticks (~2 s), music `dls_tjarnen_155_105vol` vol 0x69, Ronja walkTo(256,344) cb LAB_0042ef50 →
  on arrival RONJA T:`RONJA_14_gen_klattrar` (climb onto rock), phase 0x16 → when Ronja idle: phase 0, T:`RONJA_14_gen_StillaKastSO`.
* 0 = playing; each tick:
  1. **Gradvarg AI** FUN_0042e910(slot, walk, fall, stamp, roll): state 0 & no track & phase≤0 & hits≤20:
     spawn with P = 80/32768 (rnd<0x50) per tick if active ≤4 (max 5 at once) → state 1, walk track, active++.
     1 & track ended → 2 (arrived at the rock), stamp track looping forever. 3 (hit) → 4, fall track. 4 & track ended →
     0, active--, roll track ×8 loops (flags 0x81) — slot respawns only after the roll finishes.
  2. **Vildvittra** FUN_0042ead0: +0x458 counts ticks; when >200 (4 s) and rnd<300 (0.92 %/tick): +0x454=1 and
     VILDVITTRA plays k=rnd/0x1999: 0 `VILDVITTRA_14_1_FlygaV`, 1 `14_3_FlygaV`, 2 `14_2_FlygaS`, 3 `14_2_FlygaV`, 4/5 `14_2_flygaO`;
     when that track ends: hide, counters 0.
  3. **Aim posture** FUN_0042ed90 (only if Ronja idle/still-throw and no cone flying): quadrant +0x450:
     mouse x<321: y≥281 → 1 `RONJA_14_gen_StillaKastSV`, else 2 `StillaKastNV`; x≥321: y≥281 → 4 `StillaKastSO`, else 3 `StillakastNO`.
  4. **Ducking**: if VILDVITTRA.x in (280,360) and +0x450≥1: effect `EFFEKT_14_1_ronjaduckar`, RONJA T:`RONJA_14_Gen_DuckaVittraV`
     (quadrant 1,2) or `DuckaVittraO` (3,4), +0x450=0 (a pending throw is lost; clicks ignored while ducking).
  5. **Cone** (+0x44c: 0 ready, 1 flying, 2 landed): when Ronja's track frame is 7..13 and cone 0: cone 1, effect
     `EFFEKT_14_1_SlangBoll`, KOTTE placed per quadrant: 4 (374,198,1192) T:`Kotte__Gen_kastkotteO`; 3 (366,192,1192) kastkotteO;
     2 (270,188,1192) kastkotteV; 1 (260,198,1192) kastkotteV. Flying: vy += 0.1962/tick (gravity), moveBy(vx,vy,vz).
     Lands if background depth at the new pixel lies in [z_new, z_old+128), or the z-buffer there < z, or it leaves 0..640×0..480:
     effect `EFFEKT_14_2_ground`, hide, park (−30,0,8300), cone 2. Otherwise hit test against every gradvarg with |z−cone.z|<100
     via pixel hit test → cone 2, random "aj" effect (FUN_00420030, 1 of 3), **hits++**, that gradvarg state 3. Cone returns to 0 when Ronja's track ends.
  6. **Lose**: 2 × (number of gradvargar in state 2) ≥ 8, i.e. **4 gradvargar standing at the rock at once** (manual says 3):
     hide cone, phase 1, DoDialogAni(0x1fa `_14_318A1_RonjasHjalpSkrik`: RONJA "RonjasSkrackSkrik","MattisMattis",
     MATTIS "ForsvinnGradvargar","NuVetDu"; cb LAB_0042ef20 → phase 9 when not aborted).
     Sound-end callback `MATTIS_14_318A1Say1_ForsvinnGradvargar` → FUN_0042ef40: every active gradvarg → state 3 (fall), phase 2.
* **Click** FUN_0042e450(x,y) (L44581): ignored unless active, phase≤0, cone not flying, Ronja idle/still-throw.
  y = max(y,190); if y>250 and 280<x<394 → x snapped to 280 (x<320) or 394 (x>320) (can't target the own rock).
  Target depth d = z of a gradvarg whose sprite rect contains the click (last match), else background depth; clamp to 3000.
  Near/far hysteresis at d=1250: d>1250 → 4→3, 1→2; d<1250 → 3→4, 2→1. Origin O (screen x,y, depth 1192) per quadrant:
  4 (374,198), 3 (366,192), 2 (270,188), 1 (260,198). s = d / focal; D = ((x−Ox)s, (y−Oy)s, d−1192); L=|D|;
  T = L·0.0015625·50 = **L/12.8 ticks**; v = D/T, then vy −= L/300. Ronja throw track: 4 `ronja_14_gen_KastSO`, 3 `kastNO`, 1 `KastSV`, 2 `kastNV`.
* 1..3 (lose/Mattis): gradvarg AI keeps running (falls); witch that is flying switches once to `VILDVITTRA_14_1_flyktO`
  (if it was flygaO) or `flyktV`, 4 loops, then hidden. Phase 1: music fade to 0 over 10 000 ms → 2; 2: when silent stop music → 3 (wait for dialog cb).
* **Win**: FUN_0042e8d0(20): hits > 20 (**21 direct hits**), no gradvarg active, phase≤0 → phase 4. Phase 4: wait 16 ticks, then until no
  gradvarg/witch is animating on screen (±50 px margin); fade music 1000 ms; then **gVar 0x4cf8dd = 1**, stop music, phase 9.
* 9: RONJA T:`RONJA_14_gen_klattrarNer` → 10: when done: Ronja setPos (256,344,0) T:`RONJA__gen_stillSO`, hide KOTTE,
  FUN_00430130: stop effects, mode 0, master vol 127/500 ms, `SetCurrentScene(&TJAERNEN)`, ambient music `dls_tjarnensyrsor_40_70vol` vol 70.
  Lose = same exit without the flag (replay by clicking the rock again).

### 5.6 Cave-entrance defence with Birk (mode 6)
Entry (0x468076, GROTTANUTE region handler): if gVar `0x4cf8df` (cave defended) → use portal 0x4edb20 (enter cave);
else RONJA walkTo(344,368,978), BIRK walkTo(274,368,0), **FUN_0042a440** init (L41908): mode 6, stop music, gradvarg states 0,
+0x370=0, counter +0x374=0, phase +0x464 = **0x14**, all counters 0. gradvarg[0..9] = same 10 objects as Tjärnen.
**KotteGrott[0] = SNOBOLL (Birk's cone), KotteGrott[1] = KOTTE (Ronja's cone)** (+0x4a4/+0x4a8, anchor 16,16).
**KotteRamlar[0..2] = MATTIS, LOVIS, VILDVITTRA** (+0x4ac..; falling-cone sprites, T:`Kotte_15_Gen_kotteFall`, parked x=−150).
The bird-witch at the tree = **RUMPNISSE** object (T:`RUMPNISSE_15_gen_goO/goV/goBackO/trillar`).
Slot tracks: 0 `Gradvarg_15_1_NO`,1 `15_2_NO`,2 `15_3_NO`,3 `15_4_NO` (NO fall/roll/`LOVIS__Gen_stampNO`), 4 `15_1_NV`,
5 `15_1_O`, 6 `gradvarg_15_1_SO`, 7 `gradvarg_15_2_SO`, 8 `gradvarg_15_1_SV`, 9 `Gradvarg_15_1_V` (**slot 9 never spawns**).

**Phases (+0x464)**, tick FUN_0042c8e0 (L43390):
* 0x14: effect `gradvargarna_14_319a1say1_gradvargaralla` → 0x15: 51 ticks, music `dls_grottan_105_` vol 100 → 0x16: when Ronja and Birk idle → 0.
* 0 = playing, each tick: witch FUN_0042c3a0; KotteRamlar FUN_0042ba60(0..2); gradvarg AI FUN_0042b8a0 for 10 slots
  (identical to Tjärnen except: spawn allowed while hits ≤22 and active ≤8 → **max 9**; roll ×10 loops, flags 0xa1);
  aim postures; cone flight FUN_0042bb90(0) and (1); every 11 ticks (220 ms) lose check.
* **Aim postures**: mouse x<310 → Birk (if Birk idle/still and Birk cone ready): y>280 → +0x49c=0 `BIRK_15_gen_StillaKastSV`;
  y≤280 outside the sky zone → +0x49c=1 `StillaKastNV`; sky zone (181≤x, y≤65) → SV. x≥310 → Ronja: y>280 or sky zone (x<450,y<66) →
  +0x450=0 `RONJA_15_gen_StillaKastSO`; else +0x450=1 `StillaKastNO`.
* **Click** FUN_0042b380(x,y) (L42624): only phase ≤0; thrower = **Ronja if x>309 else Birk**; ignored if that thrower's cone flies or
  the thrower is not idle/still. x in 276..308 → 275; 309..342 → 343. Sky zone (181≤x≤449 and y≤65): y=56, d=816, speed divisor 640.
  Else d = z of the gradvarg under the click or background depth; if y<230 and d<1100 → 1100; divisor 512; clamp to 3000.
  Near/far hysteresis at 1100. Origins: Ronja near (386,286,974) / far (370,292,974); Birk near (250,298,989) / far (255,298,989).
  T = 50·L/divisor ticks; v = D/T; vy −= L/150. Tracks `ronja_15_gen_kastSO`/`kastNO`, `Birk_15_Gen_KastSV`/`BIRK_15_Gen_KastNV`.
* **Cone** per thrower (+0x480 Birk, +0x484 Ronja; 0/1/2 as in Tjärnen): released at thrower frame 7..13 at the origin above with
  T:`Kotte__Gen_kastkotteV` (Birk) / `kastkotteO` (Ronja). Flight/landing identical (gravity 0.1962, `EFFEKT_14_2_ground`, park (−30,0,8300); after a hit (−30,−30,8300)).
  Extra **witch hit**: if witch phase <1 and |dz|<100, |dx|<60, |dy|<45 to RUMPNISSE → effect `EFFEKT_14_2_gradvargaj`, witch phase 1, cone parked.
  Gradvarg hit: as Tjärnen (hits++ only for direct hits).
* **Witch** FUN_0042c3a0 (+0x488 phase, +0x48c counter): 0/−1 idle: drift `moveBy(x,−150,z)` while y>0 (UNCERTAIN: literal args),
  after 101 ticks alternately T:`RUMPNISSE_15_gen_goV` (→phase −1) / `goO` (→0) — it swings to and fro before the tree.
  Hit (1): if it was flying → T:`RUMPNISSE_15_gen_trillar` (falls). While trillar plays: for each gradvarg in state 2 a falling cone is
  queued, plus one of three random triples (rnd/0x2aab): KotteRamlar slot k starts only if idle and witch frame > k+4,
  using `FUN_0042a300(k,x,y,z,target)` with preset (x,y,z,target slot+1): (220,120,970,1) (225,130,950,2) (215,135,970,3) (210,145,1100,4)
  (360,135,870,5) (225,125,1200,6) (240,140,1180,8) (380,140,1080,9); random sets {(215,135,970,3),(225,125,1200,6),(380,140,1080,9)},
  {(225,130,950,2),(210,145,1100,4),(360,135,870,5)}, {(220,120,970,1),(240,140,1180,8),(250,150,880,3)}.
  FUN_0042ba60: when a falling cone's frame >16 and its target is still in state 2 → effect `EFFEKT_14_1_gradvargaj`, target state 3 (falls; **not counted as a hit**).
  After trillar: wait 51 ticks, T:`RUMPNISSE_15_gen_goBackO` ×7 loops, phase 2; hide when x>480; phase 0 again when the track ends (it comes back).
  Returns 1 ("witch out of the way") when hidden/finished.
* **Lose**: ≥5 gradvargar in state 2 (checked every 11 ticks) while both throwers are idle/still → phase 1, BIRK T:`birk_15_gen_Flyr`,
  RONJA T:`RONJA_15_gen_flyr`; music fade 500 ms; when both idle, music silent and witch gone: FUN_0042d3f0(false):
  mode 0, `SetCurrentScene(&GLAENTAN)`, Ronja (275,317) dir 4, Birk (227,319) dir 5. (Manual: "three"; code: five.)
* **Win**: hits > 22 (**23 direct hits**) and no gradvarg active → phase 2: both set to still postures; when witch gone, music
  fade 500 ms; then **gVar 0x4cf8df = 1**, FUN_0042d3f0(true): `SetCurrentScene(&GROTTANUTE)`, Ronja (337,353) dir 5, Birk (283,352) dir 3.

### 5.7 Skiing (mode 3)
Entry: dialog-end callbacks 0x45fc8c / 0x4631b0: when season gVar `0x4cf8c4`==2 and flags `0x4cf8d5`,`0x4cf8d6`,`0x4cf8d7` are set →
**FUN_00430210** (L45728): `SetCurrentScene(&BORGGARDEN,true)`, mode 3, left/right limits +0x3b0=118, +0x3b4=510, max speed
+0x3b8=10.0, divisor +0x3bc=10.0, state +0x3c0=−3; preload RONJA `ronja__gen_slalomfall`, `Ronja__gen_slalomN/NNO/NNV/NO/NV`;
Ronja put off-screen (1300,1300,3000) and hidden; **PlaySmackerFile("winter.smk", SkidSpel_CBBirkSaveRonjaSMKEnded=LAB_004301b0, 0, 84)**.
The whole slope is the **winter.smk video**; Ronja is a sprite over it. `FUN_00419fa0()` = current video frame,
`FUN_00419fd0(f)` = seek, `FUN_00419fc0(1/0)` = pause/resume video (DAT_004cf650).

Tick FUN_004306c0 (L45963), state +0x3c0, counter +0x3c8, fall counter +0x3cc:
* −3: 10 ticks → −2. −2: wait until video frame ≥ **662**; Ronja at (320,360,800), T:`Ronja__gen_slalomN` loop, pause, seek **663**, → −1.
* −1: tick 10 music `dls_skidspelet_150_` vol 125; tick 21 resume video, state 1.
* 1 skiing: steering towards mouse x (RONJA+0x368) — FUN_004305d0: if |mouseX − x| ≤ 2 → x = mouseX, dir 0. Moving right:
  v = (min(mouseX, 510) − x)/10; if v ≤ 10 dir +1 (T:`slalomNNO`) else v=10, dir +2 (T:`slalomNO`). Left: v = (x − max(mouseX,118))/10;
  ≤10 → dir −1 (`slalomNNV`), else −10, dir −2 (`slalomNV`); dir 0 → `slalomN`. So speed = distance/10 px per tick, max 10 px/tick (500 px/s).
  Every 11 ticks the pan of a playing effect follows Ronja x (FUN_0047aeb0). (+0x3c4 is a vestigial counter.)
  **Collision**: mask = table[frame − 662] (byte table at **0x4915b0**, read via `movsx [0x4915b0−0x296+frame]`); FUN_00430530:
  bit0 = left lane blocks if x ≤ 262, bit1 = middle blocks if 230 ≤ x ≤ 410, bit2 = right blocks if x ≥ 397 (7 = all).
  Hit → save frame in +0x3d4, crashes++ (+0x3d0), T:`ronja__gen_slalomfall`, state 2.
* 2: wait for the fall track; pause video once; at +0x3cc = 50: Ronja x = 320, `SetCursorPos` onto Ronja, T:`slalomN`, seek checkpoint:
  p<150 → 1; 150≤p<812 → no seek (resume where you fell); 812–1022 → 812; 1023–1278 → 1023; 1279–1425 → 1279; 1426–1557 → 1426;
  1558–1885 → 1558; 1886–2051 → 1886; p ≥ 2052 → state 3 (finished). At 100 (2 s total) and state<3: resume video, state 1.
* 3: master volume fade 0/1000 ms → 4: when faded: stop music, park & hide Ronja, resume video (the ending of winter.smk:
  Birk saves Ronja), master volume 127/500 ms.
* Video end (LAB_004301b0, not aborted): +0x3d9=0, FUN_00430f90: **gVar 0x4cf8e0 = 1** (ski run done), mode 0, show Ronja,
  standStill (400,400) dir 5 (in BORGGARDEN).
* **Obstacle table** (frame ranges : mask; 0 = free; L=1, M=2, R=4): 662-671:0 672-715:1 716-793:0 794-811:6 812-888:0 889-896:1 897-931:0
  932-936:4 937-957:0 958-964:1 965-974:0 975-976:4 977-981:6 982-986:0 987-989:4 990-1001:0 1002-1010:1 1011-1017:0 1018-1021:4 1022-1044:0
  1045-1052:2 1053-1069:0 1070-1075:6 1076-1088:0 1089-1094:1 1095-1110:0 1111-1116:4 1117-1138:0 1139-1143:3 1144-1196:0 1197-1201:1
  1202-1226:0 1227-1230:4 1231-1237:0 1238-1241:4 1242-1244:0 1245-1246:4 1247-1252:6 1253-1265:0 1266-1267:4 1268-1272:6 1273-1291:0
  1292-1294:1 1295-1296:0 1297-1298:4 1299-1302:0 1303-1305:1 1306:5 1307-1308:4 1309-1324:0 1325-1328:6 1329-1348:0 1349-1350:4 1351-1367:0
  1368-1369:1 1370-1371:0 1372-1375:3 1376-1396:0 1397-1398:1 1399-1407:0 1408-1410:4 1411-1414:1 1415-1421:0 1422-1424:4 1425-1432:0
  1433-1434:4 1435-1436:0 1437-1439:4 1440-1444:0 1445-1447:1 1448-1461:0 1462-1464:6 1465-1471:0 1472:5 1473-1474:4 1475-1479:0 1480-1481:3
  1482-1486:0 1487-1488:1 1489-1501:0 1502:1 1503-1504:3 1505-1529:0 1530-1532:4 1533-1551:0 1552:1 1553-1555:3 1556-1576:0 1577-1579:6
  1580-1600:0 1601-1603:1 1604-1606:3 1607-1615:0 1616-1617:1 1618-1626:0 1627-1629:1 1630:0 1631-1632:4 1633-1638:0 1639-1640:4 1641-1649:0
  1650-1654:4 1655-1663:0 1664-1666:6 1667-1679:0 1680-1681:4 1682-1719:0 1720-1723:1 1724-1737:0 1738-1741:4 1742-1813:0 1814-1816:4
  1817-1847:0 1848-1851:3 1852-1883:0 1884-1885:4 1886-1914:0 1915-1917:2 1918-1925:0 1926-1928:4 1929-1941:0 1942-1943:1 1944-1951:0
  1952-1955:4 1956:0 1957-1959:1 1960-1968:0 1969:4 1970-1974:6 1975-1987:0 1988-1990:1 1991-2019:0 2020-2024:4 2025-2029:1 2030-2054:0
  **2055-2086:7** (forced "crash" = end of course, then p≥2052 → finish).

### 5.8 Snowball fight with the robbers (mode 5)
Entry: sound-end callbacks in serials.cpp (0x45352b / 0x4540xx, e.g. after `STURKAS_1C_055A1_RovareFlyr`) when season==2,
flags `0x4cf8d5..0x4cf8da` set and `0x4cf8de` not set: hide DJUR1 & RONJA, **FUN_00431010** (L46394): mode 5, `SetCurrentScene(NULL)`
(UNCERTAIN: keeps the current scene, BORGPORTEN per manual); robbers parked at (1000,1000,1000):
LILLKLIPPEN (`LILLKLIPPEN_8_888_FlyNakenO/V`, `BadNakenO/V`), FJOSOK (`fjosok_8_888_GoNakenV`, `TittaFram`, `tvatta`),
STURKAS (`STURKAS_8_888_FlyNakenO/V`, `BadNakenO/V`), TJEGGE (`Tjegge_8_888_Naken`, `TJEGGE_8_888_BadNaken`), LABAS (`labbas_8_888_NakenO`,
`labbas_8_888_BadNaken`). RONJA T:`ronja_8_Gen_KastStill` loop. Ball = SNOBOLL, subani S:`__Gen_###_snoboll` frame 0, anchor 16,16,
parked (−30,0,8300), blit shown. Hit mask +0x37c=0, "sitting" mask +0x380=0, timer +0x384=−1, end state +0x3ac=0.
Music `dls_prickaRovarna_116_` vol 60, music volume 0x73/1000 ms. Cursor prickaRovareCursor.

* **Click** FUN_00432720 (in the static region!): only if active, no ball flying, state<1, not all hit, and Ronja not already throwing:
  RONJA T:`ronja_8_Gen_KastSnoboll`; x = min(x,520), y = max(y,140); vz = (480−y)/9; vy = −2 − 0.212766·vz; vx = (x−100)·0.04.
* Tick FUN_00431720 (L46730):
  - Release at KastSnoboll frame 8..13: ball at (125,300,1300) + throw effect. Flight: moveBy(v); vx·=0.997; vy=(vy+0.2)·0.997; vz·=0.997.
  - Ground/background hit (same depth rules as cones, or y>480): z −= 30, splat subani frame 1 + effect; then every 5 ticks frame 2,3, then
    frame 0, parked, ready.
  - Robber hits (only robbers with z < ball z_old+128): LILLKLIPPEN = ball inside 70×120 box at its sprite top-left, others pixel hit test
    (LABAS also needs ball.z ≤ LABAS.z). First hit of each robber sets its bit (STURKAS 1, LABAS 2, TJEGGE 4, LILLKLIPPEN 8, FJOSOK 0x10) and plays
    `EFFEKT_8_888_Sturkas/Labas/Tjegge/Lillklippen(+20 vol)/Fjosok`; **every hit restarts a 1500-tick (30 s) timer** (+0x384).
  - Timer: when it reaches 0 all hit bits and sitting bits are cleared (robbers recover — hit all five within 30 s of each other);
    at <300 ticks (6 s) left: effect `EFFEKT_8_888_Allafryser` once.
  - Ronja idle: with P=2767/32768 per tick the KastStill frame toggles (`RONJA.tempTrackFrameCount ^ 1`, breathing).
  - Robber AI: not hit — STURKAS/LILLKLIPPEN run back and forth (`FlyNakenO` ↔ `FlyNakenV`, direction remembered in +0x39c/+0x3a4);
    FJOSOK when idle or washing: rnd>0x7ef4 (0.85 %/tick) → `TittaFram` (rnd<0x4001) or `GoNakenV` (hide at end);
    LABAS idle & rnd>0x7e90 (1.16 %/tick) → `labbas_8_888_NakenO` (hide at end); TJEGGE idem `Tjegge_8_888_Naken`.
    Hit → sits in the snow: STURKAS/LILLKLIPPEN `BadNakenV/O` (by direction, loop), FJOSOK `tvatta` (loop, only while visible),
    LABAS `BadNaken`, TJEGGE `BadNaken` (frames 5..15 looped); sets the bit in +0x380.
  - **Win**: +0x380 == 0x1f (all five sitting) → music fade 2000 ms; when volume <2: stop, state 1; after 81 ticks: inactive,
    DoDialogAni(0x20c `_8_331A1_RonjaVinter`: LOVIS "NuSkaJag"), cb LAB_00431710 → 0x432810: **gVar 0x4cf8de = 1**, hide SNOBOLL, mode 0,
    jmp FUN_0041fb10 (gVar.cpp): if `0x4cf8f4` set or BRODKAKA is held by BIRK (directly or via an item Birk holds) → **season 0x4cf8c4 = 3 (spring)**,
    STORASALEN, Ronja hidden, PlaySmacker("spring.smk", LAB_0041fa70, 0x40, 0x45); else BORGGARDEN, Ronja (478,341) dir 5.
  - No lose condition.

### 5.9 Differences from the manual
* Lake: the game is lost when **4** grey dwarves stand at the rock at once (manual: 3); won after **21** direct hits.
* Cave: lost at **5** at the rock (manual: 3); won after **23** direct hits; cones raining from the hit witch do not count as hits.
* River rafts: the log and the reed bundle behave identically (1/3 chance to sink when landed on, else carry until
  x = 864 / 1658).
* Dice: Skalle-Per has no strategy; "beat the previous value or lose; 21 wins" exactly as in the manual.

---------------------------------------------------------------------------------------------------

## 6. Inventory items and item-use rules

Items (objId; inventory order and icon variants: engine.md §4.5): BRODKAKA bread cake (15), ELDSTAL fire steel (19),
FACKLA torch (24), FISKNAT fishing net (25), FLINTA flint (26), FNOSKE tinder (27), KARTAN map (30), LAX salmon (34),
MOROTTER carrots (35), OST cheese (37), NYCKEL key (36), RATTA rat (38), RATTBUR rat trap (39), REM leather strap (40),
VATTENKARL water vessel (47), VITMOSSA white moss (48). Items are "given" by setting `holder = &RONJA` (usually in a
track hook at the grab frame of the pick-up animation, §4) and "used up" by setting the holder to another object
(often `&MATTIS` as a sentinel).

Combining in the inventory (`FUN_0046a4f0`, silent, either order): OST + RATTBUR → `OST.holder = &RATTBUR`
(baited trap); FLINTA + ELDSTAL → `FLINTA.holder = &ELDSTAL` (steel with flint). Nothing else combines.

Using items on the scene (castle scenes):

| scene | target region | item | result |
|---|---|---|---|
| SKALLEPERSRUM | chest (1), !g90f | NYCKEL | #40 _1a_017A1_oppnaKista; NYCKEL→SKALLEPER; then g90f=1 |
| STORASALEN | fireplace (4), W && g8e7 && !g90d | FACKLA | #572 _1c_442A1_aktaEld |
| STORASALEN | fireplace/robbers (4, 8, 9, 10) | RATTA | #131 _1c_055A1_SkrammaRovare (→ robbers flee, mini-game 5) |
| KOKET | flint (4), flint not taken | ELDSTAL | #664 felFlinta |
| KOKET | fire steel (5), steel not taken | FLINTA | #663 felEldstal |
| KOKET | stove (6), no tinder | FNOSKE | g8e9=1, Ronja plays T429 |
| KOKET | stove (6), no tinder | other | #557 utanFnoske |
| KOKET | stove (6), tinder, not lit | ELDSTAL with FLINTA attached | #559 TandaSpis → g8e8 |
| KOKET | stove (6), tinder, not lit | other | #558 medFnoske |
| KOKET | stove (6), lit, !g90d | FACKLA | Ronja plays T1056 tandaFacklan → g90d |
| KOKET | trap spot/rat hole (9, 10), rat not caught | RATTBUR | #144 placeraTomRattfalla / #145 placeraOstRattfalla (if cheese inside) |
| KOKET | trap spot/rat hole (9, 10), trap not in inventory | OST | #665 felRattfalla |
| BORGGARDEN | horses (4) in phase H | MOROTTER | #196 geMorot, g8d9=1 |
| BORGGARDEN | horses (4) in phase H | other | #197 geFel |
| HELVETESGAPET | Birk (2), rescue conditions | REM | #207 raddaBirk if Ronja stands in region 3, else #206 felRaddaBirk |

Forest scenes:

| scene / region | item | result |
|---|---|---|
| HELVETESGAPET r2 | REM (40), needs act 1, `g8dd`,`g8e1`, `!g8ec` | Ronja on region 3 → #207 raddaBirk, else #206 felRaddaBirk |
| FANGELSEHALOR r3 (`!g8f4`) | BRODKAKA (15) | #258 geBirkBrod, bread → Birk, then spring.smk / act 3 |
| | anything else | #260 RonjaBirk |
| SKOGEN r4 (fog state) | REM | #520 hjalpaBirk |
| KAELLAN r5 | VATTENKARL (47), `!g90e` | fill track FyllaVattenA |
| GLAENTAN r6 | VITMOSSA (48) with `g8f7` | #348 forbinderStoet (moss+strap on mare) |
| | anything else | #347 felBirk |
| GLAENTAN r7 / r8 | any item | geRackarn #332/#745, geVildtoringen #331/#744 |
| GLUPAFALLET r5 | FISKNAT (25) | kastaNat tracks |
| GROTTANINNE r2 | FNOSKE (27) → ELDSTAL (19, with flint combined) → LAX (34) | lay tinder / light fire / roast salmon, otherwise #715 felEld |

TORNET, KAELLARE, BORGPORTEN, TJAERNEN, GROTTANUTE: no item handler (drops do nothing).
Every other (scene, region, item) combination does nothing at all (no generic "that doesn't work" line; events #618-#621
are dead).

---------------------------------------------------------------------------------------------------

## 7. Dialogue content

Events are the unit of interaction (engine.md §4.3b): a verb on a hotspot dispatches a **hotspot group**, which picks an event by use count; events chain through `next` names and choices. Typical group: EYE `titta…` (minUse 1) + a minUse-3 repeat remark, MOUTH `tala…` (opening a conversation tree), HAND `ta…` (take / touch, often with a follow-up animation). The generic repeat line is `RONJA_2a_338A1Say1_FarAtPipsvangen`.

### 7.1 Unreachable content
Method: a reachability pass seeds the reachable set with every immediate DoDialogAni/RB-dialog id and every MOUTH/HAND/EYE event
of a group that is dispatched with an immediate group number (Dispatch, RB-dispatch, Birk-talk helper), then follows `next`
and alt links. 143 of 746 events are unreachable; 23 of 143 groups are never dispatched:
**groups 0, 19, 30, 43–46, 68–71, 76, 85, 90–94, 113, 127–129, 138** (group 0 holds only #0 Formaning, which is played by id).

- **Narrative stubs never played**: #406 `_264A1_Vintern`, #443 `_286A1_SommarenKommer`, #530 `_337A1_KartanVinter`,
  #501 `_10_313A1_MattisGrater`, #444 `_15_287A1_LillKlippenVantar`, #478 `_15_294A1_LovisVantar`, #441 `_16_600A1_LaxenGrillas`,
  #436 `_16_606A1_ingenEld`, #439 `_16_607A1_tandEld`, #522 `_11_328A1_RonjaISnon` (ski crash line), #525 `_16_332A1_Gradvargar`,
  #526 `_13_333A1_Vildvittror`, #333–#336 `_*_20xA1_VildvittreAttack` (voiced), #505 `_13_317A1_VildvittraTar`,
  #507 `_14_319A1_Attack`, #514 `_9b_322A1_skrammerBirk`, #519 `_9b_339A1_talaBirk`, #198/#199 `geLillKlippen/geFjosok`,
  #261 `_8_140A1_LovisRovarna`, #714 `_16_594A1_felMat`, #618–#621 inventory-combine remarks (group 120), #625 SkadatSto line,
  #662 MattisSuck, #666 `_4_547A1_tomLada`, #700 `_12_604A1_forbundetSto`.
- **Unused hotspot groups with voice lines** (Birk companion variants that the scene code never selects): 43–46 (13_166..177
  Birk at the rapids), 68–71 (10_254..265 Birk at the spring), 85 (10c_310..312), 90–94 (9b_406..420), 127–129 (9b_551..553,
  13_554..559), 138 (10_584..586), 76's 16_279..281 Birk lines. Group 19 (`_1d_071..073` trap lines) and 30/113 (`tittaRovor`
  turnips) are also never dispatched .
- **Animation-name placeholders** (verb 1, no says): group 141 #718–#739 (`garInGrotta`, `garNerStege`, …), #60, #98, #166, #168,
  #200, #257, #259, #281, #282, #309, #349, #356, #381, #570, #578, #585, #623, #624, #655, #656. Their names match tracks
  played directly by code; they are not dialog content.
- **Broken links**: #196 `_2a_096A1_geMorot` → next `_2a_633A1_LillKlippenFjosokGar` (only `…GarA` exists, so no follow-up
  event; the hook plays the tracks instead), and alt 95 of #362 → `_12_216A1_taHastarna` (only `…taHastarnaA` exists; that
  choice simply ends the dialog).
- **Unused scenes**: VAPENHUS and UTSIKTSKOGEN (no graphics). Unused gVar fields: §2. Dead hook: §4.2 (data quirks).
- Says 573–582 of #503 (narrator, robbers, Borka, "Ronjas vårskrik") are cut off by the outro hook; they are presumably part
  of outro.smk.

### 7.2 Hotspot groups
Event ids per group and verb (`#id^minUse name`); scripted/continuation events in the last column. Which group a hotspot dispatches is decided by scene code (§3). Full data incl. voice lines and choice texts: data/dialog-events.json.

| G | eye (titta) | mouth (tala) | hand (ta) | scripted / continuation events |
|---|---|---|---|---|
| 0 |  |  |  | #0 |
| 1 | #1^1 `2a_003A1_tittaMattis`, #2^3 `2a_338A1_tittaMattis` | #3^1 `2a_004A1_talaMattis` | #12^1 `2a_005A1_taMattis`, #13^2 `2a_006A1_taMattis`, #14^3 `2a_339A1_taMattis` | #4..#11 (8) |
| 2 | #15^1 `2a_007A1_tittaLovis`, #16^3 `2a_340A1_tittaLovis` | #17^1 `2a_008A1_talaLovis` | #18^1 `2a_009A1_taLovis`, #19^2 `2a_010A1_taLovis`, #20^3 `2a_341A1_taLovis` |  |
| 3 | #21^1 `1a_011A1_tittaSkallePer`, #22^3 `1a_342A1_tittaSkallePer` | #23^1 `1a_012A1_talaSkallePer` | #24^1 `1a_013A1_taSkallePer` | #25..#33 (9) |
| 4 | #34^1 `1a_014A1_tittaKista`, #35^3 `1a_345A1_tittaKista` | #36^1 `1a_015A1_talaKista`, #37^3 `1a_346A1_talaKista` | #38^1 `1a_016A1_taKista`, #39^3 `1a_347A1_taKista` | #40 |
| 5 | #41^1 `1a_018A1_tittaKarta`, #42^3 `1a_348A1_tittaKarta` | #43^1 `1a_019A1_talaKarta`, #44^3 `1a_349A1_talaKarta` | #45^1 `1a_020A1_taKarta` | #46 |
| 6 | #47^1 `1b_022A1_tittaLovis`, #48^3 `1b_350A1_tittaLovis` | #49^1 `1b_023A1_talaLovis` | #56^1 `1b_024A1_taLovis`, #57^3 `1b_351A1_tittaLovis` | #50..#60 (9) |
| 7 | #61^1 `1c_027A1_tittaLillKlippen`, #62^3 `1c_352A1_tittaLillKlippen` | #63^1 `1c_028A1_talaLillKlippen` | #67^1 `1c_029A1_taLillKlippen`, #68^3 `1c_353A1_taLillKlippen` | #64, #65, #66 |
| 8 | #69^1 `1c_030A1_tittaLabbas`, #70^3 `1c_354A1_tittaLabbas` | #71^1 `1c_031A1_talaLabbas` | #75^1 `1c_032A1_taLabbas`, #76^3 `1c_355A1_taLabbas` | #72, #73, #74, #77 |
| 9 | #78^1 `1c_034A1_tittaMattis`, #79^3 `1c_356A1_tittaMattis` | #80^1 `1c_035A1_talaMattis` | #87^1 `1c_036A1_taMattis`, #88^2 `1c_037A1_taMattis`, #89^3 `1c_357A1_taMattis` | #81, #82, #83, #84, #85, #86 |
| 10 | #90^1 `1c_038A1_tittaSkallePer`, #91^3 `1c_358A1_tittaSkallePer` | #92^1 `1c_039A1_talaSkallePer` | #96^1 `1c_040A1_taSkallePer`, #97^3 `1c_359A1_taSkallePer` | #93, #94, #95, #98 |
| 11 | #99^1 `1c_042A1_tittaSturkas`, #100^3 `1c_360A1_tittaSturkas` | #101^1 `1c_043A1_talaSturkas` | #106^1 `1c_044A1_taSturkas`, #107^2 `1c_045A1_taSturkas`, #108^3 `1c_361A1_taSturkas` | #102, #103, #104, #105 |
| 12 | #109^1 `1c_046A1_tittaTjegge`, #110^3 `1c_362A1_tittaTjegge` | #111^1 `1c_047A1_talaTjegge` | #116^1 `1c_048A1_taTjegge`, #117^3 `1c_363A1_taTjegge` | #112, #113, #114, #115 |
| 13 | #118^1 `1c_049A1_tittaLabbas`, #119^3 `1c_364A1_tittaLabbas` | #120^1 `1c_050A1_talaLabbas` | #125^1 `1c_051A1_taLabbas`, #126^3 `1c_365A1_taLabbas` | #121, #122, #123, #124 |
| 14 | #127^1 `1c_052A1_tittaFnoske` | #128^1 `1c_053A1_talaFnoske`, #129^3 `1c_366A1_talaFnoske` | #130^1 `1c_054A1_taFnoske` | #131 |
| 15 | #132^1 `1d_056A1_tittaFlinta` | #133^1 `1d_057A1_talaFlinta`, #134^3 `1d_367A1_talaFlinta` | #135^1 `1d_058A1_taFlinta` |  |
| 16 | #136^1 `1d_059A1_tittaEldstal` | #137^1 `1d_060A1_talaEldstal`, #138^3 `1d_368A1_talaEldstal` | #139^1 `1d_061A1_taEldstal` |  |
| 17 | #140^1 `1d_062A1_tittaRattfalla` | #141^1 `1d_063A1_talaRattfalla`, #142^3 `1d_369A1_talaRattfalla` | #143^1 `1d_064A1_taRattfalla` | #144, #145 |
| 18 | #146^1 `1d_067A1_tittaRatta` | #147^1 `1d_068A1_talaRatta`, #148^2 `1d_069A1_talaRatta`, #149^3 `1d_370A1_talaRatta` | #150^1 `1d_070A1_taRatta` |  |
| 19 | #151^1 `1d_071A1_tittaRattfallan` | #152^1 `1d_072A1_talaRattfallan`, #153^3 `1d_371A1_talaRattfalla` | #154^1 `1d_073A1_taRattfallan` |  |
| 20 | #155^1 `1d_074A1_tittaKniv`, #156^3 `1d_372A1_tittaKniv` | #157^1 `1d_075A1_talaKniv`, #158^3 `1d_373A1_talaKniv` | #159^1 `1d_076A1_taKniv` | #160 |
| 21 | #161^1 `1d_078A1_tittaFacklan` | #162^1 `1d_079A1_talaFacklan`, #163^3 `1d_374A1_talaFacklan` | #164^1 `1d_080A1_taFacklan` | #165, #166, #167, #168 |
| 22 | #169^1 `2a_084A1_tittaStege` | #170^1 `2a_085A1_talaStege`, #171^3 `2a_376A1_talaStege` | #172^1 `2a_086A1_taStege` |  |
| 23 | #173^1 `2a_087A1_tittaLillKlippen`, #174^3 `2a_377A1_tittaLillKlippen` | #175^1 `2a_088A1_talaLillKlippen` | #180^1 `2a_089A1_taLillKlippen`, #181^3 `2a_378A1_taLillKlippen` | #176, #177, #178, #179 |
| 24 | #182^1 `2a_090A1_tittaFjosok`, #183^3 `2a_379A1_tittaFjosok` | #184^1 `2a_091A1_talaFjosok` | #189^1 `2a_092A1_taFjosok`, #190^3 `2a_380A1_taFjosok` | #185, #186, #187, #188 |
| 25 | #191^1 `2a_093A1_tittaHast`, #192^3 `2a_381A1_tittaHast` | #193^1 `2a_094A1_talaHast` | #194^1 `2a_095A1_taHast`, #195^3 `2a_382A1_taHast` | #196..#202 (7) |
| 26 | #203^1 `3_102A1_tittaBirk` | #204^1 `3_103A1_talaBirk` | #205^1 `3_104A1_taBirk` | #206, #207 |
| 27 | #208^1 `4_107A1_tittaNyckel` | #209^1 `4_108A1_talaNyckel`, #210^3 `4_383A1_talaNyckel` | #211^1 `4_109A1_taNyckel` |  |
| 28 | #212^1 `6_110A1_tittaOst` | #213^1 `6_111A1_talaOst`, #214^3 `6_384A1_talaOst` | #215^1 `6_112A1_taOst` |  |
| 29 | #216^1 `6_113A1_tittaMorot` | #217^1 `6_114A1_talaMorot`, #218^2 `6_115A1_talaMorot`, #219^3 `6_385A1_talaMorot` | #220^1 `6_116A1_taMorot` |  |
| 30 | #221^1 `6_117A1_tittaRovor` | #222^1 `6_118A1_talaRovor`, #223^3 `6_386A1_talaRovor` | #224^1 `6_119A1_taRovor` |  |
| 31 | #225^1 `6_121A1_tittaHylla` | #226^1 `6_122A1_talaHylla` | #227^1 `6_123A1_taHylla` | #228..#239 (12) |
| 32 | #240^1 `6_126A1_tittaBrodkaka` | #241^1 `6_127A1_tittaBrodkaka`, #242^3 `6_387A1_talaBrod` | #243^1 `6_128A1_taBrodkaka` |  |
| 33 | #244^1 `7_130A1_tittaStenhog` | #245^1 `7_131A1_talaStenhog` | #246^1 `7_132A1_taStenhog` |  |
| 34 | #247^1 `7_133A1_tittaBirk` | #248^1 `7_134A1_talaBirk` | #253^1 `7_135A1_taBirk`, #254^2 `7_388A1_taBirk`, #255^3 `7_389A1_taBirk` | #249..#261 (10) |
| 35 | #262^1 `14_141A1_tittaVitmossa` | #263^1 `14_142A1_talaVitmossa`, #264^3 `14_390A1_talaMossa` | #265^1 `14_143A1_taVitmossa` |  |
| 36 | #266^1 `9a_144A1_tittaBirk` | #267^1 `9a_145A1_talaBirk` | #268^1 `9a_146A1_taBirk` |  |
| 37 | #269^1 `9a_147A1_tittaBirk` | #270^1 `9a_148A1_talaBirk` | #271^1 `9a_149A1_taBirk` |  |
| 38 | #272^1 `9a_150A1_tittaBirk` | #273^1 `9a_151A1_talaBirk` | #274^1 `9a_152A1_taBirk` |  |
| 39 | #275^1 `9a_153A1_tittaBirk` | #276^1 `9a_154A1_talaBirk` | #277^1 `9a_155A1_taBirk` |  |
| 40 | #278^1 `13_156A1_tittaNat` | #279^1 `13_157A1_talaNat`, #280^3 `13_391A1_talaNat` |  | #281, #282 |
| 41 | #283^1 `13_160A1_tittaFors` | #284^1 `13_161A1_talaFors`, #285^3 `13_392A1_talaFors` | #286^1 `13_162A1_taFors` |  |
| 42 | #287^1 `13_163A1_tittaFors` | #288^1 `13_164A1_talaFors`, #289^3 `13_393A1_talaFors` | #290^1 `13_165A1_taFors` |  |
| 43 | #291^1 `13_166A1_tittaBirk` | #292^1 `13_167A1_talaBirk` | #293^1 `13_168A1_taBirk` |  |
| 44 | #294^1 `13_169A1_tittaBirk` | #295^1 `13_170A1_talaBirk` | #296^1 `13_171A1_taBirk` |  |
| 45 | #297^1 `13_172A1_tittaBirk` | #298^1 `13_173A1_talaBirk` | #299^1 `13_174A1_taBirk` |  |
| 46 | #300^1 `13_175A1_tittaBirk` | #301^1 `13_176A1_talaBirk` | #302^1 `13_177A1_taBirk` | #303 |
| 47 | #304^1 `14_179A1_tittaBirk` | #305^1 `14_180A1_talaBirk` | #308^1 `14_181A1_taBirk` | #306, #307, #309 |
| 48 | #310^1 `1c_184A1_tittaSkallePer` | #311^1 `1c_185A1_talaSkallePer` | #312^1 `1c_186A1_taSkallePer` | #313, #314, #315 |
| 49 | #316^1 `12_188A1_tittaBjork`, #317^3 `12_394A1_tittaBjork` | #318^1 `12_189A1_talaBjork`, #319^3 `12_395A1_talaBjork` | #320^1 `12_190A1_taBjork` |  |
| 50 | #321^1 `12_191A1_tittaSten` | #322^1 `12_192A1_talaSten` | #323^1 `12_193A1_taSten`, #324^3 `12_396A1_taSten` |  |
| 51 | #325^1 `12_194A1_tittaVildtoringen` | #326^1 `12_195A1_talaVildtoringen` | #327^3 `12_196A1_taVildtoringenA` |  |
| 52 | #328^1 `12_197A1_tittaRackarn` | #329^1 `12_198A1_talaRackarn` | #330^3 `12_199A1_taRackarnA` | #331, #332, #333, #334, #335, #336 |
| 53 | #337^1 `12_206A1_tittaStoet` | #338^1 `12_207A1_talaStoet` | #339^1 `12_208A1_taStoet` |  |
| 54 | #340^1 `12_209A1_tittaBirk` | #341^1 `12_210A1_talaBirk` | #345^1 `12_211A1_taBirk`, #346^3 `12_397A1_taBirk` | #342, #343, #344, #347, #348, #349 |
| 55 | #350^1 `12_214A1_tittaHastarna` | #351^1 `12_215A1_talaHastarna` | #352^1 `12_216A1_taHastarnaA` |  |
| 56 | #353^1 `12_217A1_tittaStoet` | #354^1 `12_218A1_talaStoet` | #355^1 `12_219A1_taStoet` | #356 |
| 57 | #357^1 `12_220A1_tittaStoet` | #358^1 `12_221A1_talaStoet` | #359^1 `12_222A1_taStoet`, #360^2 `12_083A1_taStoet` |  |
| 58 | #361^1 `12_223A1_tittaBirk` | #362^1 `12_224A1_talaBirk` | #364^1 `12_225A1_taBirk` | #363 |
| 59 | #365^1 `12_226A1_tittaBirk` | #366^1 `12_227A1_talaBirk` | #367^1 `12_228A1_taBirk` |  |
| 60 | #368^1 `12_229A1_tittaBirk` | #369^1 `12_230A1_talaBirk` | #370^1 `12_231A1_taBirk`, #371^3 `12_398A1_taBirk` |  |
| 61 | #372^1 `12_232A1_tittaBirk` | #373^1 `12_233A1_talaBirk` | #374^1 `12_234A1_taBirk` |  |
| 62 | #375^1 `12_235A1_tittaBirk` | #376^1 `12_236A1_talaBirk` | #377^1 `12_237A1_taBirk` |  |
| 63 | #378^1 `10_238A1_tittaVattenkarl` | #379^1 `10_239A1_talaVattenkarl` | #380^1 `10_240A1_taVattenkarl` | #381 |
| 64 | #382^1 `10_242A1_tittaBirk` | #383^1 `10_243A1_talaBirk` | #384^1 `10_244A1_taBirk` |  |
| 65 | #385^1 `10_245A1_tittaBirk` | #386^1 `10_246A1_talaBirk` | #387^1 `10_247A1_taBirk` |  |
| 66 | #388^1 `10_248A1_tittaBirk` | #389^1 `10_249A1_talaBirk` | #390^1 `10_250A1_taBirk` |  |
| 67 | #391^1 `10_251A1_tittaBirk` | #392^1 `10_252A1_talaBirk` | #393^1 `10_253A1_taBirk` |  |
| 68 | #394^1 `10_254A1_tittaBirk` | #395^1 `10_255A1_talaBirk` | #396^1 `10_256A1_taBirk` |  |
| 69 | #397^1 `10_257A1_tittaBirk` | #398^1 `10_258A1_talaBirk` | #399^1 `10_259A1_taBirk` |  |
| 70 | #400^1 `10_260A1_tittaBirk` | #401^1 `10_261A1_talaBirk` | #402^1 `10_262A1_taBirk` |  |
| 71 | #403^1 `10_263A1_tittaBirk` | #404^1 `10_264A1_talaBirk` | #405^1 `10_265A1_taBirk` | #406 |
| 72 | #407^1 `15_267A1_tittaStenblock` | #408^1 `15_268A1_talaStenblock` | #409^1 `15_269A1_taStenblock`, #410^3 `15_399A1_taSten` |  |
| 73 | #411^1 `15_270A1_tittaStenblock` | #412^1 `15_271A1_talaStenblock` | #413^1 `15_272A1_taStenblock`, #414^3 `15_400A1_taStenblock` |  |
| 74 | #415^1 `15_273A1_tittaBirk` | #416^1 `15_274A1_talaBirk` | #422^1 `15_275A1_taBirk`, #423^3 `15_401A1_taBirk` | #417, #418, #419, #420, #421 |
| 75 | #424^1 `15_276A1_tittaBirk` | #425^1 `15_277A1_talaBirk` | #429^1 `15_278A1_taBirk` | #426, #427, #428 |
| 76 | #430^1 `16_279A1_tittaBirk` | #431^1 `16_280A1_talaBirk` | #435^1 `16_281A1_taBirk` | #432..#444 (12) |
| 77 | #445^1 `15_288A1_tittaLillKlippen` | #446^1 `15_289A1_talaLillKlippen` | #471^1 `15_290A1_taLillKlippen` | #447..#470 (24) |
| 78 | #472^1 `610A1_tittaLillKlippen`, #474^1 `612A1_taLillKlippen` | #473^1 `611A1_talaLillKlippen` |  |  |
| 79 | #475^1 `15_291A1_tittaBirk` | #476^1 `15_292A1_talaBirk` | #477^1 `15_293A1_taBirk` | #478 |
| 80 | #479^1 `15_295A1_tittaLovis` | #480^1 `15_296A1_talaLovis` | #481^1 `15_297A1_taLovis` |  |
| 81 | #482^1 `15_298A1_tittaBirk` | #483^1 `15_299A1_talaBirk` | #488^1 `15_300A1_taBirk` | #484, #485, #486, #487 |
| 82 | #489^1 `9a_301A1_tittaBirk` | #490^1 `9a_302A1_talaBirk` | #491^1 `9a_303A1_taBirk` |  |
| 83 | #492^1 `14_304A1_tittaBirk` | #493^1 `14_305A1_talaBirk` | #494^1 `14_306A1_taBirk` |  |
| 84 | #495^1 `10_307A1_tittaBirk` | #496^1 `10_308A1_talaBirk` | #497^1 `10_309A1_taBirk` |  |
| 85 | #498^1 `10c_310A1_tittaBirk` | #499^1 `10c_311A1_talaBirk` | #500^1 `10c_312A1_taBirk` | #501 |
| 86 | #502^1 `10_314A1_tittaMattis` | #503^1 `10_315A1_talaMattis` | #504^1 `10_316A1_taMattis` | #505..#514 (10) |
| 87 | #515^1 `9b_323A1_tittaBirk` | #516^1 `9b_324A1_talaBirk`, #517^2 `9b_599A1_talaBirk` | #518^1 `9b_325A1_taBirk` | #519..#526 (8) |
| 88 | #527^1 `1d_334A1_tittaLucka` | #528^1 `1d_335A1_talaLucka` | #529^1 `1d_336A1_taLucka` | #530, #531 |
| 89 | #532^1 `14_403A1_tittaBirk` | #533^1 `14_404A1_talaBirk` | #536^1 `14_405A1_taBirk` | #534, #535 |
| 90 | #537^1 `9b_406A1_tittaBirk` | #538^1 `9a_407A1_talaBirk` | #539^1 `9b_408A1_taBirk` |  |
| 91 | #540^1 `9b_409A1_tittaBirk` | #541^1 `9b_410A1_talaBirk` | #542^1 `9b_411A1_taBirk` |  |
| 92 | #543^1 `9b_412A1_tittaBirk` | #544^1 `9b_413A1_talaBirk` | #545^1 `9b_414A1_taBirk` |  |
| 93 | #546^1 `9b_415A1_tittaBirk` | #547^1 `9b_416A1_talaBirk` | #548^1 `9b_417A1_taBirk` |  |
| 94 | #549^1 `9b_418A1_tittaBirk` | #550^1 `9b_419A1_talaBirk` | #551^1 `9b_420A1_taBirk` |  |
| 95 | #552^1 `1d_421A1_tittaSpis` | #553^1 `1d_422A1_talaSpis`, #554^3 `1d_423A1_talaSpis` | #555^1 `1d_424A1_taSpis`, #556^3 `1d_425A1_taSpis` | #557, #558, #559 |
| 96 | #560^1 `1d_429A1_tittaRatthalet` | #561^1 `1d_430A1_talaRatthalet`, #562^3 `1d_431A1_talaRatthalet` | #563^1 `1d_432A1_taRatthalet`, #564^2 `1d_433A1_taRatthalet`, #565^3 `1d_434A1_taRatthalet` |  |
| 97 | #566^1 `1d_435A1_tittaRattfallan` | #567^1 `1d_436A1_talaRattfallan`, #568^3 `1d_437A1_talaRattfalla` | #569^1 `1d_438A1_taRattfallan` | #570, #571, #572 |
| 98 | #573^1 `1c_443A1_tittaMattis` | #574^1 `1c_444A1_talaMattis`, #575^3 `1c_445A1_talaMattis` | #576^1 `1c_446A1_taMattis`, #577^3 `1c_447A1_taMattis` | #578, #579 |
| 99 | #580^1 `1a_450A1_tittaKarta`, #581^3 `1a_451A1_tittaKarta` | #582^1 `1a_452A1_talaKarta`, #583^3 `1a_453A1_talaKarta` | #584^1 `1a_454A1_taKarta` | #585 |
| 100 | #586^1 `1a_456A1_tittaKista`, #587^3 `1a_457A1_tittaKista` | #588^1 `1a_458A1_talaKista`, #589^3 `1a_459A1_talaKista` | #590^1 `1a_460A1_taKista`, #591^3 `1a_461A1_taKista` | #592 |
| 101 | #593^1 `1d_463A1_tittaSandhink` | #594^1 `1d_464A1_talaSandhink`, #595^3 `1d_465A1_talaSandhink` | #596^1 `1d_466A1_taSandhink`, #597^2 `1d_467A1_taSandhink`, #598^3 `1d_468A1_taSandhink` |  |
| 102 | #599^1 `469A1_tittaRatta` |  |  |  |
| 103 | #600^1 `471A1_tittaTomRattfalla` |  |  |  |
| 104 | #601^1 `473A1_tittaLaddadRattfalla` |  |  |  |
| 105 | #602^1 `475A1_tittaNyckel` |  |  |  |
| 106 | #603^1 `477A1_tittaOst` |  |  |  |
| 107 | #604^1 `479A1_tittaFnoske` |  |  |  |
| 108 | #605^1 `481A1_tittaEldstal` |  |  |  |
| 109 | #606^1 `483A1_tittaFlinta` |  |  |  |
| 110 | #607^1 `485A1_tittaFackla` |  |  |  |
| 111 | #608^1 `487A1_tittaTandFackla` |  |  |  |
| 112 | #609^1 `489A1_tittaMorotter` |  |  |  |
| 113 | #610^1 `491A1_tittaRovor` |  |  |  |
| 114 | #611^1 `493A1_tittaBrodkaka` |  |  |  |
| 115 | #612^1 `495A1_tittaTomtKarl` |  |  |  |
| 116 | #613^1 `497A1_tittaFylltKarl` |  |  |  |
| 117 | #614^1 `499A1_tittaFisknat` |  |  |  |
| 118 | #615^1 `501A1_tittaLax` |  |  |  |
| 119 | #616^1 `503A1_tittaVitmossa` |  |  |  |
| 120 | #617^1 `505A1_tittaSkinnrem` |  |  | #618..#625 (8) |
| 121 | #626^1 `1a_515A1_tittaSkallePer`, #627^3 `1a_516A1_tittaSkallePer` | #628^1 `1a_517A1_talaSkallePer` | #629^1 `1a_518A1_taSkallePer` | #630, #631, #632, #633, #634 |
| 122 | #635^1 `1a_519A1_tittaSkallePer`, #636^3 `1a_520A1_tittaSkallePer` | #637^1 `1a_521A1_talaSkallePer` | #638^1 `1a_522A1_taSkallePer` | #639, #640, #641, #642 |
| 123 | #643^1 `1a_523A1_tittaKista`, #644^3 `1a_524A1_tittaKista` | #645^1 `1a_525A1_talaKista`, #646^3 `1a_526A1_talaKista` | #647^1 `1a_527A1_taKista`, #648^3 `1a_528A1_taKista` |  |
| 124 | #649^1 `1a_529A1_tittaKista`, #650^3 `1a_530A1_tittaKista` | #651^1 `1a_531A1_talaKista`, #652^3 `1a_532A1_talaKista` | #653^1 `1a_533A1_taKista`, #654^3 `1a_534A1_taKista` | #655, #656 |
| 125 | #657^1 `1b_538A1_tittaSkinnrem`, #658^3 `1b_539A1_tittaSkinnrem` | #659^1 `1b_540A1_talaSkinnrem`, #660^3 `1b_541A1_talaSkinnrem` | #661^1 `1b_542A1_taSkinnrem` | #662, #663, #664, #665, #666 |
| 126 | #667^1 `9a_548A1_tittaBirk` | #668^1 `9a_549A1_talaBirk` | #669^1 `9a_550A1_taBirk` |  |
| 127 | #670^1 `9b_551A1_tittaBirk` | #671^1 `9b_552A1_talaBirk` | #672^1 `9b_553A1_taBirk` |  |
| 128 | #673^1 `13_554A1_tittaBirk` | #674^1 `13_555A1_talaBirk` | #675^1 `13_556A1_taBirk` |  |
| 129 | #676^1 `13_557A1_tittaBirk` | #677^1 `13_558A1_talaBirk` | #678^1 `13_559A1_taBirk` |  |
| 130 | #679^1 `14_560A1_tittaBirk` | #680^1 `14_561A1_talaBirk` | #681^1 `14_562A1_taBirk` |  |
| 131 | #682^1 `14_563A1_tittaBirk` | #683^1 `14_564A1_talaBirk` | #684^1 `14_565A1_taBirk` |  |
| 132 | #685^1 `14_566A1_tittaBirk` | #686^1 `14_567A1_talaBirk` | #687^1 `14_568A1_taBirk` |  |
| 133 | #688^1 `14_569A1_tittaBirk` | #689^1 `14_570A1_talaBirk` | #690^1 `14_571A1_taBirk` |  |
| 134 | #691^1 `14_572A1_tittaBirk` | #692^1 `14_573A1_talaBirk` | #693^1 `14_574A1_taBirk` |  |
| 135 | #694^1 `12_575A1_tittaBirk` | #695^1 `12_576A1_talaBirk` | #696^1 `12_577A1_taBirk` |  |
| 136 | #697^1 `12_578A1_tittaStoet` | #698^1 `12_579A1_talaStoet` | #699^1 `12_580A1_taStoet` | #700 |
| 137 | #701^1 `10_581A1_tittaBirk` | #702^1 `10_582A1_talaBirk` | #703^1 `10_583A1_taBirk` |  |
| 138 | #704^1 `10_584A1_tittaBirk` | #705^1 `10_585A1_talaBirk` | #706^1 `10_586A1_taBirk` | #707 |
| 139 | #708^1 `16_588A1_tittaBirk` | #709^1 `16_589A1_talaBirk` | #710^1 `16_590A1_taBirk` |  |
| 140 | #711^1 `15_591A1_tittaBirk` | #712^1 `15_592A1_talaBirk` | #713^1 `15_593A1_taBirk` | #714, #715 |
| 141 | #716^1 `596A1_tittaKarta` |  |  | #717..#739 (23) |
| 142 | #740^1 `12_634A1_tittaRackarn` | #741^1 `12_635A1_talaRackarn`, #742^2 `12_637A1_talaRackarn` | #743^3 `12_636A1_taRackarnA` | #744, #745 |
