// Shared act 3 helpers for scenes in which Birk walks along (game-logic.md §3.19, engine.md §3.8 and §4.3):
//  * Birk as a clickable "region 0x80" (pixel hit test) and the staged talk-to-Birk chain of the forest scenes;
//  * FUN_00462e80 "talk to Birk" (Ronja walks up to Birk, both turn towards each other, then the hotspot group plays);
//  * FUN_0045e870 / FUN_0045ea70 / FUN_0045ec80: Ronja and Birk walk to their track starts together, then the tracks
//    (or a dialogue event / hotspot group) start at the same moment.
//
// Typical use in a forest scene script (act 3):
//   cursor(r, x, y)  { if (birkHit(x, y)) return 'hilite'; ... }                 // or birkCursor(x, y)
//   mouth(r, x, y)   { if (birkClick(BIRK_GROUPS.SKOGEN, 0, x, y)) return; ... } // hand: 1, eye: 2
// `birkClick` returns true when the click was on Birk (the scene must then not handle the click any further, exactly like the
// original, where a Birk hit replaces the region id by 0x80), also when no stage of the chain matches (nothing happens).

import { O, world, inInv, gv, g, dispatch, doDialogAni, trackStart, core, busy } from './api.ts';
import type { DoneCb, Obj } from './api.ts';
import type { Track } from '../formats/trk.ts';
import { BUSY_SYNC } from './types.ts';
import type { DispatchVerb } from './types.ts';
import { birkTalk } from './forest.ts';

/** Birk follows Ronja: act 3 and Birk is carried by Ronja (`BIRK.holder == RONJA`). */
export const birkFollowing = (): boolean => gv.act === 3 && inInv(O.BIRK);

/** Pixel-accurate hit on Birk (act 3 only) at a *scene* point (FUN_00456940 on Birk's current frame, x minus the scroll). */
export function birkHit(x: number, y: number): boolean {
  if (gv.act !== 3) return false;
  const pan = world.scene?.pan ?? 0;
  return O.BIRK.hitTest(x - pan, y);
}

/** Cursor of Birk (`hilite`) or `null` when the point is not on Birk. */
export const birkCursor = (x: number, y: number): 'hilite' | null => (birkHit(x, y) ? 'hilite' : null);

/** The six hotspot groups of the staged Birk lines per scene (stage A..F; `null` = no such line). */
export type BirkGroups = readonly [number, number, number, number, number, number | null];
export const BIRK_GROUPS = {
  SKOGEN: [36, 37, 38, 39, 126, 82],
  KAELLAN: [64, 66, 65, 67, 137, 84],
  GLAENTAN: [59, 60, 61, 62, 135, null],
  GLUPAFALLET: [130, 132, 131, 133, 134, 83],
  TJAERNEN: [130, 132, 131, 133, 134, 83],
  GROTTANINNE: [130, 132, 131, 139, 134, 83],
} as const satisfies Record<string, BirkGroups>;

/**
 * The stage of the story for Birk's lines: 0 A "Kan vi inte...", 1 B (cave defended), 2 C (fire burns), 3 D (salmon),
 * 4 E (hungry), 5 F (summer); -1 = none. Same chain in every forest scene and in GROTTANINNE (FUN_00463660 etc.).
 */
export function birkStage(): number {
  const follow = birkFollowing();
  const summer = !!g(0x8f7);
  if (follow && !g(0x8df) && !summer) return 0;
  if (follow && g(0x8df) && !g(0x90a) && !summer) return 1;
  if (follow && g(0x8df) && g(0x90a) && !g(0x8fa) && !summer) return 2;
  if (follow && g(0x8df) && g(0x90a) && !g(0x900) && !summer) return 3;
  if (follow && !g(0x90b) && g(0x8fa) && g(0x900) && !summer) return 4;
  return summer ? 5 : -1;
}

/**
 * Click on Birk in a forest scene (hit test + staged chain). `v` = 0 MOUTH, 1 HAND, 2 EYE; `x, y` = scene point.
 * Returns true if the click hit Birk (handled, possibly by doing nothing).
 */
export function birkClick(groups: BirkGroups, v: DispatchVerb, x: number, y: number, cb: DoneCb | null = null): boolean {
  if (!birkHit(x, y)) return false;
  birkStaged(groups, v, cb);
  return true;
}

/** The staged chain for a Birk click that was already detected. */
export function birkStaged(groups: BirkGroups, v: DispatchVerb, cb: DoneCb | null = null): void {
  const s = birkStage();
  if (s < 0) return;
  const grp = groups[s];
  if (grp !== null && grp !== undefined) talkToBirk(grp, v, cb);
}

