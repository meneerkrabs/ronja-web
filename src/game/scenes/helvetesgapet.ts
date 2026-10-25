// Scene 3 HELVETESGAPET, Hell's Gap (game-logic.md §3.7): Birk hangs over the chasm; the rescue with the leather strap.

import { O, T, doDialogAni, dispatch, g, setG, gv, inInv, regionAt, registerScene, usePortal, type SceneScript } from '../api.ts';

/** act 1, both forest trials done, strap in the bag */
const rescueOpen = () => gv.act === 1 && !!g(0x8dd) && !!g(0x8e1) && inInv(O.REM) && !g(0x8ec);

const script: SceneScript = {
  enter() {
    setG(0x8d4, 1);
    if (!rescueOpen()) return;
    if (g(0x8ea)) { O.BIRK.setTrack(T(1140)); return; } // Birk hangs over the chasm
    O.RONJA.setPosition(10, 270, 0);
    O.BIRK.setTrack(T(809));
    doDialogAni(201, () => O.RONJA.standStill(O.RONJA.x, O.RONJA.y, 0, 5), O.RONJA, false);
    setG(0x8ea, 1);
  },
  cursor(r) {
    if (r === 1) return gv.act === 1 && g(0x8ea) ? 'normal' : 'V';
    if (r === 2) return rescueOpen() ? 'hilite' : 'normal';
    return 'normal';
  },
  walk(r, x, y) {
    if (r === 1) { if (!(gv.act === 1 && g(0x8ea))) usePortal('EXIT_HELVETESGAPET_to_BORGGARDEN'); return; }
    if (r === 2 && !g(0x8eb)) { setG(0x8eb, 1); doDialogAni(202, null, null, false); }
    O.RONJA.walkTo(x, y, 0, null, -1);
  },
  mouth: (r) => { if (r === 2) dispatch(26, 0, null, O.RONJA); },
  hand: (r) => { if (r === 2) dispatch(26, 1, null, O.RONJA); },
  eye: (r) => { if (r === 2) dispatch(26, 2, null, O.RONJA); },
  useItem(item, r) {
    if (r === 2 && rescueOpen() && item === O.REM) {
      doDialogAni(regionAt(O.RONJA.x, O.RONJA.y) === 3 ? 207 : 206, null, O.RONJA, false);
    }
  },
};

registerScene('HELVETESGAPET', script);
