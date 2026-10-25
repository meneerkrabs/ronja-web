// Scene 12 GLAENTAN, the glade with the horses (game-logic.md §3.14): fallen birch (shortcut to SKOGEN), the stone with the
// rump-goblins, the injured mare (bandage with the white moss in summer), the two wild horses (Rackarn, Vildtoringen).

import {
  O, T, doDialogAni, dispatch, g, setG, gv, lastDialog, playMusic, registerScene, sample, setPan, usePortal,
  type DoneCb, type SceneScript,
} from '../api.ts';
import { BIRK_TABLES, arrivalPan, birkFollows, birkJoins, hitBirk, syncDialog, syncDispatch, talkToBirkStaged } from '../forest.ts';

const summer = () => !!g(0x8f7);

/** DJUR3 (the mare) idle loop by story state */
function mareLoop() {
  if (!summer()) return;
  if (g(0x901) && g(0x903)) O.DJUR3.loop(T(722));      // DJUR3_12_gen_StillaFrisk
  else if (g(0x901)) O.DJUR3.loop(T(721));             // DJUR3_12_Gen_StillaForband
  else O.DJUR3.loop(T(700));                           // DJUR3_12_514A1_SkadatSto
}

/** the horse's frustrated neigh (FUN_0047aed0 on djur1_12_195a1say1_vildtoringenfrustar) after the camera moved to the mare */
function horseFrustar() {
  setPan(325);
  sample.play('djur1_12_195a1say1_vildtoringenfrustar', 110, 115);
  O.RONJA.standStill(O.RONJA.x, O.RONJA.y, O.RONJA.z, 6);
}

// --- callbacks
/** LAB_00464900: HAND on the birch -> the path to SKOGEN is open */
const cbBirch: DoneCb = (c) => { if (!c) setG(0x904, 1); };
/** LAB_00464910 */
const cbHorses: DoneCb = (c) => {
  if (c) return;
  if (O.RONJA.x > 640) setPan(640);
  O.DJUR1.loop(T(1312)); O.DJUR2.loop(T(758)); // HastarBetar: grazing
  if (lastDialog.event === 352) setG(0x902, 1);
};
/** LAB_004649e0: the moss is applied to the mare */
const cbMoss: DoneCb = (c) => {
  if (c || g(0x901)) return;
  O.RUMPNISSE.setTrack('RUMPNISSE_15_gen_goBackO');
  O.VITMOSSA.holder = O.DJUR3;
  O.REM.holder = O.DJUR3;
  setG(0x901, 1);
  horseFrustar();
};
/** LAB_00464aa0: Birk's "let's go to the cave" talk (MOUTH) */
const cbBirkMouth: DoneCb = (c) => {
  if (c || lastDialog.event !== 343) return;
  usePortal('EXIT_GLAENTAN_to_GROTTANUTE', null, null);
  O.BIRK.walkTo(154, 265, 0, null, -1);
};
/** LAB_00464ae0 */
const cbMare: DoneCb = (c) => {
  if (c) return;
  if (lastDialog.event === 355) {
    const horses = g(0x902);
    setG(0x903, 1);
    O.REM.holder = O.RONJA;
    if (!horses) horseFrustar();
  }
  mareLoop();
};

