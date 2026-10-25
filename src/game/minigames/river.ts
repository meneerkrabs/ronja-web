// River minigames: mode 1 (act 1, Ronja alone, GLUPAFALLET) and mode 7 (act 3, with Birk and the bird witch).
// Port of FUN_00424ad0 / FUN_00425200 / FUN_004250f0 / FUN_0045e190 / FUN_00425c40 (mode 1) and FUN_00425d10 / FUN_00426aa0 /
// FUN_00426840 / FUN_0045e250 / FUN_00427e00 (mode 7); helpers FUN_00423a80 (jump), FUN_00423fc0 (stand on a stone),
// FUN_004241a0 (stone -> raft), FUN_00424400 (raft -> stone), FUN_004246b0 (scroll check), FUN_004265e0/FUN_004265a0 (witch lanes).
// docs/re/game-logic.md §5.2, §5.3. The state names follow the RONJA members (+0x4fc state, +0x504 stone, +0x5b0 raft ...).

import {
  O, world, setPan, regionAt, registerMinigame, endMinigame, usePortal, hook, sample, depthVol, playMusic, stopMusic, masterFade,
  setG, g, inInv, core, TF_LOOP, type Obj, type Minigame,
} from '../api.ts';

// StenList 0x491c28 (47 stones): nb[NO,O,SO,SV,V,NV] (-1 none), x, y, z, slippery. Verified against the exe initialisers (stones 0-9,
// 15-18, 21-24, 26, 29, 34-46 read from the code; the rest from the documentation).
type Stone = readonly [number, number, number, number, number, number, number, number, number, number];
const STONES: readonly Stone[] = [
  [2, 4, 1, -1, -1, -1, 74, 353, 2184, 0], // 0
  [4, -1, 3, -1, -1, 0, 127, 381, 1985, 1], // 1
  [46, -1, 4, 0, -1, -1, 144, 318, 2681, 1], // 2
  [-1, 6, -1, -1, -1, 1, 179, 421, 1699, 0], // 3
  [-1, 5, -1, 1, 0, 2, 207, 353, 2241, 1], // 4
  [7, -1, 8, -1, 4, -1, 317, 356, 2234, 1], // 5
  [8, -1, -1, -1, 3, -1, 330, 426, 1742, 1], // 6
  [45, 9, -1, 5, -1, -1, 362, 328, 2554, 0], // 7
  [-1, 10, -1, 6, -1, 5, 391, 390, 1990, 0], // 8
  [-1, -1, 10, -1, 7, -1, 448, 338, 2488, 1], // 9
  [12, 13, 11, -1, 8, 9, 527, 386, 2097, 0], // 10
  [13, -1, -1, -1, -1, 10, 574, 434, 1751, 1], // 11
  [-1, -1, 13, 10, -1, -1, 580, 366, 2263, 1], // 12
  [14, 15, -1, 11, 10, 12, 653, 390, 2043, 0], // 13
  [-1, -1, 15, 13, -1, 44, 709, 351, 2444, 0], // 14
  [38, 17, 16, -1, 13, 14, 774, 385, 2081, 1], // 15
  [17, 18, -1, -1, -1, 15, 833, 427, 1800, 1], // 16
  [39, -1, 18, 16, 15, 38, 895, 395, 2071, 1], // 17
  [-1, -1, -1, -1, 16, 17, 973, 430, 1770, 0], // 18
  [-1, -1, 20, -1, 39, -1, 1071, 358, 2448, 0], // 19
  [-1, 22, 21, -1, -1, 19, 1137, 389, 2113, 0], // 20
  [22, -1, -1, -1, -1, 20, 1204, 427, 1811, 1], // 21
  [23, 24, -1, 21, 20, -1, 1277, 391, 2018, 0], // 22
  [42, -1, 24, 22, -1, 41, 1329, 364, 2366, 1], // 23
  [25, -1, 26, -1, 22, 23, 1385, 394, 2079, 0], // 24
  [-1, 27, -1, 24, -1, 42, 1440, 360, 2410, 1], // 25
  [-1, 29, -1, -1, -1, 24, 1467, 424, 1801, 1], // 26
  [-1, -1, -1, -1, 25, -1, 1539, 358, 2436, 0], // 27
  [-1, 30, -1, -1, -1, -1, 1558, 309, 3182, 0], // 28
  [31, 35, -1, -1, 26, -1, 1600, 427, 1748, 0], // 29
  [-1, 34, 32, -1, 28, -1, 1638, 309, 3187, 0], // 30
  [33, -1, 35, 29, -1, -1, 1671, 396, 2042, 0], // 31
  [34, 36, 33, -1, -1, 30, 1686, 332, 2774, 1], // 32
  [36, -1, -1, 31, -1, 32, 1732, 353, 2474, 1], // 33
  [-1, -1, 36, 32, 30, -1, 1730, 304, 3258, 0], // 34
  [-1, 43, -1, -1, 29, 31, 1748, 438, 1768, 0], // 35
  [-1, -1, -1, 33, 32, 34, 1780, 327, 2849, 1], // 36
  [-1, -1, -1, 43, -1, -1, 1869, 392, 2093, 0], // 37
  [-1, -1, 17, 15, -1, -1, 831, 362, 2411, 0], // 38
  [-1, 19, -1, 17, -1, -1, 956, 361, 2437, 0], // 39
  [-1, 41, -1, -1, -1, -1, 1191, 336, 2702, 0], // 40
  [-1, -1, 23, -1, 40, -1, 1292, 335, 2694, 0], // 41
  [-1, -1, 25, 23, -1, -1, 1386, 334, 2755, 0], // 42
  [37, -1, -1, -1, 35, -1, 1844, 445, 1697, 0], // 43
  [-1, -1, -1, -1, -1, -1, 632, 306, 2754, 0], // 44
  [-1, -1, -1, -1, -1, -1, 409, 318, 2785, 0], // 45
  [-1, -1, -1, 2, -1, -1, 182, 305, 2894, 0], // 46
];
const NB_X = 6, NB_Y = 7, NB_Z = 8, NB_SLIP = 9;

