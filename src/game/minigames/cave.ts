// Minigame 6: the cave entrance (GROTTANUTE) - defence against the grey dwarves with Birk (game-logic.md §5.6). Ported from Game.exe:
// init FUN_0042a440, tick FUN_0042c8e0, click FUN_0042b380, gradvarg AI FUN_0042b8a0, cone flight FUN_0042bb90, falling cones
// FUN_0042ba60 / FUN_0042a300, the bird witch FUN_0042c3a0, still test FUN_0042a3c0, exit FUN_0042d3f0 (-> story.ts caveDefenceEnded).
// Lost when 5 grey dwarves stand at the rock at once (the manual says 3), won after 23 direct hits (g8df).

import { O, ui, world, registerMinigame, sample, setPan, TF_LOOP, type Obj } from '../api.ts';
import { caveDefenceEnded } from '../story.ts';
import {
  Swarm, bgDepth, rectDepth, effect, ajEffect, hideStop, landed, mFade, mPlay, mStop, mVol, rnd, trackIs, type Slot,
} from './_mg.ts';

const R = () => O.RONJA;
const B = () => O.BIRK;
const W = () => O.RUMPNISSE;

// (walk, fall, stamp, roll) handles per slot, FUN_0042c8e0
const SLOT_DEFS: Array<[keyof typeof O, number, number, number, number]> = [
  ['DJUR1', 0x290, 0x29c, 0xca, 0x294],
  ['DJUR2', 0x291, 0x29c, 0xca, 0x294],
  ['DJUR3', 0x292, 0x29c, 0xca, 0x294],
  ['GRADVARG', 0x293, 0x29c, 0xca, 0x294],
  ['STURKAS', 0x28e, 0x297, 0xc7, 0x296],
  ['TJEGGE', 0x28f, 0x29b, 0xb9, 0x295],
  ['LABAS', 0x281, 0x299, 0xc8, 0x28d],
  ['SKALLEPER', 0x283, 0x299, 0xc8, 0x28d],
  ['LILLKLIPPEN', 0x288, 0x29a, 0xc9, 0x28c],
  ['FJOSOK', 0x28a, 0x298, 0xba, 0x28b],
];

// the falling cones the bird witch drops: (ramlar k, x, y, z, target slot + 1) per slot at the rock
const RAIN: Array<[number, number, number, number, number, number]> = [
  [0, 0, 220, 120, 970, 1], [1, 0, 225, 130, 950, 2], [2, 0, 215, 135, 970, 3], [3, 1, 210, 145, 1100, 4],
  [4, 2, 360, 135, 870, 5], [5, 1, 225, 125, 1200, 6], [7, 1, 240, 140, 1180, 8], [8, 2, 380, 140, 1080, 9],
];
type Drop = [number, number, number, number, number];
const RAIN_SETS: Drop[][] = [
  [[0, 215, 135, 970, 3], [1, 225, 125, 1200, 6], [2, 380, 140, 1080, 9]],
  [[0, 225, 130, 950, 2], [1, 210, 145, 1100, 4], [2, 360, 135, 870, 5]],
  [[0, 220, 120, 970, 1], [1, 240, 140, 1180, 8], [2, 250, 150, 880, 3]],
];

const st = {
  active: false,
  /** +0x464 */
  phase: 0x14,
  /** +0x480 Birk's cone, +0x484 Ronja's cone: 0 ready, 1 flying, 2 landed */
  cone: [0, 0],
  /** +0x49c Birk's / +0x450 Ronja's posture: 0 near (SV / SO), 1 far (NV / NO) */
  post: [0, 0],
  vx: [0, 0], vy: [0, 0], vz: [0, 0],
  /** witch: +0x488 phase, +0x48c counter */
  wPhase: 0, wCount: 0,
  /** +0x490.. the slot (+1) each falling cone aims at */
  target: [0, 0, 0],
  /** +0x4a0 wait, +0x374 counter, +0x370 music fade started */
  wait: 0, counter: 0, fadeStarted: false,
};
let swarm: Swarm;

const phase = () => st.phase;
const setPhase = (p: number) => { st.phase = p; };
const ramlar = (): Obj[] => [O.MATTIS, O.LOVIS, O.VILDVITTRA];
const coneObj = (k: number): Obj => (k === 0 ? O.SNOBOLL : O.KOTTE);
const thrower = (k: number): Obj => (k === 0 ? B() : R());

