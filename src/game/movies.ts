// Smacker movies (engine.md §1.5): logo, intro, story clips, outro and credits. While a movie plays the scene is
// not composed and input is ignored (the "Sla over" button ends it); the end callback receives `aborted`.

import { Smacker } from '../engine/smacker.ts';
import { playSmacker } from '../engine/smacker-play.ts';
import { Surface } from '../engine/surface.ts';
import { core } from './core.ts';
import { ui } from './ui.ts';
import { sample } from './audio-game.ts';
import { stopMusic } from './music.ts';

const cache = new Map<string, Promise<ArrayBuffer>>();

/** Start fetching a movie in the background (e.g. the intro while the menu is open). */
export function prefetchMovie(name: string) {
  if (!cache.has(name)) {
    cache.set(name, core.files.read(`smacker/${name}`, true).catch((e) => { cache.delete(name); throw e; }));
    cache.get(name)!.catch(() => {});
  }
}

/**
 * PlaySmackerFile (FUN_0046f840): play `name` (e.g. "intro.smk") with its top-left corner at (x, y) on a black screen
 * (the engine never centres: 512x344 movies use (64, 69), full-screen ones (0, 0)). `end(aborted)` runs afterwards.
 * Movies are forced to 15 fps. Music and samples keep playing unless the caller stops them.
 */
export async function playMovie(name: string, x: number, y: number, end?: (aborted: boolean) => void): Promise<void> {
  let buf: ArrayBuffer;
  try {
    const p = cache.get(name) ?? core.files.read(`smacker/${name}`);
    cache.set(name, p);
    buf = await p;
  } catch (e) {
    console.warn('movie unavailable', name, e);
    end?.(true);
    return;
  }
  const smk = new Smacker(buf.slice(0));
  const surface = new Surface(640, 480);
  const pb = playSmacker(smk, surface, x, y);
  ui.movie = { name, smk, playback: pb, surface };
  ui.coinOpen = false;
  await pb.ended;
  ui.movie = null;
  end?.(false);
}

/** Stop everything audible (used before the credits). */
export function silence() {
  sample.stop();
  stopMusic();
}
