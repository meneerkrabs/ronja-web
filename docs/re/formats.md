# Ronja de Roversdochter — data file formats

Reverse-engineered from the CD files and `Game.exe` (MSVC 5, MFC; Ghidra names `FUN_xxxxxxxx`,
addresses are VAs in `Game.exe`). All multi-byte values are **little-endian** unless stated.
Source paths in the exe's assertion strings show the engine ("SCURR", `C:\Project Files\GEngine\Scurr\Scurr.cpp`,
`...\Ronja\Scurr\serials.cpp`, `...\Ronja\APCpacker\...`).

Parsers: `src/formats/*.ts`; checker/dumper: `node tools/inspect-formats.ts [gameDir] [--write-hw]`
(parses every file, verifies cross references, renders PNGs to `/tmp/ronja-formats/`).
Confidence: **[sure]** = verified against code and/or by decoding all data; **[likely]** = consistent
with code/data but not fully traced; **[guess]**.

| File | Parser | What |
|---|---|---|
| `subanis/subanis.apc` | `apc.ts` | all sprites/animations, cursors, menus, scene backgrounds + scene maps |
| `tracks/tracks.trk` | `trk.ts` | animation timelines (key frames: subani frame, duration, movement, anchor) |
| `Game.exe` tables | `hw-handles.ts` → `src/data/ronja.hw.json` | "hard-wired" handle → name tables used by the game code |
| `scene.nfo` | `scene-nfo.ts` | per-scene perspective constant |
| `language.str` | `language.ts` | Dutch texts of dialogue choices |
| `normalFont.fnt` / `.sz` | `font.ts` | bitmap font (TGA atlas + glyph table) |
| `sounds/DIALOUGE.wav/**`, `sounds/EFFECT.wav/**` | `wav.ts` | RIFF WAVs (speech, effects) |
| `sounds/MUSIC.wav/*.wav` | `music.ts` | Miles XMIDI + DLS/MLS bank (ambient music) |
| `RONJAS<n>.sav` | `savegame.ts` | save games (none on the CD) |
| `smacker/*.smk` | (other agent) | Smacker 2 cut-scenes, 640x480 or 512x344 |

---

## 1. Serial numbers and names (how the engine refers to data)

The engine never uses file offsets in game code. Every resource has a **serial** (u32) and a **name**:

| Range | Meaning | Source |
|---|---|---|
| `0x100000 + i` | subani = APC directory entry *i* | `FUN_004506a0` |
| `0x200000 + i` | track = *i*-th track in tracks.trk | `FUN_00450b30` |
| `0x300000 + i` | direction pseudo-subani `__234_syd`, `__235_nord`, `__236_vast`, `__237_ost`, `__238_nordvast`, `__239_sydvast`, `__240_nordost`, `__241_sydost` | `FUN_004500d0`, table `0x4A3C00` |
| `0x400000 + i` | sound = *i*-th WAV found when scanning `sounds\` | `FUN_00451650` |
| `0x800000 + n` | **HW subani handle** *n* (0..768) | `FUN_00450180`, table `0x4A6578` |
| `0x900000 + n` | **HW track handle** *n* (0..1321) | `FUN_004501a0`, table `0x4A3C20` |

[sure] Game code (scene scripts) is written as `SCURR_getSubAniSerialFromHWHandle(539 + 0x800000)` /
`SCURR_getTrackSerialFromHWHandle(1243 + 0x900000)`. The HW tables hold `{u32 serial (0 in the file,
filled at start-up), char *name}`; at load the name is looked up **case-insensitively** in the APC
directory / track list (hash tables at `DAT_004e1fd8` subanis, `DAT_004e08c8` tracks, `DAT_004e1fc8`
sounds; lookup `FUN_0041a930`). So: HW handle → name → archive entry. All 769 + 1322 HW names resolve.
`FUN_00450140(name)` resolves a name in the order subani, track, direction, sound.
`src/data/ronja.hw.json` contains `subanis[n]`, `tracks[n]`, `directions`, plus:

* `trackCallbacks` (table `0x4BA2C8`, 128 entries `{char *trackName, fn}`): C++ callbacks invoked by
  the track player with event codes `0x100000` (start), `0x400000 | keyIndex` (each new key),
  `0x200000` (end) (`FUN_00451b20`, called from `FUN_00455cc0`). [sure]
* `trackFollowUps` (table `0x4BA6C8`, 46 pairs, NULL-terminated): when track A ends, track B is started
  on the same actor (`FUN_00451b40`, used in `FUN_00455cc0`). [sure]

**Naming scheme** [likely]: `<actor>_<scene>_<lineId>_###_<description>` for subanis (the `###`
separates the "track part" from the subani part); the matching track is the same name without
`_###`. Scene codes: `1a` Skalle-Pers room … `18` board game; `gen`/`Gen` = generic, `234` = walk/stand
cycles, `888` = special scene 8 animation, `__` = no actor. Line ids like `013A1Alt1`/`Say1` match the
dialogue WAV names (`A1` = branch, `AltN` = choice offered, `SayN` = spoken line).