/** jump tracks per direction (NO,O,SO,SV,V,NV): HW track, track offset (x,y) the code subtracts, delta frames (first, count) */
const JUMP = [
  { track: 211, ox: 70, oy: -43, first: 2, n: 7 },
  { track: 157, ox: 144, oy: 0, first: 1, n: 8 },
  { track: 158, ox: 64, oy: 43, first: 2, n: 7 },
  { track: 214, ox: -56, oy: 43, first: 2, n: 7 },
  { track: 213, ox: -144, oy: 0, first: 1, n: 8 },
  { track: 159, ox: -66, oy: -43, first: 2, n: 7 },
] as const;
/** still tracks FUN_00423fc0 plays per jump direction (1 Ost, 2 SO, 3 SV, 4 Vast, 5 NV); direction 0 keeps the jump's last frame */
const STILL: Record<number, number> = { 1: 557, 2: 555, 3: 556, 4: 558, 5: 554 };
/** jump direction index -> facing (0 N, 1 NW, 2 W, 3 SW, 4 S, 5 SE, 6 E, 7 NE) for the normal-mode stand after the game */
const FACING = [7, 6, 5, 3, 2, 1];

const T_HALKAR = 209, T_CLIMB = 210, T_ON_RAFT = 1117, T_LOG = 862, T_REED = 863, T_WATER = 1235;
const RAFT_STONES = [3, 6, 11, 16, 18, 21, 26];
const RAFT_TO_STONE = [3, 6, 11, 16, 18, 21, 26, 29, 43];
const OFF_X = [0, 50, 45], OFF_Y = [0, -20, -10];

const LANE_A = [3, 6, 11, 16, 18, 21, 26, 29, 35, 43];
const LANE_B = [0, 8, 10, 13, 15, 17, 20, 22, 24, 31, 37];
const LANE_C = [2, 7, 9, 14, 19, 23, 25, 27, 33, 38, 39];

