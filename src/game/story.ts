// Story flow shared between scenes, hooks and minigames: the seasons and act changes, the exits of the minigames that belong
// to them and the ending (game-logic.md §1.2, §3.17-3.18, §5.6-5.8; engine.md §1.5).
//
//  * winter: no event, it is the state W (act 2 && g8d5 && g8d6 && g8d7); the ski run (minigames/ski.ts) ends it in `finish()`
//  * snowball fight end (0x432810 + FUN_0041fb10) -> `snowballEnded()` (after the win dialogue #524)
//  * spring (act 3): `startSpring()` of scenes/fangelsehalor.ts (bread to Birk, snowball end)
//  * cave defence (mode 6) start/exit        -> `startCaveDefence()`, `caveDefenceEnded(won)` (FUN_0042a440 / FUN_0042d3f0)
//  * summer (FUN_00468ac0)                   -> `checkSummer()`
//  * the ending (hook of the Mattis line "Egentligen...") -> `startEnding()`: outro.smk, credits, start screen

import { O, enterScene, endMinigame, finishDialog, g, gv, playMovie, setG, setPan, startMinigame, stopMusic, quit } from './api.ts';
import { startSpring } from './scenes/fangelsehalor.ts';

/** Put Ronja (and Birk) somewhere (standStillAtDestination, shown). */
function stand(o: typeof O.RONJA, x: number, y: number, dir: number) {
  o.followGround = true;
  o.hidden = false;
  o.standStill(x, y, 0, dir);
}

// ------------------------------------------------------------------ snowball fight (mode 5)

/** Bread cake is with Birk (g8f4 or BRODKAKA held by Birk, directly or inside an item he holds). */
export const breadWithBirk = (): boolean => !!g(0x8f4) || O.BRODKAKA.holder === O.BIRK || O.BRODKAKA.holder?.holder === O.BIRK;

/**
 * 0x432810 + FUN_0041fb10: the snowball fight was won (after #524): g8de; spring (act 3, spring.smk) if the bread is already with
 * Birk, otherwise back to BORGGARDEN with Ronja at (478, 341) facing SE.
 */
export function snowballEnded(): void {
  setG(0x8de, 1);
  O.SNOBOLL.hide();
  endMinigame();
  if (breadWithBirk()) { startSpring(); return; }
  setPan(0);
  enterScene('BORGGARDEN', { force: true });
  setPan(0);
  stand(O.RONJA, 478, 341, 5);
}

// ------------------------------------------------------------------ cave defence (mode 6)

/** GROTTANUTE, region 1 (cave mouth) after the stone moved and before g8df: Ronja and Birk walk in front of the cave, mode 6 starts. */
export function startCaveDefence(): void {
  startMinigame(6);
  // FUN_00468010: Ronja walks to (344, 368, z 978), Birk to (274, 368); the minigame's own start may already have placed them
  if (!O.RONJA.hidden) O.RONJA.walkTo(344, 368, 978, null, -1);
  if (!O.BIRK.hidden) O.BIRK.walkTo(274, 368, 0, null, -1);
}

/**
 * FUN_0042d3f0: leave the cave defence. Won (g8df): GROTTANUTE, Ronja (337, 353) dir 5, Birk (283, 352) dir 3.
 * Lost: GLAENTAN, Ronja (275, 317) dir 4, Birk (227, 319) dir 5. The caller sets g8df (0x42d323) on a win.
 */
export function caveDefenceEnded(won: boolean): void {
  endMinigame();
  setPan(0);
  if (won) {
    setG(0x8df, 1);
    enterScene('GROTTANUTE', { force: true });
    setPan(0);
    stand(O.RONJA, 337, 353, 5);
    stand(O.BIRK, 283, 352, 3);
  } else {
    enterScene('GLAENTAN', { force: true });
    setPan(0);
    stand(O.RONJA, 275, 317, 4);
    stand(O.BIRK, 227, 319, 5);
  }
}

// ------------------------------------------------------------------ summer

/**
 * FUN_00468ac0: water delivered/filled (g90e) and the salmon eaten (g90b) in act 3 -> summer (g8f7): summer.smk, grottan.smk, then
 * Ronja stands at (120, 400) and Birk at (200, 400) in the cave. (No !g8f7 guard, like the original.)
 */
export function checkSummer(): void {
  if (!(g(0x90e) && g(0x90b) && gv.act === 3)) return;
  setG(0x8f7, 1);
  O.RONJA.hide();
  // the original continues only if the movie was not skipped; skipping must not lock the game, so both end callbacks always continue
  playMovie('summer.smk', 64, 69, () => {
    O.RONJA.hide();
    playMovie('grottan.smk', 0, 0, () => {
      stand(O.RONJA, 120, 400, 5);
      stand(O.BIRK, 200, 400, 3);
    });
  });
}

// ------------------------------------------------------------------ the ending

/**
 * Hook 0x4538b0 (end of the lip-sync track of "Egentligen kan jag inte klaga..." in KAELLAN): stop the music, end the dialogue, hide
 * Ronja, outro.smk, then the credits (eftertext.smk, FUN_004030b0) and back to the start screen.
 */
export function startEnding(): void {
  stopMusic();
  finishDialog(false);
  setPan(0);
  O.RONJA.hide();
  playMovie('outro.smk', 64, 69, () => quit());
}
