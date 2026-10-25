// Scene exits ("portals", ScurrPortals.cpp, engine.md §3.7/§3.8). A portal EXIT_A_to_B stands in scene A at (x, y);
// walking into it plays its leave-track and moves Ronja to the partner portal EXIT_B_to_A in scene B, facing the
// partner's direction mask, playing the partner's arrive-track. In act 3 Birk follows to the partner's Birk position.

import { gv, busy } from './state.ts';
import { O, setPan } from './world.ts';
import { BUSY_PORTAL, type Dir, type SceneName } from './types.ts';
import { enterScene } from './engine.ts';

export interface Portal {
  name: string;
  scene: SceneName;
  to: SceneName;
  /** where Ronja stands at this exit / arrives when coming through the partner */
  x: number;
  y: number;
  /** facing bit mask (bit n = direction n) used when arriving here */
  dirMask: number;
  /** track played when leaving through this portal */
  leave?: string;
  /** track played when arriving at this portal */
  arrive?: string;
  /** Birk's position here (act 3) */
  birk?: [number, number];
  /** partner portal name */
  target: string;
}

type Row = [SceneName, SceneName, number, number, number, string?, string?, number?, number?, string?];
const ROWS: Row[] = [
  ['SKALLEPERSRUM', 'TORNET', 306, 268, 0x20, 'ronja_1a_614a1_garuppitorn'],
  ['SKALLEPERSRUM', 'LOVISMATTISRUM', 486, 271, 0x08],
  ['LOVISMATTISRUM', 'SKALLEPERSRUM', 355, 179, 0x10],
  ['LOVISMATTISRUM', 'STORASALEN', 500, 378, 0x08, 'ronja_1b_618a1_garstorasal'],
  ['STORASALEN', 'LOVISMATTISRUM', 192, 352, 0x20, 'ronja_1c_619A1_garLovisMattis'],
  ['STORASALEN', 'BORGGARDEN', 362, 229, 0x10],
  ['STORASALEN', 'KOKET', 1070, 263, 0x08],
  ['KOKET', 'STORASALEN', 125, 235, 0x40],
  ['KOKET', 'BORGGARDEN', 241, 244, 0x10],
  ['KOKET', 'KAELLARE', 224, 344, 0x80, 'ronja_1d_620a1_garnerkallare'],
  ['BORGGARDEN', 'BORGPORTEN', 413, 320, 0x40],
  ['BORGGARDEN', 'KOKET', 761, 272, 0x10],
  ['BORGGARDEN', 'STORASALEN', 1140, 305, 0x08],
  ['BORGGARDEN', 'HELVETESGAPET', 1720, 341, 0x08, 'RONJA_2A_086A1_KlattraStege', 'RONJA_2A_624A1_garNerStege'],
  ['HELVETESGAPET', 'BORGGARDEN', 10, 270, 0x40],
  ['TORNET', 'SKALLEPERSRUM', 166, 317, 0x20, 'ronja_4_615a1_garnerfrantorn'],
  ['KAELLARE', 'KOKET', 208, 411, 0x20, 'ronja_6_622a1_garuppkallare', 'ronja_6_621a1_garnerkallare'],
  ['KAELLARE', 'FANGELSEHALOR', 782, 342, 0x10, 'ronja_6_123A1_taHylla'],
  ['FANGELSEHALOR', 'KAELLARE', 226, 244, 0x10],
  ['BORGPORTEN', 'BORGGARDEN', 28, 264, 0x20],
  ['BORGPORTEN', 'SKOGEN', 539, 418, 0x08],
  ['SKOGEN', 'BORGPORTEN', 179, 197, 0x20],
  ['SKOGEN', 'KAELLAN', 748, 215, 0x10, undefined, undefined, 755, 219],
  ['SKOGEN', 'GLAENTAN', 525, 236, 0x08, undefined, undefined, 543, 234],
  ['SKOGEN', 'GLUPAFALLET', 1234, 240, 0x08, undefined, undefined, 1248, 236],
  ['KAELLAN', 'SKOGEN', 597, 152, 0x08, undefined, undefined, 620, 152],
  ['KAELLAN', 'GLAENTAN', 48, 234, 0x80, undefined, undefined, 60, 234],
  ['KAELLAN', 'TJAERNEN', 272, 222, 0x08, undefined, undefined, 300, 200],
  ['GLAENTAN', 'KAELLAN', 506, 244, 0x10, undefined, undefined, 500, 250],
  ['GLAENTAN', 'GROTTANUTE', 158, 270, 0x20, undefined, undefined, 171, 263],
  ['GLAENTAN', 'SKOGEN', 880, 207, 0x20, undefined, undefined, 900, 226],
  ['GLUPAFALLET', 'SKOGEN', 509, 156, 0x08, undefined, undefined, 482, 152],
  ['GLUPAFALLET', 'TJAERNEN', 474, 262, 0x08, 'ronja_13_gen_uppforbro', 'ronja_13_gen_nerforbro', 504, 240],
  ['GLUPAFALLET', 'GROTTANUTE', 1526, 200, 0x10, undefined, undefined, 1526, 200],
  ['TJAERNEN', 'KAELLAN', 29, 408, 0x80, undefined, undefined, 33, 418],
  ['TJAERNEN', 'GLUPAFALLET', 570, 301, 0x04, undefined, undefined, 549, 292],
  ['GROTTANUTE', 'GLAENTAN', 387, 251, 0x10, undefined, undefined, 387, 251],
  ['GROTTANUTE', 'GLUPAFALLET', 14, 420, 0x40, undefined, undefined, 14, 420],
  ['GROTTANUTE', 'GROTTANINNE', 146, 268, 0x20, 'ronja_15_608a1_garingrotta', undefined, 138, 283],
  ['GROTTANINNE', 'GROTTANUTE', 502, 126, 0x08, 'ronja_16_609a1_garutgrotta', undefined, 490, 140],
];

