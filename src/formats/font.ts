// normalFont.fnt + normalFont.sz: the game's bitmap font.
//   normalFont.fnt = a TGA image: 256x256, 32-bit BGRA, uncompressed (type 2), bottom-up,
//                    with a TGA 2.0 footer. A 16x16 grid of 16x16 cells, cell = byte value.
//   normalFont.sz  = 256 x 20 bytes: { i32 x, i32 y, i32 width, i32 height, i32 ascent } per
//                    byte value (loaded over a hard-coded default table, FUN_00407720).
// Drawing (FUN_0041a4e0): for each byte c, blit atlas rect (x, y, width, height) to
// (penX, penY + 16 - ascent), then penX += width. Transparent texels are white with alpha
// 0x44; the glyphs are opaque (yellow fill, dark outline). Missing glyphs are dark boxes.

import { Reader, encodeCp1252 } from './bytes.ts';
import { Surface, rgb } from '../engine/surface.ts';
import type { Sprite } from './apc.ts';

/** Decode an uncompressed or RLE true-colour TGA (24/32 bpp) into a Surface + alpha plane. */
export function decodeTga(buf: ArrayBuffer | Uint8Array): Sprite {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const r = new Reader(b);
  const idLen = r.u8(), cmapType = r.u8(), type = r.u8();
  r.skip(5); // colour map spec
  r.skip(4); // origin
  const w = r.u16(), h = r.u16(), bpp = r.u8(), desc = r.u8();
  if (cmapType !== 0 || (type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32)) {
    throw new Error(`unsupported TGA (type ${type}, cmap ${cmapType}, ${bpp} bpp)`);
  }
  r.skip(idLen);
  const bytesPer = bpp >> 3;
  const n = w * h;
  const raw = new Uint8Array(n * bytesPer);
  if (type === 2) raw.set(r.slice(n * bytesPer));
  else {
    let o = 0;
    while (o < raw.length) {
      const c = r.u8(), cnt = (c & 0x7f) + 1;
      if (c & 0x80) { const px = r.slice(bytesPer); for (let i = 0; i < cnt; i++, o += bytesPer) raw.set(px, o); }
      else { raw.set(r.slice(cnt * bytesPer), o); o += cnt * bytesPer; }
    }
  }
  const topDown = (desc & 0x20) !== 0;
  const surface = new Surface(w, h);
  const alpha = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const row = topDown ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * bytesPer, i = row * w + x;
      surface.px[i] = rgb(raw[q + 2], raw[q + 1], raw[q]);
      alpha[i] = bytesPer === 4 ? raw[q + 3] : 255;
    }
  }
  return { surface, alpha };
}

export interface Glyph { x: number; y: number; width: number; height: number; ascent: number }

export function parseFontSz(buf: ArrayBuffer | Uint8Array): Glyph[] {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  if (r.length !== 256 * 20) throw new Error(`normalFont.sz: ${r.length} bytes, expected 5120`);
  const out: Glyph[] = [];
  for (let i = 0; i < 256; i++) out.push({ x: r.i32(), y: r.i32(), width: r.i32(), height: r.i32(), ascent: r.i32() });
  return out;
}

export class BitmapFont {
  readonly atlas: Sprite;
  readonly glyphs: Glyph[];
  /** Treat texels with alpha <= this as transparent (the 0x44 white background); -1 draws them. */
  transparentBelow = 0x44;

  constructor(atlas: Sprite, glyphs: Glyph[]) {
    this.atlas = atlas;
    this.glyphs = glyphs;
  }

  static parse(fnt: ArrayBuffer | Uint8Array, sz: ArrayBuffer | Uint8Array): BitmapFont {
    return new BitmapFont(decodeTga(fnt), parseFontSz(sz));
  }

  measure(text: string): number {
    let w = 0;
    for (const c of encodeCp1252(text)) w += this.glyphs[c].width;
    return w;
  }

  /** Draw like writeTextToSurface: (x, y) is the pen; glyph tops land at y + 16 - ascent. Returns the end x. */
  draw(dst: Surface, x: number, y: number, text: string): number {
    const A = this.atlas.surface, AA = this.atlas.alpha;
    for (const c of encodeCp1252(text)) {
      const g = this.glyphs[c];
      const ty0 = y + 16 - g.ascent;
      for (let j = 0; j < g.height; j++) {
        const ty = ty0 + j;
        if (ty < 0 || ty >= dst.height) continue;
        for (let i = 0; i < g.width; i++) {
          const tx = x + i;
          if (tx < 0 || tx >= dst.width) continue;
          const si = (g.y + j) * A.width + g.x + i, a = AA[si];
          if (a <= this.transparentBelow) continue;
          const di = ty * dst.width + tx;
          if (a === 255) { dst.px[di] = A.px[si]; continue; }
          const s = A.px[si], d = dst.px[di], k = a / 255;
          dst.px[di] = rgb((d & 255) + ((s & 255) - (d & 255)) * k, ((d >> 8) & 255) + (((s >> 8) & 255) - ((d >> 8) & 255)) * k,
            ((d >> 16) & 255) + (((s >> 16) & 255) - ((d >> 16) & 255)) * k);
        }
      }
      x += g.width;
    }
    return x;
  }
}
