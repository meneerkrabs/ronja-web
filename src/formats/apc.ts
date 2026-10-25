// subanis/subanis.apc: the "APC" archive with every sprite animation ("subani"), cursor,
// scene background and scene map of Ronja. See docs/re/formats.md for the byte layout.
//
//   const apc = ApcArchive.parse(bytes);
//   const stream = await apc.load('birk__234_###_syd');    // zlib-inflated animation
//   const frame = stream.renderFrame(3);                    // composed ARGB4444 pixels
//   const { surface, alpha } = argb4444ToSprite(frame, stream.width, stream.height);

import { Reader, inflate, type InflateSync } from './bytes.ts';
import { Surface, rgb } from '../engine/surface.ts';

export const APC_MAGIC_FILE = 0x1000;
export const APC_MAGIC_DIR = 0x1001;
export const APC_MAGIC_STREAM = 0x1002;
export const APC_MAGIC_FRAME = 0x1003;

/** Pixel formats (u32 at stream +0x0c: bpp in the low word, a channel layout in the high word). */
export const APC_GRAY8 = 0x00000008;
export const APC_GRAY16 = 0x00000010;
export const APC_ARGB4444 = 0x44440010;

/** Frame flags (u16 at frame +0x08). */
export const APC_FRAME_DELTA = 1;
export const APC_FRAME_RLE = 2;

/** Serial numbers the engine gives subanis: 0x100000 + directory index (FUN_004506a0). */
export const SUBANI_SERIAL_BASE = 0x100000;

export interface ApcEntry {
  index: number;
  serial: number;
  name: string;
  /** Absolute file offset of the stream header. */
  offset: number;
  size: number;
  width: number;
  height: number;
  format: number;
  frameCount: number;
}

export interface ApcFrame {
  flags: number;
  /** Offset of the frame's pixel data inside ApcStream.data and its byte size. */
  dataOffset: number;
  dataSize: number;
  /** Rectangle the frame data covers (x, y, w, h); delta frames usually cover a band of rows. */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Bounding box (x0, y0, x1 exclusive, y1 exclusive) of the visible pixels of the composed frame
   * (not just this frame's data). Probably used for dirty rects/hit tests.
   */
  bbox: [number, number, number, number];
}

export type ApcPixels = Uint16Array | Uint8Array;

/** One decompressed animation stream. */
export class ApcStream {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly format: number;
  /** u16 at stream +0x14 (0 or 2 in the shipped file; meaning unknown, bit 0 must be clear). */
  readonly streamFlags: number;
  readonly frames: ApcFrame[];
  /** Inflated frame records (frame headers + pixel data). */
  readonly data: Uint8Array;

  private cache: { index: number; px: ApcPixels } | null = null;

  constructor(name: string, header: Reader, data: Uint8Array) {
    this.name = name;
    header.pos = 8;
    this.width = header.u16();
    this.height = header.u16();
    this.format = header.u32();
    const frameCount = header.u16();
    header.u16(); // compression (4 = zlib) on disk
    this.streamFlags = header.u16();
    this.data = data;
    this.frames = [];
    const r = new Reader(data);
    while (r.pos < data.length) {
      const start = r.pos;
      const magic = r.u16();
      r.skip(2);
      const size = r.u32();
      if (magic !== APC_MAGIC_FRAME || size < 0x20 || start + size > data.length) {
        throw new Error(`${name}: bad frame record at ${start}`);
      }
      const flags = r.u16();
      r.skip(2);
      const dataSize = r.u32();
      const x = r.u16(), y = r.u16(), w = r.u16(), h = r.u16();
      const bbox: [number, number, number, number] = [r.u16(), r.u16(), r.u16(), r.u16()];
      if (dataSize !== size - 0x20) throw new Error(`${name}: frame size mismatch`);
      this.frames.push({ flags, dataOffset: start + 0x20, dataSize, x, y, w, h, bbox });
      r.pos = start + size;
    }
    if (this.frames.length !== frameCount) throw new Error(`${name}: ${this.frames.length} frames, header says ${frameCount}`);
  }

  get frameCount(): number { return this.frames.length; }
  get bytesPerPixel(): number { return this.format === APC_GRAY8 ? 1 : 2; }