/** FUN_0042a3c0: the thrower has no track or one of its two "still aiming" tracks. */
function still(k: number): boolean {
  const o = thrower(k);
  if (!o.track) return true;
  return k === 1 ? trackIs(o, 0x2d6) || trackIs(o, 0x2d5) : trackIs(o, 0x2d8) || trackIs(o, 0x2d7);
}

function init(): void {
  swarm = new Swarm(SLOT_DEFS.map(([n, w, f, s, r]): Slot => ({ obj: O[n], walk: w, fall: f, stamp: s, roll: r })), {
    skip: 9, maxActive: 8, winHits: 22, winPhase: 2, rollFlags: 0xa1,
  });
  st.active = false;
  st.phase = 0x14; st.cone = [0, 0]; st.post = [0, 0]; st.vx = [0, 0]; st.vy = [0, 0]; st.vz = [0, 0];
  st.wPhase = 0; st.wCount = 0; st.target = [0, 0, 0]; st.wait = 0; st.counter = 0; st.fadeStarted = false;
  mStop();
  setPan(0);
  // the scene reload of startMinigame hid everybody: Ronja and Birk stay where they stood (story.ts then walks them to the cave)
  const r = R(), b = B();
  r.followGround = true;
  r.standStill(r.x, r.y, r.z, r.currDirec < 0 ? 5 : r.currDirec);
  b.followGround = true;
  if (b.x === 0 && b.y === 0) b.standStill(274, 368, 0, 5);
  else b.standStill(b.x, b.y, b.z, b.currDirec < 0 ? 5 : b.currDirec);
  st.active = true;
}

// ------------------------------------------------------------------ click (FUN_0042b380)

function click(x: number, y: number): void {
  if (!st.active || st.phase > 0) return;
  const k = x > 309 ? 1 : 0; // Ronja throws to the right of x = 309, Birk to the left
  if (st.cone[k] === 1 || !still(k)) return;
  if (x > 275 && x < 309) x = 275;
  if (x > 308 && x < 343) x = 343;
  let d = 0, div = 512;
  if (x < 181 || x > 449 || y > 65) {
    for (const s of swarm.slots) {
      const z = rectDepth(s.obj, x, y);
      if (z > 0) d = z;
    }
    if (d < 1) {
      d = bgDepth(x, y);
      if (y < 230 && d < 1100) d = 1100;
    }
  } else { // up in the sky: the bird witch
    y = 56; d = 816; div = 640;
  }
  if (d < 0 || d > 3000) d = 3000;
  const p = st.post;
  // near / far hysteresis at 1100
  if (d > 1100 && p[k] === 0) p[k] = 1;
  else if (d < 1100 && p[k] === 1) p[k] = 0;
  let ox: number, oy: number, track: number;
  const oz = k === 1 ? 974 : 989;
  if (k === 1) {
    if (p[1] === 0) { ox = 386; oy = 286; track = 0x280; } else { ox = 370; oy = 292; track = 0x29e; }
  } else if (p[0] === 0) { ox = 250; oy = 298; track = 0x29d; } else { ox = 255; oy = 298; track = 0x2ad; }
  const s = d / world.scene!.focal;
  const dx = (x - ox) * s, dy = (y - oy) * s, dz = d - oz;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const t = (len / div) * 50;
  st.vx[k] = dx / t;
  st.vz[k] = dz / t;
  st.vy[k] = dy / t - len * 0.006666667;
  thrower(k).setTrack(track, 0);
}

// ------------------------------------------------------------------ the bird witch (FUN_0042c3a0)

function dropCone(k: number, x: number, y: number, z: number, target: number): void {
  const o = ramlar()[k];
  if (!o.track && k + 4 < W().keyIdx) {
    o.x = x; o.y = y; o.z = z;
    st.target[k] = target;
    o.setTrack(0x2c9, 0); // Kotte_15_Gen_kotteFall
  }
}

