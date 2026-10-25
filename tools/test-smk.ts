// node tools/test-smk.ts <file.smk> [maxFrames] [--png dir frames,comma,separated]
// Decodes a Smacker file and compares every frame (pixel exact) and audio track 0 with ffmpeg.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { Smacker } from '../src/engine/smacker.ts';
import { Surface } from '../src/engine/surface.ts';

const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error('usage: node tools/test-smk.ts <file> [maxFrames] [--png dir f1,f2,..]'); process.exit(1); }
const pngIdx = args.indexOf('--png');
const pngDir = pngIdx >= 0 ? args[pngIdx + 1] : null;
const pngFrames = pngIdx >= 0 ? args[pngIdx + 2].split(',').map(Number) : [];
const maxArg = args[1] && !args[1].startsWith('--') ? Number(args[1]) : Infinity;

const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTab[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(s: Surface): Buffer {
  const raw = Buffer.alloc((s.width * 3 + 1) * s.height);
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
    const c = s.px[y * s.width + x], o = y * (s.width * 3 + 1) + 1 + x * 3;
    raw[o] = c & 255; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = (c >> 16) & 255;
  }
  const chunk = (t: string, d: Buffer) => {
    const out = Buffer.alloc(12 + d.length);
    out.writeUInt32BE(d.length, 0); out.write(t, 4, 'latin1'); d.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + d.length)), 8 + d.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.width, 0); ihdr.writeUInt32BE(s.height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const buf = readFileSync(file);
const smk = new Smacker(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const tr = smk.audioTracks[0];
console.log(`${file}: SMK${smk.version} ${smk.width}x${smk.height} frames=${smk.frameCount} fps=${smk.fps.toFixed(3)} flags(ring=${smk.ring},yint=${smk.yInterlaced},ydbl=${smk.yDouble})`);
console.log(`  audio0: ${tr.present ? `${tr.rate}Hz ${tr.channels}ch ${tr.bits}bit ${tr.packed ? 'packed' : 'raw'}` : 'none'}`);

const N = Math.min(smk.frameCount, maxArg);
const out = new Surface(smk.width, smk.height);
const fsz = smk.width * smk.height * 3;

// video: stream ffmpeg rawvideo and compare each frame
const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-fps_mode', 'passthrough', '-frames:v', String(N), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
let pending = Buffer.alloc(0), n = 0, bad = 0, firstBad = -1, palChanges = 0, lastPal = '';
const t0 = Date.now();
const check = (ref: Buffer) => {
  smk.frame(n, out);
  const pk = Buffer.from(smk.palette.buffer).toString('base64');
  if (pk !== lastPal) { palChanges++; lastPal = pk; }
  let diff = 0;
  for (let i = 0; i < out.px.length; i++) {
    const c = out.px[i];
    if (ref[i * 3] !== (c & 255) || ref[i * 3 + 1] !== ((c >> 8) & 255) || ref[i * 3 + 2] !== ((c >> 16) & 255)) diff++;
  }
  if (diff) { bad++; if (firstBad < 0) firstBad = n; if (bad <= 3) console.log(`  frame ${n}: ${diff} pixels differ`); }
  if (pngDir && pngFrames.includes(n)) { mkdirSync(pngDir, { recursive: true }); writeFileSync(`${pngDir}/${file.split('/').pop()!.replace('.smk', '')}-${n}.png`, png(out)); }
  n++;
};
await new Promise<void>((res) => {
  ff.stdout.on('data', (d: Buffer) => {
    pending = pending.length ? Buffer.concat([pending, d]) : d;
    while (pending.length >= fsz) { check(pending.subarray(0, fsz)); pending = pending.subarray(fsz); }
  });
  ff.on('close', () => res());
});
console.log(`  video: ffmpeg frames=${n} compared, mismatching frames=${bad}${firstBad >= 0 ? ` (first ${firstBad})` : ''}, palette changes seen=${palChanges}, ${Date.now() - t0}ms`);
if (n !== N) console.log(`  WARNING ffmpeg gave ${n} frames, expected ${N}`);

// audio
if (tr.present && maxArg === Infinity) {
  const ref = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 - 1 });
  const rf = new Float32Array(ref.buffer.slice(ref.byteOffset, ref.byteOffset + ref.byteLength));
  const mine = smk.audioSamples(0)!;
  const ch = mine.data.length, len = mine.data[0].length;
  let maxErr = 0, mism = 0;
  const cmp = Math.min(len, Math.floor(rf.length / ch));
  for (let i = 0; i < cmp; i++) for (let c = 0; c < ch; c++) {
    const e = Math.abs(mine.data[c][i] - rf[i * ch + c]);
    if (e > 1e-6) mism++;
    if (e > maxErr) maxErr = e;
  }
  console.log(`  audio: mine=${len} samples/ch, ffmpeg=${Math.floor(rf.length / ch)}, compared=${cmp}, mismatching samples=${mism}, maxErr=${maxErr.toExponential(2)}`);
} else if (!tr.present) console.log('  audio: none');
