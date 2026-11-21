// The warden AI: a small state machine per guard.
//   patrol -> suspicious -> investigate -> chase -> return -> patrol
// Detection is a meter from 0 to 1. Seeing Wren raises it; losing sight
// lowers it. The guard remembers the last place it saw the player, and a
// thrown coin's ring pulls it to investigate that spot instead.
import {
  ALERT_RISE, ALERT_FALL, SNEAK_VISIBILITY, SHADOW_VISIBILITY,
  SUSPECT_AT, HUNT_AT, CHASE_AT, CALM_AFTER, INVESTIGATE_SPEED, CHASE_SPEED, GUARD_SPEED,
} from './config.js';
import { guardSeesPlayer, sightStrength } from './sight.js';
import { isShadow } from './levels.js';

// One tick of one guard's mind. dt is seconds. ctx carries the player
// position, whether the player is sneaking, and a noise event if any.
export function tickGuard(level, guard, dt, ctx) {
  const sees = guardSeesPlayer(level, guard, ctx.px, ctx.py);
  if (sees) {
    let rate = ALERT_RISE * sightStrength(guard, ctx.px, ctx.py);
    if (ctx.sneaking) rate *= SNEAK_VISIBILITY;
    if (isShadow(level, ctx.px, ctx.py)) rate *= SHADOW_VISIBILITY;
    guard.alert = Math.min(1, guard.alert + rate * dt);
    guard.lastSeen = { x: ctx.px, y: ctx.py };
    guard.seenEver = true;
    guard.calmTimer = 0;
  } else {
    guard.alert = Math.max(0, guard.alert - ALERT_FALL * dt);
    guard.calmTimer += dt;
  }

  // A walking step nearby is heard: the guard turns toward the noise and
  // grows a little more alert, but a single step never triggers a hunt.
  if (ctx.noise && guard.state === 'patrol') {
    const d = Math.hypot(ctx.noise.x - guard.x, ctx.noise.y - guard.y);
    if (d < 3.0) {
      guard.alert = Math.min(HUNT_AT - 0.05, guard.alert + 0.05);
      guard.facing = Math.atan2(ctx.noise.y - guard.y, ctx.noise.x - guard.x);
    }
  }

  // A coin ring is a firm order: go and look at that spot.
  if (ctx.coinRing && (guard.state === 'patrol' || guard.state === 'suspicious' || guard.state === 'return')) {
    guard.investigate = { x: ctx.coinRing.x, y: ctx.coinRing.y };
    guard.state = 'investigate';
    guard.calmTimer = 0;
  }

  const prev = guard.state;
  if (guard.alert >= CHASE_AT) {
    guard.state = 'chase';
    guard.huntedEver = true;
  } else if (guard.alert >= HUNT_AT) {
    if (guard.state === 'patrol' || guard.state === 'suspicious' || guard.state === 'return') {
      guard.state = 'investigate';
      guard.investigate = guard.lastSeen ? { ...guard.lastSeen } : null;
    }
    if (guard.state === 'investigate' && guard.lastSeen) guard.investigate = { ...guard.lastSeen };
  } else if (guard.alert >= SUSPECT_AT) {
    if (guard.state === 'patrol') guard.state = 'suspicious';
  } else if (guard.state === 'suspicious') {
    guard.state = 'patrol';
  }

  if (guard.state === 'investigate' && guard.investigate) {
    const d = Math.hypot(guard.investigate.x - guard.x, guard.investigate.y - guard.y);
    if (d < 0.6) {
      // Looked, found nothing: linger a moment, then head home. The
      // radius is generous because a coin or a last-seen spot is a point,
      // not a tile centre, and the guard stops at the tile centre.
      guard.calmTimer += dt;
      if (guard.calmTimer > 2.5) {
        guard.state = 'return';
        guard.investigate = null;
      }
    }
  }

  if (guard.state === 'chase' && !sees) {
    // Lost the thief: keep running at the last seen spot for a while.
    if (guard.calmTimer > CALM_AFTER) {
      guard.state = 'return';
      guard.lastSeen = null;
    }
  }

  if (guard.state === 'return') {
    const home = guard.loop[guard.leg];
    const d = Math.hypot(home.x - guard.x, home.y - guard.y);
    if (d < 0.3 || guard.alert <= 0.02) {
      guard.state = 'patrol';
      guard.alert = 0;
    }
  }
  return prev !== guard.state;
}

export function guardSpeed(guard) {
  if (guard.state === 'chase') return CHASE_SPEED;
  if (guard.state === 'investigate') return INVESTIGATE_SPEED;
  return GUARD_SPEED;
}

// Where this guard is walking toward right now, or null while it stands
// still and stares (suspicious) or looks around (arrived at a spot).
export function guardTarget(guard) {
  if (guard.state === 'chase') return guard.lastSeen;
  if (guard.state === 'investigate') return guard.investigate;
  if (guard.state === 'return') return guard.loop[guard.leg];
  if (guard.state === 'patrol') return guard.loop[(guard.leg + 1) % guard.loop.length];
  return null;
}

// Called when a patrolling guard reaches its next waypoint.
export function guardReachedWaypoint(guard) {
  guard.leg = (guard.leg + 1) % guard.loop.length;
}