  newBuffer(): ApcPixels {
    const n = this.width * this.height;
    return this.format === APC_GRAY8 ? new Uint8Array(n) : new Uint16Array(n);
  }

  /**
   * Apply frame `i` on top of `dest` (the previous composed frame) — APCsetFrame steps
   * frame by frame from 0 (FUN_004095d0). Key frames overwrite their rectangle, delta frames
   * leave pixels coded 0x0F00 untouched. Returns true when the data covered exactly the frame
   * rectangle (a format sanity check; the engine does not care).
   */
  applyFrame(dest: ApcPixels, i: number): boolean {
    const f = this.frames[i];
    if (f.dataSize === 0 || f.w === 0 || f.h === 0) return f.dataSize === 0;
    const W = this.width;
    const n = f.w * f.h;
    const at = (k: number) => (f.y + ((k / f.w) | 0)) * W + f.x + (k % f.w);
    const d = this.data, end = f.dataOffset + f.dataSize;
    if (this.format === APC_GRAY8) {
      // APCunpackFrame_GRAY8 (FUN_00409450): raw bytes only
      if (f.flags & 3) return false;
      for (let k = 0; k < n; k++) dest[at(k)] = d[f.dataOffset + k];
      return f.dataSize === n;
    }
    const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    let p = f.dataOffset, k = 0;
    if (this.format === APC_GRAY16) {
      // APCunpackFrame_GRAY16 (FUN_004093e0 / FUN_00409360)
      if (f.flags & APC_FRAME_DELTA) return false; // not supported by the engine either
      if (!(f.flags & APC_FRAME_RLE)) {
        for (; k < n; k++, p += 2) dest[at(k)] = v.getUint16(p, true);
        return f.dataSize === n * 2;
      }
      while (p + 1 < end && k < n) {
        const c = v.getUint16(p, true); p += 2;
        const cnt = c & 0x7fff;
        if (c & 0x8000) {
          const val = v.getUint16(p, true); p += 2;
          for (let j = 0; j < cnt && k < n; j++) dest[at(k++)] = val;
        } else {
          for (let j = 0; j < cnt && k < n; j++, p += 2) dest[at(k++)] = v.getUint16(p, true);
        }
      }
      return k === n && p === end;
    }
    if (this.format === APC_ARGB4444) {
      // APCunpackFrame_ARGB4444 (FUN_004092c0 -> FUN_00409240 key / FUN_004090a0 delta)
      if (!(f.flags & APC_FRAME_RLE)) return false;
      const delta = (f.flags & APC_FRAME_DELTA) !== 0;
      while (p + 1 < end && k < n) {
        const c = v.getUint16(p, true); p += 2;
        if (c >= 0x0f02 && c <= 0x0fff) {
          const cnt = c & 0xff;
          const val = v.getUint16(p, true); p += 2;
          if (delta && val === 0x0f00) k += cnt;
          else for (let j = 0; j < cnt && k < n; j++) dest[at(k++)] = val;
        } else {
          if (!(delta && c === 0x0f00)) dest[at(k)] = c;
          k++;
        }
      }
      return k === n && p === end;
    }
    throw new Error(`${this.name}: unknown pixel format 0x${this.format.toString(16)}`);
  }

  /** The composed frame `i` (a fresh copy). Sequential access is cached. */
  renderFrame(i: number): ApcPixels {
    if (i < 0 || i >= this.frames.length) throw new RangeError(`${this.name}: frame ${i} of ${this.frames.length}`);
    let px: ApcPixels, from: number;
    if (this.cache && this.cache.index <= i) { px = this.cache.px; from = this.cache.index + 1; }
    else { px = this.newBuffer(); from = 0; }
    for (let j = from; j <= i; j++) this.applyFrame(px, j);
    this.cache = { index: i, px };
    return px.slice();
  }

  /** All composed frames. */
  renderAll(): ApcPixels[] {
    const out: ApcPixels[] = [];
    const px = this.newBuffer();
    for (let j = 0; j < this.frames.length; j++) { this.applyFrame(px, j); out.push(px.slice()); }
    return out;
  }
}

export class ApcArchive {
  readonly bytes: Uint8Array;
  readonly entries: ApcEntry[];
  private readonly byName = new Map<string, ApcEntry>();

