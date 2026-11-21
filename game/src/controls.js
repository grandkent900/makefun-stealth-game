// Keyboard and mouse input. Arrow keys or WASD move, Shift (or C as a
// toggle) sneaks, a mouse click throws a coin at that spot, Enter confirms
// on menus, M mutes, R restarts the run.
import { FLOOR_X, FLOOR_Y, TILE } from './config.js';

export function createControls(canvas) {
  const keys = new Set();
  let sneakToggle = false;
  let coinTarget = null;
  let pressed = new Set();

  function keyOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
    if (k === 'c') sneakToggle = !sneakToggle;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    coinTarget = { x: (sx - FLOOR_X) / TILE, y: (sy - FLOOR_Y) / TILE };
  });

  return {
    // The movement vector for this frame, normalised.
    move() {
      let mx = 0;
      let my = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) mx -= 1;
      if (keys.has('ArrowRight') || keys.has('d')) mx += 1;
      if (keys.has('ArrowUp') || keys.has('w')) my -= 1;
      if (keys.has('ArrowDown') || keys.has('s')) my += 1;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
      }
      return { mx, my };
    },
    get sneaking() {
      return keys.has('Shift') || sneakToggle;
    },
    // True once for each fresh key press; callers drain it every frame.
    wasPressed(k) {
      return pressed.has(k.toLowerCase());
    },
    drainPressed() {
      pressed.clear();
    },
    takeCoin() {
      const c = coinTarget;
      coinTarget = null;
      return c;
    },
  };
}
