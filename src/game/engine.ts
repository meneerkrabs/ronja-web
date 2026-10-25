// The engine proper: boot, SetCurrentScene, click dispatch to the registered scene scripts, minigame framework, the
// main loop (walk step 66 ms, track updates per frame, minigame timer 20 ms, render <= 25 fps) and save/new game/quit.

import { Display, Form } from '../engine/vcl.ts';
import { skipMedia } from '../engine/skip.ts';
import { GameAssets } from './assets.ts';
import { GameFiles } from './files.ts';
import { core } from './core.ts';
import {
  O, createWorld, hideAllObjects, regionAt, setPan, updateCamera, world, type SceneRt,
} from './world.ts';
import { gv, g, setG, winter, resetGVar } from './state.ts';
import { SCENES, type SceneName, type Verb } from './types.ts';
import { minigameFor, runNewGameHandlers, sceneScript, type CursorKind } from './registry.ts';
import { renderer } from './render.ts';
import { ui, type CursorName } from './ui.ts';
import { drawUi, onDown, onKey, onMove, onUp, updateCursor } from './input.ts';
import { dialogActive, choosing, dialogHooks, abortDialog, skipDialogStep, updateDialogSkip, clearChoiceLines } from './dialog.ts';
import { sample, resetMasterVolume, trimSounds } from './audio-game.ts';
import { stopMusic } from './music.ts';
import { playMovie, prefetchMovie, silence } from './movies.ts';
import { audio } from '../engine/audio.ts';

// ------------------------------------------------------------------ scene definitions

/** order of the records in scene.nfo */
const NFO_ORDER: SceneName[] = [
  'SKALLEPERSRUM', 'LOVISMATTISRUM', 'STORASALEN', 'KOKET', 'BORGGARDEN', 'VAPENHUS', 'HELVETESGAPET', 'TORNET', 'UTSIKTSKOGEN',
  'KAELLARE', 'FANGELSEHALOR', 'BORGPORTEN', 'SKOGEN', 'KAELLAN', 'GLAENTAN', 'GLUPAFALLET', 'TJAERNEN', 'GROTTANUTE',
  'GROTTANINNE', 'LABYRINT', 'BRAEDSPEL',
];

/** Name of the scene graphics (variant chosen by story state, as in SetCurrentScene 0x45d650). */
export function sceneGfx(name: SceneName, labyrintRoom = ''): string | null {
  const gfx = (loc: string, n: string) => `_${loc}__###_SceneGFX${n}`;
  switch (name) {
    case 'SKALLEPERSRUM': return gfx('1a', 'SkallePersRum' + (g(0x90f) ? 'KISTAN' : ''));
    case 'LOVISMATTISRUM': return gfx('1b', 'MattisLovis');
    case 'STORASALEN': return gfx('1c', 'StoraSalen');
    case 'KOKET':
      if (!g(0x8d7) || gv.act === 3) return gfx('1d', 'Koket');
      if (gv.act === 2 && g(0x8d5) && g(0x8d6)) return gfx('1d', 'KoketKallarenVINTER');
      return gfx('1d', 'KoketKallaren');
    case 'BORGGARDEN': return gfx('2a', 'Borggarden' + (winter() ? 'VINTER' : ''));
    case 'HELVETESGAPET': return gfx('3', 'Helevtesgapet');
    case 'TORNET': return gfx('4', 'Tornet');
    case 'KAELLARE': return gfx('6', g(0x8ed) ? 'Kallaren' : 'KallarenSlackt');
    case 'FANGELSEHALOR': return gfx('7', g(0x8f5) ? 'Fangelset2' : g(0x8f3) ? 'Fangelset' : 'Fangelset3');
    case 'BORGPORTEN': return gfx('8', 'Borgporten' + (winter() ? 'VINTER' : ''));
    case 'SKOGEN': return gfx('9', gv.act === 2 && g(0x8fc) && !g(0x8d5) && g(0x8e5) ? 'SkogenDIMMA' : 'Skogen');
    case 'KAELLAN': return gfx('10', 'Kaellan');
    case 'GLAENTAN': return gfx('12', 'Glaentan');
    case 'GLUPAFALLET': return gfx('13', 'Forsen');
    case 'TJAERNEN': return gfx('14', 'Tjaernen');
    case 'GROTTANUTE': return gfx('15', 'Grottanute');
    case 'GROTTANINNE': return gfx('16', 'Grottaninne');
    case 'LABYRINT': return gfx('17', 'Labyrint' + labyrintRoom);
    case 'BRAEDSPEL': return gfx('18', 'Braedspel');
    default: return null; // VAPENHUS, UTSIKTSKOGEN: no graphics in the original either
  }
}

