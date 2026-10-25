// RONJAS<n>.sav (n = 0..15, in the game's working directory; written by FUN_004049d0 "SaveRONJA",
// read by FUN_00404920 "LoadRONJA", thumbnails listed by FUN_00404610). No registry is used for
// saves (HKLM\Software\O2Games\Ronja only holds the SCURRglob*Path data paths).
//
// Layout (all little-endian, no header/version):
//   9600 bytes  thumbnail: 80x60 u16 RGB444 (engine ORs 0xF000 = opaque ARGB4444), top-down
//   gVar        5 x u32 (+0xE8..+0xF8), 68 x u8 (+0xFC..+0x13F), u32 0x58 (size check)   FUN_0041e6e0
//   49 objects  in SAVE_OBJECTS order, 55 bytes each                                    FUN_0046e020
//   scene       u32 sceneObjectId, u32 pan (DAT_004ee730)                               FUN_0046efd0
//   RONJA, BIRK 2 x { f32 x, f32 y, f32 z, i32 direction (0..7, -1) }                   FUN_0046f0d0
//   BLOCKList   u32 count (0x8F) + count x { u32, u32, u32 }                            FUN_0046f4d0
// Meanings of most object/gVar fields are engine state and only partly known (see formats.md).

import { Reader } from './bytes.ts';
import { Surface, rgb } from '../engine/surface.ts';

export const SAVE_SLOTS = 16;
export const SAVE_THUMB_W = 80;
export const SAVE_THUMB_H = 60;
export const saveFileName = (slot: number) => `RONJAS${slot}.sav`;
/** Where the load/save screen draws slot n's thumbnail (FUN_00404610). */
export const saveThumbPos = (slot: number) => ({ x: 0x8d + (slot % 4) * 0x5a, y: 0x57 + Math.floor(slot / 4) * 0x50 });

export const SAVE_OBJECTS = [
  'RONJA', 'BIRK', 'MATTIS', 'LOVIS', 'BERATTAREN', 'SKALLEPER', 'LILLKLIPPEN', 'FJOSOK', 'STURKAS', 'TJEGGE', 'LABAS',
  'BORKA', 'BORKAROV', 'ASKEN', 'BRODKAKA', 'DJUR1', 'DJUR2', 'DJUR3', 'ELDSTAL', 'ELD1', 'ELD2', 'ELD3', 'ELD4', 'FACKLA',
  'FISKNAT', 'FLINTA', 'FNOSKE', 'GRADVARG', 'HINDER', 'KARTAN', 'KISTLOCK', 'KNIV', 'KOTTE', 'LAX', 'MOROTTER', 'NYCKEL',
  'OST', 'RATTA', 'RATTBUR', 'REM', 'RUMPNISSE', 'SKUMTROLL', 'SNOBOLL', 'STEGE', 'TARNING', 'UNDERJORD', 'VATTENKARL',
  'VITMOSSA', 'VILDVITTRA',
] as const;

export interface SaveObject {
  name: string;
  /** Object id (+0xE8). */
  id: number;
  /** Id of the scene the object is in (scene +0xE8), 0 = none. */
  sceneId: number;
  x: number; y: number; z: number;
  /** Raw words at object +0x22C, +0x234, +0x230, +0x238 (meaning unknown). */
  unknown: [number, number, number, number];
  /** Current key anchor (cX, cY, cZ as ints, +0x23C..+0x244). */
  anchor: [number, number, number];
  /** Take z from the scene height map (+0x262). */
  followGround: boolean;
  /** Current key flags (+0x263; bit 0 = unscaled). */
  keyFlags: number;
  /** Hidden (+0x264). */
  hidden: boolean;
  /** Perspective scale (+0x278). */
  scale: number;
}

export interface SaveGame {
  thumbnail: Uint16Array;
  gvarWords: number[];
  gvarBytes: Uint8Array;
  objects: SaveObject[];
  sceneId: number;
  pan: number;
  ronja: { x: number; y: number; z: number; direction: number };
  birk: { x: number; y: number; z: number; direction: number };
  blockList: Array<[number, number, number]>;
}

export function parseSaveGame(buf: ArrayBuffer | Uint8Array): SaveGame {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const thumbnail = new Uint16Array(SAVE_THUMB_W * SAVE_THUMB_H);
  for (let i = 0; i < thumbnail.length; i++) thumbnail[i] = r.u16();
  const gvarWords = [r.u32(), r.u32(), r.u32(), r.u32(), r.u32()];
  const gvarBytes = r.slice(68).slice();
  if (r.u32() !== 0x58) throw new Error('savegame: gVar size check failed');
  const objects: SaveObject[] = SAVE_OBJECTS.map((name) => {
    const id = r.u32(), sceneId = r.u32();
    const x = r.f32(), y = r.f32(), z = r.f32();
    const unknown: [number, number, number, number] = [r.u32(), r.u32(), r.u32(), r.u32()];
    const anchor: [number, number, number] = [r.i32(), r.i32(), r.i32()];
    const followGround = r.u8() !== 0, keyFlags = r.u8(), hidden = r.u8() !== 0;
    const scale = r.f32();
    return { name, id, sceneId, x, y, z, unknown, anchor, followGround, keyFlags, hidden, scale };
  });
  const sceneId = r.u32(), pan = r.i32();
  const actor = () => ({ x: r.f32(), y: r.f32(), z: r.f32(), direction: r.i32() });
  const ronja = actor(), birk = actor();
  const n = r.u32();
  const blockList: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) blockList.push([r.u32(), r.u32(), r.u32()]);
  return { thumbnail, gvarWords, gvarBytes, objects, sceneId, pan, ronja, birk, blockList };
}

/** Byte size of a save file with the default 0x8F block entries. */
export const SAVE_SIZE = 9600 + 20 + 68 + 4 + 49 * 55 + 8 + 32 + 4 + 0x8f * 12;

export function thumbnailToSurface(px: Uint16Array): Surface {
  const s = new Surface(SAVE_THUMB_W, SAVE_THUMB_H);
  for (let i = 0; i < px.length; i++) s.px[i] = rgb(((px[i] >> 8) & 15) * 17, ((px[i] >> 4) & 15) * 17, (px[i] & 15) * 17);
  return s;
}
