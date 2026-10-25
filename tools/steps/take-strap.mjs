// LOVISMATTISRUM: hold the coin on the leather strap, choose HAND, check the item arrives in the inventory
export default async ({ click, down, up, move, wait, shot, evaluate, log }) => {
  await wait(4000);
  await click(600, 440);
  await wait(300);
  await move(200, 345);
  await wait(200);
  await down(200, 345);
  await wait(800);
  await shot('strap-coin');
  await up(200, 300); // up = HAND (ta)
  await wait(6000);
  await shot('strap-taken');
  log(await evaluate(() => JSON.stringify({ rem: globalThis.__ronja.O.REM.holder?.name ?? null, busy: globalThis.__ronja.dialogActive() })));
  await click(320, 240, { button: 'right' });
  await wait(500);
  await shot('strap-inventory');
};
