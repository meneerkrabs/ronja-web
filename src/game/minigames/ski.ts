// Minigame 3: the ski run on winter.smk (game-logic.md §5.7, engine.md §2.9, decompile FUN_00430210 start, FUN_004306c0 tick,
// FUN_004305d0 steering, FUN_00430530 collision, FUN_00430f90 end).
//
// The whole slope is the video: it plays from frame 0 (story intro) to 662, pauses, then the game seeks / pauses it
// (SmackGoto / SmackPause) and checks a per-frame obstacle table while Ronja (an unscaled sprite, no pan) is blitted over
// the movie. The video is decoded incrementally frame by frame; snapshots of the delta-coded decoder state at the
// seek targets make the backwards jumps after a crash instant.

import {
  O, T, setG, ui, core, registerMinigame, endMinigame, enterScene, setPan, playMusic, stopMusic, masterFade, TF_LOOP, renderer,
  type Minigame,
} from '../api.ts';
import { Smacker, type SmkSnapshot } from '../../engine/smacker.ts';
import { audio } from '../../engine/audio.ts';
import { outputNode } from '../audio-game.ts';

const MOVIE = 'winter.smk';
const MOVIE_X = 0, MOVIE_Y = 84; // PlaySmackerFile("winter.smk", cb, 0, 84)
const FRAME_MS = 1000 / 15; // SmackFrameRate(15)

// ---- RONJA+0x3b0.. (set by FUN_00430210)
const LIMIT_L = 118, LIMIT_R = 510, MAX_SPEED = 10, DIVISOR = 10;

// ---- track handles 0x900103.. (FUN_004501a0)
const TR_N = 259, TR_NO = 260, TR_NV = 261, TR_NNO = 262, TR_NNV = 263, TR_FALL = 264;
const TRACK_OF_DIR: Record<number, number> = { 0: TR_N, 1: TR_NNO, 2: TR_NO, [-2]: TR_NV, [-1]: TR_NNV };

// ---- obstacle table at 0x4915b0 (frame 662 first): "start-end:mask", mask bit0 left, bit1 middle, bit2 right
const OBSTACLE_FIRST = 662;
const OBSTACLE_RUNS =
  '662-671:0 672-715:1 716-793:0 794-811:6 812-888:0 889-896:1 897-931:0 932-936:4 937-957:0 958-964:1 965-974:0 975-976:4 977-981:6 982-986:0 987-989:4 990-1001:0 ' +
  '1002-1010:1 1011-1017:0 1018-1021:4 1022-1044:0 1045-1052:2 1053-1069:0 1070-1075:6 1076-1088:0 1089-1094:1 1095-1110:0 1111-1116:4 1117-1138:0 1139-1143:3 ' +
  '1144-1196:0 1197-1201:1 1202-1226:0 1227-1230:4 1231-1237:0 1238-1241:4 1242-1244:0 1245-1246:4 1247-1252:6 1253-1265:0 1266-1267:4 1268-1272:6 1273-1291:0 ' +
  '1292-1294:1 1295-1296:0 1297-1298:4 1299-1302:0 1303-1305:1 1306:5 1307-1308:4 1309-1324:0 1325-1328:6 1329-1348:0 1349-1350:4 1351-1367:0 1368-1369:1 1370-1371:0 ' +
  '1372-1375:3 1376-1396:0 1397-1398:1 1399-1407:0 1408-1410:4 1411-1414:1 1415-1421:0 1422-1424:4 1425-1432:0 1433-1434:4 1435-1436:0 1437-1439:4 1440-1444:0 ' +
  '1445-1447:1 1448-1461:0 1462-1464:6 1465-1471:0 1472:5 1473-1474:4 1475-1479:0 1480-1481:3 1482-1486:0 1487-1488:1 1489-1501:0 1502:1 1503-1504:3 1505-1529:0 ' +
  '1530-1532:4 1533-1551:0 1552:1 1553-1555:3 1556-1576:0 1577-1579:6 1580-1600:0 1601-1603:1 1604-1606:3 1607-1615:0 1616-1617:1 1618-1626:0 1627-1629:1 1630:0 ' +
  '1631-1632:4 1633-1638:0 1639-1640:4 1641-1649:0 1650-1654:4 1655-1663:0 1664-1666:6 1667-1679:0 1680-1681:4 1682-1719:0 1720-1723:1 1724-1737:0 1738-1741:4 ' +
  '1742-1813:0 1814-1816:4 1817-1847:0 1848-1851:3 1852-1883:0 1884-1885:4 1886-1914:0 1915-1917:2 1918-1925:0 1926-1928:4 1929-1941:0 1942-1943:1 1944-1951:0 ' +
  '1952-1955:4 1956:0 1957-1959:1 1960-1968:0 1969:4 1970-1974:6 1975-1987:0 1988-1990:1 1991-2019:0 2020-2024:4 2025-2029:1 2030-2054:0 2055-2086:7';
