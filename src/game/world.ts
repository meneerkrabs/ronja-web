// The SCURR world model: the 49 global objects (characters and props), the track player (animation
// timelines that also move objects and fire hooks), walking, the current scene's maps and the camera.
// Ported from Scurr.cpp (engine.md §3). Scene scripts only use the public methods of Obj and a few
// helpers; see docs/engine-api.md.

import type { Frame, SceneMaps } from './assets.ts';
import type { Track } from '../formats/trk.ts';
import { core, dlog } from './core.ts';
import { gameNow } from './clock.ts';
import { sample } from './audio-game.ts';
import { PathFinder } from './pathfinder.ts';
import {
  HOOK_END, HOOK_START, hookKey, OBJECT_NAMES, TF_HIDE_AT_END, TF_KEEP_CB, TF_LIPSYNC, TF_LOOP, TF_SOUND,
  type Dir, type ObjName, type SceneName,
} from './types.ts';
import { HW, S as hwS, T as hwT } from './assets.ts';

/** Track end callback: `interrupted` is true when the track was replaced/stopped instead of reaching its end. */
export type TrackCb = (interrupted: boolean, track: Track | null) => void;
/** Movement callback (arrival or interruption). */
export type MoveCb = (interrupted: boolean) => void;
/** A track hook: called for tracks registered with `hook()`: code = HOOK_START | hookKey(n) | HOOK_END. */
export type HookFn = (code: number, obj: Obj) => void;

const hooks = new Map<string, HookFn>();
/** Register a hook for a track (name or HW handle number; case-insensitive; the last registration wins, like the original table). */
export function registerHook(track: string | number, fn: HookFn) {
  hooks.set((typeof track === 'number' ? hwT(track) : track).toLowerCase(), fn);
}
export const hookCount = () => hooks.size;

export const world = {
  objs: [] as Obj[],
  byName: {} as Record<string, Obj>,
  scene: null as SceneRt | null,
  /** Objects are updated only while the loop is enabled (not during SetCurrentScene). */
  enabled: true,
  /** Hit tests and some handlers pause while the camera/ui is frozen. */
  freezeCamera: false,
  path: new PathFinder(),
};

/** The current scene's static data and runtime scroll. */
export interface SceneRt {
  name: SceneName;
  id: number;
  /** Panorama width (640, 1280 or 1920) */
  width: number;
  maps: SceneMaps;
  /** perspective constants of scene.nfo */
  focal: number;
  zOff: number;
  pan: number;
  /** gfx base name that was loaded (variant) */
  gfx: string;
}

export const O: Record<ObjName, Obj> = {} as Record<ObjName, Obj>;

let defaultSetsReady = false;

const DIRS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** Direction (0..7) of a vector, FUN_004570d0: sectors of 45 degrees around E=6, SE=5, S=4, SW=3, W=2, NW=1, N=0, NE=7. */
export function dirOfVector(dx: number, dy: number): Dir {
  let a = Math.atan2(dy, dx);
  if (a < 0) a += Math.PI * 2;
  const k = Math.floor((a + Math.PI / 8) / (Math.PI / 4)) % 8; // 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE
  return ([6, 5, 4, 3, 2, 1, 0, 7][k]) as Dir;
}

