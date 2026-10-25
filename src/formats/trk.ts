// tracks/tracks.trk: every "track" (an actor's animation timeline: which subani frame to show,
// for how long, how far to move, where the sprite's anchor is). Read by
// SCURR_initializeScurrTracks (FUN_00450b30) and Track::readFromBinaryStream (FUN_00454d40,
// key reader FUN_004546b0). See docs/re/formats.md.

import { Reader } from './bytes.ts';

/** Serial numbers the engine gives tracks: 0x200000 + index in the file. */
export const TRACK_SERIAL_BASE = 0x200000;

/** Track flag bit 0: do not place the actor at key 0's moveXYZ (move relatively from the start). */
export const TRACK_RELATIVE_START = 1;
/** Track flag bit 1: ignore the Z component of moveXYZ. */
export const TRACK_IGNORE_Z = 2;
/** Key flag bit 0: draw unscaled (perspective scale forced to 1.0, FUN_00456620). */
export const KEY_NO_SCALE = 1;

export interface TrackKey {
  /** Key number (always equal to the key's index). */
  frame: number;
  /** Position step (absolute start position for key 0 unless TRACK_RELATIVE_START). */
  moveX: number;
  moveY: number;
  moveZ: number;
  /** Index into Track.subAnis. */
  subAni: number;
  /** Frame number inside that subani. */
  subAniFrame: number;
  /** How long this key is shown, in ms (83 = 12 fps, 166, 120, 60, ...). */
  frameTime: number;
  /** Sprite anchor ("cXYZ"): the actor's position point inside the subani frame (pixels; z bias). */
  cx: number;
  cy: number;
  cz: number;
  /** Low byte of the stored u32 (upper bytes are 0xCDCDCD garbage). */
  flags: number;
}

export interface Track {
  index: number;
  serial: number;
  name: string;
  /** Actor prefix (text before the first '_'), e.g. "ronja", "Birk", "lillK". */
  actor: string;
  /** Rest of the name after the first '_': tracks sharing it play together (dialogue lines). */
  syncName: string;
  /** Subani names (APC entry names; may also be track names or "__23x_dir" pseudo names). */
  subAnis: string[];
  keys: TrackKey[];
  flags: number;
  /** Key at which the attached sound starts (when the actor plays a sound with the track). */
  timeSyncStart: number;
  /** While the sound still plays, reaching key `timeSyncLoopPoint` jumps back to `timeSyncLoopLabel`. -1 = none. */
  timeSyncLoopLabel: number;
  timeSyncLoopPoint: number;
}

export interface TrackFile {
  tracks: Track[];
  /** Lower-cased name -> track. */
  byName: Map<string, Track>;
  /** Lower-cased syncName -> indices of all tracks with that suffix (DAT_004e1bb8 groups). */
  syncGroups: Map<string, number[]>;
}

export function parseTracks(buf: ArrayBuffer | Uint8Array): TrackFile {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const count = r.u32();
  const tracks: Track[] = [];
  for (let i = 0; i < count; i++) {
    const name = r.lenStr();
    const nSub = r.u32();
    const subAnis: string[] = [];
    for (let j = 0; j < nSub; j++) subAnis.push(r.lenStr());
    const nKeys = r.u32();
    const keys: TrackKey[] = [];
    for (let k = 0; k < nKeys; k++) {
      const frame = r.i32();
      const moveX = r.f32(), moveY = r.f32(), moveZ = r.f32();
      const subAni = r.i32(), subAniFrame = r.i32(), frameTime = r.i32();
      const cx = r.f32(), cy = r.f32(), cz = r.f32();
      const flags = r.u32() & 0xff;
      if (subAni < 0 || subAni >= nSub) throw new Error(`track ${name}: key ${k} subani ${subAni} of ${nSub}`);
      keys.push({ frame, moveX, moveY, moveZ, subAni, subAniFrame, frameTime, cx, cy, cz, flags });
    }
    const flags = r.i32();
    const timeSyncStart = r.i32(), timeSyncLoopLabel = r.i32(), timeSyncLoopPoint = r.i32();
    const us = name.indexOf('_');
    tracks.push({
      index: i, serial: TRACK_SERIAL_BASE + i, name,
      actor: us < 0 ? name : name.slice(0, us),
      syncName: us < 0 ? '' : name.slice(us + 1),
      subAnis, keys, flags, timeSyncStart, timeSyncLoopLabel, timeSyncLoopPoint,
    });
  }
  if (!r.eof) throw new Error(`tracks.trk: ${r.length - r.pos} trailing bytes`);
  const byName = new Map<string, Track>();
  const syncGroups = new Map<string, number[]>();
  for (const t of tracks) {
    if (!byName.has(t.name.toLowerCase())) byName.set(t.name.toLowerCase(), t);
    const g = t.syncName.toLowerCase();
    const list = syncGroups.get(g);
    if (list) list.push(t.index); else syncGroups.set(g, [t.index]);
  }
  return { tracks, byName, syncGroups };
}

/** Total play time of one pass through the track in ms. */
export const trackDuration = (t: Track): number => t.keys.reduce((s, k) => s + k.frameTime, 0);
