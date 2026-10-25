// Interaction database and dialogue engine (engine.md §4.3b/§4.4, §5): hotspot groups with use counters,
// events (voice lines with lip-sync tracks, choices, follow-up events), the dialogue-animation tracks and
// the choice menu at the bottom of the screen. All of it is static data compiled into the original exe
// (src/data/dialog-events.json); the code here is the interpreter.

import eventsJson from '../data/dialog-events.json';
import type { Track } from '../formats/trk.ts';
import { encodeCp1252 } from '../formats/bytes.ts';
import { core, dlog } from './core.ts';
import { sample, loadSound } from './audio-game.ts';
import { lastDialog, useCount } from './state.ts';
import { O, world, type Obj } from './world.ts';
import { TF_LIPSYNC, TF_TALK, type DispatchVerb } from './types.ts';
import { OBJECT_NAMES } from './types.ts';
import type { Renderer } from './render.ts';

export interface DialogAlt { alt: number; sound: string; text: string; next: string | null }
export interface DialogEvent {
  id: number;
  name: string;
  group: number;
  verb: 'script' | 'eye' | 'mouth' | 'hand';
  /** 0 = scripted, 1 = first use, 2 = second, 3 = third and later */
  minUse: number;
  next: string | null;
  says: string[];
  alts: DialogAlt[];
}

export const EVENTS: DialogEvent[] = (eventsJson as { events: DialogEvent[] }).events;
const byId = new Map<number, DialogEvent>();
const byName = new Map<string, DialogEvent>();
for (const e of EVENTS) { byId.set(e.id, e); byName.set(e.name.toLowerCase(), e); }

export const eventById = (id: number) => byId.get(id);
/** Event by name, e.g. "_2a_002A1_Formaning" (case-insensitive). */
export const eventByName = (name: string) => byName.get(name.toLowerCase());

const VERB_NAMES = ['mouth', 'hand', 'eye'] as const;
/** groups[g][verbIndex] = events in declaration order */
const groups: DialogEvent[][][] = [];
for (const e of EVENTS) {
  if (e.verb === 'script') continue;
  (groups[e.group] ??= [[], [], []])[VERB_NAMES.indexOf(e.verb)].push(e);
}

export type DoneCb = (cancelled: boolean) => void;

// ------------------------------------------------------------------ sounds -> tracks -> actors

const ALIASES: Record<string, number> = { labbas: 11, labas: 11, rattan: 38 };
/** Object id of an actor prefix (FUN_0045a620); 0 = none (EFFEKT, DLS, ROVARNA, GRADVARGARNA, odd track prefixes). */
export function actorId(prefix: string): number {
  const p = prefix.toLowerCase();
  const i = OBJECT_NAMES.findIndex((n) => n.toLowerCase() === p);
  return i >= 0 ? i + 1 : ALIASES[p] ?? 0;
}

interface SoundInfo { actor: number; tracks: Track[] }
const soundInfos = new Map<string, SoundInfo>();
/** Which actor speaks a sound, and which tracks animate it (FUN_00451650): the track named like the sound (or +"A") and its sync group. */
export function soundInfo(name: string): SoundInfo {
  const k = name.toLowerCase();
  let si = soundInfos.get(k);
  if (si) return si;
  const A = core.assets;
  const prefix = name.split('_')[0];
  const primary = A.track(name) ?? A.track(name + 'A');
  const tracks: Track[] = [];
  if (primary) {
    tracks.push(primary);
    const us = name.indexOf('_');
    const suffix = (us >= 0 ? name.slice(us + 1) : '').toLowerCase();
    const grp = A.tracks.syncGroups.get(suffix) ?? A.tracks.syncGroups.get(suffix + 'a');
    for (const idx of grp ?? []) {
      const t = A.tracks.tracks[idx];
      if (t !== primary) tracks.push(t);
    }
  }
  si = { actor: actorId(prefix), tracks };
  soundInfos.set(k, si);
  return si;
}

/**
 * playSound (FUN_00458090): play a voice line with its lip-sync tracks. `cb(false)` when the line (the speaker's
 * talk animation) is over, `cb(true)` if it was interrupted. Lines without actor (effects) play on the sample channel.
 */
export function playSound(name: string, cb: DoneCb): void {
  const si = soundInfo(name);
  if (si.tracks.length > 0) {
    let first = true;
    for (const t of si.tracks) {
      const owner = actorId(t.actor);
      const obj = owner ? world.objs[owner - 1] : null;
      if (!owner || !obj) continue;
      if (first) obj.setTrack(t, TF_TALK, (interrupted) => cb(interrupted), name);
      else obj.setTrack(t, TF_LIPSYNC, null, name);
      obj.show();
      first = false;
    }
    if (first) { sample.play(name, 100, 64); cb(false); }
    return;
  }
  if (si.actor === 0) { sample.play(name, 100, 64); cb(false); return; }
  const obj = world.objs[si.actor - 1];
  if (!obj.talk(TF_TALK, (interrupted) => cb(interrupted), name)) {
    // actor without talk animation: just the sound, ended at once (the original proceeds immediately)
    sample.play(name, 100, 64);
    cb(false);
  } else obj.show();
}