export class Obj {
  readonly id: number;
  readonly name: ObjName;
  /** Story location: &RONJA = inventory, another object = carried/inserted, null = lying in its scene. */
  holder: Obj | null = null;
  x = 0; y = 0; z = 0;
  hidden = true;
  // --- sprite state
  streamName: string | null = null;
  frameNo = 0;
  frame: Frame | null = null;
  /** anchor of the current key (cX, cY) and depth bias (cZ) */
  ax = 0; ay = 0; az = 0;
  keyFlags = 0;
  scale = 1;
  followGround = false;
  // --- track player
  track: Track | null = null;
  keyIdx = 0;
  lastTime = 0;
  acc = 0;
  loops = 0;
  hideAtEnd = false;
  trackFlags = 0;
  endCb: TrackCb | null = null;
  sound: string | null = null;
  soundStarted = false;
  // --- walking
  path: Array<{ gx: number; gy: number }> = [];
  finalDir = -1;
  finalX = 0; finalY = 0; finalZ = 0;
  walkFrame = 0;
  moveCb: MoveCb | null = null;
  currDirec = -1;
  still: Array<Track | null> = new Array(8).fill(null);
  walk: Array<Track | null> = new Array(8).fill(null);
  talkT: Array<Track | null> = new Array(8).fill(null);
  private stillFirst: string[] = [];
  private walkFirst: string[] = [];
  private talkFirst: string[] = [];

  constructor(name: ObjName, id: number) {
    this.name = name;
    this.id = id;
  }

  // ---------------------------------------------------------------- visibility & position

  show() { this.hidden = false; }
  hide() { this.hidden = true; }

  /** setPosition (vtable +0x40): also recomputes height-map depth and perspective scale. */
  setPosition(x: number, y: number, z: number) {
    this.x = x; this.y = y; this.z = z;
    this.refreshDepth();
  }

  /** moveRelative (vtable +0x24): x/y deltas are multiplied by the current perspective scale. */
  moveRelative(dx: number, dy: number, dz: number) {
    this.refreshDepth();
    this.x += dx * this.scale;
    this.y += dy * this.scale;
    this.z += dz;
  }

  /** FUN_00456620: depth from the height map (if the track follows the ground) and the perspective scale. */
  refreshDepth() {
    const sc = world.scene;
    if (!sc) return;
    if (this.followGround && sc.maps.h) {
      const w = sc.width;
      const cx = Math.max(0, Math.min(w - 1, Math.trunc(this.x)));
      const cy = Math.max(0, Math.min(479, Math.trunc(this.y)));
      this.z = sc.maps.h[cy * w + cx];
    }
    if (this.keyFlags & 1) this.scale = 1;
    else {
      const d = sc.zOff + this.z;
      let s = d < 1 ? 10 : sc.focal / d;
      if (s > 10) s = 10;
      this.scale = s;
    }
  }

  /** Screen rectangle of the current frame (FUN_004567b0): [l, t, r, b] with the camera pan subtracted. */
  screenRect(): [number, number, number, number] | null {
    const f = this.frame;
    if (!f || f.bbox[2] <= f.bbox[0]) return null;
    this.refreshDepth();
    const s = f.opaque ? 1 : this.scale;
    const pan = world.scene?.pan ?? 0;
    const t = Math.trunc;
    return [
      t(this.x + (f.bbox[0] - this.ax) * s) - pan, t(this.y + (f.bbox[1] - this.ay) * s),
      t(this.x + (f.bbox[2] - this.ax) * s) - pan, t(this.y + (f.bbox[3] - this.ay) * s),
    ];
  }

  /** Pixel-accurate hit test at a screen point (FUN_00456940). */
  hitTest(sx: number, sy: number): boolean {
    if (this.hidden || !this.frame) return false;
    const r = this.screenRect();
    if (!r) return false;
    if (sx < r[0] || sx >= r[2] || sy < r[1] || sy >= r[3]) return false;
    const f = this.frame;
    const bw = f.bbox[2] - f.bbox[0], bh = f.bbox[3] - f.bbox[1];
    const px = f.bbox[0] + Math.floor(((sx - r[0]) * bw) / Math.max(1, r[2] - r[0]));
    const py = f.bbox[1] + Math.floor(((sy - r[1]) * bh) / Math.max(1, r[3] - r[1]));
    return (f.px[py * f.w + px] >> 12) !== 0;
  }

  /** Depth used for painter's order and the z test: floor depth + the key's depth bias. */
  get depth(): number {
    this.refreshDepth();
    return Math.trunc(this.z) + this.az;
  }

  // ---------------------------------------------------------------- sprite frames

