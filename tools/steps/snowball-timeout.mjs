// Snowball fight (mode 5) has no lose condition in the original (game-logic §5.8); the way to fail is to not hit all five
// robbers within 30 s of each other: then every robber recovers. This hits some, waits for the timer, checks the reset
// (+ the "Allafryser" warning at < 6 s), then wins with real throws (dev win only as a fallback) and checks the exit.
// node tools/browse.mjs "http://localhost:5299/?mute=1&debug=1&scene=BORGGARDEN&act=2&g=8d5,8d6,8d7,8d8,8da&inv=MOROTTER" tools/steps/snowball-timeout.mjs --size 1280x960
import { mk } from './qa-lib.mjs';
export default async (ctx) => {
  const { wait, shot, log, evaluate, click } = ctx;
  const L = mk(ctx);
  const sb = () => evaluate(() => { const s = globalThis.__mg?.snowball?.st; return s ? { hit: s.hit, sit: s.sit, timer: s.timer, warned: s.warned, flying: s.flying } : null; });
  const targets = () => evaluate(() => { const g = globalThis.__ronja, O = g.O, pan = g.world.scene.pan; const s = globalThis.__mg.snowball.st; const names = ['STURKAS', 'LABAS', 'TJEGGE', 'LILLKLIPPEN', 'FJOSOK']; const out = []; names.forEach((n, i) => { const o = O[n]; if (!(s.hit & (1 << i)) && !o.hidden && o.x - pan > 0 && o.x - pan < 640 && o.y < 480) out.push([Math.round(o.x - pan), Math.round(o.y - 50)]); }); return { out, flying: s.flying }; });
  const throwUntil = async (pred, maxMs) => { const t0 = Date.now(); let last = -1; while (Date.now() - t0 < maxMs && (await L.S()).mode === 5) { const s = await sb(); if (s.hit !== last) { log(`  t+${Math.round((Date.now() - t0) / 1000)}s hit=${s.hit.toString(2).padStart(5, '0')} sit=${s.sit.toString(2).padStart(5, '0')} timer=${s.timer}`); last = s.hit; } if (pred(s)) return true; const r = await targets(); if (r.out.length && !r.flying) await L.clickScreen(...r.out[Math.floor(Math.random() * r.out.length)]); await wait(1300); } return false; };
  const bits = (m) => [0, 1, 2, 3, 4].filter((i) => m & (1 << i)).length;

  await wait(1500); await click(5, 5); await L.settle({ max: 60000 });
  await L.useItem('MOROTTER', ...(await L.regionCentre(9)));
  await L.settle({ max: 120000, skipDlg: false });
  await L.waitMode(5, 120000);
  await wait(3000); await shot('snowball-1-start');
  log('started', JSON.stringify(await sb()));

  // 1) hit a few robbers, then stop throwing
  await throwUntil((s) => bits(s.hit) >= 2, 90000);
  const before = await sb();
  log('hit some', JSON.stringify(before), `${bits(before.hit)} robbers down`);
  await shot('snowball-2-some-hit');
  // 2) wait for the 30 s timer: warning at < 300 ticks, then everybody recovers
  const t0 = Date.now(); let warnedAt = null;
  for (;;) {
    await wait(500);
    const s = await sb();
    if (s.warned && warnedAt === null) { warnedAt = Math.round((Date.now() - t0) / 1000); log('warning "Allafryser" after', warnedAt, 's', JSON.stringify(s)); }
    if (s.hit === 0 && s.sit === 0) { log('robbers recovered after', Math.round((Date.now() - t0) / 1000), 's', JSON.stringify(s)); break; }
    if (Date.now() - t0 > 60000) { log('!! no reset within 60 s', JSON.stringify(s)); break; }
  }
  await wait(1500); await shot('snowball-3-recovered');
  log('still in the fight:', (await L.S()).mode === 5);

  // 3) the fight can still be won
  const won = await throwUntil((s) => s.sit === 0x1f, 150000);
  log('all five down by throwing:', won, JSON.stringify(await sb()));
  if (!won && (await L.S()).mode === 5) {
    log('fallback: dev win()');
    for (let i = 0; i < 24 && (await L.S()).mode === 5; i++) { await evaluate(() => { const s = globalThis.__mg.snowball.st; if (s.sit !== 0x1f) globalThis.__mg.snowball.win(); }); await wait(5000); log('  ', JSON.stringify(await sb()), JSON.stringify(await evaluate(() => ['STURKAS', 'LABAS', 'TJEGGE', 'LILLKLIPPEN', 'FJOSOK'].map((n) => { const o = globalThis.__ronja.O[n]; return n.slice(0, 4) + ':' + (o.track?.name.replace(/^[A-Z]+_8_888_/i, '') ?? '-'); })))); }
  }
  await L.waitMode(0, 120000); await L.settle({ max: 120000, skipDlg: false });
  await shot('snowball-4-after');
  log('after the fight', JSON.stringify(await L.S()), 'g8de =', await L.flag(0x8de));
  log('console errors', JSON.stringify(L.errors ?? []));
};
