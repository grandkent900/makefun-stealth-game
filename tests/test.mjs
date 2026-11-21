// Gameplay tests for The Velvet Vault, run against the game's own modules:
//   node tests/test.mjs
import { createRun, stepRun, advanceNight, retryNight, findPath, canReach } from '../game/src/sim.js';
import { loadNight, blocksMove } from '../game/src/levels.js';
import { guardSeesPlayer } from '../game/src/sight.js';
import { makeRng } from '../game/src/rng.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`ok   ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${detail}`); }
}

const STEP = 1 / 60;

// The nearest tile (within 8 steps) no guard can currently see and at
// least 2 tiles from every guard, or null when there is none nearby.
function nearestHiddenTile(level, px, py) {
  const start = [Math.floor(px), Math.floor(py)];
  const seen = new Set([start.join(',')]);
  const queue = [{ cell: start, depth: 0 }];
  while (queue.length > 0) {
    const { cell, depth } = queue.shift();
    const [cx, cy] = cell;
    const center = { x: cx + 0.5, y: cy + 0.5 };
    const farEnough = level.guards.every((g) => Math.hypot(g.x - center.x, g.y - center.y) >= 2);
    const hidden = level.guards.every((g) => !guardSeesPlayer(level, g, center.x, center.y));
    if (farEnough && hidden) return center;
    if (depth >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) continue;
      const t = level.grid[ny][nx];
      if (t === '#' || t === 'D') continue;
      if (t === 'V' && !level.door.open) continue;
      queue.push({ cell: [nx, ny], depth: depth + 1 });
    }
  }
  return null;
}