  /** setAniFrame (vtable +0x2c): show frame `frame` of subani `name`. Learns the facing from Still/Walk/Talk tracks. */
  setAniFrame(name: string, frame: number) {
    const lower = name.toLowerCase();
    for (let d = 0; d < 8; d++) {
      if (this.stillFirst[d] === lower || this.walkFirst[d] === lower || this.talkFirst[d] === lower) { this.currDirec = d; break; }
    }
    const f = core.assets.frame(name, frame);
    if (!f) { dlog('missing subani', name); this.frame = null; return; }
    this.streamName = name;
    this.frameNo = frame;
    this.frame = f;
  }

  // ---------------------------------------------------------------- track sets (stand / walk / talk)

  private resolveSet(tracks: Array<string | number>): { t: Array<Track | null>; first: string[] } {
    const t = tracks.map((n) => core.assets.track(n) ?? null);
    const first = t.map((x) => (x ? x.subAnis[x.keys[0].subAni].toLowerCase() : ''));
    return { t, first };
  }
  setStillTracks(tracks: Array<string | number>) { const r = this.resolveSet(tracks); this.still = r.t; this.stillFirst = r.first; }
  setWalkTracks(tracks: Array<string | number>) { const r = this.resolveSet(tracks); this.walk = r.t; this.walkFirst = r.first; }
  setTalkTracks(tracks: Array<string | number>) { const r = this.resolveSet(tracks); this.talkT = r.t; this.talkFirst = r.first; }

  // ---------------------------------------------------------------- tracks

  /** Currently playing track (null when idle). */
  get playing(): Track | null { return this.track; }

  /**
   * setTrack (FUN_00455990): start a track (by Track, name or HW handle number).
   * flags: TF_LOOP (+ loop count `(n<<4)`), TF_HIDE_AT_END, TF_TALK..., TF_KEEP_CB; `cb` is called at the end
   * (interrupted=false) or when the track is replaced (interrupted=true). `sound` is the voice line of a talk track.
   */
  setTrack(track: Track | string | number, flags = 0, cb: TrackCb | null = null, sound: string | null = null): boolean {
    const tr = typeof track === 'object' ? track : core.assets.track(track);
    if (!tr) { console.warn('track not found:', track); return false; }
    fireHook(this, tr, HOOK_START);
    if (tr.keys.length === 0) { fireHook(this, tr, HOOK_END); return true; }
    if (!(flags & TF_KEEP_CB)) {
      const old = this.endCb;
      const oldTrack = this.track;
      this.endCb = null;
      old?.(true, oldTrack);
      this.endCb = cb;
    }
    this.soundStarted = false;
    this.sound = sound;
    if (tr.timeSyncStart < 0 && (flags & TF_SOUND) && sound) {
      sample.play(sound, 100, 64);
      flags &= ~TF_SOUND;
      this.soundStarted = true;
    }
    if (tr.timeSyncLoopLabel < 0 || tr.timeSyncLoopPoint < 0) flags &= ~TF_LIPSYNC;
    this.hidden = false;
    this.applyAniOfKey(tr, 0);
    this.track = tr;
    this.keyIdx = 0;
    this.acc = 0;
    this.followGround = (tr.flags & 2) !== 0;
    this.trackFlags = flags;
    if (flags & TF_LOOP) this.loops = (flags & 0xf0) === 0 ? -1 : (flags >> 4) & 0xf;
    else this.loops = 0;
    this.hideAtEnd = (flags & TF_HIDE_AT_END) !== 0;
    this.lastTime = gameNow();
    const k0 = tr.keys[0];
    this.keyFlags = k0.flags;
    if ((tr.flags & 1) === 0) {
      this.x = k0.moveX; this.y = k0.moveY;
      if (!this.followGround) this.z = k0.moveZ;
      this.refreshDepth();
    } else this.moveRelative(k0.moveX, k0.moveY, this.followGround ? 0 : k0.moveZ);
    this.ax = Math.trunc(k0.cx); this.ay = Math.trunc(k0.cy); this.az = Math.trunc(k0.cz);
    return true;
  }

