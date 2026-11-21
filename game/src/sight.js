// Line of sight and lantern vision cones. The cone the player sees drawn on
// the floor is built from the very same raycasts the guards use to spot
// Wren, so lit floor is exactly what a guard can see.
import { CONE_RANGE, CONE_HALF_ANGLE } from './config.js';
import { blocksSight } from './levels.js';

// Step along a ray in small increments; true when nothing blocks sight
// between the two points. Points are in tile coordinates.
export function hasSight(level, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.08));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(level, ax + dx * t, ay + dy * t)) return false;
  }
  return true;
}

// March one ray from (ox, oy) along angle until it hits something that
// blocks sight or runs out of range. Returns the hit point.
export function castRay(level, ox, oy, angle, maxDist) {
  const step = 0.09;
  let d = step;
  while (d < maxDist) {
    const x = ox + Math.cos(angle) * d;
    const y = oy + Math.sin(angle) * d;
    if (blocksSight(level, x, y)) return { x, y, dist: d };
    d += step;
  }
  return { x: ox + Math.cos(angle) * maxDist, y: oy + Math.sin(angle) * maxDist, dist: maxDist };
}

// The polygon of a guard's lantern cone: the guard's position plus the hit
// points of a fan of rays across the cone's angle. The renderer draws this
// polygon, and canSee uses the same fan, so the picture never lies.
export function conePolygon(level, gx, gy, facing, range = CONE_RANGE) {
  const rays = 15;
  const pts = [{ x: gx, y: gy }];
  for (let i = 0; i <= rays; i++) {
    const a = facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
    const hit = castRay(level, gx, gy, a, range);
    pts.push({ x: hit.x, y: hit.y });
  }
  return pts;
}

// Is the player visible to this guard right now? Inside the range, inside
// the angle, and with a clear line of sight.
export function guardSeesPlayer(level, guard, px, py) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE_RANGE) return false;
  if (dist < 0.35) return hasSight(level, guard.x, guard.y, px, py);
  let diff = Math.atan2(dy, dx) - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CONE_HALF_ANGLE) return false;
  return hasSight(level, guard.x, guard.y, px, py);
}

// How clearly the guard sees the player: 1 up close, fading to a dim
// 0.25 at the edge of the lantern's reach.
export function sightStrength(guard, px, py) {
  const dist = Math.hypot(px - guard.x, py - guard.y);
  const t = Math.max(0, Math.min(1, dist / CONE_RANGE));
  return 1 - 0.75 * t;
}
