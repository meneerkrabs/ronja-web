// logo -> menu -> Nieuw spel -> intro (skipped) -> Mattis' warning plays (voice + lip sync) -> free play
export default async ({ click, wait, shot, evaluate, log, page }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ movie: r.ui.movie?.name ?? null, scene: r.world.scene?.name, dialog: r.dialogActive(), g912: r.g(0x912), ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)], mattis: r.O.MATTIS.playing?.name ?? null }); });
  await wait(2000);
  await click(320, 240);
  await wait(1500);
  log('logo', await st());
  await page.click('.bdb-skip');
  await wait(1000);
  await click(320, 330); await wait(300); await click(260, 270); // Nieuw spel -> JA
  await wait(1500);
  log('intro', await st());
  await page.click('.bdb-skip');
  for (let i = 0; i < 8; i++) { await wait(1000); log('t+' + (i + 1), await st()); }
  await shot('formaning');
};
