// Track hooks of the bear cave (GROTTANUTE, GROTTANINNE) and Lovis' and Lill-Klippen's visits
// (game-logic.md §4.2, §1.2): fire, salmon, summer, the stone block.

import { O, T, hook, setG, playMusic } from '../api.ts';
import { checkSummer } from '../story.ts';

// --- GROTTANUTE: the stone block is pushed aside (Ronja and Birk push, HINDER rolls)
hook('HINDER_15_274C3_TALABIRK', {
  end: () => {
    setG(0x907, 1);
    const R = O.RONJA;
    R.standStill(R.x, R.y, R.z, 3);
    O.BIRK.hidden = false;
    O.BIRK.walkTo(306, 386, 0, null, 3);
  },
});

// --- GROTTANUTE: Lill-Klippen after the summer
hook('RONJA_15_290A1_TALILLKLIPPEN', {
  start: () => O.LILLKLIPPEN.hide(),
  end: () => { O.LILLKLIPPEN.hidden = false; O.RONJA.standStill(O.RONJA.x, O.RONJA.y, O.RONJA.z, 5); },
});

// --- GROTTANUTE: Lovis' visit (#480): speaker and listener alternate in the same spot
for (const t of ['LOVIS_15_296A1Say2_NejBrodFar', 'LOVIS_15_296A1Say3_JaDaSlutar', 'LOVIS_15_296A1Say4_InteNarHan']) {
  hook(t, { start: () => O.RONJA.hide() });
}
for (const t of ['RONJA_15_296A1Say2_JagKommerAldrig', 'RONJA_15_296A1Say3_SkulleHanHoppa', 'RONJA_15_296A1Say4_LovisOmDu']) {
  hook(t, { start: () => O.LOVIS.hide() });
}
hook('LOVIS_15_296A1Say5_NejDetSkulleA', {
  start: () => O.RONJA.hide(),
  end: () => O.RONJA.standStill(230, 444, 0, 5),
});
hook('LOVIS_15_296A1Say5_NejDetSkulleB', { end: () => O.LOVIS.hide() }); // Lovis leaves

// --- GROTTANINNE: laying the tinder, lighting the fire, roasting and eating the salmon
hook('RONJA_16_282A1_LAGGAFNOSKE', { end: () => { O.FNOSKE.holder = O.MATTIS; } }); // tinder used up
hook('ronja_16_283a1_tandafnoskeb', { end: () => { O.ELD1.loop(T(750)); setG(0x90a, 1); } });
hook('BIRK_16_285A1_ataLax', { start: () => O.BIRK.setTrack(T(1273)) });
hook('birk_16_284A1_STEKALAX', { end: () => { O.ELD1.loop(T(751)); setG(0x908, 1); } });
hook('BIRK_16_285A1SAY1_DETVARGOTT', {
  start: () => {
    O.RONJA.hide();
    O.ELD1.loop(T(750));
    playMusic('dls_eld_40_', 127, 33.33);
  },
  end: () => {
    setG(0x90b, 1);
    O.RONJA.hidden = false;
    O.RONJA.setTrack(T(1274)); // ronja_16_285A1_ReserSig
    checkSummer();
  },
});

// The ending hooks (MATTIS_10_315A1SAY1_MITTBARN / SAY3_JASOMDU / SAY6_EGENTLIGENKLAOPP) live in hooks/forest.ts; startEnding() in story.ts does
// the same (outro.smk, credits, start screen).
