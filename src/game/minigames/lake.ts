// Minigame 2: the lake (TJAERNEN) - pine cones against the grey dwarves (game-logic.md §5.5). Ported from Game.exe:
// init FUN_0042d4e0, tick FUN_0042efc0, click FUN_0042e450, gradvarg AI FUN_0042e910, witch FUN_0042ead0, aim posture FUN_0042ed90,
// Ronja-still test FUN_0042e3e0, exit FUN_00430130. Lost when 4 grey dwarves stand at the rock at once (the manual says 3),
// won after 21 direct hits (g8dd).

import { O, ui, world, setG, hook, doDialogAni, enterScene, endMinigame, setPan, sample, registerMinigame, TF_LOOP } from '../api.ts';
import { Swarm, bgDepth, rectDepth, effect, ajEffect, hideStop, landed, mFade, mPlay, mStop, mVol, rnd, trackIs, type Slot } from './_mg.ts';

const R = () => O.RONJA;
const KOTTE = () => O.KOTTE;
const WITCH = () => O.VILDVITTRA;

// (walk, fall, stamp, roll) handles per slot, FUN_0042efc0
const SLOT_DEFS: Array<[keyof typeof O, number, number, number, number]> = [
  ['DJUR1', 0x130, 0x144, 0xca, 0x13e],
  ['DJUR2', 0x131, 0x144, 0xca, 0x13e],
  ['DJUR3', 0x132, 0x145, 0xc7, 0x13f],
  ['GRADVARG', 0x133, 0x145, 0xc7, 0x13f],
  ['STURKAS', 0x12a, 0x146, 0xb9, 0x13c],
  ['TJEGGE', 0x12e, 0x142, 0xc8, 0x140],
  ['LABAS', 0x12f, 0x142, 0xc8, 0x140],
  ['SKALLEPER', 0x127, 0x143, 0xc9, 0x141],
  ['LILLKLIPPEN', 0x129, 0x143, 0xc9, 0x141],
  ['FJOSOK', 0x12b, 0x147, 0xba, 0x13d],
];

// Ronja's postures: 4 SO (right, near / low), 3 NO (right, up), 1 SV, 2 NV; track handles of the still-aim and throw tracks
const STILL: Record<number, number> = { 4: 0x2a0, 3: 0x21c, 1: 0x29f, 2: 0x2a1 };
const THROW: Record<number, number> = { 4: 0x169, 3: 0x168, 1: 0x16a, 2: 0x16b };
// cone origin per posture (x, y, z) and its track
const ORIGIN: Record<number, [number, number, number, number]> = {
  4: [374, 198, 1192, 0x23b], 3: [366, 192, 1192, 0x23b], 2: [270, 188, 1192, 0x23c], 1: [260, 198, 1192, 0x23c],
};
const THROW_ORIGIN: Record<number, [number, number]> = { 4: [374, 198], 3: [366, 192], 2: [270, 188], 1: [260, 198] };
const FLY_TRACKS = [0x183, 0x240, 0x27d, 0x23f, 0x23d];

const st = {
  active: false,
  /** +0x448 */
  phase: 0x14,
  /** +0x44c cone: 0 ready, 1 flying, 2 landed */
  cone: 0,
  /** +0x450 posture / near-far */
  post: 0,
  vx: 0, vy: 0, vz: 0,
  /** witch: +0x454 state, +0x458 counter */
  wState: 0, wCount: 0,
  /** +0x45c wait counter, +0x374 win counter, +0x370 music fade started */
  wait: 0, winCount: 0, fadeStarted: false,
};
let swarm: Swarm;

const phase = () => st.phase;
const setPhase = (p: number) => { st.phase = p; };

/** FUN_0042e3e0: Ronja has no track, or one of the four "still aiming" tracks. */
function ronjaStill(): boolean {
  const r = R();
  return !r.track || trackIs(r, 0x2a0) || trackIs(r, 0x21c) || trackIs(r, 0x29f) || trackIs(r, 0x2a1);
}

