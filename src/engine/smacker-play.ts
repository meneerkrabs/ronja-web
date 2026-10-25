// Smacker playback into a Surface, synced to the AudioContext clock. Separate from smacker.ts so
// the decoder stays loadable in Node (audio.ts creates an AudioContext at import time).

import { audio } from './audio.ts';
import { onSkip } from './skip.ts';
import { Surface } from './surface.ts';
import type { Smacker } from './smacker.ts';

export interface PlaySmackerOpts {
  /** First / last frame (inclusive) of the range to play. Default: whole file. */
  from?: number;
  to?: number;
  /** Repeat the range until stop() is called. */
  loop?: boolean;
  /** Play audio track 0 (default true). */
  sound?: boolean;
  /** Called after each frame was drawn into the target. */
  onFrame?: (n: number) => void;
}

export interface SmackerPlayback {
  stop: () => void;
  playing: boolean;
  /** Resolves when the range finished (not looping), or when stop()/skip ended it. */
  ended: Promise<void>;
  /** Frame most recently drawn (-1 before the first). */
  frame: number;
}

/** Play frames [from, to] of a Smacker file into `target` at (x, y), with sound. */
export function playSmacker(smk: Smacker, target: Surface, x: number, y: number, opts: PlaySmackerOpts = {}): SmackerPlayback {
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(smk.frameCount - 1, opts.to ?? smk.frameCount - 1);
  const len = Math.max(1, to - from + 1);
  const dur = len / smk.fps;
  const frame = new Surface(smk.width, smk.displayHeight);
  const samples = opts.sound === false ? null : smk.audioSamples(0, from, to);
  let buffer: AudioBuffer | null = null;
  if (samples) {
    buffer = audio.ctx.createBuffer(samples.data.length, samples.data[0].length, samples.rate);
    samples.data.forEach((d, i) => buffer!.copyToChannel(d as Float32Array<ArrayBuffer>, i));
  }
  const t0 = audio.ctx.currentTime + 0.05;
  const sources: AudioBufferSourceNode[] = [];
  let scheduled = -1;
  const schedule = (k: number) => {
    if (!buffer || k <= scheduled) return;
    scheduled = k;
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.master);
    src.start(t0 + k * dur);
    sources.push(src);
  };
  let resolve!: () => void;
  const ended = new Promise<void>((r) => (resolve = r));
  const state: SmackerPlayback = { stop: () => {}, playing: true, ended, frame: -1 };
  schedule(0);
  let last = -1;
  const step = () => {
    if (!state.playing) return;
    const t = audio.ctx.currentTime - t0;
    let n = Math.floor(t * smk.fps);
    if (!opts.loop && n >= len) { state.stop(); return; }
    if (opts.loop && n >= 0) { schedule(Math.floor(n / len) + 1); n %= len; }
    if (n >= 0 && n !== last) {
      smk.frame(from + n, frame);
      target.bitBlt(x, y, frame.width, frame.height, frame, 0, 0);
      last = n;
      state.frame = from + n;
      opts.onFrame?.(from + n);
    }
    requestAnimationFrame(step);
  };
  const unregister = onSkip(() => state.stop());
  state.stop = () => {
    if (!state.playing) return;
    unregister();
    state.playing = false;
    for (const s of sources) { try { s.stop(); } catch { /* not started */ } }
    resolve();
  };
  requestAnimationFrame(step);
  return state;
}