const OBSTACLES: Uint8Array = (() => {
  const t = new Uint8Array(2087 - OBSTACLE_FIRST);
  for (const run of OBSTACLE_RUNS.split(' ')) {
    const [range, m] = run.split(':');
    const [a, b = a] = range.split('-').map(Number);
    for (let f = a; f <= b; f++) t[f - OBSTACLE_FIRST] = Number(m);
  }
  return t;
})();

/** FUN_00430530: does obstacle mask `m` hit a skier at x? (x <= 262 left, 230..410 middle, >= 397 right; 7 always) */
function hits(m: number, x: number): boolean {
  if (m === 7) return true;
  if (x <= 262 && (m === 1 || m === 3 || m === 5)) return true;
  if (x >= 230 && x <= 410 && (m === 2 || m === 3 || m === 6)) return true;
  return x >= 397 && (m === 4 || m === 5 || m === 6);
}

/** Frames the video is seeked to after a crash at frame p (state 2), or: -1 = no seek, -2 = course finished. */
function checkpointOf(p: number): number {
  if (p < 150) return 1;
  if (p < 812) return -1;
  if (p < 1023) return 812;
  if (p < 1279) return 1023;
  if (p < 1426) return 1279;
  if (p < 1558) return 1426;
  if (p < 1886) return 1558;
  if (p < 2052) return 1886;
  return -2;
}
const SEEK_TARGETS = new Set([1, 663, 812, 1023, 1279, 1426, 1558, 1886]);

// ------------------------------------------------------------------ movie loading

let movieBuf: Promise<ArrayBuffer> | null = null;
/** Start fetching winter.smk (50 MB) early, e.g. when the third winter condition is nearly met. */
export function prefetchSki(): void {
  if (!movieBuf) {
    movieBuf = core.files.read(`smacker/${MOVIE}`, true);
    movieBuf.catch(() => { movieBuf = null; });
  }
}

// ------------------------------------------------------------------ the video player (SmackPause / SmackGoto)

class SkiVideo {
  readonly smk: Smacker;
  private snaps = new Map<number, SmkSnapshot>();
  /** FrameNum: the frame the next DoFrame decodes (FUN_00419fa0) */
  frame = 0;
  paused = true; // resume() starts the clock and the sound
  /** frame shown now (-1 none) */
  shown = -1;
  private nextAt = 0;
  readonly pal12 = new Uint16Array(256);
  // audio (track 0, scheduled in 1 s chunks ahead of the clock)
  private sources: AudioBufferSourceNode[] = [];
  private aFrame = 0; // next frame whose audio is not scheduled yet
  private aT0 = 0; // ctx time of frame aBase
  private aBase = 0;
  private aOn = false;

  constructor(smk: Smacker) { this.smk = smk; }

  /** Decode forward to `n` (inclusive), keeping snapshots of the states just before the seek targets. */
  private decodeTo(n: number) {
    const smk = this.smk;
    while (smk.currentFrame < n) {
      const next = smk.currentFrame + 1;
      if (SEEK_TARGETS.has(next) && !this.snaps.has(next)) this.snaps.set(next, smk.snapshot());
      smk.advanceTo(next);
    }
  }

  /** SmackGoto: the next decoded frame will be `n` (the picture changes with the next DoFrame). */
  goto(n: number) {
    this.frame = n;
    if (this.aOn && !this.paused) this.startAudio();
  }

  /** Decode and show frame `this.frame` (SmackDoFrame + SmackNextFrame). */
  step() {
    const n = this.frame, smk = this.smk;
    if (smk.currentFrame !== n - 1) {
      const snap = this.snaps.get(n);
      if (n - 1 < smk.currentFrame && snap) smk.restore(snap);
      else this.decodeTo(n - 1); // forward (or from 0 when no snapshot)
    }
    this.decodeTo(n);
    this.shown = n;
    this.frame = n + 1;
    const pal = smk.palette;
    for (let i = 0; i < 256; i++) {
      const c = pal[i];
      this.pal12[i] = (Math.round((c & 255) / 17) << 8) | (Math.round(((c >> 8) & 255) / 17) << 4) | Math.round(((c >> 16) & 255) / 17);
    }
  }

