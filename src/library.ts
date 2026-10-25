// Where the game files come from: an ISO the user supplied (kept in the browser's Origin Private File System),
// a CD folder picked in the browser, dev copies in public/data/ronja/, or — by default — single files streamed out
// of the ISO on archive.org (CORS enabled), cached in Cache Storage.

import { ArchiveVfs, FileListVfs, HttpVfs, IsoVfs, type Vfs } from './engine/vfs.ts';
import { GameFiles } from './game/files.ts';
import manifest from './data/ronja.files.json';

export const GAME_TITLE = 'Ronja de Roversdochter';
export const ARCHIVE_ITEM = 'ronja-de-roversdochter';
export const ARCHIVE_ISO = 'Ronja de roversdochter.iso';
export const ARCHIVE_ROOT = 'ronja';
export const ARCHIVE_PAGE = `https://archive.org/details/${ARCHIVE_ITEM}`;

export type Source = 'iso' | 'dev' | 'archive';

const opfsDir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('isos', { create: true });

export interface Library { source: Source; open: () => Promise<GameFiles> }

export async function availableSource(): Promise<Library> {
  try {
    const dir = await opfsDir();
    const h = await dir.getFileHandle('ronja.iso').catch(() => null);
    if (h) return { source: 'iso', open: async () => new GameFiles(await IsoVfs.open(await h.getFile(), ARCHIVE_ROOT.toUpperCase())) };
  } catch (e) {
    console.warn('OPFS niet beschikbaar', e);
  }
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('source') !== 'archive') {
    const vfs = await HttpVfs.open(`${import.meta.env.BASE_URL}data/ronja/`);
    if (vfs) return { source: 'dev', open: async () => new GameFiles(vfs) };
  }
  return {
    source: 'archive',
    open: async () => new GameFiles(new ArchiveVfs(ARCHIVE_ITEM, ARCHIVE_ISO, manifest as Record<string, number>, ARCHIVE_ROOT)),
  };
}

/** Store an ISO the user picked (after checking it is the Ronja CD). */
export async function addIso(file: Blob, onProgress?: (f: number) => void): Promise<void> {
  const vfs: Vfs = await IsoVfs.open(file, ARCHIVE_ROOT.toUpperCase());
  if (!GameFiles.looksLikeRonja(vfs.list())) throw new Error('Deze ISO is niet de cd van Ronja de Roversdochter.');
  const dir = await opfsDir();
  const h = await dir.getFileHandle('ronja.iso', { create: true });
  const w = await h.createWritable();
  const CHUNK = 8 << 20;
  for (let o = 0; o < file.size; o += CHUNK) {
    await w.write(await file.slice(o, o + CHUNK).arrayBuffer());
    onProgress?.(Math.min(1, (o + CHUNK) / file.size));
  }
  await w.close();
}

export async function removeIso() {
  const dir = await opfsDir();
  await dir.removeEntry('ronja.iso').catch(() => {});
}

/** A CD folder picked with <input webkitdirectory>: used in this session only. */
export function cdFolder(files: Iterable<[string, Blob]>): GameFiles {
  const vfs = new FileListVfs(files, ARCHIVE_ROOT.toUpperCase());
  if (!GameFiles.looksLikeRonja(vfs.list())) throw new Error('Geen Ronja-cd gevonden in deze map (verwacht een map "ronja").');
  return new GameFiles(vfs);
}
