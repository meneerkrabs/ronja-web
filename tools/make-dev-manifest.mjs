// Writes public/data/ronja/manifest.json (list of relative paths) for the dev HttpVfs. Copy the CD's `ronja/` folder to
// public/data/ronja/ first (public/ is gitignored and never shipped), then run: node tools/make-dev-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public/data/ronja');
const out = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== 'manifest.json') out.push(path.relative(root, p).split(path.sep).join('/'));
  }
};
walk(root);
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(out));
console.log(`${out.length} files`);
