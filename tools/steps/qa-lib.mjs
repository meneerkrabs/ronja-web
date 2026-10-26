// QA helpers for the scripted playthrough (tools/steps/playthrough.mjs). Real input: clicks, verb coin, inventory, map, choices.
export const mk = (ctx) => {
  const { click, down, up, move, wait, evaluate, log, shot, page, key } = ctx;
  const PFX = 'qa-';
  // monotonic-ish clock that ignores long freezes of the whole machine (sleep/suspend): any gap > 15 s between two calls is discounted
  let clockLast = Date.now(), clockLost = 0;
  const clock = () => { const n = Date.now(); const d = n - clockLast; if (d > 15000) clockLost += d - 1000; clockLast = n; return n - clockLost; };
  const S = () => evaluate(() => {
    const r = globalThis.__ronja; const o = r.O;
    return {
      scene: r.world.scene?.name, act: r.gv.act, mode: r.gv.mode, pan: r.world.scene?.pan, dlg: r.dialogActive(), choosing: r.choosing(),
      ev: r.lastDialog.event, alt: r.lastDialog.alt, busy: r.busy.bits, movie: r.ui.movie?.name ?? null,
      rx: Math.round(o.RONJA.x), ry: Math.round(o.RONJA.y), walking: !!o.RONJA.walking, anim: !!(o.RONJA.track && (o.RONJA.trackFlags & 1) === 0 && o.RONJA.track.name && !/still|stand/i.test(o.RONJA.track.name)), birk: o.BIRK.holder === o.RONJA,
      heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), inv: Object.entries(o).filter(([k, x]) => x.holder === o.RONJA && k !== 'RONJA' && k !== 'BIRK').map(([k]) => k).join(','),
      flags: Array.from(r.gv.flags).map((v, i) => (v ? (0x8d4 + i).toString(16) : '')).filter(Boolean).join(','),
    };
  });
  const st = async (tag = '') => { const s = await S(); log(tag, JSON.stringify(s)); return s; };
  const skipBtn = () => page.$('.bdb-skip');
  const skipText = async () => { const b = await skipBtn(); return b ? (await b.textContent()) : null; };
  // settle: wait until nothing is going on. opts: skipMovies (default true), skipDlg (default false), max (ms)
  const settle = async ({ skipMovies = true, skipDlg = false, max = 60000, min = 600, keepMovie = false } = {}) => {
    const t0 = clock(); let quiet = 0;
    await wait(min);
    while (clock() - t0 < max) {
      const s = await S();
      const b = await skipText();
      if (b) {
        const isMovie = /film|aftiteling/i.test(b);
        if ((isMovie && skipMovies) || (!isMovie && skipDlg)) { log(`  [skip] pressed "${b}" (${s.scene}${s.movie ? ', ' + s.movie : ''})`); await (await skipBtn())?.click().catch(() => {}); quiet = 0; await wait(300); continue; }
      }
      if (s.choosing && !b) return s; // waiting for the player's answer
      if (!s.dlg && !s.choosing && !s.walking && !s.anim && !s.busy && !s.movie && !b) { if (++quiet >= 3) return s; } else quiet = 0;
      await wait(250);
    }
    log('!! settle timeout'); await st('!! stuck'); await shot(PFX + 'stuck-' + clock());
    return S();
  };
  const hasInv = async (n) => (await S()).inv.split(',').includes(n);
  const flag = (a) => evaluate((a) => globalThis.__ronja.g(a), a);
  const pan = () => evaluate(() => globalThis.__ronja.world.scene.pan);
  const sceneW = () => evaluate(() => globalThis.__ronja.world.scene.width);
  // scene point -> clickable; if off-screen, scroll by clicking at the edge first
  const toScreen = async (sx) => {
    for (let i = 0; i < 12; i++) {
      const p = await pan();
      if (sx - p >= 8 && sx - p <= 630) return sx - p;
      const right = sx - p > 630;
      // walk to the walkable point nearest the screen edge in that direction (the camera scrolls when Ronja gets within 25/25 px of it)
      const pt = await evaluate(([p, right]) => {
        const r = globalThis.__ronja; let best = null;
        for (let x = right ? p + 636 : p + 3; right ? x > p + 540 : x < p + 100; x += right ? -2 : 2) {
          for (let y = 440; y > 150; y -= 6) if (r.walkable(x, y)) { best = [x - p, y]; break; }
          if (best) break;
        }
        return best;
      }, [p, right]);
      if (!pt) throw new Error('toScreen: no walkable edge point');
      await click(pt[0], pt[1]);
      for (let k = 0; k < 25; k++) { await wait(300); if ((await pan()) !== p) break; if (!(await S()).walking && k > 2) break; }
    }
    return sx - (await pan());
  };
  const at = async (sx, y, opt) => { const x = await toScreen(sx); await click(x, y, opt); };
  const verb = async (sx, y, v) => {
    const x = await toScreen(sx);
    await move(x, y); await wait(250); await down(x, y); await wait(750);
    const d = v === 'hand' ? [0, -35] : v === 'mouth' ? [30, 30] : [-30, 30];
    await up(x + d[0], y + d[1]);
  };
  // find a scene point inside region id (raw regionAt) nearest to (nx, ny)
  const regionPoint = (id, nx = 320, ny = 300) => evaluate(([id, nx, ny]) => {
    const r = globalThis.__ronja; const W = r.world.scene.width; let best = null, bd = 1e9;
    for (let y = 10; y < 470; y += 4) for (let x = 4; x < W; x += 4) if (r.regionAt(x, y) === id) { const d = (x - nx) ** 2 + (y - ny) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
    return best;
  }, [id, nx, ny]);
  // click/verb on a region centre (centroid of its area, nudged to a member point)
  const regionCentre = (id) => evaluate((id) => {
    const r = globalThis.__ronja; const W = r.world.scene.width; let sx = 0, sy = 0, n = 0; const pts = [];
    for (let y = 10; y < 470; y += 4) for (let x = 4; x < W; x += 4) if (r.regionAt(x, y) === id) { sx += x; sy += y; n++; pts.push([x, y]); }
    if (!n) return null; const cx = sx / n, cy = sy / n; let best = pts[0], bd = 1e9;
    for (const p of pts) { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }, id);
  const clickRegion = async (id, opt) => { const p = await regionCentre(id); if (!p) throw new Error('no region ' + id); await at(p[0], p[1], opt); return p; };
  const verbRegion = async (id, v) => { const p = await regionCentre(id); if (!p) throw new Error('no region ' + id); await verb(p[0], p[1], v); return p; };
  // dialogue choices: n = 1-based index of the choice line. Waits for the choice menu first.
  const waitChoice = async (max = 40000) => {
    const t0 = clock();
    while (clock() - t0 < max) { if ((await S()).choosing) return true; await wait(250); }
    return false;
  };
  const choose = async (n, max) => {
    if (!(await waitChoice(max))) { log('!! no choice shown'); await st(); return false; }
    const c = await evaluate(() => globalThis.__ronja.dev.choiceCount());
    log('  choices:', c, '-> picking', n);
    await wait(200);
    const row = 5 - c + (n - 1);
    await move(10, 380 + 20 * row + 10); await wait(100);
    await click(10, 380 + 20 * row + 10);
    await wait(300);
    return true;
  };
  const inv = async (open = true) => { await click(320, 240, { button: 'right' }); await wait(300); };
  const invSlot = (i) => [180 + 70 * (i % 5), 100 + 70 * Math.floor(i / 5)];
  const invItems = () => evaluate(() => globalThis.__ronja.dev.inventoryItems().map((i) => i.obj.name));
  // use an inventory item on a scene point: open bag, press on item, release over scene point
  // right click opens the bag; refused while a dialogue runs / the engine is busy, so wait for that first
  const openBag = async () => {
    for (let k = 0; k < 6; k++) {
      for (let j = 0; j < 80; j++) { const s = await S(); if (!s.dlg && !s.busy && !s.walking && !s.movie) break; await wait(250); }
      await click(320, 240, { button: 'right' }); await wait(300);
      if (await evaluate(() => globalThis.__ronja.ui.invOpen)) return;
    }
    throw new Error('bag did not open');
  };
  const useItem = async (name, sx, y) => {
    const items = await invItems(); const i = items.indexOf(name);
    if (i < 0) throw new Error('item not in inventory: ' + name + ' have ' + items);
    const x = await toScreen(sx); // scroll first: a click with the item in hand would drop it
    await openBag();
    const [ix, iy] = invSlot(i);
    await click(ix, iy); await wait(300); // picks the item (held)
    await move(5, 5); await wait(300);
    const held = await evaluate(() => globalThis.__ronja.ui.held);
    if (!held) { log('!! item not held', name); await shot(PFX + 'noheld'); }
    await move(x, y); await wait(200); await click(x, y);
  };
  const combineItems = async (a, b) => {
    const items = await invItems(); const i = items.indexOf(a), j = items.indexOf(b);
    if (i < 0 || j < 0) throw new Error('combine: missing ' + a + '/' + b + ' have ' + items);
    await openBag();
    const [ix, iy] = invSlot(i); await click(ix, iy); await wait(300);
    const [jx, jy] = invSlot(j); await click(jx, jy); await wait(400);
    await click(320, 240, { button: 'right' }); await wait(200);
  };
  const closeBag = async () => { const o = await evaluate(() => globalThis.__ronja.ui.invOpen); if (o) { await click(320, 240, { button: 'right' }); await wait(200); } };
  // exits per scene -> raw info-map region id (from the scene scripts' walk handlers)
  const EXITS = {
    BORGGARDEN: { BORGPORTEN: 1, STORASALEN: 3 }, // KOKET (2) has no region in the winter map; always route via STORASALEN
    STORASALEN: { LOVISMATTISRUM: 2, BORGGARDEN: 3, KOKET: 5 },
    LOVISMATTISRUM: { SKALLEPERSRUM: 2, STORASALEN: 3 },
    SKALLEPERSRUM: { TORNET: 2, LOVISMATTISRUM: 3 },
    TORNET: { SKALLEPERSRUM: 1 },
    KOKET: { STORASALEN: 1, KAELLARE: 3 },
    KAELLARE: { KOKET: 1, FANGELSEHALOR: 2 },
    FANGELSEHALOR: { KAELLARE: 1 },
    BORGPORTEN: { BORGGARDEN: 1, SKOGEN: 2 },
    SKOGEN: { BORGPORTEN: 1, KAELLAN: 2, GLUPAFALLET: 3, },
    KAELLAN: { GLAENTAN: 1, SKOGEN: 2, TJAERNEN: 3 },
    GLAENTAN: { GROTTANUTE: 1, KAELLAN: 2 }, // SKOGEN (3/4) only after g904
    GLUPAFALLET: { SKOGEN: 1, TJAERNEN: 2 }, // GROTTANUTE (3) lies behind the river: only reachable by winning the river game
    TJAERNEN: { KAELLAN: 1, GLUPAFALLET: 2 },
    GROTTANUTE: { GLAENTAN: 2, GROTTANINNE: 1 },
    GROTTANINNE: { GROTTANUTE: 1 },
  };
  const exitTo = async (dest, opt = {}) => {
    const s = await S(); const id = EXITS[s.scene]?.[dest];
    if (!id) throw new Error(`no exit ${s.scene} -> ${dest}`);
    log('  exit', s.scene, '->', dest);
    await clickRegion(id);
    return settle(opt);
  };
  // shortest path over EXITS (ignores conditions) from the current scene
  const goTo = async (dest, opt = {}) => {
    let s = await S();
    for (let guard = 0; s.scene !== dest && guard < 12; guard++) {
      const seen = new Map([[s.scene, null]]); const q = [s.scene];
      while (q.length) { const c = q.shift(); if (c === dest) break; for (const n of Object.keys(EXITS[c] ?? {})) if (!seen.has(n)) { seen.set(n, c); q.push(n); } }
      if (!seen.has(dest)) throw new Error(`no route ${s.scene} -> ${dest}`);
      let step = dest; while (seen.get(step) !== s.scene) step = seen.get(step);
      s = await exitTo(step, opt);
    }
    return s;
  };
  const evalPage = (fn, arg) => evaluate(fn, arg);
  const clickScreen = (x, y) => click(x, y);
  const waitMode = async (m, max = 30000) => { const t0 = clock(); while (clock() - t0 < max) { if ((await S()).mode === m) return true; await wait(250); } log('!! waitMode timeout', m); await st(); return false; };
  const need = async (cond, msg) => { if (!cond) { log('!! FAIL', msg); await st('state'); await shot(PFX + 'fail-' + clock()); throw new Error('FAIL ' + msg); } };
  const from = Number(process.env.QA_FROM ?? 0);
  const stepper = () => async (n, title, fn) => { if (n < from) return; log(`== step ${n}: ${title}`); await fn(); await st(`   step ${n} done`); };
  // river bot (modes 1/7, needs ?debug=1): BFS over the stone graph, clicking the stone regions (12 + index) like a player
  const riverBot = async (goal, max = 150000) => {
    const t0 = clock(); let lastClick = 0;
    while (clock() - t0 < max) {
      const r = await evaluate(() => { const d = globalThis.__river; return d ? { s: d.s, stones: d.stones.map((x) => [Array.from(x.slice(0, 6)), x[6], x[7], x[9]]) } : null; });
      if (!r) throw new Error('no __river (?debug=1)');
      const { s } = r;
      if (s.mode !== (await S()).mode || !s.active) { if (!(await S()).mode) return true; await wait(200); continue; }
      if (s.state !== 0 && s.state !== 4) { await wait(60); continue; }
      if (s.state === 4) { await wait(100); continue; } // on a raft: just wait (ride) - handled by caller if it matters
      if (s.stone === goal) { await wait(100); continue; }
      // BFS (slippery stones cost more)
      const dist = new Map([[s.stone, 0]]), prev = new Map(); const q = [s.stone];
      while (q.length) { q.sort((a, b) => dist.get(a) - dist.get(b)); const c = q.shift(); if (c === goal) break; r.stones[c][0].forEach((n) => { if (n < 0) return; const nd = dist.get(c) + 1 + (r.stones[n][3] ? 1.5 : 0); if (!dist.has(n) || nd < dist.get(n)) { dist.set(n, nd); prev.set(n, c); q.push(n); } }); }
      if (!dist.has(goal)) throw new Error('river: goal unreachable from ' + s.stone);
      let nxt = goal; while (prev.get(nxt) !== s.stone) nxt = prev.get(nxt);
      const pt = await evaluate(([id, p]) => { const g = globalThis.__ronja; const W = g.world.scene.width; let best = null, bd = 1e9; for (let y = 10; y < 470; y += 3) for (let x = p + 10; x < p + 630 && x < W; x += 3) if (g.regionAt(x, y) === id) { const d = (x - p - 320) ** 2 + (y - 240) ** 2; if (d < bd) { bd = d; best = [x - p, y]; } } return best; }, [12 + nxt, s.pan]);
      if (!pt) { await wait(100); continue; }
      await click(pt[0], pt[1]);
      await wait(150);
    }
    log('!! riverBot timeout'); await st();
    return false;
  };
  // ski bot: steers with the real mouse; safe x per obstacle mask (left <=262, middle 230..410, right >=397)
  const skiBot = async (max = 200000) => {
    const t0 = clock(); let lastLane = -1, intent = 1; skiBot.crashes = 0; skiBot.mx = -99;
    const LANE_X = [180, 330, 460];
    const hit = (m, x) => m === 7 || (x <= 262 && [1, 3, 5].includes(m)) || (x >= 230 && x <= 410 && [2, 3, 6].includes(m)) || (x >= 397 && [4, 5, 6].includes(m));
    const W = 60;
    // plan: reach frame f+W without a hit; a lane change takes 5 frames (adjacent) / 9 frames (across), all lanes in between apply meanwhile
    const plan = (masks, cur) => {
      const safeLane = (t, l) => !hit(masks[t], LANE_X[l]);
      const reach = Array.from({ length: W + 10 }, () => [null, null, null]);
      reach[0][cur] = { first: null, moves: 0 }; // first = the action at frame 0 (-1 stay, n move), not the first move of the plan
      for (let t = 0; t < W; t++) for (let l = 0; l < 3; l++) {
        const r = reach[t][l]; if (!r) continue;
        const put = (tt, ll, first, moves) => { if (tt >= W + 10) return; const o = reach[tt][ll]; if (!o || moves < o.moves) reach[tt][ll] = { first, moves }; };
        if (safeLane(t, l)) put(t + 1, l, t === 0 ? -1 : r.first, r.moves);
        for (let n = 0; n < 3; n++) { if (n === l) continue; const d = Math.abs(n - l) === 1 ? 5 : 9; let ok = true; for (let k = 0; k < d && ok; k++) for (let q = Math.min(l, n); q <= Math.max(l, n); q++) if (t + k < masks.length && !safeLane(t + k, q)) ok = false; if (ok) put(t + d, n, t === 0 ? n : r.first, r.moves + 1); }
      }
      let best = null; for (let l = 0; l < 3; l++) { const r = reach[W][l]; if (r && (!best || r.moves < best.moves)) best = r; }
      return best ? best.first : null; // -1 stay, 0..2 lane to go to, null no safe plan (just try the nearest safe)
    };
    while (clock() - t0 < max) {
      const r = await evaluate(() => { const k = globalThis.__ski; const i = k.info(); const w = []; for (let f = i.frame; f < i.frame + 72; f++) w.push(k.mask(f)); return { i, w, mode: globalThis.__ronja.gv.mode }; });
      if (r.mode !== 3 || r.i.finished) return r.i;
      if (clock() - (skiBot.t ?? 0) > 15000) { skiBot.t = clock(); log('  ski', JSON.stringify({ f: r.i.frame, state: r.i.state, crashes: r.i.crashes, x: Math.round(r.i.x) })); }
      if (r.i.crashes !== (skiBot.crashes ?? 0)) { skiBot.crashes = r.i.crashes; lastLane = -1; if (skiBot.debug) log('  ski crash', JSON.stringify({ cf: r.i.crashFrame, x: Math.round(r.i.x), intent, mx: skiBot.mx, warp: Math.round(r.i.warpOff) })); intent = 1; } // after a crash Ronja is at x=320 again
      if (r.i.state === 1) {
        // steering target = real mouse x + warpOff (the browser cannot warp the cursor onto Ronja after a crash; the offset melts as the mouse moves): aim the real mouse at laneX - warpOff
        const cur = r.i.x < 255 ? 0 : r.i.x < 395 ? 1 : 2;
        const p = plan(r.w, cur);
        if (p !== null && p >= 0) intent = p;
        const want = Math.max(0, Math.min(639, Math.round(LANE_X[intent] - r.i.warpOff)));
        if (Math.abs(want - (skiBot.mx ?? -99)) > 3) { skiBot.mx = want; await move(want, 300); }
      }
      await wait(60);
    }
    log('!! skiBot timeout'); return null;
  };
  // "Sla over" check: log what is offered right now and press it; returns the label (or null when nothing is offered)
  const trySkip = async (what, waitMs = 1500) => {
    await wait(waitMs);
    const label = await skipText();
    log(`  [skip] ${what}: offer = ${label}`);
    if (label) { await (await skipBtn()).click().catch(() => {}); await wait(500); }
    return label;
  };
  // ESC menu: save into slot n (0..15) / load it again (4x4 grid), as a player would
  const slotXY = (n) => [141 + 90 * (n % 4) + 40, 87 + 80 * Math.floor(n / 4) + 30];
  const saveSlot = async (n) => {
    await closeBag(); await settle({ max: 60000 });
    await key('Escape'); await wait(500); await click(320, 264); await wait(400);
    const [x, y] = slotXY(n); await click(x, y); await wait(400);
    // an occupied slot asks for confirmation (JA)
    if (await evaluate(() => globalThis.__ronja.ui.confirmOpen)) { await click(260, 270); await wait(400); }
    log(`  saved slot ${n}:`, await evaluate((n) => (localStorage.getItem('ronja-save-' + n) ?? '').length, n), 'bytes');
  };
  const loadSlot = async (n) => {
    await key('Escape'); await wait(500); await click(320, 190); await wait(400);
    const [x, y] = slotXY(n); await click(x, y); await wait(400); await click(260, 270); await wait(2500);
    await settle({ max: 60000 });
  };
  const snap = async () => { const s = await S(); return { scene: s.scene, act: s.act, inv: s.inv, flags: s.flags, rx: s.rx, ry: s.ry, birk: s.birk }; };
  const saveLoadCheck = async (n, tag) => {
    const a = await snap();
    await saveSlot(n);
    await click(320, 420); await wait(2500); // move away
    await loadSlot(n);
    const b = await snap();
    const same = a.scene === b.scene && a.act === b.act && a.inv === b.inv && a.flags === b.flags && a.birk === b.birk;
    log(`  [save/load] ${tag}: ${same ? 'OK (scene, act, inventory, flags, Birk restored)' : 'MISMATCH'}`, same ? '' : JSON.stringify({ a, b }));
    await need(same, 'save/load restores state: ' + tag);
    return same;
  };
  // answer every choice menu of a running dialogue (picks[i] or the first line) until it ends; guards against dialogue loops
  const converse = async (picks = [], maxRounds = 8, maxWait = 90000) => {
    for (let round = 0; round < maxRounds; round++) {
      const t0 = clock(); let state = null;
      while (clock() - t0 < maxWait) { const s = await S(); if (s.choosing) { state = 'choice'; break; } if (!s.dlg && !s.movie && !s.walking && !s.busy) { await wait(500); const s2 = await S(); if (!s2.dlg && !s2.choosing) { state = 'end'; break; } } await wait(250); }
      if (state !== 'choice') return round;
      await choose(picks[round] ?? 1, 5000);
    }
    log('!! converse: dialogue still offering choices after', maxRounds, 'rounds (loop?)');
    return maxRounds;
  };
  // a scene point that really hits Birk's sprite (waits until he stands still)
  const birkPoint = async () => {
    for (let k = 0; k < 60; k++) { if (!(await evaluate(() => globalThis.__ronja.O.BIRK.walking))) break; await wait(250); }
    await wait(500);
    const p = await evaluate(() => { const g = globalThis.__ronja, o = g.O.BIRK, pan = g.world.scene.pan; for (let dy = 20; dy < 160; dy += 6) for (let dx = -30; dx <= 30; dx += 6) if (o.hitTest(Math.round(o.x + dx - pan), Math.round(o.y - dy))) return [Math.round(o.x + dx), Math.round(o.y - dy)]; return null; });
    if (!p) throw new Error('birkPoint: no hit on Birk');
    return p;
  };
  // the map: bag -> verb coin (HAND) on the map item -> click the place (screen coordinates of map.ts SPOTS)
  const MAP_SPOT = { BORGPORTEN: [180, 130], SKOGEN: [150, 240], KAELLAN: [285, 235], TJAERNEN: [290, 318], GLUPAFALLET: [295, 384], GLAENTAN: [464, 186], GROTTANUTE: [440, 277] };
  const mapTravel = async (place) => {
    const items = await invItems(); const i = items.indexOf('KARTAN'); if (i < 0) throw new Error('no KARTAN');
    await openBag();
    const [ix, iy] = invSlot(i);
    await move(ix, iy); await wait(250); await down(ix, iy); await wait(750); await up(ix, iy - 35); await wait(500);
    if (!(await evaluate(() => globalThis.__ronja.ui.mapOpen))) throw new Error('map did not open');
    const from = (await S()).scene;
    await shot(PFX + 'map-' + place);
    const [x, y] = MAP_SPOT[place]; await click(x, y);
    await settle({ max: 60000 });
    log(`  map travel ${from} -> ${(await S()).scene} (wanted ${place})`);
    return (await S()).scene === place;
  };
  const errors = [];
  return { clock, mapTravel, birkPoint, converse, saveLoadCheck, trySkip, saveSlot, loadSlot, snap, skiBot, riverBot, need, stepper, evalPage, clickScreen, waitMode, EXITS, exitTo, goTo, S, st, settle, hasInv, flag, pan, at, verb, regionPoint, regionCentre, clickRegion, verbRegion, waitChoice, choose, useItem, combineItems, closeBag, invItems, toScreen, skipText, skipBtn, PFX, errors };
};
