// River with the bird witch (mode 7, act 3) lose path: jump to a stone in the witch's lane and stand still until the witch has knocked Ronja into the water three
// times and carries her off; the game must end without g8e2, leave Ronja and Birk usable, and allow a retry.
// node tools/browse.mjs "http://localhost:5299/?mute=1&debug=1&scene=GLUPAFALLET&act=3&inv=BIRK" tools/steps/river-witch-lose.mjs --size 1280x960
import { mk } from './qa-lib.mjs';
export default async (ctx) => {
  const { wait, shot, log, evaluate, click } = ctx;
  const L = mk(ctx);
  const riv = () => evaluate(() => { const d = globalThis.__river; return d ? { state: d.s.state, stone: d.s.stone, mode: d.s.mode, active: d.s.active, knocks: d.s.knocks, witch: d.s.witch } : null; });
  await wait(1500); await click(5, 5);
  await L.settle({ max: 60000 });
  log('start', JSON.stringify(await L.S()));
  await L.clickRegion(0x3a);
  await L.waitMode(7, 90000);
  log('mode 7 started', JSON.stringify(await riv()));
  // the start stone (46) is outside the witch's lanes: jump to stone 2 (lane C) and stand still there
  await L.riverBot(2, 10000);
  log('on stone', JSON.stringify(await riv()));
  await wait(1000); await shot('riverlose-1-playing');
  const t0 = Date.now();
  let last = '', third = false;
  for (;;) {
    await wait(1000);
    const r = await riv(); const s = await L.S();
    const k = JSON.stringify(r);
    if (k !== last) { log(`${Math.round((Date.now() - t0) / 1000)}s`, k); last = k; }
    if (r?.knocks === 3 && !third) { third = true; await shot('riverlose-2-third-knock'); }
    if (s.mode === 0 || Date.now() - t0 > 300000) break;
  }
  log(`ended after ${Math.round((Date.now() - t0) / 1000)} s`);
  await L.settle({ max: 60000 });
  await shot('riverlose-3-after');
  const pos = await evaluate(() => { const O = globalThis.__ronja.O; return { ronja: [Math.round(O.RONJA.x), Math.round(O.RONJA.y), O.RONJA.hidden], birk: [Math.round(O.BIRK.x), Math.round(O.BIRK.y), O.BIRK.hidden] }; });
  log('after loss', JSON.stringify(await L.S()), JSON.stringify(pos), 'g8e2 =', await L.flag(0x8e2));
  // retry
  await L.clickRegion(0x3a);
  await L.waitMode(7, 90000);
  log('retry started', JSON.stringify(await riv()));
  await wait(3000); await shot('riverlose-4-retry');
  log('console errors', JSON.stringify(L.errors ?? []));
};
