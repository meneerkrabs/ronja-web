// Shared helpers of the forest scenes (SKOGEN, KAELLAN, GLAENTAN, GLUPAFALLET, TJAERNEN; game-logic.md §3.12-3.16, §3.19):
// the synchronised Ronja + Birk walks (FUN_0045e870 / 0045ea70 / 0045ec80), Birk hit test and the act 3 "talk to Birk" helper
// (FUN_00462e80 + the staged table of §3.19).  Not a core file: only the forest scenes import it.

import {
  O, g, gv, inInv, busy, world, dispatch, doDialogAni, BUSY_SYNC, type DispatchVerb, type DoneCb,
} from './api.ts';
import type { Track } from '../formats/trk.ts';

type TrackRef = Track | string | number;

/** Birk is in the party (act 3, BIRK.holder chain == RONJA). */
export const birkFollows = (): boolean => gv.act === 3 && inInv(O.BIRK);

/** Pixel hit of Birk's current frame at scene point (x, y); only in act 3 (the forest handlers' region 0x80). */
export function hitBirk(x: number, y: number): boolean {
  return gv.act === 3 && O.BIRK.hitTest(x - (world.scene?.pan ?? 0), y);
}

/**
 * FUN_0045e870 core: Ronja and Birk each walk to the start of their track; `then` runs when both have arrived.
 * While one waits for the other the engine is busy (bit 2); an interrupted walk clears it and drops the sequence.
 */
export function syncWalk(trackR: TrackRef, trackB: TrackRef, then: () => void): void {
  let arrived = 0;
  const arrive = (bit: number) => (interrupted: boolean) => {
    if (interrupted) { busy.bits &= ~BUSY_SYNC; return; }
    arrived |= bit;
    if (arrived === 3) { busy.bits &= ~BUSY_SYNC; then(); } else busy.bits |= BUSY_SYNC;
  };
  O.RONJA.walkToTrackStart(trackR, arrive(1));
  O.BIRK.walkToTrackStart(trackB, arrive(2));
}

/** FUN_0045e870(trackR, trackB): synchronised walk, then both tracks start together. */
export function syncPlay(trackR: TrackRef, trackB: TrackRef): void {
  syncWalk(trackR, trackB, () => { O.RONJA.setTrack(trackR); O.BIRK.setTrack(trackB); });
}

/** FUN_0045ea70(event, trackR, trackB, doneCb): synchronised walk, then DoDialogAni(event, cb, RONJA, force). */
export function syncDialog(eventId: number, trackR: TrackRef, trackB: TrackRef, cb: DoneCb | null): void {
  syncWalk(trackR, trackB, () => doDialogAni(eventId, cb, O.RONJA, true));
}

/** FUN_0045ec80(group, verb, trackR, trackB, doneCb): synchronised walk, then Dispatch(group, verb, cb, RONJA, force). */
export function syncDispatch(group: number, verb: DispatchVerb, trackR: TrackRef, trackB: TrackRef, cb: DoneCb | null): void {
  syncWalk(trackR, trackB, () => dispatch(group, verb, cb, O.RONJA, true));
}

// ---------------------------------------------------------------------------------------- talking to Birk (act 3)

/** Birk groups of the stages A..F (§3.19); -1 = none. */
export const BIRK_TABLES = {
  SKOGEN: [36, 37, 38, 39, 126, 82],
  KAELLAN: [64, 66, 65, 67, 137, 84],
  GLAENTAN: [59, 60, 61, 62, 135, -1],
  GLUPAFALLET: [130, 132, 131, 133, 134, 83],
  TJAERNEN: [130, 132, 131, 133, 134, 83],
} as const;
export type BirkTable = readonly number[];

/**
 * HOOK POINT for the act 3 Birk talk (owned by the cave/Birk agent): set `birkTalk.override` to replace the default
 * implementation below; it receives the stage table of the scene, the dispatch verb and the optional done callback.
 */
export const birkTalk: { override: ((table: BirkTable, verb: DispatchVerb, cb: DoneCb | null) => void) | null } = { override: null };

/** The staged condition chain of §3.19: 0 A .. 5 F, -1 = nothing (needs act 3 and Birk in the party). */
export function birkStage(): number {
  if (!birkFollows()) return -1;
  const summer = !!g(0x8f7);
  if (!g(0x8df) && !summer) return 0;
  if (g(0x8df) && !g(0x90a) && !summer) return 1;
  if (g(0x8df) && g(0x90a) && !g(0x8fa) && !summer) return 2;
  if (g(0x8df) && g(0x90a) && !g(0x900) && !summer) return 3;
  if (!g(0x90b) && g(0x8fa) && g(0x900) && !summer) return 4;
  if (summer) return 5;
  return -1;
}

/** FUN_00462e80(group, verb, cb): talk to Birk — face each other (walking to him if he is far away), then Dispatch. */
export function talkToBirk(group: number, v: DispatchVerb, cb: DoneCb | null = null): void {
  const R = O.RONJA, B = O.BIRK;
  const dist = Math.abs(R.x - B.x) + Math.abs(R.y - B.y);
  const face = (rd: number, bd: number) => {
    R.standStill(R.x, R.y, R.z, rd, false);
    B.standStill(B.x, B.y, B.z, bd, false);
  };
  if (dist <= 200) {
    if (B.x < R.x) face(B.y <= R.y + 5 ? 1 : 3, B.y <= R.y - 5 ? 5 : 7);
    else face(B.y <= R.y + 5 ? 7 : 5, B.y <= R.y - 5 ? 3 : 1);
    dispatch(group, v, cb, null, false);
    return;
  }
  const left = B.x - 100 >= 0;
  R.walkTo(left ? B.x - 100 : B.x + 100, B.y, 0, (interrupted) => {
    if (interrupted) return;
    if (left) face(7, 1); else face(1, 7);
    dispatch(group, v, cb, null, false);
  }, -1);
}

/** Click on Birk in a forest scene: pick the stage group of the scene's table and talk. */
export function talkToBirkStaged(table: BirkTable, v: DispatchVerb, cb: DoneCb | null = null): void {
  if (birkTalk.override) { birkTalk.override(table, v, cb); return; }
  const st = birkStage();
  if (st < 0) return;
  const grp = table[st];
  if (grp === undefined || grp < 0) return;
  talkToBirk(grp, v, cb);
}

/**
 * Scroll position the scene starts in: the portal transition has already placed Ronja at the arrival portal when the enter script
 * runs (scroll = floor(x / 640) * 640 is set right after), so the arrival side follows from her x.
 */
export const arrivalPan = (): number => Math.floor(O.RONJA.x / 640) * 640;

/** Show Birk (party member) and walk him to (x, y) facing `dir`. */
export function birkJoins(x: number, y: number, dir: number): void {
  O.BIRK.show();
  O.BIRK.walkTo(x, y, 0, null, dir);
}
