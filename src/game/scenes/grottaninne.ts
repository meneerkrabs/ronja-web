// Scene 16 GROTTANINNE, inside the bear cave (game-logic.md §3.18): the campfire (tinder, flint and steel, roasting and eating the
// salmon) and the delivery of the water vessel. Eating the salmon / delivering the water ends in the summer (story.ts).

import {
  O, T, core, doDialogAni, g, setG, inInv, playMusic, registerScene, trackStart, usePortal, type DoneCb, type SceneScript,
} from '../api.ts';
import { BIRK_GROUPS, birkHit, birkStaged, syncDialog } from '../birk-talk.ts';
import { checkSummer } from '../story.ts';

/** Region 2 (campfire) cursor: the salmon is roasting and not yet eaten. */
const salmonReady = () => !!(g(0x908) && !g(0x90b));

/** LAB_00468b20: the salmon is eaten. */
const salmonEaten: DoneCb = (cancelled) => {
  if (cancelled) return;
  O.LAX.holder = O.MATTIS;
  setG(0x90b, 1);
};

const script: SceneScript = {
  enter() {
    const B = O.BIRK;
    B.hidden = false;
    B.walkTo(419, 459, 0, null, 3);
    if (!g(0x90a)) O.ELD1.loop(T(752));
    else {
      O.ELD1.loop(g(0x908) && !g(0x90b) ? T(751) : T(750));
      playMusic('dls_eld_40_', 127, 33.33);
    }
    if (inInv(O.VATTENKARL) && g(0x90e)) {
      // the filled vessel is delivered (#707 "lamnaVatten"), then the summer check
      O.RONJA.setTrack(T(1077));
      doDialogAni(707, (cancelled) => { if (!cancelled) checkSummer(); }, O.RONJA, false);
      O.VATTENKARL.holder = O.MATTIS;
      setG(0x8fa, 1);
    }
  },

  cursor(r, x, y) {
    if (birkHit(x, y)) return 'hilite';
    if (r === 1) return 'NO';
    if (r === 2) return salmonReady() ? 'hilite' : 'normal';
    return 'normal';
  },

  walk(r, x, y) {
    if (!birkHit(x, y) && r === 1) return usePortal('EXIT_GROTTANINNE_to_GROTTANUTE');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),

  useItem(item, r, x, y) {
    if (birkHit(x, y) || r !== 2) return;
    const R = O.RONJA;
    if (!g(0x90a)) {
      if (!g(0x909)) {
        if (item === O.FNOSKE) { doDialogAni(437, (cancelled) => { if (!cancelled) setG(0x909, 1); }, R, false); return; } // LAB_00469310
      } else if (item === O.ELDSTAL && O.FLINTA.holder === O.ELDSTAL) { doDialogAni(438, null, R, false); return; }
    } else if (item === O.LAX) {
      // Ronja walks to the start of her eating track, Birk roasts the salmon (hook of birk_16_284A1_stekaLax -> g908)
      const tr = core.assets.track(T(1273));
      if (tr) { const s = trackStart(tr); R.walkTo(s.x, s.y, s.z, null, 7); }
      doDialogAni(440, null, O.BIRK, false);
      return;
    }
    doDialogAni(715, null, R, false); // "Nej, det gar inte..."
  },
};

/** MOUTH / HAND / EYE: Birk's staged lines, or the campfire (eat the salmon). */
function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  if (birkHit(x, y)) return birkStaged(BIRK_GROUPS.GROTTANINNE, v);
  if (r !== 2) return;
  // The original starts #442 on any click at the fire (UNCERTAIN whether the region is masked); we require the roasting salmon.
  if (!salmonReady()) return;
  syncDialog(442, T(1273), T(1272), salmonEaten);
}

registerScene('GROTTANINNE', script);
