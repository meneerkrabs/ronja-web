// Global engine context: filled in by engine.ts when the game boots. Modules read it at run time only
// (never at import time), which keeps the module graph free of initialisation-order problems.

import type { GameAssets } from './assets.ts';
import type { GameFiles } from './files.ts';
import type { Display, Form } from '../engine/vcl.ts';

export interface Core {
  assets: GameAssets;
  files: GameFiles;
  display: Display;
  form: Form;
}

export const core = {} as Core;

/** Turn on verbose engine logging with `?debug=1`. */
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
export const dlog = (...a: unknown[]) => { if (DEBUG) console.log('[ronja]', ...a); };
