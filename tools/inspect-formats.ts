// node tools/inspect-formats.ts [gameDir] [--out /tmp/ronja-formats] [--write-hw]
//
// Parses every Ronja data file with the src/formats parsers, checks them for consistency,
// prints statistics and renders sample images (PNG via ffmpeg) to the output directory.
// gameDir defaults to the extracted CD folder (the one containing Game.exe).
// --write-hw also writes the hard-wired handle tables to src/data/ronja.hw.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { Surface } from '../src/engine/surface.ts';
import {
  ApcArchive, ApcStream, APC_GRAY16, argb4444ToSprite, backgroundToSurface, blendSprite,
  mapToSurface, sceneMapKind, type Sprite,
} from '../src/formats/apc.ts';
import { parseTracks, trackDuration, TRACK_IGNORE_Z, TRACK_RELATIVE_START } from '../src/formats/trk.ts';
import { parseSceneNfo, perspectiveScale } from '../src/formats/scene-nfo.ts';
import { parseLanguage } from '../src/formats/language.ts';
import { BitmapFont } from '../src/formats/font.ts';
import { parseWavInfo } from '../src/formats/wav.ts';
import { parseMusic, xmidiToSmf, mlsToDls, inspectDls, decodeXmidi } from '../src/formats/music.ts';
import { extractHwTables } from '../src/formats/hw-handles.ts';
import { parseSaveGame, SAVE_SIZE, SAVE_OBJECTS } from '../src/formats/savegame.ts';

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (n: string, d: string) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const OUT = opt('--out', '/tmp/ronja-formats');
const WRITE_HW = flag('--write-hw');
const GAME = args[0] ?? '/Users/sander/Documents/ronja-extract/iso/ronja';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL ${msg}`); };
const check = (ok: boolean, msg: string) => { if (!ok) fail(msg); };
const read = (p: string) => new Uint8Array(readFileSync(join(GAME, p)));
const hist = <T,>(xs: Iterable<T>) => { const m = new Map<string, number>(); for (const x of xs) m.set(String(x), (m.get(String(x)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '); };

/** Write a Surface (optionally with alpha over a checkerboard) as PNG through ffmpeg. */
function savePng(name: string, s: Surface) {
  const raw = Buffer.alloc(s.width * s.height * 4);
  for (let i = 0; i < s.px.length; i++) { const c = s.px[i]; raw[i * 4] = c & 255; raw[i * 4 + 1] = (c >> 8) & 255; raw[i * 4 + 2] = (c >> 16) & 255; raw[i * 4 + 3] = 255; }
  const tmp = join(OUT, `${name}.rgba`);
  writeFileSync(tmp, raw);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${s.width}x${s.height}`, '-i', tmp, '-frames:v', '1', join(OUT, `${name}.png`)]);
  execFileSync('rm', [tmp]);
  console.log(`  wrote ${join(OUT, `${name}.png`)}`);
}
const checker = (w: number, h: number) => { const s = new Surface(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s.px[y * w + x] = ((x >> 3) ^ (y >> 3)) & 1 ? 0xb0b0b0 : 0x808080; return s; };

function sheet(stream: ApcStream, maxFrames = 12, bg?: Surface): Surface {
  const frames = stream.renderAll().slice(0, maxFrames) as Uint16Array[];
  const W = stream.width, H = stream.height;
  const out = checker(W * frames.length, H);
  frames.forEach((px, k) => {
    if (bg) out.bitBlt(k * W, 0, W, H, bg, 0, 0);
    blendSprite(out, argb4444ToSprite(px, W, H), k * W, 0);
  });
  return out;
}

// ---------------- subanis.apc ----------------
console.log('== subanis/subanis.apc');
const apc = ApcArchive.parse(read('subanis/subanis.apc'));
console.log(`  ${apc.entries.length} streams; formats ${hist(apc.entries.map((e) => '0x' + e.format.toString(16)))}`);
const streams = new Map<string, ApcStream>();
let frameTotal = 0, inexact = 0, rawBytes = 0;
const frameKinds: number[] = [], streamFlags: number[] = [];
let cdBorder = 0, cdMaps = 0;
for (const e of apc.entries) {
  const s = apc.loadSync(e, (d) => new Uint8Array(inflateSync(d)));
  rawBytes += s.data.length;
  streams.set(e.name.toLowerCase(), s);
  streamFlags.push(s.streamFlags);
  check(s.width === e.width && s.height === e.height && s.frameCount === e.frameCount, `${e.name}: header mismatch`);
  const px = s.newBuffer();
  for (let i = 0; i < s.frameCount; i++) {
    frameTotal++;
    const f = s.frames[i];
    frameKinds.push(f.flags);
    check(f.x + f.w <= s.width && f.y + f.h <= s.height, `${e.name}#${i}: rect outside stream`);
    if (!s.applyFrame(px, i)) { inexact++; if (inexact < 10) fail(`${e.name}#${i}: frame data does not cover its rectangle exactly`); }
    if (i === 0) check((f.flags & 1) === 0, `${e.name}: first frame is a delta frame`);
  }
  if (s.format === APC_GRAY16) {
    cdMaps++;
    // top row and left column hold 0xCDCD (uninitialised memory in the packer)
    let ok = true;
    for (let x = 0; x < s.width; x++) if (px[x] !== 0xcdcd) ok = false;
    for (let y = 0; y < s.height; y++) if (px[y * s.width] !== 0xcdcd) ok = false;
    if (ok) cdBorder++;
  }
}
console.log(`  ${frameTotal} frames (${hist(frameKinds.map((f) => ['raw', 'raw-delta', 'rle-key', 'rle-delta'][f & 3]))}), ${(rawBytes / 1048576).toFixed(1)} MB inflated, ${inexact} inexact`);
console.log(`  stream flags (+0x14): ${hist(streamFlags)}; GRAY16 maps with 0xCDCD top row + left column: ${cdBorder}/${cdMaps}`);
console.log(`  scene maps: ${hist(apc.entries.map((e) => sceneMapKind(e) ?? 'sprite'))}`);
const quarter = apc.entries.filter((e) => sceneMapKind(e) === 'restriction' || sceneMapKind(e) === 'info');
check(quarter.every((e) => { const bg = apc.find(e.name.slice(0, -1)); return !bg || (bg.width === e.width * 4 && bg.height === e.height * 4); }), 'quarter-res maps do not match backgrounds');

const S = (n: string) => { const s = streams.get(n.toLowerCase()); if (!s) throw new Error(`no stream ${n}`); return s; };
savePng('apc_birk_walk_syd', sheet(S('birk__234_###_syd')));
savePng('apc_ronja_walk_vast', sheet(S('ronja__234_###_vast')));
savePng('apc_snoboll', sheet(S('__Gen_###_snoboll')));
savePng('apc_cursors', (() => {
  const names = ['___###_stdCursor', 'PEKARE__gen_###_normal', 'PEKARE__gen_###_hilite', 'PEKARE__gen_###_riktadN', 'PEKARE__gen_###_riktadO', 'TATITA__gen_###_TaHilite'];
  const out = checker(names.length * 112, 104);
  names.forEach((n, k) => { const s = S(n); blendSprite(out, argb4444ToSprite(s.renderFrame(0) as Uint16Array, s.width, s.height), k * 112, 0); });
  return out;
})());
savePng('apc_main_menu', sheet(S('_main__###_MainGfx'), 4));
for (const name of ['_2a__###_SceneGFXBorggarden', '_10__###_SceneGFXKaellan']) {
  const s = S(name), bg = backgroundToSurface(s.renderFrame(0) as Uint16Array, s.width, s.height);
  savePng(`apc_bg_${name.split('GFX')[1]}`, bg);
  for (const k of ['H', 'Z', 'R', 'I']) { const m = S(name + k); savePng(`apc_map_${name.split('GFX')[1]}_${k}`, mapToSurface(m.renderFrame(0), m.width, m.height)); }
}
// composite: Ronja standing in the Borggarden at her track position
{
  const bgS = S('_2a__###_SceneGFXBorggarden');
  const scene = backgroundToSurface(bgS.renderFrame(0) as Uint16Array, bgS.width, bgS.height);
  const view = new Surface(640, 480); view.bitBlt(0, 0, 640, 480, scene, 600, 0);
  const r = S('ronja__234_###_stillSydost');
  blendSprite(view, argb4444ToSprite(r.renderFrame(0) as Uint16Array, r.width, r.height), 319 - 64, 397 - 169);
  savePng('apc_composite_borggarden_ronja', view);
}

// ---------------- tracks.trk ----------------
console.log('== tracks/tracks.trk');
const trk = parseTracks(read('tracks/tracks.trk'));
const keys = trk.tracks.flatMap((t) => t.keys);
console.log(`  ${trk.tracks.length} tracks, ${keys.length} keys, ${trk.syncGroups.size} sync groups (${[...trk.syncGroups.values()].filter((g) => g.length > 1).length} with >1 track)`);
console.log(`  track flags ${hist(trk.tracks.map((t) => (t.flags & TRACK_RELATIVE_START ? 'rel' : 'abs') + (t.flags & TRACK_IGNORE_Z ? '+noZ' : '')))}`);
console.log(`  frameTime(ms) ${hist(keys.map((k) => k.frameTime)).split(' ').slice(0, 8).join(' ')}; key flags ${hist(keys.map((k) => k.flags))}`);
console.log(`  subanis/track ${hist(trk.tracks.map((t) => t.subAnis.length))}; timeSync loops: ${trk.tracks.filter((t) => t.timeSyncLoopLabel >= 0).length}`);
console.log(`  actors ${hist(trk.tracks.map((t) => t.actor.toLowerCase())).split(' ').slice(0, 12).join(' ')} ...`);
const hw = extractHwTables(read('Game.exe'));
const dirs = new Set(hw.directions.map((d) => d.toLowerCase()));
let unresolved = 0, badFrame = 0;
for (const t of trk.tracks) {
  t.keys.forEach((k, i) => check(k.frame === i, `${t.name}: key ${i} has frame ${k.frame}`));
  for (const k of t.keys) {
    const name = t.subAnis[k.subAni];
    const s = streams.get(name.toLowerCase());
    if (s) { if (k.subAniFrame < 0 || k.subAniFrame >= s.frameCount) badFrame++; }
    else if (!trk.byName.has(name.toLowerCase()) && !dirs.has(name.toLowerCase())) unresolved++;
  }
  check(t.timeSyncLoopLabel < 0 || (t.timeSyncLoopLabel <= t.timeSyncLoopPoint && t.timeSyncLoopPoint < t.keys.length), `${t.name}: bad time-sync loop`);
}
check(unresolved === 0, `${unresolved} track keys reference unknown subanis`);
check(badFrame === 0, `${badFrame} track keys reference frames past the subani end`);
const longest = [...trk.tracks].sort((a, b) => trackDuration(b) - trackDuration(a))[0];
console.log(`  longest track ${longest.name} ${(trackDuration(longest) / 1000).toFixed(1)} s; all key subanis resolve: ${unresolved === 0}, frames in range: ${badFrame === 0}`);
// render one track's frames in sequence with its movement applied
{
  const t = trk.byName.get('ronja__234_vast')!;
  const out = new Surface(640, 220, 0x406040);
  let x = 560, y = 200;
  for (const k of t.keys) {
    const s = S(t.subAnis[k.subAni]);
    x += k.moveX * 12; y += k.moveY * 12;
    blendSprite(out, argb4444ToSprite(s.renderFrame(k.subAniFrame) as Uint16Array, s.width, s.height), Math.round(x - k.cx), Math.round(y - k.cy));
  }
  savePng('trk_ronja_vast_strip', out);
}

// ---------------- HW handle tables ----------------
console.log('== Game.exe hard-wired handle tables');
const missSub = hw.subanis.filter((n) => !apc.find(n));
const missTrk = hw.tracks.filter((n) => !trk.byName.has(n.toLowerCase()));
console.log(`  ${hw.subanis.length} subani handles (${missSub.length} unresolved), ${hw.tracks.length} track handles (${missTrk.length} unresolved), ${hw.trackCallbacks.length} track callbacks, ${hw.trackFollowUps.length} follow-ups`);
check(missSub.length === 0 && missTrk.length === 0, `unresolved HW names: ${[...missSub, ...missTrk].slice(0, 5).join(', ')}`);
check(hw.trackFollowUps.every(([a, b]) => trk.byName.has(a.toLowerCase()) && trk.byName.has(b.toLowerCase())), 'follow-up tracks unresolved');
if (WRITE_HW) {
  const p = new URL('../src/data/ronja.hw.json', import.meta.url);
  writeFileSync(p, JSON.stringify(hw, null, 0) + '\n');
  console.log(`  wrote ${p.pathname}`);
}

// ---------------- scene.nfo ----------------
console.log('== scene.nfo');
const nfo = parseSceneNfo(read('scene.nfo'));
check(nfo.length === 21, `scene.nfo has ${nfo.length} records`);
console.log('  ' + nfo.map((n) => `${n.scene.replace(/^ID_/, '')}=${n.focal}${n.zOffset ? '/' + n.zOffset : ''}`).join(' '));
const bg = nfo.find((n) => n.scene === 'ID_2A_BORGGARDEN')!;
console.log(`  Borggarden scale at z=1700: ${perspectiveScale(bg, 1700).toFixed(3)}, z=4000: ${perspectiveScale(bg, 4000).toFixed(3)}`);

// ---------------- language.str ----------------
console.log('== language.str');
const lang = parseLanguage(read('language.str'));
check(lang.entries.length === lang.declaredCount, `language.str: ${lang.entries.length} entries, header says ${lang.declaredCount}`);
console.log(`  ${lang.entries.length} entries, ${lang.byKey.size} distinct keys; e.g. "${lang.entries[18].key}" = "${lang.entries[18].text}"`);
const nonAscii = new Set(lang.entries.flatMap((e) => [...e.text].filter((c) => c.charCodeAt(0) > 127)));
console.log(`  non-ASCII chars: ${[...nonAscii].join(' ')}`);

// ---------------- font ----------------
console.log('== normalFont.fnt / .sz');
const font = BitmapFont.parse(read('normalFont.fnt'), read('normalFont.sz'));
check(font.atlas.surface.width === 256 && font.atlas.surface.height === 256, 'font atlas not 256x256');
const defined = font.glyphs.filter((g, i) => i >= 32 && g.width > 0);
console.log(`  atlas ${font.atlas.surface.width}x${font.atlas.surface.height}, alpha ${hist(font.atlas.alpha)}; ascent ${hist(font.glyphs.map((g) => g.ascent))}; ${defined.length} glyphs`);
{
  const atlas = checker(256, 256);
  blendSprite(atlas, font.atlas as Sprite, 0, 0);
  savePng('font_atlas', atlas);
  const s = new Surface(640, 120, 0x203040);
  font.draw(s, 10, 4, 'Ik heb niets te doen.');
  font.draw(s, 10, 30, lang.entries[1].text + ' ' + lang.entries[3].text);
  font.draw(s, 10, 56, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789');
  font.draw(s, 10, 82, 'abcdefghijklmnopqrstuvwxyz åäö ÅÄÖ é ë ’');
  savePng('font_text', s);
}

// ---------------- sounds ----------------
console.log('== sounds');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(GAME, 'sounds'));
const wavs = files.filter((f) => !f.includes('/MUSIC.wav/'));
const fmts: string[] = [];
for (const f of wavs) {
  try { const w = parseWavInfo(readFileSync(f)); fmts.push(`${w.formatTag === 1 ? 'PCM' : w.formatTag === 0x11 ? 'IMA' : w.formatTag}/${w.channels}ch/${w.rate}/${w.bits}b`); }
  catch (e) { fail(`${f}: ${(e as Error).message}`); }
}
console.log(`  ${wavs.length} WAVs: ${hist(fmts)}`);
const music = files.filter((f) => f.includes('/MUSIC.wav/'));
for (const f of music) {
  try {
    const m = parseMusic(readFileSync(f));
    const ev = decodeXmidi(m.events);
    const smf = xmidiToSmf(m.events);
    const dls = mlsToDls(m.bank);
    const info = inspectDls(dls);
    check(info.type === 'DLS ' && info.waves.every((w) => w.formatTag === 1), `${basename(f)}: DLS conversion left non-PCM waves`);
    const notes = ev.filter((e) => (e.data[0] & 0xf0) === 0x90).length;
    const len = ev.length ? ev[ev.length - 1].time / 120 : 0;
    console.log(`  ${basename(f).padEnd(32)} ${m.bankType} ${String(notes).padStart(3)} notes ${len.toFixed(1).padStart(6)} s  instr [${info.instruments.join(', ')}] waves ${info.waves.map((w) => `${w.name || '?'}(${w.rate}Hz${w.loop ? ' loop' : ''})`).join(' ')}`);
    if (basename(f) === 'dls_eld_40_.wav') { writeFileSync(join(OUT, 'dls_eld_40_.mid'), smf); writeFileSync(join(OUT, 'dls_eld_40_.dls'), dls); }
  } catch (e) { fail(`${basename(f)}: ${(e as Error).message}`); }
}

// ---------------- savegame (synthetic: no saves ship with the game) ----------------
console.log('== savegame (synthetic round trip)');
{
  const b = new Uint8Array(SAVE_SIZE), v = new DataView(b.buffer);
  v.setUint32(9600 + 88, 0x58, true);
  const objAt = 9600 + 92;
  v.setUint32(objAt, 1234, true); v.setFloat32(objAt + 8, 812.5, true);
  v.setUint32(objAt + 49 * 55 + 8 + 32, 0x8f, true);
  const sg = parseSaveGame(b);
  check(sg.objects.length === SAVE_OBJECTS.length && sg.objects[0].id === 1234 && sg.objects[0].x === 812.5 && sg.blockList.length === 0x8f, 'savegame parser offsets');
  console.log(`  ${SAVE_SIZE} bytes, ${sg.objects.length} objects, ${sg.blockList.length} block entries`);
  for (let i = 0; i < 16; i++) if (existsSync(join(GAME, `RONJAS${i}.sav`))) console.log(`  found RONJAS${i}.sav`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall formats parsed without errors');
process.exit(failures ? 1 : 0);