---

## 2. `subanis/subanis.apc` (27 310 035 bytes) — `apc.ts`

Loader `APC_fh_mapFile` = `FUN_004097a0`; frame decoder `APCsetFrame` = `FUN_004095d0`.

### 2.1 File header and directory [sure]

| Off | Type | Value |
|---|---|---|
| 0 | u16 | `0x1000` magic, u16 pad (`CD CD`) |
| 4 | u32 | file size (27 310 035) |
| 8 | u16 | `0x1001` directory magic, u16 pad |
| 12 | u32 | directory size, counted from offset 12 (= 0x67CF; directory ends at 12 + size = 0x67DB) |
| 16 | u32 | entry count = 789 |
| 20 | … | 789 × `{ cstr name ; u32 offset ; u32 size }` (offset absolute, size = whole stream incl. header) |

Streams follow the directory back to back; the last ends exactly at EOF. `0xCD` bytes are MSVC debug-heap
fill (uninitialised padding) everywhere in this file.

### 2.2 Stream header (28 bytes at `offset`) [sure]

| Off | Type | Meaning |
|---|---|---|
| 0 | u16 | `0x1002`, u16 pad |
| 4 | u32 | stream size (= directory size) |
| 8 | u16 | width |
| 10 | u16 | height |
| 12 | u32 | pixel format: `0x44440010` ARGB4444 (621 streams), `0x00000010` GRAY16 (126), `0x00000008` GRAY8 (42) |
| 16 | u16 | frame count |
| 18 | u16 | compression: always 4 = zlib. In memory the engine requires this to be 0 (= unpacked) |
| 20 | u16 | stream flags: 0 (611) or 2 (178). Meaning unknown; bit 0 must be 0 (`FUN_004095d0`) [unknown] |
| 22 | u16 | pad |
| 24 | u32 | inflated size of the frame data |
| 28 | … | zlib stream (RFC 1950, `78 9C`) of the frame records |

### 2.3 Frame record (inside the inflated data; header 0x20 bytes) [sure]

| Off | Type | Meaning |
|---|---|---|
| 0 | u16 | `0x1003`, u16 pad |
| 4 | u32 | record size (header + data) |
| 8 | u16 | flags: bit 1 `RLE`, bit 0 `DELTA` (seen: 2 key 747, 3 delta 3789, 0 raw 42 (GRAY8 maps), 1 = empty 12) |
| 10 | u16 | pad |
| 12 | u32 | data size (= record size − 0x20; 0 for "no change" frames) |
| 16 | u16 | x of the rectangle the data covers |
| 18 | u16 | y |
| 20 | u16 | w (always the stream width in the shipped data) |
| 22 | u16 | h (delta frames cover only the band of changed rows) |
| 24 | u16 ×4 | bounding box x0, y0, x1, y1 (exclusive) of the non-transparent pixels of the **composed** frame [likely: dirty rect / hit box] |
| 32 | … | pixel data |

