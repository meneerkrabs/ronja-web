// Scene 15 GROTTANUTE, outside the bear cave (game-logic.md §3.17). Act 3 only: the stone block in front of the cave (Birk and Ronja
// push it away), the cave defence (mode 6), Lill-Klippen's visit after the summer and Lovis' visit before the ending.

import {
  O, T, dispatch, g, setG, gv, inInv, lastDialog, playMusic, registerScene, usePortal, type DoneCb, type SceneScript,
} from '../api.ts';
import { birkHit, talkToBirk } from '../birk-talk.ts';
import { startCaveDefence } from '../story.ts';

/** Lovis waits here: river with the bird witch done, horses handled, not yet talked to. */
const lovisHere = () => !!(g(0x8e2) && g(0x902) && !g(0x905));
/** Lill-Klippen waits here: right after the summer until GLAENTAN is visited. */
const lillKlippenHere = () => !!(g(0x8f7) && !g(0x8f8));

/** LAB_00467d40: after "HjalpMej" (#421) Ronja and Birk walk to their track starts and push the stone block away together. */
const pushStone: DoneCb = (cancelled) => {
  if (cancelled || lastDialog.event !== 421) return;
  let arrived = 0;
  const go = (interrupted: boolean) => { // LAB_00467cc0
    if (interrupted) return;
    if (++arrived < 2) return;
    O.RONJA.setTrack(T(1109));
    O.BIRK.setTrack(T(1110));
    O.HINDER.setTrack(T(1108)); // its end hook sets g907
  };
  O.RONJA.walkToTrackStart(T(1109), go);
  O.BIRK.walkToTrackStart(T(1110), go);
};

/** Birk's lines (region 0x80), same for every verb except the callback of the first group. */
function birkLine(v: 0 | 1 | 2) {
  const follows = gv.act === 3 && inInv(O.BIRK);
  if (g(0x905)) return talkToBirk(81, v);
  if (g(0x8f9) && !g(0x8f8)) return talkToBirk(79, v);
  if (!g(0x907)) return talkToBirk(74, v, v === 0 ? pushStone : null);
  if (g(0x90a) && !g(0x90b)) return talkToBirk(140, v);
  if (g(0x8df)) return talkToBirk(75, v);
  if (follows && !g(0x8f7)) return talkToBirk(130, v);
  if (follows && !g(0x90b) && g(0x8fa) && g(0x900)) { if (!g(0x8f7)) return talkToBirk(134, v); } else if (!g(0x8f7)) return;
  talkToBirk(83, v);
}

/** Regions 3 and 4 (the visitors): MOUTH 0, HAND 1, EYE 2. */
function visitor(r: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  if (lovisHere()) {
    // MOUTH and HAND both play the MOUTH event #480 and send Lovis away (g905 at once, 0x4681da / 0x4684ea)
    if (v === 2) return dispatch(80, 2, null, R);
    dispatch(80, 0, null, R);
    setG(0x905, 1);
    return;
  }
  if (r === 4) return;
  if (v === 0) {
    if (!g(0x8f9)) { setG(0x8f9, 1); return dispatch(77, 0, null, R); }
    return dispatch(78, 0, null, R);
  }
  dispatch(77, v, null, R);
}

function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (birkHit(x, y)) return birkLine(v);
  switch (r) {
    case 1: return dispatch(gv.act !== 3 ? 72 : 73, v, null, O.RONJA);
    case 3: case 4: return visitor(r, v);
  }
}

const script: SceneScript = {
  enter() {
    gv.mapBits |= 0x20;
    playMusic('dls_Forsengrottan_30_60vol', 55, 25);
    O.HINDER.setTrack(g(0x907) ? T(1265) : T(951));
    if (gv.act !== 3) return;
    const B = O.BIRK;
    if (g(0x905) && !g(0x906)) { B.setTrack(T(984)); return; }
    if (lovisHere()) { O.LOVIS.setTrack(T(374)); B.setTrack(T(984)); return; }
    if (lillKlippenHere()) {
      O.LILLKLIPPEN.setTrack(T(477));
      B.setTrack(T(981));
      O.RONJA.standStill(154, 315, 0, 5);
      return;
    }
    if (!inInv(B)) { B.hide(); return; }
    B.hidden = false;
    B.walkTo(306, 386, 0, null, 3);
  },

  cursor(r, x, y) {
    if (gv.act === 3 && birkHit(x, y)) return 'hilite';
    switch (r) {
      case 1: return g(0x907) ? 'NV' : 'hilite';
      case 2: return 'N';
      case 3: return lovisHere() || lillKlippenHere() ? 'hilite' : 'normal';
      case 4: return lovisHere() ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    const reg = birkHit(x, y) ? 0x80 : r;
    if (reg === 1 && g(0x907)) {
      if (!g(0x8df)) startCaveDefence();
      else usePortal('EXIT_GROTTANUTE_to_GROTTANINNE');
      return;
    }
    if (reg === 2) return usePortal('EXIT_GROTTANUTE_to_GLAENTAN');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),
};

registerScene('GROTTANUTE', script);
