// sounds/MUSIC.wav/dls_*.wav: despite the extension these are Miles Sound System "XMIDI +
// DLS" files (IFF, big-endian chunk sizes):
//   FORM XDIR { INFO(u16 LE track count) }
//   CAT  XMID { FORM XMID { TIMB(patch list), EVNT(XMIDI events) } }
//   FORM XDLS { RIFF 'DLS ' or 'MLS ' (little-endian RIFF) }
// 'MLS ' is Miles' compressed DLS: every wave is IMA ADPCM (fmt tag 0x11, 4 bit, 512-byte
// blocks) with an extra 'pcm ' chunk (the original PCM WAVEFORMATEX) and a 'fact' chunk.
// The files are short ambient pieces: a few notes on one or two DLS instruments whose
// samples are long recordings (often looped via wsmp loop points).
//
// parseMusic() splits the file; xmidiToSmf() converts the sequence to a Standard MIDI File
// (format 0, 120 ticks/s like Miles); mlsToDls() turns an MLS bank into a plain PCM DLS that a
// DLS-capable synth (e.g. spessasynth) can load.

const be32 = (b: Uint8Array, p: number) => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
const le32 = (b: Uint8Array, p: number) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const le16 = (b: Uint8Array, p: number) => b[p] | (b[p + 1] << 8);
const fourcc = (b: Uint8Array, p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);

export interface MusicFile {
  trackCount: number;
  /** TIMB: (patch, bank) pairs the sequence uses. */
  timbres: Array<{ patch: number; bank: number }>;
  /** Raw XMIDI EVNT data. */
  events: Uint8Array;
  /** The embedded RIFF ('DLS ' or 'MLS ') bank, whole chunk including the RIFF header. */
  bank: Uint8Array;
  bankType: 'DLS ' | 'MLS ';
}

export function isXmidi(b: Uint8Array): boolean {
  return b.length >= 12 && fourcc(b, 0) === 'FORM' && fourcc(b, 8) === 'XDIR';
}

export function parseMusic(buf: ArrayBuffer | Uint8Array): MusicFile {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!isXmidi(b)) throw new Error('not an XMIDI file');
  let trackCount = 0, events: Uint8Array | null = null, bank: Uint8Array | null = null;
  const timbres: Array<{ patch: number; bank: number }> = [];
  const walk = (p: number, end: number) => {
    while (p + 8 <= end) {
      const id = fourcc(b, p), body = p + 8;
      const size = id === 'RIFF' ? le32(b, p + 4) : be32(b, p + 4); // the embedded bank is a little-endian RIFF
      if (body + size > b.length) throw new Error(`XMIDI chunk ${id} overruns the file`);
      if (id === 'FORM' || id === 'CAT ') walk(body + 4, body + size);
      else if (id === 'INFO') trackCount = le16(b, body);
      else if (id === 'TIMB') {
        const n = le16(b, body);
        for (let i = 0; i < n; i++) timbres.push({ patch: b[body + 2 + i * 2], bank: b[body + 3 + i * 2] });
      } else if (id === 'EVNT') events ??= b.subarray(body, body + size);
      else if (id === 'RIFF') bank ??= b.subarray(p, body + size);
      p = body + size + (size & 1);
    }
  };
  walk(0, b.length);
  if (!events) throw new Error('XMIDI without EVNT');
  if (!bank) throw new Error('XMIDI without DLS bank');
  const bk: Uint8Array = bank;
  const t = fourcc(bk, 8);
  if (t !== 'DLS ' && t !== 'MLS ') throw new Error(`unknown bank type ${t}`);
  return { trackCount, timbres, events, bank: bk, bankType: t };
}

function readVlq(b: Uint8Array, p: number): [number, number] {
  let v = 0, c: number;
  do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80);
  return [v, p];
}

export interface XmidiEvent {
  /** Time in XMIDI ticks (120 per second). */
  time: number;
  /** Raw MIDI message (status + data), or meta (0xFF, type, data...). */
  data: number[];
}

