// Mouse and keyboard (CGameDlg message handlers, engine.md §4.1-4.2, 4.5): short click = walk/default, hold on a
// hotspot (red-brown cursor) for 500 ms = verb coin (TA hand / TITTA eye / TALA mouth, selected by direction),
// right button = inventory, ESC = menu. Plus the software cursor.

import { S } from './assets.ts';
import { busy, gv } from './state.ts';
import { ui, CURSORS, type CursorName } from './ui.ts';
import { world } from './world.ts';
import { choiceMinY, choosing, clickChoice, dialogActive, drawChoices } from './dialog.ts';
import { drawInventory, drawHeld, inventoryItems, slotAt, combine, lookAtItem } from './inventory.ts';
import { closeMap, drawMap, mapClick, mapCursor, openMap } from './map.ts';
import { drawMenu, menuClick, menuEscape, openMenu } from './menu.ts';
import type { Renderer } from './render.ts';
import { engineActions, minigameCursor, sceneClick, sceneCursor, useItemOnScene } from './engine.ts';
import { skipMedia } from '../engine/skip.ts';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Engine busy: portal transition / scripted sync bits: input ignored. */
const engineBusy = () => busy.bits !== 0;
const uiLocked = () => !!ui.movie || ui.menuOpen || ui.confirmOpen;

let cursorKind: CursorName = 'normal';

// ------------------------------------------------------------------ pointer

export function onMove(x: number, y: number) {
  ui.mouseX = clamp(x, 0, 639);
  ui.mouseY = clamp(y, 0, 479);
  applyClamps();
}

function applyClamps() {
  let x = ui.mouseX, y = ui.mouseY;
  if (ui.confirmOpen) { x = clamp(x, 220, 420); y = clamp(y, 205, 275); }
  else if (ui.coinOpen) {
    const dx = x - ui.coinX, dy = y - ui.coinY, d = Math.hypot(dx, dy);
    if (d > 50) { x = ui.coinX + (dx / d) * 50; y = ui.coinY + (dy / d) * 50; }
  } else if (choosing()) y = Math.max(y, choiceMinY());
  ui.curX = x; ui.curY = y;
  if (ui.invOpen && !ui.coinOpen && (x <= 15 || x >= 625 || y <= 15 || y >= 465)) { ui.invOpen = false; }
  if (ui.mapOpen && (x < 20 || x > 619 || y < 20 || y > 459)) closeMap();
}

export function onDown(button: 'left' | 'right' | 'middle', x: number, y: number) {
  onMove(x, y);
  if (ui.movie) return;
  if (button === 'right') { rightClick(); return; }
  if (button !== 'left') return;
  const cx = ui.curX, cy = ui.curY;
  if (ui.confirmOpen || ui.menuOpen) { menuClick(cx, cy); return; }
  if (ui.mapOpen) { mapClick(cx, cy); return; }
  if (choosing()) { clickChoice(cx, cy); return; }
  ui.pressPending = true;
  ui.pressTime = performance.now();
}

export function onUp(button: 'left' | 'right' | 'middle', x: number, y: number) {
  onMove(x, y);
  if (button !== 'left') return;
  const wasPending = ui.pressPending;
  ui.pressPending = false;
  if (uiLocked() || ui.dialogBusy || engineBusy()) { ui.coinOpen = false; return; }
  if (ui.coinOpen) { releaseCoin(); return; }
  if (!wasPending) return;
  const pan = world.scene?.pan ?? 0;
  if (!ui.invOpen) {
    if (ui.held) {
      const item = world.objs[ui.held - 1];
      ui.held = 0;
      if (gv.mode === 0) useItemOnScene(ui.curX + pan, ui.curY, item);
    } else sceneClick(ui.curX + pan, ui.curY, 1);
    return;
  }
  // inventory open
  const slot = slotAt(ui.curX, ui.curY);
  const items = inventoryItems();
  if (!ui.held) { if (slot >= 0) ui.held = items[slot].obj.id; return; }
  if (slot >= 0) {
    const held = world.objs[ui.held - 1];
    combine(held, items[slot].obj);
  }
  ui.held = 0;
}

function rightClick() {
  if (uiLocked() || gv.mode !== 0 || engineBusy()) return;
  if (ui.held) { ui.held = 0; return; }
  if (ui.dialogBusy) { ui.invOpen = false; return; }
  if (ui.invOpen) { ui.invOpen = false; return; }
  ui.coinOpen = false; ui.mapOpen = false;
  ui.invOpen = true;
  if (ui.mouseX < 20 || ui.mouseX > 620 || ui.mouseY < 20 || ui.mouseY > 460) { ui.mouseX = 320; ui.mouseY = 240; applyClamps(); }
}

// ------------------------------------------------------------------ verb coin

function openCoin() {
  ui.coinOpen = true;
  ui.coinX = ui.curX; ui.coinY = ui.curY;
}

