// Story state: gVar (0x4cf7d8). The serialised part is 5 ints (mode, act, scene id, unused, map bits) and 68
// byte flags 0x4cf8d4..0x4cf917. Flags are addressed by the low 12 bits of their address, exactly as the
// documentation writes them: `g(0x8d5)` = "g8d5" (Birk saved in the fog), `setG(0x90d, 1)` = torch lit.
// Plus the 143 x 3 hotspot use counters and the engine-busy bits.

import { OBJECT_NAMES, type SceneName, SCENES } from './types.ts';

export const FLAG_FIRST = 0x8d4;
export const FLAG_LAST = 0x917;

export interface GVar {
  /** 0 = normal adventure, 1..8 = minigame modes (1 river, 2 tarn cones, 3 ski, 4 labyrinth, 5 snowball, 6 cave cones, 7 river + witch, 8 dice). */
  mode: number;
  /** Story act 1..3 (g8c4). */
  act: number;
  /** Current scene id (g8c8), see SCENES. */
  scene: number;
  /** g8cc: unused. */
  cc: number;
  /** Map-discovered bits (g8d0): 1 SKOGEN, 2 KAELLAN, 4 TJAERNEN, 8 GLUPAFALLET, 0x10 GLAENTAN, 0x20 GROTTANUTE. */
  mapBits: number;
  flags: Uint8Array;
}

export const gv: GVar = { mode: 0, act: 1, scene: SCENES.BORGGARDEN, cc: 0, mapBits: 0, flags: new Uint8Array(FLAG_LAST - FLAG_FIRST + 1) };

/** Read flag gXXX (e.g. `g(0x8d5)`). */
export function g(addr: number): number {
  return gv.flags[addr - FLAG_FIRST];
}
export function setG(addr: number, v: number | boolean = 1): void {
  gv.flags[addr - FLAG_FIRST] = typeof v === 'boolean' ? (v ? 1 : 0) : v & 255;
}

/** Winter state W: act 2 and flags d5, d6, d7 all set. */
export const winter = (): boolean => gv.act === 2 && !!g(0x8d5) && !!g(0x8d6) && !!g(0x8d7);

/** Useful flag addresses (documentation: game-logic.md §2). */
export const F = {
  courtyardOver: 0x8d4, birkFog: 0x8d5, mattisTalk: 0x8d6, cellarShown: 0x8d7, lovisHelped: 0x8d8, carrots: 0x8d9,
  robbersScared: 0x8da, shelfMoved: 0x8db, ladderUp: 0x8dc, tarnWon: 0x8dd, snowballWon: 0x8de, caveDefended: 0x8df,
  skiDone: 0x8e0, river1: 0x8e1, river2: 0x8e2, skalleSnore: 0x8e3, birkPrison: 0x8e4, fog: 0x8e5, lovisSpinner: 0x8e6,
  torchesLeft: 0x8e7, stoveLit: 0x8e8, tinderInStove: 0x8e9, birkMet: 0x8ea, gapBirk: 0x8eb, cellarLit: 0x8ed,
  breadShelf: 0x8f0, labyrinthDone: 0x8f1, fromPrison: 0x8f2, prisonLitSeen: 0x8f3, breadBirk: 0x8f4, stoneHeap: 0x8f5,
  summer: 0x8f7, netRipe: 0x8fb, salmon: 0x900, mareBandaged: 0x901, horses: 0x902, birch: 0x904, lovisVisit: 0x905,
  stonePushed: 0x907, salmonRoasting: 0x908, caveFire: 0x90a, salmonEaten: 0x90b, knifeTaken: 0x90c, torchLit: 0x90d,
  vesselFull: 0x90e, chestOpen: 0x90f, drawerOpen: 0x910, logoPlayed: 0x911, gameStarted: 0x912, hallFire2: 0x913,
  hallFire3: 0x915,
} as const;

/** 143 hotspot groups x 3 verbs (MOUTH, HAND, EYE) use counters (0x4e08e0). */
export const useCount = new Int32Array(143 * 3);

/** Engine busy bits (DAT_004ee744). */
export const busy = { bits: 0 };

/** Last event id / chosen alt index of the dialogue that just finished (DAT_004bc000 / 004bc004), valid inside doneCb. */
export const lastDialog = { event: -1, alt: -1 };

/** gVar reset of "Nieuw spel" (FUN_0041e500): mode 0, act 1, flags cleared (the original keeps g8d9: we reset it too), counters cleared. */
export function resetGVar() {
  gv.mode = 0; gv.act = 1; gv.cc = 0; gv.mapBits = 0;
  gv.flags.fill(0);
  useCount.fill(0);
  busy.bits = 0;
}

export function snapshotGVar() {
  return { mode: gv.mode, act: gv.act, scene: gv.scene, cc: gv.cc, mapBits: gv.mapBits, flags: Array.from(gv.flags), useCount: Array.from(useCount) };
}
export type GVarSnapshot = ReturnType<typeof snapshotGVar>;
export function restoreGVar(s: GVarSnapshot) {
  gv.mode = s.mode; gv.act = s.act; gv.scene = s.scene; gv.cc = s.cc; gv.mapBits = s.mapBits;
  gv.flags.set(s.flags);
  useCount.set(s.useCount);
}

export const sceneIs = (n: SceneName): boolean => gv.scene === SCENES[n];
export const objectId = (name: (typeof OBJECT_NAMES)[number]): number => OBJECT_NAMES.indexOf(name) + 1;
