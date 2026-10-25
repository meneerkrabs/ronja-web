// Entry point of the game for the app shell.

import type { Display } from '../engine/vcl.ts';
import type { GameFiles } from './files.ts';
import './register-all.ts';
import { appHooks, bootGame, enterScene, shutdownGame } from './engine.ts';
import { O, setPan, world } from './world.ts';
import { gv, setG } from './state.ts';
import { SCENE_NAMES, type SceneName } from './types.ts';
import * as api from './api.ts';

export async function startGame(display: Display, files: GameFiles, onExit: () => void): Promise<void> {
  await bootGame({ display, files });
  appHooks.onExit = () => { shutdownGame(); onExit(); };
  (globalThis as { __ronja?: unknown }).__ronja = { ...api, world, gv, O };
  const q = new URLSearchParams(location.search);
  const jump = q.get('scene')?.toUpperCase() as SceneName | undefined;
  if (jump && SCENE_NAMES.includes(jump)) {
    // dev: skip logo/intro and stand somewhere
    setG(0x911, 1); setG(0x912, 1);
    gv.act = Number(q.get('act') ?? 1);
    for (const f of (q.get('g') ?? '').split(',').filter(Boolean)) setG(parseInt(f, 16), 1); // ?g=8e6,90d sets flags g8e6, g90d
    for (const n of (q.get('inv') ?? '').split(',').filter(Boolean)) { const o = (O as Record<string, typeof O.RONJA>)[n.toUpperCase()]; if (o) o.holder = O.RONJA; } // ?inv=REM,KARTAN
    if (q.has('mapbits')) gv.mapBits = Number(q.get('mapbits')); // ?mapbits=3
    api.devJump(jump, q.has('x') ? Number(q.get('x')) : undefined, q.has('y') ? Number(q.get('y')) : undefined, Number(q.get('dir') ?? 4));
    return;
  }
  enterScene('BORGGARDEN', { force: true });
  void setPan;
}
