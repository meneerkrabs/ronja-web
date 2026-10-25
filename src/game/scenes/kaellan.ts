// Scene 10 KAELLAN, the spring (game-logic.md §3.13): the water vessel (act 3) and Mattis weeping at the spring (ending).

import {
  O, T, dispatch, g, setG, gv, playMusic, registerScene, usePortal, type SceneScript,
} from '../api.ts';
import { BIRK_TABLES, birkFollows, birkJoins, hitBirk, talkToBirkStaged } from '../forest.ts';

/** the vessel still lies at the spring (it is moved into the cave later: holder != null) */
const vesselThere = () => O.VATTENKARL.holder === null && !!g(0x8df);

const script: SceneScript = {
  enter() {
    gv.mapBits |= 2;
    setG(0x8e5, 0);
    O.ELD1.loop(T(1237)); // eld1_10_Gen_kaellaVatten
    playMusic('dls_kallan_40_40vol', 100, 33.33);
    if (gv.act === 2) { if (g(0x8fc)) setG(0x8fe, 1); return; }
    if (gv.act !== 3) return;
    if (g(0x8fd)) setG(0x8ff, 1);
    if (birkFollows()) birkJoins(74, 343, 5); else O.BIRK.hide();
    if (vesselThere()) O.VATTENKARL.setTrack(T(864)); // vattenkarl_10_gen_tomt
    if (g(0x905)) O.MATTIS.loop(T(895));              // MATTIS_10_313A1_MattisGrater
  },

  cursor(r, x, y) {
    if (hitBirk(x, y)) return 'hilite';
    switch (r) {
      case 1: return 'NV';
      case 2: return 'N';
      case 3: return 'NO';
      case 4: return vesselThere() ? 'hilite' : 'normal';
      case 6: return g(0x905) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (hitBirk(x, y)) return;
    if (r === 1) return usePortal('EXIT_KAELLAN_to_GLAENTAN');
    if (r === 2) return usePortal('EXIT_KAELLAN_to_SKOGEN');
    if (r === 3) return usePortal('EXIT_KAELLAN_to_TJAERNEN');
    if (r === 6) return;
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),

  useItem(item, r) {
    // FUN_00464880: fill the vessel at the spring (g90e is set by the track end hook)
    if (r === 5 && item === O.VATTENKARL && !g(0x90e)) O.RONJA.walkAndPlay(T(1269)); // RONJA_10_241A1_FyllaVattenA
  },
};

function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (hitBirk(x, y)) { talkToBirkStaged(BIRK_TABLES.KAELLAN, v); return; }
  if (r === 4) dispatch(63, v, null, O.RONJA); // vessel: talaVattenkarl #379, taVattenkarl #380, tittaVattenkarl #378
  else if (r === 6) dispatch(86, v, null, O.RONJA); // Mattis: #503 / #504 / #502
}

registerScene('KAELLAN', script);
