// The three nights of The Velvet Vault. Each night is a grid of tiles plus a
// patrol list. Tile letters:
//   # wall        D display case (blocks movement and sight, so it is cover)
//   . floor      s shadow carpet (slows how fast a guard spots you)
//   g gem       A artifact   K brass key   V vault door   E rope exit   P Wren
// The rope exit sits in a small vault chamber at the top right, walled in on
// every side; the brass vault door is its only entrance. Guards walk loops
// of waypoints given in tile coordinates.

const NIGHT_ONE = [
  '####################',
  '#P...s....D....#...#',
  '#.##.#####.###.#.E.#',
  '#....#...#...#.#...#',
  '#.D..#...#.D.#.V...#',
  '#....#...#.....#.g.#',
  '#.##...D...##..#...#',
  '#..s....#....#.#...#',
  '#.#####.#.###.######',
  '#.....#.#...#.....g#',
  '#.D...#...D.#.###..#',
  '#..g....s......#...#',
  '####################',
];

const NIGHT_TWO = [
  '####################',
  '#P..s.....D....#...#',
  '#.###.####.###.#.E.#',
  '#...#....#...#.#...#',
  '#.D.#.##.#.D.#.V...#',
  '#...#.#..#.....#.g.#',
  '#.##.#.#.###.##.##.#',
  '#....#.#...#...#.#.#',
  '#.####.#.D.#.#######',
  '#..s...#...#...#...#',
  '#.#####.#####.#.##.#',
  '#..g..K..s..A....g.#',
  '####################',
];

const NIGHT_THREE = [
  '####################',
  '#P.s...D....#..#g..#',
  '#.##.###.##.#.##.E.#',
  '#....#...#..#.#..#.#',
  '#.D..#.D.#..#..V...#',
  '#....#...#..#.#.g..#',
  '#.####.###.##.##.#.#',
  '#..s.....#....#.##.#',
  '#.###.##.#.D..######',
  '#.....#..#....#....#',
  '#.D.###.##.####.##.#',
  '#.g...K.s..A....g..#',
  '####################',
];

const PATROLS = [
  // Night one: two wardens on long beats. No beat enters the vault
  // chamber (columns 16-18, rows 1-7): it is the player's prize, not a
  // patrol route, and on later nights its door is shut.
  [
    { start: [10, 3], loop: [[10, 3], [12, 3], [12, 7], [10, 7]] },
    { start: [3, 7], loop: [[3, 7], [3, 4], [10, 4], [10, 7]] },
  ],
  // Night two: three wardens, one watching the vault door from outside.
  [
    { start: [6, 1], loop: [[6, 1], [12, 1], [12, 5], [8, 5]] },
    { start: [3, 9], loop: [[3, 9], [3, 5], [10, 5], [10, 9]] },
    { start: [14, 5], loop: [[14, 5], [14, 3], [10, 3], [10, 5]] },
  ],
  // Night three: four wardens, tight beats around the loot.
  [
    { start: [8, 2], loop: [[8, 2], [13, 2], [13, 5], [8, 5]] },
    { start: [5, 8], loop: [[5, 8], [4, 3], [10, 3], [10, 8]] },
    { start: [13, 9], loop: [[13, 9], [13, 5], [11, 5], [12, 9]] },
    { start: [7, 11], loop: [[7, 11], [13, 11], [13, 9], [7, 9]] },
  ],
];

export const NIGHT_COUNT = 3;

export function gridSize() {
  return { cols: 20, rows: 13 };
}

// Parse one night's map into a structured level. Entity letters are lifted
// out of the grid and replaced with the floor beneath them.
export function loadNight(index) {
  const maps = [NIGHT_ONE, NIGHT_TWO, NIGHT_THREE];
  const rows = maps[index];
  const grid = [];
  const loot = [];
  let start = { x: 1.5, y: 1.5 };
  let key = null;
  let door = null;
  let exit = null;
  for (let y = 0; y < rows.length; y++) {
    const line = rows[y];
    const out = [];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === 'P') { start = { x: x + 0.5, y: y + 0.5 }; out.push('.'); }
      else if (ch === 'g') { loot.push({ x: x + 0.5, y: y + 0.5, kind: 'gem', taken: false }); out.push('.'); }
      else if (ch === 'A') { loot.push({ x: x + 0.5, y: y + 0.5, kind: 'artifact', taken: false }); out.push('.'); }
      else if (ch === 'K') { key = { x: x + 0.5, y: y + 0.5, taken: false }; out.push('.'); }
      else if (ch === 'V') { door = { x, y, open: index === 0 }; out.push('V'); }
      else if (ch === 'E') { exit = { x: x + 0.5, y: y + 0.5 }; out.push('E'); }
      else out.push(ch);
    }
    grid.push(out);
  }
  const guards = PATROLS[index].map((p) => ({
    x: p.start[0] + 0.5,
    y: p.start[1] + 0.5,
    loop: p.loop.map(([wx, wy]) => ({ x: wx + 0.5, y: wy + 0.5 })),
    leg: 0,
    facing: 0,
    state: 'patrol',
    alert: 0,
    lastSeen: null,
    investigate: null,
    calmTimer: 0,
    stepPhase: 0,
    seenEver: false,
    huntedEver: false,
  }));
  return { index, grid, cols: 20, rows: 13, start, loot, key, door, exit, guards, hasKey: index > 0 };
}

export function tileAt(level, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= level.cols || cy >= level.rows) return '#';
  return level.grid[cy][cx];
}

export function blocksMove(level, x, y) {
  const t = tileAt(level, x, y);
  if (t === '#' || t === 'D') return true;
  if (t === 'V') return !level.door.open;
  return false;
}

export function blocksSight(level, x, y) {
  const t = tileAt(level, x, y);
  if (t === '#' || t === 'D') return true;
  if (t === 'V') return !level.door.open;
  return false;
}

export function isShadow(level, x, y) {
  return tileAt(level, x, y) === 's';
}

export function isExitTile(level, x, y) {
  return tileAt(level, x, y) === 'E';
}
