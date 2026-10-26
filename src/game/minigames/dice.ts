// Minigame mode 8: dice "21" with Skalle-Per (BRAEDSPEL). game-logic.md §5.4; init FUN_00427ed0, tick FUN_00429ef0, click FUN_00429e10,
// roll FUN_00429c70, rank FUN_00429cc0, evaluation FUN_00429dc0, result FUN_00428fe0, leave FUN_0042a280.
// Objects: DJUR1/DJUR2 = Ronja's dice, DJUR3/GRADVARG = Skalle-Per's dice, BIRK = lit score engraving.

import { devHandle } from './_mg.ts';
import {
  O, registerMinigame, endMinigame, enterScene, setPan, playMusic, stopMusic, fadeMusic, sample, doDialogAni, lastDialog, hook,
} from '../api.ts';

// FUN_00429590: track handles of the die faces 1..6 (Ronja A/B, Skalle-Per A/B)
const RONJA_A = [806, 823, 825, 827, 829, 831];
const RONJA_B = [822, 824, 826, 828, 830, 832];
const SKP_A = [834, 836, 838, 840, 842, 844];
const SKP_B = [835, 837, 839, 841, 843, 845];
// FUN_00429060: score engraving track by rank 1..21 (poang31 .. poang21)
const MARKER = [0, 1214, 1215, 1217, 1218, 1219, 1221, 1222, 1223, 1224, 1226, 1227, 1228, 1229, 1230, 1211, 1213, 1216, 1220, 1225, 1231, 1212];
// FUN_00429cc0: ranking table (position + 1 = rank)
const RANKING = [0x1f, 0x20, 0x29, 0x2a, 0x2b, 0x33, 0x34, 0x35, 0x36, 0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x0b, 0x16, 0x21, 0x2c, 0x37, 0x42, 0x15];

const T_TITTAR = 732, T_R_A = 734, T_R_B = 821, T_R_C = 987, T_S_A = 730, T_S_B = 833, T_S_C = 988;
const SHAKE = 'EFFEKT_18_1_tarningarskak';

const d = {
  active: false,
  state: -2, // -2 start dialog, -1 dialog, 0 wait for click, 1 Ronja rolls, 2 Skalle-Per rolls, 3 again, 5..8 leave, 10 result dialog
  rank: 0, sub: 0, timer: 0,
  ronjaCup: false, skpCup: false, // cup raised (FUN_00428ec0 / FUN_00428f30 only act when set)
};

const rnd = (): number => Math.floor(Math.random() * 32768);

/** FUN_00429bb0 / FUN_00429c10 */
function hideRonjaDice(): void { O.DJUR1.hide(); O.DJUR2.hide(); }
function hideSkpDice(): void { O.DJUR3.hide(); O.GRADVARG.hide(); }

/** FUN_00428ec0: Ronja's cup goes back */
function ronjaCupDown(): void {
  if (!d.ronjaCup) return;
  O.RONJA.setTrack(T_R_C, 0);
  d.ronjaCup = false;
}
/** FUN_00428f30: Skalle-Per's cup goes back, his dice vanish */
function skpCupDown(): void {
  if (!d.skpCup) return;
  O.SKALLEPER.setTrack(T_S_C, 0);
  hideSkpDice();
  d.skpCup = false;
}

function showMarker(rank: number): void {
  if (rank === 0) { O.BIRK.hide(); O.BIRK.stopTrack(); return; }
  O.BIRK.setTrack(MARKER[rank], 0);
}

/** FUN_00429c70 + FUN_00429590 + FUN_00429cc0: roll two dice, show them, return the rank against the previous one (0 = not higher) */
function roll(isRonja: boolean): number {
  const a = (rnd() % 6) + 1, b = (rnd() % 6) + 1;
  if (isRonja) { O.DJUR1.setTrack(RONJA_A[a - 1], 0); O.DJUR2.setTrack(RONJA_B[b - 1], 0); }
  else { O.DJUR3.setTrack(SKP_A[a - 1], 0); O.GRADVARG.setTrack(SKP_B[b - 1], 0); }
  const value = a > b ? a * 10 + b : b * 10 + a;
  const r = RANKING.indexOf(value) + 1;
  return r <= d.rank ? 0 : r;
}

/** FUN_00428fe0: the result dialog. ronjaLoses: event 509 (she loses) or 511 (she wins) */
function result(ronjaLoses: boolean): void {
  if (ronjaLoses) { ronjaCupDown(); hideSkpDice(); } else { skpCupDown(); hideRonjaDice(); }
  d.state = 10;
  doDialogAni(ronjaLoses ? 509 : 511, () => {
    // 509 alt 156 / 512: play again; 510 / 513: leave
    const ev = lastDialog.event;
    d.state = ev === 510 || ev === 513 ? 5 : 3;
  }, null);
}

