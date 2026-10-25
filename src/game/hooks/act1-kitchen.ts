// Track hooks of the kitchen (KOKET) and the act 1 -> act 2 transition at Hell's Gap (game-logic.md §4.2).

import { O, T, gv, hook, setG, finishDialog, enterScene, setPan, playMovie, playMusic } from '../api.ts';

// pick-ups at key 8/9 of Ronja's pick-up animations
hook('RONJA_1D_058A1_TAFLINTA', { key: { 8: () => { O.FLINTA.hide(); O.FLINTA.holder = O.RONJA; } } });
hook('RONJA_1D_061A1_TAELDSTAL', { key: { 8: () => { O.ELDSTAL.hide(); O.ELDSTAL.holder = O.RONJA; } } });
hook('RONJA_1D_080A1_TAFACKLAN', { key: { 8: () => { O.FACKLA.hide(); O.FACKLA.holder = O.RONJA; } } });
hook('RONJA_1D_064A1_TARATTFALLA', { key: { 9: () => { O.RATTBUR.hide(); O.RATTBUR.holder = O.RONJA; } } });
hook('RONJA_1D_065A1_PLACERATOMRATTFALLA', { key: { 9: () => { O.RATTBUR.setTrack(T(898)); O.RATTBUR.holder = null; } } });
hook('RONJA_1D_066A1_PLACERAOSTRATTFALLA', { key: { 9: () => { O.RATTBUR.setTrack(T(899)); O.RATTBUR.holder = null; } } });
hook('RONJA_1D_070A1_TARATTA', { key: { 9: () => { O.RATTBUR.hide(); O.RATTBUR.holder = O.RONJA; O.RATTA.holder = O.RONJA; } } });
hook('RONJA_1D_068A1_TALARATTA', { key: { 6: () => O.RATTBUR.hide() } });
hook('RONJA_1D_068A1SAY1_VADGORDUHARLILLARATTA', { key: { 6: () => O.RATTBUR.hide() } });
hook('RATTA_1D_068A1SAY1_VADGORDUHARLILLAROVARDATTER', {
  start: () => O.RONJA.hide(),
  key: { 6: () => O.RATTBUR.setTrack(T(900)) },
  end: () => { O.RONJA.standStill(O.RONJA.x, O.RONJA.y, 0, 7); O.RATTA.hide(); },
});
hook('RATTA_1D_432A1SAY1_RATTAPIPER', { end: () => O.RATTA.hide() });

// stove and torch
hook('RONJA_1D_428A1_TANDASPISB', { end: () => { setG(0x8e8, 1); O.ELD1.loop(T(977)); playMusic('dls_eld_40_', 127, 33.33); } });
hook('RONJA_1D_439A1_TANDAFACKLAN', { end: () => setG(0x90d, 1) });
hook('SKALLEPER_1D_077A1_LAMNARFACKLORNA', { end: () => O.FACKLA.setTrack(T(965)) });

// the knife: Lovis takes it
hook('LOVIS_1D_076A1SAY1_VANTALITE', { start: () => O.RONJA.hide() });
hook('LOVIS_1D_076A1_LOVISGARIN', {
  start: () => { setG(0x90c, 1); O.LOVIS.setPosition(O.RONJA.x, O.RONJA.y, O.RONJA.z); O.LOVIS.setTrack(T(555)); },
});
hook('lovis_1d_076a1_lovistarkniven', {
  key: { 5: () => { O.KNIV.hide(); O.KNIV.holder = O.LOVIS; O.RONJA.setTrack(15); O.RONJA.setTrack(T(555)); } },
});

// Hell's Gap: rescuing Birk ends act 1 (helvetesgapet.smk, then the great hall in act 2)
hook('ronja_3_106A1Say1_KrangPaDejB', {
  start: () => O.BIRK.hide(),
  end: () => {
    finishDialog(false);
    gv.act = 2;
    setPan(0);
    enterScene('STORASALEN');
    setPan(0);
    O.RONJA.hide();
    playMovie('helvetesgapet.smk', 64, 69, () => {
      O.RONJA.followGround = true;
      O.RONJA.standStill(320, 370, 0, 5);
      setG(0x913, 1);
      playMusic('dls_eld_40_', 127);
    });
  },
});
