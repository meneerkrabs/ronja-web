// The ESC main menu (engine.md §4.7): Laad spel / Bewaar spel / Nieuw spel / Afsluiten on the parchment picture,
// 4x4 save slots with thumbnails, and the "Weet je het zeker? JA NEE" confirm box.

import { S } from './assets.ts';
import { g } from './state.ts';
import { renderer, type Renderer } from './render.ts';
import { ui } from './ui.ts';
import { applySave, listSaves, readSave, saveSlot, thumbFromB64, type SaveData } from './saves.ts';
import { engineActions } from './engine.ts';

let saves: Array<SaveData | null> = [];

const gameStarted = () => !!g(0x912);

/** Open the menu (0x404230): closes coin/inventory/map and takes a thumbnail of the screen. */
export function openMenu() {
  ui.coinOpen = false; ui.invOpen = false; ui.mapOpen = false;
  ui.thumb = renderer.thumbnail();
  ui.menuOpen = true; ui.menuPage = 0; ui.confirmOpen = false; ui.menuSlot = -1;
}

export function closeMenu() {
  ui.menuOpen = false; ui.confirmOpen = false; ui.menuPage = 0;
}

/** ESC while the menu is open: confirm box -> close it; slot page -> back; main page -> close (the intro starts if the game has not). */
export function menuEscape() {
  if (ui.confirmOpen) { ui.confirmOpen = false; return; }
  if (ui.menuPage !== 0) { ui.menuPage = 0; return; }
  closeMenu();
  if (!gameStarted()) engineActions.startIntro();
}

function openSlots(page: 1 | 2) {
  saves = listSaves();
  ui.menuPage = page;
}

function confirm(kind: number, slot = -1) {
  ui.confirmOpen = true; ui.confirmKind = kind; ui.menuSlot = slot;
}

const inBox = (x: number, y: number, x0: number, y0: number, w: number, h: number) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;

/** Left click while the menu is open (0x405db0). */
export function menuClick(x: number, y: number) {
  if (ui.confirmOpen) {
    const dx = x - 320, dy = y - 240;
    if (dy > 0 && dx < -20) confirmYes();
    else if (dy > 0 && dx > 20) ui.confirmOpen = false;
    return;
  }
  if (ui.menuPage === 0) {
    if (x > 160 && x < 480) {
      if (y > 165 && y < 215) openSlots(1);
      else if (y > 239 && y < 289 && gameStarted()) openSlots(2);
      else if (y > 305 && y < 355) confirm(3);
      else if (y >= 372 && y <= 420) confirm(4);
    }
    return;
  }
  for (let slot = 0; slot < 16; slot++) {
    const c = slot % 4, r = Math.floor(slot / 4);
    if (!inBox(x, y, 141 + 90 * c, 87 + 80 * r, 80, 60)) continue;
    const occupied = !!saves[slot];
    if (ui.menuPage === 1) { if (occupied) confirm(1, slot); }
    else if (occupied) confirm(2, slot);
    else doSave(slot);
    return;
  }
}

function doSave(slot: number) {
  saveSlot(slot, ui.thumb);
  closeMenu();
}

function confirmYes() {
  const kind = ui.confirmKind, slot = ui.menuSlot;
  ui.confirmOpen = false;
  if (kind === 1) {
    const s = readSave(slot);
    closeMenu();
    if (s) applySave(s);
  } else if (kind === 2) doSave(slot);
  else if (kind === 3) { closeMenu(); engineActions.newGame(); } else if (kind === 4) { closeMenu(); engineActions.quit(); }
}

export function drawMenu(r: Renderer) {
  const frame = ui.menuPage === 0 ? (gameStarted() ? 0 : 3) : ui.menuPage;
  r.drawStream(S(540), frame, 0, 0);
  if (ui.menuPage !== 0) {
    saves.forEach((sv, slot) => {
      if (!sv) return;
      const th = thumbFromB64(sv.thumb);
      const px = new Uint16Array(th.length);
      for (let i = 0; i < th.length; i++) px[i] = th[i] | 0xf000;
      r.drawPixels(px, 80, 0, 0, 80, 60, 141 + 90 * (slot % 4), 87 + 80 * Math.floor(slot / 4), true);
    });
  }
  if (ui.confirmOpen) r.drawStream(S(541), 0, 170, 195);
}

export const menuBusy = () => ui.menuOpen;
