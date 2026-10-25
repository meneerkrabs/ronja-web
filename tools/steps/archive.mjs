export default async ({ click, wait, shot, evaluate, log, page }) => {
  for (let i = 0; i < 40; i++) {
    await wait(2000);
    const s = await evaluate(() => JSON.stringify({ ready: !!globalThis.__ronja, movie: globalThis.__ronja?.ui.movie?.name ?? null, bar: document.querySelector('.bdb-loading-label')?.textContent ?? null }));
    log(i, s);
    if (JSON.parse(s).movie) break;
  }
  await click(320, 240);
  await wait(1500);
  await shot('archive-logo');
};
