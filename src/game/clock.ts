// Game clock (DAT_004e2010): real milliseconds minus the time spent paused. The original paused it around
// every blocking load (sprites, scene graphics, sound files) so loading never advances animations.
// The port pauses it while a sound file is being fetched.

let paused = 0;
let pauseStart = 0;
let totalPaused = 0;

export const realNow = (): number => performance.now();

/** Game time in ms. */
export function gameNow(): number {
  return (paused > 0 ? pauseStart : realNow()) - totalPaused;
}

/** Pause the game clock; call the returned function to release (nesting is counted). */
export function pauseClock(): () => void {
  if (paused++ === 0) pauseStart = realNow();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--paused === 0) totalPaused += realNow() - pauseStart;
  };
}

export const clockPaused = (): boolean => paused > 0;
