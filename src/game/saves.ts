// Save games: 16 slots in localStorage with the thumbnail of the screen (faithful content, JSON instead of bytes:
// gVar, use counters, object holders/positions, current scene and scroll, Ronja's and Birk's place).

import { gv, restoreGVar, snapshotGVar, type GVarSnapshot } from './state.ts';
import { O, world, setPan } from './world.ts';
import { OBJECT_NAMES, sceneNameById } from './types.ts';
import { enterScene } from './engine.ts';

export const SAVE_SLOTS = 16;
const key = (n: number) => `ronja-save-${n}`;

interface SavedObject { holder: number; x: number; y: number; z: number; hidden: boolean }
export interface SaveData {
  v: 1;
  time: number;
  /** 80x60 RGB444 thumbnail, base64 of the u16 words */
  thumb: string;
  gvar: GVarSnapshot;
  objects: SavedObject[];
  scene: number;
  pan: number;
  ronja: { x: number; y: number; z: number; dir: number };
  birk: { x: number; y: number; z: number; dir: number };
}

const b64 = (a: Uint16Array): string => {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
export const thumbFromB64 = (s: string): Uint16Array => {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Uint16Array(u8.buffer);
};

export function readSave(n: number): SaveData | null {
  try {
    const raw = localStorage.getItem(key(n));
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch { return null; }
}
export const listSaves = (): Array<SaveData | null> => Array.from({ length: SAVE_SLOTS }, (_, i) => readSave(i));

export function captureState(thumb: Uint16Array): SaveData {
  const R = O.RONJA, B = O.BIRK;
  return {
    v: 1, time: Date.now(), thumb: b64(thumb), gvar: snapshotGVar(),
    objects: world.objs.map((o) => ({ holder: o.holder ? o.holder.id : 0, x: o.x, y: o.y, z: o.z, hidden: o.hidden })),
    scene: gv.scene, pan: world.scene?.pan ?? 0,
    ronja: { x: R.x, y: R.y, z: R.z, dir: R.currDirec },
    birk: { x: B.x, y: B.y, z: B.z, dir: B.currDirec },
  };
}

export function saveSlot(n: number, thumb: Uint16Array) {
  localStorage.setItem(key(n), JSON.stringify(captureState(thumb)));
}

/** LoadRONJA (FUN_0046f740): restore state, re-enter the scene (its enter script runs), then place Ronja (and Birk in act 3). */
export function applySave(s: SaveData) {
  restoreGVar(s.gvar);
  s.objects.forEach((so, i) => {
    const o = world.objs[i];
    o.holder = so.holder ? world.objs[so.holder - 1] : null;
    o.x = so.x; o.y = so.y; o.z = so.z; o.hidden = so.hidden;
  });
  const name = sceneNameById(s.scene);
  if (!name) throw new Error('save refers to an unknown scene');
  enterScene(name, { force: true });
  setPan(s.pan);
  const place = (o: typeof O.RONJA, p: SaveData['ronja']) => {
    o.hidden = false;
    o.followGround = true;
    o.currDirec = p.dir < 0 ? 4 : p.dir;
    o.standStill(p.x, p.y, p.z, p.dir < 0 ? 4 : p.dir, true);
  };
  place(O.RONJA, s.ronja);
  if (gv.act === 3) place(O.BIRK, s.birk);
}

export const savedObjectNames = OBJECT_NAMES;