// ------------------------------------------------------------------ choice lines

interface Choice { text: string; cb: () => void }
const choices: Choice[] = [];
const choiceW: number[] = [];
let textBuf: Uint16Array | null = null;
let atlas4: Uint16Array | null = null;

function ensureText() {
  if (textBuf) return;
  textBuf = new Uint16Array(640 * 100);
  const a = core.assets.font.atlas;
  atlas4 = new Uint16Array(a.surface.px.length);
  for (let i = 0; i < atlas4.length; i++) {
    const c = a.surface.px[i];
    atlas4[i] = ((a.alpha[i] >> 4) << 12) | (((c & 255) >> 4) << 8) | ((((c >> 8) & 255) >> 4) << 4) | (((c >> 16) & 255) >> 4);
  }
}

/** Number of choice lines currently shown. */
export const choiceCount = () => choices.length;

/** AddTextInputLine (FUN_0046ccc0): at most 5 lines, bottom aligned; returns false if full/empty. */
export function addChoiceLine(text: string, cb: () => void): boolean {
  if (choices.length >= 5 || !text) return false;
  choices.push({ text, cb });
  renderChoices();
  return true;
}

/** FUN_0046cdc0: clear the lines. */
export function clearChoiceLines() {
  choices.length = 0;
  choiceW.length = 0;
}

function renderChoices() {
  ensureText();
  const buf = textBuf!, font = core.assets.font;
  buf.fill(0x4fff); // translucent white strip
  choiceW.length = 0;
  const n = choices.length;
  for (let i = 0; i < n; i++) {
    const row = 5 - n + i;
    let x = 0;
    for (const c of encodeCp1252(choices[i].text)) {
      const g = font.glyphs[c];
      const ty0 = row * 20 + 16 - g.ascent;
      for (let j = 0; j < g.height; j++) {
        const ty = ty0 + j;
        if (ty < 0 || ty >= 100) continue;
        for (let k = 0; k < g.width; k++) {
          const tx = x + k;
          if (tx >= 640) break;
          buf[ty * 640 + tx] = atlas4![(g.y + j) * 256 + g.x + k];
        }
      }
      x += g.width;
    }
    choiceW[row] = x;
  }
}

export function drawChoices(r: Renderer) {
  const n = choices.length;
  if (!n) return;
  for (let row = 5 - n; row < 5; row++) {
    if (!choiceW[row]) continue;
    r.drawPixels(textBuf!, 640, 0, row * 20, 640, 20, 0, 380 + 20 * row);
  }
}

/** Mouse click on the choice lines (0x405db0): the row is hit only left of the text's end. Returns true if a line was chosen. */
export function clickChoice(x: number, y: number): boolean {
  const n = choices.length;
  if (!n) return false;
  for (let row = 5 - n; row < 5; row++) {
    if (y >= 380 + 20 * row && y < 400 + 20 * row && x < (choiceW[row] ?? 0)) {
      const c = choices[row - (5 - n)];
      c.cb();
      return true;
    }
  }
  return false;
}

/** y clamp for the mouse while choices show (0x404d90). */
export function choiceMinY(): number {
  const n = choices.length;
  return n ? 380 + 20 * (5 - n) : 0;
}

// ------------------------------------------------------------------ the dialogue state machine

interface DState {
  event: DialogEvent | null;
  sayIdx: number;
  chosen: number;
  doneCb: DoneCb | null;
  actor: Obj | null;
  force: boolean;
}
const st: DState = { event: null, sayIdx: 0, chosen: -1, doneCb: null, actor: null, force: false };

/** UI hooks implemented by the engine (disable/enable input while a dialogue runs). */
export const dialogHooks = { disableUi: () => {}, enableUi: () => {} };

/** True while a dialogue event chain is running (UI busy). */
export const dialogActive = (): boolean => st.event !== null;
/** True while the player is asked to choose. */
export const choosing = (): boolean => choices.length > 0;
export const dialogSkip = { active: false };

/**
 * DoDialogAni (FUN_0046da60): play event `id`: the actor (if any) walks to the start of the event's animation
 * track (unless `force`) and plays it; then the voice lines; then the choices (if the event has alts) or the next event.
 * `doneCb(cancelled)` is called once for the whole chain; `lastDialog.event/alt` are valid inside it.
 */