/** Decode XMIDI EVNT data into absolute-time MIDI events (note-ons get matching note-offs). */
export function decodeXmidi(ev: Uint8Array): XmidiEvent[] {
  const out: XmidiEvent[] = [];
  let p = 0, time = 0;
  while (p < ev.length) {
    const s = ev[p];
    if (s < 0x80) { // interval: bytes < 0x80 are summed
      while (p < ev.length && ev[p] < 0x80) time += ev[p++];
      continue;
    }
    p++;
    const hi = s & 0xf0;
    if (s === 0xff) {
      const type = ev[p++];
      const [len, q] = readVlq(ev, p);
      const data = Array.from(ev.subarray(q, q + len));
      p = q + len;
      if (type === 0x2f) break; // end of track
      out.push({ time, data: [0xff, type, ...data] });
    } else if (s === 0xf0 || s === 0xf7) {
      const [len, q] = readVlq(ev, p);
      out.push({ time, data: [s, ...Array.from(ev.subarray(q, q + len))] });
      p = q + len;
    } else if (hi === 0x90) {
      const note = ev[p++], vel = ev[p++];
      const [dur, q] = readVlq(ev, p);
      p = q;
      out.push({ time, data: [s, note, vel] });
      out.push({ time: time + dur, data: [0x80 | (s & 15), note, 0] });
    } else if (hi === 0xc0 || hi === 0xd0) {
      out.push({ time, data: [s, ev[p++]] });
    } else {
      out.push({ time, data: [s, ev[p++], ev[p++]] });
    }
  }
  // stable sort by time, note-offs before other events at the same tick
  return out.map((e, i) => ({ e, i })).sort((a, b) => a.e.time - b.e.time || ((a.e.data[0] & 0xf0) === 0x80 ? -1 : 0) - ((b.e.data[0] & 0xf0) === 0x80 ? -1 : 0) || a.i - b.i).map((x) => x.e);
}

/** Convert XMIDI events to a format-0 Standard MIDI File (60 PPQN at 120 bpm = 120 ticks/s). */
export function xmidiToSmf(ev: Uint8Array): Uint8Array {
  const events = decodeXmidi(ev).filter((e) => !(e.data[0] === 0xff && e.data[1] === 0x51)); // Miles ignores tempo
  const trk: number[] = [];
  const vlq = (v: number) => {
    const bytes = [v & 0x7f];
    while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80);
    trk.push(...bytes);
  };
  vlq(0); trk.push(0xff, 0x51, 3, 0x07, 0xa1, 0x20); // 500000 us per quarter
  let last = 0;
  for (const e of events) {
    vlq(e.time - last); last = e.time;
    const d = e.data;
    if (d[0] === 0xff) { trk.push(0xff, d[1]); vlq(d.length - 2); trk.push(...d.slice(2)); }
    else if (d[0] === 0xf0 || d[0] === 0xf7) { trk.push(d[0]); vlq(d.length - 1); trk.push(...d.slice(1)); }
    else trk.push(...d);
  }
  vlq(0); trk.push(0xff, 0x2f, 0);
  const out = new Uint8Array(14 + 8 + trk.length);
  const dv = new DataView(out.buffer);
  out.set([0x4d, 0x54, 0x68, 0x64], 0); dv.setUint32(4, 6); dv.setUint16(8, 0); dv.setUint16(10, 1); dv.setUint16(12, 60);
  out.set([0x4d, 0x54, 0x72, 0x6b], 14); dv.setUint32(18, trk.length); out.set(trk, 22);
  return out;
}

// ---- DLS / MLS ----

const IMA_STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282,
  1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493,
  10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const IMA_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8];

/** Decode IMA/DVI ADPCM (WAV format 0x11) blocks to interleaved 16-bit PCM. */
export function decodeImaAdpcm(data: Uint8Array, channels: number, blockAlign: number, totalSamples?: number): Int16Array {
  const perBlock = ((blockAlign - 4 * channels) * 8) / (4 * channels) + 1;
  const blocks = Math.ceil(data.length / blockAlign);
  const out = new Int16Array(blocks * perBlock * channels);
  let o = 0;
  for (let b = 0; b < blocks; b++) {
    const base = b * blockAlign, end = Math.min(data.length, base + blockAlign);
    if (end - base < 4 * channels) break;
    const pred: number[] = [], idx: number[] = [];
    for (let c = 0; c < channels; c++) {
      let v = le16(data, base + c * 4); if (v & 0x8000) v -= 0x10000;
      pred.push(v); idx.push(Math.min(88, data[base + c * 4 + 2]));
      out[o + c] = v;
    }
    o += channels;
    // then 4-byte groups per channel, 8 nibbles each (low nibble first)
    let p = base + 4 * channels;
    const groupSamples: number[][] = Array.from({ length: channels }, () => []);
    while (p + 4 * channels <= end) {
      for (let c = 0; c < channels; c++) {
        for (let k = 0; k < 4; k++) {
          const byte = data[p + c * 4 + k];
          for (const nib of [byte & 15, byte >> 4]) {
            const step = IMA_STEP[idx[c]];
            let diff = step >> 3;
            if (nib & 1) diff += step >> 2;
            if (nib & 2) diff += step >> 1;
            if (nib & 4) diff += step;
            pred[c] = Math.max(-32768, Math.min(32767, nib & 8 ? pred[c] - diff : pred[c] + diff));
            idx[c] = Math.max(0, Math.min(88, idx[c] + IMA_INDEX[nib & 7]));
            groupSamples[c].push(pred[c]);
          }
        }
      }
      for (let k = 0; k < 8; k++) for (let c = 0; c < channels; c++) out[o++] = groupSamples[c][k];
      for (const g of groupSamples) g.length = 0;
      p += 4 * channels;
    }
  }
  const n = Math.min(o, totalSamples !== undefined ? totalSamples * channels : o);
  return out.subarray(0, n);
}