  private applyAniOfKey(tr: Track, k: number) {
    const key = tr.keys[k];
    this.setAniFrame(tr.subAnis[key.subAni], key.subAniFrame);
  }

  /** Walk to where `track` starts, then play it (FUN_0045e7e0). `done` runs when the track ends. */
  walkAndPlay(track: Track | string | number, done: TrackCb | null = null) {
    this.walkToTrackStart(track, (interrupted) => { if (!interrupted) this.setTrack(track, 0, done); });
  }

  /** Convenience: play a track forever (TF_LOOP). */
  loop(track: Track | string | number): boolean { return this.setTrack(track, TF_LOOP); }

  /** stopTrack (FUN_004562a0): the end callback gets `interrupted`. */
  stopTrack() {
    if (!this.track) return;
    const cb = this.endCb;
    this.track = null;
    this.endCb = null;
    cb?.(true, null);
  }

  /** setTrackFrame (FUN_00456120): jump to key n without moving; optionally apply its sprite frame. */
  setTrackFrame(n: number, applyAni: boolean) {
    const tr = this.track;
    if (!tr) return;
    n = Math.max(0, Math.min(tr.keys.length - 1, n));
    this.keyIdx = n;
    this.acc = 0;
    this.keyFlags = tr.keys[n].flags;
    this.lastTime = gameNow();
    if (applyAni) this.applyAniOfKey(tr, n);
  }

  /** Per-frame track update (FUN_00455cc0). */
  updateTrack() {
    const tr = this.track;
    if (!tr) return;
    const now = gameNow();
    if (tr.keys.length === 0 || this.keyIdx >= tr.keys.length) {
      const cb = this.endCb;
      this.track = null; this.endCb = null;
      cb?.(false, null);
      fireHook(this, tr, HOOK_END);
      return;
    }
    this.acc += now - this.lastTime;
    let ft = tr.keys[this.keyIdx].frameTime;
    let changed = false;
    let guard = 0;
    if (ft < this.acc) {
      do {
        if (++guard > 20000) { this.acc = 0; break; } // zero-length loops must not hang the frame
        this.keyIdx++;
        this.acc -= ft;
        fireHook(this, tr, hookKey(this.keyIdx));
        if (this.track !== tr) return; // a hook replaced the track
        if ((this.trackFlags & TF_SOUND) && this.keyIdx - 1 === tr.timeSyncStart && !this.soundStarted && this.sound) {
          sample.play(this.sound, 100, 64);
          this.soundStarted = true;
        }
        if ((this.trackFlags & TF_LIPSYNC) && this.sound) {
          if (sample.playing(this.sound)) {
            if (this.keyIdx - 1 === tr.timeSyncLoopPoint) this.keyIdx = tr.timeSyncLoopLabel;
          } else if (this.soundStarted && this.keyIdx - 1 >= tr.timeSyncLoopLabel && this.keyIdx - 1 <= tr.timeSyncLoopPoint) {
            this.keyIdx = tr.timeSyncLoopPoint + 1;
          }
        }
        if (this.keyIdx >= tr.keys.length) {
          if (this.loops === 0) {
            const hide = this.hideAtEnd;
            this.track = null;
            if (hide) { this.hidden = true; this.stopTrack(); }
            fireHook(this, tr, HOOK_END);
            const nextName = core.assets.followUps.get(tr.name.toLowerCase());
            const next = nextName ? core.assets.track(nextName) : undefined;
            if (next) { this.setTrack(next, TF_KEEP_CB | (hide ? TF_HIDE_AT_END : 0)); return; }
            const cb = this.endCb;
            this.endCb = null;
            cb?.(false, null);
            return;
          }
          this.keyIdx = 0;
          this.loops--;
        }
        const key = tr.keys[this.keyIdx];
        this.keyFlags = key.flags;
        if (this.keyIdx === 0 && (tr.flags & 1) === 0) {
          this.x = key.moveX; this.y = key.moveY;
          if ((tr.flags & 2) === 0) this.z = key.moveZ;
          this.refreshDepth();
        } else this.moveRelative(key.moveX, key.moveY, (tr.flags & 2) === 0 ? key.moveZ : 0);
        changed = true;
        ft = key.frameTime;
      } while (ft < this.acc);
    }
    if (changed) {
      const key = tr.keys[this.keyIdx];
      this.applyAniOfKey(tr, this.keyIdx);
      this.ax = Math.trunc(key.cx); this.ay = Math.trunc(key.cy); this.az = Math.trunc(key.cz);
    }
    this.lastTime = now;
  }

