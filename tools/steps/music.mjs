export default async ({ click, wait, evaluate, log }) => {
  await wait(4000);
  await click(600, 440);
  await wait(6000);
  log(await evaluate(() => JSON.stringify({ music: globalThis.__ronja.currentMusic(), ctx: globalThis.__ronja.core.display ? 'ok' : '' })));
};