interface RiffChunk { id: string; type?: string; start: number; size: number; body: number; children?: RiffChunk[] }

function riffTree(b: Uint8Array, p: number, end: number): RiffChunk[] {
  const out: RiffChunk[] = [];
  while (p + 8 <= end) {
    const id = fourcc(b, p), size = le32(b, p + 4), body = p + 8;
    if (body + size > end) break; // MLS files end with a broken INFO chunk
    const c: RiffChunk = { id, start: p, size, body };
    if (id === 'RIFF' || id === 'LIST') { c.type = fourcc(b, body); c.children = riffTree(b, body + 4, body + size); }
    out.push(c);
    p = body + size + (size & 1);
  }
  return out;
}

export interface DlsWaveInfo {
  name: string;
  formatTag: number;
  channels: number;
  rate: number;
  bits: number;
  dataBytes: number;
  loop: { start: number; length: number } | null;
}

export interface DlsInfo {
  type: string;
  instruments: string[];
  waves: DlsWaveInfo[];
}

const listInfoName = (b: Uint8Array, c: RiffChunk): string => {
  const info = c.children?.find((x) => x.id === 'LIST' && x.type === 'INFO');
  const inam = info?.children?.find((x) => x.id === 'INAM');
  if (!inam) return '';
  let s = '';
  for (let i = 0; i < inam.size && b[inam.body + i]; i++) s += String.fromCharCode(b[inam.body + i]);
  return s;
};

function wsmpLoop(b: Uint8Array, c: RiffChunk | undefined): { start: number; length: number } | null {
  if (!c) return null;
  const cb = le32(b, c.body), loops = le32(b, c.body + 16);
  if (!loops) return null;
  const l = c.body + cb;
  return { start: le32(b, l + 8), length: le32(b, l + 12) };
}

export function inspectDls(bank: Uint8Array): DlsInfo {
  const [root] = riffTree(bank, 0, bank.length);
  if (!root || root.id !== 'RIFF') throw new Error('not a RIFF bank');
  const kids = root.children ?? [];
  const lins = kids.find((c) => c.id === 'LIST' && c.type === 'lins');
  const wvpl = kids.find((c) => c.id === 'LIST' && c.type === 'wvpl');
  const instruments = (lins?.children ?? []).filter((c) => c.type === 'ins ').map((c) => listInfoName(bank, c));
  const waves: DlsWaveInfo[] = (wvpl?.children ?? []).filter((c) => c.type === 'wave').map((w) => {
    const fmt = w.children?.find((c) => c.id === 'fmt ');
    const data = w.children?.find((c) => c.id === 'data');
    if (!fmt || !data) throw new Error('DLS wave without fmt/data');
    return {
      name: listInfoName(bank, w), formatTag: le16(bank, fmt.body), channels: le16(bank, fmt.body + 2),
      rate: le32(bank, fmt.body + 4), bits: le16(bank, fmt.body + 14), dataBytes: data.size,
      loop: wsmpLoop(bank, w.children?.find((c) => c.id === 'wsmp')),
    };
  });
  return { type: root.type ?? '', instruments, waves };
}

