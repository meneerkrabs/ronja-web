// Small helpers shared by the Ronja file-format parsers (all formats are little-endian).

/** Sequential little-endian reader over a byte array. */
export class Reader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }

  get length(): number { return this.bytes.length; }
  get eof(): boolean { return this.pos >= this.bytes.length; }

  private need(n: number) {
    if (this.pos + n > this.bytes.length) throw new RangeError(`read past end (${this.pos}+${n} > ${this.bytes.length})`);
  }

  u8(): number { this.need(1); return this.bytes[this.pos++]; }
  u16(): number { this.need(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32(): number { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i32(): number { this.need(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f32(): number { this.need(4); const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  skip(n: number) { this.need(n); this.pos += n; }
  slice(n: number): Uint8Array { this.need(n); const s = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return s; }

  /** NUL-terminated string (Windows-1252). */
  cstr(): string {
    let e = this.pos;
    while (e < this.bytes.length && this.bytes[e] !== 0) e++;
    if (e >= this.bytes.length) throw new RangeError('unterminated string');
    const s = decodeCp1252(this.bytes.subarray(this.pos, e));
    this.pos = e + 1;
    return s;
  }

  /** u32 byte length followed by that many bytes (a NUL-terminated string, the NUL counted in the length). */
  lenStr(): string {
    const n = this.u32();
    const b = this.slice(n);
    let e = b.indexOf(0);
    if (e < 0) e = b.length;
    return decodeCp1252(b.subarray(0, e));
  }
}

let cp1252: TextDecoder | null = null;
/** The game's text is Windows-1252 (Dutch/Swedish letters, 0x92 = right quote). */
export function decodeCp1252(b: Uint8Array): string {
  cp1252 ??= new TextDecoder('windows-1252');
  return cp1252.decode(b);
}

/** Encode a string back to Windows-1252 bytes (the font is indexed by these byte values). */
export function encodeCp1252(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i] = c < 0x80 || (c >= 0xa0 && c < 0x100) ? c : (CP1252_HIGH.get(c) ?? 0x3f);
  }
  return out;
}
const CP1252_HIGH = new Map<number, number>();
{
  const hi = new Uint8Array(32).map((_, i) => 0x80 + i);
  const s = new TextDecoder('windows-1252').decode(hi);
  for (let i = 0; i < 32; i++) CP1252_HIGH.set(s.charCodeAt(i), 0x80 + i);
}

/** A synchronous zlib inflater (e.g. node:zlib inflateSync), used instead of DecompressionStream when given. */
export type InflateSync = (data: Uint8Array) => Uint8Array;

/** Inflate a zlib (RFC 1950) stream. Uses the Compression Streams API (browsers, Node >= 18). */
export async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const copy = new Uint8Array(data); // detach from any larger buffer
  const stream = new Blob([copy]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const asBytes = (b: ArrayBuffer | Uint8Array): Uint8Array => (b instanceof Uint8Array ? b : new Uint8Array(b));