const scenePans = new Map<SceneName, number>();

export interface EnterOptions {
  /** reload even if this is the current scene (SetCurrentScene force) */
  force?: boolean;
  /** a minigame scene: no enter script, gVar mode untouched, optional explicit gfx base name */
  minigame?: boolean;
  gfx?: string;
  /** keep a running dialogue chain alive (the original does not end it; track hooks that change scene mid-event, e.g. the forest fog) */
  keepDialog?: boolean;
}

/**
 * SetCurrentScene (engine.md §3.6): silence everything, hide all objects (their tracks end interrupted), load the scene's
 * graphics and maps, run the scene's enter script (mode 0). The scroll is the scene's last one; callers set it with `setPan`.
 */
export function enterScene(name: SceneName, opts: EnterOptions = {}): void {
  if (!opts.force && !opts.minigame && world.scene?.name === name) return;
  if (world.scene) scenePans.set(world.scene.name, world.scene.pan);
  sample.stop();
  stopMusic();
  resetMasterVolume();
  hideAllObjects();
  if (dialogActive() && !opts.keepDialog) abortDialog();
  if (!opts.keepDialog) clearChoiceLines();
  ui.coinOpen = false; ui.invOpen = false; ui.mapOpen = false; ui.pressPending = false;
  const base = opts.gfx ?? sceneGfx(name);
  const idx = NFO_ORDER.indexOf(name);
  const nfo = core.assets.nfo[idx] ?? { focal: 1000, zOffset: 0 };
  let sc: SceneRt;
  if (base) {
    const maps = core.assets.sceneMaps(base);
    sc = { name, id: SCENES[name], width: maps.w, maps, focal: nfo.focal, zOff: nfo.zOffset, pan: scenePans.get(name) ?? 0, gfx: base };
  } else {
    const w = 640;
    sc = {
      name, id: SCENES[name], width: w, focal: nfo.focal, zOff: nfo.zOffset, pan: 0, gfx: '',
      maps: { w, bg: new Uint16Array(w * 480), z: null, h: null, r: null, i: null },
    };
  }
  world.scene = sc;
  world.path.setMap(sc.maps.r, sc.width);
  core.assets.trim();
  trimSounds();
  if (!opts.minigame) {
    gv.scene = SCENES[name];
    const script = sceneScript(name);
    try { script?.enter?.(); } catch (e) { console.error(`enter script of ${name} failed`, e); }
  }
}

// ------------------------------------------------------------------ click dispatch (CursorCallback_NormalGame)

function regionFor(name: SceneName, x: number, y: number): number {
  const r = regionAt(x, y);
  return sceneScript(name)?.remap?.(r) ?? r;
}

/** Click at scene point (x, y) with verb 1 (walk) or 2/3/4 from the verb coin. Mode 0 uses the scene script, minigames their own handler. */
export function sceneClick(x: number, y: number, verb: Verb): void {
  if (gv.mode !== 0) { minigameFor(gv.mode)?.click?.(x, y); return; }
  const sc = world.scene;
  if (!sc) return;
  const script = sceneScript(sc.name);
  const region = regionFor(sc.name, x, y);
  const h = verb === 1 ? script?.walk : verb === 2 ? script?.mouth : verb === 3 ? script?.hand : script?.eye;
  if (h) h.call(script, region, x, y);
  else if (verb === 1) O.RONJA.walkTo(x, y, 0, null, -1); // default: walk to the point
}

/** Item dropped on the scene (FUN_0046a4c0). */
export function useItemOnScene(x: number, y: number, item: (typeof world.objs)[number]): void {
  const sc = world.scene;
  if (!sc || gv.mode !== 0) return;
  const script = sceneScript(sc.name);
  script?.useItem?.(item, regionFor(sc.name, x, y), x, y);
}