// A scripted pilot: walk the BFS path from target to target, fleeing when
// a guard gives chase or closes in to investigate.
function pilotTo(run, tx, ty, budget = 240) {
  const level = run.level;
  let steps = 0;
  let lastCoin = -100;
  let path = findPath(level, run.player.x, run.player.y, tx, ty);
  if (!path) return false;
  let node = 1;
  let stuck = 0;
  let lastDist = Infinity;
  let waitTime = 0;
  let logAt = 0;
  while (steps < budget / STEP) {
    if (run.state !== 'playing') return run.state === 'nightclear';
    if (process.env.PILOT_DEBUG && run.time >= logAt) {
      logAt = run.time + 10;
      console.log(`  t=${run.time.toFixed(0)} night ${run.night + 1} -> (${tx}, ${ty}) player (${run.player.x.toFixed(1)}, ${run.player.y.toFixed(1)}) coins ${run.coins} | ` +
        run.level.guards.map((g, i) => `g${i}:${g.state.slice(0, 4)} a=${g.alert.toFixed(2)} (${g.x.toFixed(1)},${g.y.toFixed(1)})`).join(' '));
    }
    // Flee: if a guard is hunting nearby, retreat to the nearest tile no
    // guard can currently see (or wait there if already hidden) until
    // the guards calm down.
    const threat = level.guards
      .filter((g) => g.state === 'chase' || (g.state === 'investigate' && Math.hypot(g.x - run.player.x, g.y - run.player.y) < 3.5))
      .sort((a, b) => Math.hypot(a.x - run.player.x, a.y - run.player.y) - Math.hypot(b.x - run.player.x, b.y - run.player.y))[0];
    if (threat) {
      // An investigating guard can still be diverted: throw a coin far
      // away from the player and let the guard go and look at that.
      if (threat.state === 'investigate' && run.coins > 0 && run.time - lastCoin > 8) {
        lastCoin = run.time;
        let spot = null;
        let spotD = -1;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const nx = run.player.x + Math.cos(ang) * 3;
          const ny = run.player.y + Math.sin(ang) * 3;
          if (blocksMove(level, nx, ny)) continue;
          if (path.some((n) => Math.hypot(n.x - nx, n.y - ny) < 1.2)) continue;
          // Far from the guard, and far from Wren too: never drop the
          // diversion on the player's own route.
          const d = Math.hypot(nx - threat.x, ny - threat.y) + 0.5 * Math.hypot(nx - run.player.x, ny - run.player.y);
          if (d > spotD) { spotD = d; spot = { x: nx, y: ny }; }
        }
        if (spot) {
          stepRun(run, { mx: 0, my: 0, sneak: false, coin: spot }, STEP);
          steps++;
          continue;
        }
      }
      const safe = nearestHiddenTile(level, run.player.x, run.player.y);
      if (safe && Math.hypot(safe.x - run.player.x, safe.y - run.player.y) < 0.2) {
        stepRun(run, { mx: 0, my: 0, sneak: true, coin: null }, STEP);
      } else if (safe) {
        const dx = safe.x - run.player.x;
        const dy = safe.y - run.player.y;
        const d = Math.hypot(dx, dy);
        stepRun(run, { mx: dx / d, my: dy / d, sneak: false, coin: null }, STEP);
      } else {
        // Nowhere hidden nearby: run from the nearest hunter.
        let best = null;
        let bestD = -1;
        const hunters = level.guards.filter((g) => g.state === 'chase' || g.state === 'investigate');
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const nx = run.player.x + Math.cos(ang) * 0.6;
          const ny = run.player.y + Math.sin(ang) * 0.6;
          if (blocksMove(level, nx, ny)) continue;
          const dd = Math.min(...hunters.map((g) => Math.hypot(nx - g.x, ny - g.y)));
          if (dd > bestD) { bestD = dd; best = { mx: Math.cos(ang), my: Math.sin(ang) }; }
        }
        if (!best) best = { mx: 0, my: 0 };
        stepRun(run, { mx: best.mx, my: best.my, sneak: false, coin: null }, STEP);
      }
      steps++;
      path = findPath(level, run.player.x, run.player.y, tx, ty);
      if (!path) return false;
      node = 1;
      continue;
    }
    const target = path[Math.min(node, path.length - 1)];
    // Patience: if the next step is inside a lantern cone right now, hold
    // still and sneak until the patrol moves on (or 5 seconds pass).
    const watched = level.guards.some((g) => guardSeesPlayer(level, g, target.x, target.y));
    const watchedHere = level.guards.some((g) => guardSeesPlayer(level, g, run.player.x, run.player.y));
    if (watched && !watchedHere && waitTime < 5) {
      waitTime += STEP;
      stepRun(run, { mx: 0, my: 0, sneak: true, coin: null }, STEP);
      steps++;
      continue;
    }
    waitTime = 0;
    const dx = target.x - run.player.x;
    const dy = target.y - run.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.18) {
      node++;
      if (node >= path.length) return true;
      continue;
    }
    if (d > lastDist + 0.01) stuck++;
    else stuck = 0;
    lastDist = d;
    if (stuck > 120) {
      path = findPath(level, run.player.x, run.player.y, tx, ty);
      if (!path) return false;
      node = 1;
      stuck = 0;
    }
    // Sneak everywhere: walking is loud, and a guard that hears the steps
    // turns and looks straight at you. Slow is safe.
    stepRun(run, { mx: dx / d, my: dy / d, sneak: true, coin: null }, STEP);
    steps++;
  }
  return false;
}

function pilotNight(run) {
  const level = run.level;
  const stops = [];
  if (level.key) stops.push(['key', level.key.x, level.key.y]);
  stops.push(['door', level.door.x - 0.5, level.door.y + 0.5]);
  for (const item of level.loot) stops.push(['loot', item.x, item.y]);
  stops.push(['exit', level.exit.x, level.exit.y]);
  for (const [kind, x, y] of stops) {
    const ok = pilotTo(run, x, y);
    if (!ok) return `pilot failed at ${kind} (${x}, ${y}), state ${run.state}, player (${run.player.x.toFixed(1)}, ${run.player.y.toFixed(1)})`;
    // The door stop only counts once the door has actually opened.
    if (kind === 'door' && !level.door.open) return 'pilot reached the door but it did not open';
  }
  return run.state === 'nightclear' ? null : `pilot finished the route but the night did not clear (state ${run.state})`;
}

// 1. All three nights completable by the scripted pilot.
{
  const run = createRun();
  let err = null;
  for (let n = 0; n < 3; n++) {
    err = pilotNight(run);
    if (err) break;
    check(`night ${n + 1} completable (score ${run.score}, loot ${run.lootTaken})`, true);
    if (n < 2) advanceNight(run);
  }
  check('all three nights completable by pilot', err === null, err ?? '');
  if (err === null) advanceNight(run); // past the final clear: the run is won
  check('run won after night three', run.won === true && run.state === 'runover');
}