const script: SceneScript = {
  enter() {
    gv.mapBits |= 0x10;
    playMusic('dls_skogenSommar_40_', 100, 33.33);
    setG(0x8e5, 0);
    if (O.VITMOSSA.holder === O.DJUR3) O.VITMOSSA.holder = null;
    if (!g(0x904)) O.HINDER.setTrack(T(1268)); // HINDER_12_gen_Bjork: the fallen birch
    O.ELD1.setTrack(T(908));                   // HINDER_12_Gen_GlaentSten: the stone
    if (gv.act === 2) {
      O.DJUR1.loop(T(1312)); O.DJUR2.loop(T(758));
    } else if (gv.act === 3 && birkFollows()) {
      if (summer()) { O.DJUR1.loop(T(1312)); O.DJUR2.loop(T(758)); }
      mareLoop();
      if (arrivalPan() < 640) birkJoins(366, 316, 3); else birkJoins(888, 316, 5);
    } else if (gv.act === 3) O.BIRK.hide();
    if (summer()) setG(0x8f8, 1);
    if (g(0x905)) setG(0x906, 1);
  },

  cursor(r, x, y) {
    if (hitBirk(x, y)) return 'hilite';
    switch (r) {
      case 1: return 'NV';
      case 2: return 'N';
      case 3: return g(0x904) ? 'N' : 'normal';
      case 4: return g(0x904) ? 'N' : 'hilite';
      case 5: return 'hilite';
      case 6: return gv.act === 3 && summer() ? 'hilite' : 'normal';
      case 7: return gv.act !== 2 && !summer() ? 'normal' : 'hilite';
      case 8: return summer() ? 'hilite' : 'normal';
      default: return 'normal';
    }
  },

  walk(r, x, y) {
    if (hitBirk(x, y)) return;
    if (r === 1) return usePortal('EXIT_GLAENTAN_to_GROTTANUTE');
    if (r === 2) return usePortal('EXIT_GLAENTAN_to_KAELLAN');
    if ((r === 3 || r === 4) && g(0x904)) return usePortal('EXIT_GLAENTAN_to_SKOGEN');
    O.RONJA.walkTo(x, y, 0, null, -1);
  },

  mouth: (r, x, y) => verb(r, x, y, 0),
  hand: (r, x, y) => verb(r, x, y, 1),
  eye: (r, x, y) => verb(r, x, y, 2),

  useItem(item, r, x, y) {
    if (hitBirk(x, y)) return;
    const R = O.RONJA;
    if (r === 6) {
      // FUN_00465f30: the white moss on the injured mare (summer); any other item: Birk objects
      if (item === O.VITMOSSA && summer()) syncDialog(348, T(701), T(1174), cbMoss);
      else syncDialog(347, T(701), T(1174), cbMare);
    } else if (r === 7) {
      if (gv.act === 2) doDialogAni(332, cbHorses, R, false);       // _12_201A1_geRackarn
      else if (gv.act === 3) doDialogAni(745, cbHorses, R, false);  // _12_639A1_geRackarn
    } else if (r === 8) {
      if (gv.act === 2) doDialogAni(331, cbHorses, R, false);       // _12_199A1_geVildtoringen
      else if (gv.act === 3) doDialogAni(744, cbHorses, R, false);  // _12_638A1_geVildtoringen
    }
  },
};

/** MOUTH / HAND / EYE (FUN_004650c0 / 00465590 / 00465a60) */
function verb(r: number, x: number, y: number, v: 0 | 1 | 2) {
  const R = O.RONJA;
  const stoetT: [number, number] = [701, 1174];       // RONJA_12_217A1_tittaStoet / BIRK_12_206A1_tittaStoet
  const tittaVild: [number, number] = [910, 1157];    // RONJA/BIRK_12_194A1_tittaVildtoringen
  const hastarna: [number, number] = [v === 1 ? 1038 : 910, v === 1 ? 1036 : 1157]; // TaHastarnaA (HAND) / tittaVildtoringen
  if (hitBirk(x, y)) { birk(v); return; }
  switch (r) {
    case 4:
      if (!g(0x904)) dispatch(49, v, v === 1 ? cbBirch : null, R);
      return;
    case 5: dispatch(50, v, null, R); return;
    case 6: {
      if (summer()) {
        const [tr, tb] = stoetT;
        if (g(0x901) && g(0x903)) return syncDispatch(57, v, T(tr), T(tb), cbMare);
        if (g(0x901) && O.VITMOSSA.holder === null && !g(0x903)) return syncDispatch(56, v, T(tr), T(tb), cbMare);
        if (g(0x901)) return syncDispatch(136, v, T(tr), T(tb), cbMare);
        return syncDispatch(53, v, T(tr), T(tb), cbMare);
      }
      return horse(7, v, hastarna, tittaVild); // not summer: falls into the Rackarn logic
    }
    case 7: case 8: return horse(r, v, hastarna, tittaVild);
  }
}

function horse(r: 7 | 8, v: 0 | 1 | 2, hastarna: [number, number], tittaVild: [number, number]) {
  const R = O.RONJA;
  if (g(0x901)) return syncDispatch(55, v, T(hastarna[0]), T(hastarna[1]), cbHorses); // both horses: Hastarna
  if (r === 7) {
    if (summer()) return syncDispatch(142, v, T(tittaVild[0]), T(tittaVild[1]), cbHorses);
    if (gv.act === 2) return dispatch(v === 1 ? 51 : 52, v, cbHorses, R);
    return;
  }
  if (summer()) {
    // HAND: taVildtoringenA / taRackarnA tracks; MOUTH/EYE: tittaVildtoringen
    const t: [number, number] = v === 1 ? [775, 777] : tittaVild;
    syncDispatch(51, v, T(t[0]), T(t[1]), cbHorses);
  }
}

/** Birk (FUN_004650c0 tail): summer: Hastarna/Birk groups; before summer: the companion table */
function birk(v: 0 | 1 | 2) {
  if (summer()) {
    if (g(0x901)) {
      const t: [number, number] = [910, 1157];
      return syncDispatch(58, v, T(t[0]), T(t[1]), null);
    }
    return syncDispatch(54, v, T(701), T(1174), v === 0 ? cbBirkMouth : null);
  }
  talkToBirkStaged(BIRK_TABLES.GLAENTAN, v);
}

registerScene('GLAENTAN', script);
