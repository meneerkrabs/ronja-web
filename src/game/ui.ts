// UI state shared by the input, inventory, map, menu and rendering code (CGameDlg fields, engine.md §4.9).

import type { Smacker } from '../engine/smacker.ts';
import type { SmackerPlayback } from '../engine/smacker-play.ts';
import type { Surface } from '../engine/surface.ts';

export interface Movie {
  name: string;
  smk: Smacker;
  playback: SmackerPlayback;
  surface: Surface;
}

export const ui = {
  /** raw mouse position clamped to the screen (dlg+0x358) */
  mouseX: 320, mouseY: 240,
  /** position the game logic uses (dlg+0x350), after the clamps of the current UI state */
  curX: 320, curY: 240,
  /** verb coin */
  coinOpen: false, coinX: 0, coinY: 0,
  /** left button pressed and not yet released / press time (real ms) */
  pressPending: false, pressTime: 0,
  /** inventory open, item held by the cursor (objId, 0 = none) */
  invOpen: false, held: 0,
  /** map open */
  mapOpen: false,
  /** ESC menu: open, page (0 main, 1 load, 2 save), confirm box (kind 1 load slot, 2 overwrite slot, 3 new game, 4 quit) */
  menuOpen: false, menuPage: 0, menuSlot: -1,
  confirmOpen: false, confirmKind: 0,
  /** dialogue running (dlg+0x5ee): cursor invisible unless choices show, clicks ignored */
  dialogBusy: false,
  /** a Smacker movie is playing (scene composition and input are suspended) */
  movie: null as Movie | null,
  /** end credits movie playing (Space/ESC leave) */
  credits: false,
  /** menu thumbnail of the current screen (80x60 RGB444) */
  thumb: new Uint16Array(80 * 60) as Uint16Array,
  /** cursor override requested by the current minigame / scripts (subani name + hotspot) */
};

export const CURSORS = {
  normal: { sub: 544, hx: 32, hy: 24 },
  hilite: { sub: 548, hx: 32, hy: 31 },
  O: { sub: 543, hx: 52, hy: 32 },
  N: { sub: 545, hx: 52, hy: 32 },
  NO: { sub: 546, hx: 52, hy: 32 },
  NV: { sub: 547, hx: 52, hy: 32 },
  V: { sub: 549, hx: 52, hy: 32 },
  S: { sub: 558, hx: 52, hy: 32 },
  invisible: { sub: 557, hx: 0, hy: 0 },
  tatita: { sub: 560, hx: 32, hy: 24 },
  forsenHilite: { sub: 555, hx: 32, hy: 24 },
  prickaRovare: { sub: 556, hx: 16, hy: 16 },
  prickaKotte: { sub: 559, hx: 14, hy: 12 },
} as const;
export type CursorName = keyof typeof CURSORS;
