// Minigame 5: the snowball fight with the robbers (BORGPORTEN, winter; game-logic.md §5.8). Ported from Game.exe: init FUN_00431010,
// tick FUN_00431720, click FUN_00432720, end 0x432810 -> story.ts snowballEnded (FUN_0041fb10). No lose condition: hit all five
// robbers within 30 s (1500 ticks) of each other; they sit down in the snow and the game is won (g8de).

import { O, world, registerMinigame, doDialogAni, sample, setPan, S } from '../api.ts';
import { snowballEnded } from '../story.ts';
import { devHandle, effect, hideStop, mFade, mPlay, mStop, mVol, rnd, trackIs } from './_mg.ts';

const R = () => O.RONJA;
const BALL = () => O.SNOBOLL;

// robber hit / sitting bits (+0x37c / +0x380)
const B_STURKAS = 1, B_LABAS = 2, B_TJEGGE = 4, B_LILL = 8, B_FJOSOK = 0x10;

// track handles
const KAST_SNOBOLL = 0xc0, KAST_STILL = 0xd4;
const STURKAS = { flyO: 0xb1, flyV: 0xb2, badO: 0xcb, badV: 0xcc };
const LILL = { flyO: 0xb6, flyV: 0xcd, badO: 0xce, badV: 0xcf };
const FJOSOK = { goV: 0x99, titta: 0xb8, tvatta: 0xb7 };
const LABAS = { naken: 0xb3, bad: 0xb5 };
const TJEGGE = { naken: 0xbf, bad: 0xd0 };

const st = {
  active: false,
  /** +0x378 a ball is on its way (flight and splat) */
  flying: false,
  /** +0x37c hit bits, +0x380 sitting bits */
  hit: 0, sit: 0,
  /** +0x384 timer (ticks), +0x3a8 "everybody freezes" warning played */
  timer: -1, warned: false,
  /** +0x3ac end state, +0x4cc counter */
  end: 0, endCount: 0,
  /** +0x39c Sturkas' and +0x3a4 Lillklippen's direction (0 = last ran west, 1 = east) */
  sDir: 0, lDir: 0,
  vx: 0, vy: 0, vz: 0,
  /** +0x364 tick counter, +0x370 music fade started */
  ticks: 0, fadeStarted: false,
};

function init(): void {
  st.active = false;
  st.flying = false; st.hit = 0; st.sit = 0; st.timer = -1; st.warned = false; st.end = 0; st.endCount = 0;
  st.sDir = 0; st.lDir = 0; st.vx = st.vy = st.vz = 0; st.ticks = 0; st.fadeStarted = false;
  mStop();
  setPan(0);
  for (const o of [O.LILLKLIPPEN, O.FJOSOK, O.STURKAS, O.TJEGGE, O.LABAS]) { o.hide(); o.setPosition(1000, 1000, 1000); }
  const b = BALL();
  b.setAniFrame(S(0x22a), 0);
  b.ax = 16; b.ay = 16; b.az = 0; b.keyFlags = 0;
  b.setPosition(-30, 0, 8300);
  b.show();
  R().followGround = false;
  R().setTrack(KAST_STILL, 1); // loop; the track places her at the throwing spot
  mPlay('dls_prickaRovarna_116_', 0x3c);
  mFade(0x73, 1000);
  st.active = true;
}

// ------------------------------------------------------------------ click (FUN_00432720)

function click(x: number, y: number): void {
  if (!st.active || st.flying || st.end >= 1 || st.sit === 0x1f) return;
  if (trackIs(R(), KAST_SNOBOLL)) return;
  R().setTrack(KAST_SNOBOLL, 0);
  if (x > 520) x = 520;
  if (y < 140) y = 140;
  const vz = (480 - y) * 0.11111111;
  st.vz = vz;
  st.vy = -2 - vz * 0.21276596;
  st.vx = (x - 100) * 0.04;
}

// ------------------------------------------------------------------ the ball (FUN_00431720)