// ------------------------------------------------------------------ state (RONJA members +0x4e4..+0x5c4)
let mode: 1 | 7 = 1;
let active = false;
let state = -2;         // +0x4fc
let stone = -1;         // +0x504 (100 = on/jumping to a raft)
let jumpDir = 0;        // +0x508
let scrollDir = 0;      // +0x50c
let counter = 0;        // +0x500
let raft = 0;           // +0x5b0 (0 none, 1 = MATTIS object, 2 = SKALLEPER object)
let timer = -1;         // +0x5b4
let sink = false;       // +0x5b8
let slipLimit = 60;     // +0x5bc
let plaskDone = false, landaDone = false;   // +0x5b9, +0x5ba
const dX = new Float64Array(12), dY = new Float64Array(12), dZ = new Float64Array(12);
let fadeAt = 0;         // when the music fade of the end state started (0 = not yet)
// mode 7
let witch = 0;          // +0x4e8
let knocks = 0;         // +0x4ec
let armed = false;      // +0x4f0
let lane = -1;          // +0x4f4 (witch lane z, -1 none)
let propDone = true;    // +0x4f8 (floating branch gag finished)

const R = () => O.RONJA;
const rafts = (): [Obj, Obj] => [O.MATTIS, O.SKALLEPER];
const rnd = () => Math.floor(Math.random() * 32768); // FUN_00401510
const pan = () => world.scene?.pan ?? 0;
const panOf = (x: number) => Math.max(0, Math.min(127, Math.trunc((x - pan()) / 5) - 1)); // positional effect pan (§5 intro)

/** effects only start while the single sample channel is idle (FUN_0047ae70 == 0) */
function effect(name: string, vol: number, p: number) { sample.effect(name, Math.max(0, Math.min(127, Math.trunc(vol))), p); }

// ------------------------------------------------------------------ helpers of the original
/** FUN_00423fc0: put Ronja on a stone, with dir > 0 also store it as the current stone and play the still track. */
function stand(i: number, dir: number) {
  const s = STONES[i], r = R();
  r.setPosition(s[NB_X], s[NB_Y], s[NB_Z]);
  if (dir > 0) { stone = i; r.setTrack(STILL[dir]); }
}

/** FUN_004246b0: does the view have to scroll? Sets the scroll direction and the slip limit. */
function scrollCheck(): boolean {
  const p = pan(), d = R().x - p;
  if (d <= 500 && d >= 140) { slipLimit = 60; return false; }
  if (d > 500) {
    if (p === 0x500) { slipLimit = 60; return false; }
    scrollDir = 1; slipLimit = 140; return true;
  }
  if (p === 0) { slipLimit = 60; return false; }
  scrollDir = -1; slipLimit = 140; return true;
}

/** (scale + perspective of the target)/2 of FUN_00423a80 / FUN_00424400 (scene+0xf0 focal, +0xf4 z offset) */
function perspK(dstZ: number): number {
  const sc = world.scene!, den = sc.zOff + dstZ;
  const f = den >= 1 ? sc.focal / den : 10;
  return (f + R().scale) * 0.5;
}

function setDeltas(first: number, n: number, dx: number, dy: number, dz: number) {
  for (let i = first; i < first + n; i++) { dX[i] = dx; dY[i] = dy; dZ[i] = dz; }
}

/** FUN_00423a80(src, dst): jump to a neighbouring stone. */
function jump(src: number, dst: number) {
  if (!STONES[src]) return;
  jumpDir = STONES[src].slice(0, 6).indexOf(dst); // FUN_004239d0: -1 = not a neighbour
  if (jumpDir < 0) return;
  const a = STONES[src], b = STONES[dst], j = JUMP[jumpDir], k = perspK(b[NB_Z]);
  const dx = b[NB_X] - a[NB_X] - k * j.ox, dy = b[NB_Y] - a[NB_Y] - k * j.oy, dz = b[NB_Z] - a[NB_Z];
  setDeltas(j.first, j.n, dx / j.n, dy / j.n, dz / j.n);
  R().setTrack(j.track);
  state = 1; stone = dst;
}