**Frames are cumulative**: frame *i* = frame *i−1* with frame *i*'s data applied. `APCsetFrame(stream,
dest, frame, prevFrame)` restarts at frame 0 when `frame <= prevFrame` and applies frames
`prevFrame+1 … frame` in order (`FUN_004095d0`). The first frame of every stream is a key frame.
Pixels are written row-major into the rectangle `(x, y, w, h)` of a `width × height` buffer.

There is **no timing and no hotspot** in the APC; frame durations, positions and anchors come from tracks.

### 2.4 Pixel coding [sure — all 4590 frames decode exactly]

**ARGB4444** (`APCunpackFrame_ARGB4444`, `FUN_004092c0` → key `FUN_00409240`, delta `FUN_004090a0`;
partial-width variants `FUN_00409130`/`FUN_00408f60`). Stream of u16 words:

* word `0x0F02..0x0FFF` = run: count = low byte (2..255), the **next word** is the pixel value repeated.
* any other word = one literal pixel.
* in DELTA frames the value `0x0F00` means "keep the previous pixel" (as a literal: skip 1; as a run value:
  skip *count*). Pixels with alpha nibble 0 are otherwise always `0x0000`, so `0x0Fxx` never collides with
  a real colour.

Pixel = `AAAA RRRR GGGG BBBB` (alpha in the top nibble; 0 transparent, 15 opaque; intermediate values are
anti-aliased edges and shadows, e.g. `0x1000`/`0x7000` = translucent black). The game ran on 16-bit DirectDraw
surfaces in this format (`HWlayer`). 8-bit expansion: `c * 17`.

**GRAY16** (`APCunpackFrame_GRAY16`, `FUN_004093e0` / `FUN_00409360`): RLE (flags = 2) of u16 words:
control `c`; if `c & 0x8000`: run of `c & 0x7FFF` copies of the next word; else `c` literal words follow.
Raw (flags = 0) = w·h words. DELTA is not supported (ignored by the engine).

**GRAY8** (`APCunpackFrame_GRAY8`, `FUN_00409450`): raw w·h bytes, flags must be 0.

### 2.5 What the 789 streams are

* **Sprites/animations** (579, ARGB4444): actors (`ronja__234_###_vast` = Ronja walking west, 10 frames
  120×200), objects, inventory (`*__inv_###_*`), cursors (`PEKARE__*` = pointer: `_normal`, `_hilite`
  (cursor over a hotspot), `_invisible` (8×8, empty), `_riktadN/NO/O/S/V/NV` = exit arrows, `___###_stdCursor`,
  `prickaKotteCursor`, `prickaRovareCursor`), the verb coin `TATITA__gen_###_{normal,TaHilite,TalaHilite,TittaHilite}`
  (ta = take, tala = talk, titta = look), menus (`_main__###_MainGfx`: 4 frames = main menu, load, save,
  main menu with "Bewaar spel" greyed out by a 0x7000 overlay; `_inv__###_MainGfx` inventory panel;
  `_main__###_USure`), map pages `Karta__gen_###_mapN`, score `Poang_18_*`.
  "hilite"/"invisible" are just cursor/verb variants — **hotspot shapes are not sprites**, they are in the
  scene info map (below).
* **Scene graphics** `_<scene>__###_SceneGFX<Name>[suffix]`, 42 sets (incl. variants like `...VINTER`,
  `KallarenSlackt`, 15 labyrinth rooms), loaded in `FUN_0046aab0` by `sprintf("%sZ")` etc.:

| Suffix | Format | Size | Meaning (engine name) |
|---|---|---|---|
| none | ARGB4444 | 640/1280/1920 × 480 | background. After decoding the engine masks every pixel `& 0x0FFF` (drawn opaque) |
| `Z` | GRAY16 | full res | z-buffer of the background (`SceneBackground.Get_lpCustomBltZBuf`): depth per pixel (≈1700–8000; bigger = farther; 0xFFFF sky). Sprites are depth-tested against it [likely] |
| `H` | GRAY16 | full res | `SceneHeightMap`: depth of the **floor** under each pixel (0xFFFF = no floor). Actors with "follow ground" (`+0x262`) take z = H[y][x] at their position (`FUN_00456620`) [sure] |
| `R` | GRAY16 | ¼ res (w/4 × h/4) | `tempRestictionMap`: walk area; 0x7FFF walkable, 0 blocked. Converted to the path-finder grid at `0x4E4428` with cost 0 (walkable) / 0x7F (blocked) (`FUN_0041b3f0`); `thePathFinder.GetPath(posX/4, posY/4, x/4, y/4)` [sure] |
| `I` | GRAY8 | ¼ res | `SceneInfoMap`: hotspot/region id per 4×4 cell, 0 = none. Lookup `FUN_0046d120(x, y)` = `I[(y>>2)·(W>>2) + (x>>2)]`; each scene's code switches on the id (cursor choice: e.g. `FUN_0045f040` picks `0x800220` normal / `0x800222`,`0x800223` exit arrows / `0x800224` hilite; actions in `FUN_0045f1a0`...). Ids are per-scene (Borggarden uses 1–12, 255) [sure for lookup, ids scene-specific] |

GRAY16 maps all have `0xCDCD` in the whole top row and left column (packer garbage). Edge-alignment tests
between Z and the background are inconclusive, so treat the maps as aligned 1:1 with the background and
ignore row 0 / column 0 [likely].

---

## 3. `tracks/tracks.trk` (807 551 bytes) — `trk.ts`

