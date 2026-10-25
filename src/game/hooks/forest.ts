// Track hooks of the forest scenes (tracksHWfunc.cpp, game-logic.md §4.2): SKOGEN (9), KAELLAN (10), GLAENTAN (12),
// GLUPAFALLET (13), TJAERNEN (14).  Follow-up chains (taForsB->C, kastaNatB->C, FyllaVattenA->B, TaHastarnaA..D ...) come from the
// track player's data.

import {
  O, T, BUSY_FISH, BUSY_PORTAL, busy, doDialogAni, enterScene, finishDialog, g, gv, hook, playMovie, quit, sceneIs, setG,
  setPan, stopMusic,
} from '../api.ts';

// ---------------------------------------------------------------- GLUPAFALLET: net and salmon
// the salmon is caught: Birk plays "taForsA", then Ronja "taForsB" (+ the net is used up), then Birk "taForsC" and says #286
hook('BIRK_13_162A1_TAFORSA', { start: () => { busy.bits |= BUSY_FISH; }, end: () => O.RONJA.setTrack(T(1016)) });
hook('BIRK_13_162A1_TAFORSC', {
  end: (o) => { o.standStill(o.x, o.y, 0, 5); busy.bits &= ~BUSY_FISH; doDialogAni(286, null, null, false); },
});
hook('RONJA_13_162A1_TAFORSB', {
  start: () => { O.BIRK.hide(); O.FISKNAT.hide(); },
  end: () => { O.FISKNAT.holder = O.LOVIS; O.LAX.holder = O.RONJA; setG(0x900, 1); O.BIRK.setTrack(T(1316)); },
});
// no salmon yet: the net comes back to the inventory
hook('BIRK_13_165A1_TAFORSA', { start: () => { busy.bits |= BUSY_FISH; }, end: () => O.RONJA.setTrack(T(1019)) });
hook('BIRK_13_165A1_TAFORSC', { end: (o) => { busy.bits &= ~BUSY_FISH; o.standStill(o.x, o.y, 0, 5); } });
hook('RONJA_13_165A1_TAFORSB', {
  start: () => { O.BIRK.hide(); O.FISKNAT.hide(); },
  end: () => { O.FISKNAT.holder = O.RONJA; O.BIRK.setTrack(T(1320)); },
});
hook('RONJA_13_158A1_TANAT', { key: { 8: () => { O.FISKNAT.hide(); O.FISKNAT.holder = O.RONJA; } } });
// the net is cast into the rapids (FISKNAT.holder = MATTIS = "set")
hook('BIRK_13_159A1_KASTANATA', { start: () => { busy.bits |= BUSY_FISH; }, end: () => O.RONJA.setTrack(T(1018)) });
hook('BIRK_13_159A1_KASTANATC', { end: (o) => { busy.bits &= ~BUSY_FISH; o.standStill(o.x, o.y, 0, 5); } });
hook('RONJA_13_159A1_KASTANATB', {
  start: () => O.BIRK.hide(),
  end: () => { O.FISKNAT.holder = O.MATTIS; O.FISKNAT.loop(T(1314)); O.BIRK.setTrack(T(1318)); },
});

// ---------------------------------------------------------------- KAELLAN
hook('RONJA_10_241A1_FYLLAVATTENA', { start: () => { busy.bits |= BUSY_PORTAL; }, end: () => { busy.bits &= ~BUSY_PORTAL; } });
hook('RONJA_10_241A1_FYLLAVATTENB', {
  start: () => { busy.bits |= BUSY_PORTAL; },
  end: () => { setG(0x90e, 1); O.RONJA.standStill(243, 312, 0, 5); busy.bits &= ~BUSY_PORTAL; },
});
hook('RONJA_10_240A1_TAVATTENKARL', { key: { 7: () => O.VATTENKARL.hide() }, end: () => { O.VATTENKARL.holder = O.RONJA; } });
// Mattis at the spring: the ending (outro.smk, then the credits)
hook('MATTIS_10_315A1SAY1_MITTBARN', { start: () => { O.RONJA.setPosition(1000, 1000, 1000); O.RONJA.hide(); } });
hook('MATTIS_10_315A1SAY3_JASOMDU', { start: () => { O.RONJA.setPosition(1000, 1000, 1000); O.RONJA.hide(); } });
hook('MATTIS_10_315A1SAY6_EGENTLIGENKLAOPP', {
  end: () => {
    stopMusic();
    finishDialog(false);
    setPan(0);
    O.RONJA.hide();
    playMovie('outro.smk', 64, 69, () => quit()); // credits (skipping the outro also leads there)
  },
});