  // ---------------------------------------------------------------- standing, talking, walking

  /** standStillAtDestination (FUN_00456e80): stop walking, place at (x,y,z) facing `dir` (-1 keep) with the stand track. */
  standStill(x: number, y: number, z: number, dir: number = -1, interrupted = true) {
    if (dir === -1) { if (this.currDirec < 0) return; }
    else this.currDirec = dir < 0 ? -1 : (Math.abs(dir) & 7);
    this.path = [];
    this.hidden = false;
    this.setPosition(x, y, z);
    const d = this.currDirec < 0 ? 4 : this.currDirec & 7;
    const t = this.still[d];
    if (t) this.setTrack(t, 0);
    const cb = this.moveCb;
    this.moveCb = null;
    cb?.(interrupted);
  }

  /** Talk with the generic talk track of the current facing (FUN_00457640). Returns false if this object has none. */
  talk(flags: number, cb: TrackCb | null, sound: string | null): boolean {
    this.standStill(this.x, this.y, this.z, -1, true);
    const d = this.currDirec < 0 ? 4 : this.currDirec & 7;
    const t = this.talkT[d];
    if (!t) return false;
    return this.setTrack(t, flags, cb, sound);
  }

  /**
   * setMovementDestination (FUN_00456bd0): walk to (x,y) on the walk map; `cb(false)` on arrival, `cb(true)` if
   * interrupted; finalDir = facing on arrival (-1 keep). Closer than 16 px: just turns to face the point.
   */
  walkTo(x: number, y: number, z = 0, cb: MoveCb | null = null, finalDir: number = -1): boolean {
    const old = this.moveCb;
    this.moveCb = null;
    old?.(true);
    const path = world.path.getPath(Math.trunc(this.x / 4), Math.trunc(this.y / 4), Math.trunc(x / 4), Math.trunc(y / 4));
    this.moveCb = cb;
    const dx = this.x - x, dy = this.y - y;
    if (dx * dx + dy * dy >= 256) {
      if (path.length === 0) return false; // unreachable: nothing happens (the callback stays pending)
      this.path = path;
      this.finalDir = finalDir;
      this.finalX = path[path.length - 1].gx * 4;
      this.finalY = path[path.length - 1].gy * 4;
      this.finalZ = Math.trunc(z);
      this.walkFrame = 0;
      return true;
    }
    this.path = [];
    // closer than 16 px: stand (or turn to face the point) and report arrival at once
    if (Math.abs(dy) < 1.5 && Math.abs(dx) < 1.5) this.standStill(this.x, this.y, this.z, -1, false);
    else this.standStill(this.x, this.y, this.z, dirOfVector(x - this.x, y - this.y), false);
    return true;
  }

  /** walkToTrackStart (FUN_00456e00): walk to where `track` begins (key 0 position, facing of key 0's sprite). */
  walkToTrackStart(track: Track | string | number, cb: MoveCb | null) {
    const tr = typeof track === 'object' ? track : core.assets.track(track);
    if (!tr) { cb?.(false); return; }
    const p = trackStart(tr);
    if (!this.walkTo(p.x, p.y, p.z, cb, p.dir)) {
      // unreachable start (the original would hang): begin in place, the track's key 0 positions the object anyway
      this.moveCb = null;
      cb?.(false);
    }
  }

