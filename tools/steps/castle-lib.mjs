// helpers for the castle tests: verb coin by direction, state dump, wait for dialog
export const mk = (ctx) => {
  const { click, down, up, move, wait, evaluate, log, shot } = ctx;
  const R = () => evaluate(() => globalThis.__ronja);
  const st = async (extra = '') => log(await evaluate((e) => { const r = globalThis.__ronja; return JSON.stringify({ scene: r.world.scene.name, act: r.gv.act, mode: r.gv.mode, dlg: r.dialogActive(), choosing: r.choosing(), ev: r.lastDialog.event, alt: r.lastDialog.alt, rx: Math.round(r.O.RONJA.x), ry: Math.round(r.O.RONJA.y), pan: r.world.scene.pan, inv: Object.entries(r.O).filter(([k, o]) => o.holder === r.O.RONJA && k !== 'RONJA').map(([k]) => k).join(','), e }); }, extra));
  const idle = async (max = 30) => { for (let i = 0; i < max; i++) { await wait(700); const s = await evaluate(() => { const r = globalThis.__ronja; return r.dialogActive() || r.O.RONJA.walking || !!r.world.__busy; }); if (!s && i > 1) break; } };
  // verb: 'hand' | 'mouth' | 'eye'
  const pan = () => evaluate(() => globalThis.__ronja.world.scene.pan);
  // x,y in SCENE coordinates; the 640x480 logical screen = scene - pan
  const verb = async (sx, y, v) => {
    const x = sx - (await pan());
    await move(x, y); await wait(250); await down(x, y); await wait(800);
    const d = v === 'hand' ? [0, -35] : v === 'mouth' ? [30, 30] : [-30, 30];
    await up(x + d[0], y + d[1]);
  };
  const at = async (sx, y, opt) => click(sx - (await pan()), y, opt);
  return { st, idle, verb, R, at, pan };
};
