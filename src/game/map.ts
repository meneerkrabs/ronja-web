// The map (kartan, engine.md §4.6): opened from the inventory with EYE/HAND on the map item; shows the places the
// player has discovered and travels to them through the scene portals.

import { gv, winter } from './state.ts';
import { SCENES, type SceneName } from './types.ts';
import { transition } from './portals.ts';
import type { Renderer } from './render.ts';
import { ui, type CursorName } from './ui.ts';

/** Picture per discovered-bits value (mapN). */
const PICTURE: Record<number, number> = {
  1: 2, 3: 3, 7: 4, 9: 12, 0x0b: 8, 0x0d: 20, 0x0f: 5, 0x13: 16, 0x17: 18, 0x19: 13, 0x1b: 9, 0x1f: 6, 0x29: 15, 0x2b: 11,
  0x2d: 21, 0x2f: 23, 0x33: 17, 0x37: 19, 0x39: 14, 0x3b: 10, 0x3d: 22, 0x3f: 7,
};

export const mapPicture = (): string => `karta__gen_###_map${winter() ? 1 : PICTURE[gv.mapBits] ?? 1}`;

interface Spot { place: SceneName; x0: number; x1: number; y0: number; y1: number; bit: number; cursor: CursorName }
const SPOTS: Spot[] = [
  { place: 'BORGPORTEN', x0: 93, x1: 270, y0: 80, y1: 181, bit: 0, cursor: 'NV' },
  { place: 'SKOGEN', x0: 86, x1: 219, y0: 205, y1: 279, bit: 0x01, cursor: 'V' },
  { place: 'KAELLAN', x0: 234, x1: 339, y0: 203, y1: 270, bit: 0x02, cursor: 'N' },
  { place: 'TJAERNEN', x0: 234, x1: 352, y0: 292, y1: 344, bit: 0x04, cursor: 'N' },
  { place: 'GLUPAFALLET', x0: 185, x1: 406, y0: 361, y1: 407, bit: 0x08, cursor: 'S' },
  { place: 'GLAENTAN', x0: 388, x1: 540, y0: 152, y1: 221, bit: 0x10, cursor: 'NO' },
  { place: 'GROTTANUTE', x0: 385, x1: 494, y0: 245, y1: 309, bit: 0x20, cursor: 'O' },
];

/** Location bit of the current scene (FUN_00405c60). */
function locationBit(): number {
  switch (gv.scene) {
    case SCENES.SKOGEN: return 1;
    case SCENES.KAELLAN: return 2;
    case SCENES.TJAERNEN: return 4;
    case SCENES.GLUPAFALLET: return 8;
    case SCENES.GLAENTAN: return 0x10;
    case SCENES.GROTTANUTE: return 0x20;
    case SCENES.BORGPORTEN: return 0x40;
    case SCENES.GROTTANINNE: return 0x100;
    default: return 0x80; // the castle
  }
}

/** destination -> [from-mask, portal used] (tables 0x48a210 / 0x48a268) */
const TRAVEL: Record<string, Array<[number, string]>> = {
  BORGPORTEN: [[0x13f, 'EXIT_SKOGEN_to_BORGPORTEN'], [0x80, 'EXIT_BORGGARDEN_to_BORGPORTEN']],
  SKOGEN: [[0xc0, 'EXIT_BORGPORTEN_to_SKOGEN'], [0x136, 'EXIT_KAELLAN_to_SKOGEN'], [0x08, 'EXIT_GLUPAFALLET_to_SKOGEN']],
  KAELLAN: [[0xc1, 'EXIT_SKOGEN_to_KAELLAN'], [0x0c, 'EXIT_TJAERNEN_to_KAELLAN'], [0x130, 'EXIT_GLAENTAN_to_KAELLAN']],
  TJAERNEN: [[0x1f3, 'EXIT_KAELLAN_to_TJAERNEN'], [0x08, 'EXIT_GLUPAFALLET_to_TJAERNEN']],
  GLAENTAN: [[0xcf, 'EXIT_KAELLAN_to_GLAENTAN'], [0x120, 'EXIT_GROTTANUTE_to_GLAENTAN']],
  GLUPAFALLET: [[0x136, 'EXIT_TJAERNEN_to_GLUPAFALLET'], [0xc1, 'EXIT_SKOGEN_to_GLUPAFALLET']],
  GROTTANUTE: [[0xdf, 'EXIT_GLAENTAN_to_GROTTANUTE'], [0x100, 'EXIT_GROTTANINNE_to_GROTTANUTE']],
};

export function openMap() { ui.mapOpen = true; ui.invOpen = false; }
export function closeMap() { ui.mapOpen = false; }

export function drawMap(r: Renderer) {
  r.drawStream(mapPicture(), 0, 27, 20);
}

function spotAt(x: number, y: number): Spot | undefined {
  for (const s of SPOTS) {
    if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1 && (s.bit === 0 || (gv.mapBits & s.bit))) return s;
  }
  return undefined;
}

/** Cursor over the map: a direction arrow over an available place. */
export function mapCursor(x: number, y: number): CursorName {
  if (gv.act === 2 && winter()) return spotAt(x, y)?.place === 'BORGPORTEN' ? 'NV' : 'normal';
  return spotAt(x, y)?.cursor ?? 'normal';
}

/** Click on the map: travel to the place (BORGPORTEN is always allowed; the others once discovered, never in winter). */
export function mapClick(x: number, y: number) {
  const s = spotAt(x, y);
  if (!s) return;
  if (winter() && s.place !== 'BORGPORTEN') return;
  const here = locationBit();
  const row = TRAVEL[s.place]?.find(([mask]) => mask & here);
  closeMap();
  if (!row) return; // the place you are in: just closes the map
  transition(row[1]);
}
