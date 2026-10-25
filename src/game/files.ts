// The game's data files ("ronja/" folder of the CD) on top of a Vfs, with case-insensitive lookup
// (archive.org is case-sensitive, ISO/CD readers upper-case everything) and foreground progress
// reporting for the loading bar.

import type { Vfs } from '../engine/vfs.ts';

export class GameFiles {
  readonly vfs: Vfs;
  private byLower = new Map<string, string>();
  /** lower-case sound name (file name without .wav) -> vfs path, for sounds/ (speech + effects) */
  readonly sounds = new Map<string, string>();
  /** lower-case music name -> vfs path (sounds/MUSIC.wav/dls_*.wav) */
  readonly music = new Map<string, string>();
  /** Loading bar: (done, total) bytes, (0, 0) = idle. */
  onProgress: ((done: number, total: number) => void) | null = null;
  private fg = { done: 0, total: 0 };
  private fgGen = 0;

  constructor(vfs: Vfs) {
    this.vfs = vfs;
    for (const p of vfs.list()) {
      const lower = p.toLowerCase();
      this.byLower.set(lower, p);
      if (lower.startsWith('sounds/') && lower.endsWith('.wav')) {
        const name = lower.split('/').pop()!.slice(0, -4);
        if (lower.includes('/music.wav/')) this.music.set(name, p);
        else this.sounds.set(name, p);
      }
    }
  }

  static looksLikeRonja(list: string[]): boolean {
    return list.some((p) => p.toLowerCase() === 'subanis/subanis.apc');
  }

  has(path: string): boolean {
    return this.byLower.has(path.toLowerCase());
  }

  path(path: string): string {
    const p = this.byLower.get(path.toLowerCase());
    if (!p) throw new Error(`bestand niet gevonden: ${path}`);
    return p;
  }

  /** Read a file. `quiet` = background prefetch (no loading bar). */
  async read(path: string, quiet = false): Promise<ArrayBuffer> {
    const p = this.path(path);
    if (quiet || !this.vfs.remote) return this.vfs.read(p);
    const size = (this.vfs as { size?(p: string): number }).size?.(p) || 1;
    this.fg.total += size;
    this.onProgress?.(this.fg.done, this.fg.total);
    let seen = 0;
    const gen = this.fgGen;
    try {
      return await this.vfs.read(p, (n) => {
        if (gen !== this.fgGen) return;
        const d = Math.min(n, size) - seen;
        seen += d;
        this.fg.done += d;
        this.onProgress?.(this.fg.done, this.fg.total);
      });
    } finally {
      if (gen === this.fgGen) this.fg.done += size - seen;
      if (this.fg.done >= this.fg.total) { this.fg = { done: 0, total: 0 }; this.fgGen++; }
      this.onProgress?.(this.fg.done, this.fg.total);
    }
  }
}