Reader `SCURR_initializeScurrTracks` = `FUN_00450b30`; `Track::readFromBinaryStream` = `FUN_00454d40`;
key reader `FUN_004546b0`; text dump writers `FUN_00454820`/`FUN_00454980` give the field names. [sure]

```
u32 trackCount (1322)
trackCount × {
  u32 nameLen ; char name[nameLen]          // includes the NUL
  u32 nSubAnis ; nSubAnis × { u32 len ; char subAniName[len] }   // "mappedSubAni"
  u32 nKeys    ; nKeys × Key (44 bytes)
  i32 flags ; i32 timeSyncStart ; i32 timeSyncLoopLabel ; i32 timeSyncLoopPoint
}
Key = { i32 frm ; f32 moveX, moveY, moveZ ; i32 subAniID ; i32 subAniFrame ; i32 frameTime ;
        f32 cX, cY, cZ ; u32 flags (low byte; upper bytes 0xCDCDCD) }
```

In memory a key is 0x2C bytes with `frameTime` moved to +0x24 and `subAniID` replaced by the resolved
serial. `subAniID` indexes the track's subani name list (names resolve via `FUN_00450140`, so they could
also be tracks/directions; in the shipped file all are APC entries, and every `subAniFrame` is within range).

A **track** is one actor's animation timeline (not a camera path, not tied to the .smk files):
which subani frame to show, for how long, how to move the actor, and where the sprite's anchor is.
Walk cycles (`ronja__234_vast`: 10 keys, move −4,0 per key, 83 ms) and stand frames, talk loops,
interaction animations (`ronja_2a_086A1_taStege` = take ladder), and synchronised dialogue scenes.

| Field | Meaning |
|---|---|
| `frm` | key number (always = index) |
| `moveX/Y/Z` | movement applied when this key becomes current (see playback). Key 0 of absolute tracks holds the authoring position (e.g. `lillK_1c_026A1_RovarMusik` at 792, 400, z 1520) |
| `subAniID`, `subAniFrame` | sprite frame to show |
| `frameTime` | display time in ms (83 = 12 fps: 10171 keys; 166, 120, 60, 332, …) |
| `cX, cY` | anchor: the actor's position point inside the sprite frame (Ronja 64,169 in a 120×200 frame = between the feet); `cZ` (−50, 0, −100, …) a depth bias [likely] |
| key `flags` bit 0 | draw unscaled: perspective scale forced to 1.0 (`FUN_00456620`) [sure] |
| track `flags` bit 0 | "relative start": do **not** place the actor at key 0's move (`+0x18`) [sure] |
| track `flags` bit 1 | ignore moveZ (`+0x19`) [sure] |
| `timeSyncStart` | key at which the actor's sound starts (actor flag 0x200) [sure] |
| `timeSyncLoopLabel/Point` | while the sound is still playing, reaching key `LoopPoint` jumps back to `LoopLabel`; once it has finished, a key in [Label..Point] jumps to `LoopPoint + 1` (actor flag 0x400) — lip-sync talk loops. −1 = none [sure] |

**Playback** (`FUN_00455cc0`, per actor): accumulate elapsed ms; while it exceeds the current key's
`frameTime`, advance: fire the track callback (`0x400000 | key`), handle sound start/talk loop, at the end
either repeat (repeat counter `+0x25C`), start the follow-up track, or call the completion callback. On
entering key *k*: if *k* = 0 and not relative-start → position := (moveX, moveY[, moveZ]); else
`move(dx, dy, dz)` (`FUN_00456710`) where **dx, dy are multiplied by the current perspective scale** and
dz is added unscaled (0 if ignore-Z). Then `setAniFrame(subAniID, subAniFrame)` and the anchor
(cX, cY, cZ → ints at actor `+0x23C`) is stored.

**Perspective scale** (`FUN_00456620`): if the actor follows the ground, z := H[y][x]; then
`scale = focal / (zOffset + z)` with focal/zOffset from `scene.nfo`; scale = 10 if `zOffset+z < 1` or
the result > 10; scale = 1 when the key flag bit 0 is set. [sure]

**Actors and sync groups** [sure]: the text before the first `_` names the actor (`FUN_0045a620`,
e.g. `ronja`, `Birk`, `lillK`); tracks sharing the rest of the name (`_1c_026A1_RovarMusik`) form a
group (`DAT_004e1bb8`) that is started together for a multi-actor dialogue line; 128 groups have >1 track.
Sounds bind to tracks through the same names (§7).

