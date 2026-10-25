// Registration mechanism for the per-scene logic that was hard-coded in Game.exe: scene enter scripts, click
// handlers per verb, cursor functions, item-use handlers (SceneInitCallback_NormalGame.inl,
// CursorCallback_NormalGame.inl) and minigames. Phase-2 code adds files in src/game/scenes/*.ts,
// src/game/hooks/*.ts and src/game/minigames/*.ts that call these functions; the core never needs to change.

import { registerHook, type Obj } from './world.ts';
import type { Renderer } from './render.ts';
import type { SceneName, Verb } from './types.ts';

/** Cursor shapes a scene's cursor function can return (cursor sub-anis of engine.md §4.2). */
export type CursorKind = 'normal' | 'hilite' | 'N' | 'NO' | 'O' | 'S' | 'V' | 'NV' | 'invisible';

export interface SceneScript {
  /**
   * Enter script (the SceneInitCallback): runs at the end of SetCurrentScene in game mode 0, after all objects were hidden
   * and the scene graphics loaded. Place and show objects, start looping tracks and music, play conditional dialogues.
   */
  enter?(): void;
  /** Rewrite region ids before every handler, e.g. STORASALEN: 11 -> 7 (act 1) or 9, 15 -> 14 or 12. */
  remap?(region: number): number;
  /** Cursor over a region (scene coordinates x, y): default 'normal'. */
  cursor?(region: number, x: number, y: number): CursorKind;
  /** Plain left click (verb 1): exits via usePortal, otherwise walk. Default: walk to the point. */
  walk?(region: number, x: number, y: number): void;
  /** Verb coin MOUTH (tala), HAND (ta), EYE (titta) at the coin's centre; usually dispatch(group, verbIndex, doneCb, O.RONJA). */
  mouth?(region: number, x: number, y: number): void;
  hand?(region: number, x: number, y: number): void;
  eye?(region: number, x: number, y: number): void;
  /** Inventory item dropped on the scene (the "use item" handler). */
  useItem?(item: Obj, region: number, x: number, y: number): void;
}

const scenes = new Map<SceneName, SceneScript>();

/** Register (or extend) the script of a scene. A later call for the same scene replaces the given fields only. */
export function registerScene(name: SceneName, script: SceneScript): void {
  scenes.set(name, { ...scenes.get(name), ...script });
}
export const sceneScript = (name: SceneName): SceneScript | undefined => scenes.get(name);
export const registeredScenes = (): SceneName[] => [...scenes.keys()];

// --------------------------------------------------------------------- minigames

export interface Minigame {
  /** Game mode 1..8 (gVar g8c0). */
  mode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /**
   * Called after the minigame's scene graphics are loaded (see engine `startMinigame`, which hides all objects and
   * disables the normal handlers, the ESC menu, the inventory and the verb coin). Set up objects and state here.
   */
  start(args?: unknown): void;
  /** Every 20 ms of game time (the 50 Hz SCURR timer). */
  tick?(): void;
  /** Any click (all verbs): scene coordinates. */
  click?(x: number, y: number): void;
  /** Cursor: a CursorKind or a minigame cursor name; default 'normal'. */
  cursor?(x: number, y: number): CursorKind | 'forsenHilite' | 'prickaRovare' | 'prickaKotte';
  /** Extra drawing on top of the scene (score displays etc.), before the UI layers. */
  draw?(r: Renderer): void;
  /** Called by `endMinigame()` before the mode is reset to 0. */
  end?(): void;
}

const minigames = new Map<number, Minigame>();
const stubModes = new Set<number>();
/** Register the minigame of a mode. `{ stub: true }` registers a placeholder that never replaces a real implementation. */
export function registerMinigame(mg: Minigame, opts: { stub?: boolean } = {}): void {
  if (opts.stub) { if (!minigames.has(mg.mode)) { minigames.set(mg.mode, mg); stubModes.add(mg.mode); } return; }
  minigames.set(mg.mode, mg);
  stubModes.delete(mg.mode);
}
export const isStubMinigame = (mode: number) => stubModes.has(mode);
export const minigameFor = (mode: number): Minigame | undefined => minigames.get(mode);

// --------------------------------------------------------------------- misc scripting hooks

/** Callbacks run when a (new) game starts, after the gVar reset (reset object holders etc. here). */
const newGameHandlers: Array<() => void> = [];
export function onNewGame(fn: () => void) { newGameHandlers.push(fn); }
export const runNewGameHandlers = () => newGameHandlers.forEach((f) => f());

/** Verb helper type used by scene scripts that implement one handler for all verbs. */
export type VerbHandler = (verb: Verb, region: number, x: number, y: number) => void;

// --------------------------------------------------------------------- track hooks

export interface HookHandlers {
  /** track started (HOOK_START) */
  start?: (o: Obj) => void;
  /** key n became current: `key: { 8: (o) => ... }` */
  key?: Record<number, (o: Obj) => void>;
  /** track ended naturally (HOOK_END) */
  end?: (o: Obj) => void;
}

/**
 * Register a track hook (the 119 effective entries of tracksHWfunc.cpp): story side effects bound to a track by name,
 * fired for whatever object plays it. Interrupted tracks fire no end hook.
 */
export function hook(track: string | number, h: HookHandlers): void {
  registerHook(track, (code, obj) => {
    if (code & 0x100000) h.start?.(obj);
    else if (code & 0x400000) h.key?.[code & 0xffff]?.(obj);
    else if (code & 0x200000) h.end?.(obj);
  });
}
