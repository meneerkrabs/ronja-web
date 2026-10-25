// Helpers shared by the pine-cone / snowball mini-games (modes 2, 5, 6; game-logic.md §5): the original's random number,
// positional effects, depth lookups, the gradvarg state machine and a music-volume tracker (FUN_0047ab00).

import { T, fadeMusic, playMusic, stopMusic, sample, depthVol, world, type Obj } from '../api.ts';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** FUN_00401510: (rand() + (QPC & 0xffff)) & 0x7fff, 0..32767. */
export const rnd = (): number => Math.floor(Math.random() * 32768);

/** True if `o` currently plays the track with HW handle `h` (the original compares RONJA+0x248 with FUN_004501a0(0x9xxxxx)). */
export const trackIs = (o: Obj, h: number): boolean => !!o.track && o.track.name.toLowerCase() === T(h).toLowerCase();

/** Hide the sprite and stop the track (FUN_004192e0(blit, id, 0) + FUN_004563d0). */
export function hideStop(o: Obj): void {
  o.hide();
  o.stopTrack();
}

/**
 * A positional effect: only if the single sample channel is idle (FUN_0047ae70 == 0). Volume FUN_0041fdc0(z) (+ volAdd), pan = x/5 - 1.
 * `x`, `z` = position of the object the original reads (cone, Ronja ...).
 */
export function effect(name: string, x: number, z: number, volAdd = 0): void {
  if (sample.playing()) return;
  const vol = clamp(Math.trunc(depthVol(z)) + volAdd, 0, 127);
  const pan = clamp(-1 - Math.trunc(x * -0.2), 0, 127);
  sample.play(name, vol, pan);
}

/** FUN_00420030: one of the three "aj" effects (rnd % 3). */
export function ajEffect(x: number, z: number, volAdd = 0): void {
  const k = rnd() % 3;
  effect(`EFFEKT_14_${k + 1}_gradvargaj`, x, z, volAdd);
}

/** Background depth at a scene point (FUN_00417160: the Z layer as a signed short; out of range -> 32767). */
export function bgDepth(x: number, y: number): number {
  const sc = world.scene;
  if (!sc || !sc.maps.z) return 32767;
  const cx = clamp(Math.trunc(x), 0, sc.width - 1), cy = clamp(Math.trunc(y), 0, 479);
  const v = (sc.maps.z[cy * sc.width + cx] << 16) >> 16;
  return v < 0 || v > 32767 ? 32767 : v;
}

/** The floor height map under a scene point (DAT_004ee720, a ushort map; 0xFFFF = no floor): 32767 outside the screen. */
export function zBuffer(x: number, y: number): number {
  const sc = world.scene;
  if (!sc || !sc.maps.h) return 32767;
  if (!(y >= 0 && y < 480 && x >= 0 && x < 640)) return 32767;
  return sc.maps.h[Math.trunc(y) * sc.width + Math.trunc(x)];
}

/** Inclusive screen-rect hit test of an object's sprite at a scene point (FUN_0041fe70): its z if inside, else 0. */
export function rectDepth(o: Obj, x: number, y: number): number {
  if (o.hidden || !o.frame) return 0;
  const r = o.screenRect();
  if (!r) return 0;
  const pan = world.scene?.pan ?? 0;
  const sx = x - pan;
  return sx >= r[0] && sx <= r[2] && y >= r[1] && y <= r[3] ? o.z : 0;
}

/**
 * A landing / flight test of a thrown cone after its move (lake, cave and snowball): `zOld` = depth before the move, `o` = the cone.
 * Lands where the scenery depth (Z layer) lies in [z_new, z_old + 128), or the floor under it is nearer than the cone, or it leaves the screen.
 */
export function landed(o: Obj, zOld: number, outOfScreen: (x: number, y: number) => boolean): boolean {
  const bg = bgDepth(o.x, o.y);
  const zb = zBuffer(o.x, o.y);
  return (o.z <= bg && bg < zOld + 128) || zb < o.z || outOfScreen(o.x, o.y);
}

// ------------------------------------------------------------------ music volume (FUN_0047ab00)

let curVol = 0, fadeFrom = 0, fadeTo = 0, fadeT0 = 0, fadeMs = 0;