---

## 4. `scene.nfo` (252 bytes) — `scene-nfo.ts` [sure]

21 records read in order by `FUN_0046a9b0` (one call per scene in `FUN_0046b5d0`):
`{ u32 recordSize (=12, includes itself; reader seeks start+size) ; f32 focal → scene+0xF0 ; f32 zOffset → scene+0xF4 }`.
Order: 1A Skalle-Pers room 784, 1B Lovis/Mattis room 783, 1C great hall 1673, 1D kitchen 742,
2A castle yard 2234, 2B armoury 1000, 3 Hell's gap 717, 4 tower 811, 5 forest view 1000, 6 cellar 1258,
7 dungeons 730, 8 castle gate 983, 9A forest 1445, 10 spring 877, 12 glade 1566, 13 "Glupafallet" 1854,
14 pond 850, 15 cave outside 745, 16 cave inside 893, 17 labyrinth 700, 18 board game 661. zOffset = 0 for all.
Example: castle yard at z = 1700 → scale 1.31, z = 4000 → 0.56.

## 5. `language.str` (11 156 bytes) — `language.ts` [sure]

`u32 count (173)` then `count × { cstr key ; cstr text }`, Windows-1252 (only non-ASCII: 0x92 `’`).
Keys are the sound names of dialogue **choices** (`RONJA_1a_013A1Alt1_JagHarInget` → "Ik heb niets te doen.").
The loader `FUN_0041cc40` ignores the count and the keys: it assigns the *i*-th text to the *i*-th
hard-wired dialogue object (pointer table at `0x49AB98`, `DAT_0049ab94` = 173 entries), so **order matters**;
only 91 keys are distinct (the same choice appears in several menus). Spoken lines have no subtitles.

## 6. Font: `normalFont.fnt` + `normalFont.sz` — `font.ts` [sure]

* `.fnt` is a **TGA**: type 2, 256×256, 32-bit BGRA, descriptor 0x08 (bottom-up), TGA 2.0 footer
  (`TRUEVISION-XFILE`). 16×16 grid of 16×16 cells, cell index = byte value. Transparent texels are
  (255,255,255, α=0x44); glyphs opaque (yellow fill `#EAE9B6`, dark brown outline `#312508`).
  Loaded by `FUN_0041a3a0` into a HW surface (probably converted to ARGB4444, making the background
  ≈27 % white — whether that haze shows in game is unverified [guess]; `BitmapFont.transparentBelow` skips it).
* `.sz`: 256 × `{ i32 x, y, width, height, ascent }` (5120 bytes) read over a hard-coded default table
  (`FUN_00407720`, which builds the same grid with `FUN_004076d0`). Height 15; ascent 13 (10 for p q y,
  12 for old-style digits 3–7, 9).
* Drawing (`FUN_0041a4e0` → `FUN_0041a570`): for each byte *c* (first char 0, 256 chars), blit
  `(x, y, width, height)` from the atlas to `(penX, penY + 16 − ascent)`, then `penX += width`.
  The atlas has digits, A–Z, a–z, `! ? @ & , - . ’` and Swedish å ä ö Å Ä Ö (at both their CP1252 and
  CP437 positions, plus æ ø Ø); every other cell is a small dark square (so é/ë render as a dot).
  Characters without a tuned entry keep the default width 15.

## 7. Sounds — `wav.ts`, `music.ts`

* `sounds/DIALOUGE.wav/<actor>_<scene>_.wav/*.wav` (559 + 22) and `sounds/EFFECT.wav/*.wav` (38): the
  `.wav`-named **folders** are deliberate — the engine scans `"%s\*.wav"` recursively (`FUN_00451900`).
  Formats: 617 × PCM 16-bit mono 22 050 Hz, 1 × PCM stereo 44 100 Hz (`EFFEKT_8_888_Allafryser`),
  1 × IMA ADPCM mono 22 050 Hz (`EFFEKT_8_888_Ground`; `src/engine/adpcm.ts` decodes it). Some carry a `LIST` chunk.
* Sound name = file name without extension; registered as `0x400000 + i` (`FUN_00451650`) together with
  its actor (prefix) and the tracks it drives: the track with the same name (or name + `A`) plus all
  other tracks in that track's sync group. Only 227 of 619 file names equal a track name exactly; the rest
  play via sync groups or explicit code.
