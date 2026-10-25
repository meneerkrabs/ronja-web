// LOVISMATTISRUM: coin on Lovis -> MOUTH, voice line, choices, pick one
export default async ({ click, down, up, move, wait, shot, evaluate, log }) => {
  await wait(4000);
  await click(600, 440);
  await wait(300);
  await move(110, 300);
  await wait(200);
  await down(110, 300);
  await wait(800);
  await up(140, 330); // lower right = MOUTH (tala)
  for (let i = 0; i < 10; i++) {
    await wait(1000);
    const s = await evaluate(() => JSON.stringify({ active: globalThis.__ronja.dialogActive(), choosing: globalThis.__ronja.choosing(), ev: globalThis.__ronja.lastDialog.event }));
    log(i, s);
    if (JSON.parse(s).choosing) break;
  }
  await shot('lovis-choices');
  await click(100, 465); // bottom choice line
  await wait(5000);
  await shot('lovis-after-choice');
  log(await evaluate(() => JSON.stringify({ active: globalThis.__ronja.dialogActive(), choosing: globalThis.__ronja.choosing() })));
};