/** Play a tune and remember its volume. */
export function mPlay(name: string, vol: number, tempoPct?: number): void {
  void playMusic(name, vol, tempoPct);
  curVol = vol; fadeMs = 0;
}
export function mStop(): void {
  stopMusic();
  curVol = 0; fadeMs = 0;
}
/** Fade the music to `to` over `ms`. */
export function mFade(to: number, ms: number): void {
  fadeFrom = mVol(); fadeTo = to; fadeT0 = performance.now(); fadeMs = ms;
  fadeMusic(to, ms);
}
/** Current sequence volume (0 when stopped or silent). */
export function mVol(): number {
  if (fadeMs > 0) {
    const f = Math.min(1, (performance.now() - fadeT0) / fadeMs);
    const v = Math.trunc(fadeFrom + (fadeTo - fadeFrom) * f);
    if (f >= 1) { curVol = fadeTo; fadeMs = 0; return curVol; }
    return v;
  }
  return curVol;
}

// ------------------------------------------------------------------ the grey dwarves (gradvargar)

export interface Slot {
  obj: Obj;
  walk: number;
  fall: number;
  stamp: number;
  roll: number;
}

export interface SwarmCfg {
  /** a slot that never spawns (lake 6, cave 9) */
  skip: number;
  /** spawning is refused while more than this many are active (lake 4, cave 8) */
  maxActive: number;
  /** FUN_0042e8d0(20) / FUN_0042b860(0x16): more than `winHits` direct hits ends the game */
  winHits: number;
  /** phase to switch to when the swarm is beaten (lake 4, cave 2) */
  winPhase: number;
  /** setTrack flags of the roll track (lake 0x81, cave 0xa1) */
  rollFlags: number;
}

/** The ten gradvarg slots: state 0 idle, 1 walking to the rock, 2 stamping at the rock, 3 hit, 4 falling (FUN_0042e910 / FUN_0042b8a0). */
export class Swarm {
  state: number[] = new Array(10).fill(0);
  /** gradvargar currently in play (+0x408) */
  active = 0;
  /** direct hits (+0x40c) */
  hits = 0;
  readonly slots: Slot[];
  readonly cfg: SwarmCfg;
  constructor(slots: Slot[], cfg: SwarmCfg) { this.slots = slots; this.cfg = cfg; }

  /** FUN_0042e8d0 / FUN_0042b860: true once enough were hit; switches the phase when nothing is left on the field. */
  win(phase: () => number, setPhase: (p: number) => void): boolean {
    if (this.cfg.winHits < this.hits) {
      if (this.active < 1 && phase() < 1) setPhase(this.cfg.winPhase);
      return true;
    }
    return false;
  }

  /** One AI step of slot `i`. */
  ai(i: number, phase: () => number, setPhase: (p: number) => void): void {
    if (i === this.cfg.skip) return;
    const s = this.slots[i], o = s.obj;
    if (this.state[i] === 0 && !o.track && phase() < 1 && !this.win(phase, setPhase)) {
      if (rnd() > 0x4f) return;
      if (this.active > this.cfg.maxActive) return;
      this.state[i] = 1;
      this.active++;
      o.setTrack(s.walk, 0);
      return;
    }
    const st = this.state[i];
    if (st === 1 && !o.track) {
      this.state[i] = 2;
      o.setTrack(s.stamp, 1);
    } else if (st === 3) {
      this.state[i] = 4;
      o.setTrack(s.fall, 0);
    } else if (st === 4) {
      if (o.track) return;
      this.state[i] = 0;
      this.active--;
      o.setTrack(s.roll, this.cfg.rollFlags);
    }
  }

  /** gradvargar standing at the rock */
  atRock(): number {
    let n = 0;
    for (const s of this.state) if (s === 2) n++;
    return n;
  }

  /** FUN_0042ed70: everything in play falls. */
  fallAll(): void {
    for (let i = 0; i < 10; i++) if (this.state[i] > 0) this.state[i] = 3;
  }

  /** Still moving on the screen (±50 px margin, a track running): the win phase waits for these to leave. */
  anyAnimating(): boolean {
    for (const s of this.slots) {
      const o = s.obj;
      if (o.x + 50 > 0 && o.x - 50 < 640 && o.y + 50 > 0 && o.y - 50 < 480 && o.track) return true;
    }
    return false;
  }
}