  private constructor(bytes: Uint8Array, entries: ApcEntry[]) {
    this.bytes = bytes;
    this.entries = entries;
    // the engine's name hash is case-insensitive (HW names differ in case from the archive)
    for (const e of entries) if (!this.byName.has(e.name.toLowerCase())) this.byName.set(e.name.toLowerCase(), e);
  }

  /** Parse the header and directory (APC_fh_mapFile, FUN_004097a0). */
  static parse(buf: ArrayBuffer | Uint8Array): ApcArchive {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const r = new Reader(bytes);
    if (r.u16() !== APC_MAGIC_FILE) throw new Error('not an APC file');
    r.skip(2);
    const fileSize = r.u32();
    if (fileSize !== bytes.length) throw new Error(`APC size ${bytes.length}, header says ${fileSize}`);
    if (r.u16() !== APC_MAGIC_DIR) throw new Error('APC directory missing');
    r.skip(2);
    const dirSize = r.u32(); // counted from offset 12
    const count = r.u32();
    const dirEnd = 12 + dirSize;
    const entries: ApcEntry[] = [];
    for (let i = 0; i < count; i++) {
      const name = r.cstr();
      const offset = r.u32(), size = r.u32();
      if (offset + size > bytes.length) throw new Error(`APC entry ${name} out of range`);
      const h = new Reader(bytes, offset);
      if (h.u16() !== APC_MAGIC_STREAM) throw new Error(`APC entry ${name}: bad stream magic`);
      h.skip(2);
      if (h.u32() !== size) throw new Error(`APC entry ${name}: size mismatch`);
      const width = h.u16(), height = h.u16(), format = h.u32(), frameCount = h.u16();
      entries.push({ index: i, serial: SUBANI_SERIAL_BASE + i, name, offset, size, width, height, format, frameCount });
    }
    if (r.pos !== dirEnd) throw new Error(`APC directory ends at ${r.pos}, expected ${dirEnd}`);
    return new ApcArchive(bytes, entries);
  }

  /** Look up by name (case-insensitive), directory index or serial (0x100000 + index). */
  find(key: string | number): ApcEntry | undefined {
    if (typeof key === 'string') return this.byName.get(key.toLowerCase());
    if (key >= SUBANI_SERIAL_BASE) key -= SUBANI_SERIAL_BASE;
    return this.entries[key];
  }

  private split(key: string | number | ApcEntry): { e: ApcEntry; header: Reader; packed: Uint8Array; rawSize: number } {
    const e = typeof key === 'object' ? key : this.find(key);
    if (!e) throw new Error(`subani ${String(key)} not in APC`);
    const header = new Reader(this.bytes.subarray(e.offset, e.offset + e.size));
    header.pos = 18;
    const compression = header.u16();
    if (compression !== 4) throw new Error(`${e.name}: unknown compression ${compression}`);
    header.pos = 24;
    const rawSize = header.u32();
    return { e, header, packed: this.bytes.subarray(e.offset + 28, e.offset + e.size), rawSize };
  }

  /** Inflate and parse one stream. */
  async load(key: string | number | ApcEntry): Promise<ApcStream> {
    const { e, header, packed, rawSize } = this.split(key);
    const data = await inflate(packed);
    if (data.length !== rawSize) throw new Error(`${e.name}: inflated ${data.length}, expected ${rawSize}`);
    return new ApcStream(e.name, header, data);
  }

