// Smacker (.SMK, RAD Game Tools) demuxer + video/audio decoder. Written from the format
// description (SMK2 / SMK4). Decoder only: no DOM / Web Audio use, so it also runs in Node.
// Playback lives in smacker-play.ts.
//
// Layout: header, frame size table, frame type table, Huffman tree data (MMAP, MCLR, FULL, TYPE),
// then per frame: [palette chunk] [audio chunk x up to 7] video data. Bit streams are LSB-first.

import { rgb, Surface } from './surface.ts';

/** LSB-first bit reader; reading past the end yields zero bits. */
class BitReader {
  private b: Uint8Array;
  private pos: number; // in bits
  private end: number; // in bits
  constructor(b: Uint8Array, off: number, end: number) {
    this.b = b;
    this.pos = off * 8;
    this.end = end * 8;
  }
  bit(): number {
    const p = this.pos++;
    if (p >= this.end) return 0;
    return (this.b[p >> 3] >> (p & 7)) & 1;
  }
  bits(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v |= this.bit() << i;
    return v;
  }
}

/** Binary Huffman tree. Child refs: >= 0 node index, < 0 leaf (index = ~ref). Bit 0 = left. */
class HuffTree {
  ch0: number[] = [];
  ch1: number[] = [];
  vals: number[] = [];
  root = ~0;
  /** Big trees: leaf indices of the three cache slots. */
  last: [number, number, number] | null = null;

  get(br: BitReader): number {
    let r = this.root;
    while (r >= 0) r = br.bit() ? this.ch1[r] : this.ch0[r];
    return this.vals[~r];
  }

  /** Big tree lookup with the 3-entry move-to-front cache (see decodeHeaderTree). */
  getBig(br: BitReader): number {
    const v = this.get(br);
    const l = this.last!, vals = this.vals;
    if (v !== vals[l[0]]) {
      vals[l[2]] = vals[l[1]];
      vals[l[1]] = vals[l[0]];
      vals[l[0]] = v;
    }
    return v;
  }

  resetCache() {
    const l = this.last!;
    this.vals[l[0]] = this.vals[l[1]] = this.vals[l[2]] = 0;
  }

  static single(): HuffTree {
    const t = new HuffTree();
    t.vals.push(0);
    return t;
  }
}

/** Plain tree: bit 0 = leaf with an 8-bit value, bit 1 = node (left subtree, right subtree). */
function readTree8(br: BitReader): HuffTree {
  const t = new HuffTree();
  const rec = (depth: number): number => {
    if (depth > 300) throw new Error('smk: tree too deep');
    if (!br.bit()) {
      t.vals.push(br.bits(8));
      return ~(t.vals.length - 1);
    }
    const n = t.ch0.length;
    t.ch0.push(0);
    t.ch1.push(0);
    const a = rec(depth + 1);
    const b = rec(depth + 1);
    t.ch0[n] = a;
    t.ch1[n] = b;
    return n;
  };
  t.root = rec(0);
  return t;
}

/** Sub-tree of a header tree: presence bit, tree, one end bit. Absent = a single 0 leaf. */
function readSubTree(br: BitReader): HuffTree {
  const t = br.bit() ? readTree8(br) : HuffTree.single();
  br.bit();
  return t;
}

/**
 * Header tree (MMAP/MCLR/FULL/TYPE): 16-bit symbols, built from a low-byte tree and a high-byte
 * tree, plus three 16-bit marker values. Leaves whose value equals a marker are cache slots
 * (they hold 0 until a symbol has been decoded and then return the cached values).
 */
