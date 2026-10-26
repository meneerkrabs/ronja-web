// Minigame mode 4: the cellar labyrinth (LABYRINT, 36 rooms). game-logic.md §5.1; start FUN_00421240, tick FUN_00421f80,
// click FUN_00421d10, arrival callback LAB_00421ab0, flame FUN_004215b0/FUN_004218f0, leave FUN_00422230, LabyrintList 0x491b90.
// Birk's object is the torch flame; Ronja gets the torch-carrying track sets while inside.

import { devHandle } from './_mg.ts';
import { O, setG, regionAt, registerMinigame, endMinigame, enterScene, sceneGfx, setPan, playMusic, stopMusic, sample } from '../api.ts';

/** exits[r-1] for click regions 1..5: -1 none, 0 back to the cellar, 100 Birk's prison. gfx = room picture, hint = correct exit. */
interface Node { exits: number[]; pan: number; vol: number; gfx: string; hint: number }
const N = (gfx: string, exits: number[], hint: number, pan: number, vol: number): Node => ({ gfx, exits, hint, pan, vol });
const X = -1;
// LabyrintList 0x491b90 (§5.1 table). Index 0 is the dummy "cellar".
const LIST: Array<Node | null> = [
  null,
  N('S01a', [0, 4, X, 5, 2], 4, 105, 100),
  N('A03b', [X, 1, X, 3, X], 0, 55, 60),
  N('A01b', [2, X, X, X, X], 0, -1, 10),
  N('A02a', [X, X, X, 1, X], 0, 105, 60),
  N('A05b', [X, 1, 7, X, 6], 3, 80, 100),
  N('A01b', [5, X, X, X, X], 0, 20, 60),
  N('A06a', [8, 9, X, 5, X], 2, 55, 100),
  N('A02a', [X, X, X, 7, X], 0, 105, 60),
  N('A09b', [7, 11, 12, 13, 10], 4, 105, 100),
  N('A01b', [9, X, X, X, X], 0, 20, 60),
  N('A02a', [X, X, X, 9, X], 0, 105, 60),
  N('A02a', [X, X, X, 9, X], 0, 105, 60),
  N('S13a', [9, X, 17, 15, 14], 3, 80, 100),
  N('A03b', [X, 13, X, 16, X], 0, 55, 60),
  N('A03b', [X, 13, X, 16, X], 0, 55, 60),
  N('A04a', [15, X, 14, X, X], 0, 20, 10),
  N('A08a', [20, 18, 19, X, 13], 1, 20, 100),
  N('A01b', [17, X, X, X, X], 0, 20, 60),
  N('A01b', [17, X, X, X, X], 0, 20, 60),
  N('S20b', [23, 24, 25, 21, 17], 4, 105, 100),
  N('A03b', [X, 20, X, 22, X], 4, 105, 100),
  N('A05b', [X, 21, 26, X, 29], 5, 80, 100),
  N('S21b', [27, X, 28, 20, X], 0, 105, 60),
  N('A02a', [X, X, X, 20, X], 0, 105, 60),
  N('A01b', [20, X, X, X, X], 0, 20, 60),
  N('A02a', [X, X, X, 22, X], 0, 105, 60),
  N('A02a', [X, X, X, 23, X], 0, 105, 10),
  N('A01b', [23, X, X, X, X], 0, 20, 10),
  N('A05b', [X, 22, 33, X, 30], 3, 80, 100),
  N('A01b', [29, X, X, X, X], 0, 20, 60),
  N('A02a', [X, X, X, 32, X], 0, 105, 60),
  N('S34a', [31, 34, 33, 100, X], 4, 105, 100),
  N('S30b', [32, 35, 36, X, 29], 1, 20, 100),
  N('A03b', [X, 32, X, 35, X], 2, 55, 100),
  N('A04a', [34, X, 33, X, X], 1, 20, 100),
  N('A01b', [33, X, X, X, X], 0, 20, 60),
];

