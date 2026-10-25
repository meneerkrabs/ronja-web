export default async ({ click, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ pan: r.world.scene.pan, ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], dir: r.O.RONJA.currDirec }); });
  await wait(4500);
  await click(600, 400);
  for (let k = 0; k < 8; k++) {
    await click(630, 380);
    await wait(2500);
    log(k, await st());
  }
  await shot('camera');
};
