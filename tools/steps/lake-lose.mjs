// Lake (mode 2) lose path (game-logic §5.5): when 4 grey dwarves stand at the rock at once, Ronja screams for Mattis (#506
// _14_318A1_RonjasHjalpSkrik), his "ForsvinnGradvargar" makes every dwarf fall, Ronja climbs down and the game ends in TJAERNEN
// at (256,344) without g8dd. Clicking the rock again restarts the game, which can then still be won.
// node tools/browse.mjs "http://localhost:5299/?mute=1&debug=1&scene=TJAERNEN&act=1" tools/steps/lake-lose.mjs --size 640x480
import { mk } from './qa-lib.mjs';
export default async (ctx) => {
  const { wait, shot, log, evaluate, click } = ctx;
  const L = mk(ctx);
  const lk = () => evaluate(() => { const m = globalThis.__mg.lake; return { phase: m.st.phase, hits: m.swarm.hits, state: [...m.swarm.state].join(''), atRock: m.swarm.atRock(), dlg: globalThis.__ronja.world.dialog?.event ?? null }; });

  await wait(1500); await click(5, 5); await L.settle({ max: 60000 });
  await L.verbRegion(3, 'hand');
  await L.waitMode(2, 30000);
  await wait(3000); await shot('lake-1-start');
  // idle: no throws
  const t0 = Date.now(); let last = '', lostAt = null;
  while (Date.now() - t0 < 240000 && (await L.S()).mode === 2) {
    const s = await lk();
    const k = `${s.phase} ${s.state} ${s.atRock}`;
    if (k !== last) { log(`  t+${Math.round((Date.now() - t0) / 1000)}s phase=${s.phase} slots=${s.state} atRock=${s.atRock}`); last = k; }
    if (s.phase >= 1 && s.phase <= 3 && lostAt === null) { lostAt = Math.round((Date.now() - t0) / 1000); await shot('lake-2-lost'); }
    if (s.state.includes('4') && !lk.fall) { lk.fall = true; await shot('lake-3-mattis'); }
    await wait(300);
  }
  log('lost after', lostAt, 's; mode', (await L.S()).mode);
  await L.waitMode(0, 120000); await L.settle({ max: 60000 });
  await shot('lake-4-after');
  const s = await L.S();
  log('after losing', JSON.stringify({ scene: s.scene, mode: s.mode, rx: s.rx, ry: s.ry }), 'g8dd =', await L.flag(0x8dd));

  // retry: the rock starts the game again; a few real throws, then the dev win (21 hits by hand take minutes headless)
  await L.verbRegion(3, 'hand');
  await L.waitMode(2, 30000);
  log('restarted by clicking the rock:', (await L.S()).mode === 2);
  await wait(5000);
  const t1 = Date.now(); // the dwarves need ~15-20 s to fill the rock: throw for 8 s, then the dev win
  while (Date.now() - t1 < 8000 && (await L.S()).mode === 2) {
    const tgt = await evaluate(() => { const m = globalThis.__mg.lake; const out = []; m.swarm.slots.forEach((sl, i) => { const o = sl.obj; if (!o.hidden && o.track && o.x > 0 && o.x < 640) out.push([Math.round(o.x), Math.round(o.y - 30), m.swarm.state[i]]); }); return { phase: m.st.phase, cone: m.st.cone, out }; });
    const t = tgt.out.sort((a, b) => b[2] - a[2])[0];
    if (tgt.phase === 0 && t && tgt.cone === 0) await L.clickScreen(t[0], Math.max(190, t[1]));
    await wait(700);
  }
  log('second round after real throws', JSON.stringify(await lk()));
  if ((await L.S()).mode === 2 && (await lk()).phase === 0) await evaluate(() => globalThis.__mg.lake.win());
  await L.waitMode(0, 120000); await L.settle({ max: 60000 });
  await shot('lake-5-won');
  const w = await L.S();
  log('after the second round', JSON.stringify({ scene: w.scene, mode: w.mode, rx: w.rx, ry: w.ry }), 'g8dd =', await L.flag(0x8dd));
  log('console errors', JSON.stringify(L.errors ?? []));
};
