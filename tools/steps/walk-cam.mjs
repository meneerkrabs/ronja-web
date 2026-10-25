// BORGGARDEN: walk right across the panorama; the camera jumps by half screens near the edges
export default async ({ click, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ pan: r.world.scene.pan, ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], dir: r.O.RONJA.currDirec, walking: r.O.RONJA.walking }); });
  await wait(4500);
  await click(620, 300); // one gesture
  log('start', await st());
  await click(600, 400);
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) { await wait(1500); log((Date.now() - t0) + 'ms', await st()); }
  await shot('walk-cam-1');
};
