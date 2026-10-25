// the end of act 1: the rescue dialogue #207 ends in helvetesgapet.smk and the great hall of act 2
export default async ({ click, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ act: r.gv.act, scene: r.world.scene.name, movie: r.ui.movie?.name ?? null, dialog: r.dialogActive(), ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], hidden: r.O.RONJA.hidden, g913: r.g(0x913) }); });
  await wait(5000);
  await click(620, 460);
  await evaluate(() => globalThis.__ronja.doDialogAni(207, null, globalThis.__ronja.O.RONJA, false));
  for (let i = 0; i < 12; i++) { await wait(2000); const s = await st(); log(i, s); if (JSON.parse(s).movie) break; }
  await shot('act2-movie');
  await evaluate(() => globalThis.__ronja.ui.movie.playback.stop());
  await wait(1500);
  log('after', await st());
  await shot('act2-hall');
};
