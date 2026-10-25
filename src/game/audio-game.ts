// Sound effects and voices with the original's semantics (engine.md §5): ONE digital sample channel shared by
// voices and effects (a new sound cuts the old one, effects are skipped while anything plays), volume/pan
// 0..127 (pan 64 = centre), a master fade, and files fetched on demand (the game clock is paused meanwhile).

import { audio } from '../engine/audio.ts';
import { core } from './core.ts';
import { pauseClock } from './clock.ts';

/** Output stage shared by samples and music, so the master fade does not fight the ?mute gain of audio.master. */
let fadeNode: GainNode | null = null;
export function outputNode(): GainNode {
  if (!fadeNode) {
    fadeNode = audio.ctx.createGain();
    fadeNode.connect(audio.master);
  }
  return fadeNode;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** Fetch and decode a sound (speech/effect) by name, e.g. "RONJA_2a_003A1Say1_DetDarArMattis". Cached. */
export function loadSound(name: string): Promise<AudioBuffer | null> {
  const k = name.toLowerCase();
  let p = buffers.get(k);
  if (!p) {
    const path = core.files.sounds.get(k);
    if (!path) {
      console.warn('sound not found:', name);
      p = Promise.resolve(null);
    } else {
      p = core.files.read(path, true).then((b) => audio.decode(b)).catch((e) => { console.warn('sound failed', name, e); return null; });
    }
    buffers.set(k, p);
  }
  return p;
}

/** Start fetching sounds in the background. */
export function prefetchSounds(names: Iterable<string>) {
  for (const n of names) void loadSound(n);
}

/** Release the decoded sound cache when it grows (scene change). */
export function trimSounds() {
  if (buffers.size > 400) buffers.clear();
}

class SampleChannel {
  private src: AudioBufferSourceNode | null = null;
  /** name of the sound on the channel (playing or loading) */
  name: string | null = null;
  private endAt = 0;
  private loading = false;
  private gen = 0;

  /** playSample (FUN_0047aed0): `loops` extra repeats (0 = once). A different/same sound restarts the channel. */
  play(name: string, vol = 100, pan = 64, loops = 0): void {
    this.stop();
    const gen = ++this.gen;
    this.name = name;
    const k = name.toLowerCase();
    const cached = buffers.get(k);
    this.loading = true;
    this.endAt = Infinity;
    // not decoded yet: the game clock stands still until it is (the original paused it around file reads)
    const release = pauseClock();
    loadSound(name).then((buf) => {
      release();
      if (gen !== this.gen) return;
      this.loading = false;
      if (!buf) { this.endAt = 0; return; }
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loops > 0 || loops < 0;
      const gain = audio.ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(127, vol)) / 127;
      const pn = audio.ctx.createStereoPanner();
      pn.pan.value = (Math.max(0, Math.min(127, pan)) - 64) / 64;
      src.connect(gain).connect(pn).connect(outputNode());
      src.start();
      this.src = src;
      this.endAt = loops > 0 ? performance.now() + buf.duration * 1000 * (loops + 1) : loops < 0 ? Infinity : performance.now() + buf.duration * 1000;
    });
    void cached;
  }

  /** Effects never interrupt a sound; they are skipped while the channel is busy. Returns true if started. */
  effect(name: string, vol = 100, pan = 64): boolean {
    if (this.playing()) return false;
    this.play(name, vol, pan);
    return true;
  }

  /** True while something plays or loads (status 1 of FUN_0047ae70). With a name: that sound is on the channel. */
  playing(name?: string): boolean {
    if (this.name === null) return false;
    if (name !== undefined && this.name.toLowerCase() !== name.toLowerCase()) return false;
    return this.loading || performance.now() < this.endAt;
  }

  stop(): void {
    this.gen++;
    if (this.src) {
      try { this.src.stop(); } catch { /* already stopped */ }
      this.src.disconnect();
    }
    this.src = null;
    this.name = null; this.loading = false; this.endAt = 0;
  }
}

export const sample = new SampleChannel();

let fadeTimer: ReturnType<typeof setInterval> | null = null;
/** Master volume fade (FUN_0047a710): ms <= 0 sets directly; ignored while a fade runs. Volume 0..127. */
export function masterFade(target: number, ms: number) {
  const node = outputNode();
  const t = Math.max(0, Math.min(127, target)) / 127;
  if (ms <= 0) { node.gain.cancelScheduledValues(0); node.gain.value = t; return; }
  if (fadeTimer) return;
  const from = node.gain.value, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const f = Math.min(1, (performance.now() - t0) / ms);
    node.gain.value = from + (t - from) * f;
    if (f >= 1 && fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }, 20);
}
export function resetMasterVolume() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  outputNode().gain.value = 1;
}

/** Positional volume of minigame effects (FUN_0041fdc0): depth z -> 120..8. */
export function depthVol(z: number): number {
  return z < 1000 ? 120 - Math.max(z, 0) / 25 : 88 - (Math.min(z, 3000) - 1000) / 25;
}
