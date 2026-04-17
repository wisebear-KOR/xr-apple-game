// Per-plane placement state: running sum and lock flag. Sum hits 10 → clear (locked, scored);
// sum goes over 10 → overflow (locked, no score). Lock is permanent for the round.
export function createPlaneStates() {
  const states = new Map(); // planeId → { sum, apples:Set, locked, reason }

  function get(planeId) {
    let s = states.get(planeId);
    if (!s) {
      s = { sum: 0, apples: new Set(), locked: false, reason: null };
      states.set(planeId, s);
    }
    return s;
  }

  // Returns one of: 'locked' | 'added' | 'clear' | 'overflow'.
  function addApple(planeId, apple) {
    const s = get(planeId);
    if (s.locked) return 'locked';
    s.apples.add(apple);
    s.sum += apple.value;
    if (s.sum === 10) { s.locked = true; s.reason = 'clear'; return 'clear'; }
    if (s.sum > 10)  { s.locked = true; s.reason = 'overflow'; return 'overflow'; }
    return 'added';
  }

  function applesOn(planeId) {
    return Array.from(get(planeId).apples);
  }

  function reset() { states.clear(); }

  function counts() {
    let cleared = 0, overflow = 0, active = 0;
    for (const s of states.values()) {
      if (s.reason === 'clear') cleared++;
      else if (s.reason === 'overflow') overflow++;
      else if (s.sum > 0) active++;
    }
    return { cleared, overflow, active };
  }

  return { get, addApple, applesOn, reset, counts, states };
}
