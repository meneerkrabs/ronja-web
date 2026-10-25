// node tools/browse.mjs "http://localhost:5299/?mute=1&play=1" tools/steps/boot.mjs --size 1280x960
export default async ({ click, wait, shot, evaluate, log }) => {
  await wait(1500);
  await click(320, 240); // one gesture for the AudioContext
  await wait(4000);
  await shot('boot-1');
  log(await evaluate(() => JSON.stringify({ movie: globalThis.__ronja?.ui.movie?.name, scene: globalThis.__ronja?.world.scene?.name })));
};
