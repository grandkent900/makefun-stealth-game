// The fixed-step simulation: Wren, the wardens, the loot, the vault door and
// the rope. No DOM here, so the same code runs in the browser, in the
// gameplay tests and in the screenshot renderer.
import {
  WALK_SPEED, SNEAK_SPEED, GEM_SCORE, ARTIFACT_SCORE, CLEAR_BONUS,
  GHOST_BONUS, SWEEP_BONUS, SPEED_BONUS_RATE, COINS_PER_NIGHT, MAX_NERVE,
  CATCH_DIST, NOISE_RADIUS, NOISE_NUDGE, NIGHT_PAR,
} from './config.js';
import { loadNight, blocksMove, isExitTile } from './levels.js';
import { tickGuard, guardSpeed, guardTarget, guardReachedWaypoint } from './wardens.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Breadth-first path over walkable tiles. Returns tile centres from start
// to goal, or null when no route exists. The vault door tile counts as
// walkable only while it is open.
export function findPath(level, sx, sy, tx, ty) {
  const s0 = [Math.floor(sx), Math.floor(sy)];
  const t0 = [Math.floor(tx), Math.floor(ty)];
  const keyOf = (x, y) => `${x},${y}`;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) return false;
    const t = level.grid[y][x];
    if (t === '#' || t === 'D') return false;
    if (t === 'V') return level.door.open;
    return true;
  };
  if (!walkable(t0[0], t0[1]) || !walkable(s0[0], s0[1])) return null;
  const prev = new Map();
  const queue = [s0];
  prev.set(keyOf(s0[0], s0[1]), null);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === t0[0] && cy === t0[1]) {
      const cells = [];
      let cur = [cx, cy];
      while (cur) {
        cells.unshift({ x: cur[0] + 0.5, y: cur[1] + 0.5 });
        cur = prev.get(keyOf(cur[0], cur[1]));
      }
      return cells;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(nx, ny) || prev.has(keyOf(nx, ny))) continue;
      prev.set(keyOf(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function canReach(level, sx, sy, tx, ty) {
  return findPath(level, sx, sy, tx, ty) !== null;
}

// Slide a circle of radius r through the grid: try the x step, then the y
// step, so Wren and the wardens glide along walls instead of sticking.
function slideMove(level, pos, dx, dy, r) {
  const nx = pos.x + dx;
  if (!blocksMove(level, nx + Math.sign(dx) * r, pos.y - r * 0.8)
    && !blocksMove(level, nx + Math.sign(dx) * r, pos.y + r * 0.8)
    && !blocksMove(level, nx + Math.sign(dx) * r, pos.y)) {
    pos.x = nx;
  }
  const ny = pos.y + dy;
  if (!blocksMove(level, pos.x - r * 0.8, ny + Math.sign(dy) * r)
    && !blocksMove(level, pos.x + r * 0.8, ny + Math.sign(dy) * r)
    && !blocksMove(level, pos.x, ny + Math.sign(dy) * r)) {
    pos.y = ny;
  }
}

export function createRun() {
  return {
    night: 0,
    level: loadNight(0),
    player: { x: 1.5, y: 1.5, face: 0, moving: false },
    coins: COINS_PER_NIGHT,
    coinFlight: null,
    coinRing: null,
    coinRingTimer: 0,
    score: 0,
    nightScore: 0,
    nerve: MAX_NERVE,
    time: 0,
    nightTime: 0,
    state: 'playing', // playing | nightclear | caught | runover
    won: false,
    spotted: false,
    hunted: false,
    lootTaken: 0,
    nightLoot: 0,
    hasKey: false,
    events: [],
    noiseTimer: 0,
    message: '',
    messageTimer: 0,
  };
}

function loadNightInto(run, index) {
  run.night = index;
  run.level = loadNight(index);
  run.player = { x: run.level.start.x, y: run.level.start.y, face: 0, moving: false };
  run.coins = COINS_PER_NIGHT;
  run.coinFlight = null;
  run.coinRing = null;
  run.coinRingTimer = 0;
  run.nightScore = 0;
  run.nightTime = 0;
  run.nightLoot = 0;
  run.spotted = false;
  run.hunted = false;
  run.hasKey = !run.level.hasKey;
  run.state = 'playing';
}

function addScore(run, pts) {
  run.score += pts;
  run.nightScore += pts;
}

function finishNight(run) {
  const level = run.level;
  const par = NIGHT_PAR[run.night];
  let bonus = CLEAR_BONUS * (run.night + 1);
  let lines = [`Night clear +${bonus}`];
  addScore(run, bonus);
  if (!run.hunted) {
    addScore(run, GHOST_BONUS);
    lines.push(`Ghost (never hunted) +${GHOST_BONUS}`);
  }
  if (run.nightLoot === level.loot.length) {
    addScore(run, SWEEP_BONUS);
    lines.push(`Everything taken +${SWEEP_BONUS}`);
  }
  const speed = Math.max(0, Math.round((par - run.nightTime) * SPEED_BONUS_RATE));
  if (speed > 0) {
    addScore(run, speed);
    lines.push(`Speed +${speed}`);
  }
  run.events.push({ type: 'clear', lines });
  run.state = 'nightclear';
  run.message = lines.join('  ');
  run.messageTimer = 4;
}

// Advance to the next night after a clear, or end the run in triumph.
export function advanceNight(run) {
  if (run.night + 1 >= 3) {
    run.won = true;
    run.state = 'runover';
  } else {
    loadNightInto(run, run.night + 1);
  }
}

// One fixed step. input: { mx, my, sneak, coin: {x,y} | null }.
export function stepRun(run, input, dt) {
  run.events.length = 0;
  if (run.state !== 'playing') return;
  run.time += dt;
  run.nightTime += dt;
  if (run.messageTimer > 0) run.messageTimer -= dt;

  const level = run.level;
  const p = run.player;
  const speed = input.sneak ? SNEAK_SPEED : WALK_SPEED;
  const len = Math.hypot(input.mx, input.my);
  p.moving = len > 0.1;
  if (p.moving) {
    const nx = (input.mx / len) * speed * dt;
    const ny = (input.my / len) * speed * dt;
    slideMove(level, p, nx, ny, 0.3);
    p.face = Math.atan2(input.my, input.mx);
  }

  // Walking is loud: every third of a second a step carries to nearby ears.
  run.noiseTimer -= dt;
  let noise = null;
  if (p.moving && !input.sneak && run.noiseTimer <= 0) {
    run.noiseTimer = 0.34;
    noise = { x: p.x, y: p.y, radius: NOISE_RADIUS };
    run.events.push({ type: 'step', x: p.x, y: p.y, loud: true });
  } else if (p.moving && input.sneak && run.noiseTimer <= 0) {
    run.noiseTimer = 0.5;
    run.events.push({ type: 'step', x: p.x, y: p.y, loud: false });
  }

  // Throw a coin: it arcs to the clicked spot, then rings and draws guards.
  if (input.coin && run.coins > 0 && !run.coinFlight) {
    run.coins--;
    run.coinFlight = { from: { x: p.x, y: p.y }, to: { x: input.coin.x, y: input.coin.y }, t: 0 };
    run.events.push({ type: 'throw' });
  }
  if (run.coinFlight) {
    run.coinFlight.t += dt / 0.45;
    if (run.coinFlight.t >= 1) {
      run.coinRing = { ...run.coinFlight.to };
      run.coinRingTimer = 1.4;
      run.coinFlight = null;
      run.events.push({ type: 'ring', x: run.coinRing.x, y: run.coinRing.y });
    }
  }
  const ring = run.coinRingTimer > 0 ? run.coinRing : null;
  if (run.coinRingTimer > 0) run.coinRingTimer -= dt;
  if (run.coinRingTimer <= 0) run.coinRing = null;

  // Pick up loot, the brass key, and open the vault door on approach.
  for (const item of level.loot) {
    if (!item.taken && Math.hypot(item.x - p.x, item.y - p.y) < 0.55) {
      item.taken = true;
      run.lootTaken++;
      run.nightLoot++;
      const pts = item.kind === 'gem' ? GEM_SCORE : ARTIFACT_SCORE;
      addScore(run, pts);
      run.events.push({ type: 'pickup', kind: item.kind, pts });
    }
  }
  if (level.key && !level.key.taken && Math.hypot(level.key.x - p.x, level.key.y - p.y) < 0.55) {
    level.key.taken = true;
    run.hasKey = true;
    run.events.push({ type: 'key' });
  }
  if (level.door && !level.door.open && run.hasKey) {
    const d = Math.hypot(level.door.x + 0.5 - p.x, level.door.y + 0.5 - p.y);
    if (d < 1.4) {
      level.door.open = true;
      run.events.push({ type: 'door' });
    }
  }

  // The wardens think, then walk.
  for (const g of level.guards) {
    const ctx = { px: p.x, py: p.y, sneaking: !!input.sneak, noise, coinRing: ring };
    tickGuard(level, g, dt, ctx);
    if (g.alert >= 0.35) run.spotted = true;
    if (g.huntedEver) run.hunted = true;
    const target = guardTarget(g);
    if (g.state === 'suspicious' && g.lastSeen) {
      g.facing = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
    } else if (target) {
      const path = findPath(level, g.x, g.y, target.x, target.y);
      if (!path) {
        // Nowhere to go: a patrolling guard skips the unreachable waypoint
        // and tries the next one; a hunting guard gives up after a couple
        // of seconds and heads home instead of waiting forever.
        g.noPath = (g.noPath || 0) + dt;
        if (g.noPath > 1 && g.state === 'patrol') {
          g.noPath = 0;
          guardReachedWaypoint(g);
        } else if (g.noPath > 2) {
          g.noPath = 0;
          g.state = 'return';
          g.investigate = null;
        }
      } else if (path.length > 1) {
        g.noPath = 0;
        const next = path[1];
        const dx = next.x - g.x;
        const dy = next.y - g.y;
        const d = Math.hypot(dx, dy);
        const sp = guardSpeed(g) * dt;
        if (d <= sp) {
          g.x = next.x;
          g.y = next.y;
          if (path.length <= 2 && g.state === 'patrol') guardReachedWaypoint(g);
        } else {
          g.x += (dx / d) * sp;
          g.y += (dy / d) * sp;
        }
        g.facing = Math.atan2(dy, dx);
        g.stepPhase += sp * 2.2;
        if (g.stepPhase > Math.PI * 2) {
          g.stepPhase -= Math.PI * 2;
          run.events.push({ type: 'guardstep', x: g.x, y: g.y, dist: Math.hypot(g.x - p.x, g.y - p.y) });
        }
      } else if (path && path.length <= 1 && g.state === 'patrol') {
        guardReachedWaypoint(g);
      }
    } else if (g.state === 'investigate') {
      // Arrived and looking: sweep the lantern slowly.
      g.facing += dt * 0.9;
    }
    // A chasing guard that reaches Wren catches her.
    if (g.state === 'chase' && Math.hypot(g.x - p.x, g.y - p.y) < CATCH_DIST) {
      run.nerve--;
      run.score = Math.max(0, run.score - run.nightScore);
      run.events.push({ type: 'caught' });
      if (run.nerve <= 0) {
        run.state = 'runover';
        run.won = false;
      } else {
        run.state = 'caught';
      }
      return;
    }
  }

  // The rope: only when the vault door stands open.
  if (level.door.open && isExitTile(level, p.x, p.y)) {
    finishNight(run);
  }
}

// After a catch, start the same night over with a fresh layout.
export function retryNight(run) {
  loadNightInto(run, run.night);
}