/** exit points the player walks to (click regions 1..5) */
const EXIT_PT: Array<[number, number]> = [[118, 317], [307, 268], [399, 269], [471, 291], [587, 346]];
/** exit rectangles x,y,w,h (FUN_00421ea0, inclusive) */
const EXIT_RECT: Array<[number, number, number, number]> = [[72, 277, 136, 89], [243, 210, 104, 96], [354, 225, 81, 80], [435, 241, 96, 77], [478, 300, 129, 65]];
/** arrival table by entry index e = 0..5: stand (x,y,dir), then step to (x,y) */
const ARRIVE: Array<[number, number, number, number, number]> = [
  [332, 348, 0, 332, 328], [118, 317, 5, 138, 337], [307, 268, 4, 307, 288], [399, 269, 4, 399, 296], [471, 291, 3, 491, 311], [587, 346, 2, 567, 346],
];
/** torch-carrying track sets, by direction 0 N,1 NW,2 W,3 SW,4 S,5 SE,6 E,7 NE (T161/163/165/166/169/171/173/175 and T160/162/164/167/168/170/172/174) */
const STILL_TORCH = [165, 163, 171, 175, 169, 173, 166, 161];
const WALK_TORCH = [164, 162, 170, 174, 168, 172, 167, 160];
const STILL_NORMAL = [559, 554, 558, 556, 560, 555, 557, 553];
const WALK_NORMAL = [148, 150, 137, 138, 139, 147, 146, 149];
/** flame offset from Ronja by facing (FUN_004215b0): dx, dy, dz */
const FLAME: Array<[number, number, number]> = [
  [21, -144, 0], [-32, -141, 0], [-42, -144, 0], [-41, -144, 0], [-22, -142, -110], [23, -141, -110], [37, -144, 0], [29, -141, 0],
];
const T_RAK = 792, T_VAST = 396, T_NORR = 790, T_OST = 791;
const DROPS = ['EFFEKT_17_1_droppe1', 'EFFEKT_17_1_droppe2', 'EFFEKT_17_1_droppe3', 'EFFEKT_17_1_droppe4', 'EFFEKT_17_1_droppe5', 'EFFEKT_17_1_droppe6', 'EFFEKT_17_1_vind2', 'EFFEKT_17_1_droppe3'];

const lab = { active: false, state: 0, cur: 1, goTo: 0, busy: false };

/** 0 N .. 7 NE: place the flame (Birk object) relative to Ronja for her facing */
function placeFlame(): void {
  const R = O.RONJA;
  const d = R.currDirec < 0 ? 4 : R.currDirec & 7;
  const [dx, dy, dz] = FLAME[d];
  const s = R.scale;
  O.BIRK.setPosition(R.x + dx * s, R.y + dy * s, R.z + dz);
}

function exitRectOf(x: number, y: number): number {
  for (let i = 0; i < 5; i++) {
    const [rx, ry, w, h] = EXIT_RECT[i];
    if (x >= rx && x <= rx + w && y >= ry && y <= ry + h) return i + 1;
  }
  return 0;
}

function setTorchSets(on: boolean): void {
  O.RONJA.setStillTracks(on ? STILL_TORCH : STILL_NORMAL);
  O.RONJA.setWalkTracks(on ? WALK_TORCH : WALK_NORMAL);
}

/** FUN_00421240: the room is already loaded by startMinigame (scene LABYRINT, gfx of node 1) */
function start(): void {
  lab.active = false;
  lab.state = 0; lab.cur = 1; lab.goTo = 0; lab.busy = false;
  const R = O.RONJA;
  setTorchSets(true);
  R.followGround = true;
  R.standStill(118, 310, 0, 5);
  O.BIRK.hide();
  placeFlame();
  R.walkTo(138, 330, 0, null, 5);
  setPan(0);
  void playMusic('dls_labyrinten_224_', 125, 186.67);
  lab.active = true;
}