/** Verb under the cursor relative to the coin centre (0x403510): 0 none, 2 MOUTH (tala), 3 HAND (ta), 4 EYE (titta). */
export function coinVerb(): 0 | 2 | 3 | 4 {
  const dx = ui.curX - ui.coinX, dy = ui.curY - ui.coinY;
  if (Math.hypot(dx, dy) <= 13) return 0;
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a < 0) a += 360;
  if (a >= 330 || a <= 90) return 2;
  if (a <= 210) return 4;
  return 3;
}

function releaseCoin() {
  const verb = coinVerb();
  const cx = ui.coinX, cy = ui.coinY;
  ui.coinOpen = false;
  if (verb === 0) return;
  if (!ui.invOpen) { sceneClick(cx + (world.scene?.pan ?? 0), cy, verb); return; }
  const slot = slotAt(cx, cy);
  const items = inventoryItems();
  if (slot < 0) return;
  const obj = items[slot].obj;
  if (verb === 4) { if (obj.name === 'KARTAN') openMap(); else lookAtItem(obj, 4); } else if (verb === 2) lookAtItem(obj, 2);
  else if (obj.name === 'KARTAN') openMap();
  else {
    // quirk: the slot is taken from the cursor position (up to 50 px above the coin centre)
    const s2 = slotAt(ui.curX, ui.curY);
    if (s2 >= 0) ui.held = items[s2].obj.id;
  }
}

// ------------------------------------------------------------------ keyboard

export function onKey(key: string, ctrl: boolean) {
  if (ctrl && (key === 'q' || key === 'Q')) { engineActions.quit(true); return; }
  if (ui.movie) {
    if (ui.credits && (key === ' ' || key === 'Escape')) skipMedia();
    return;
  }
  if (key !== 'Escape') return;
  if (ui.dialogBusy || gv.mode !== 0) return;
  if (ui.confirmOpen || ui.menuOpen) { menuEscape(); return; }
  openMenu();
}

// ------------------------------------------------------------------ cursor & per-frame update

/** Scene point under the cursor. */
export const scenePoint = () => ({ x: ui.curX + (world.scene?.pan ?? 0), y: ui.curY });

/** Per-frame UI update (0x404f60): choose the cursor and start the verb coin when the hotspot cursor was held for 500 ms. */
export function updateCursor(now: number) {
  ui.dialogBusy = dialogActive();
  applyClamps();
  let kind: CursorName = 'normal';
  if (engineBusy() || (ui.dialogBusy && !choosing())) kind = 'invisible';
  else if (choosing() || ui.menuOpen || ui.confirmOpen) kind = 'normal';
  else if (ui.coinOpen) kind = 'tatita';
  else if (ui.invOpen) kind = slotAt(ui.curX, ui.curY) >= 0 ? 'hilite' : 'normal';
  else if (ui.mapOpen) kind = mapCursor(ui.curX, ui.curY);
  else if (gv.mode !== 0) kind = minigameCursor(ui.curX + (world.scene?.pan ?? 0), ui.curY);
  else {
    const p = scenePoint();
    kind = sceneCursor(p.x, p.y);
  }
  cursorKind = kind;
  if (kind === 'hilite' && ui.pressPending && !ui.coinOpen && gv.mode === 0 && now - ui.pressTime > 500) openCoin();
}

export function drawUi(r: Renderer) {
  drawChoices(r);
  if (ui.invOpen) drawInventory(r);
  if (ui.mapOpen) drawMap(r);
  if (ui.menuOpen || ui.confirmOpen) drawMenu(r);
  if (ui.coinOpen) {
    const v = coinVerb();
    const sub = v === 4 ? 553 : v === 3 ? 551 : v === 2 ? 552 : 550;
    r.drawStream(S(sub), 0, ui.coinX - 58, ui.coinY - 55);
  }
  drawCursor(r);
}

function drawCursor(r: Renderer) {
  const x = ui.curX, y = ui.curY;
  if (ui.held && !ui.menuOpen && !ui.confirmOpen) { drawHeld(r, x, y); return; }
  let kind = cursorKind;
  const pan = world.scene?.pan ?? 0;
  if (kind === 'normal' && gv.mode === 0 && !ui.invOpen && !ui.mapOpen && !ui.menuOpen && !ui.confirmOpen && !ui.coinOpen) {
    const max = (world.scene?.width ?? 640) - 640;
    if (x < 10 && pan > 0) { r.drawStream(S(CURSORS.V.sub), 0, -5, y - 32); return; }
    if (x > 630 && pan < max) { r.drawStream(S(CURSORS.O.sub), 0, 542, y - 32); return; }
  }
  if (kind === 'invisible') return;
  const c = CURSORS[kind];
  r.drawStream(S(c.sub), 0, Math.round(x - c.hx), Math.round(y - c.hy));
}

