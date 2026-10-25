// Scene 9 SKOGEN, the forest (game-logic.md §3.12): hub of the forest scenes; in act 2 it is the fog scene where Birk is
// saved with the strap (#520) or Ronja is chased out by the subterraneans (#521).

import {
  O, T, doDialogAni, dispatch, g, setG, gv, playMusic, registerScene, usePortal, startMinigame, type DoneCb,
  type SceneScript,
} from '../api.ts';
import { BIRK_TABLES, arrivalPan, birkFollows, hitBirk, talkToBirkStaged } from '../forest.ts';

/** fog state F (act 2, Birk stumbled at the tarn, not yet saved, fog active) */
const fog = (): boolean => gv.act === 2 && !!g(0x8fc) && !g(0x8d5) && !!g(0x8e5);

/** FUN_004630e0 "BirkOchDimman": Birk runs off, the subterraneans appear, Mattis' voice calls Ronja away (#521). */
function birkAndFog() {
  O.BIRK.walkTo(700, 300, 0, (interrupted) => {
    if (interrupted) return;
    O.ELD1.loop(T(1240)); O.ELD2.loop(T(1241)); O.ELD3.loop(T(1242));
    O.RONJA.walkToTrackStart('RONJA_9b_327A1_BirkOchDimman', (i2) => {
      if (!i2) doDialogAni(521, null, O.RONJA, false);
    });
  }, -1);
}

/** LAB_004631b0: done callback of #520, the third winter condition may now be complete -> the ski run */
const afterRescue: DoneCb = (cancelled) => {
  if (!cancelled && gv.act === 2 && g(0x8d5) && g(0x8d6) && g(0x8d7)) startMinigame(3);
};

const script: SceneScript = {
  enter() {
    gv.mapBits |= 1;
    if (gv.act === 2) {
      if (g(0x8fc)) setG(0x8fe, 1);
      if (fog()) {
        playMusic('dls_underjordiska_120_80', 80, 100);
        O.BIRK.setTrack(T(994));   // BIRK_9A_326A1_hjalpaBirk: Birk lost in the fog
        O.RONJA.setTrack(T(993));  // RONJA_9A_326A1_hjalpaBirk
        return;
      }
    }
    playMusic('dls_skogenSommar_40_', 100, 33.33);
    if (gv.act === 3) {
      if (g(0x8fd)) setG(0x8ff, 1);
      if (birkFollows()) {
        O.BIRK.show();
        if (arrivalPan() < 640) O.BIRK.walkTo(300, 368, 0, null, 5);
        else O.BIRK.walkTo(1016, 364, 0, null, 3);
      } else O.BIRK.hide();
    }
  },

  cursor(r, x, y) {
    if (hitBirk(x, y)) return 'hilite';
    switch (r) {
      case 1: return 'NV';
      case 2: return 'N';
      case 3: return 'NO';
      case 4: return fog() ? 'hilite' : g(0x904) ? 'N' : 'normal';
      case 5: return 'V';
      case 6: return 'O';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (hitBirk(x, y)) return;
    switch (r) {
      case 1: return fog() ? birkAndFog() : usePortal('EXIT_SKOGEN_to_BORGPORTEN');
      case 2: return fog() ? birkAndFog() : usePortal('EXIT_SKOGEN_to_KAELLAN');
      case 3: return fog() ? birkAndFog() : usePortal('EXIT_SKOGEN_to_GLUPAFALLET');
      case 4: if (!fog() && g(0x904)) usePortal('EXIT_SKOGEN_to_GLAENTAN'); return;
      case 5: case 6: return birkAndFog();
    }
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),

  useItem(item, r) {
    if (r === 4 && fog() && item === O.REM) doDialogAni(520, afterRescue, O.RONJA, false);
  },
};

function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (hitBirk(x, y)) { talkToBirkStaged(BIRK_TABLES.SKOGEN, v); return; }
  if (r === 4 && fog()) dispatch(87, v, null, O.RONJA); // 9b Birk: talaBirk #516/#517, taBirk #518, tittaBirk #515
}

registerScene('SKOGEN', script);
