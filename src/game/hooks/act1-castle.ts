// Track hooks (tracksHWfunc.cpp, game-logic.md §4.2) for the castle scenes of act 1: item pick-ups at a given key of the
// pick-up animation, flags set when a voice line starts/ends, scene changes. A hook fires for whatever object plays the
// track, including the lip-sync tracks of voice lines. Interrupted tracks fire no end hook.

import { O, enterScene, hook, setG } from '../api.ts';

// --- LOVISMATTISRUM
hook('RONJA_1B_542A1_TASKINNREM', { start: () => O.REM.hide(), key: { 8: () => { O.REM.holder = O.RONJA; } } });
hook('MATTIS_1B_021A1SAY2_AHHANSKULLE', {
  end: () => { O.MATTIS.hide(); O.LOVIS.loop('lovis_1b_021A1_LovisSpinner'); setG(0x8e6, 1); },
});
hook('LOVIS_1B_025A1_LOVISGARUT', { end: () => O.LOVIS.hide() });

// --- STORASALEN
hook('RONJA_1C_054A1_TAFNOSKE', { key: { 9: () => { O.FNOSKE.hide(); O.FNOSKE.holder = O.RONJA; } } });
hook('MATTIS_1c_035A3Say2_DuMasteForsta', { start: () => setG(0x8d6, 1) });
hook('MATTIS_1c_035A4Say1_DuForstar', { start: () => setG(0x8d6, 1) });
hook('SKALLEPER_1C_039B1SAY1_VISSTARDET', {
  end: () => { setG(0x8d7, 1); enterScene('KOKET'); O.RONJA.standStill(268, 339, 0, 3); },
});
hook('mattis_1c_442a1say1_aktadejfor', { end: () => O.MATTIS.loop(919) });
// (the speaker's lip-sync track draws the pair: the other speaker is hidden while one talks)
for (const t of ['SKALLEPER_1C_035A2SAY1_DETARMYCKET', 'SKALLEPER_1C_035A3Say1_SkalleFniss', 'SKALLEPER_1C_035A4Say1_JajaMensan', 'SKALLEPER_1C_035A4Say2_DuHarGott']) {
  hook(t, { start: () => O.MATTIS.hide() });
}
for (const t of ['MATTIS_1C_035A2SAY1_DETLATERDU', 'MATTIS_1C_035A3SAY1_NUTIGERDU', 'MATTIS_1C_035A4Say2_JustDet', 'MATTIS_1C_035A4Say3_OmDuInte']) {
  hook(t, { start: () => O.SKALLEPER.hide() });
}

// --- SKALLEPERSRUM
hook('RONJA_1A_017A1_OPPNAKISTA', {
  end: () => {
    setG(0x90f, 1);
    enterScene('SKALLEPERSRUM', { force: true });
    O.RONJA.standStill(470, 422, O.RONJA.z, 7);
  },
});

// --- BORGGARDEN
hook('RONJA_2A_086A1_TASTEGEB', { end: () => { setG(0x8dc, 1); O.STEGE.hide(); } });
hook('RONJA_2A_005A1_taMattisB', { start: () => O.MATTIS.hide() });
hook('RONJA_2A_005A1_taMattisC', { start: () => O.MATTIS.setTrack(961) });
hook('RONJA_2A_009A1_TALOVISB', { start: () => O.LOVIS.hide() });
hook('RONJA_2A_009A1_TALOVISC', { start: () => O.LOVIS.setTrack(957) });
hook('FJOSOK_2A_091A1SAY1_NAMENSERONJA', { start: () => { O.LILLKLIPPEN.hide(); O.DJUR2.hide(); } });
hook('DJUR2_2A_097A1SAY1_IRROHAST', { start: () => { O.LILLKLIPPEN.hide(); O.FJOSOK.hide(); } });
hook('LILLKLIPPEN_2A_097A1SAY1_DENTYCKERINTE', { start: () => { O.DJUR2.hide(); O.FJOSOK.hide(); } });
hook('DJUR2_2A_094A1SAY1_HASTGNAGG', { start: () => { O.LILLKLIPPEN.hide(); O.FJOSOK.hide(); } });
