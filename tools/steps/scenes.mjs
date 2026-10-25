// screenshots of several scenes: node tools/browse.mjs "http://localhost:5299/?mute=1&scene=STORASALEN&x=600&y=380" tools/steps/scenes.mjs
export default async ({ click, wait, shot, evaluate, log }) => {
  await wait(2500);
  await click(600, 40);
  await wait(1500);
  await shot('scene-' + (await evaluate(() => globalThis.__ronja.world.scene.name)));
  log(await evaluate(() => JSON.stringify({ ronja: [globalThis.__ronja.O.RONJA.x, globalThis.__ronja.O.RONJA.y, globalThis.__ronja.O.RONJA.z, globalThis.__ronja.O.RONJA.scale], pan: globalThis.__ronja.world.scene.pan })));
};
