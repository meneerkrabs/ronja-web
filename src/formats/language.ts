// language.str: the Dutch texts of the dialogue choices ("Alt" lines).
//   u32 count (173; ignored by the engine)
//   count x { cstr soundKey ; cstr text }   (Windows-1252, NUL-terminated)
// The loader (FUN_0041cc40) does NOT look keys up: it walks the file in order and assigns the
// i-th text to the i-th hard-wired dialogue object (table at 0x49AB98, 173 entries), so the
// order is significant and keys repeat (the same choice offered in several menus).

import { Reader } from './bytes.ts';

export interface LanguageEntry {
  /** Sound/track name of the spoken line, e.g. RONJA_1a_013A1Alt1_JagHarInget. */
  key: string;
  text: string;
}

export interface LanguageFile {
  declaredCount: number;
  entries: LanguageEntry[];
  /** Lower-cased key -> text (first occurrence). */
  byKey: Map<string, string>;
}

export function parseLanguage(buf: ArrayBuffer | Uint8Array): LanguageFile {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const declaredCount = r.u32();
  const entries: LanguageEntry[] = [];
  while (!r.eof) {
    const key = r.cstr();
    const text = r.cstr();
    entries.push({ key, text });
  }
  const byKey = new Map<string, string>();
  for (const e of entries) if (!byKey.has(e.key.toLowerCase())) byKey.set(e.key.toLowerCase(), e.text);
  return { declaredCount, entries, byKey };
}
