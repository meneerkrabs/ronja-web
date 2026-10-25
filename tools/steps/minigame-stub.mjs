export default async ({ click, key, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ mode: r.gv.mode, scene: r.world.scene.name, ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], hidden: r.O.RONJA.hidden }); });
  await wait(4500);
  await click(620, 460);
  await evaluate(() => globalThis.__ronja.startMinigame(8));
  await wait(500);
  log('in minigame', await st());
  await key('Escape'); // the menu must stay shut
  await click(320, 240, { button: 'right' }); // and so must the inventory
  await wait(300);
  log('ui', await evaluate(() => JSON.stringify({ menu: globalThis.__ronja.ui.menuOpen, inv: globalThis.__ronja.ui.invOpen })));
  await shot('minigame-stub');
  await click(320, 240);
  await wait(500);
  log('back', await st());
};