/** FUN_004241a0(p): stone -> raft p+1 (state 0 only, from the stones on the front bank row). */
function jumpToRaft(p: number) {
  if (!RAFT_STONES.includes(stone)) return;
  const r = R(), ro = rafts()[p], d = r.x - ro.x;
  let track: number;
  const dy = (OFF_Y[p + 1] + ro.y - r.y - 43) / 7, dz = (1639 - r.z) / 7;
  if (d > 100 && d < 210) {
    setDeltas(2, 7, (ro.x + 60 + OFF_X[p + 1] - r.x + 66) / 7, dy, dz);
    track = 214;
  } else if (d < 65 && d > -115) {
    setDeltas(2, 7, (ro.x + 50 + OFF_X[p + 1] - r.x - 66) / 7, dy, dz);
    track = 158;
  } else return;
  stone = 100;
  r.setTrack(track);
  state = 6;
}

/** FUN_00424400(stone): raft -> stone (state 4 only, to the front row stones within 40..110 px). */
function raftToStone(i: number) {
  if (!RAFT_TO_STONE.includes(i)) return;
  const r = R(), s = STONES[i], k = perspK(s[NB_Z]), d = r.x - s[NB_X];
  const dy = s[NB_Y] - r.y, dz = (s[NB_Z] - r.z) / 7;
  let track: number;
  if (d >= 110 || d < 40) {
    if (d >= -40 || d <= -110) return;
    setDeltas(2, 7, (s[NB_X] - r.x - k * 70) / 7, (dy - k * -43) / 7, dz);
    jumpDir = 0; track = 211;
  } else {
    setDeltas(2, 7, (s[NB_X] - r.x - k * -70) / 7, (dy - k * -42) / 7, dz);
    jumpDir = 5; track = 159;
  }
  stone = i;
  r.setTrack(track);
  state = 1;
}

function parkRafts() {
  for (const ro of rafts()) { ro.setPosition(-200, 475, 1675); ro.followGround = true; }
}

function startFall() {
  R().setTrack(T_HALKAR);
  timer = -2; state = 5;
  effect('EFFEKT_13_1_RAMLA', depthVol(R().z), panOf(R().x));
}

/** per-frame displacement of the jump tracks: applied once on every key whose track move is not zero (DAT_004e9244 = key index) */
function applyDeltas() {
  const r = R(), tr = r.track;
  if (!tr) return;
  const i = r.keyIdx, key = tr.keys[i];
  if (!key || i >= 12 || key.moveX === 0) return;
  r.x += dX[i]; dX[i] = 0;
  r.y += dY[i]; dY[i] = 0;
  r.z += dZ[i]; dZ[i] = 0;
  r.refreshDepth();
}

/** FUN_00424810 / FUN_004248a0: the landing sound on the later frames of a jump (LANDA2 on a stone, LANDA1 on a raft). */
function landaSound(name: string) {
  if (!sample.playing() && R().keyIdx > 7 && !landaDone) {
    sample.play(name, Math.trunc(depthVol(R().z)) - 25, panOf(R().x));
    landaDone = true;
  }
}

/** FUN_00424760: splash on keys 10..13 of the fall */
function plaskSound() {
  const r = R();
  if (r.keyIdx > 9 && r.keyIdx < 14 && !plaskDone && r.track && r.track === core.assets.track(T_HALKAR) && !sample.playing()) {
    sample.play('EFFEKT_13_1_PLASK', Math.trunc(depthVol(r.z)), panOf(r.x));
    plaskDone = true;
  }
}

const fadeDone = () => fadeAt > 0 && performance.now() - fadeAt >= 2000;
function fadeOut() { // FUN_0047a710(0, 2000) every tick: the call is ignored while a fade runs
  if (!fadeAt) { fadeAt = performance.now(); masterFade(0, 2000); }
}

// ------------------------------------------------------------------ the bird witch (mode 7)
const W = () => O.VILDVITTRA;

function laneOfStone(s: number): 0 | 1 | 2 | 3 {
  return LANE_A.includes(s) ? 0 : LANE_B.includes(s) ? 1 : LANE_C.includes(s) ? 2 : 3;
}
const LANE_Z = [1759, 2056, 2370, 1639], LANE_Y = [200, 190, 170, 215];