function init(): void {
  swarm = new Swarm(SLOT_DEFS.map(([n, w, f, s, r]): Slot => ({ obj: O[n], walk: w, fall: f, stamp: s, roll: r })), {
    skip: 6, maxActive: 4, winHits: 20, winPhase: 4, rollFlags: 0x81,
  });
  st.active = false;
  st.phase = 0x14; st.cone = 0; st.post = 0; st.wState = 0; st.wCount = 0; st.wait = 0; st.winCount = 0; st.fadeStarted = false;
  st.vx = st.vy = st.vz = 0;
  mStop();
  setPan(0);
  // the scene reload of startMinigame hid everybody; Ronja stays where she stood
  const r = R();
  r.followGround = true;
  r.standStill(r.x, r.y, r.z, r.currDirec < 0 ? 4 : r.currDirec);
  const k = KOTTE();
  k.setTrack(0x23b, TF_LOOP); // preloaded and hidden (anchor 16,16 comes with the track)
  hideStop(k);
  k.setPosition(-30, 0, 8300);
  st.active = true;
}

// ------------------------------------------------------------------ click

function click(x: number, y: number): void {
  if (!st.active || st.phase > 0 || st.cone === 1 || !ronjaStill()) return;
  if (y < 190) y = 190;
  if (y > 250 && x > 280 && x < 394) x = x < 320 ? 280 : 394;
  let d = 0;
  for (const s of swarm.slots) {
    const z = rectDepth(s.obj, x, y);
    if (z > 0) d = z;
  }
  if (d < 1) d = bgDepth(x, y);
  if (d < 0 || d > 3000) d = 3000;
  // near / far hysteresis at 1250
  if (d > 1250) { if (st.post === 4) st.post = 3; else if (st.post === 1) st.post = 2; }
  else if (d < 1250) { if (st.post === 3) st.post = 4; else if (st.post === 2) st.post = 1; }
  const p = st.post;
  const o = THROW_ORIGIN[p];
  if (!o) return;
  const s = d / world.scene!.focal;
  const dx = (x - o[0]) * s, dy = (y - o[1]) * s, dz = d - 1192;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const t = len * 0.0015625 * 50;
  st.vx = dx / t;
  st.vz = dz / t;
  st.vy = dy / t - len * 0.0033333334;
  R().setTrack(THROW[p], 0);
}

// ------------------------------------------------------------------ witch (FUN_0042ead0) and aim (FUN_0042ed90)

function witch(): void {
  const w = WITCH();
  if (st.wState === 0 && st.phase < 1) {
    if (st.wCount > 200 && rnd() < 300) {
      st.wState = 1; st.wCount = 0;
      const k = Math.floor(rnd() / 0x1999);
      w.setTrack(FLY_TRACKS[Math.min(k, 4)], 0);
    }
  } else if (st.wState === 1 && !w.track) {
    st.wCount = 0; st.wState = 0;
    hideStop(w);
  }
  st.wCount++;
}

function aim(): void {
  if (!ronjaStill() || st.cone !== 0) return;
  const mx = ui.curX, my = ui.curY;
  let want: number;
  if (mx < 321) want = my >= 281 ? 1 : 2;
  else want = my >= 281 ? 4 : 3;
  if (st.post === want) return;
  st.post = want;
  R().setTrack(STILL[want], 0);
}

// ------------------------------------------------------------------ tick (FUN_0042efc0)

function runSlots(): void {
  for (let i = 0; i < 10; i++) swarm.ai(i, phase, setPhase);
}

function tick(): void {
  if (!st.active) return;
  const p = st.phase;
  if (p !== 0) {
    if (p < 1) return;
    if (p <= 3) {
      runSlots();
      // the witch that is still flying flees once
      const w = WITCH();
      if (w.track) {
        if (st.wState === 1) {
          st.wState = 2;
          w.setTrack(trackIs(w, 0x23d) ? 0x2a4 : 0x2a3, 0x41);
        }
      } else if (st.wState === 2) {
        hideStop(w);
      }
    }
    phaseStep();
    return;
  }
  runSlots();
  witch();
  aim();
  // ducking under the witch
  const w = WITCH();
  if (w.x > 280 && w.x < 360 && st.post >= 1) {
    effect('EFFEKT_14_1_ronjaduckar', R().x, R().z);
    R().setTrack(st.post < 3 ? 0x286 : 0x287, 0);
    st.post = 0;
  }
  cone();
  // lost: 4 at the rock
  if (swarm.atRock() * 2 >= 8) {
    hideStop(KOTTE());
    st.phase = 1;
    doDialogAni(0x1fa, () => { st.phase = 9; }, null, false);
  }
}

