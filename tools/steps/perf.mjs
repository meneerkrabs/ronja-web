export default async ({ wait, evaluate, log }) => {
  await wait(4500);
  log(await evaluate(() => { const r = globalThis.__ronja; const t = performance.now(); for (let i = 0; i < 50; i++) r.renderer.renderScene(); const a = (performance.now() - t) / 50; const t2 = performance.now(); for (let i = 0; i < 50; i++) r.renderer.present(r.core.form.surface.px); return JSON.stringify({ renderSceneMs: a.toFixed(2), presentMs: ((performance.now() - t2) / 50).toFixed(2) }); }));
};
