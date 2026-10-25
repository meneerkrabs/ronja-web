// Track hooks of the cellar scenes and the remaining castle scenes of acts 2 and 3 (game-logic.md §4.2).

import {
  O, T, TF_KEEP_CB, doDialogAni, gv, g, setG, hook, enterScene, playMovie, setPan, startMinigame, busy,
} from '../api.ts';

// --- KAELLARE: torch lit -> cellar lit, kallare.smk
hook('ronja_6_081a1_tandkallarenb', {
  end: () => {
    setG(0x8ed, 1);
    enterScene('KAELLARE', { force: true });
    O.RONJA.hide();
    playMovie('kallare.smk', 0, 0, () => {
      O.RONJA.followGround = true;
      O.RONJA.standStill(316, 394, 1395, 1);
      O.RONJA.hidden = false;
    });
  },
});
hook('ronja_6_123A1_taHylla', { end: () => setG(0x8db, 1) });
hook('RONJA_6_112A1_TAOST', { key: { 8: () => { O.OST.hide(); O.OST.holder = O.RONJA; } } });
hook('RONJA_6_116A1_TAMOROT', { key: { 8: () => { O.MOROTTER.hide(); O.MOROTTER.holder = O.RONJA; } } });
hook('RONJA_6_128A1_TABRODKAKA', { key: { 8: () => { O.BRODKAKA.hide(); O.BRODKAKA.holder = O.RONJA; setG(0x8f0, 0); } } });

// --- FANGELSEHALOR: lift the stone heap -> fangelse.smk, Birk speaks behind the stone
hook('RONJA_7_132A1Say1_slapaStenar', {
  key: { 1: () => O.HINDER.hide() },
  end: () => {
    setG(0x8f5, 1);
    enterScene('FANGELSEHALOR', { force: true });
    O.RONJA.hide();
    playMovie('fangelse.smk', 0, 0, (aborted) => {
      if (aborted) return;
      const R = O.RONJA;
      R.followGround = true;
      R.standStill(432, 392, 0, 3);
      R.hidden = false;
      setG(0x8e4, 1);
      doDialogAni(256, () => O.BIRK.setTrack(T(693), 1), null, false);
    });
  },
});

// --- STORASALEN: robbers (act 2 winter), Skalle-Per in act 3
hook('SKALLEPER_1C_186A1SAY1_DUARMITT', { start: () => O.RONJA.hide(), end: () => O.RONJA.setTrack(T(1252)) });
hook('RONJA_1C_186A1_SLAPPSKALLEPER', { end: () => O.RONJA.standStill(O.RONJA.x + 5, O.RONJA.y + 10, 0, 1) });
hook('RONJA_1C_044A1_TASTURKAS', { end: () => O.STURKAS.setTrack(T(807)) });
hook('STURKAS_1C_044A1_TASTURKAS', {
  start: () => { busy.bits |= 0x80; },
  end: () => { busy.bits &= ~0x80; O.STURKAS.loop(T(11)); },
});
hook('STURKAS_1c_055A1Say1_RovarnaSkriker', {
  start: () => { O.RONJA.hide(); O.TJEGGE.hide(); O.LABAS.hide(); O.RATTA.holder = null; setG(0x8da, 1); },
  end: () => setPan(0),
});
hook('STURKAS_1C_055A1_ROVAREFLYR', {
  end: () => {
    setPan(640);
    O.RONJA.followGround = true;
    O.RONJA.standStill(941, 336, 0, 3);
    O.RONJA.hidden = false;
    O.STURKAS.hide(); O.TJEGGE.hide(); O.LABAS.hide();
    if (gv.act === 2 && g(0x8d5) && g(0x8d6) && g(0x8d7) && g(0x8d8) && g(0x8da) && g(0x8d9) && !g(0x8de)) {
      O.DJUR1.hide(); O.RONJA.hide();
      startMinigame(5);
    }
  },
});

// --- BORGGARDEN: carrots for the horses -> snowball fight; the ladder down from Hell's Gap
hook('RONJA_2a_096A1Say1_JagKanMata', {
  end: () => { O.RONJA.setTrack(T(1094), TF_KEEP_CB); O.MOROTTER.holder = O.DJUR2; },
});
hook('LILLKLIPPEN_2A_096A1SAY1_KOMMERDUMED', {
  start: () => { O.RONJA.followGround = true; O.RONJA.standStill(374, 468, 0, 7); },
  end: () => {
    O.LILLKLIPPEN.setTrack(T(1112)); O.FJOSOK.setTrack(T(1113)); O.DJUR2.setTrack(T(1114));
    setG(0x8d9, 1);
    if (gv.act === 2 && g(0x8d5) && g(0x8d6) && g(0x8d7) && g(0x8d8) && g(0x8da) && !g(0x8de)) {
      O.DJUR2.hide(); O.LILLKLIPPEN.hide(); O.FJOSOK.hide(); O.RONJA.hide();
      startMinigame(5);
    }
  },
});
hook('RONJA_2A_624A1_GARNERSTEGE', { end: () => { O.RONJA.followGround = true; O.RONJA.standStill(1721, 343, 0, 5); } });
