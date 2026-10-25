// Software composition in the original's 12-bit colour (ARGB4444 blit engine, engine.md §2): the scene
// background, the objects sorted far -> near with a strict depth test against the background Z layer
// and nearest-neighbour perspective scaling, then UI layers as plain alpha blits. The result is expanded
// (c4 * 17) into the form surface. Everything is redrawn every frame (the dirty-rect system of the original
// has no visible effect).

import type { Frame } from './assets.ts';
import { core } from './core.ts';
import { world, type Obj } from './world.ts';
import { rgb } from '../engine/surface.ts';

const W = 640, H = 480;

/** 12-bit 0x0RGB -> 0x00BBGGRR */
const LUT = new Uint32Array(4096);
for (let i = 0; i < 4096; i++) LUT[i] = rgb(((i >> 8) & 15) * 17, ((i >> 4) & 15) * 17, (i & 15) * 17);
/** MUL[a * 16 + c] = floor(c * a / 15): the engine's premultiply table */
const MUL = new Uint8Array(256);
for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++) MUL[a * 16 + c] = Math.floor((c * a) / 15);

/** Blend an ARGB4444 source pixel (alpha a > 0) onto a 12-bit destination pixel. */
function blend(d: number, s: number, a: number): number {
  const ia = 15 - a, sa = a << 4, da = ia << 4;
  return (
    ((MUL[da + ((d >> 8) & 15)] + MUL[sa + ((s >> 8) & 15)]) << 8) |
    ((MUL[da + ((d >> 4) & 15)] + MUL[sa + ((s >> 4) & 15)]) << 4) |
    (MUL[da + (d & 15)] + MUL[sa + (s & 15)])
  );
}

export class Renderer {
  /** the back buffer, 12-bit colour */
  readonly back = new Uint16Array(W * H);

  /** Draw the scene (background + objects). Without a scene the screen is black. */
  renderScene() {
    const sc = world.scene;
    const back = this.back;
    if (!sc) { back.fill(0); return; }
    const bg = sc.maps.bg, bw = sc.width, pan = sc.pan;
    for (let y = 0; y < H; y++) back.set(bg.subarray(y * bw + pan, y * bw + pan + W), y * W);
    const objs: Obj[] = [];
    for (const o of world.objs) if (!o.hidden && o.frame) objs.push(o);
    // far -> near: larger depth first (stable, ties keep object order)
    const depth = new Map<Obj, number>();
    for (const o of objs) depth.set(o, o.depth);
    objs.sort((a, b) => depth.get(b)! - depth.get(a)!);
    for (const o of objs) this.drawObject(o, depth.get(o)!);
  }

  private drawObject(o: Obj, depth: number) {
    const sc = world.scene!;
    const f = o.frame!;
    const r = o.screenRect();
    if (!r) return;
    const [l, t, rr, b] = r;
    const dw = rr - l, dh = b - t;
    if (dw <= 0 || dh <= 0) return;
    const zb = sc.maps.z, zw = sc.width, pan = sc.pan;
    const back = this.back;
    const sx0 = f.bbox[0], sy0 = f.bbox[1], sw = f.bbox[2] - f.bbox[0], sh = f.bbox[3] - f.bbox[1];
    const x0 = Math.max(0, l), x1 = Math.min(W, rr), y0 = Math.max(0, t), y1 = Math.min(H, b);
    if (x0 >= x1 || y0 >= y1) return;
    const fx = new Int32Array(x1 - x0);
    for (let x = x0; x < x1; x++) fx[x - x0] = sx0 + (f.opaque ? x - l : Math.floor(((x - l) * sw) / dw));
    for (let y = y0; y < y1; y++) {
      const sy = sy0 + (f.opaque ? y - t : Math.floor(((y - t) * sh) / dh));
      const srow = sy * f.w;
      const drow = y * W;
      const zrow = y * zw + pan;
      for (let x = x0; x < x1; x++) {
        const s = f.px[srow + fx[x - x0]];
        const a = s >> 12;
        if (!f.opaque && a === 0) continue;
        if (zb && depth >= zb[zrow + x]) continue; // drawn only where depth < background Z (strict)
        if (f.opaque || a === 15) back[drow + x] = s & 0xfff;
        else back[drow + x] = blend(back[drow + x], s, a);
      }
    }
  }

  /** Alpha-blend a frame (or part of it) at screen position (dx, dy) — the UI layers. */
  drawFrame(f: Frame, dx: number, dy: number, useBbox = false) {
    const [bx0, by0, bx1, by1] = useBbox ? f.bbox : [0, 0, f.w, f.h];
    this.drawPixels(f.px, f.w, bx0, by0, bx1 - bx0, by1 - by0, dx + (useBbox ? bx0 : 0), dy + (useBbox ? by0 : 0), f.opaque);
  }

  /** Alpha-blend a stream's frame at (dx, dy). Returns false if the stream does not exist. */
  drawStream(name: string, frame: number, dx: number, dy: number): boolean {
    const f = core.assets.frame(name, frame);
    if (!f) return false;
    this.drawFrame(f, dx, dy);
    return true;
  }

  /** Blend a rectangle of an ARGB4444 buffer onto the back buffer, clipped to the screen. */
  drawPixels(px: Uint16Array, pw: number, sx: number, sy: number, w: number, h: number, dx: number, dy: number, opaque = false) {
    const back = this.back;
    for (let y = 0; y < h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < w; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= W) continue;
        const s = px[(sy + y) * pw + sx + x];
        const a = s >> 12;
        if (!opaque && a === 0) continue;
        const di = ty * W + tx;
        back[di] = opaque || a === 15 ? s & 0xfff : blend(back[di], s, a);
      }
    }
  }

  /** Fill a rectangle with an ARGB4444 colour (blended). */
  fillRect(x0: number, y0: number, x1: number, y1: number, argb: number) {
    const a = argb >> 12;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        this.back[i] = a === 15 ? argb & 0xfff : blend(this.back[i], argb, a);
      }
    }
  }

  /** Convert the back buffer into the display surface. */
  present(out: Uint32Array) {
    const b = this.back;
    for (let i = 0; i < b.length; i++) out[i] = LUT[b[i]];
  }

  /** Copy a 24-bit surface (movies) into the display surface. */
  static copy(out: Uint32Array, src: Uint32Array) { out.set(src); }

  /** 80x60 thumbnail of the scene as 12-bit RGB (each pixel = average of an 8x8 block), top-down. */
  thumbnail(): Uint16Array {
    this.renderScene();
    const out = new Uint16Array(80 * 60);
    for (let ty = 0; ty < 60; ty++) {
      for (let tx = 0; tx < 80; tx++) {
        let r = 0, g = 0, bl = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const v = this.back[(ty * 8 + y) * W + tx * 8 + x];
            r += (v >> 8) & 15; g += (v >> 4) & 15; bl += v & 15;
          }
        }
        out[ty * 80 + tx] = (((r >> 6) & 15) << 8) | (((g >> 6) & 15) << 4) | ((bl >> 6) & 15);
      }
    }
    return out;
  }
}

export { LUT as COLOR_LUT };

/** The one renderer of the game. */
export const renderer = new Renderer();
