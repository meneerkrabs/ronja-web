// Scene 2A BORGGARDEN, the castle yard (game-logic.md §3.5). Also the place where the game starts: logo.smk,
// the main menu, intro.smk and Mattis' warning ("Formaning"). This file is the reference for how a scene script is built.

import {
  O, T, doDialogAni, dispatch, g, setG, gv, leavePortal, openMenu, playIntro, playMovie, playMusic, registerScene, setGameStartHook,
  setPan, usePortal, winter, type SceneScript,
} from '../api.ts';

/** Horse phase H: act 2, winter, Lovis helped, carrots not yet given, snowball fight not won. */
const horses = () => gv.act === 2 && winter() && !!g(0x8d8) && !g(0x8d9) && !g(0x8de);

/** Idle loops of the yard people (LAB_004613e0 / LAB_00461360). */
const parentsIdle = () => { O.MATTIS.loop(T(947)); O.LOVIS.loop(T(948)); };
const lillGroom = () => { O.LILLKLIPPEN.loop(T(577)); O.DJUR2.hide(); O.FJOSOK.hide(); };

/** The ladder climbs (LAB_00461ba0): Ronja plays the climb track in place, hook TASTEGEB sets g8dc. */
const climb = () => leavePortal('EXIT_BORGGARDEN_to_HELVETESGAPET');

/** Game start after intro.smk (callback 0x45ba30). */
function gameStart() {
  O.STEGE.setTrack(winter() || !g(0x8dc) ? T(1118) : T(1119));
  O.HINDER.loop(T(677));
  setPan(640);
  O.RONJA.setTrack(T(710));
  doDialogAni(0, () => O.MATTIS.loop(T(947)), null);
  O.LOVIS.loop(T(948));
  setG(0x912, 1);
  playMusic('dls_borggarden__', 127);
}

setGameStartHook(gameStart);

const script: SceneScript = {
  enter() {
    if (!g(0x911)) {
      // first launch: logo, then the main menu (callback 0x45bb60)
      setPan(640);
      playMovie('logo.smk', 0, 0, () => { setG(0x911, 1); openMenu(); });
      return;
    }
    if (!g(0x912)) { playIntro(); return; }
    if (winter()) {
      playMusic('dls_borggardenvinter__', 127);
      if (g(0x8d8) && !g(0x8de)) { if (!g(0x8d9)) O.LILLKLIPPEN.loop(T(577)); else O.DJUR2.loop(T(594)); }
      return;
    }
    O.HINDER.loop(T(677));
    O.STEGE.setTrack(g(0x8dc) ? T(1119) : T(1118));
    if (!g(0x8d4)) parentsIdle();
    playMusic('dls_borggarden__', 127);
  },

  remap(r) {
    if (r === 9) return horses() ? 4 : 1;
    if (r === 12) return g(0x8d4) ? 3 : 10;
    return r;
  },

  cursor(r) {
    switch (r) {
      case 1: return 'V';
      case 2: return 'N';
      case 3: return 'NO';
      case 4: case 7: case 8: return horses() ? 'hilite' : 'normal';
      case 5: return !winter() && !g(0x8dc) ? 'hilite' : 'normal';
      case 6: return !winter() && g(0x8dc) ? 'N' : 'normal';
      case 10: case 11: return !g(0x8d4) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    switch (r) {
      case 1: return usePortal('EXIT_BORGGARDEN_to_BORGPORTEN');
      case 2: return usePortal('EXIT_BORGGARDEN_to_KOKET');
      case 3: return usePortal('EXIT_BORGGARDEN_to_STORASALEN');
      case 6:
        if (!winter() && g(0x8dc)) usePortal('EXIT_BORGGARDEN_to_HELVETESGAPET');
        return; // otherwise nothing, not even walking
      default: O.RONJA.walkTo(x, y, 0, null, -1);
    }
  },

  mouth: (r) => verb(r, 0),
  hand: (r) => verb(r, 1),
  eye: (r) => verb(r, 2),

  useItem(item, r) {
    if (r === 4 && horses()) {
      if (item === O.MOROTTER) { doDialogAni(196, null, O.RONJA, false); setG(0x8d9, 1); return; }
      doDialogAni(197, lillGroom, O.RONJA, false);
    }
  },
};

/** Verb handler shared by MOUTH (0), HAND (1), EYE (2): region -> hotspot group + done callback. */
function verb(r: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  switch (r) {
    case 4: return dispatch(25, v, lillGroom, R);
    case 5:
      if (v === 1) { if (winter() || !g(0x8dc)) dispatch(22, 1, climb, R); return; }
      return dispatch(22, v, null, R);
    case 7: return dispatch(23, v, lillGroom, R);
    case 8: return dispatch(24, v, lillGroom, R);
    case 10: return dispatch(2, v, parentsIdle, R);
    case 11: return dispatch(1, v, parentsIdle, R);
  }
}

registerScene('BORGGARDEN', script);
