// XR session lifecycle & feature detection. Populated in P1+.
export function onSessionStart(renderer, cb) {
  renderer.xr.addEventListener('sessionstart', () => cb(renderer.xr.getSession()));
}