function ballStep(): void {
  const b = BALL(), r = R();
  if (!st.flying) {
    if (trackIs(r, KAST_SNOBOLL) && r.keyIdx > 7 && r.keyIdx < 14) {
      st.flying = true;
      b.setPosition(125, 300, 1300);
      effect('EFFEKT_8_888_SlangBoll', b.x, b.z);
    }
    return;
  }
  if (b.frameNo < 1) {
    const zOld = b.z;
    b.moveRelative(st.vx, st.vy, st.vz);
    st.vx *= 0.997; st.vy = (st.vy + 0.2) * 0.997; st.vz *= 0.997;
    const sc = world.scene!;
    let bg = ballBg(b.x, b.y);
    if (bg < 0) bg = 65535;
    let fl = 65535;
    if (b.y >= 0 && b.y < 480 && b.x >= 0 && b.x < 640 && sc.maps.h) fl = sc.maps.h[Math.trunc(b.y) * sc.width + Math.trunc(b.x)];
    if ((b.z <= bg && bg < zOld + 128) || fl < b.z || b.y > 480) {
      splat(zOld);
      effect('EFFEKT_8_888_Ground', b.x, b.z);
      return;
    }
    const lim = zOld + 128;
    const pan = sc.pan;
    const bx = Math.trunc(b.x), by = Math.trunc(b.y);
    const L = O.LILLKLIPPEN, S1 = O.STURKAS, LB = O.LABAS, T1 = O.TJEGGE, F = O.FJOSOK;
    if (L.z < lim) {
      const left = Math.trunc(L.x - L.ax), top = Math.trunc(L.y - L.ay);
      if (bx >= left && bx <= left + 70 && by >= top && by <= top + 120) robberHit(B_LILL, 'EFFEKT_8_888_Lillklippen', 20, b, zOld);
    }
    if (S1.z < lim && S1.hitTest(bx - pan, by)) robberHit(B_STURKAS, 'EFFEKT_8_888_Sturkas', 0, b, zOld);
    if (b.z <= LB.z && LB.z < lim && LB.hitTest(bx - pan, by)) robberHit(B_LABAS, 'EFFEKT_8_888_Labas', 0, b, zOld);
    if (T1.z < lim && T1.hitTest(bx - pan, by)) robberHit(B_TJEGGE, 'EFFEKT_8_888_Tjegge', 0, b, zOld);
    if (F.z < lim && F.hitTest(bx - pan, by)) robberHit(B_FJOSOK, 'EFFEKT_8_888_Fjosok', 0, b, zOld);
  } else if (st.ticks % 5 === 0) { // the splat dissolves: frames 2, 3, then back to the parked ball
    if (b.frameNo < 3) b.setAniFrame(S(0x22a), b.frameNo + 1);
    else {
      b.setAniFrame(S(0x22a), 0);
      b.setPosition(-30, 0, 8300);
      st.flying = false;
    }
  }
}

/** The depth of the scenery at the ball (FUN_00417160 signed short). */
function ballBg(x: number, y: number): number {
  const sc = world.scene!;
  if (!sc.maps.z) return 65535;
  const cx = Math.max(0, Math.min(sc.width - 1, Math.trunc(x))), cy = Math.max(0, Math.min(479, Math.trunc(y)));
  return (sc.maps.z[cy * sc.width + cx] << 16) >> 16;
}

/** The ball stays where it hit, a little nearer, and shows the splat frame. */
function splat(zOld: number): void {
  const b = BALL();
  b.setPosition(b.x, b.y, zOld - 30);
  b.setAniFrame(S(0x22a), 1);
}

function robberHit(bit: number, sound: string, volAdd: number, b: typeof O.SNOBOLL, zOld: number): void {
  if ((st.hit & bit) !== bit) {
    effect(sound, b.x, b.z, volAdd);
    st.timer = 0x5dc;
    st.hit |= bit;
  }
  splat(zOld);
}

// ------------------------------------------------------------------ the robbers

