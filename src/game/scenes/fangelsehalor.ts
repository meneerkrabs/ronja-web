// Scene 7 FANGELSEHALOR, the prison caves (game-logic.md §3.10): the stone heap (hook slapaStenar, hooks/castle-cellar.ts),
// Birk behind it, the bread cake that ends act 2 (together with the snowball fight).

import {
  O, T, doDialogAni, dispatch, enterScene, g, gv, playMovie, playMusic, registerScene, setG, setPan, usePortal,
  type SceneScript,
} from '../api.ts';

/** 0x41fa70: spring.smk is over: act 3 in the great hall with Skalle-Per. */
export function springEnd() {
  const R = O.RONJA;
  R.hidden = false;
  setG(0x915, 1);
  R.setTrack(T(936));
  playMusic('dls_eld_40_', 127, 33.33);
  O.RATTBUR.holder = O.MATTIS; // the rat trap is gone
}

/** FUN_00462990: act 3, spring.smk. */
export function startSpring() {
  gv.act = 3;
  setPan(0);
  enterScene('STORASALEN');
  setPan(0);
  O.RONJA.hide();
  playMovie('spring.smk', 64, 69, () => springEnd());
}

const breadWithBirk = () => O.BRODKAKA.holder === O.BIRK || O.BRODKAKA.holder?.holder === O.BIRK;
const birkQuiet = () => O.BIRK.setTrack(T(693), 1); // LAB_00462920: Birk_7_136A1_tyst
/** LAB_00462950: the bread is with Birk; if the snowball fight was won too, spring begins. */
function afterBread() {
  if (g(0x8de) && (g(0x8f4) || breadWithBirk())) startSpring();
}

const script: SceneScript = {
  enter() {
    const R = O.RONJA;
    setG(0x8f2, 1); // came from the prison
    if (!g(0x8f3)) {
      setG(0x8f3, 1);
      doDialogAni(167, () => { enterScene('FANGELSEHALOR', { force: true }); R.standStill(R.x, R.y, 0, 1); }, R, false);
      O.FACKLA.holder = O.MATTIS; // the torch is used up
    } else O.ELD1.loop(T(1203));
    if (!g(0x8f5)) {
      O.HINDER.loop(T(907));
      O.BIRK.setPosition(1000, 1000, 4000);
    } else if (!g(0x8f4)) {
      if (g(0x8e4)) O.BIRK.loop(T(693));
      else { setG(0x8e4, 1); doDialogAni(256, birkQuiet, null, false); }
    }
  },

  cursor(r) {
    switch (r) {
      case 1: return 'N';
      case 2: return !g(0x8f5) ? 'hilite' : 'normal';
      case 3: return !g(0x8f4) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (r === 1) return usePortal('EXIT_FANGELSEHALOR_to_KAELLARE');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth(r) {
    if (r === 2) dispatch(33, 0, null, O.RONJA);
    else if (r === 3) {
      dispatch(34, 0, () => {
        if (!g(0x8ee)) { setG(0x8ee, 1); doDialogAni(717, birkQuiet, O.RONJA, false); } // LAB_00462a00: the stairs creak
        else birkQuiet();
      }, O.RONJA);
    }
  },
  hand(r) {
    if (r === 2) dispatch(33, 1, null, O.RONJA);
    else if (r === 3) dispatch(34, 1, birkQuiet, O.RONJA);
  },
  eye(r) {
    if (r === 2) dispatch(33, 2, null, O.RONJA);
    else if (r === 3) dispatch(34, 2, null, O.RONJA);
  },

  useItem(item, r) {
    if (r !== 3 || g(0x8f4)) return;
    if (item === O.BRODKAKA) {
      doDialogAni(258, afterBread, O.RONJA, false);
      O.BRODKAKA.holder = O.BIRK;
    } else doDialogAni(260, birkQuiet, O.RONJA, false);
  },
};

registerScene('FANGELSEHALOR', script);
