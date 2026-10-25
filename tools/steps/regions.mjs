// prints the info-map region at a grid of scene points: ?scene=...  node tools/browse.mjs URL tools/steps/regions.mjs
export default async ({ wait, evaluate, log }) => {
  await wait(2500);
  const out = await evaluate(() => {
    const r = globalThis.__ronja; const W = r.world.scene.width; const rows = [];
    for (let y = 20; y < 480; y += 20) { let line = String(y).padStart(3) + ' '; for (let x = 10; x < W; x += 20) { const v = r.regionAt(x, y); line += v ? (v > 35 ? '#' : v.toString(36)) : '.'; } rows.push(line); }
    return rows.join('\n');
  });
  log(out);
};
