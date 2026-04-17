// Numbered apple entity. P2.
// Each apple has value 1-9, a Three.js mesh, and a world position bound to a plane.
export class Apple {
  constructor(value, position) {
    this.value = value;
    this.position = position;
    this.mesh = null; // built in P2 with number sprite
    this.selected = false;
  }
}