function readBigTree(br: BitReader): HuffTree {
  if (!br.bit()) {
    const t = HuffTree.single();
    t.vals.push(0, 0);
    t.last = [0, 1, 2];
    t.vals.push(0);
    return t;
  }
  const lo = readSubTree(br), hi = readSubTree(br);
  const esc = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const l = br.bits(8);
    esc[i] = l | (br.bits(8) << 8);
  }
  const t = new HuffTree();
  const last = [-1, -1, -1];
  const rec = (depth: number): number => {
    if (depth > 70000) throw new Error('smk: big tree too deep');
    if (!br.bit()) {
      let v = lo.get(br) | (hi.get(br) << 8);
      const li = t.vals.length;
      if (v === esc[0]) { last[0] = li; v = 0; }
      else if (v === esc[1]) { last[1] = li; v = 0; }
      else if (v === esc[2]) { last[2] = li; v = 0; }
      t.vals.push(v);
      return ~li;
    }
    const n = t.ch0.length;
    t.ch0.push(0);
    t.ch1.push(0);
    const a = rec(depth + 1);
    const b = rec(depth + 1);
    t.ch0[n] = a;
    t.ch1[n] = b;
    return n;
  };
  t.root = rec(0);
  br.bit(); // end marker
  for (let i = 0; i < 3; i++) if (last[i] < 0) { last[i] = t.vals.length; t.vals.push(0); }
  t.last = last as [number, number, number];
  return t;
}

// 6-bit palette component -> 8 bit
const PAL6 = new Uint8Array(64);
for (let i = 0; i < 64; i++) PAL6[i] = i * 4 + (i >> 4);

// run lengths of the video block type codes
const BLOCK_RUNS = new Int32Array(64);
for (let i = 0; i < 59; i++) BLOCK_RUNS[i] = i + 1;
[128, 256, 512, 1024, 2048].forEach((v, i) => (BLOCK_RUNS[59 + i] = v));

export interface SmkAudioTrack {
  /** Sample rate (Hz); 0 = track not present. */
  rate: number;
  channels: number;
  bits: number;
  /** Huffman-compressed DPCM (otherwise raw PCM). */
  packed: boolean;
  /** Track has data in the file. */
  present: boolean;
  /** Unsupported flavour (Bink audio / DCT); decodes to silence. */
  unsupported: boolean;
}

interface FrameInfo {
  pal: number; // palette chunk offset (0 = none)
  palEnd: number;
  audio: { off: number; end: number }[]; // per track, off = 0 -> none
  vid: number;
  vidEnd: number;
}

export interface SmkSnapshot { decoded: number; indices: Uint8Array; palette: Uint32Array }

export class Smacker {
  readonly version: 2 | 4;
  readonly width: number;
  readonly height: number;
  /** Number of frames (without the ring frame). */
  readonly frameCount: number;
  readonly fps: number;
  /** Header flags: ring frame, Y-interlaced, Y-doubled. */
  readonly ring: boolean;
  readonly yInterlaced: boolean;
  readonly yDouble: boolean;
  readonly audioTracks: SmkAudioTrack[] = [];
  /** Current 256-entry palette, 0x00BBGGRR. */
  readonly palette = new Uint32Array(256);
  /** Raw 8-bit indices of the last decoded frame (width*height). */
  readonly indices: Uint8Array;

  private bytes: Uint8Array;
  private frames: FrameInfo[] = [];
  private mmap!: HuffTree;
  private mclr!: HuffTree;
  private full!: HuffTree;
  private type!: HuffTree;
  private decoded = -1;
  private pal0 = new Uint32Array(256);

