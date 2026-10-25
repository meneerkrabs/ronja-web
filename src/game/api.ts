// The public API for scene scripts, hooks and minigames: `import { ... } from '../api.ts'` (docs/engine-api.md).

export { O, world, Obj, inInv, setPan, regionAt, walkable, dirOfVector, trackStart, registerHook } from './world.ts';
export type { TrackCb, MoveCb, SceneRt } from './world.ts';
export { S, T, HW } from './assets.ts';
export { gv, g, setG, winter, F, useCount, busy, lastDialog, sceneIs } from './state.ts';
export {
  dispatch, doDialogAni, eventById, eventByName, EVENTS, playSound, addChoiceLine, clearChoiceLines, abortDialog, dialogActive,
  choosing, pickEvent, dialogTrack, finishDialog,
} from './dialog.ts';
export type { DoneCb, DialogEvent } from './dialog.ts';
export { usePortal, leavePortal, transition, portal, PORTALS } from './portals.ts';
export { playMusic, stopMusic, fadeMusic, currentMusic } from './music.ts';
export { sample, loadSound, prefetchSounds, masterFade, depthVol } from './audio-game.ts';
export { playMovie } from './movies.ts';
export { openMenu } from './menu.ts';
export { enterScene, startMinigame, endMinigame, quit, newGame, playIntro, setGameStartHook, sceneGfx } from './engine.ts';
export { registerScene, registerMinigame, onNewGame, hook, registeredScenes } from './registry.ts';
export type { SceneScript, Minigame, CursorKind, HookHandlers } from './registry.ts';
export * from './types.ts';
export { ui } from './ui.ts';
export { core } from './core.ts';
export { gameNow } from './clock.ts';
export { renderer } from './render.ts';

import { enterScene } from './engine.ts';
import { O, setPan } from './world.ts';
import { gv } from './state.ts';
import type { SceneName } from './types.ts';

/** Dev helper: jump to a scene and put Ronja at (x, y) (default: the scene's centre-ish walkable spot). */
export function devJump(scene: SceneName, x = 320, y = 380, dir = 4): void {
  enterScene(scene, { force: true });
  setPan(Math.floor(x / 640) * 640);
  const R = O.RONJA;
  R.hidden = false;
  R.followGround = true;
  R.currDirec = dir;
  R.standStill(x, y, 0, dir, true);
  void gv;
}
