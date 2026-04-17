// Score, timer, combo — P5.
// Base: 10 per apple. Combo: successful pops within COMBO_WINDOW add +0.5 multiplier
// (capped). The window closes automatically when it lapses, resetting the multiplier.
// Cross-plane / distance bonuses live in the onPop call so callers can attach them later (P6).

const DEFAULT_ROUND = 90;       // seconds
const COMBO_WINDOW = 3.0;       // seconds between successful pops to keep combo
const COMBO_STEP = 0.5;
const COMBO_MAX = 5.0;

export function createScoring({ roundSeconds = DEFAULT_ROUND } = {}) {
  let score = 0;
  let combo = 1.0;
  let lastPop = -Infinity;
  let startTime = -1;          // seconds
  let ended = false;

  function start(nowSec) {
    score = 0;
    combo = 1.0;
    lastPop = -Infinity;
    startTime = nowSec;
    ended = false;
  }

  function timeLeft(nowSec) {
    if (startTime < 0) return roundSeconds;
    return Math.max(0, roundSeconds - (nowSec - startTime));
  }

  function tick(nowSec) {
    if (startTime < 0 || ended) return;
    if (nowSec - startTime >= roundSeconds) { ended = true; combo = 1.0; return; }
    if (combo > 1.0 && nowSec - lastPop > COMBO_WINDOW) combo = 1.0;
  }

  // Called when a lasso successfully pops apples (sum === 10).
  function onPop(pickedCount, nowSec, { bonusMultiplier = 1 } = {}) {
    if (ended || pickedCount <= 0) return 0;
    if (nowSec - lastPop <= COMBO_WINDOW) combo = Math.min(combo + COMBO_STEP, COMBO_MAX);
    else combo = 1.0;
    lastPop = nowSec;
    const base = pickedCount * 10;
    const gained = Math.round(base * combo * bonusMultiplier);
    score += gained;
    return gained;
  }

  return {
    start, tick, onPop, timeLeft,
    get score()  { return score; },
    get combo()  { return combo; },
    get ended()  { return ended; },
    get round()  { return roundSeconds; },
  };
}