  get walking(): boolean { return this.path.length > 0; }

  /** One 66 ms walk step (FUN_00457190). */
  walkStep() {
    if (this.path.length === 0) return;
    // target = nearest of the next <= 5 nodes that is more than 2 cells away
    const cx = this.x * 0.25, cy = this.y * 0.25;
    const n = Math.min(5, this.path.length);
    let best = -1, bestD = 1e30;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(this.path[i].gx - cx, this.path[i].gy - cy);
      if (d > 2 && d <= bestD) { best = i; bestD = d; }
    }
    this.path.splice(0, best < 0 ? n : best);
    if (this.path.length === 0) { this.standStill(this.finalX, this.finalY, this.finalZ, this.finalDir, false); return; }
    const tx = this.path[0].gx * 4, ty = this.path[0].gy * 4;
    const dxF = this.x - this.finalX, dyF = this.y - this.finalY;
    const farFromFinal = dxF * dxF + dyF * dyF >= 256;
    const ox = this.x, oy = this.y;
    this.currDirec = dirOfVector(tx - this.x, ty - this.y);
    const wt = this.walk[this.currDirec];
    if (wt && this.track !== wt) this.setTrack(wt, 0);
    this.setPosition(ox, oy, this.z);
    const frames = wt ? wt.keys.length : 1;
    this.walkFrame = this.walkFrame < frames - 1 ? this.walkFrame + 1 : 0;
    this.setTrackFrame(this.walkFrame, true);
    // E track = horizontal speed, S track = vertical speed (both x scale)
    const wE = this.walk[6], wS = this.walk[4];
    const sx = wE ? wE.keys[Math.min(this.walkFrame, wE.keys.length - 1)].moveX : 10;
    const sy = wS ? wS.keys[Math.min(this.walkFrame, wS.keys.length - 1)].moveY : 4;
    const a = Math.atan2(ty - oy, tx - ox);
    this.moveRelative(Math.cos(a) * sx, Math.sin(a) * sy, 0);
    // did we pass the node?
    const px = this.x - ox, py = this.y - oy;
    const len2 = px * px + py * py;
    if (len2 > 0) {
      const t = ((tx - ox) * px + (ty - oy) * py) / len2;
      if (t > -0.01 && t < 1.01) {
        const mx = ox + t * px - tx, my = oy + t * py - ty;
        const miss = mx * mx + my * my;
        if (!farFromFinal) {
          if (miss < 64) { this.standStill(this.finalX, this.finalY, this.finalZ, this.finalDir, false); return; }
        } else if (miss < 16) this.setPosition(tx, ty, this.z);
      }
    }
  }
}

/** Start position and facing of a track (GetPosAndDirFromTrack, FUN_00456b30): key 0 position, direction of key 0's sprite. */
export function trackStart(tr: Track): { x: number; y: number; z: number; dir: number } {
  const k = tr.keys[0];
  const first = tr.subAnis[k.subAni].toLowerCase();
  let dir = -1;
  for (const set of [O.RONJA, O.BIRK]) {
    for (let d = 0; d < 8; d++) {
      for (const t of [set.still[d], set.walk[d], set.talkT[d]]) {
        if (t && t.subAnis[t.keys[0].subAni].toLowerCase() === first) dir = d;
      }
    }
  }
  return { x: k.moveX, y: k.moveY, z: k.moveZ, dir };
}

function fireHook(obj: Obj, tr: Track, code: number) {
  const h = hooks.get(tr.name.toLowerCase());
  if (h) h(code, obj);
}

