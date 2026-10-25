// Scene 13 GLUPAFALLET, the rapids (game-logic.md §3.15): the stone-jump river (modes 1 and 7, built elsewhere) and the
// fishing net / salmon of act 3.  Net and salmon side effects are track hooks (hooks/forest.ts).

import {
  O, T, dispatch, g, setG, gv, inInv, playMusic, registerScene, startMinigame, usePortal, type SceneScript,
} from '../api.ts';
import { BIRK_TABLES, birkFollows, birkJoins, hitBirk, syncPlay, talkToBirkStaged } from '../forest.ts';

/** salmon catchable: net set in the rapids, ripe (g8fb), nothing cooked or eaten yet */
const salmonCatchable = (): boolean =>
  gv.act === 3 && O.FISKNAT.holder === O.MATTIS && !inInv(O.LAX) && !g(0x908) && !!g(0x8fb);

/** the river crossing (stone region 0x3a) is open in act 1, and in act 3 with Birk */
const riverOpen = (): boolean => gv.act === 1 || (gv.act === 3 && birkFollows());

const script: SceneScript = {
  enter() {
    gv.mapBits |= 8;
    O.ELD1.loop(T(1235)); // eld1_13_Gen_ForsVatten1
    playMusic('dls_forsenBrus_30_100vol', 100, 25);
    setG(0x8e5, 0);
    if (gv.act === 2) { if (g(0x8fc)) setG(0x8fe, 1); return; }
    if (gv.act === 3) {
      if (g(0x8fd)) setG(0x8ff, 1);
      if (birkFollows()) {
        O.HINDER.loop(T(1234)); // HINDER_13_gen_FlyrVittra: the harpies fly
        birkJoins(408, 252, 5);
      } else O.BIRK.hide();
    }
    if (!inInv(O.FISKNAT) && g(0x8df)) {
      if (O.FISKNAT.holder === O.MATTIS) {
        O.FISKNAT.loop(T(1314)); // fisknat_13_gen_Ifors: the net in the rapids
        if (gv.act === 3 && !inInv(O.LAX) && !g(0x908)) setG(0x8fb, 1); // ripe after re-entering
      } else if (O.FISKNAT.holder === null) O.FISKNAT.loop(T(1081)); // fisknat_13_gen_Torkar: drying
    }
  },

  cursor(r, x, y) {
    if (hitBirk(x, y)) return 'hilite';
    switch (r) {
      case 1: return 'N';
      case 2: return 'NO';
      case 3: return 'NV';
      case 4: return g(0x8df) && O.FISKNAT.holder === null ? 'hilite' : 'normal';
      case 5: return g(0x8df) && O.FISKNAT.holder === O.MATTIS ? 'hilite' : 'normal';
      case 0x3a: return riverOpen() ? 'S' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (hitBirk(x, y)) return;
    if (r === 1) return usePortal('EXIT_GLUPAFALLET_to_SKOGEN');
    if (r === 2) return usePortal('EXIT_GLUPAFALLET_to_TJAERNEN');
    if (r === 3) return usePortal('EXIT_GLUPAFALLET_to_GROTTANUTE');
    if (r === 0x3a && riverOpen()) {
      // FUN_00466400: walk to the start stone, then the river game (act 3: with the bird witch)
      O.RONJA.walkTo(182, 305, 2894, (interrupted) => {
        if (!interrupted) startMinigame(gv.act !== 3 ? 1 : 7);
      }, -1);
      return;
    }
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),

  useItem(item, r) {
    // FUN_00466f10: cast the net into the rapids (no act check)
    if (r === 5 && item === O.FISKNAT) syncPlay('RONJA_13_159A1_kastaNatA', 'birk_13_159A1_kastaNatA');
  },
};

function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (hitBirk(x, y)) { talkToBirkStaged(BIRK_TABLES.GLUPAFALLET, v); return; }
  if (r === 4) {
    if (v === 1) O.RONJA.walkAndPlay(T(342)); // RONJA_13_158A1_taNat: take the net (the hook gives it to Ronja)
    else dispatch(40, v, null, O.RONJA);      // talaNat #279/#280, tittaNat #278
  } else if (r === 5) {
    if (v !== 1) dispatch(salmonCatchable() ? 41 : 42, v, null, O.RONJA);
    else if (salmonCatchable()) syncPlay('RONJA_13_162A1_taForsA', 'birk_13_162A1_taForsA');
    else syncPlay('RONJA_13_165A1_taForsA', 'birk_13_165A1_taForsA');
  }
}

registerScene('GLUPAFALLET', script);
