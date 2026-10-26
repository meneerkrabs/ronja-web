// Act 1: walkthrough steps 1-6 (game-logic.md §1.1). QA_FROM=<n> skips steps < n (resume with dev URL params).
export default async (L, ctx) => {
  const { log, shot, wait } = ctx;
  const { st, settle } = L;
  const need = L.need;
  const ev = L.evalPage;
  const step = L.stepper();

  await step(1, 'LOVISMATTISRUM: strap (hand) -> REM', async () => {
    await L.goTo('STORASALEN'); await settle({ max: 60000 });
    await L.clickRegion(2); // LOVISMATTISRUM: the first entry plays #46 (Lovis spins): test "Sla gesprek over" on it
    await L.trySkip('dialogue #46 on first entry to LOVISMATTISRUM', 2500);
    await settle({ max: 90000 });
    await L.verbRegion(1, 'hand'); await settle({ max: 40000 });
    await need(await L.hasInv('REM'), 'REM in inventory');
  });
  await step(2, 'tinder (STORASALEN), flint / fire steel / rat trap (KOKET)', async () => {
    await L.goTo('STORASALEN');
    await L.verbRegion(1, 'hand'); await settle();
    await need(await L.hasInv('FNOSKE'), 'FNOSKE');
    await L.goTo('KOKET');
    for (const [r, item] of [[4, 'FLINTA'], [5, 'ELDSTAL'], [9, 'RATTBUR']]) {
      await L.verbRegion(r, 'hand'); await settle();
      await need(await L.hasInv(item), item);
    }
    await shot('qa-03-kitchen');
  });
  await step(3, 'tower key, chest, map', async () => {
    await L.goTo('TORNET');
    await L.verbRegion(4, 'eye'); await settle();
    await L.verbRegion(4, 'hand'); await settle();
    await need(await L.hasInv('NYCKEL'), 'NYCKEL');
    await L.goTo('SKALLEPERSRUM'); await settle({ max: 90000 });
    await L.useItem('NYCKEL', ...(await L.regionCentre(1))); await settle({ max: 60000 });
    await shot('qa-04-chest');
    await L.verbRegion(5, 'hand'); await settle({ max: 60000 });
    await need(await L.hasInv('KARTAN'), 'KARTAN');
  });
  await step(4, 'TJAERNEN lake cones (mode 2): real clicks, then dev win', async () => {
    await L.goTo('TJAERNEN');
    for (let round = 1; round <= 3 && !(await L.flag(0x8dd)); round++) {
      await L.verbRegion(3, 'hand');
      await L.waitMode(2, 30000);
      await wait(9000);
      if (round === 1) await shot('qa-05-lake');
      const t0 = L.clock();
      while (L.clock() - t0 < (round === 1 ? 14000 : 1000)) {
        const tgt = await ev(() => { const m = globalThis.__mg.lake; const out = []; m.swarm.slots.forEach((sl, i) => { const o = sl.obj; if (!o.hidden && o.track && o.x > 0 && o.x < 640) out.push([Math.round(o.x), Math.round(o.y - 30), m.swarm.state[i]]); }); return { phase: m.st.phase, cone: m.st.cone, hits: m.swarm.hits, out }; });
        if (tgt.phase !== 0) { await wait(500); continue; }
        const t = tgt.out.sort((a, b) => b[2] - a[2])[0];
        if (t && tgt.cone === 0) await L.clickScreen(t[0], Math.max(190, t[1])); else await wait(300);
        await wait(600);
      }
      const info = await ev(() => { const m = globalThis.__mg.lake; return { phase: m.st.phase, hits: m.swarm.hits }; });
      log(`lake round ${round}: after real clicks`, JSON.stringify(info));
      if (round === 1) await shot('qa-05b-lake');
      if (info.phase === 0) await ev(() => globalThis.__mg.lake.win());
      else log('  (round lost: 4 dwarves at the rock; retrying through the scene)');
      await L.waitMode(0, 120000); await settle();
      log(`lake round ${round}: g8dd =`, await L.flag(0x8dd));
    }
    await need(await L.flag(0x8dd), 'g8dd tarn won');
    await L.verbRegion(3, 'hand'); await settle();
    await need(await L.hasInv('VITMOSSA'), 'VITMOSSA');
  });
  await step(5, 'GLUPAFALLET river (mode 1): stone-jumping bot with real clicks (BFS over the stone graph)', async () => {
    await L.goTo('GLUPAFALLET');
    await L.verbRegion(0x3a, 'eye'); await settle(); // EYE on the start stone: nothing happens (verb has no handler)
    await L.clickRegion(0x3a);
    await L.waitMode(1, 30000);
    await L.riverBot(28, 150000);
    await L.waitMode(0, 60000); await settle();
    await need(await L.flag(0x8e1), 'g8e1 river won');
    await shot('qa-06-after-river');
  });
  await step(6, 'BORGGARDEN ladder -> HELVETESGAPET: rescue Birk with REM -> act 2', async () => {
    await need(await L.mapTravel('BORGPORTEN'), 'map travel GROTTANUTE -> BORGPORTEN');
    await L.goTo('BORGGARDEN');
    await L.verbRegion(5, 'hand'); // up the ladder
    await settle({ max: 90000 });
    await need((await L.S()).scene === 'HELVETESGAPET', 'arrived at HELVETESGAPET');
    await shot('qa-07-gap');
    await need(await L.flag(0x8ea), 'g8ea Birk appeared');
    // first click near Birk plays #202
    await L.clickRegion(2); await settle();
    await need(await L.flag(0x8eb), 'g8eb remark');
    const spot = await L.regionCentre(3);
    await L.at(spot[0], spot[1]); await settle();
    await L.useItem('REM', ...(await L.regionCentre(2))); await settle({ max: 120000 });
    await shot('qa-08-rescued');
    await need((await L.S()).act === 2, 'act 2 reached');
    await settle({ max: 60000 });
    await L.saveLoadCheck(0, 'end of act 1 (STORASALEN, act 2)');
  });
};
