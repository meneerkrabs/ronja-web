// Decoded game data: subanis.apc (sprite streams, decoded on demand and synchronously, like the
// original which paused its clock while loading), tracks.trk, scene.nfo, language.str, font.
// Handle helpers: S(n) = name of subani HW handle 0x800000+n, T(n) = track HW handle 0x900000+n.

import { ApcArchive, type ApcStream } from '../formats/apc.ts';
import { parseTracks, type Track, type TrackFile } from '../formats/trk.ts';
import { parseSceneNfo, type SceneNfo } from '../formats/scene-nfo.ts';
import { parseLanguage, type LanguageFile } from '../formats/language.ts';
import { BitmapFont } from '../formats/font.ts';
import hwData from '../data/ronja.hw.json';
import { inflateSync } from './inflate.ts';
import type { GameFiles } from './files.ts';

/** One decoded sprite frame: ARGB4444 pixels of the whole stream rectangle. */
export interface Frame {
  px: Uint16Array;
  w: number;
  h: number;
  /** Bounding box of the visible pixels (x0, y0, x1, y1 exclusive) — the frame's source rect when drawn. */
  bbox: [number, number, number, number];
  /** Stream flag 2: opaque rectangle baked with the background (drawn z-tested, unscaled, no alpha). */
  opaque: boolean;
}

export interface SceneMaps {
  w: number;
  /** background, ARGB4444 masked to 0x0FFF (opaque), W x 480 */
  bg: Uint16Array;
  /** background depth buffer (sprites are drawn where depth < Z), W x 480; null if the scene has none */
  z: Uint16Array | null;
  /** floor depth map, W x 480 (0xFFFF = no floor) */
  h: Uint16Array | null;
  /** restriction (walk) map, (W/4) x 120; 0 = blocked */
  r: Uint16Array | null;
  /** info/region map, (W/4) x 120, region id per 4x4 cell */
  i: Uint8Array | null;
}

interface Hw { subanis: string[]; tracks: string[]; directions: string[]; trackCallbacks: Array<{ track: string; fn: number }>; trackFollowUps: Array<[string, string]> }
export const HW = hwData as Hw;

/** Name of subani HW handle n (`S(544)` = cursor "normal"). */
export const S = (n: number): string => HW.subanis[n];
/** Name of track HW handle n. */
export const T = (n: number): string => HW.tracks[n];

const TRIM_BYTES = 350 << 20;

export class GameAssets {
  readonly files: GameFiles;
  readonly apc: ApcArchive;
  readonly tracks: TrackFile;
  readonly nfo: SceneNfo[];
  readonly lang: LanguageFile;
  readonly font: BitmapFont;
  private streams = new Map<string, ApcStream>();
  private frames = new Map<string, (Frame | undefined)[]>();
  private frameBytes = 0;
  /** lower-case follow-up table: track A -> track B */
  readonly followUps = new Map<string, string>();
  private pinned = new Set<string>();

  private constructor(files: GameFiles, apc: ApcArchive, tracks: TrackFile, nfo: SceneNfo[], lang: LanguageFile, font: BitmapFont) {
    this.files = files;
    this.apc = apc;
    this.tracks = tracks;
    this.nfo = nfo;
    this.lang = lang;
    this.font = font;
    for (const [a, b] of HW.trackFollowUps) this.followUps.set(a.toLowerCase(), b.toLowerCase());
  }

  /** Read the core files (subanis.apc 27 MB, tracks.trk, scene.nfo, language.str, font). */
  static async load(files: GameFiles): Promise<GameAssets> {
    const [apcBuf, trkBuf, nfoBuf, langBuf, fntBuf, szBuf] = await Promise.all([
      files.read('subanis/subanis.apc'), files.read('tracks/tracks.trk'), files.read('scene.nfo'),
      files.read('language.str'), files.read('normalFont.fnt'), files.read('normalFont.sz'),
    ]);
    return new GameAssets(files, ApcArchive.parse(apcBuf), parseTracks(trkBuf), parseSceneNfo(nfoBuf), parseLanguage(langBuf), BitmapFont.parse(fntBuf, szBuf));
  }