/** Returns true when the witch is out of the way. */
function witch(): boolean {
  const w = W();
  const tr = !!w.track;
  const w0 = st.wPhase;
  if (w0 < 1) {
    if (w0 < 0 || tr) {
      if (w0 < 0 && !tr) {
        if (st.phase > 0) { hideStop(w); return true; }
        if (st.wCount < 0x65) { drift(w); return false; }
        st.wCount = 0; st.wPhase = 0;
        w.setTrack(0x2a8, 0); // goO
      }
      return false;
    }
    if (st.phase > 0) { hideStop(w); return true; }
    if (st.wCount < 0x65) { drift(w); return false; }
    st.wCount = 0; st.wPhase = -1;
    w.setTrack(0x2a2, 0); // goV
    return false;
  }
  if (w0 === 1) {
    if (trackIs(w, 0x2a2) || trackIs(w, 0x2a8)) { // hit while flying: she falls, trilling
      st.wCount = 0;
      w.setTrack(0x2a9, 0);
      return false;
    }
    if (trackIs(w, 0x2a9)) {
      for (const [slot, k, x, y, z, target] of RAIN) {
        if (swarm.state[slot] === 2) dropCone(k, x, y, z, target);
      }
      const set = RAIN_SETS[Math.min(2, Math.floor(rnd() / 0x2aab))];
      for (const [k, x, y, z, target] of set) dropCone(k, x, y, z, target);
      return false;
    }
    if (!tr) {
      if (st.wCount < 0x33) { st.wCount++; return false; }
      w.setTrack(0x2ab, 0x71); // goBackO, 8 plays
      st.wPhase = 2; st.wCount = 0;
    }
    return false;
  }
  if (w0 === 2) {
    if (w.x > 480) { hideStop(w); st.wCount = 0; }
    if (!w.track) st.wPhase = 0;
    return true;
  }
  return false;
}

/** The idle witch is pushed out of sight: moveBy(x, -150, z) with the literal arguments of the original (0x42c4f1). */
function drift(w: Obj): void {
  if (w.y > 0) w.moveRelative(w.x, -150, w.z);
  st.wCount++;
}

/** FUN_0042ba60: a falling cone that reaches the rock knocks its dwarf over (no direct hit). */
function rainStep(k: number): void {
  const t = st.target[k];
  if (t <= 0) return;
  const o = ramlar()[k];
  if (!o.track) { st.target[k] = 0; o.setPosition(-250, -250, 0); return; }
  if (swarm.state[t - 1] === 2 && o.keyIdx > 16) {
    effect('EFFEKT_14_1_gradvargaj', o.x, o.z);
    swarm.state[t - 1] = 3;
    o.setPosition(-250, -250, 0);
    st.target[k] = 0;
  }
}

// ------------------------------------------------------------------ cone flight (FUN_0042bb90)

function flight(k: number): void {
  const c = coneObj(k);
  if (st.cone[k] === 1) {
    st.vy[k] += 0.1962;
    const zOld = c.z;
    c.moveRelative(st.vx[k], st.vy[k], st.vz[k]);
    if (!landed(c, zOld, (x, y) => x < 0 || x > 640 || y < 0 || y > 480)) {
      const w = W();
      if (st.wPhase < 1 && w.z < c.z + 100 && c.z - 100 < w.z && w.x < c.x + 60 && c.x - 60 < w.x && w.y < c.y + 45 && c.y - 45 < w.y) {
        st.cone[k] = 2;
        effect('EFFEKT_14_2_gradvargaj', c.x, c.z);
        hideStop(c);
        c.setPosition(-30, -30, 8300);
        st.wPhase = 1;
      }
      const pan = world.scene?.pan ?? 0;
      for (let i = 0; i < 10; i++) {
        const o = swarm.slots[i].obj;
        if (o.z < c.z + 100 && c.z - 100 < o.z && o.hitTest(Math.trunc(c.x) - pan, Math.trunc(c.y))) {
          st.cone[k] = 2;
          ajEffect(c.x, c.z);
          swarm.hits++;
          hideStop(c);
          c.setPosition(-30, -30, 8300);
          swarm.state[i] = 3;
          return;
        }
      }
      return;
    }
    st.cone[k] = 2;
    if (c.y > 0 && c.y < 640) effect('EFFEKT_14_2_ground', c.x, c.z);
    hideStop(c);
    c.setPosition(-30, 0, 8300);
    return;
  }
  // not flying: ready again when the thrower's track ended, released at its frames 7..13
  const o = thrower(k);
  if (!o.track) { st.cone[k] = 0; return; }
  if (o.keyIdx > 6 && o.keyIdx < 14 && st.cone[k] === 0) {
    st.cone[k] = 1;
    if (k === 1) {
      c.setTrack(0x23b, TF_LOOP);
      if (st.post[1] === 0) c.setPosition(386, 286, 974); else c.setPosition(370, 292, 974);
    } else {
      c.setTrack(0x23c, TF_LOOP);
      if (st.post[0] === 0) c.setPosition(250, 298, 989); else c.setPosition(255, 298, 989);
    }
  }
}

