// Act 3: walkthrough steps 18-30 (spring -> credits). QA_FROM=<n> skips steps < n.
export default async (L, ctx) => {
  const { log, shot, wait } = ctx;
  const { st, settle } = L;
  const need = L.need, ev = L.evalPage;
  const step = L.stepper();
  const birkPt = () => ev(() => { const o = globalThis.__ronja.O.BIRK; return [Math.round(o.x), Math.round(o.y - 70)]; });

  await step(18, 'STORASALEN in spring: Skalle-Per (optional) and the way out', async () => {
    await need((await L.S()).act === 3, 'act 3');
    await settle({ max: 60000 });
    await shot('qa-23-spring');
    await L.verbRegion(13, 'eye'); await settle({ max: 60000 }); // a remark from Skalle-Per's group (EYE)
  });
  await step(19, 'TJAERNEN: meet Birk (#313): he joins', async () => {
    await L.goTo("TJAERNEN", { max: 120000 });
    await L.converse([], 8, 90000); await settle({ max: 60000 });
    await need((await L.S()).birk, 'Birk follows');
    await shot('qa-24-birk-joined');
  });
  await step(20, 'GROTTANUTE: ask Birk for help (#416 -> alt 3 -> #419 -> alt 2 -> #421), stone, cave defence (mode 6)', async () => {
    await L.goTo('GROTTANUTE', { max: 120000 });
    await settle({ max: 60000 });
    const [bx, by] = await L.birkPoint();
    await L.verb(bx, by, 'mouth');
    await L.choose(3, 60000); await L.choose(2, 60000);
    await settle({ max: 120000 });
    await need(await L.flag(0x907), 'g907 stone pushed');
    await shot('qa-25-stone');
    await L.clickRegion(1);
    await L.waitMode(6, 90000);
    await wait(8000);
    await shot('qa-26-cave-game');
    const t0 = L.clock();
    while (L.clock() - t0 < 12000 && (await L.S()).mode === 6) {
      const r = await ev(() => { const m = globalThis.__mg.cave; const out = []; m.swarm.slots.forEach((sl, i) => { const o = sl.obj; if (!o.hidden && o.track && o.x > 0 && o.x < 640) out.push([Math.round(o.x), Math.round(o.y - 30)]); }); return { phase: m.st.phase, cone: m.st.cone, out }; });
      if (r.phase === 0 && r.out.length) await L.clickScreen(...r.out[0]); else await wait(300);
      await wait(700);
    }
    log('cave after real clicks', JSON.stringify(await ev(() => { const m = globalThis.__mg.cave; return { phase: m.st.phase, hits: m.swarm.hits }; })));
    for (let round = 0; round < 3 && !(await L.flag(0x8df)); round++) {
      if ((await L.S()).mode === 6) {
        const ph = await ev(() => globalThis.__mg.cave.st.phase);
        if (ph === 0) await ev(() => globalThis.__mg.cave.win());
      }
      await L.waitMode(0, 120000); await settle({ max: 60000 });
      if (!(await L.flag(0x8df))) { log('  cave round lost; retry'); await L.clickRegion(1); await L.waitMode(6, 90000); await wait(8000); }
    }
    await need(await L.flag(0x8df), 'g8df cave defended');
    await st('cave won');
  });
  await step(21, 'GROTTANINNE: tinder + fire steel on the fireplace -> g90a', async () => {
    await L.clickRegion(1); await settle({ max: 90000 }); // cave mouth
    await need((await L.S()).scene === 'GROTTANINNE', 'in the cave');
    await L.useItem('FNOSKE', ...(await L.regionCentre(2))); await settle({ max: 120000 });
    await need(await L.flag(0x909), 'g909 tinder laid');
    await L.useItem('ELDSTAL', ...(await L.regionCentre(2))); await settle({ max: 120000 });
    await need(await L.flag(0x90a), 'g90a fire burns');
    await shot('qa-27-fire');
  });
  await step(22, 'GLUPAFALLET: net, cast it, re-enter, catch the salmon', async () => {
    await L.goTo('GROTTANUTE', { max: 60000 });
    await L.goTo('GLAENTAN'); await L.goTo('KAELLAN'); await L.goTo('SKOGEN'); await L.goTo('GLUPAFALLET');
    await settle({ max: 60000 });
    await L.verbRegion(4, 'hand'); await settle({ max: 90000 });
    await need(await L.hasInv('FISKNAT'), 'FISKNAT');
    await L.useItem('FISKNAT', ...(await L.regionCentre(5))); await settle({ max: 120000 });
    await L.goTo('SKOGEN'); await L.goTo('GLUPAFALLET'); await settle({ max: 60000 });
    await need(await L.flag(0x8fb), 'g8fb net ripe');
    await L.verbRegion(5, 'hand'); await settle({ max: 180000 });
    await need(await L.hasInv('LAX'), 'LAX');
    await need(await L.flag(0x900), 'g900 salmon caught');
    await shot('qa-28-salmon');
  });
  await step(23, 'GROTTANINNE: roast and eat the salmon (LAX on fire, click fire)', async () => {
    await L.goTo('GROTTANUTE', { max: 60000 });
    await L.clickRegion(1); await settle({ max: 90000 });
    await L.useItem('LAX', ...(await L.regionCentre(2))); await settle({ max: 180000 });
    await need(await L.flag(0x908), 'g908 salmon roasting');
    await L.verbRegion(2, 'hand'); await settle({ max: 180000 });
    await need(await L.flag(0x90b), 'g90b salmon eaten');
  });
  await step(24, 'KAELLAN: vessel, fill at the spring; deliver in the cave -> summer', async () => {
    await L.goTo('GROTTANUTE', { max: 60000 });
    await L.goTo('GLAENTAN'); await L.goTo('KAELLAN'); await settle({ max: 60000 });
    await L.verbRegion(4, 'hand'); await settle({ max: 90000 });
    await need(await L.hasInv('VATTENKARL'), 'VATTENKARL');
    await L.useItem('VATTENKARL', ...(await L.regionCentre(5))); await settle({ max: 120000 });
    await need(await L.flag(0x90e), 'g90e vessel filled');
    await L.goTo('GLAENTAN'); await L.goTo('GROTTANUTE', { max: 60000 });
    await L.clickRegion(1);
    await settle({ max: 240000 });
    await need(await L.flag(0x8f7), 'g8f7 summer');
    await st('summer'); await shot('qa-29-summer');
    await settle({ max: 120000 });
    await L.saveLoadCheck(2, 'summer in the cave (GROTTANINNE)');
  });
  await step(26, 'GROTTANUTE after the summer: Lill-Klippen', async () => {
    await L.goTo('GROTTANUTE', { max: 60000 }); await settle({ max: 60000 });
    await shot('qa-30-lillklippen');
    await L.verbRegion(3, 'mouth'); await L.converse([], 6, 120000); await settle({ max: 120000 });
  });
  await step(27, 'GLAENTAN: moss on the mare, horses', async () => {
    await L.goTo('GLAENTAN'); await settle({ max: 60000 });
    await shot('qa-31-glaentan');
    await L.useItem('VITMOSSA', ...(await L.regionCentre(6))); await settle({ max: 180000 });
    await need(await L.flag(0x901), 'g901 mare bandaged');
    await L.verbRegion(7, 'hand'); await settle({ max: 180000 });
    await need(await L.flag(0x902), 'g902 horses handled');
  });
  await step(28, 'GLUPAFALLET: river with the bird witch (mode 7) -> g8e2', async () => {
    await L.goTo('KAELLAN'); await L.goTo('SKOGEN'); await L.goTo('GLUPAFALLET'); await settle({ max: 60000 });
    for (let round = 1; round <= 4 && !(await L.flag(0x8e2)); round++) {
      await L.clickRegion(0x3a);
      await L.waitMode(7, 60000);
      await L.riverBot(28, 240000);
      await L.waitMode(0, 120000); await settle({ max: 120000 });
      log(`river 2 round ${round}: g8e2 =`, await L.flag(0x8e2));
    }
    await need(await L.flag(0x8e2), 'g8e2 river 2 won');
  });
  await step(29, 'GROTTANUTE: Lovis visits (#480) -> g905', async () => {
    await settle({ max: 60000 });
    if ((await L.S()).scene !== 'GROTTANUTE') await L.goTo('GROTTANUTE', { max: 60000 });
    await settle({ max: 60000 });
    await shot('qa-32-lovis');
    await L.verbRegion(3, 'mouth'); await settle({ max: 180000 });
    await need(await L.flag(0x905), 'g905 Lovis visit done');
  });
  await step(30, 'KAELLAN: Mattis at the spring -> outro.smk -> credits -> start screen', async () => {
    await L.goTo('GLAENTAN'); await L.goTo('KAELLAN'); await settle({ max: 60000 });
    await shot('qa-33-mattis');
    await L.verbRegion(6, 'mouth');
    // the talk, then outro.smk, then eftertext.smk: skip the movies, wait for the start screen
    const t0 = L.clock(); let seen = new Set();
    while (L.clock() - t0 < 300000) {
      const s = await L.S().catch(() => null);
      if (!s) { if (await ctx.page.$('.bdb-start')) break; await wait(500); continue; }
      if (s.movie) seen.add(s.movie);
      const b = await L.skipText(); if (b) { log('  skip offer:', b, '| movie:', s.movie); await (await L.skipBtn()).click().catch(() => {}); }
      if (await ctx.page.$('.bdb-start')) break;
      await wait(700);
    }
    log('movies seen at the end:', [...seen].join(','));
    await need(!!(await ctx.page.$('.bdb-start')), 'credits finished -> start screen');
    await shot('qa-34-end');
  });
};
