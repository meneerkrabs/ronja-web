// Scene 1B LOVISMATTISRUM, Mattis' and Lovis' room (game-logic.md §3.2): the leather strap (REM), Lovis at her spinning wheel.

import {
  O, T, doDialogAni, dispatch, g, setG, gv, inInv, lastDialog, registerScene, usePortal, type SceneScript,
} from '../api.ts';

const lovisIdle = () => O.LOVIS.loop(T(40));

/** LAB_0045f830: after talking to Lovis: she says "Ronja, take it" if the strap was not taken. */
function mouthDone() {
  const e = lastDialog.event;
  if (!inInv(O.REM) && (e === 52 || e === 53 || e === 54)) { doDialogAni(55, mouthDone, O.RONJA, false); return; }
  lovisIdle();
}

const script: SceneScript = {
  enter() {
    O.ELD1.loop(T(1279)); O.ELD2.loop(T(1280)); O.ELD3.loop(T(1281)); O.ELD4.loop(T(1292));
    if (!inInv(O.REM)) O.REM.loop(T(1102)); // the strap lies by the spinning wheel
    if (gv.act !== 1) {
      if (g(0x8e0) && !g(0x8d8) && g(0x90d)) {
        O.RONJA.standStill(500, 378, 0, 1);
        setG(0x8d8, 1);
        doDialogAni(58, null, null, false);
      }
      return;
    }
    lovisIdle();
    if (!g(0x8e6)) doDialogAni(46, null, null, false);
  },

  cursor(r) {
    switch (r) {
      case 1: return !inInv(O.REM) ? 'hilite' : 'normal';
      case 2: return 'N';
      case 3: return 'NO';
      case 4: return gv.act === 1 ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (r === 2) return usePortal('EXIT_LOVISMATTISRUM_to_SKALLEPERSRUM');
    if (r === 3) return usePortal('EXIT_LOVISMATTISRUM_to_STORASALEN');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r) => { if (r === 1) dispatch(125, 0, null, O.RONJA); else if (r === 4) dispatch(6, 0, mouthDone, O.RONJA); },
  hand: (r) => { if (r === 1) dispatch(125, 1, null, O.RONJA); else if (r === 4) dispatch(6, 1, lovisIdle, O.RONJA); },
  eye: (r) => { if (r === 1) dispatch(125, 2, null, O.RONJA); else if (r === 4) dispatch(6, 2, lovisIdle, O.RONJA); },
};

registerScene('LOVISMATTISRUM', script);
