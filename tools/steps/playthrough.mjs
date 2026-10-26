// Scripted playthrough "Nieuw spel" -> credits (docs/playthrough.md).
//   node tools/browse.mjs "http://localhost:5320/?mute=1&play=1" tools/steps/playthrough.mjs --size 1280x960
// QA_PHASES=new,a1,a2,a3 (comma list; default all). When resuming without "new", pass dev URL params (?scene=&act=&g=&inv=).
import { mk } from './qa-lib.mjs';
import newGame from './pt/new.mjs';
import act1 from './pt/act1.mjs';
import act2 from './pt/act2.mjs';
import act3 from './pt/act3.mjs';
import { x1, x2 } from './pt/extras.mjs';
const PHASES = { new: newGame, a1: act1, a2: act2, a3: act3, x1, x2 };
export default async (ctx) => {
  const T0 = Date.now(); const log0 = ctx.log; ctx.log = (...a) => log0(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(4)}s]`, ...a);
  const L = mk(ctx);
  ctx.page.on('console', (m) => { if (m.type() === 'error') { L.errors.push(m.text()); ctx.log('[console error]', m.text()); } });
  ctx.page.on('crash', () => ctx.log('!! PAGE CRASHED (renderer)'));
  ctx.page.on('framenavigated', (f) => { if (f === ctx.page.mainFrame()) ctx.log('!! NAVIGATED', f.url()); });
  ctx.page.on('close', () => ctx.log('!! PAGE CLOSED'));
  const want = (process.env.QA_PHASES ?? 'new,a1,a2,a3').split(',');
  await ctx.wait(2500);
  if (process.env.QA_PRE) await ctx.evaluate((c) => (0, eval)(c), process.env.QA_PRE);
  for (const p of want) { ctx.log(`######## phase ${p}`); await PHASES[p](L, ctx); }
  ctx.log('console errors:', L.errors.length);
  ctx.log('PLAYTHROUGH DONE');
};