/** Cursor function of the current scene. */
export function sceneCursor(x: number, y: number): CursorName {
  const sc = world.scene;
  if (!sc) return 'normal';
  const script = sceneScript(sc.name);
  const k: CursorKind = script?.cursor ? script.cursor(regionFor(sc.name, x, y), x, y) : 'normal';
  return k;
}

export function minigameCursor(x: number, y: number): CursorName {
  const mg = minigameFor(gv.mode);
  return (mg?.cursor?.(x, y) ?? 'normal') as CursorName;
}

// ------------------------------------------------------------------ minigames

let activeMinigame = 0;
let mgAcc = 0;

/** Start minigame `mode` (1..8): loads its scene graphics, disables the normal UI and calls `start(args)`. */
export function startMinigame(mode: number, args?: unknown, scene?: SceneName, gfx?: string): void {
  const mg = minigameFor(mode);
  if (!mg) { console.warn(`minigame ${mode} not registered`); return; }
  const sceneOfMode: Record<number, SceneName> = { 1: 'GLUPAFALLET', 2: 'TJAERNEN', 3: 'BORGPORTEN', 4: 'LABYRINT', 5: 'BORGPORTEN', 6: 'GROTTANUTE', 7: 'GLUPAFALLET', 8: 'BRAEDSPEL' };
  const gfxOfMode: Record<number, string> = { 3: '_8__###_SceneGFXBorgportenVINTER', 5: '_8__###_SceneGFXBorgportenVINTER' };
  gv.mode = mode;
  activeMinigame = mode;
  mgAcc = 0;
  enterScene(scene ?? sceneOfMode[mode], { minigame: true, force: true, gfx: gfx ?? gfxOfMode[mode] });
  mg.start(args);
}

/** End the running minigame: calls its `end`, resets the mode to 0. The caller then switches scene. */
export function endMinigame(): void {
  const mg = minigameFor(activeMinigame);
  mg?.end?.();
  activeMinigame = 0;
  gv.mode = 0;
}

// ------------------------------------------------------------------ new game / quit / intro

export const engineActions = {
  /** play intro.smk if the game has not started yet (closing the first menu with ESC) */
  startIntro() { if (!g(0x912) && !ui.movie) playIntro(); },
  newGame,
  quit,
};

/** Called when the user wants out: back to the start screen. Set by main.ts. */
export const appHooks: { onExit: () => void } = { onExit: () => {} };

/** The game start sequence after intro.smk (callback 0x45ba30): Mattis' warning in the courtyard. */
export let gameStartHook: () => void = () => {};
export function setGameStartHook(fn: () => void) { gameStartHook = fn; }

/** Play the intro movie, then the game start (BORGGARDEN init, engine.md §1.3). */
export function playIntro() {
  setPan(640);
  playMovie('intro.smk', 64, 69, (aborted) => { void aborted; gameStartHook(); });
}

export function newGame() {
  resetGVar();
  setG(0x911, 1);
  for (const o of world.objs) { o.holder = null; o.hidden = true; o.frame = null; o.track = null; o.endCb = null; o.path = []; }
  ui.held = 0;
  clearChoiceLines();
  runNewGameHandlers();
  enterScene('BORGGARDEN', { force: true });
}

/** Menu "Afsluiten" (credits, then back to the start screen) or Ctrl+Q (immediately). */
export function quit(immediately = false) {
  if (immediately) { silence(); skipMedia(); appHooks.onExit(); return; }
  silence();
  ui.credits = true;
  playMovie('eftertext.smk', 64, 69, () => { ui.credits = false; appHooks.onExit(); });
}

// ------------------------------------------------------------------ main loop

let running = false;
let lastReal = 0;
let walkAcc = 0;
let lastRender = 0;

function frame(now: number) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(1000, now - lastReal));
  lastReal = now;
  if (world.enabled && world.scene) {
    try { tick(dt, now); } catch (e) { logTickError(e); }
  }
  if (now - lastRender >= 40) {
    lastRender = now;
    try { paint(); } catch (e) { logTickError(e); }
  }
}