/** FUN_004265e0(0): pick the lane of Ronja's stone and put the witch off screen to the left. */
function chooseLane() {
  const l = laneOfStone(stone);
  lane = LANE_Z[l];
  W().setPosition(pan() - (l === 3 ? 150 : 250), LANE_Y[l], LANE_Z[l]);
}

/** FUN_004265e0(1) + FUN_004265a0: the witch is in Ronja's lane and just behind her */
function diveTest(): boolean {
  const l = laneOfStone(stone);
  if (lane !== LANE_Z[l]) return false;
  if (l === 3 && state !== 4) return false;
  const d = R().x - W().x;
  return d > 100 && d < (stone === 4 ? 180 : 120);
}

function witchOff() { lane = -1; witch = 0; W().hidden = true; W().stopTrack(); }

/** FUN_004249b0 */
function laugh() {
  if (rnd() % 6 + 1 < 3 && !sample.playing()) {
    const x = W().x - pan();
    const p = x <= 0 ? 12 : x >= 640 ? 120 : 12 + Math.trunc((x * 108) / 640);
    sample.play('VILDVITTRA_13_333A1SAY1_HOHOLILLAVACKRA', 106, p);
  }
}

/** FUN_00426950: has the witch left (hides her when nothing keeps her on screen)? */
function witchGone(): boolean {
  const w = W(), p = pan();
  if (p + 1100 >= w.x) {
    if (!(p === 0x500 && w.x > 2000 && !sample.playing())) {
      if (stone === 28 || w.track) return false;
    }
  }
  lane = -1; witch = 0; w.hidden = true; w.stopTrack();
  return true;
}

function witchTick() {
  const r = R(), w = W(), rs = state;
  if (witch < 1) {
    if (rs === 0 || rs === 1 || rs === 4 || rs === 6) witch = 1; // (6: falls through to the common end in the original, state 1)
    return;
  }
  if (witch === 1) {
    if (lane < 0) chooseLane();
    if (!w.track) {
      w.setTrack(1010);
      const dx = w.x - pan();
      if (dx > -100 && dx < 100) laugh();
    }
    const p = pan();
    if (p + 1100 < w.x || (p === 0x500 && w.x > 2000 && !sample.playing())) witchOff();
    if (diveTest()) {
      armed = true; witch = 2;
      w.setTrack(1011);
      if (!sample.playing()) sample.play('EFFEKT_13_1_VILDVITTRASKRIK', 110, panOf(w.x));
    }
    return;
  }
  if (witch === 2) {
    if (w.keyIdx > 6 && w.keyIdx < 13 && (rs === 0 || rs === 4) && armed) {
      r.setTrack(T_HALKAR);
      timer = -2; state = 5;
      effect('EFFEKT_13_1_RAMLA', depthVol(r.z), panOf(r.x));
      knocks++;
    }
    if (!w.track) witch = 1;
    return;
  }
  if (witch === 3) {
    if (!w.track) w.setTrack(1010);
    const p = pan();
    if (p + 1100 < w.x || (p === 0x500 && w.x > 2000)) { lane = -1; w.hidden = true; w.stopTrack(); }
    if (!O.LOVIS.track) {
      witch = 4;
      r.setTrack(1086);
      O.LOVIS.hidden = true; O.LOVIS.stopTrack();
    }
    return;
  }
  if (witch === 4) {
    if (!sample.playing()) sample.play('VILDVITTRA_13_317A1SAY2_BLODETFLYTA', 106, 64); // FUN_00424a10
    if (!r.track) { setPan(0); r.setTrack(580); witch = 5; }
    return;
  }
  if (witch === 5) {
    if (!r.track) { r.setTrack(1083); w.setTrack(1084); witch = 6; }
    return;
  }
  if (witch === 6 && !r.track && !w.track) {
    w.hidden = true; w.stopTrack();
    state = 10;
  }
}

