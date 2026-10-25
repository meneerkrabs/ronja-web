// BORGGARDEN: HAND on the ladder -> dialogue #172, the climb (opaque stream-flag-2 frames), arrival in Hell's Gap
export default async ({ click, down, up, move, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ scene: r.world.scene.name, dialog: r.dialogActive(), ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], track: r.O.RONJA.playing?.name ?? null, g8dc: r.g(0x8dc) }); });
  await wait(4500);
  await click(620, 460);
  await move(370, 310);
  await wait(200);
  await down(370, 310);
  await wait(800);
  await up(370, 270);
  for (let i = 0; i < 14; i++) { await wait(1000); log(i, await st()); if (i === 3) await shot('ladder-1'); if (i === 6) await shot('ladder-2'); }
  await shot('ladder-end');
};