// ------------------------------------------------------------------ FUN_00462e80

/**
 * "Talk to Birk" (FUN_00462e80): if Ronja is within 200 px (Manhattan) of Birk, both turn towards each other and the group is
 * dispatched at once; otherwise Ronja first walks to (Bx-100, By) (or Bx+100 when that would be off the left edge) and they turn
 * when she arrives. The hotspot group is played with `actor = null` (voices only).
 */
export function talkToBirk(group: number, v: DispatchVerb, cb: DoneCb | null = null): void {
  const R = O.RONJA, B = O.BIRK;
  if (Math.abs(R.x - B.x) + Math.abs(R.y - B.y) <= 200) {
    const birkLeft = B.x <= R.x;
    const up = B.y <= R.y + 5;     // Birk (a bit) above Ronja
    const upB = B.y <= R.y - 5;
    R.currDirec = birkLeft ? (up ? 1 : 3) : (up ? 7 : 5);
    B.currDirec = birkLeft ? (upB ? 5 : 7) : (upB ? 3 : 1);
    dispatch(group, v, cb, null, false);
    return;
  }
  let tx = B.x - 100;
  let rd = 7, bd = 1; // Ronja left of Birk: she looks north-east, he north-west
  if (tx < 0) { tx = B.x + 100; rd = 1; bd = 7; }
  R.walkTo(tx, B.y, 0, (interrupted) => {
    if (interrupted) return;
    R.currDirec = rd;
    B.currDirec = bd;
    dispatch(group, v, cb, null, false);
  }, -1);
}

// ------------------------------------------------------------------ synchronised walks (FUN_0045e870, FUN_0045ea70, FUN_0045ec80)

const trackOf = (t: Track | string | number): Track | undefined => (typeof t === 'object' ? t : core.assets.track(t));

/**
 * Ronja and Birk both walk to the start of their track; when both have arrived `go()` runs (the busy bit 2 locks input while one
 * of them waits). Walk interruptions only release the lock.
 */
export function syncWalk(trackR: Track | string | number, trackB: Track | string | number, go: () => void): void {
  const R = O.RONJA, B = O.BIRK;
  const tr = trackOf(trackR), tb = trackOf(trackB);
  if (!tr || !tb) { console.warn('syncWalk: track not found', trackR, trackB); go(); return; }
  const sr = trackStart(tr), sb = trackStart(tb);
  let bits = 0;
  const arrive = (who: Obj, bit: number, s: { x: number; y: number; z: number; dir: number }) => (interrupted: boolean) => {
    if (interrupted) { busy.bits &= ~BUSY_SYNC; return; }
    bits |= bit;
    if (bits === 3) { busy.bits &= ~BUSY_SYNC; bits = 0; go(); return; }
    busy.bits |= BUSY_SYNC;
    who.standStill(who.x, who.y, who.z, s.dir);
  };
  R.walkToTrackStart(tr, arrive(R, 1, sr));
  B.walkToTrackStart(tb, arrive(B, 2, sb));
}

/** FUN_0045e870: both walk to their track starts, then both tracks start together. */
export function syncPlay(trackR: Track | string | number, trackB: Track | string | number): void {
  syncWalk(trackR, trackB, () => { O.RONJA.setTrack(trackR); O.BIRK.setTrack(trackB); });
}

/** FUN_0045ea70: both walk to their track starts, then `DoDialogAni(event, cb, RONJA, force=1)`. */
export function syncDialog(eventId: number, trackR: Track | string | number, trackB: Track | string | number, cb: DoneCb | null = null): void {
  syncWalk(trackR, trackB, () => doDialogAni(eventId, cb, O.RONJA, true));
}

/** FUN_0045ec80: both walk to their track starts, then `Dispatch(group, verb, cb, RONJA, force=1)`. */
export function syncDispatch(group: number, v: DispatchVerb, trackR: Track | string | number, trackB: Track | string | number, cb: DoneCb | null = null): void {
  syncWalk(trackR, trackB, () => dispatch(group, v, cb, O.RONJA, true));
}

// ------------------------------------------------------------------ hook into the forest scenes (forest.ts `birkTalk.override`)

/** The forest scenes call `talkToBirkStaged(table, verb, cb)`; route them to the faithful chain and facing logic of this module. */
birkTalk.override = (table, v, cb) => {
  const s = birkStage();
  if (s < 0) return;
  const grp = table[s];
  if (grp !== undefined && grp >= 0) talkToBirk(grp, v, cb);
};