* `sounds/MUSIC.wav/dls_*.wav` (19) are **not WAVs**: IFF `FORM XDIR { INFO }`, `CAT XMID { FORM XMID { TIMB, EVNT } }`,
  `FORM XDLS { RIFF 'MLS ' | 'DLS ' }` (IFF sizes big-endian, the inner RIFF little-endian).
  XMIDI = Miles extended MIDI: intervals are runs of bytes < 0x80 that are summed; note-on is followed by a
  VLQ duration (no note-offs); 120 ticks/s. `MLS ` (15 files) = DLS level 1 whose waves are IMA ADPCM
  (tag 0x11, 512-byte blocks) plus a `pcm ` chunk (original WAVEFORMATEX) and `fact`; `DLS ` (4) = plain PCM.
  Content: ambient loops/one-shots (`dls_eld_40_` = one 85 s fire note, `dls_borggarden__` = 53 notes of
  dogs/sheep/birds over 154 s, lyre music in `forsen1`, `prickaRovarna`, `spelaTarning`). `xmidiToSmf()`
  converts to a format-0 SMF (60 PPQN @ 120 bpm), `mlsToDls()` decodes the ADPCM (bit-exact vs. ffmpeg)
  and rebuilds a PCM DLS (pool table recomputed) for a DLS-capable synth. The number in the file name
  (`_40_`, `_88_`, `_70vol`) is probably a volume [guess]. `forsenBrus`/`Forsengrottan` sequence 2018
  notes over ~67 min (a long noise bed) — check in-game if it matters.

## 8. Save games `RONJAS<n>.sav` — `savegame.ts`

[sure for layout, field meanings partly guessed] n = 0..15, plain files in the current directory (no
registry; `HKLM\Software\O2Games\Ronja` only holds `SCURRglob{Subanis,Tracks,Sounds,Smacker,Exe}Path`,
defaults `subanis`, `tracks`, `sounds`, `smacker`, read by `FUN_00401640`). Writer `FUN_004049d0`
(`SaveRONJA`, `FUN_0046f640`), reader `FUN_00404920` (`LoadRONJA`, `FUN_0046f740`), slot list `FUN_00404610`.

| Size | Content |
|---|---|
| 9600 | thumbnail 80×60 u16, RGB444 (engine ORs 0xF000), top-down; drawn at x = 141 + 90·(n%4), y = 87 + 80·⌊n/4⌋ on the load/save page |
| 92 | gVar (`FUN_0041e6e0`): 5 × u32 (+0xE8..+0xF8), 68 × u8 flags (+0xFC..+0x13F), u32 0x58 check |
| 49 × 55 | objects (`FUN_0046e020`) in order RONJA, BIRK, MATTIS, LOVIS, BERATTAREN, SKALLEPER, LILLKLIPPEN, FJOSOK, STURKAS, TJEGGE, LABAS, BORKA, BORKAROV, ASKEN, BRODKAKA, DJUR1-3, ELDSTAL, ELD1-4, FACKLA, FISKNAT, FLINTA, FNOSKE, GRADVARG, HINDER, KARTAN, KISTLOCK, KNIV, KOTTE, LAX, MOROTTER, NYCKEL, OST, RATTA, RATTBUR, REM, RUMPNISSE, SKUMTROLL, SNOBOLL, STEGE, TARNING, UNDERJORD, VATTENKARL, VITMOSSA, VILDVITTRA: `u32 id, u32 sceneId (0 = none), f32 x, y, z, u32 ×4 unknown (+0x22C, +0x234, +0x230, +0x238), i32 anchor x, y, z, u8 followGround, u8 keyFlags, u8 hidden, f32 scale` |
| 8 | scene (`FUN_0046efd0`): u32 current scene id, i32 pan (`DAT_004ee730`) |
| 32 | RONJA then BIRK (`FUN_0046f0d0`): f32 x, y, z, i32 direction 0..7 (−1 none) → `standStillAtDestination` + still track |
| 4 + 143 × 12 | BLOCKList (`FUN_0046f4d0`): u32 count (0x8F) + {u32, u32, u32} each [meaning unknown] |

Total 14 147 bytes. A browser port can store its own state instead; this is documented for completeness.

---

## Open questions
* APC stream flag 2 (+0x14) and what the per-frame bbox is used for.
* Exact sprite placement: `screen = position − anchor·scale − pan`? and how `cZ`/the Z-buffer test work
  (draw code `FUN_004567b0` / `changeInBlitSurface`, not traced).
* Meaning of the per-scene info-map ids (needs each scene's script), gVar fields and BLOCKList.
* Whether the font's α=0x44 background is visible in game.
