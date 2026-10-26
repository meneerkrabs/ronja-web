// Cave-entrance defence (mode 6) lose path: idle until the grey dwarves win -> GLAENTAN, then walk back and retry.
// node tools/browse.mjs "http://localhost:5299/?mute=1&debug=1&scene=GROTTANUTE&act=3&g=907" tools/steps/cave-lose.mjs --size 1280x960
import { mk } from './qa-lib.mjs';
export default async (ctx) => {
  const { wait, shot, log, evaluate, click } = ctx;
  const L = mk(ctx);
  await wait(1500); await click(5, 5);
  await L.settle({ max: 60000 });
  log('start', JSON.stringify(await L.S()));
  await L.clickRegion(1);                       // cave mouth -> cave defence (mode 6)
  await L.waitMode(6, 90000);
  log('mode 6 started', JSON.stringify(await evaluate(() => ({ phase: globalThis.__mg?.cave?.st.phase, hits: globalThis.__mg?.cave?.swarm.hits }))));
  await wait(6000); await shot('cavelose-1-playing');
  // do nothing: the grey dwarves reach the cave
  const t0 = Date.now();
  let s;
  for (;;) {
    await wait(2000);
    s = await L.S();
    const m = await evaluate(() => ({ mode: globalThis.__ronja.gv?.g8c0 ?? null, phase: globalThis.__mg?.cave?.st.phase ?? null }));
    if (s.scene !== 'GROTTANUTE' || Date.now() - t0 > 240000) { log('ended', JSON.stringify(s), JSON.stringify(m)); break; }
  }
  log(`lost after ${Math.round((Date.now() - t0) / 1000)} s`);
  await L.settle({ max: 60000 });
  await shot('cavelose-2-after');
  const pos = await evaluate(() => { const O = globalThis.__ronja.O; return { ronja: [Math.round(O.RONJA.x), Math.round(O.RONJA.y), O.RONJA.hidden], birk: [Math.round(O.BIRK.x), Math.round(O.BIRK.y), O.BIRK.hidden], g8df: globalThis.__ronja.g?.(0x8df) }; });
  log('after loss', JSON.stringify(await L.S()), JSON.stringify(pos));
  // still playable: walk back to the cave and try again
  await L.goTo('GROTTANUTE', { max: 120000 });
  log('back at the cave', JSON.stringify(await L.S()));
  await L.clickRegion(1);
  await L.waitMode(6, 90000);
  log('retry started', JSON.stringify(await evaluate(() => ({ phase: globalThis.__mg?.cave?.st.phase }))));
  await wait(3000); await shot('cavelose-3-retry');
  log('console errors', JSON.stringify(L.errors ?? []));
};
