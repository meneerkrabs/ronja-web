// Music: the game's XMIDI sequences with their own embedded DLS instrument banks (engine.md §5), played with
// spessasynth (an AudioWorklet synthesiser). One sequence at a time, looping forever; `playMusic` always restarts
// (a scene change kills the music and the new scene's enter script starts it again). Tempo is a percentage
// (AIL_set_sequence_tempo), volume 0..127 (AIL_set_sequence_volume). Falls back to GeneralUser GS if the DLS bank
// cannot be loaded.

import type { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';
import { audio } from '../engine/audio.ts';
import { parseMusic, xmidiToSmf, mlsToDls } from '../formats/music.ts';
import { core } from './core.ts';
import { outputNode } from './audio-game.ts';

interface Engine { synth: WorkletSynthesizer; seq: Sequencer; gain: GainNode }
let enginePromise: Promise<Engine | null> | null = null;
let current: { name: string; gen: number } | null = null;
let gen = 0;
let bankId: string | null = null;
let bankSeq = 0;

async function createEngine(): Promise<Engine | null> {
  try {
    const [{ WorkletSynthesizer, Sequencer }, workletUrl] = await Promise.all([
      import('spessasynth_lib'),
      import('spessasynth_lib/dist/spessasynth_processor.min.js?url').then((m) => m.default),
    ]);
    const ctx = audio.ctx;
    await ctx.audioWorklet.addModule(workletUrl);
    const synth = new WorkletSynthesizer(ctx);
    const gain = ctx.createGain();
    synth.connect(gain);
    gain.connect(outputNode());
    await synth.isReady;
    const seq = new Sequencer(synth);
    return { synth, seq, gain };
  } catch (e) {
    console.warn('music synthesiser unavailable', e);
    enginePromise = null;
    return null;
  }
}

async function fallbackBank(e: Engine, id: string) {
  const url = (await import('../assets/GeneralUser-GS.sf2?url')).default;
  const sf = await fetch(url).then((r) => r.arrayBuffer());
  await e.synth.soundBankManager.addSoundBank(sf, id);
}

/**
 * playMusic (FUN_0047a870): start a tune from sounds/MUSIC.wav (e.g. "dls_borggarden__"), looping.
 * vol 0..127 (default 127), tempo in percent (default 100).
 */
export async function playMusic(name: string, vol = 127, tempoPct = 100): Promise<void> {
  stopMusic();
  const my = ++gen;
  current = { name, gen: my };
  const path = core.files.music.get(name.toLowerCase());
  if (!path) { console.warn('music not found:', name); return; }
  try {
    const buf = await core.files.read(path, true);
    if (my !== gen) return;
    const mf = parseMusic(buf);
    const smf = xmidiToSmf(mf.events);
    enginePromise ??= createEngine();
    const e = await enginePromise;
    if (!e || my !== gen) return;
    // add the new bank first (the synthesiser refuses to delete its last bank), then drop the old one
    const prev = bankId;
    const id = `music${bankSeq++ % 2}`;
    try {
      const dls = mlsToDls(mf.bank);
      await e.synth.soundBankManager.addSoundBank(dls.buffer.slice(dls.byteOffset, dls.byteOffset + dls.byteLength) as ArrayBuffer, id);
    } catch (err) {
      console.warn('DLS bank rejected, using GeneralUser GS', err);
      await fallbackBank(e, id);
    }
    bankId = id;
    if (prev && prev !== id) await e.synth.soundBankManager.deleteSoundBank(prev).catch(() => {});
    if (my !== gen) return;
    e.synth.stopAll(true);
    const loaded = new Promise<void>((r) => {
      e.seq.eventHandler.addEvent('songChange', 'ronja', () => r());
      setTimeout(r, 3000);
    });
    e.seq.loadNewSongList([{ binary: smf.slice().buffer as ArrayBuffer }]);
    await loaded;
    e.seq.eventHandler.removeEvent('songChange', 'ronja');
    if (my !== gen) return;
    e.seq.loopCount = Infinity;
    e.seq.playbackRate = Math.max(0.05, tempoPct / 100);
    e.gain.gain.value = Math.max(0, Math.min(127, vol)) / 127;
    e.seq.play();
  } catch (err) {
    console.warn('playMusic failed', name, err);
  }
}

/** Stop the music (FUN_0047aa60). */
export function stopMusic(): void {
  gen++;
  current = null;
  enginePromise?.then((e) => {
    if (!e) return;
    e.seq.pause();
    e.synth.stopAll(false);
  });
}

/** Name of the tune that is (being) played, or null. */
export const currentMusic = (): string | null => current?.name ?? null;

/** Fade the music volume (FUN_0047aac0): vol 0..127 over ms. */
export function fadeMusic(vol: number, ms: number): void {
  enginePromise?.then((e) => {
    if (!e) return;
    const t = Math.max(0, Math.min(127, vol)) / 127;
    e.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
    e.gain.gain.setValueAtTime(e.gain.gain.value, audio.ctx.currentTime);
    e.gain.gain.linearRampToValueAtTime(t, audio.ctx.currentTime + Math.max(0.01, ms / 1000));
  });
}
