// Scene 14 TJAERNEN, the forest lake (game-logic.md §3.16): the white moss (tarn cone game, mode 2, built elsewhere),
// Birk in act 2 (stumble, fog talk) and the meeting with Birk in act 3.

import {
  O, T, doDialogAni, dispatch, g, setG, gv, inInv, lastDialog, playMovie, playMusic, registerScene, setPan, startMinigame,
  usePortal, enterScene, type SceneScript,
} from '../api.ts';
import { BIRK_TABLES, birkFollows, birkJoins, hitBirk, talkToBirkStaged } from '../forest.ts';

/** LAB_004675f0: after the talk with Birk at the tarn: the fog (dimman.smk), then SKOGEN in the fog */
function afterBirkTalk() {
  if (![306, 307, 534, 535].includes(lastDialog.event)) return;
  setG(0x8e5, 1);
  enterScene('SKOGEN');
  setPan(0);
  O.RONJA.hide();
  playMovie('dimman.smk', 64, 69, () => { O.RONJA.show(); setG(0x914, 1); });
}

const script: SceneScript = {
  enter() {
    gv.mapBits |= 4;
    setG(0x8e5, 0);
    playMusic('dls_tjarnensyrsor_40_70vol', 70, 33.33);
    if (!inInv(O.VITMOSSA) && O.VITMOSSA.holder !== O.DJUR3) O.VITMOSSA.setTrack(T(328)); // vitmossa__gen_still
    if (gv.act === 2) {
      if (!g(0x8fc)) {
        if (O.BIRK.currDirec < 0) O.BIRK.currDirec = 3; // Birk has never stood anywhere yet: a standStill without facing would never report arrival
        O.BIRK.setTrack(T(715));  // birk_14_178A1_snubblaBirk
        O.DJUR1.setTrack(T(1093)); // DJUR1_14_178A1_SnubblaBirk
        doDialogAni(303, null, O.BIRK, false);
        setG(0x8fc, 1);
      } else if (!g(0x8fe)) O.BIRK.standStill(448, 401, 0, 3);
      else if (!g(0x8d5)) doDialogAni(531, null, null, false); // _14_402A1_ravlyanBirk
      return;
    }
    if (gv.act === 3) {
      if (birkFollows()) birkJoins(470, 400, 3);
      else {
        // meeting Birk: he joins the party
        O.BIRK.standStill(225, 405, 0, 3);
        O.RONJA.standStill(124, 405, 0, 5);
        doDialogAni(313, () => { O.BIRK.holder = O.RONJA; }, O.RONJA, false);
        O.BIRK.holder = O.RONJA;
      }
    }
  },

  cursor(r, x, y) {
    if (hitBirk(x, y) && birkFollows()) return 'hilite';
    switch (r) {
      case 1: return 'V';
      case 2: return 'O';
      case 3: return inInv(O.VITMOSSA) ? 'normal' : 'hilite';
      case 4: return gv.act === 2 && g(0x8fc) && !g(0x8d5) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (hitBirk(x, y)) return;
    if (r === 1) return usePortal('EXIT_TJAERNEN_to_KAELLAN');
    if (r === 2) return usePortal('EXIT_TJAERNEN_to_GLUPAFALLET');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),
};

function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (hitBirk(x, y)) { talkToBirkStaged(BIRK_TABLES.TJAERNEN, v); return; }
  if (r === 3) {
    if (v === 1 && !g(0x8dd)) startMinigame(2); // FUN_004676c0 -> FUN_0042d4e0: the grey dwarves (its end sets g8dd)
    else dispatch(35, v, null, O.RONJA);        // talaVitmossa #263/#264, tittaVitmossa #262, taVitmossa (the hook takes it)
  } else if (r === 4) {
    const grp = gv.act === 2 && g(0x8fc) && !g(0x8fe) && !g(0x8d5) ? 47 : 89;
    dispatch(grp, v, v === 0 ? afterBirkTalk : null, O.RONJA);
  }
}

registerScene('TJAERNEN', script);
