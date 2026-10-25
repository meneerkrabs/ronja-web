// Inventory (engine.md §4.5): the 16 collectable items in a fixed order, listed while their holder is Ronja;
// 5 columns of 70 px slots; combining and looking at items; the held item as cursor.

import { core } from './core.ts';
import { g, gv } from './state.ts';
import { S } from './assets.ts';
import { O, type Obj } from './world.ts';
import { dispatch } from './dialog.ts';
import type { Renderer } from './render.ts';
import { ui } from './ui.ts';

export interface InvSlot { obj: Obj; icon: string }

/** ReturnObjectsInInventory (0x46d180): items in fixed order whose holder is Ronja, with their icon variant. */
export function inventoryItems(): InvSlot[] {
  const out: InvSlot[] = [];
  const has = (o: Obj) => o.holder === O.RONJA;
  const add = (o: Obj, sub: number) => { if (has(o)) out.push({ obj: o, icon: S(sub) }); };
  add(O.BRODKAKA, 1);
  add(O.ELDSTAL, O.FLINTA.holder === O.ELDSTAL ? 38 : 2);
  add(O.FACKLA, g(0x90d) ? 7 : 6);
  add(O.FISKNAT, 10);
  add(O.FLINTA, 3);
  add(O.FNOSKE, 12);
  add(O.KARTAN, 39);
  add(O.LAX, 15);
  add(O.MOROTTER, 16);
  add(O.OST, 21);
  add(O.NYCKEL, 13);
  add(O.RATTA, 22);
  add(O.RATTBUR, O.RATTA.holder === O.RATTBUR ? 25 : O.OST.holder === O.RATTBUR ? 24 : 23);
  add(O.REM, 34);
  add(O.VATTENKARL, g(0x90e) ? 29 : 30);
  add(O.VITMOSSA, 32);
  return out;
}

/** Slot under a screen point (0x403e00, quirks included), or -1. */
export function slotAt(x: number, y: number): number {
  if (!(x > 50 && x < 590 && y > 50 && y < 430)) return -1;
  const slot = Math.trunc((x - 145) / 70) + Math.trunc((y - 65) / 70) * 5;
  return slot >= 0 && slot < inventoryItems().length ? slot : -1;
}

export function drawInventory(r: Renderer) {
  const items = inventoryItems();
  r.drawStream(S(539), 0, 0, 0);
  items.forEach((it, i) => {
    const f = core.assets.frame(it.icon, 0);
    if (!f) return;
    const cx = 180 + 70 * (i % 5), cy = 100 + 70 * Math.floor(i / 5);
    r.drawFrame(f, cx - (f.w >> 1), cy - (f.h >> 1));
  });
}

/** The held item's sprite as cursor (hotspot 32,32). */
export function drawHeld(r: Renderer, x: number, y: number) {
  const it = inventoryItems().find((i) => i.obj.id === ui.held);
  if (!it) return;
  const f = core.assets.frame(it.icon, 0);
  if (f) r.drawFrame(f, x - 32, y - 32);
}

/** Combine two inventory items (FUN_0046a4f0): only two recipes exist; everything else does nothing. */
export function combine(a: Obj, b: Obj): boolean {
  const pair = (x: Obj, y: Obj) => (a === x && b === y) || (a === y && b === x);
  if (pair(O.OST, O.RATTBUR)) { O.OST.holder = O.RATTBUR; return true; }
  if (pair(O.FLINTA, O.ELDSTAL)) { O.FLINTA.holder = O.ELDSTAL; return true; }
  return false;
}

/** EYE/MOUTH on an inventory item (FUN_0046a540): the item's remark. */
export function lookAtItem(o: Obj, verb: 2 | 4) {
  const v = verb === 4 ? 2 : 0;
  const run = (grp: number) => dispatch(grp, v, null, null, true);
  switch (o.name) {
    case 'RATTA': return run(102);
    case 'RATTBUR': return run(O.OST.holder === O.RATTBUR ? 104 : 103);
    case 'NYCKEL': return run(105);
    case 'OST': return run(106);
    case 'FNOSKE': return run(107);
    case 'ELDSTAL': return run(108);
    case 'FLINTA': return run(109);
    case 'FACKLA': return run(g(0x90d) ? 111 : 110);
    case 'MOROTTER': return run(112);
    case 'BRODKAKA': return run(114);
    case 'VATTENKARL': return run(g(0x90e) ? 116 : 115);
    case 'FISKNAT': return run(117);
    case 'LAX': return run(118);
    case 'VITMOSSA': return run(119);
    case 'REM': return run(120);
    case 'KARTAN': return verb === 2 ? run(141) : undefined;
  }
}

export const inventoryAvailable = () => gv.mode === 0;