function cone(): void {
  const k = KOTTE(), r = R();
  if (st.cone === 1) {
    st.vy += 0.1962;
    const zOld = k.z;
    k.moveRelative(st.vx, st.vy, st.vz);
    if (landed(k, zOld, (x, y) => x < 0 || x > 640 || y < 0 || y > 480)) {
      st.cone = 2;
      effect('EFFEKT_14_2_ground', k.x, k.z);
      hideStop(k);
      k.setPosition(-30, 0, 8300);
    } else {
      const pan = world.scene?.pan ?? 0;
      for (let i = 0; i < 10; i++) {
        const o = swarm.slots[i].obj;
        if (o.z < k.z + 100 && k.z - 100 < o.z && o.hitTest(Math.trunc(k.x) - pan, Math.trunc(k.y))) {
          st.cone = 2;
          ajEffect(k.x, k.z);
          swarm.hits++;
          hideStop(k);
          k.setPosition(-30, -30, 8300);
          swarm.state[i] = 3;
          break;
        }
      }
    }
  } else if (!r.track) st.cone = 0;
  else if (r.keyIdx > 6 && r.keyIdx < 14 && st.cone === 0) {
    st.cone = 1;
    effect('EFFEKT_14_1_SlangBoll', r.x, r.z);
    const o = ORIGIN[st.post];
    if (o) {
      k.setTrack(o[3], TF_LOOP);
      k.setPosition(o[0], o[1], o[2]);
    }
  }
}

/** The phase handlers of FUN_0042efc0 (LAB_0042fd18). */
function phaseStep(): void {
  const r = R();
  switch (st.phase) {
    case 1:
      if (!st.fadeStarted) { st.fadeStarted = true; mFade(0, 10000); }
      st.phase = 2;
      return;
    case 2:
      if (mVol() > 0) return;
      mStop();
      st.phase = 3;
      return;
    case 4: {
      const c = st.winCount;
      if (c > 15 && c < 10000) {
        let n = swarm.anyAnimating() ? 1 : 0;
        const w = WITCH();
        if (w.x + 50 > 0 && w.x - 50 < 640 && w.y + 50 > 0 && w.y - 50 < 480 && w.track) n++;
        if (n > 0) return;
        st.winCount = 10001;
        return;
      }
      if (c < 16) { st.winCount = c + 1; return; }
      if (!st.fadeStarted) { st.fadeStarted = true; mFade(0, 1000); }
      if (mVol() > 0) return;
      setG(0x8dd, 1);
      mStop();
      st.phase = 9;
      return;
    }
    case 9:
      r.setTrack(0x425, 0); // klattrarNer
      st.phase = 10;
      return;
    case 10:
      if (r.track) return;
      leave();
      return;
    case 0x14:
      if (!sample.playing()) sample.play('gradvargarna_14_319a1say1_gradvargaralla', 100, 0x40);
      st.phase = 0x15;
      return;
    case 0x15:
      if (++st.wait < 0x65) return;
      mPlay('dls_tjarnen_155_105vol', 0x69);
      st.wait = 0;
      r.walkTo(256, 344, 0, (interrupted) => {
        if (interrupted) return;
        R().setTrack(0x403, 0); // klattrar: up onto the rock
        st.phase = 0x16;
      }, -1);
      return;
    case 0x16:
      if (r.track) return;
      st.phase = 0;
      r.setTrack(0x2a0, 0);
      return;
    default:
  }
}

/** FUN_00430130 + the Ronja placement before it: back to the lake (its enter script starts the ambient music). */
function leave(): void {
  st.active = false;
  const r = R();
  hideStop(KOTTE());
  endMinigame();
  enterScene('TJAERNEN', { force: true });
  setPan(0);
  r.followGround = true;
  r.standStill(256, 344, 0, 5); // RONJA__gen_stillSO
}

// "Mattis: Forsvinn, gradvargar!" (hook 0x451d70 key 4 -> FUN_0042ef40): everything in play falls, phase 2
hook('MATTIS_14_318A1Say1_ForsvinnGradvargar', {
  key: { 4: () => { if (st.active) { swarm.fallAll(); st.phase = 2; } } },
});

registerMinigame({
  mode: 2,
  start: init,
  tick,
  click,
  cursor: () => 'prickaKotte',
  end() { st.active = false; sample.stop(); },
});
