// scene.nfo: per-scene perspective constants, read in ScurrInitialize (FUN_0046b5d0) by
// FUN_0046a9b0 once per scene, in a fixed order. Each record is
//   u32 recordSize (12, includes itself; the reader seeks recordStart + recordSize)
//   f32 -> scene+0xF0  ("focal": scale numerator)
//   f32 -> scene+0xF4  (z offset; 0.0 for every scene)
// An actor at depth z is drawn with scale = focal / (zOffset + z), clamped (FUN_00456620):
// if zOffset + z < 1.0 or the result > 10.0 the scale becomes 10.0.

import { Reader } from './bytes.ts';

/** Scene order in scene.nfo = order of the ScurrSceneInitialize calls (scene ids from the exe). */
export const SCENE_NFO_ORDER = [
  'ID_1A_SKALLEPERSRUM', 'ID_1B_LOVISMATTISRUM', 'ID_1C_STORASALEN', 'ID_1D_KOKET', 'ID_2A_BORGGARDEN',
  'ID_2B_VAPENHUS', 'ID_3_HELVETESGAPET', 'ID_4_TORNET', 'ID_5_UTSIKTSKOGEN', 'ID_6_KAELLARE',
  'ID_7_FANGELSEHALOR', 'ID_8_BORGPORTEN', 'ID_9A_SKOGEN', 'ID_10_KAELLAN', 'ID_12_GLAENTAN',
  'ID_13_GLUPAFALLET', 'ID_14_TJAERNEN', 'ID_15_GROTTANUTE', 'ID_16_GROTTANINNE', 'ID_17_LABYRINT',
  'ID_18_BRAEDSPEL',
] as const;

export interface SceneNfo {
  scene: string;
  focal: number;
  zOffset: number;
}

export function parseSceneNfo(buf: ArrayBuffer | Uint8Array): SceneNfo[] {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const out: SceneNfo[] = [];
  while (!r.eof) {
    const start = r.pos;
    const size = r.u32();
    if (size < 12) throw new Error(`scene.nfo: bad record size ${size} at ${start}`);
    const focal = r.f32(), zOffset = r.f32();
    out.push({ scene: SCENE_NFO_ORDER[out.length] ?? `#${out.length}`, focal, zOffset });
    r.pos = start + size;
  }
  return out;
}

/** Perspective scale for an actor at depth z (FUN_00456620). */
export function perspectiveScale(nfo: SceneNfo, z: number): number {
  const d = nfo.zOffset + z;
  if (d < 1) return 10;
  const s = nfo.focal / d;
  return s > 10 ? 10 : s;
}