/** FUN_00426a00: the floating branch gag after Birk's jump (decoration, but the end waits for it) */
function branchTick() {
  if (propDone) return;
  const h = O.HINDER;
  if (!h.track) { h.setPosition(0, 365, 0); h.setTrack(861, TF_LOOP); }
  if (h.x >= 440) { h.setTrack(1234, TF_LOOP); propDone = true; }
}

hook('BIRK_13_GEN_FLYRVITTRA', {
  key: {
    0x17: () => { if (active && mode === 7 && !sample.playing()) sample.play('EFFEKT_13_1_plask', 110, 110); },
    0x1d: () => { if (active && mode === 7) { O.HINDER.hidden = true; O.HINDER.stopTrack(); } },
  },
  end: () => { if (active && mode === 7) propDone = false; },
});

// ------------------------------------------------------------------ the tick (FUN_00425200 / FUN_00426aa0)
function stateStone() {
  // state 0, idle on a stone: slippery stones drop Ronja after the slip limit
  if (timer >= 0) {
    timer++;
    if (slipLimit < timer) {
      R().setTrack(T_HALKAR);
      timer = -2; state = 5;
      effect('EFFEKT_13_1_RAMLA', depthVol(R().z), panOf(R().x));
    }
  }
}

function tick() {
  if (!active) return;
  const r = R();
  if (mode === 7) branchTick();
  switch (state) {
    case -4: { // mode 7: Birk walks to the bank, then flies at the witch
      const ok = O.BIRK.walkTo(408, 312, 0, (interrupted) => { if (!interrupted && state === -3) state = -2; }, -1);
      state = -3;
      if (!ok) state = -2; // unreachable: skip the walk
      break;
    }
    case -3: break;
    case -2:
      if (mode === 7) { O.BIRK.setTrack(1233); state = -1; break; }
      // mode 1: stand on the start bank, then jump 46 -> 2 (falls through to the state 0 code)
      jumpDir = 3; stone = 46;
      stand(46, jumpDir);
      jump(46, 2);
      stateStone();
      break;
    case -1:
      if (!O.BIRK.track) { O.BIRK.standStill(1613, 274, 0, 3); state = 0; }
      break;
    case 0: stateStone(); break;
    case 1:
      landaSound('EFFEKT_13_1_LANDA2');
      if (!r.track) {
        landaDone = false;
        stand(stone, jumpDir);
        timer = STONES[stone][NB_SLIP] === 1 ? 0 : -1;
        state = scrollCheck() ? 2 : 0;
        if (stone === 28 || stone === 44 || stone === 45 || stone === 46) state = 10;
      } else {
        if (mode === 7) armed = false;
        applyDeltas();
      }
      break;
    case 2:
      if (scrollDir !== 0) {
        const p = pan(), d = r.x - p;
        if (p >= 0 && p <= 0x500 && (d > 324 || d < 316)) setPan(Math.trunc(r.x - 320));
        scrollDir = 0; state = 0;
      }
      break;
    case 5: { // fallen into the water
      plaskSound();
      if (!r.track && timer === -2) {
        timer = 100;
        r.hidden = true; r.stopTrack();
        const st = r.x <= STONES[10][NB_X] ? 0 : r.x <= STONES[24][NB_X] ? 10 : 24; // checkpoints 0 / 10 / 24
        stand(st, -1); stone = st;
      } else if (timer < 100) {
        if (!r.track && timer === -3) {
          timer = -1; jumpDir = 2; plaskDone = false;
          stand(stone, 2);
          state = mode === 7 && knocks >= 3 ? 3 : 0;
        }
      } else if (timer < 200) {
        timer++;
        if (timer === 150 && scrollCheck()) { setPan(Math.trunc(r.x - 320)); scrollDir = 0; }
      } else {
        r.setTrack(T_CLIMB);
        if (!sample.playing()) sample.play('effekt_13_1_uppurvattnet', Math.trunc(depthVol(r.z)), panOf(r.x)); // FUN_00424a60
        timer = -3;
        if (mode === 7 && knocks > 2) { // the 3rd fall: the attacking witch (LOVIS object) comes for Ronja
          const off = stone === 0 ? [-198, -510] : stone === 10 ? [-200, -523] : [-208, -517];
          const s = STONES[stone], l = O.LOVIS;
          l.setTrack(1085);
          l.setPosition(s[NB_X] + off[0], s[NB_Y] + off[1], s[NB_Z]);
          witch = 3;
        }
      }
      break;
    }
    case 6: // jumping onto a raft
      landaSound('EFFEKT_13_1_LANDA1');
      if (!r.track) {
        landaDone = false;
        state = 4;
        r.setTrack(T_ON_RAFT, TF_LOOP);
        r.followGround = false;
        if (rnd() % 6 + 1 < 3) sink = true; // a third of the rafts sink when landed on
      } else {
        if (mode === 7) armed = false;
        applyDeltas();
      }
      break;
    case 10: endTick(); break;
  }
  if (!active) return;
  if (mode === 7) witchTick();
  raftTick();
}

