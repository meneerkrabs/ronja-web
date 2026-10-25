// inventory -> verb coin on the map item (EYE) -> map -> travel to Borgporten
export default async ({ click, down, up, move, wait, shot, evaluate, log }) => {
  const st = () => evaluate(() => { const r = globalThis.__ronja; return JSON.stringify({ scene: r.world.scene.name, map: r.ui.mapOpen, inv: r.ui.invOpen, ronja: [Math.round(r.O.RONJA.x), Math.round(r.O.RONJA.y)] }); });
  await wait(4500);
  await click(600, 440);
  await click(320, 240, { button: 'right' });
  await wait(400);
  await move(180, 100);
  await wait(200);
  await down(180, 100);
  await wait(800);
  await shot('map-coin');
  await up(150, 125);
  await wait(500);
  log('map', await st());
  await shot('map-open');
  await click(180, 130); // BORGPORTEN "Mattisburcht"
  await wait(1500);
  log('travelled', await st());
  await shot('map-travelled');
};