  constructor(buf: ArrayBuffer) {
    const b = (this.bytes = new Uint8Array(buf));
    const v = new DataView(buf);
    const sig = String.fromCharCode(b[0], b[1], b[2], b[3]);
    if (sig !== 'SMK2' && sig !== 'SMK4') throw new Error('not a Smacker file');
    this.version = sig === 'SMK4' ? 4 : 2;
    this.width = v.getUint32(4, true);
    this.height = v.getUint32(8, true);
    this.frameCount = v.getUint32(12, true);
    const pts = v.getInt32(16, true);
    this.fps = pts > 0 ? 1000 / pts : pts < 0 ? 100000 / -pts : 10;
    const flags = v.getUint32(20, true);
    this.ring = !!(flags & 1);
    this.yInterlaced = !!(flags & 2);
    this.yDouble = !!(flags & 4);
    const treeSize = v.getUint32(0x34, true);
    for (let i = 0; i < 7; i++) {
      const r = v.getUint32(0x48 + i * 4, true);
      const f = r >>> 24;
      this.audioTracks.push({
        rate: r & 0xffffff,
        channels: f & 0x10 ? 2 : 1,
        bits: f & 0x20 ? 16 : 8,
        packed: !!(f & 0x80),
        present: !!(f & 0x40),
        unsupported: !!(f & 0x0c),
      });
    }
    const total = this.frameCount + (this.ring ? 1 : 0);
    const sizeTab = 0x68;
    const typeTab = sizeTab + total * 4;
    const treeOff = typeTab + total;
    let off = treeOff + treeSize;
    for (let i = 0; i < total; i++) {
      const size = v.getUint32(sizeTab + i * 4, true) & ~3;
      const type = b[typeTab + i];
      const end = Math.min(off + size, b.length);
      const fi: FrameInfo = { pal: 0, palEnd: 0, audio: [], vid: 0, vidEnd: end };
      let p = off;
      if (type & 1) {
        const n = b[p] * 4;
        fi.pal = p;
        fi.palEnd = Math.min(p + n, end);
        p += n;
      }
      for (let t = 0; t < 7; t++) {
        if (type & (2 << t)) {
          const n = p + 4 <= end ? v.getUint32(p, true) : 4;
          fi.audio.push({ off: p + 4, end: Math.min(p + Math.max(n, 4), end) });
          p += Math.max(n, 4);
        } else fi.audio.push({ off: 0, end: 0 });
      }
      fi.vid = Math.min(p, end);
      this.frames.push(fi);
      off += size;
    }
    this.indices = new Uint8Array(this.width * this.height);
    this.readTrees(treeOff, treeOff + treeSize);
  }

  get duration() {
    return this.frameCount / this.fps;
  }

  /** Display height when Y-double / Y-interlace is set (frame() then scales if `out` is that tall). */
  get displayHeight() {
    return this.yDouble || this.yInterlaced ? this.height * 2 : this.height;
  }

  private readTrees(off: number, end: number) {
    const br = new BitReader(this.bytes, off, end);
    this.mmap = readBigTree(br);
    this.mclr = readBigTree(br);
    this.full = readBigTree(br);
    this.type = readBigTree(br);
  }

  private reset() {
    this.decoded = -1;
    this.indices.fill(0);
    this.palette.fill(0);
  }

  /**
   * Decode frame `n` (frames are deltas: decodes from the last decoded frame, or from 0 when
   * going backwards) and draw it into `out`. Also sets out.palette / out.indices.
   */
  frame(n: number, out: Surface) {
    n = Math.max(0, Math.min(this.frameCount - 1, n | 0));
    if (n < this.decoded) this.reset();
    while (this.decoded < n) {
      this.decoded++;
      this.decodeFrame(this.frames[this.decoded]);
    }
    this.draw(out);
  }

  /** Decode forward to frame `n` without drawing (decodes from 0 when going backwards). Use `indices` / `palette` afterwards. */
  advanceTo(n: number) {
    n = Math.max(-1, Math.min(this.frameCount - 1, n | 0));
    if (n < this.decoded) this.reset();
    while (this.decoded < n) {
      this.decoded++;
      this.decodeFrame(this.frames[this.decoded]);
    }
  }

  /** Copy of the decoder state (frames are deltas): lets a player jump back to a frame without decoding from 0. */
  snapshot(): SmkSnapshot {
    return { decoded: this.decoded, indices: this.indices.slice(), palette: this.palette.slice() };
  }

  restore(s: SmkSnapshot) {
    this.decoded = s.decoded;
    this.indices.set(s.indices);
    this.palette.set(s.palette);
  }

  /** Index of the frame currently held in the palette/indices (-1 = none). */
  get currentFrame() {
    return this.decoded;
  }

  private draw(out: Surface) {
    const w = this.width, h = this.height, idx = this.indices, pal = this.palette, px = out.px;
    const dh = out.height >= h * 2 && (this.yDouble || this.yInterlaced);
    const rows = Math.min(h, dh ? out.height >> 1 : out.height), cols = Math.min(w, out.width);
    for (let y = 0; y < rows; y++) {
      const o = (dh ? y * 2 : y) * out.width, s = y * w;
      for (let x = 0; x < cols; x++) px[o + x] = pal[idx[s + x]];
      if (dh) {
        const o2 = o + out.width;
        if (this.yDouble) for (let x = 0; x < cols; x++) px[o2 + x] = px[o + x];
        else px.fill(0, o2, o2 + cols);
      }
    }
    if (out.width === w && out.height === h) {
      if (!out.indices || out.indices.length !== idx.length) out.indices = new Uint8Array(idx.length);
      out.indices.set(idx);
      out.palette = new Uint32Array(pal);
    }
  }