// ------------------------------------------------------------------ aim postures (tick FUN_0042c8e0)

function aim(): void {
  const mx = ui.curX, my = ui.curY;
  if (mx < 310) { // Birk
    if (!still(0) || st.cone[0] !== 0) return;
    if (my > 280) {
      if (st.post[0] !== 0) { st.post[0] = 0; B().setTrack(0x2d8, 0); }
      return;
    }
    if (mx < 181 || my > 65) { // not in the sky zone: NV
      if (st.post[0] !== 0) return;
      st.post[0] = 1;
      B().setTrack(0x2d7, 0);
    } else if (st.post[0] !== 0) { st.post[0] = 0; B().setTrack(0x2d8, 0); }
  } else { // Ronja
    if (!still(1) || st.cone[1] !== 0) return;
    if (my > 280) {
      if (st.post[1] !== 0) { st.post[1] = 0; R().setTrack(0x2d6, 0); }
      return;
    }
    if (mx < 450 && my < 66) { // the sky: SO
      if (st.post[1] === 0) return;
      st.post[1] = 0;
      R().setTrack(0x2d6, 0);
    } else {
      if (st.post[1] !== 0) return;
      st.post[1] = 1;
      R().setTrack(0x2d5, 0);
    }
  }
}

// ------------------------------------------------------------------ tick (FUN_0042c8e0)

function tick(): void {
  if (!st.active) return;
  const r = R(), b = B();
  if (st.phase > 0) {
    if (st.counter < 10000) for (let i = 0; i < 10; i++) swarm.ai(i, phase, setPhase);
    const c = st.counter;
    if (c < 0x15 || c > 9999) { if (c < 0x15) st.counter++; }
    else if (!swarm.anyAnimating()) st.counter = 0x2711;
    if (st.phase === 1) {
      if (!st.fadeStarted) { st.fadeStarted = true; mFade(0, 500); }
      if (mVol() < 1) mStop();
      if (!b.track && !r.track && mVol() < 1 && witch()) {
        mStop();
        st.active = false;
        caveDefenceEnded(false);
        return;
      }
    }
    switch (st.phase) {
      case 2: {
        if (still(0)) b.setTrack(0x2d8, 0);
        if (still(1)) r.setTrack(0x2d6, 0);
        if (!witch()) return;
        if (!st.fadeStarted) { st.fadeStarted = true; mFade(0, 500); }
        if (mVol() > 0) return;
        mStop();
        st.active = false;
        caveDefenceEnded(true); // sets g8df (0x4cf8df)
        return;
      }
      case 0x14:
        if (!sample.playing()) sample.play('gradvargarna_14_319a1say1_gradvargaralla', 100, 0x40);
        st.phase = 0x15;
        return;
      case 0x15:
        if (++st.wait < 0x33) return;
        mPlay('dls_grottan_105_', 100);
        st.phase = 0x16;
        st.wait = 0;
        return;
      case 0x16:
        if (r.track || b.track) return;
        st.phase = 0;
        return;
      default:
    }
    return;
  }
  witch();
  rainStep(0); rainStep(1); rainStep(2);
  for (let i = 0; i < 10; i++) swarm.ai(i, phase, setPhase);
  aim();
  flight(0); flight(1);
  if (st.counter < 11) { st.counter++; return; }
  st.counter = 0;
  if (swarm.atRock() > 4 && still(1) && still(0)) {
    st.phase = 1;
    b.setTrack(0x2b0, 0); // birk_15_gen_Flyr
    r.setTrack(0x494, 0); // RONJA_15_gen_flyr
  }
}

registerMinigame({
  mode: 6,
  start: init,
  tick,
  click,
  cursor: () => 'prickaKotte',
  end() { st.active = false; },
});
