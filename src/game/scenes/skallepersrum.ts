// Scene 1A SKALLEPERSRUM, Skalle-Per's room (game-logic.md §3.1): the chest, the map, Skalle-Per asleep in his bed.

import {
  O, T, doDialogAni, dispatch, g, setG, gv, inInv, lastDialog, registerScene, startMinigame, usePortal, winter, type SceneScript,
} from '../api.ts';

const snore = () => O.SKALLEPER.loop(T(1243));
const act1OrW = () => gv.act === 1 || winter();

/** LAB_0045eea0: dialogue with Skalle-Per / the map is over. */
function skalleDone() {
  const e = lastDialog.event, alt = lastDialog.alt;
  if (((e === 25 || e === 630 || e === 639) && alt === 0) || e === 28 || e === 633 || e === 641) { startMinigame(8); return; }
  if (e === 45 || e === 584) {
    O.KARTAN.hide();
    O.KARTAN.holder = O.RONJA;
    setG(0x90f, 1);
    O.RONJA.standStill(470, 422, 0, 7);
    if (e === 45) snore(); else O.SKALLEPER.hide();
    return;
  }
  snore();
}

const script: SceneScript = {
  enter() {
    if (g(0x90f) && !inInv(O.KARTAN)) O.KARTAN.loop(T(1276)); // the map lies in the open chest
    O.ELD1.loop(T(1290)); O.ELD2.loop(T(1277)); O.ELD3.loop(T(1278)); O.ELD4.loop(T(1291));
    if (act1OrW()) {
      if (!g(0x8e3)) { setG(0x8e3, 1); doDialogAni(622, null, null, false); } else snore();
    }
  },

  cursor(r) {
    switch (r) {
      case 1: case 5: return 'hilite';
      case 2: return 'NV';
      case 3: return 'NO';
      case 4: return (gv.act === 2 && !winter()) || gv.act === 3 ? 'normal' : 'hilite';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (r === 2) return usePortal('EXIT_SKALLEPERSRUM_to_TORNET');
    if (r === 3) return usePortal('EXIT_SKALLEPERSRUM_to_LOVISMATTISRUM');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r) => verb(r, 0),
  hand: (r) => verb(r, 1),
  eye: (r) => verb(r, 2),

  useItem(item, r) {
    if (r === 1 && !g(0x90f) && item === O.NYCKEL) {
      doDialogAni(40, null, O.RONJA, false);
      O.NYCKEL.holder = O.SKALLEPER;
    }
  },
};

function verb(r: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  const cb = v === 2 ? null : skalleDone;
  if (r === 1) return dispatch(act1OrW() ? 4 : 100, v, null, R);
  if (r === 4) {
    if (gv.act === 2 && g(0x8d7)) return dispatch(inInv(O.KARTAN) ? 122 : 121, v, cb, R);
    return dispatch(inInv(O.KARTAN) ? 122 : 3, v, cb, R);
  }
  if (r === 5) {
    if (act1OrW()) return inInv(O.KARTAN) ? dispatch(123, v, null, R) : dispatch(5, v, cb, R);
    return dispatch(inInv(O.KARTAN) ? 124 : 99, v, inInv(O.KARTAN) ? null : cb, R);
  }
}

registerScene('SKALLEPERSRUM', script);
