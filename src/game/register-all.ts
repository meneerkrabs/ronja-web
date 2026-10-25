// Pulls in every scene script, track-hook file and minigame by file name, so phase-2 code only has to add files:
//   src/game/scenes/<scene>.ts      registerScene(...)
//   src/game/hooks/<anything>.ts    hook(...)
//   src/game/minigames/<name>.ts    registerMinigame(...)
import.meta.glob('./scenes/*.ts', { eager: true });
import.meta.glob('./hooks/*.ts', { eager: true });
import.meta.glob('./minigames/*.ts', { eager: true });
