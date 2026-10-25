// Placeholder minigames for modes 1..8: they show the minigame's scene and end on a click, returning to the castle.
// A real implementation registers `registerMinigame({ mode, ... })` (no stub option) in its own file and replaces the stub.

import { O, endMinigame, enterScene, registerMinigame, sceneNameById, gv, setPan, type Minigame } from '../api.ts';

const NAMES: Record<number, string> = {
  1: 'river (Forsen 1)', 2: 'tarn pine cones', 3: 'ski run', 4: 'labyrinth', 5: 'snowball fight', 6: 'cave pine cones', 7: 'river with the bird witch', 8: 'dice game',
};

for (let mode = 1; mode <= 8; mode++) {
  if (mode === 1 || mode === 7 || mode === 3 || mode === 4 || mode === 8) continue; // real implementations: ski.ts, labyrinth.ts, dice.ts, river.ts
  let from: number = gv.scene;
  let pos = { x: 320, y: 380, dir: 4 };
  const mg: Minigame = {
    mode: mode as Minigame['mode'],
    start() {
      from = gv.scene;
      pos = { x: O.RONJA.x, y: O.RONJA.y, dir: O.RONJA.currDirec < 0 ? 4 : O.RONJA.currDirec };
      console.warn(`minigame ${mode} (${NAMES[mode]}) is a placeholder: click to leave`);
    },
    click() {
      endMinigame();
      const name = sceneNameById(from) ?? 'BORGGARDEN';
      enterScene(name, { force: true });
      setPan(Math.floor(pos.x / 640) * 640);
      O.RONJA.followGround = true;
      O.RONJA.standStill(pos.x, pos.y, 0, pos.dir);
    },
  };
  registerMinigame(mg, { stub: true });
}
