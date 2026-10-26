// Extra checks (not part of the story walk): x1 = "Sla over" on a cutscene (ladder climb) and on dialogues; x2 = talking to Birk with all verbs in the act 3 scenes.
export const x1 = async (L, ctx) => {
  const { log, shot, wait } = ctx;
  log('== x1: "Sla over" on the ladder climb (dialogue #172 + climb cutscene) and on the Birk meeting #201 (act 1, strap + both trials done)');
  await L.verbRegion(5, 'hand');
  const seen = new Set();
  const t0 = L.clock();
  while (L.clock() - t0 < 90000) {
    const label = await L.skipText();
    if (label) { seen.add(label + ' @' + (await L.S()).scene); await (await L.skipBtn()).click().catch(() => {}); await wait(400); continue; }
    const s = await L.S();
    if (s.scene === 'HELVETESGAPET' && !s.dlg && !s.walking && !s.anim) { await wait(800); if (!(await L.skipText())) break; }
    await wait(300);
  }
  log('  offers pressed:', [...seen].join(' | '));
  const s = await L.S();
  await shot('qa-x1-gap');
  await L.need(s.scene === 'HELVETESGAPET' && !s.dlg && L.clock() - t0 < 90000, 'skipping the ladder climb and #201 reaches an idle HELVETESGAPET quickly');
  await L.need(await L.flag(0x8ea), 'g8ea Birk met');
};
export const x2 = async (L, ctx) => {
  const { log, shot, wait } = ctx;
  const { settle } = L;
  log('== x2: talk to Birk (MOUTH, HAND, EYE) in each act 3 scene');
  for (const scene of ['KAELLAN', 'GLAENTAN', 'SKOGEN', 'TJAERNEN', 'GLUPAFALLET']) {
    if ((await L.S()).scene !== scene) await L.goTo(scene, { max: 90000 });
    await settle({ max: 60000 });
    for (const v of ['mouth', 'hand', 'eye']) {
      const [bx, by] = await L.birkPoint().catch(() => [null, null]);
      if (bx === null) { log(`  !! ${scene}: no Birk to click`); break; }
      await L.verb(bx, by, v);
      const n = await L.converse([], 6, 60000);
      await settle({ max: 60000 });
      const s = await L.S();
      log(`  ${scene} ${v}: ${n} menu(s); last event #${s.ev}; dlg=${s.dlg} busy=${s.busy} walking=${s.walking}`);
      await L.need(!s.dlg && !s.choosing, `${scene} ${v} Birk dialogue ended`);
    }
  }
};