  /** Track by name (case-insensitive) or HW handle number. */
  track(key: string | number): Track | undefined {
    return this.tracks.byName.get((typeof key === 'number' ? T(key) : key).toLowerCase());
  }

  /** Streams that are never trimmed from the cache (UI). */
  pin(name: string) { this.pinned.add(name.toLowerCase()); }

  /** A sprite stream (all frames, undecoded until asked). null if the name does not exist. */
  stream(name: string): ApcStream | null {
    const k = name.toLowerCase();
    let s = this.streams.get(k);
    if (!s) {
      const e = this.apc.find(name);
      if (!e) return null;
      s = this.apc.loadSync(e, (d) => inflateSync(d, 0));
      this.streams.set(k, s);
      this.frames.set(k, new Array(s.frameCount));
    }
    return s;
  }

  has(name: string): boolean { return !!this.apc.find(name); }

  /** Composed frame `i` of a stream (cached). */
  frame(name: string, i: number): Frame | null {
    const s = this.stream(name);
    if (!s) return null;
    const k = name.toLowerCase();
    const list = this.frames.get(k)!;
    i = Math.max(0, Math.min(s.frameCount - 1, i | 0));
    let f = list[i];
    if (!f) {
      const px = s.renderFrame(i) as Uint16Array;
      const fr = s.frames[i];
      f = { px, w: s.width, h: s.height, bbox: [...fr.bbox] as Frame['bbox'], opaque: (s.streamFlags & 2) !== 0 };
      // the engine uses the whole rect for stream-flag-2 sprites; some frames have an empty bbox
      if (f.bbox[2] <= f.bbox[0] || f.bbox[3] <= f.bbox[1]) f.bbox = [0, 0, 0, 0];
      list[i] = f;
      this.frameBytes += px.byteLength;
    }
    return f;
  }

  /** Drop decoded sprite frames when memory grows (called on scene changes). */
  trim() {
    if (this.frameBytes < TRIM_BYTES) return;
    for (const k of [...this.frames.keys()]) {
      if (this.pinned.has(k)) continue;
      this.streams.delete(k);
      this.frames.delete(k);
    }
    this.frameBytes = 0;
    for (const list of this.frames.values()) for (const f of list) if (f) this.frameBytes += f.px.byteLength;
  }

  /** Load the layers of a scene (`base` e.g. "_2a__###_SceneGFXBorggarden"). */
  sceneMaps(base: string): SceneMaps {
    const bgS = this.stream(base);
    if (!bgS) throw new Error(`scene graphics ${base} missing`);
    const w = bgS.width;
    const bgPx = bgS.renderFrame(0) as Uint16Array;
    const bg = new Uint16Array(bgPx.length);
    for (let i = 0; i < bgPx.length; i++) bg[i] = bgPx[i] & 0xfff;
    const layer = (suffix: string): Uint16Array | Uint8Array | null => {
      const s = this.stream(base + suffix);
      this.streams.delete((base + suffix).toLowerCase());
      this.frames.delete((base + suffix).toLowerCase());
      return s ? s.renderFrame(0) : null;
    };
    const z = layer('Z') as Uint16Array | null;
    const h = layer('H') as Uint16Array | null;
    const r = layer('R') as Uint16Array | null;
    const i = layer('I') as Uint8Array | null;
    this.streams.delete(base.toLowerCase());
    this.frames.delete(base.toLowerCase());
    // row 0 / column 0 of the full-res maps hold packer garbage (0xCDCD)
    for (const m of [z, h]) {
      if (!m) continue;
      for (let x = 0; x < w; x++) if (m[x] === 0xcdcd) m[x] = m[w + x];
      for (let y = 0; y < 480; y++) if (m[y * w] === 0xcdcd) m[y * w] = m[y * w + 1];
    }
    return { w, bg, z, h, r, i };
  }
}