/** Rewrite an MLS bank as a standard PCM DLS bank (ADPCM decoded, pool table recomputed). DLS input is returned as is. */
export function mlsToDls(bank: Uint8Array): Uint8Array {
  const [root] = riffTree(bank, 0, bank.length);
  if (!root || root.id !== 'RIFF') throw new Error('not a RIFF bank');
  if (root.type !== 'MLS ' && root.type !== 'DLS ') throw new Error(`unknown bank ${root.type}`);
  const parts: Uint8Array[] = [];
  const chunk = (id: string, body: Uint8Array): Uint8Array => {
    const out = new Uint8Array(8 + body.length + (body.length & 1));
    for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i);
    new DataView(out.buffer).setUint32(4, body.length, true);
    out.set(body, 8);
    return out;
  };
  const list = (id: string, type: string, items: Uint8Array[]): Uint8Array => {
    const len = items.reduce((s, x) => s + x.length, 4);
    const body = new Uint8Array(len);
    for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
    let o = 4;
    for (const x of items) { body.set(x, o); o += x.length; }
    return chunk(id, body);
  };
  const raw = (c: RiffChunk) => bank.subarray(c.start, c.body + c.size + (c.size & 1));
  const convertWave = (w: RiffChunk): Uint8Array => {
    const fmt = w.children!.find((c) => c.id === 'fmt ')!;
    const data = w.children!.find((c) => c.id === 'data')!;
    const fact = w.children!.find((c) => c.id === 'fact');
    const tag = le16(bank, fmt.body), ch = le16(bank, fmt.body + 2), rate = le32(bank, fmt.body + 4);
    const items: Uint8Array[] = [];
    let pcm: Int16Array | null = null;
    if (tag === 0x11) pcm = decodeImaAdpcm(bank.subarray(data.body, data.body + data.size), ch, le16(bank, fmt.body + 12), fact ? le32(bank, fact.body) : undefined);
    for (const c of w.children!) {
      if (c.id === 'pcm ' || c.id === 'fact') continue;
      if (c.id === 'fmt ' && pcm) {
        const f = new Uint8Array(18), dv = new DataView(f.buffer);
        dv.setUint16(0, 1, true); dv.setUint16(2, ch, true); dv.setUint32(4, rate, true);
        dv.setUint32(8, rate * ch * 2, true); dv.setUint16(12, ch * 2, true); dv.setUint16(14, 16, true);
        items.push(chunk('fmt ', f));
      } else if (c.id === 'data' && pcm) items.push(chunk('data', new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)));
      else items.push(raw(c));
    }
    return list('LIST', 'wave', items);
  };
  // an empty `LIST INFO` inside an instrument makes spessasynth's RIFF reader loop forever: leave such lists out
  const rebuild = (c: RiffChunk): Uint8Array => {
    const items = (c.children ?? [])
      .filter((k) => !(k.id === 'LIST' && k.type === 'INFO' && (k.children?.length ?? 0) === 0))
      .map((k) => (k.id === 'LIST' && k.children ? rebuild(k) : raw(k)));
    return list('LIST', c.type ?? '', items);
  };
  const waves: Uint8Array[] = [];
  for (const c of root.children ?? []) if (c.id === 'LIST' && c.type === 'wvpl') for (const w of c.children ?? []) if (w.type === 'wave') waves.push(convertWave(w));
  // pool table: offsets of each wave LIST relative to the wvpl list data (after 'wvpl')
  const offsets: number[] = [];
  let acc = 0;
  for (const w of waves) { offsets.push(acc); acc += w.length; }
  for (const c of root.children ?? []) {
    if (c.id === 'LIST' && c.type === 'wvpl') parts.push(list('LIST', 'wvpl', waves));
    else if (c.id === 'ptbl') {
      // keep the original table entries (a table may list an offset twice and leave an index unused: wlnk
      // chunks refer to the original indices); map each original offset to the rebuilt wave's new offset
      const cb = le32(bank, c.body), n = le32(bank, c.body + 4);
      const orig = Array.from({ length: n }, (_, i) => le32(bank, c.body + cb + i * 4));
      const sorted = [...new Set(orig)].sort((a, b) => a - b);
      const t = new Uint8Array(cb + n * 4), dv = new DataView(t.buffer);
      t.set(bank.subarray(c.body, c.body + cb));
      dv.setUint32(4, n, true);
      orig.forEach((o, i) => dv.setUint32(cb + i * 4, offsets[Math.min(sorted.indexOf(o), offsets.length - 1)], true));
      parts.push(chunk('ptbl', t));
    } else if (c.id === 'LIST' && c.type === 'lins') parts.push(rebuild(c));
    else parts.push(raw(c));
  }
  const out = list('RIFF', 'DLS ', parts);
  // synths index waves by wvpl order, not through the pool table: rewrite every wlnk table index to the wave's rank
  const ptblChunk = (root.children ?? []).find((c) => c.id === 'ptbl');
  if (ptblChunk) {
    const cb = le32(bank, ptblChunk.body), n = le32(bank, ptblChunk.body + 4);
    const orig = Array.from({ length: n }, (_, i) => le32(bank, ptblChunk.body + cb + i * 4));
    const sorted = [...new Set(orig)].sort((a, b) => a - b);
    const rank = orig.map((o) => sorted.indexOf(o));
    if (rank.some((r, i) => r !== i)) {
      const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
      for (let p = 12; p + 24 <= out.length; p++) {
        if (out[p] === 0x77 && out[p + 1] === 0x6c && out[p + 2] === 0x6e && out[p + 3] === 0x6b && dv.getUint32(p + 4, true) === 12) {
          const idx = dv.getUint32(p + 16, true);
          if (idx < rank.length) dv.setUint32(p + 16, rank[idx], true);
        }
      }
    }
  }
  return out;
}