  /** Silently decode up to (not including) frame n; the next step() shows n. */
  fastForward(n: number) {
    this.decodeTo(n - 1);
    this.frame = n;
  }

  /** Real-time pacing: show the due frame(s). Returns the number of frames shown. */
  advance(now: number, end: number): number {
    if (this.paused) return 0;
    if (now - this.nextAt > 4 * FRAME_MS) this.nextAt = now - FRAME_MS; // fell far behind: resync, never burst
    let k = 0;
    while (now >= this.nextAt && this.frame < end && k < 2) { this.step(); this.nextAt += FRAME_MS; k++; }
    return k;
  }

  pause(now: number) {
    if (this.paused) return;
    this.paused = true;
    this.stopAudio();
    void now;
  }

  resume(now: number) {
    if (!this.paused) return;
    this.paused = false;
    this.nextAt = now + FRAME_MS;
    this.aOn = true;
    this.startAudio();
  }

  /** (Re)start the sound at FrameNum, due when the next frame is due. */
  startAudio() {
    this.stopAudio();
    this.aOn = true;
    this.aBase = this.frame;
    this.aFrame = this.frame;
    const wait = Math.max(0, (this.nextAt - performance.now()) / 1000);
    this.aT0 = audio.ctx.currentTime + wait + 0.02;
    this.pump();
  }

  stopAudio() {
    for (const s of this.sources) { try { s.stop(); } catch { /* not started */ } }
    this.sources = [];
  }

  /** Keep ~3 s of sound scheduled (decoded 15 frames at a time). */
  pump() {
    if (!this.aOn || this.paused) return;
    const ahead = audio.ctx.currentTime + 3;
    const fps = 15;
    while (this.aFrame < this.smk.frameCount && this.aT0 + (this.aFrame - this.aBase) / fps < ahead) {
      const from = this.aFrame, to = Math.min(from + 14, this.smk.frameCount - 1);
      this.aFrame = to + 1;
      const s = this.smk.audioSamples(0, from, to);
      if (!s) continue;
      const buf = audio.ctx.createBuffer(s.data.length, s.data[0].length, s.rate);
      s.data.forEach((d, i) => buf.copyToChannel(d as Float32Array<ArrayBuffer>, i));
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(outputNode()); // so the master fade (state 3) also fades the movie sound
      const t = this.aT0 + (from - this.aBase) / fps;
      src.start(Math.max(t, audio.ctx.currentTime));
      this.sources.push(src);
      src.onended = () => { const i = this.sources.indexOf(src); if (i >= 0) this.sources.splice(i, 1); };
    }
  }

  dispose() {
    this.aOn = false;
    this.stopAudio();
  }
}

// ------------------------------------------------------------------ the game (RONJA+0x3c0 state machine)

let video: SkiVideo | null = null;
let loadToken = 0;
let state = -3; // +0x3c0
let c8 = 0; // +0x3c8
let cnt = 0; // +0x3cc
let crashFrame = 0; // +0x3d4
let crashes = 0; // +0x3d0
let pausedOnce = false; // +0x3d8
let fallDone = false;
let fallTicks = 0;
let fadeAt = 0;
let dir = 0; // DAT_004e93d4
let warpOff = 0; // browsers cannot SetCursorPos: the steering target is the real mouse x plus this offset
let finished = false;
let startFrame = 0;

const now = () => performance.now();
const clampX = (v: number) => Math.max(0, Math.min(639, v));
let lastReal = 320;
/**
 * RONJA+0x368: the steering target (mouse x). After a crash the original warps the OS cursor onto Ronja (SetCursorPos);
 * a browser cannot, so the target is the real mouse x plus `warpOff`, and the offset melts away as the mouse moves.
 */
function targetX(): number {
  const real = ui.mouseX, dx = real - lastReal;
  lastReal = real;
  if (dx !== 0 && warpOff !== 0) {
    const shrink = Math.min(Math.abs(warpOff), Math.abs(dx) * 0.5);
    warpOff -= Math.sign(warpOff) * shrink;
  }
  return clampX(real + warpOff);
}
const frameNum = () => (video ? video.frame : 0); // FUN_00419fa0

function setSlalom(handle: number, loop: boolean) {
  const R = O.RONJA;
  if (loop) {
    if (R.playing?.name.toLowerCase() === T(handle).toLowerCase()) return; // DAT_004e9240 != track
    R.setTrack(T(handle), TF_LOOP);
  } else R.setTrack(T(handle), 0);
}