/** FUN_00429dc0: returns the rank when the game goes on, else 0 (the result dialog started) */
function evaluate(rank: number, isRonja: boolean): number {
  if (rank < 1) { result(isRonja); return 0; }
  if (rank > 20) { skpCupDown(); ronjaCupDown(); result(!isRonja); return 0; }
  return rank;
}

function start(): void {
  d.active = false;
  d.state = -2; d.rank = 0; d.sub = 0; d.timer = 0; d.ronjaCup = false; d.skpCup = false;
  setPan(0);
  for (const o of [O.DJUR1, O.DJUR2, O.DJUR3, O.GRADVARG, O.BIRK]) o.hide();
  void playMusic('dls_spelaTarning_150_', 80, 125);
  O.RONJA.setTrack(T_TITTAR, 0);
  O.ELD1.loop(1204);
  O.ELD2.loop(1205);
  d.active = true;
}

function click(x: number, y: number): void {
  if (!d.active || d.state !== 0) return;
  if (x < 330 || x > 330 + 115 || y < 240 || y > 240 + 120) return;
  skpCupDown();
  O.RONJA.setTrack(T_R_A, 0);
  sample.effect(SHAKE, 100, 95);
  d.ronjaCup = true;
  d.state = 1;
}

function cursor(x: number, y: number): 'normal' | 'forsenHilite' {
  return d.active && d.state === 0 && x >= 330 && x <= 445 && y >= 240 && y <= 360 ? 'forsenHilite' : 'normal';
}

function tick(): void {
  if (!d.active) return;
  const R = O.RONJA, S = O.SKALLEPER;
  switch (d.state) {
    case -2:
      d.state = -1;
      doDialogAni(508, (cancelled) => { if (!cancelled) d.state = 0; }, null);
      return;
    case -1: case 0: case 10: return;
    case 1: {
      if (R.playing === null) {
        if (d.sub === 0) {
          d.rank = roll(true);
          d.sub = 1;
          R.setTrack(T_R_B, 0);
          return;
        }
        if (d.sub === 1) { d.sub = 2; return; }
      }
      if (d.sub !== 2) return;
      if (d.timer > 99) {
        d.timer = 0; d.sub = 0;
        if (evaluate(d.rank, true) < 1) return;
        d.state = 2;
        ronjaCupDown();
        S.setTrack(T_S_A, 0);
        d.skpCup = true;
        sample.effect(SHAKE, 100, 34);
        return;
      }
      break;
    }
    case 2: {
      if (S.playing === null) {
        if (d.sub === 0) {
          d.rank = roll(false);
          d.sub = 1;
          S.setTrack(T_S_B, 0);
          return;
        }
        if (d.sub === 1) { d.sub = 2; return; }
      }
      if (d.sub !== 2) return;
      if (d.timer > 24) {
        d.timer = 0; d.sub = 0;
        if (evaluate(d.rank, false) < 1) return;
        d.state = 0;
        return;
      }
      break;
    }
    case 3:
      showMarker(0);
      d.state = 0; d.rank = 0;
      return;
    case 5:
      fadeMusic(0, 1500);
      d.timer = 0; d.state = 6;
      return;
    case 6: // the original waits until the music volume is 0 (1500 ms = 75 ticks)
      if (++d.timer < 75) return;
      stopMusic();
      d.timer = 0; d.state = 7;
      return;
    case 7:
      if (++d.timer < 51) return;
      d.state = 8;
      return;
    case 8:
      leave();
      return;
    default: return;
  }
  // tail of states 1 and 2: the score engraving shows from tick 11
  d.timer++;
  if (d.timer > 10 && d.rank > 0) showMarker(d.rank);
}

/** FUN_0042a280 */
function leave(): void {
  d.active = false;
  endMinigame();
  enterScene('SKALLEPERSRUM', { force: true });
  setPan(0);
  const R = O.RONJA;
  R.followGround = true;
  R.standStill(320, 300, 0, 5);
  fadeMusic(127, 50);
}

// Ronja's cup goes down (RONJA_18_GEN_SKAKARC marker): her dice vanish (FUN_00428eb0 -> FUN_00429bb0)
hook('RONJA_18_GEN_SKAKARC', { key: { 2: () => hideRonjaDice() } });

registerMinigame({
  mode: 8,
  start,
  tick,
  click,
  cursor,
  end() { d.active = false; sample.stop(); for (const o of [O.DJUR1, O.DJUR2, O.DJUR3, O.GRADVARG, O.BIRK, O.ELD1, O.ELD2]) { o.stopTrack(); o.hide(); } },
});

devHandle('dice', { d });
