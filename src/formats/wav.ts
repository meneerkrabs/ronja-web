// sounds/{DIALOUGE.wav,EFFECT.wav}/**.wav: plain RIFF WAVE files (the "*.wav" names of the
// folders are part of the scheme: the engine scans "<dir>\*.wav" recursively, FUN_00451900).
// Almost all are PCM 16-bit mono 22050 Hz; EFFEKT_8_888_Ground.wav is IMA ADPCM (tag 0x11),
// EFFEKT_8_888_Allafryser.wav is 44.1 kHz stereo. sounds/MUSIC.wav/*.wav are XMIDI files (music.ts).
// A sound's name is its file name without extension; sound serial = 0x400000 + registration
// order. Each sound is bound to the track with the same name (or name + "A") and to the other
// tracks of that track's sync group (FUN_00451650).

export interface WavInfo {
  formatTag: number;
  channels: number;
  rate: number;
  blockAlign: number;
  bits: number;
  dataOffset: number;
  dataBytes: number;
  /** Sample frames (from 'fact' for compressed data). */
  frames: number;
  chunks: string[];
}

export function parseWavInfo(buf: ArrayBuffer | Uint8Array): WavInfo {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const cc = (p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
  if (b.length < 12 || cc(0) !== 'RIFF' || cc(8) !== 'WAVE') throw new Error('not a RIFF WAVE file');
  const info: WavInfo = { formatTag: -1, channels: 0, rate: 0, blockAlign: 0, bits: 0, dataOffset: -1, dataBytes: 0, frames: 0, chunks: [] };
  let fact = -1;
  for (let p = 12; p + 8 <= b.length;) {
    const id = cc(p), size = v.getUint32(p + 4, true);
    info.chunks.push(id);
    if (id === 'fmt ') {
      info.formatTag = v.getUint16(p + 8, true); info.channels = v.getUint16(p + 10, true);
      info.rate = v.getUint32(p + 12, true); info.blockAlign = v.getUint16(p + 20, true); info.bits = v.getUint16(p + 22, true);
    } else if (id === 'data') { info.dataOffset = p + 8; info.dataBytes = Math.min(size, b.length - p - 8); }
    else if (id === 'fact') fact = v.getUint32(p + 8, true);
    p += 8 + size + (size & 1);
  }
  if (info.formatTag < 0 || info.dataOffset < 0) throw new Error('WAV without fmt/data');
  info.frames = info.formatTag === 1 ? Math.floor(info.dataBytes / info.blockAlign) : fact;
  return info;
}
