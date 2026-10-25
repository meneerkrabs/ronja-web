// A small synchronous zlib/deflate decoder. The engine decodes sprite streams on demand in the
// middle of a frame (like the original, which paused its clock while loading), so it cannot use the
// asynchronous DecompressionStream.

interface Huff { table: Int32Array; bits: number }

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function build(lengths: ArrayLike<number>, n: number): Huff {
  const count = new Int32Array(16);
  let max = 0;
  for (let i = 0; i < n; i++) { count[lengths[i]]++; if (lengths[i] > max) max = lengths[i]; }
  if (max === 0) return { table: new Int32Array(2), bits: 1 };
  count[0] = 0;
  const next = new Int32Array(16);
  let code = 0;
  for (let l = 1; l <= 15; l++) { code = (code + count[l - 1]) << 1; next[l] = code; }
  const size = 1 << max;
  const table = new Int32Array(size);
  for (let sym = 0; sym < n; sym++) {
    const len = lengths[sym];
    if (!len) continue;
    let c = next[len]++, rev = 0;
    for (let i = 0; i < len; i++) { rev = (rev << 1) | (c & 1); c >>= 1; }
    const entry = (sym << 4) | len;
    for (let i = rev; i < size; i += 1 << len) table[i] = entry;
  }
  return { table, bits: max };
}

let FIXED_LIT: Huff | null = null, FIXED_DIST: Huff | null = null;

/** Inflate a zlib (RFC 1950) stream; `size` (if known) preallocates the output. */
export function inflateSync(src: Uint8Array, size = 0): Uint8Array {
  let pos = 2; // zlib header
  let bitbuf = 0, bitcnt = 0;
  let out = new Uint8Array(size || src.length * 4);
  let op = 0;
  const need = (n: number) => {
    while (bitcnt < n) { bitbuf |= (pos < src.length ? src[pos] : 0) << bitcnt; pos++; bitcnt += 8; }
  };
  const bits = (n: number) => {
    if (n === 0) return 0;
    need(n);
    const v = bitbuf & ((1 << n) - 1);
    bitbuf >>>= n; bitcnt -= n;
    return v;
  };
  const sym = (h: Huff) => {
    need(h.bits);
    const e = h.table[bitbuf & ((1 << h.bits) - 1)];
    const len = e & 15;
    if (len === 0) throw new Error('inflate: bad code');
    bitbuf >>>= len; bitcnt -= len;
    return e >> 4;
  };
  const grow = (extra: number) => {
    if (op + extra <= out.length) return;
    const n = new Uint8Array(Math.max(out.length * 2, op + extra));
    n.set(out.subarray(0, op));
    out = n;
  };
  for (;;) {
    const final = bits(1), type = bits(2);
    if (type === 0) {
      bitbuf = 0; bitcnt = 0;
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      grow(len);
      out.set(src.subarray(pos, pos + len), op);
      op += len; pos += len;
    } else if (type === 1 || type === 2) {
      let lit: Huff, dist: Huff;
      if (type === 1) {
        if (!FIXED_LIT) {
          const l = new Uint8Array(288);
          l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
          FIXED_LIT = build(l, 288);
          FIXED_DIST = build(new Uint8Array(30).fill(5), 30);
        }
        lit = FIXED_LIT; dist = FIXED_DIST!;
      } else {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const cl = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = bits(3);
        const clh = build(cl, 19);
        const lens = new Uint8Array(hlit + hdist);
        for (let i = 0; i < hlit + hdist;) {
          const s = sym(clh);
          if (s < 16) lens[i++] = s;
          else {
            let rep: number, val = 0;
            if (s === 16) { val = lens[i - 1]; rep = 3 + bits(2); }
            else if (s === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            while (rep-- > 0) lens[i++] = val;
          }
        }
        lit = build(lens.subarray(0, hlit), hlit);
        dist = build(lens.subarray(hlit), hdist);
      }
      for (;;) {
        const s = sym(lit);
        if (s < 256) { if (op >= out.length) grow(1); out[op++] = s; }
        else if (s === 256) break;
        else {
          const li = s - 257;
          const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
          const di = sym(dist);
          const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
          if (op + len > out.length) grow(len);
          for (let i = 0; i < len; i++, op++) out[op] = out[op - d];
        }
      }
    } else throw new Error('inflate: bad block type');
    if (final) break;
  }
  return out.subarray(0, op);
}
