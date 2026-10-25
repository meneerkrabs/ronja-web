// Scene 1D KOKET, the kitchen with the cellar hatch (game-logic.md §3.4): flint, fire steel, the stove, the rat trap,
// the knife, the torch. Items are picked up by track hooks (hooks/act1-kitchen.ts).

import {
  O, T, doDialogAni, dispatch, g, setG, gv, inInv, playMusic, registerScene, usePortal, winter, type SceneScript,
} from '../api.ts';

const script: SceneScript = {
  enter() {
    setG(0x8d4, 1);
    O.ELD2.loop(T(1286)); O.ELD3.loop(T(1287)); O.ELD4.loop(T(1285));
    if (!g(0x90c)) O.KNIV.setTrack(T(934)); // the knife lies on the table
    if (!inInv(O.ELDSTAL)) O.ELDSTAL.setTrack(T(334));
    if (!inInv(O.FLINTA)) O.FLINTA.setTrack(T(333));
    if (g(0x8e8)) { O.ELD1.loop(T(977)); playMusic('dls_eld_40_', 127, 33.33); }
    if (g(0x8e0) && O.FACKLA.holder === null) {
      if (!g(0x8e7)) {
        O.SKALLEPER.setTrack(T(416), 0x100, () => { setG(0x8e7, 1); doDialogAni(160, null, null, false); });
      } else O.FACKLA.setTrack(T(965));
    }
    if (O.RATTBUR.holder === null) {
      if (O.RATTA.holder === O.RATTBUR) O.RATTBUR.setTrack(T(900));
      else if (O.OST.holder === O.RATTBUR) { O.RATTA.holder = O.RATTBUR; O.OST.holder = O.RATTA; O.RATTBUR.setTrack(T(900)); } // the rat is caught on re-entry
      else O.RATTBUR.setTrack(T(898));
    }
  },

  cursor(r) {
    switch (r) {
      case 1: return 'V';
      case 2: return winter() ? 'normal' : 'N';
      case 3: return g(0x8d7) && gv.act === 2 ? 'S' : 'hilite';
      case 4: return !inInv(O.FLINTA) ? 'hilite' : 'normal';
      case 5: return !inInv(O.ELDSTAL) ? 'hilite' : 'normal';
      case 6: return !g(0x8e8) ? 'hilite' : 'normal';
      case 8: return 'hilite';
      case 9: return !inInv(O.RATTBUR) ? 'hilite' : 'normal';
      case 10: return O.RATTA.holder === null ? 'hilite' : 'normal';
      case 11: return !g(0x90c) ? 'hilite' : 'normal';
      case 12: return g(0x8e0) && O.FACKLA.holder === null ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (r === 1) return usePortal('EXIT_KOKET_to_STORASALEN');
    if (r === 2 && !winter()) return usePortal('EXIT_KOKET_to_BORGGARDEN');
    if (r === 3 && g(0x8d7) && gv.act === 2) return usePortal('EXIT_KOKET_to_KAELLARE');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r) => verb(r, 0),
  hand: (r) => verb(r, 1),
  eye: (r) => verb(r, 2),

  useItem(item, r) {
    const R = O.RONJA;
    if (r === 4 && item === O.ELDSTAL && !inInv(O.FLINTA)) { doDialogAni(664, null, R, false); return; }
    if (r === 5 && item === O.FLINTA && !inInv(O.ELDSTAL)) { doDialogAni(663, null, R, false); return; }
    if (r === 6) {
      if (!g(0x8e8) && g(0x8e9)) { doDialogAni(item === O.ELDSTAL && O.FLINTA.holder === O.ELDSTAL ? 559 : 558, null, R, false); return; }
      if (!g(0x8e8)) {
        if (item === O.FNOSKE) { setG(0x8e9, 1); R.walkAndPlay(T(429)); } else doDialogAni(557, null, R, false);
        return;
      }
      if (item === O.FACKLA && !g(0x90d)) R.walkAndPlay(T(1056));
      return;
    }
    if (r === 9 || r === 10) {
      if (item === O.RATTBUR) {
        if (O.RATTA.holder === O.RATTBUR) return;
        doDialogAni(O.OST.holder !== O.RATTBUR ? 144 : 145, null, R, false);
      } else if (item === O.OST && !inInv(O.RATTBUR)) doDialogAni(665, null, R, false);
    }
  },
};

function verb(r: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  switch (r) {
    case 3: return dispatch(88, v, null, R);
    case 4: return dispatch(15, v, null, R);
    case 5: return dispatch(16, v, null, R);
    case 6: return dispatch(95, v, null, R);
    case 8: return dispatch(101, v, null, R);
    case 9: return dispatch(O.RATTA.holder === O.RATTBUR ? 18 : O.OST.holder !== O.RATTBUR ? 17 : 97, v, null, R);
    case 10: return dispatch(96, v, null, R);
    case 11: return dispatch(20, v, null, R);
    case 12: return dispatch(21, v, null, R);
  }
}

registerScene('KOKET', script);