/** All portals by name, e.g. `PORTAL.EXIT_BORGGARDEN_to_STORASALEN` (use the string with `usePortal`). */
export const PORTALS = new Map<string, Portal>();
for (const [scene, to, x, y, dirMask, leave, arrive, bx, by] of ROWS) {
  const name = `EXIT_${scene}_to_${to}`;
  PORTALS.set(name, { name, scene, to, x, y, dirMask, leave, arrive, birk: bx !== undefined ? [bx, by!] : undefined, target: `EXIT_${to}_to_${scene}` });
}
// the cellar has two exits to the prison (second: with the shelf passage); both arrive at the same place
PORTALS.set('EXIT_KAELLARE_to_FANGELSEHALOR_2', { ...PORTALS.get('EXIT_KAELLARE_to_FANGELSEHALOR')!, name: 'EXIT_KAELLARE_to_FANGELSEHALOR_2' });

export const portal = (name: string): Portal => {
  const p = PORTALS.get(name);
  if (!p) throw new Error(`unknown portal ${name}`);
  return p;
};

const dirOfMask = (mask: number): Dir => {
  for (let d = 0; d < 8; d++) if (mask & (1 << d)) return d as Dir;
  return 4;
};

/**
 * usePortal (FUN_0045e460): walk Ronja to the exit, play the leave track (or `leaveOverride`; `null` = none), then switch scenes.
 * `arriveOverride`: track to play on arrival instead of the partner's arrive track.
 */
export function usePortal(p: string | Portal, leaveOverride?: string | null, arriveOverride?: string | null): void {
  const P = typeof p === 'string' ? portal(p) : p;
  O.RONJA.walkTo(P.x, P.y, 0, (interrupted) => {
    if (interrupted) return;
    leavePortal(P, leaveOverride, arriveOverride);
  }, -1);
}

/** FUN_0045e5d0: like usePortal but Ronja leaves from where she stands (no walking). */
export function leavePortal(p: string | Portal, leaveOverride?: string | null, arriveOverride?: string | null): void {
  const P = typeof p === 'string' ? portal(p) : p;
  busy.bits |= BUSY_PORTAL;
  const leave = leaveOverride === undefined ? P.leave : leaveOverride;
  if (!leave) { transition(P, arriveOverride); return; }
  O.RONJA.setTrack(leave, 0, (interrupted) => { if (!interrupted) transition(P, arriveOverride); else busy.bits &= ~BUSY_PORTAL; });
}

/** FUN_0045e410: switch scenes without walking or a leave track. */
export function transition(p: string | Portal, arriveOverride?: string | null): void {
  const P = typeof p === 'string' ? portal(p) : p;
  const T = portal(P.target);
  const R = O.RONJA, B = O.BIRK;
  busy.bits |= BUSY_PORTAL;
  R.standStill(T.x, T.y, 0, -1, true);
  if (gv.act === 3 && T.birk) B.standStill(T.birk[0], T.birk[1], 4000, -1, true);
  enterScene(T.scene);
  setPan(Math.floor(T.x / 640) * 640);
  const dir = dirOfMask(T.dirMask);
  R.hidden = false;
  R.followGround = true;
  R.currDirec = dir;
  R.setPosition(T.x, T.y, 0);
  const still = R.still[dir];
  if (still) R.setTrack(still, 0);
  const arrive = arriveOverride === undefined ? T.arrive : arriveOverride;
  if (arrive) R.setTrack(arrive, 0x100, () => { busy.bits &= ~BUSY_PORTAL; });
  else busy.bits &= ~BUSY_PORTAL;
  if (gv.act === 3 && T.birk) {
    B.hidden = false;
    B.followGround = true;
    B.currDirec = dir;
    B.setPosition(T.birk[0], T.birk[1], 0);
    const bs = B.still[dir];
    if (bs) B.setTrack(bs, 0);
  }
}