  private decodeFrame(f: FrameInfo) {
    if (f.pal) this.decodePalette(f.pal + 1, f.palEnd);
    this.decodeVideo(f.vid, f.vidEnd);
  }

  private decodePalette(off: number, end: number) {
    const b = this.bytes, pal = this.palette, old = this.pal0;
    old.set(pal);
    let k = 0, p = off;
    while (k < 256 && p < end) {
      const t = b[p++];
      if (t & 0x80) {
        k += (t & 0x7f) + 1; // keep these entries
      } else if (t & 0x40) {
        const from = b[p++];
        const n = (t & 0x3f) + 1;
        for (let i = 0; i < n && k < 256; i++) pal[k++] = old[(from + i) & 255];
      } else {
        const r = PAL6[t], g = PAL6[b[p++] & 63], bl = PAL6[b[p++] & 63];
        pal[k++] = rgb(r, g, bl);
      }
    }
  }

  private decodeVideo(off: number, end: number) {
    const w = this.width, bw = w >> 2, blocks = bw * (this.height >> 2);
    const px = this.indices;
    const br = new BitReader(this.bytes, off, end);
    const { mmap, mclr, full, type } = this;
    mmap.resetCache(); mclr.resetCache(); full.resetCache(); type.resetCache();
    const v4 = this.version === 4;
    let blk = 0;
    while (blk < blocks) {
      const t = type.getBig(br);
      let run = BLOCK_RUNS[(t >> 2) & 63];
      switch (t & 3) {
        case 0: // mono: 2 colours + 16-bit pattern
          while (run-- > 0 && blk < blocks) {
            const clr = mclr.getBig(br), map = mmap.getBig(br);
            const hi = clr >> 8, lo = clr & 255;
            let o = (blk / bw | 0) * 4 * w + (blk % bw) * 4;
            let m = map;
            for (let i = 0; i < 4; i++) {
              px[o] = m & 1 ? hi : lo;
              px[o + 1] = m & 2 ? hi : lo;
              px[o + 2] = m & 4 ? hi : lo;
              px[o + 3] = m & 8 ? hi : lo;
              m >>= 4;
              o += w;
            }
            blk++;
          }
          break;
        case 1: { // full
          let mode = 0;
          if (v4) {
            if (br.bit()) mode = 1;
            else if (br.bit()) mode = 2;
          }
          while (run-- > 0 && blk < blocks) {
            let o = (blk / bw | 0) * 4 * w + (blk % bw) * 4;
            if (mode === 0) {
              for (let i = 0; i < 4; i++) {
                const a = full.getBig(br), c = full.getBig(br);
                px[o + 2] = a & 255; px[o + 3] = a >> 8;
                px[o] = c & 255; px[o + 1] = c >> 8;
                o += w;
              }
            } else if (mode === 1) {
              for (let j = 0; j < 2; j++) {
                const a = full.getBig(br);
                for (let i = 0; i < 2; i++) {
                  px[o] = px[o + 1] = a & 255;
                  px[o + 2] = px[o + 3] = a >> 8;
                  o += w;
                }
              }
            } else {
              for (let j = 0; j < 2; j++) {
                const p2 = full.getBig(br), p1 = full.getBig(br);
                for (let i = 0; i < 2; i++) {
                  px[o] = p1 & 255; px[o + 1] = p1 >> 8;
                  px[o + 2] = p2 & 255; px[o + 3] = p2 >> 8;
                  o += w;
                }
              }
            }
            blk++;
          }
          break;
        }
        case 2: // void: keep previous frame's pixels
          blk += run;
          break;
        default: { // solid
          const c = t >> 8;
          while (run-- > 0 && blk < blocks) {
            let o = (blk / bw | 0) * 4 * w + (blk % bw) * 4;
            for (let i = 0; i < 4; i++) { px.fill(c, o, o + 4); o += w; }
            blk++;
          }
        }
      }
    }
  }

