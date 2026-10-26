export default async (L, { click, wait, log, shot }) => {
  const { st, settle } = L;
  log('== step 0: logo -> menu -> Nieuw spel -> intro -> Formaning');
  await settle({ skipMovies: true, max: 40000 });
  await shot('qa-00-menu');
  await click(320, 330); await wait(400); await shot('qa-00-confirm'); await click(260, 270);
  await wait(1500);
  await settle({ skipMovies: true, max: 60000 });
  await st('courtyard');
  await shot('qa-01-courtyard');
};