  /** Same as load() with a synchronous inflater (e.g. node:zlib inflateSync). */
  loadSync(key: string | number | ApcEntry, inflateSync: InflateSync): ApcStream {
    const { e, header, packed, rawSize } = this.split(key);
    const data = inflateSync(packed);
    if (data.length !== rawSize) throw new Error(`${e.name}: inflated ${data.length}, expected ${rawSize}`);
    return new ApcStream(e.name, header, data);
  }
}

/** ARGB4444 -> 8-bit channel (n * 17). */
const X4 = (n: number) => n * 17;

export interface Sprite {
  /** Colour (0x00BBGGRR); fully transparent pixels are black. */
  surface: Surface;
  /** Per-pixel alpha 0..255 (from the 4-bit alpha nibble). */
  alpha: Uint8Array;
}

/** Convert composed ARGB4444 pixels into a Surface + alpha plane. */
export function argb4444ToSprite(px: Uint16Array, width: number, height: number): Sprite {
  const surface = new Surface(width, height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < px.length; i++) {
    const v = px[i];
    const a = v >> 12;
    alpha[i] = X4(a);
    if (a) surface.px[i] = rgb(X4((v >> 8) & 15), X4((v >> 4) & 15), X4(v & 15));
  }
  return { surface, alpha };
}

/**
 * Scene backgrounds are ARGB4444 streams too, but the engine masks every pixel with 0x0FFF
 * after decoding (FUN_0046aab0), i.e. draws them opaque.
 */
export function backgroundToSurface(px: Uint16Array, width: number, height: number): Surface {
  const s = new Surface(width, height);
  for (let i = 0; i < px.length; i++) {
    const v = px[i];
    s.px[i] = rgb(X4((v >> 8) & 15), X4((v >> 4) & 15), X4(v & 15));
  }
  return s;
}

/** Alpha-blend a sprite onto a surface at (dx, dy). */
export function blendSprite(dst: Surface, sprite: Sprite, dx: number, dy: number) {
  const { surface: s, alpha } = sprite;
  for (let y = 0; y < s.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < s.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const i = y * s.width + x, a = alpha[i];
      if (!a) continue;
      const di = ty * dst.width + tx;
      if (a === 255) { dst.px[di] = s.px[i]; continue; }
      const c = s.px[i], b = dst.px[di], k = a / 255;
      dst.px[di] = rgb(
        (b & 255) + ((c & 255) - (b & 255)) * k,
        ((b >> 8) & 255) + (((c >> 8) & 255) - ((b >> 8) & 255)) * k,
        ((b >> 16) & 255) + (((c >> 16) & 255) - ((b >> 16) & 255)) * k,
      );
    }
  }
}

/** Scene map kinds, from the name suffix of `<scene>__###_SceneGFX<Name><kind>`. */
export type SceneMapKind = 'background' | 'height' | 'zbuffer' | 'restriction' | 'info';

/**
 * Classify a SceneGFX stream: no suffix = background (ARGB4444, 640/1280/1920 x 480);
 * H = SceneHeightMap (GRAY16 full res: floor depth under each pixel, 0xFFFF = no floor),
 * Z = background z-buffer (GRAY16 full res), R = restriction/walk map (GRAY16 quarter res,
 * 0x7FFF walkable, 0 blocked), I = SceneInfoMap (GRAY8 quarter res, hotspot ids per scene).
 */
export function sceneMapKind(e: Pick<ApcEntry, 'name' | 'format'>): SceneMapKind | null {
  if (!/SceneGFX/i.test(e.name)) return null;
  if (e.format === APC_ARGB4444) return 'background';
  if (e.format === APC_GRAY8) return 'info';
  const last = e.name[e.name.length - 1];
  return last === 'H' ? 'height' : last === 'Z' ? 'zbuffer' : last === 'R' ? 'restriction' : null;
}

/** False-colour view of a GRAY8/GRAY16 map for debugging. */
export function mapToSurface(px: ApcPixels, width: number, height: number): Surface {
  const s = new Surface(width, height);
  if (px instanceof Uint8Array) {
    for (let i = 0; i < px.length; i++) {
      const v = px[i];
      s.px[i] = v ? rgb((v * 37) & 255 | 64, (v * 91) & 255 | 64, (v * 53) & 255 | 64) : 0;
    }
    return s;
  }
  let lo = 0xffff, hi = 0;
  for (const v of px) if (v !== 0xffff && v !== 0xcdcd && v !== 0 && v !== 0x7fff) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < px.length; i++) {
    const v = px[i];
    if (v === 0xffff) s.px[i] = rgb(0, 0, 80);
    else if (v === 0xcdcd) s.px[i] = rgb(255, 0, 0);
    else if (v === 0x7fff) s.px[i] = 0xffffff;
    else if (v === 0) s.px[i] = 0;
    else { const g = hi > lo ? Math.round(((v - lo) * 255) / (hi - lo)) : 128; s.px[i] = rgb(g, g, g); }
  }
  return s;
}
