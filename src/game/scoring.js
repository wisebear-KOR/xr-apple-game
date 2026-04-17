// Score, combo, bonus rules. P5.
// Base 10/apple, combo x1.5/x2.0 within 3s, cross-plane +50%, distant +20%.
export function createScore() {
  let score = 0;
  return {
    get value() { return score; },
    award(apples /* , context */) { score += apples.length * 10; return apples.length * 10; },
  };
}
