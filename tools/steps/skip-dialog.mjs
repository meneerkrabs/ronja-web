// LOVISMATTISRUM first visit: the intro dialogue plays; "Sla gesprek over" fast-forwards it and still fires the hooks
export default async ({ click, wait, shot, evaluate, log, page }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ dialog: r.dialogActive(), g8e6: r.g(0x8e6), lovis: r.O.LOVIS.playing?.name ?? null, mattisHidden: r.O.MATTIS.hidden }); });
  await wait(4500);
  log('before', await st());
  await shot('skip-before');
  await page.click('.bdb-skip');
  for (let i = 0; i < 6; i++) { await wait(700); log('after', i, await st()); }
  await shot('skip-after');
};