/** Sturkas / Lillklippen: run back and forth, sit down when hit. `dir` 0: last ran west (FlyNakenV) -> next FlyNakenO. */
function runner(o: typeof O.STURKAS, bit: number, t: { flyO: number; flyV: number; badO: number; badV: number }, getDir: () => number, setDir: (d: number) => void): void {
  const dir = getDir();
  if (st.hit & bit) {
    if (!(st.sit & bit) && !trackIs(o, t.badV) && !trackIs(o, t.badO)) {
      o.setTrack(dir === 0 ? t.badV : t.badO, 1);
      st.sit |= bit;
    }
    return;
  }
  if (!o.track) o.setTrack(dir === 0 ? t.flyO : t.flyV, 0);
  else if (trackIs(o, t.badV) || trackIs(o, t.badO)) o.setTrack(dir === 0 ? t.flyV : t.flyO, 0);
  else {
    if (trackIs(o, t.flyV)) setDir(0);
    if (trackIs(o, t.flyO)) setDir(1);
  }
}

function robbers(): void {
  runner(O.STURKAS, B_STURKAS, STURKAS, () => st.sDir, (d) => { st.sDir = d; });
  runner(O.LILLKLIPPEN, B_LILL, LILL, () => st.lDir, (d) => { st.lDir = d; });
  const F = O.FJOSOK;
  if (!(st.hit & B_FJOSOK)) {
    if ((!F.track || trackIs(F, FJOSOK.tvatta)) && rnd() > 0x7ef4) F.setTrack(rnd() < 0x4001 ? FJOSOK.titta : FJOSOK.goV, 2);
  } else if (!(st.sit & B_FJOSOK) && (trackIs(F, FJOSOK.goV) || trackIs(F, FJOSOK.titta))) {
    F.setTrack(FJOSOK.tvatta, 1);
    st.sit |= B_FJOSOK;
  }
  const LB = O.LABAS;
  if (!(st.hit & B_LABAS)) {
    if (!LB.track && rnd() > 0x7e90) LB.setTrack(LABAS.naken, 2);
  } else if (!(st.sit & B_LABAS) && !LB.track) {
    LB.setTrack(LABAS.bad, 0);
    st.sit |= B_LABAS;
  }
  const T1 = O.TJEGGE;
  if (!(st.hit & B_TJEGGE)) {
    if (!T1.track && rnd() > 0x7e90) T1.setTrack(TJEGGE.naken, 2);
  } else if (!(st.sit & B_TJEGGE)) {
    if (!T1.track) { T1.setTrack(TJEGGE.bad, 0); st.sit |= B_TJEGGE; }
  } else if (trackIs(T1, TJEGGE.bad) && T1.keyIdx > 15) T1.setTrackFrame(5, false);
}

// ------------------------------------------------------------------ tick

function tick(): void {
  if (!st.active) return;
  st.ticks++;
  if (st.end !== 0) {
    if (st.end !== 1) return;
    if (++st.endCount < 0x51) return;
    st.active = false;
    doDialogAni(0x20c, () => { // "Nu ska jag ..." (Lovis), then 0x432810
      O.SNOBOLL.hide();
      snowballEnded();
    }, null, false);
    st.end = 2;
    return;
  }
  if (st.timer < 1) { st.warned = false; st.hit = 0; st.sit = 0; } else st.timer--;
  if (st.timer < 300 && st.timer > 0 && !sample.playing() && !st.warned) {
    st.warned = true;
    sample.play('EFFEKT_8_888_Allafryser', 0x41, 0x40);
  }
  if (st.sit === 0x1f) {
    if (!st.fadeStarted) { st.fadeStarted = true; mFade(0, 2000); }
    if (mVol() < 2) { mStop(); st.endCount = 0; st.end = 1; }
  }
  ballStep();
  const r = R();
  if (trackIs(r, KAST_STILL)) {
    if (rnd() > 30000) r.setTrackFrame(r.keyIdx ^ 1, false); // breathing
  } else if (!trackIs(r, KAST_SNOBOLL)) r.setTrack(KAST_STILL, 1);
  robbers();
}

registerMinigame({
  mode: 5,
  start: init,
  tick,
  click,
  cursor: () => 'prickaRovare',
  end() { st.active = false; hideStop(BALL()); },
});

devHandle('snowball', { st, win() { st.hit = 0x1f; st.timer = 0x5dc; } });
