// walk through a portal, save in slot 0 via the ESC menu, move on, load it again
export default async ({ click, key, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ scene: r.world.scene.name, pan: r.world.scene.pan, ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], rem: r.O.REM.holder?.name ?? null, busy: r.busy.bits }); });
  await wait(4000);
  await click(600, 440);
  await wait(300);
  await click(570, 200); // exit NE -> STORASALEN
  await wait(7000);
  log('after portal', await st());
  await shot('portal-storasalen');
  await key('Escape');
  await wait(600);
  await shot('menu-ingame');
  await click(320, 264); // Bewaar spel
  await wait(400);
  await shot('menu-save-page');
  await click(181, 117); // slot 0
  await wait(600);
  log('saved', await evaluate(() => localStorage.getItem('ronja-save-0')?.length));
  await click(400, 330); // walk somewhere else
  await wait(2500);
  log('moved', await st());
  await key('Escape');
  await wait(400);
  await click(320, 190); // Laad spel
  await wait(400);
  await shot('menu-load-page');
  await click(181, 117); // slot 0
  await wait(400);
  await shot('menu-load-confirm');
  await click(260, 270); // JA
  await wait(2000);
  log('loaded', await st());
  await shot('after-load');
};