/** The 8 direction track sets for Ronja (engine.md §1.3). */
export function setDefaultTrackSets() {
  const R = O.RONJA, B = O.BIRK;
  R.setStillTracks([559, 554, 558, 556, 560, 555, 557, 553]);
  R.setWalkTracks([148, 150, 137, 138, 139, 147, 146, 149]);
  R.setTalkTracks(talkSetRonja());
  B.setStillTracks([524, 523, 529, 528, 526, 527, 525, 522]);
  B.setWalkTracks([495, 497, 494, 501, 499, 500, 498, 496]);
  // BIRK talk: alternates talSO / talSV (S1530/531 in the handle table)
  B.setTalkTracks([531, 531, 531, 531, 530, 530, 530, 530]);
  defaultSetsReady = true;
}
function talkSetRonja(): string[] {
  // N,NW -> talNV; W,SW -> talSV; S,SE -> talSO; E,NE -> talNO
  const nv = 'ronja__gen_talNV', sv = 'ronja__Gen_talSV', so = 'ronja__Gen_talSO', no = 'ronja__gen_talNO';
  return [nv, nv, sv, sv, so, so, no, no];
}
export const defaultSets = () => defaultSetsReady;

/** Create the 49 objects (ScurrObjectInitialize) and the default direction track sets. */
export function createWorld() {
  world.objs = OBJECT_NAMES.map((n, i) => new Obj(n, i + 1));
  for (const o of world.objs) { world.byName[o.name] = o; (O as Record<string, Obj>)[o.name] = o; }
  setDefaultTrackSets();
}

/** Resolve a hotspot/handle helper: HW handle -> name. */
export const subaniName = hwS;
export const trackName = hwT;
export const hwTables = HW;

/** True when the object is carried by Ronja, directly or inside a carried item (the code tests exactly this). */
export function inInv(o: Obj): boolean {
  return o.holder === O.RONJA || (o.holder !== null && o.holder.holder === O.RONJA);
}

/** Hide every object and stop its track (SetCurrentScene step 4: end callbacks fire with interrupted=true). */
export function hideAllObjects() {
  for (const o of world.objs) {
    o.hidden = true;
    o.path = [];
    o.stopTrack();
    o.frame = null;
  }
}

// ------------------------------------------------------------------ camera

/** setPan (FUN_0046b530): jump the scroll, clamped to the panorama. */
export function setPan(p: number) {
  const sc = world.scene;
  if (!sc) return;
  sc.pan = Math.max(0, Math.min(sc.width - 640, Math.trunc(p)));
}

/** Per-frame auto-scroll (engine.md §3.9): half-screen jumps when Ronja gets within 25 px of an edge. */
export function updateCamera() {
  const sc = world.scene;
  const R = O.RONJA;
  if (!sc || world.freezeCamera || R.hidden) return;
  const pan = sc.pan, x = R.x, d = R.currDirec;
  if (R.walking) {
    if (x < pan + 25 && (d === 0 || d === 1 || d === 2 || d === 3 || d === 4)) { setPan(pan - 320); return; }
    if (x > pan + 615 && (d === 0 || d === 4 || d === 5 || d === 6 || d === 7)) { setPan(pan + 320); return; }
  }
  if (x < pan + 25 && (d === 1 || d === 2 || d === 3)) setPan(pan - 320);
  else if (x > pan + 615 && (d === 5 || d === 6 || d === 7)) setPan(pan + 320);
}

/** Region id of the scene's info map at a scene point (FUN_0046d120). */
export function regionAt(x: number, y: number): number {
  const sc = world.scene;
  if (!sc || !sc.maps.i) return 0;
  const gw = sc.width >> 2;
  const cx = Math.max(0, Math.min(gw - 1, Math.trunc(x) >> 2)), cy = Math.max(0, Math.min(119, Math.trunc(y) >> 2));
  return sc.maps.i[cy * gw + cx];
}

/** Walkable test on the restriction map (for scripts). */
export function walkable(x: number, y: number): boolean {
  return world.path.isFree(Math.trunc(x / 4), Math.trunc(y / 4));
}

export { DIRS };
