// Path finder on the scene's restriction map R (engine.md §3.4, code 0x41a5f0-0x41b4b0): a grid of 4x4 pixel
// cells, breadth-first flood with an 8-neighbourhood (E, SE, S, SW, W, NW, N, NE), then greedy line-of-sight
// smoothing. A click on a blocked cell walks to the nearest reachable cell.

export interface PathNode { gx: number; gy: number }

const NB: Array<[number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export class PathFinder {
  private w = 0;
  private h = 0;
  /** 1 = blocked, 0 = free */
  private blocked = new Uint8Array(0);

  /** Set the restriction map (non-zero = walkable). Without a map nothing is walkable. */
  setMap(r: Uint16Array | null, sceneWidth: number) {
    this.w = sceneWidth >> 2;
    this.h = 120;
    this.blocked = new Uint8Array(this.w * this.h);
    if (!r) { this.blocked.fill(1); return; }
    for (let i = 0; i < this.blocked.length; i++) this.blocked[i] = r[i] === 0 ? 1 : 0;
  }

  isFree(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < this.w && gy < this.h && this.blocked[gy * this.w + gx] === 0;
  }

  private nearestFree(gx: number, gy: number): number {
    let best = -1, bd = Infinity;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.blocked[y * this.w + x]) continue;
        const d = (x - gx) * (x - gx) + (y - gy) * (y - gy);
        if (d < bd) { bd = d; best = y * this.w + x; }
      }
    }
    return best;
  }

  /** Bresenham line over the grid; false if it touches a blocked or outside cell (FUN_0041a6f0). */
  private lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!this.isFree(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Path from cell (sx,sy) to (dx,dy), nodes in cell coordinates (multiply by 4 for pixels). Empty = unreachable. */
  getPath(sx: number, sy: number, dx: number, dy: number): PathNode[] {
    const w = this.w, h = this.h;
    if (w === 0) return [];
    const cl = (v: number, m: number) => Math.max(0, Math.min(m - 1, v));
    sx = cl(sx, w); sy = cl(sy, h); dx = cl(dx, w); dy = cl(dy, h);
    let start = sy * w + sx;
    if (this.blocked[start]) { start = this.nearestFree(sx, sy); if (start < 0) return []; }
    const dest = dy * w + dx;
    const parent = new Int32Array(w * h).fill(-2);
    const queue = new Int32Array(w * h);
    let qh = 0, qt = 0;
    queue[qt++] = start;
    parent[start] = -1;
    let found = start === dest;
    while (qh < qt && !found) {
      const c = queue[qh++];
      const cx = c % w, cy = (c / w) | 0;
      for (const [ox, oy] of NB) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (parent[n] !== -2 || this.blocked[n]) continue;
        parent[n] = c;
        if (n === dest) { found = true; break; }
        queue[qt++] = n;
      }
    }
    let end = dest;
    if (!found) {
      if (!this.blocked[dest]) return []; // free but unreachable
      let bd = Infinity;
      end = -1;
      for (let i = 0; i < qt; i++) {
        const c = queue[i];
        const d = ((c % w) - dx) ** 2 + (((c / w) | 0) - dy) ** 2;
        if (d < bd) { bd = d; end = c; }
      }
      if (end < 0) return [];
    }
    const nodes: PathNode[] = [];
    for (let c = end; c !== -1; c = parent[c]) nodes.push({ gx: c % w, gy: (c / w) | 0 });
    nodes.reverse();
    return this.smooth(nodes);
  }

  private smooth(n: PathNode[]): PathNode[] {
    if (n.length <= 3) return n;
    const out: PathNode[] = [n[0]];
    let a = 0;
    while (a < n.length - 1) {
      let j = a + 1;
      while (j < n.length && this.lineClear(n[a].gx, n[a].gy, n[j].gx, n[j].gy)) j++;
      // n[j-1] is the last node visible from the anchor (j == length: the end is visible)
      let next = j >= n.length ? n.length - 1 : Math.max(a + 1, j - 2);
      if (next === a) next = a + 1;
      out.push(n[next]);
      a = next;
    }
    return out;
  }
}
