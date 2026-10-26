// Ski run (mode 3) has no lose condition in the original (game-logic §5.7): a hit makes Ronja fall, after 2 s she starts again at
// x=320 from the checkpoint of the crash frame, as often as needed. This leaves the mouse on x=320 (no steering): she must keep
// falling in the middle lane (794-811 and 977-981 are blocked there) and stay in the 812 checkpoint loop. Then the lane bot
// steers through the rest of the course and the video ends by itself (dev finish only as a fallback); checks g8e0 + BORGGARDEN.
// node tools/browse.mjs "http://localhost:5299/?mute=1&debug=1&scene=STORASALEN&act=2&g=8d5,8d6,8d7" tools/steps/ski-crash.mjs --size 640x480
import { mk } from './qa-lib.mjs';
export default async (ctx) => {
  const { wait, shot, log, evaluate, click, move } = ctx;
  const L = mk(ctx);
  const info = () => evaluate(() => globalThis.__ski.info());
  const short = (i) => JSON.stringify({ state: i.state, frame: i.frame, crashes: i.crashes, crashFrame: i.crashFrame, x: Math.round(i.x), track: i.track });

  await wait(1500); await click(5, 5); await L.settle({ max: 60000 });
  // the real entries (Birk in the fog, the Mattis / Skalle-Per talks) are covered by pt/act2.mjs; here the run is started directly
  await evaluate(() => globalThis.__ronja.dev.startMinigame(3));
  await L.waitMode(3, 60000);
  await wait(4000);
  if (await L.skipText()) await (await L.skipBtn()).click(); // the winter.smk intro
  await move(320, 300); // the mouse on Ronja and left there
  for (let i = 0; i < 200 && (await info()).state !== 1; i++) await wait(250);
  log('skiing', short(await info()));
  await shot('ski-1-start');

  // 1) no steering: crash after crash at the same obstacle
  const t0 = Date.now(); let seen = 0, maxFrame = 0; const crashFrames = [];
  while (Date.now() - t0 < 180000) {
    const i = await info();
    maxFrame = Math.max(maxFrame, i.frame);
    if (i.crashes !== seen) {
      seen = i.crashes; crashFrames.push(i.crashFrame);
      log(`  crash ${seen} at frame ${i.crashFrame} (t+${Math.round((Date.now() - t0) / 1000)}s)`, short(i));
      if (seen === 1) { await wait(400); await shot('ski-2-fall'); }
      if (seen === 2) { // after the restart: where does the video continue?
        for (let k = 0; k < 80 && (await info()).state !== 1; k++) await wait(100);
        log('  after the restart', short(await info()));
      }
    }
    if (seen >= 4) break;
    await wait(150);
  }
  log('no steering: crashes', seen, 'frames', JSON.stringify(crashFrames), 'furthest frame', maxFrame, 'mode', (await L.S()).mode);
  await shot('ski-3-stuck');

  // 2) steering again: the lane bot gets through the course (crashes allowed), then winter.smk ends (Birk saves Ronja)
  const res = await L.skiBot(300000);
  const after = await info();
  log('after steering', short(after), 'reached the end of the course:', after.state >= 3 || !!res?.finished);
  await shot('ski-4-steering');
  const tEnd = Date.now();
  await L.waitMode(0, 240000);
  log('the run ended by itself:', (await L.S()).mode === 0, `(${Math.round((Date.now() - tEnd) / 1000)} s after the bot)`);
  if ((await L.S()).mode === 3) { log('fallback: __ski.finish()'); await evaluate(() => globalThis.__ski.finish()); }
  await L.settle({ max: 60000 });
  await shot('ski-5-after');
  const s = await L.S();
  log('after the run', JSON.stringify({ scene: s.scene, mode: s.mode, rx: s.rx, ry: s.ry }), 'g8e0 =', await L.flag(0x8e0));
  log('console errors', JSON.stringify(L.errors ?? []));
};