export function doDialogAni(id: number, doneCb: DoneCb | null = null, actor: Obj | null = null, force = false): void {
  dialogHooks.disableUi();
  const ev = byId.get(id);
  if (!ev) { console.warn('dialog event not found:', id); dialogHooks.enableUi(); doneCb?.(true); return; }
  dlog('dialog', id, ev.name);
  st.event = ev; st.sayIdx = 0; st.chosen = -1; st.doneCb = doneCb; st.actor = actor; st.force = force;
  for (const s of ev.says) void loadSound(s); // warm the cache
  for (const a of ev.alts) void loadSound(a.sound);
  if (actor) {
    const key = ev.name.slice(1).toLowerCase();
    const grp = core.assets.tracks.syncGroups.get(key) ?? core.assets.tracks.syncGroups.get(key + 'a');
    if (grp && grp.length) {
      const first = core.assets.tracks.tracks[grp[0]];
      const play = () => actor.setTrack(first, 0x100, (interrupted) => (interrupted ? endDialog(true) : step()));
      if (!force) actor.walkToTrackStart(first, (interrupted) => { if (!interrupted) play(); else endDialog(true); });
      else play();
      return;
    }
  }
  step();
}

/** The "dialogue animation" track of an event (the first track of its sync group), if any. */
export function dialogTrack(ev: DialogEvent): Track | undefined {
  const key = ev.name.slice(1).toLowerCase();
  const grp = core.assets.tracks.syncGroups.get(key) ?? core.assets.tracks.syncGroups.get(key + 'a');
  return grp?.length ? core.assets.tracks.tracks[grp[0]] : undefined;
}

function endDialog(cancelled: boolean) {
  const ev = st.event;
  lastDialog.event = ev ? ev.id : -1;
  lastDialog.alt = st.chosen;
  const cb = st.doneCb;
  st.doneCb = null; st.event = null; st.sayIdx = 0; st.chosen = -1; st.actor = null;
  dialogSkip.active = false;
  clearChoiceLines();
  cb?.(cancelled);
  dialogHooks.enableUi();
  lastDialog.event = -1; lastDialog.alt = -1;
}

function step() {
  const ev = st.event;
  if (!ev) return;
  if (st.sayIdx < ev.says.length) {
    playSound(ev.says[st.sayIdx], (cancelled) => { if (cancelled) endDialog(true); else { st.sayIdx++; step(); } });
    return;
  }
  if (ev.alts.length > 0 && st.chosen === -1) {
    clearChoiceLines();
    // the choice texts come from language.str on the CD, assigned by position (FUN_0041cc40)
    ev.alts.slice(0, 5).forEach((a, i) => addChoiceLine(core.assets.lang.entries[a.alt]?.text ?? '', () => { st.chosen = i; clearChoiceLines(); step(); }));
    dialogSkip.active = false;
    return;
  }
  if (st.chosen < 0) {
    const nx = ev.next ? eventByName(ev.next) : undefined;
    if (nx) { doDialogAni(nx.id, st.doneCb, st.actor, false); return; }
    endDialog(false);
    return;
  }
  const alt = ev.alts[st.chosen];
  playSound(alt.sound, (cancelled) => {
    if (cancelled) { endDialog(true); return; }
    const nx = alt.next && alt.next !== '0' ? eventByName(alt.next) : undefined;
    if (nx) doDialogAni(nx.id, st.doneCb, st.actor, true);
    else endDialog(false);
  });
}

/** FUN_0046d530(0): end the running dialogue now (done callback, UI re-enabled); hooks use it before a scene change. */
export function finishDialog(cancelled = false) {
  if (st.event) endDialog(cancelled);
}

/** Cancel the running dialogue (e.g. scene change): no done callback chain beyond `cancelled=true`. */
export function abortDialog() {
  if (st.event) endDialog(true);
}

// ------------------------------------------------------------------ hotspot groups

/** Which event the group's verb list would play next (without counting a use). */
export function pickEvent(group: number, v: DispatchVerb, n: number): DialogEvent | undefined {
  const list = groups[group]?.[v];
  if (!list || list.length === 0) return undefined;
  let pick = list[0];
  for (const e of list) if (e.minUse <= n + 1) pick = e;
  return pick;
}

/**
 * Dispatcher (FUN_0046dbb0): verb 0 = MOUTH, 1 = HAND, 2 = EYE of hotspot group `group`. Counts the use, picks the
 * event by use count (last event whose minUse <= uses+1, else the first) and plays it.
 */
export function dispatch(group: number, v: DispatchVerb, doneCb: DoneCb | null = null, actor: Obj | null = O.RONJA, force = false): void {
  if (group < 0 || group >= 143) return;
  const idx = group * 3 + v;
  const n = useCount[idx]++;
  const e = pickEvent(group, v, n);
  if (!e) return;
  doDialogAni(e.id, doneCb, actor, force);
}

/** Fast-forward the running dialogue ("Sla over"): stop the voice and run all animation keys to their end. */
export function skipDialogStep() {
  dialogSkip.active = true;
}

/** Called every frame: while skipping, cut voices and fast-forward the dialogue animations (their hooks still fire). */
export function updateDialogSkip() {
  if (!dialogSkip.active) return;
  if (!st.event || choices.length) { dialogSkip.active = false; return; }
  sample.stop();
  for (const o of world.objs) {
    if (o.track && (o.trackFlags & 0x100)) o.lastTime -= 600000;
  }
}