/** FUN_004305d0 + the move: RONJA x follows the mouse at distance/10 px per tick (max 10), `dir` selects the lean track. */
function steer() {
  const R = O.RONJA;
  const mx = Math.trunc(targetX());
  const x = R.x;
  let v = 0;
  if (x - 2 <= mx) {
    if (mx <= x + 2) { dir = 0; R.x = mx; return; }
    if (x < LIMIT_R - 1) {
      const d = (Math.min(mx, LIMIT_R) - Math.trunc(x)) / DIVISOR;
      if (d <= MAX_SPEED) { dir = 1; v = d; } else { dir = 2; v = MAX_SPEED; }
    } else { dir = 0; R.x = LIMIT_R; return; }
  } else if (LIMIT_L + 1 < x) {
    const d = (Math.trunc(x) - Math.max(mx, LIMIT_L)) / DIVISOR;
    if (d > MAX_SPEED) { dir = -2; v = -MAX_SPEED; } else { dir = -1; v = -d; }
  } else { dir = 0; R.x = LIMIT_L; return; }
  R.moveRelative(v, 0, 0);
}

function placeRonja(x: number, y: number, z: number) {
  const R = O.RONJA;
  R.followGround = false;
  R.setPosition(x, y, z);
}

function parkRonja() {
  O.RONJA.stopTrack();
  O.RONJA.setPosition(1300, 1300, 3000);
  O.RONJA.hide();
}

function onFallEnd() { fallDone = true; }

function tick() {
  const v = video;
  if (!v || finished) return;
  const t = now();
  v.pump();
  // ---- the video clock (Smacker's own timer): at most two frames per tick, collision checked per shown frame
  const shownBefore = v.shown;
  const n = v.advance(t, v.smk.frameCount - 1);
  if (v.frame >= v.smk.frameCount - 1 && !v.paused) { finish(); return; }
  void shownBefore; void n;
  switch (state) {
    case -3:
      if (++c8 === 10) { c8 = 0; state = -2; }
      return;
    case -2: {
      if (frameNum() < 0x296) return;
      placeRonja(320, 360, 800);
      O.RONJA.show();
      setSlalom(TR_N, true);
      v.pause(t);
      state = -1;
      v.goto(0x297);
      return;
    }
    case -1:
      c8++;
      if (c8 === 10) void playMusic('dls_skidspelet_150_', 0x7d);
      if (c8 < 0x15) return;
      v.resume(t);
      state = 1;
      c8 = 0;
      return;
    case 3:
      masterFade(0, 1000);
      fadeAt = t;
      c8 = 0;
      state = 4;
      return;
    case 4:
      if (t - fadeAt < 1030) return; // FUN_0047a820: the fade has finished
      stopMusic();
      parkRonja();
      v.resume(t);
      masterFade(127, 500);
      state = 5; // (the original repeats this block every tick; nothing changes after the first)
      return;
    case 5:
    case 0:
      return;
    case 2:
      crashTick(v, t);
      return;
  }
  // ---- state 1: skiing
  steer();
  setSlalom(TRACK_OF_DIR[dir], true);
  collide(v);
}

/** The end of tick state 1: obstacle mask of the current video frame vs Ronja x. */
function collide(v: SkiVideo) {
  const f = v.frame;
  const i = f - OBSTACLE_FIRST;
  if (i < 0 || i >= OBSTACLES.length) return;
  if (!hits(OBSTACLES[i], O.RONJA.x)) return;
  crashFrame = f;
  state = 2;
  crashes++;
  fallDone = false;
  fallTicks = 0;
  const ok = O.RONJA.setTrack(T(TR_FALL), 0, onFallEnd);
  if (!ok) fallDone = true;
}

function crashTick(v: SkiVideo, t: number) {
  if (!fallDone) {
    if (++fallTicks < 250) return; // safety net: the fall track always ends
  }
  if (!pausedOnce) { pausedOnce = true; v.pause(t); }
  cnt++;
  if (cnt === 50) {
    const R = O.RONJA;
    placeRonja(320, R.y, 0);
    warpOff = 320 - ui.mouseX; // SetCursorPos onto Ronja
    lastReal = ui.mouseX;
    setSlalom(TR_N, false);
    R.setTrack(T(TR_N), TF_LOOP);
    const cp = checkpointOf(crashFrame);
    if (cp === -2) { state = 3; }
    else if (cp >= 0) v.goto(cp);
  }
  if (cnt < 100 || state > 2) return;
  cnt = 0;
  if (pausedOnce) { pausedOnce = false; v.resume(t); }
  state = 1;
}