/** state 10: fade the music, wait for the rafts and the witch, then leave */
function endTick() {
  fadeOut();
  if (mode === 7 && !O.VILDVITTRA.track && (stone === 28 || witch !== 6)) O.VILDVITTRA.setTrack(1010);
  if (fadeDone()) { stopMusic(); sample.stop(); counter++; }
  if (raft < 1) {
    const ready = mode === 1
      ? fadeDone() && raft === 0 && counter > 80
      : fadeDone() && raft === 0 && counter > 25 && witchGone() && propDone;
    if (ready) {
      const win = stone === 28;
      if (!win) {
        parkRafts();
        if (mode === 7) { witchOff(); }
        setPan(0);
        if (mode === 7) { O.BIRK.standStill(405, 134, 0, 4); O.BIRK.walkTo(308, 226, 0, null, -1); state = 11; }
      }
      finish(win);
    }
  } else {
    if (pan() + 640 < rafts()[raft - 1].x) raft = 0;
    sink = true;
  }
}

/** drifting rafts: spawn (1/50 per raft kind and tick while Ronja jumps/rides), drift, carry Ronja, sink */
function raftTick() {
  const r = R();
  if (raft < 1 && (state === 1 || state === 4 || state === 6)) {
    const v = rnd() % 50 + 1;
    if (v < 3) raft = v;
  } else if (raft > 0 && state !== 2) {
    const ro = rafts()[raft - 1], limit = mode === 1 ? 864 : 1658;
    if (ro.x >= limit || sink) {
      ro.followGround = false;
      ro.moveRelative(0, 0.2, 0);
      if (state === 4) {
        r.moveRelative(0, 0.2, 0);
        if (r.y > 478) startFall();
      }
      if (ro.y > 510) {
        raft = 0; sink = false;
        parkRafts();
      }
    } else {
      ro.moveRelative(1, 0, 0);
      if (state === 4) {
        r.setPosition(ro.x + OFF_X[raft], ro.y + OFF_Y[raft], r.z);
        if (scrollCheck()) {
          if (r.x > 140 && r.x < 1780) setPan(Math.trunc(r.x - 141));
          scrollDir = 0;
        }
      }
    }
  }
}

// ------------------------------------------------------------------ input
function inRect(o: Obj, x: number, y: number): boolean { // FUN_0041ff80: rectangle of the current frame (scene coordinates)
  if (o.x < -100 || !o.frame) return false;
  const rc = o.screenRect();
  if (!rc) return false;
  const p = pan();
  return x >= rc[0] + p && x < rc[2] + p && y >= rc[1] && y < rc[3];
}

function click(x: number, y: number) { // FUN_004250f0 / FUN_00426840
  if (!active || (state !== 0 && state !== 4)) return;
  const reg = regionAt(x, y);
  const idx = reg < 12 ? -1 : reg - 12;
  if (idx < 0) {
    if (raft > 0 && state === 0) {
      const ro = rafts()[raft - 1];
      if (ro.x < (mode === 1 ? 864 : 1658) && !sink) { // FUN_00424170 == 0: the raft still floats
        const [a, b] = rafts();
        if (inRect(a, x, y)) jumpToRaft(0);
        else if (inRect(b, x, y)) jumpToRaft(1);
      }
    }
  } else if (idx < STONES.length) {
    if (state === 0) jump(stone, idx);
    else raftToStone(idx);
  }
}