  /**
   * Decode an audio track (0..6) into Float32 channels. Optionally only the audio carried by
   * frames [from, to] (inclusive). Returns null if the track has no data.
   */
  audioSamples(track = 0, from = 0, to = this.frameCount - 1): { rate: number; data: Float32Array[] } | null {
    const tr = this.audioTracks[track];
    if (!tr || !tr.present || !tr.rate) return null;
    from = Math.max(0, from); to = Math.min(this.frameCount - 1, to);
    const ch = tr.channels;
    const parts: Float32Array[][] = [];
    let total = 0;
    for (let i = from; i <= to; i++) {
      const a = this.frames[i].audio[track];
      if (!a.off || a.end <= a.off) continue;
      const d = this.decodeAudioChunk(tr, a.off, a.end);
      if (d) { parts.push(d); total += d[0].length; }
    }
    if (!total) return null;
    const data = Array.from({ length: ch }, () => new Float32Array(total));
    let o = 0;
    for (const p of parts) {
      for (let c = 0; c < ch; c++) data[c].set(p[c], o);
      o += p[0].length;
    }
    return { rate: tr.rate, data };
  }

  private decodeAudioChunk(tr: SmkAudioTrack, off: number, end: number): Float32Array[] | null {
    const b = this.bytes, ch = tr.channels;
    if (!tr.packed) {
      const bps = tr.bits / 8 * ch, n = Math.floor((end - off) / bps);
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      for (let s = 0; s < n; s++) {
        for (let c = 0; c < ch; c++) {
          if (tr.bits === 8) data[c][s] = (b[off + s * bps + c] - 128) / 128;
          else {
            const p = off + s * bps + c * 2;
            data[c][s] = (((b[p] | (b[p + 1] << 8)) << 16) >> 16) / 32768;
          }
        }
      }
      return data;
    }
    if (tr.unsupported || end - off < 4) return null;
    const unp = b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] * 16777216);
    const br = new BitReader(b, off + 4, end);
    const stereo = ch === 2 ? 1 : 0;
    const total = tr.bits === 16 ? unp >> 1 : unp;
    const n = Math.floor(total / ch);
    if (!br.bit()) return Array.from({ length: ch }, () => new Float32Array(n)); // silent
    const st = br.bit(), is16 = br.bit();
    if (st !== stereo || (is16 ? 16 : 8) !== tr.bits) return null;
    const nt = 1 << (is16 + stereo);
    const trees: HuffTree[] = [];
    for (let i = 0; i < nt; i++) {
      trees.push(readSubTree(br));
    }
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    const pred = [0, 0];
    if (is16) {
      for (let i = stereo; i >= 0; i--) {
        const hi = br.bits(8), lo = br.bits(8);
        pred[i] = ((hi << 8) | lo) << 16 >> 16;
      }
      for (let i = 0; i <= stereo; i++) if (n > 0) data[i][0] = pred[i] / 32768;
      for (let i = stereo + 1; i < total; i++) {
        const c = i & stereo, s = (i - c) / ch | 0;
        const l = trees[c * 2].get(br), h = trees[c * 2 + 1].get(br);
        pred[c] += ((l | (h << 8)) << 16) >> 16;
        pred[c] = Math.max(-32768, Math.min(32767, pred[c]));
        if (s < n) data[c][s] = pred[c] / 32768;
      }
    } else {
      for (let i = stereo; i >= 0; i--) pred[i] = br.bits(8);
      for (let i = 0; i <= stereo; i++) if (n > 0) data[i][0] = (pred[i] - 128) / 128;
      for (let i = stereo + 1; i < total; i++) {
        const c = i & stereo, s = (i - c) / ch | 0;
        pred[c] += (trees[c].get(br) << 24) >> 24;
        pred[c] = Math.max(0, Math.min(255, pred[c]));
        if (s < n) data[c][s] = (pred[c] - 128) / 128;
      }
    }
    return data;
  }
}