/** Video end callback (LAB_004301b0) + FUN_00430f90: ski run done. */
function finish() {
  if (finished) return;
  finished = true;
  setG(0x8e0, 1);
  const place = { x: 400, y: 400, dir: 5 };
  endMinigame();
  enterScene('BORGGARDEN', { force: true });
  setPan(0);
  const R = O.RONJA;
  R.followGround = true;
  R.show();
  R.standStill(place.x, place.y, 0, place.dir);
}

// ------------------------------------------------------------------ drawing: the movie, then Ronja on top (engine.md §2.9)

function draw(r: typeof renderer) {
  const back = r.back;
  back.fill(0);
  const v = video;
  if (!v || v.shown < 0) return;
  const idx = v.smk.indices, pal = v.pal12, w = v.smk.width, h = v.smk.height;
  for (let y = 0; y < h; y++) {
    const dy = MOVIE_Y + y;
    if (dy < 0 || dy >= 480) continue;
    const o = dy * 640 + MOVIE_X, s = y * w;
    for (let x = 0; x < w; x++) back[o + x] = pal[idx[s + x]];
  }
  const R = O.RONJA;
  const f = R.frame;
  if (R.hidden || !f || f.bbox[2] <= f.bbox[0]) return;
  // blitted unscaled at (x - anchorX, y - anchorY), alpha > 0 copied opaque, no depth test, no pan
  const l = Math.trunc(R.x + (f.bbox[0] - R.ax)), tp = Math.trunc(R.y + (f.bbox[1] - R.ay));
  const bw = f.bbox[2] - f.bbox[0], bh = f.bbox[3] - f.bbox[1];
  for (let y = 0; y < bh; y++) {
    const dy = tp + y;
    if (dy < 0 || dy >= 480) continue;
    for (let x = 0; x < bw; x++) {
      const dx = l + x;
      if (dx < 0 || dx >= 640) continue;
      const s = f.px[(f.bbox[1] + y) * f.w + f.bbox[0] + x];
      if ((s >> 12) !== 0) back[dy * 640 + dx] = s & 0xfff;
    }
  }
}

// ------------------------------------------------------------------ registration

const ski: Minigame = {
  mode: 3,
  start(args) {
    // FUN_00430210: SetCurrentScene(BORGGARDEN), mode 3, limits, preloaded tracks; Ronja off screen and hidden; winter.smk starts
    const a = (args ?? {}) as { from?: number };
    startFrame = Math.max(0, Math.trunc(a.from ?? 0));
    state = -3; c8 = 0; cnt = 0; crashFrame = 0; crashes = 0; pausedOnce = false; fallDone = false; fallTicks = 0;
    dir = 0; warpOff = 0; lastReal = ui.mouseX; finished = false;
    video?.dispose();
    video = null;
    setPan(0);
    parkRonja();
    const token = ++loadToken;
    prefetchSki();
    movieBuf!.then((buf) => {
      if (token !== loadToken || finished) return;
      const v = new SkiVideo(new Smacker(buf));
      if (startFrame > 0) v.fastForward(startFrame);
      video = v;
      if (startFrame >= 0x297) { // testing aid (args.from): start straight in the skiing state
        placeRonja(320, 360, 800);
        O.RONJA.show();
        setSlalom(TR_N, true);
        state = 1;
      }
      v.resume(now()); // paused = true initially -> resume starts clock and sound
    }, (e) => {
      console.warn('winter.smk unavailable', e);
      if (token === loadToken) finish();
    });
  },
  tick,
  // the story part of winter.smk (frames 0..661, 44 s) can be skipped: decode silently up to the pause frame (0x296)
  skipOffer() {
    const v = video;
    if (!v || finished || state > -2 || v.frame >= 0x296 - 1) return null;
    return { label: 'Sla film over', action: () => { v.fastForward(0x296 - 1); v.startAudio(); } };
  },
  cursor: () => 'invisible',
  draw,
  end() {
    loadToken++;
    video?.dispose();
    video = null;
    masterFade(127, 0);
  },
};

registerMinigame(ski);

// test / debug hook (headless tests read the state; harmless in the game)
(globalThis as unknown as { __ski: unknown }).__ski = {
  info: () => ({ state, c8, cnt, crashes, crashFrame, frame: video?.frame ?? -1, shown: video?.shown ?? -1, paused: video?.paused ?? null, x: O.RONJA.x, y: O.RONJA.y, scale: O.RONJA.scale, dir, track: O.RONJA.playing?.name ?? null, finished, warpOff }),
  mask: (f: number) => OBSTACLES[f - OBSTACLE_FIRST] ?? 0,
  /** QA: end the run as if the video had reached its last frame (headless runs play it at a fraction of real time) */
  finish: () => finish(),
};