/** LAB_00421ab0: Ronja reached the clicked exit */
function arrived(interrupted: boolean): void {
  if (interrupted) return;
  lab.busy = true;
  placeFlame();
  if (lab.state === 0) {
    const old = lab.cur;
    const node = LIST[lab.goTo];
    if (!node) { lab.busy = false; return; }
    enterScene('LABYRINT', { minigame: true, force: true, gfx: sceneGfx('LABYRINT', node.gfx) ?? undefined });
    setPan(0);
    const e = node.exits.indexOf(old) + 1; // FUN_004211e0: 1-based index of the old node, 0 if absent
    lab.cur = lab.goTo; lab.goTo = 0;
    const [sx, sy, sd, wx, wy] = ARRIVE[e];
    const R = O.RONJA;
    R.followGround = true;
    R.standStill(sx, sy, 0, sd);
    R.walkTo(wx, wy, 0, null, sd);
    placeFlame();
  } else {
    lab.cur = lab.goTo; lab.goTo = 0;
    lab.state = 10;
  }
  lab.busy = false;
}

function click(x: number, y: number): void {
  if (!lab.active || lab.busy || lab.state === 10) return;
  const r = regionAt(x, y);
  const R = O.RONJA;
  const node = LIST[lab.cur]!;
  const target = r >= 1 && r <= 5 ? node.exits[r - 1] : X;
  if (target === X) { // not an exit: plain walk (y clamped to 390); a pending exit walk is dropped
    lab.state = 0;
    R.walkTo(x, Math.min(y, 390), 0, null, -1);
    return;
  }
  lab.goTo = target;
  lab.state = target === 0 ? 1 : target === 100 ? 2 : 0; // reset on every click (the original's latent hang is not replicated)
  const [ex, ey] = EXIT_PT[r - 1];
  R.walkTo(ex, ey, 0, arrived, -1);
}

function cursor(x: number, y: number): 'normal' | 'N' | 'NO' | 'O' | 'V' {
  switch (regionAt(x, y)) {
    case 1: return 'V';
    case 2: case 3: return 'N';
    case 4: return 'NO';
    case 5: return 'O';
    default: return 'normal';
  }
}

function tick(): void {
  if (!lab.active) return;
  if (lab.state === 10) { leave(); return; }
  if (lab.busy) return;
  const R = O.RONJA, B = O.BIRK;
  const node = LIST[lab.cur]!;
  // a) the flame direction hint, re-chosen when the flame animation ended
  if (!B.playing) {
    const p = exitRectOf(R.x, R.y);
    let t = T_RAK;
    if (p !== 0 && p === node.hint) t = p === 1 ? T_OST : p <= 3 ? T_NORR : T_VAST;
    B.setTrack(t, 0);
  }
  // b) flame placement
  placeFlame();
  // c) ambient drops: 8/300 per tick
  if (lab.state === 0 && !sample.playing()) {
    const k = rnd() % 300;
    if (k < 8) sample.effect(DROPS[k], node.vol, node.pan);
  }
}

function rnd(): number { return Math.floor(Math.random() * 32768); }

/** FUN_00422230 */
function leave(): void {
  const success = lab.cur === 100;
  lab.active = false;
  sample.stop();
  stopMusic();
  O.BIRK.stopTrack();
  setTorchSets(false);
  const R = O.RONJA;
  endMinigame();
  if (success) {
    setG(0x8f1, 1);
    R.setPosition(226, 244, 0);
    enterScene('FANGELSEHALOR');
  } else {
    enterScene('KAELLARE', { force: true });
    setPan(640);
    R.followGround = true;
    R.standStill(828, 352, 0, 5);
  }
}

registerMinigame({
  mode: 4,
  start,
  tick,
  click,
  cursor,
  end() { lab.active = false; setTorchSets(false); },
});

devHandle('lab', { lab, LIST });