let tickErrors = 0;
function logTickError(e: unknown) {
  if (tickErrors++ < 20) console.error('game loop error', e);
}

function tick(dt: number, now: number) {
  {
    walkAcc = Math.max(0, Math.min(1000, walkAcc + dt));
    while (walkAcc > 66) {
      O.RONJA.walkStep();
      O.BIRK.walkStep();
      walkAcc -= 66;
    }
    if (gv.mode !== 0) {
      mgAcc = Math.min(mgAcc + dt, 500);
      const mg = minigameFor(gv.mode);
      while (mgAcc >= 20) { mgAcc -= 20; mg?.tick?.(); }
    }
    for (const o of world.objs) {
      try { o.updateTrack(); } catch (e) { logTickError(e); }
    }
    updateCamera();
    updateDialogSkip();
    updateCursor(now);
  }
}

function paint() {
  const form = core.form;
  if (ui.movie) { form.surface.px.set(ui.movie.surface.px); form.invalidate(); return; }
  renderer.renderScene();
  const mg = gv.mode !== 0 ? minigameFor(gv.mode) : undefined;
  mg?.draw?.(renderer);
  drawUi(renderer);
  renderer.present(form.surface.px);
  form.invalidate();
}

// ------------------------------------------------------------------ boot

export interface BootOptions {
  display: Display;
  files: GameFiles;
}

/** What "Sla over" can do right now (Display.skipProvider). */
function skipOffer(): { label: string; action: () => void } | null {
  if (ui.movie) return { label: ui.credits ? 'Sla aftiteling over' : 'Sla film over', action: skipMedia };
  if (dialogActive() && !choosing()) return { label: 'Sla gesprek over', action: skipDialogStep };
  if (cutsceneActive()) return { label: 'Sla over', action: fastForwardCutscene };
  return null;
}

function cutsceneActive(): boolean {
  if (gv.mode !== 0 || ui.menuOpen) return false;
  for (const o of world.objs) if (o.track && o.endCb && (o.trackFlags & 1) === 0 && !o.hidden) return true;
  return false;
}

/** Run the current non-looping tracks (with end callbacks) to their end; hooks and callbacks still fire. */
function fastForwardCutscene() {
  for (const o of world.objs) if (o.track && o.endCb && (o.trackFlags & 1) === 0) o.lastTime -= 600000;
}

export async function bootGame(opts: BootOptions): Promise<void> {
  const { display, files } = opts;
  core.files = files;
  core.display = display;
  files.onProgress = (d, t) => display.progress(d, t);
  core.assets = await GameAssets.load(files);
  world.scene = null;
  scenePans.clear();
  resetGVar();
  Object.assign(ui, { coinOpen: false, invOpen: false, mapOpen: false, menuOpen: false, confirmOpen: false, held: 0, movie: null, credits: false, dialogBusy: false, pressPending: false });
  const A = core.assets;
  // UI streams stay decoded
  for (const n of [539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 555, 556, 557, 558, 559, 560]) A.pin(hwName(n));
  createWorld();
  const form = new Form(display, 640, 480, 'game');
  form.cursor = 'none';
  form.left = 0; form.top = 0;
  form.onMouseDown = (b, _s, x, y) => { void audio.unlock(); onDown(b, x, y); };
  form.onMouseUp = (b, _s, x, y) => onUp(b, x, y);
  form.onMouseMove = (_s, x, y) => onMove(x, y);
  form.onKeyDown = (k, s) => onKey(k, s.ctrl);
  form.show();
  core.form = form;
  dialogHooks.disableUi = () => { ui.dialogBusy = true; ui.coinOpen = false; ui.invOpen = false; ui.pressPending = false; };
  dialogHooks.enableUi = () => { ui.dialogBusy = false; };
  display.skipProvider = skipOffer;
  prefetchMovie('logo.smk');
  prefetchMovie('intro.smk');
  running = true;
  lastReal = performance.now();
  requestAnimationFrame(frame);
}

import { S as hwName } from './assets.ts';

/** Stop the loop (leaving the game). */
export function shutdownGame() {
  running = false;
  silence();
  if (core.form) core.form.hide();
  core.display.skipProvider = null;
}

