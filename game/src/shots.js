// Deterministic screenshot scenes for ?shot=title|sneak|loot|alarm.
// Each scene builds a fixed run from a fixed seed and poses it, so the
// same query always stages the same picture. The boot module sets
// window.__SHOT_READY once the scene is staged.
import { createRun, stepRun } from './sim.js';
import { drawWorld, drawTitle } from './draw.js';
import { makeRng } from './rng.js';

function idle(run, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    stepRun(run, { mx: 0, my: 0, sneak: false, coin: null }, 1 / 60);
  }
}

// Pose a guard so its cone falls across the player's path, then creep
// Wren along the cone's edge in sneak.
function poseSneak(run) {
  const level = run.level;
  const g = level.guards[0];
  g.x = 10.5;
  g.y = 3.5;
  g.facing = Math.PI / 2;
  g.state = 'patrol';
  g.leg = 0;
  run.player.x = 8.5;
  run.player.y = 5.5;
  run.player.face = Math.PI / 2;
  for (let i = 0; i < 40; i++) {
    stepRun(run, { mx: 0, my: -0.4, sneak: true, coin: null }, 1 / 60);
  }
}

// Walk Wren onto a gem so the pickup chime moment is caught mid-scene.
function poseLoot(run) {
  const level = run.level;
  const gem = level.loot[0];
  run.player.x = gem.x;
  run.player.y = gem.y + 0.9;
  run.player.face = -Math.PI / 2;
  for (let i = 0; i < 26; i++) {
    stepRun(run, { mx: 0, my: -1, sneak: false, coin: null }, 1 / 60);
  }
}

// Stand Wren in a lantern beam until the guard gives chase, then freeze
// the alarm moment.
function poseAlarm(run) {
  const level = run.level;
  const g = level.guards[0];
  g.x = 10.5;
  g.y = 3.5;
  g.facing = Math.PI / 2;
  g.loop = [{ x: 10.5, y: 3.5 }];
  g.leg = 0;
  run.player.x = 10.5;
  run.player.y = 6.5;
  run.player.face = -Math.PI / 2;
  // Stand in the beam until the guard gives chase, and freeze the very
  // moment the chase begins — a breath later and Wren is caught.
  for (let i = 0; i < 4 * 60 && g.state !== 'chase'; i++) {
    stepRun(run, { mx: 0, my: 0, sneak: false, coin: null }, 1 / 60);
  }
}

export function stageShot(ctx, name) {
  const rng = makeRng(20261121);
  void rng;
  if (name === 'title') {
    drawTitle(ctx);
    return { scene: 'title', run: null };
  }
  const run = createRun();
  if (name === 'sneak') {
    poseSneak(run);
    drawWorld(ctx, run);
  } else if (name === 'loot') {
    poseLoot(run);
    drawWorld(ctx, run);
  } else if (name === 'alarm') {
    poseAlarm(run);
    drawWorld(ctx, run);
  } else {
    drawWorld(ctx, run);
  }
  return { scene: name, run };
}

export function shotNames() {
  return ['title', 'sneak', 'loot', 'alarm'];
}
