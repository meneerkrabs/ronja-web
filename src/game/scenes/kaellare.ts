// Scene 6 KAELLARE, the cellar (game-logic.md §3.9): dark until the torch is lit (g90d), then cheese, carrots, the shelf
// passage (labyrinth, mode 4) to the prison caves and the bread cake from Skalle-Per. Hooks: hooks/castle-cellar.ts.

import {
  O, T, doDialogAni, dispatch, g, setG, inInv, lastDialog, registerScene, sceneGfx, startMinigame, usePortal,
  type SceneScript,
} from '../api.ts';

/** BRODKAKA lies in Birk's cell: held by BIRK directly or nested inside something Birk holds. */
export const breadWithBirk = () => O.BRODKAKA.holder === O.BIRK || O.BRODKAKA.holder?.holder === O.BIRK;

/** LAB_00462460 (taHylla done) = FUN_00421240: start the labyrinth (mode 4, first room S01A). */
function enterLabyrinth(cancelled?: boolean) {
  if (cancelled) return;
  startMinigame(4, undefined, 'LABYRINT', sceneGfx('LABYRINT', 'S01A') ?? undefined);
}

/** LAB_0045c040: after the meeting with Skalle-Per: "SpelaTarning" puts the bread cake on the shelf and starts the dice game. */
function skalleMeetingDone() {
  setG(0x8f2, 0);
  setG(0x8f0, 0);
  if (lastDialog.event === 232 || lastDialog.event === 238) { setG(0x8f0, 1); startMinigame(8); }
}

const script: SceneScript = {
  enter() {
    const R = O.RONJA;
    if (!g(0x8ed)) {
      if (g(0x90d)) { R.standStill(209, 412, 0, 5); doDialogAni(165, null, R, false); }
      return;
    }
    if (O.OST.holder === null) O.OST.loop(T(311));
    if (O.MOROTTER.holder === null) O.MOROTTER.loop(T(312));
    if (g(0x8f0) && !inInv(O.BRODKAKA) && !g(0x8f4)) O.BRODKAKA.loop(T(313));
    O.ELD1.loop(T(1202));
    if (breadWithBirk()) setG(0x8f4, 1);
    if (!g(0x8f4)) {
      if (g(0x8f1) && R.x > 640 && g(0x8f2) && g(0x8f5) && !g(0x8f0) && !inInv(O.BRODKAKA)) {
        // deferred: the portal transition places Ronja and starts her stand track right after this enter script
        const first = !g(0x8ef);
        setG(0x8ef, 1);
        queueMicrotask(() => {
          R.followGround = true;
          R.standStill(830, 415, 0, 5);
          doDialogAni(first ? 228 : 234, skalleMeetingDone, R, true);
        });
      } else setG(0x8f2, 0);
    }
  },

  cursor(r) {
    switch (r) {
      case 1: return 'N';
      case 2: return g(0x8db) ? 'N' : 'hilite';
      case 3: return O.OST.holder === null ? 'hilite' : 'normal';
      case 4: return O.MOROTTER.holder === null ? 'hilite' : 'normal';
      case 6: return g(0x8f0) && !inInv(O.BRODKAKA) && !g(0x8f4) ? 'hilite' : 'normal';
      case 7: return 'O';
      case 8: return !g(0x8ed) ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    switch (r) {
      case 1: return usePortal('EXIT_KAELLARE_to_KOKET');
      case 2:
        if (g(0x8f1)) return usePortal('EXIT_KAELLARE_to_FANGELSEHALOR');
        if (g(0x8db)) dispatch(31, 1, enterLabyrinth, O.RONJA);
        return;
      case 7:
        if (!g(0x8ed)) doDialogAni(571, null, O.RONJA, false); // "too dark"
        return;
      case 8: return;
      default: O.RONJA.walkTo(x, y, 0, null, -1);
    }
  },

  mouth(r) {
    const R = O.RONJA;
    switch (r) {
      case 2: O.BIRK.setPosition(3000, 9000, 1000); return dispatch(31, 0, null, R); // Birk is heard behind the shelf
      case 3: return dispatch(28, 0, null, R);
      case 4: return dispatch(29, 0, null, R);
      case 6: return dispatch(32, 0, null, R);
    }
  },
  hand(r) {
    const R = O.RONJA;
    switch (r) {
      case 2:
        if (!g(0x8db)) { setG(0x8db, 1); dispatch(31, 1, enterLabyrinth, R); }
        return;
      case 3: return dispatch(28, 1, null, R);
      case 4: return dispatch(29, 1, null, R);
      case 6: return dispatch(32, 1, null, R);
    }
  },
  eye(r) {
    const R = O.RONJA;
    switch (r) {
      case 2: return dispatch(31, 2, null, R);
      case 3: return dispatch(28, 2, null, R);
      case 4: return dispatch(29, 2, null, R);
      case 6: return dispatch(32, 2, null, R);
    }
  },
};

registerScene('KAELLARE', script);
