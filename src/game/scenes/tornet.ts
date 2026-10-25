// Scene 4 TORNET, the tower (game-logic.md §3.8): the drawer with the key.

import { O, T, doDialogAni, dispatch, g, setG, inInv, registerScene, usePortal, type SceneScript } from '../api.ts';

const script: SceneScript = {
  enter() {
    O.ELD1.loop(T(1288)); O.ELD2.loop(T(1289));
    if (g(0x910)) O.ASKEN.setTrack(inInv(O.NYCKEL) || g(0x90f) ? T(1261) : T(1300));
  },
  cursor(r) {
    if (r === 1) return 'S';
    if (r === 4) return !inInv(O.NYCKEL) && !g(0x90f) ? 'hilite' : 'normal';
    return 'normal';
  },
  walk(r, x, y) {
    if (r === 1) return usePortal('EXIT_TORNET_to_SKALLEPERSRUM');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },
  mouth: (r) => verb(r, 0),
  hand: (r) => verb(r, 1),
  eye: (r) => verb(r, 2),
};

function verb(r: number, v: 0 | 1 | 2) {
  if (r !== 4) return;
  if (!g(0x910)) { doDialogAni(592, () => { O.ASKEN.setTrack(T(1300)); setG(0x910, 1); }, O.RONJA, false); return; }
  dispatch(27, v, v === 1 ? () => { O.NYCKEL.holder = O.RONJA; O.ASKEN.setTrack(T(1261)); } : null, O.RONJA);
}

registerScene('TORNET', script);