// 2. The exit is unreachable while the vault door is shut (nights 2-3).
for (let n = 1; n < 3; n++) {
  const level = loadNight(n);
  check(`night ${n + 1} exit unreachable with door shut`,
    !canReach(level, level.start.x, level.start.y, level.exit.x, level.exit.y));
  level.door.open = true;
  check(`night ${n + 1} exit reachable once the door opens`,
    canReach(level, level.start.x, level.start.y, level.exit.x, level.exit.y));
  level.door.open = false;
  check(`night ${n + 1} key reachable with door shut`,
    canReach(level, level.start.x, level.start.y, level.key.x, level.key.y));
}

// 3. Standing in a lantern beam drives detection to a chase.
{
  const run = createRun();
  const g = run.level.guards[0];
  g.x = 10.5; g.y = 3.5; g.facing = Math.PI / 2;
  g.loop = [{ x: 10.5, y: 3.5 }]; g.leg = 0;
  run.player.x = 10.5; run.player.y = 5.5;
  for (let i = 0; i < 3 / STEP; i++) {
    stepRun(run, { mx: 0, my: 0, sneak: false, coin: null }, STEP);
    if (g.state === 'chase' || run.state === 'caught') break;
  }
  check('detection rises to a chase in the beam', g.state === 'chase' || run.state === 'caught',
    `alert ${g.alert.toFixed(2)} state ${g.state} run ${run.state}`);
}

// 4. Shadow plus sneak cuts alert growth by more than half.
{
  function alertAfter(px, py, sneak, seconds) {
    const run = createRun();
    const g = run.level.guards[0];
    g.x = 9.5; g.y = 9.5; g.facing = 2.034;
    g.loop = [{ x: 9.5, y: 9.5 }]; g.leg = 0;
    run.player.x = px; run.player.y = py;
    for (let i = 0; i < seconds / STEP; i++) {
      stepRun(run, { mx: 0, my: 0, sneak, coin: null }, STEP);
    }
    return g.alert;
  }
  const open = alertAfter(7.5, 11.5, false, 2);
  const hidden = alertAfter(8.5, 11.5, true, 2);
  check('shadow + sneak cuts alert growth by more than half', hidden < open * 0.5,
    `open ${open.toFixed(3)} vs shadow+sneak ${hidden.toFixed(3)}`);
}

// 5. A thrown coin pulls a guard into investigate.
{
  const run = createRun();
  const g = run.level.guards[0];
  g.x = 10.5; g.y = 3.5; g.facing = Math.PI / 2;
  run.player.x = 1.5; run.player.y = 1.5;
  stepRun(run, { mx: 0, my: 0, sneak: false, coin: { x: 10.5, y: 6.5 } }, STEP);
  for (let i = 0; i < 1.2 / STEP; i++) stepRun(run, { mx: 0, my: 0, sneak: false, coin: null }, STEP);
  check('coin pulls the guard to investigate', g.state === 'investigate' && g.investigate
    && Math.hypot(g.investigate.x - 10.5, g.investigate.y - 6.5) < 0.5,
    `state ${g.state} target ${JSON.stringify(g.investigate)}`);
}

// 6. A long fuzz run through the game shell with no exceptions.
{
  const rng = makeRng(987654);
  let run = createRun();
  let throws = 0;
  for (let i = 0; i < 14400; i++) {
    const input = {
      mx: rng() * 2 - 1,
      my: rng() * 2 - 1,
      sneak: rng() < 0.4,
      coin: rng() < 0.01 ? { x: 1 + rng() * 18, y: 1 + rng() * 11 } : null,
    };
    if (input.coin) throws++;
    stepRun(run, input, STEP);
    if (run.state === 'caught') retryNight(run);
    else if (run.state === 'nightclear') advanceNight(run);
    else if (run.state === 'runover') run = createRun();
  }
  check(`fuzz: 14400 steps, ${throws} coin throws, no exceptions`, true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
