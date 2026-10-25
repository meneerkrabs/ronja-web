// Scene 1C STORASALEN, the great hall (game-logic.md §3.3).

import {
  O, T, doDialogAni, dispatch, g, setG, gv, inInv, lastDialog, playMusic, registerScene, startMinigame, stopMusic, usePortal, winter,
  type SceneScript,
} from '../api.ts';

const act1Music = () => { O.LABAS.loop(T(6)); O.LILLKLIPPEN.loop(T(0)); playMusic('dls_salen_112_', 127, 93.33); };
const hallFire = () => playMusic('dls_eld_40_', 127, 33.33);

/** Robbers' "stop playing" animation + silence while they are spoken to (act 1), then restart (LAB_0045fb70). */
function robberTalk(v: 0 | 1 | 2, group: number) {
  if (v === 0) { O.LABAS.setTrack(T(269)); O.LILLKLIPPEN.setTrack(T(367)); stopMusic(); }
  dispatch(group, v, v === 0 ? act1Music : null, O.RONJA);
}

/** LAB_0045fc70: after talking to Mattis / Skalle-Per. */
function mattisSkalleDone() {
  if (lastDialog.event === 93) { startMinigame(8); return; } // "Gärna spela": the dice game
  if (winter()) { startMinigame(3); return; } // the ski run (winter.smk)
  if (lastDialog.event !== 94) O.MATTIS.loop(T(20));
}

const script: SceneScript = {
  enter() {
    setG(0x8d4, 1);
    O.ELD2.loop(T(1282)); O.ELD3.loop(T(1283)); O.ELD4.loop(T(1284));
    // ASKEN, TARNING, VILDVITTRA and GRADVARG are reused as extra wall torches
    O.ASKEN.loop(T(1295)); O.TARNING.loop(T(1296)); O.VILDVITTRA.loop(T(1297)); O.GRADVARG.loop(T(1298));
    if (!inInv(O.FNOSKE)) O.FNOSKE.setTrack(T(335));
    O.ELD1.loop(T(976));
    if (gv.act === 1) act1Music();
    else if (gv.act === 2) {
      if (g(0x913)) hallFire();
      if (!winter()) O.MATTIS.loop(T(20));
      else if (g(0x8d8) && !g(0x8da) && !g(0x8de)) { O.LABAS.loop(T(10)); O.STURKAS.loop(T(11)); O.TJEGGE.loop(T(12)); O.DJUR1.loop(T(1103)); }
      if (winter() && g(0x8e7)) O.MATTIS.loop(T(919));
    } else {
      if (g(0x915)) hallFire();
      O.SKALLEPER.loop(T(935));
    }
  },

  remap(r) {
    if (r === 11) return gv.act === 1 ? 7 : 9;
    if (r === 15) return winter() && g(0x8e7) ? 14 : 12;
    return r;
  },

  cursor(r) {
    const act = gv.act, W = winter();
    switch (r) {
      case 1: return !inInv(O.FNOSKE) ? 'hilite' : 'normal';
      case 2: return 'V';
      case 3: return 'N';
      case 5: return 'NO';
      case 6: case 7: return act === 1 ? 'hilite' : 'normal';
      case 8: case 9: case 10: return act === 2 && W && g(0x8d8) && !g(0x8da) && !g(0x8de) ? 'hilite' : 'normal';
      case 12: return act !== 2 ? 'normal' : !(g(0x8d5) && g(0x8d6) && g(0x8d7)) ? 'hilite' : 'normal';
      case 13: return (act === 2 && !g(0x8d7)) || act === 3 ? 'hilite' : 'normal';
      case 14: return W && g(0x8e7) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    switch (r) {
      case 2: return usePortal('EXIT_STORASALEN_to_LOVISMATTISRUM');
      case 3: return usePortal('EXIT_STORASALEN_to_BORGGARDEN');
      case 5: return usePortal('EXIT_STORASALEN_to_KOKET');
      default: O.RONJA.walkTo(x, y, 0, null, -1);
    }
  },

  mouth: (r) => verb(r, 0),
  hand: (r) => verb(r, 1),
  eye: (r) => verb(r, 2),

  useItem(item, r) {
    if (r === 4 && item === O.FACKLA && winter() && g(0x8e7) && !g(0x90d)) { doDialogAni(572, null, O.RONJA, false); return; }
    if ((r === 4 || r === 8 || r === 9 || r === 10) && item === O.RATTA) doDialogAni(131, null, O.RONJA, false);
  },
};

function verb(r: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  switch (r) {
    case 1: return dispatch(14, v, null, R);
    case 6: return robberTalk(v, 8);
    case 7: return robberTalk(v, 7);
    case 8: return dispatch(13, v, v !== 1 ? () => O.LABAS.loop(T(10)) : null, R);
    case 9: return dispatch(11, v, v !== 1 ? () => O.STURKAS.loop(T(11)) : null, R);
    case 10: return dispatch(12, v, v !== 1 ? () => O.TJEGGE.loop(T(12)) : null, R);
    case 12: return dispatch(9, v, mattisSkalleDone, R);
    case 13:
      if (gv.act !== 3) return dispatch(10, v, mattisSkalleDone, R);
      return dispatch(48, v, () => {
        if (O.SKALLEPER.playing && O.SKALLEPER.playing.name.toLowerCase() === T(946).toLowerCase()) O.RONJA.standStill(596, 412, 0, 1);
        O.SKALLEPER.loop(T(935));
      }, R);
    case 14: return dispatch(98, v, () => { if (winter() && g(0x8e7)) O.MATTIS.loop(T(919)); }, R);
  }
}

registerScene('STORASALEN', script);
