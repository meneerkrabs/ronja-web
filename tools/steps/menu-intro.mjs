export default async ({ click, wait, shot, evaluate, log, page }) => {
  await wait(1500);
  await click(320, 240);
  await wait(2500);
  await page.click('.bdb-skip');
  await wait(1500);
  await shot('menu-1');
  await click(320, 330); // Nieuw spel
  await wait(500);
  await shot('menu-2');
  await click(260, 270); // JA
  await wait(2500);
  log(await evaluate(() => JSON.stringify({ movie: globalThis.__ronja?.ui.movie?.name, scene: globalThis.__ronja?.world.scene?.name })));
  await shot('intro-1');
  await page.click('.bdb-skip');
  await wait(3000);
  await shot('start-1');
  await wait(6000);
  await shot('start-2');
};
