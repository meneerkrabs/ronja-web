// SKALLEPERSRUM: take the key from the bag and use it on the chest (region 1) -> dialogue #40 and the chest opens
export default async ({ click, move, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ held: r.ui.held, inv: r.ui.invOpen, dialog: r.dialogActive(), g90f: r.g(0x90f), key: r.O.NYCKEL.holder?.name ?? null, scene: r.world.scene.name }); });
  await wait(4500);
  await click(620, 460);
  await click(320, 240, { button: 'right' });
  await wait(300);
  await click(180, 100); // pick up the key
  await wait(300);
  log('held', await st());
  await move(5, 240); // the inventory closes at the screen edge
  await wait(200);
  await move(320, 300);
  await wait(300);
  await shot('item-held');
  log('closed', await st());
  await click(540, 340); // the chest
  for (let i = 0; i < 8; i++) { await wait(1500); const v = await st(); log('t' + i, v); if (JSON.parse(v).g90f) break; }
  await shot('chest-opened');
};