function cursor(x: number, y: number) { // FUN_0045e190 / FUN_0045e250
  if (!active || (state !== 0 && state !== 4)) return 'normal' as const;
  const [a, b] = rafts();
  if (regionAt(x, y) >= 12 || inRect(a, x, y) || inRect(b, x, y)) return 'forsenHilite' as const;
  return 'normal' as const;
}

// ------------------------------------------------------------------ start / end
/** the scene's own props (game-logic.md §3.15) that the minigame's scene change hides: the fishing net, Birk and the harpies */
function sceneProps() {
  if (!inInv(O.FISKNAT) && g(0x8df)) {
    if (O.FISKNAT.holder === O.MATTIS) O.FISKNAT.loop(1314);
    else if (O.FISKNAT.holder === null) O.FISKNAT.loop(1081);
  }
}

function begin(m: 1 | 7) {
  mode = m;
  active = false;
  state = m === 1 ? -2 : -4;
  stone = -1; jumpDir = 0; scrollDir = 0; counter = 0; raft = 0; timer = -1; sink = false;
  slipLimit = 60; plaskDone = false; landaDone = false; fadeAt = 0;
  dX.fill(0); dY.fill(0); dZ.fill(0);
  witch = 0; knocks = 0; armed = false; lane = -1; propDone = true;
  world.freezeCamera = true;
  setPan(0);
  sceneProps();
  O.ELD1.loop(T_WATER);
  O.MATTIS.loop(T_LOG);
  O.SKALLEPER.loop(T_REED);
  parkRafts();
  const r = R();
  r.hidden = false;
  if (m === 7) {
    O.BIRK.hidden = false;
    O.BIRK.standStill(408, 252, 0, 5);
    O.HINDER.loop(1234);
    stand(46, 3);
    stopMusic();
    void playMusic('dls_forsen3_113_5', 100, (113.5 / 120) * 100);
  } else {
    r.setPosition(182, 305, 2894);
    stopMusic();
    void playMusic('dls_forsen1_88_', 100, (88 / 120) * 100);
  }
  active = true;
}

/** FUN_00425c40 / FUN_00427e00: leave the game; a win flags the river, Ronja walks off through the GROTTANUTE exit */
function finish(win: boolean) {
  active = false;
  const r = R();
  endMinigame();
  for (const o of [O.MATTIS, O.SKALLEPER, O.LOVIS, O.VILDVITTRA]) { o.hidden = true; o.stopTrack(); }
  masterFade(127, 500);
  if (win) {
    setG(mode === 1 ? 0x8e1 : 0x8e2, 1);
    r.hidden = false;
    usePortal('EXIT_GLUPAFALLET_to_GROTTANUTE');
  } else {
    O.ELD1.loop(T_WATER);
    // back in normal mode: the camera is free again, Ronja stands on the bank facing where she jumped to
    r.hidden = false;
    r.followGround = true;
    const carried = mode === 7 && knocks >= 3; // carried off by the witch: she stays where the animation left her
    r.standStill(r.x, r.y, 0, carried ? (r.currDirec < 0 ? 4 : r.currDirec) : FACING[jumpDir] ?? 4);
  }
  void playMusic('dls_forsenBrus_30_100vol', 100, 25);
}

function make(m: 1 | 7): Minigame {
  return {
    mode: m,
    start() { begin(m); },
    tick,
    click,
    cursor,
    end() { active = false; world.freezeCamera = false; },
  };
}

registerMinigame(make(1));
registerMinigame(make(7));

// debug hook for tools/steps (?debug=1): read-only view of the state machine
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  (globalThis as Record<string, unknown>).__river = {
    stones: STONES,
    get s() { return { mode, active, state, stone, raft, timer, witch, knocks, counter, lane, propDone, sink, pan: pan() }; },
  };
}
