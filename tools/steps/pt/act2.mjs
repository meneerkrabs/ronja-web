// Act 2: walkthrough steps 7-17. QA_FROM=<n> skips steps < n.
export default async (L, ctx) => {
  const { log, shot, wait } = ctx;
  const { st, settle } = L;
  const need = L.need, ev = L.evalPage;
  const step = L.stepper();
  // answer the choice menus of a dialogue: picks[i] = 1-based choice for the i-th menu
  const talk = async (picks) => { for (const n of picks) { await L.choose(n, 60000); } await settle({ max: 120000 }); };

  await step(7, 'STORASALEN: MOUTH Mattis -> #80 -> "Vad är det?" -> #81 -> g8d6', async () => {
    await L.goTo('STORASALEN');
    await L.verbRegion(12, 'mouth');
    await talk([1, 1]);
    await need(await L.flag(0x8d6), 'g8d6 Mattis talk');
  });
  await step(8, 'STORASALEN: MOUTH Skalle-Per -> #92 -> alt 2 -> #94 -> g8d7, Ronja to KOKET', async () => {
    await L.goTo('STORASALEN');
    await L.verbRegion(13, 'mouth');
    await talk([2]);
    await need(await L.flag(0x8d7), 'g8d7 cellar shown');
    await need((await L.S()).scene === 'KOKET', 'moved to KOKET');
  });
  await step(9, 'TJAERNEN: Birk stumbles (#303), MOUTH Birk -> fog; SKOGEN: REM on Birk -> g8d5 -> ski run', async () => {
    await L.goTo('TJAERNEN', { skipDlg: false });
    await settle({ max: 120000 });
    await need(await L.flag(0x8fc), 'g8fc Birk stumbled');
    await shot('qa-09-tjaernen-birk');
    await L.verbRegion(4, 'mouth');
    await talk([1]);
    await st('after tarn talk');
    await need((await L.S()).scene === 'SKOGEN' && await L.flag(0x8e5), 'in SKOGEN fog');
    await shot('qa-10-fog');
    await L.useItem('REM', ...(await L.regionCentre(4)));
    await L.waitMode(3, 120000);
    await need(await L.flag(0x8d5), 'g8d5 Birk saved');
  });
  await step(10, 'ski run (mode 3): intro skip offer, then skiing with real mouse movement', async () => {
    await L.waitMode(3, 60000);
    await wait(4000);
    let label = await L.skipText();
    log('  skip offer during the ski intro:', label);
    await need(!!label, 'ski intro offers "Sla over"');
    await shot('qa-11-ski-intro');
    await (await L.skipBtn()).click();
    await wait(3000);
    await shot('qa-12-ski');
    log('  ski info', JSON.stringify(await ev(() => globalThis.__ski.info())));
    // real steering for a stretch of the slope (the bot plans lanes from the obstacle table; crashes and the restart from the checkpoint
    // happen like for a player), then the dev hook ends the run: playing all 139 s is slow in the loaded headless browser
    const res = await L.skiBot(120000);
    log('  ski after the real stretch', JSON.stringify(await ev(() => globalThis.__ski.info())));
    if ((await L.S()).mode === 3) await ev(() => globalThis.__ski.finish());
    await settle({ max: 60000 });
    await need(await L.flag(0x8e0), 'g8e0 ski done');
    await need((await L.S()).scene === 'BORGGARDEN', 'back in BORGGARDEN');
    await shot('qa-13-after-ski');
  });
  await step(11, 'KOKET (winter): torch from Skalle-Per, light the stove (tinder + flint/steel), light the torch', async () => {
    await L.goTo('KOKET');
    await settle({ max: 120000 }); // #160 Skalle-Per leaves the torches
    await need(await L.flag(0x8e7), 'g8e7 torches left');
    await L.verbRegion(12, 'hand'); await settle();
    await need(await L.hasInv('FACKLA'), 'FACKLA');
    await shot('qa-14-torch');
    const stove = await L.regionCentre(6);
    await L.useItem('FNOSKE', ...stove); await settle();
    await need(await L.flag(0x8e9), 'g8e9 tinder in stove');
    await L.combineItems('FLINTA', 'ELDSTAL');
    await L.useItem('ELDSTAL', ...stove); await settle({ max: 60000 });
    await need(await L.flag(0x8e8), 'g8e8 stove lit');
    await L.useItem('FACKLA', ...stove); await settle({ max: 60000 });
    await need(await L.flag(0x90d), 'g90d torch lit');
    await shot('qa-15-stove');
  });
  await step(12, 'LOVISMATTISRUM with the lit torch: #58 help Lovis -> g8d8', async () => {
    await L.goTo('LOVISMATTISRUM'); await settle({ max: 120000 });
    await need(await L.flag(0x8d8), 'g8d8 Lovis helped');
  });
  await step(13, 'KAELLARE with the torch: lit cellar, cheese, carrots', async () => {
    await L.goTo('KOKET');
    await L.clickRegion(3); await settle({ max: 120000 });
    await need((await L.S()).scene === 'KAELLARE', 'in KAELLARE');
    await settle({ max: 120000 });
    await need(await L.flag(0x8ed), 'g8ed cellar lit');
    await L.verbRegion(3, 'hand'); await settle();
    await need(await L.hasInv('OST'), 'OST');
    await L.verbRegion(4, 'hand'); await settle();
    await need(await L.hasInv('MOROTTER'), 'MOROTTER');
    await shot('qa-16-cellar');
  });
  await step(14, 'rat trap: cheese in trap, set it in KOKET, re-enter, take the rat', async () => {
    await L.combineItems('OST', 'RATTBUR');
    await L.goTo('KOKET');
    await L.useItem('RATTBUR', ...(await L.regionCentre(9))); await settle({ max: 60000 });
    await shot('qa-17-trap-set');
    await L.goTo('STORASALEN'); await L.goTo('KOKET');
    await L.verbRegion(9, 'hand'); await settle({ max: 60000 });
    await need(await L.hasInv('RATTA'), 'RATTA');
  });
  await step(15, 'RATTA on the robbers (STORASALEN) + MOROTTER on the horses (BORGGARDEN) -> snowball fight (mode 5)', async () => {
    await L.goTo('STORASALEN'); await settle({ max: 60000 });
    await L.useItem('RATTA', ...(await L.regionCentre(8))); await settle({ max: 120000 });
    await need(await L.flag(0x8da), 'g8da robbers scared');
    await L.goTo('BORGGARDEN'); await settle({ max: 60000 });
    await shot('qa-18-horses');
    await L.useItem('MOROTTER', ...(await L.regionCentre(9))); await settle({ max: 120000, skipDlg: false });
    await L.waitMode(5, 120000);
    await wait(3000);
    await shot('qa-19-snowball');
    // real throws at the robbers; a bot that gets bored falls back to the dev win after ~75 s
    const t0 = L.clock();
    while (L.clock() - t0 < 75000 && (await L.S()).mode === 5) {
      const r = await ev(() => { const g = globalThis.__ronja, O = g.O, pan = g.world.scene.pan; const hit = globalThis.__mg.snowball.st.hit; const names = ['STURKAS', 'LABAS', 'TJEGGE', 'LILLKLIPPEN', 'FJOSOK']; const out = []; names.forEach((n, i) => { const o = O[n]; if (!(hit & (1 << i)) && !o.hidden && o.x - pan > 0 && o.x - pan < 640 && o.y < 480) out.push([Math.round(o.x - pan), Math.round(o.y - 50)]); }); return { out, flying: globalThis.__mg.snowball.st.flying, hit, sit: globalThis.__mg.snowball.st.sit }; });
      if (r.out.length && !r.flying) await L.clickScreen(...r.out[Math.floor(Math.random() * r.out.length)]);
      await wait(1300);
    }
    const info = await ev(() => { const s = globalThis.__mg.snowball.st; return { hit: s.hit, sit: s.sit, timer: s.timer }; });
    log('snowball after real throws', JSON.stringify(info));
    if ((await L.S()).mode === 5 && info.sit !== 0x1f) await ev(() => globalThis.__mg.snowball.win());
    await L.waitMode(0, 120000); await settle({ max: 120000, skipDlg: false });
    await need(await L.flag(0x8de), 'g8de snowball won');
    await st('after snowball');
    await shot('qa-20-after-snowball');
  });
  await step(16, 'cellar labyrinth, prison, Skalle-Per (dice), bread cake for Birk -> spring (act 3)', async () => {
    await L.goTo('KAELLARE'); await settle({ max: 60000 });
    await L.verbRegion(2, 'hand'); // the shelf
    await L.waitMode(4, 90000);
    await wait(2500);
    await shot('qa-21-labyrinth');
    // walk the labyrinth by the flame hints (the exit the flame points to): click the exit region when Ronja stands still in a room
    const t0 = L.clock(); let lastRoom = -1;
    while (L.clock() - t0 < 900000 && (await L.S()).mode === 4) {
      const r = await ev(() => { const h = globalThis.__mg.lab; return { cur: h.lab.cur, busy: h.lab.busy, state: h.lab.state, hint: h.LIST[h.lab.cur]?.hint ?? 0, walking: !!globalThis.__ronja.O.RONJA.walking }; });
      if (r.busy || r.state === 10 || r.walking || !r.hint) { if (!r.hint && !r.walking && !r.busy) { log('!! labyrinth: dead end node', r.cur); break; } await wait(300); continue; }
      if (r.cur !== lastRoom) { lastRoom = r.cur; log('  labyrinth room', r.cur, 'exit', r.hint); }
      await L.clickRegion(r.hint);
      await wait(2500);
    }
    await L.waitMode(0, 60000); await settle({ max: 60000 });
    await need(await L.flag(0x8f1), 'g8f1 labyrinth done');
    await need((await L.S()).scene === 'FANGELSEHALOR', 'in FANGELSEHALOR');
    await settle({ max: 90000 }); // #167 first entry
    await shot('qa-22-prison');
    await L.verbRegion(2, 'hand'); // stone heap -> #246 -> fangelse.smk -> #256
    await settle({ max: 180000 });
    await need(await L.flag(0x8f5), 'g8f5 stone heap moved');
    await L.clickRegion(1); await settle({ max: 120000 }); // back to KAELLARE: Skalle-Per waits
    await need((await L.S()).scene === 'KAELLARE', 'back in KAELLARE');
    await settle({ max: 5000 });
    await st('meeting?');
    await L.choose(2, 60000); await L.choose(2, 60000); // "Man kan inte..." -> "SpelaTarning"
    await L.waitMode(8, 90000);
    await need(await L.flag(0x8f0), 'g8f0 bread cake on the shelf');
    // dice: click the cup, answer the result dialogue with the "leave" choice
    for (let round = 0; round < 6 && (await L.S()).mode === 8; round++) {
      for (let k = 0; k < 60; k++) { const d = await ev(() => globalThis.__mg.dice.d.state); if (d === 0 || (await L.S()).mode !== 8) break; await wait(500); }
      if ((await L.S()).mode !== 8) break;
      await L.clickScreen(385, 300);
      for (let k = 0; k < 120; k++) { const s = await L.S(); if (s.choosing || s.mode !== 8) break; const d = await ev(() => globalThis.__mg.dice.d.state); if (d === 0 && k > 6) break; await wait(500); }
      if ((await L.S()).choosing) await L.choose(2, 5000);
      await wait(1500);
    }
    await L.waitMode(0, 120000); await settle({ max: 60000 });
    log('  dice done, scene', (await L.S()).scene);
    await L.goTo('KAELLARE'); await settle({ max: 60000 });
    await L.verbRegion(6, 'hand'); await settle({ max: 60000 });
    await need(await L.hasInv('BRODKAKA'), 'BRODKAKA');
    await L.clickRegion(2); await settle({ max: 120000 }); // via the shelf passage to the prison
    await need((await L.S()).scene === 'FANGELSEHALOR', 'prison again');
    await L.useItem('BRODKAKA', ...(await L.regionCentre(3))); await settle({ max: 240000, skipDlg: false });
    await st('after bread');
    await need((await L.S()).act === 3, 'act 3 (spring)');
    await settle({ max: 120000 });
    await L.saveLoadCheck(1, 'end of act 2 (STORASALEN, act 3)');
  });
};
