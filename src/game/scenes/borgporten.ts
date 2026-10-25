// Scene 8 BORGPORTEN, the castle gate (game-logic.md §3.11).

import { O, doDialogAni, setG, gv, registerScene, registeredScenes, usePortal, winter, type SceneScript } from '../api.ts';

const script: SceneScript = {
  enter() {
    setG(0x8d4, 1);
    setG(0x8e5, 0);
    if (winter()) {
      O.RONJA.standStill(28, 265, 0, 5);
      doDialogAni(523, () => usePortal('EXIT_BORGPORTEN_to_BORGGARDEN'), null, false);
    }
  },
  cursor(r) { return r === 1 ? 'NV' : r === 2 ? 'NO' : 'normal'; },
  walk(r, x, y) {
    if (r === 1) {
      if (gv.act === 3) doDialogAni(579, null, null, false); // "Jag tänker aldrig…": no way home in act 3
      else usePortal('EXIT_BORGPORTEN_to_BORGGARDEN');
      return;
    }
    // the forest scenes are ported separately; the exit works as soon as SKOGEN has a script
    if (r === 2 && registeredScenes().includes('SKOGEN')) return usePortal('EXIT_BORGPORTEN_to_SKOGEN');
    if (r !== 2) O.RONJA.walkTo(x, y, 0, null, -1);
  },
};

registerScene('BORGPORTEN', script);
