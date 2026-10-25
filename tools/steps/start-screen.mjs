export default async ({ wait, shot, page, log, evaluate }) => {
  await wait(1500);
  await shot('start-screen');
  await page.click('.bdb-start .books button');
  await wait(4000);
  log(await evaluate(() => JSON.stringify({ movie: globalThis.__ronja?.ui.movie?.name ?? null })));
  await shot('start-screen-played');
};