// ---------------------------------------------------------------- GLAENTAN
hook('RONJA_12_193A1_TASTEN', { key: { 8: () => O.ELD1.hide(), 12: () => O.ELD1.show() } });
hook('RONJA_12_190A1_TABJORK', { key: { 1: () => O.HINDER.hide() } });
hook('RONJA_12_213A1_FORBINDERSTOET', { start: () => { O.BIRK.hide(); O.DJUR3.hide(); } });
hook('RUMPNISSE_12_213A1SAY1_VOFFORGORDI', {
  end: () => { O.DJUR3.loop(T(721)); O.BIRK.standStill(O.BIRK.x, O.BIRK.y, 0, 7); },
});
hook('RONJA_12_216_TAHASTARNAB', {
  start: () => { setPan(640); O.DJUR1.hide(); },
  key: { 7: () => { O.BIRK.setTrack(T(963)); O.DJUR2.hide(); } },
});
hook('RONJA_12_196A1_TAVILDTORINGENB', {
  start: () => { setPan(640); O.DJUR1.hide(); },
  key: { 5: () => { if (gv.act === 3) { O.BIRK.setTrack(T(776)); O.DJUR2.hide(); } } },
});
hook('BIRK_12_216_TAHASTARNAC', { end: () => { O.DJUR2.loop(T(758)); O.DJUR2.show(); } });
hook('RONJA_12_216_TAHASTARNAC', { end: () => { O.DJUR1.loop(T(1312)); O.DJUR1.show(); } });
hook('BIRK_12_199A1_TARACKARNB', {
  end: () => {
    O.DJUR2.loop(T(758));
    O.BIRK.standStill(1095, 405, 0, 0);
    O.BIRK.walkTo(1155, 380, 0, null, -1);
  },
});
hook('RONJA_12_196A1_TAVILDTORINGENC', { start: () => O.DJUR1.loop(T(1312)) });

// ---------------------------------------------------------------- TJAERNEN
hook('DJUR1_14_178A1_SNUBBLABIRK', { end: () => O.DJUR1.hide() });
hook('RONJA_14_143A1_TAVITMOSSA', { key: { 9: () => { O.VITMOSSA.hide(); O.VITMOSSA.holder = O.RONJA; } } });
// Birk's "tittaBirk" voice line moves Ronja next to him (the same lines play in SKOGEN's fog)
hook('RONJA_14_179A1SAY1_DETDARAR', {
  start: (o) => {
    if (gv.act === 2 && g(0x8fc) && !g(0x8d5) && g(0x8e5) && sceneIs('SKOGEN')) o.setPosition(378, 432, 0);
    else o.setPosition(360, 401, 0);
  },
});

// ---------------------------------------------------------------- SKOGEN (fog)
// "Ronja, Ronja, försvinn…": Mattis' voice calls Ronja away; the fog rescue failed (no flag)
hook('MATTIS_9B_327A1SAY1_RONJARONJAFORSVINNFAR', {
  end: () => { enterScene('BORGPORTEN', { keepDialog: true }); setPan(0); O.RONJA.setTrack(T(1033)); }, // the event goes on (last say) in BORGPORTEN
});
// REM used on Birk in the fog: the underground creatures take Birk away -> BORGPORTEN, Birk saved (g8d5)
hook('BIRK_9B_326A1SAY1_LATERDUDEJ', {
  start: () => { O.RONJA.hide(); O.ELD1.loop(T(1240)); O.ELD2.loop(T(1241)); O.ELD3.loop(T(1242)); },
  end: () => { enterScene('BORGPORTEN', { keepDialog: true }); setPan(0); O.RONJA.setTrack(T(1033)); setG(0x8d5, 1); },
});
