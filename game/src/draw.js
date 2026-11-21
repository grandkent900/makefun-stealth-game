// All drawing, from four shapes only: rectangles, polygons, circles and
// lines. The canvas passed in can be a real browser canvas or the software
// canvas the screenshot tool provides; both speak the same small API.
import { TILE, VIEW_W, VIEW_H, FLOOR_X, FLOOR_Y, HUD_H, PALETTE, NIGHT_NAMES, rankFor } from './config.js';
import { conePolygon } from './sight.js';
import { drawText, drawTextCentered, textWidth } from './font.js';

const px = (x) => FLOOR_X + x * TILE;
const py = (y) => FLOOR_Y + y * TILE;

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, x, y, r, w) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = w;
  ctx.stroke();
}

function diamond(ctx, cx, cy, r) {
  poly(ctx, [
    { x: cx, y: cy - r },
    { x: cx + r * 0.7, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r * 0.7, y: cy },
  ]);
}

export function drawWorld(ctx, run) {
  const level = run.level;
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Floor tiles, checkerboarded so the grid reads at a glance.
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const t = level.grid[y][x];
      if (t === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
      ctx.fillRect(px(x), py(y), TILE, TILE);
      if (t === 's') {
        ctx.fillStyle = PALETTE.shadow;
        ctx.fillRect(px(x) + 3, py(y) + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = PALETTE.shadowEdge;
        ctx.fillRect(px(x) + 3, py(y) + 3, TILE - 6, 3);
        ctx.fillRect(px(x) + 3, py(y) + 3, 3, TILE - 6);
      }
      if (t === 'E') {
        ctx.fillStyle = PALETTE.exitGlow;
        ctx.fillRect(px(x) + 6, py(y) + 6, TILE - 12, TILE - 12);
        ctx.fillStyle = PALETTE.exit;
        ctx.fillRect(px(x) + 14, py(y) + 10, TILE - 28, 6);
        ctx.fillRect(px(x) + 20, py(y) + 16, 8, TILE - 26);
      }
    }
  }

  // Lantern cones first, so the guards and the player stand on top of them.
  for (const g of level.guards) {
    const cone = conePolygon(level, g.x, g.y, g.facing).map((p) => ({ x: px(p.x), y: py(p.y) }));
    ctx.fillStyle = g.alert > 0.6 ? PALETTE.coneHot : PALETTE.cone;
    poly(ctx, cone);
  }

  // Walls and display cases.
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const t = level.grid[y][x];
      if (t === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px(x), py(y), TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(px(x), py(y), TILE, 6);
      } else if (t === 'D') {
        ctx.fillStyle = PALETTE.display;
        ctx.fillRect(px(x) + 4, py(y) + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = PALETTE.displayGlass;
        ctx.fillRect(px(x) + 9, py(y) + 9, TILE - 18, TILE - 18);
        ctx.fillStyle = PALETTE.gem;
        ctx.fillRect(px(x) + 19, py(y) + 19, 10, 10);
      } else if (t === 'V') {
        ctx.fillStyle = level.door.open ? PALETTE.door : PALETTE.doorShut;
        ctx.fillRect(px(x) + 4, py(y), TILE - 8, TILE);
        ctx.fillStyle = PALETTE.door;
        ctx.fillRect(px(x) + TILE / 2 - 3, py(y) + 8, 6, TILE - 16);
      }
    }
  }

  // Loot, the brass key and the rope's knot.
  for (const item of level.loot) {
    if (item.taken) continue;
    const cx = px(item.x);
    const cy = py(item.y);
    if (item.kind === 'gem') {
      ctx.fillStyle = PALETTE.gem;
      diamond(ctx, cx, cy, 13);
      ctx.fillStyle = '#dff8ff';
      diamond(ctx, cx - 3, cy - 3, 5);
    } else {
      ctx.fillStyle = PALETTE.artifact;
      disc(ctx, cx, cy, 12);
      ctx.fillStyle = '#fff0c9';
      diamond(ctx, cx, cy, 6);
    }
  }
  if (level.key && !level.key.taken) {
    const cx = px(level.key.x);
    const cy = py(level.key.y);
    ctx.fillStyle = PALETTE.key;
    disc(ctx, cx - 6, cy, 7);
    ctx.fillStyle = PALETTE.bg;
    disc(ctx, cx - 6, cy, 3);
    ctx.fillStyle = PALETTE.key;
    ctx.fillRect(cx, cy - 3, 14, 6);
    ctx.fillRect(cx + 10, cy + 1, 4, 6);
    ctx.fillRect(cx + 10, cy - 7, 4, 6);
  }

  // A thrown coin in flight, and the ring where one landed.
  if (run.coinFlight) {
    const f = run.coinFlight;
    const t = f.t;
    const cx = px(f.from.x + (f.to.x - f.from.x) * t);
    const cy = py(f.from.y + (f.to.y - f.from.y) * t) - Math.sin(t * Math.PI) * 26;
    ctx.fillStyle = PALETTE.coin;
    disc(ctx, cx, cy, 7);
  }
  if (run.coinRing) {
    const pulse = 1 + 0.25 * Math.sin(run.time * 14);
    ctx.strokeStyle = PALETTE.coin;
    ring(ctx, px(run.coinRing.x), py(run.coinRing.y), 16 * pulse, 3);
  }

  // The wardens: navy coat, brass lantern, and a facing tick.
  for (const g of level.guards) {
    const cx = px(g.x);
    const cy = py(g.y);
    ctx.fillStyle = PALETTE.guardCoat;
    disc(ctx, cx, cy, 15);
    ctx.fillStyle = PALETTE.guard;
    disc(ctx, cx, cy, 10);
    ctx.fillStyle = '#fff3c4';
    disc(ctx, cx + Math.cos(g.facing) * 12, cy + Math.sin(g.facing) * 12, 4);
    ctx.strokeStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(g.facing) * 20, cy + Math.sin(g.facing) * 20);
    ctx.lineWidth = 3;
    ctx.stroke();
    // The detection meter floats above a guard that has noticed something.
    if (g.alert > 0.05) {
      ctx.fillStyle = '#1a1026';
      ctx.fillRect(cx - 16, cy - 30, 32, 6);
      ctx.fillStyle = g.alert > 0.6 ? PALETTE.alarm : PALETTE.door;
      ctx.fillRect(cx - 15, cy - 29, 30 * g.alert, 4);
    }
    if (g.state === 'chase') {
      ctx.fillStyle = PALETTE.alarm;
      drawText(ctx, '!', cx - 4, cy - 52, 3);
    } else if (g.state === 'suspicious') {
      ctx.fillStyle = PALETTE.door;
      drawText(ctx, '?', cx - 4, cy - 52, 3);
    }
  }

  // Wren: a pale hood and a dark cloak, pointing the way she moves.
  const pcx = px(run.player.x);
  const pcy = py(run.player.y);
  const a = run.player.face;
  ctx.fillStyle = PALETTE.playerCloak;
  poly(ctx, [
    { x: pcx + Math.cos(a + 2.5) * 13, y: pcy + Math.sin(a + 2.5) * 13 },
    { x: pcx + Math.cos(a - 2.5) * 13, y: pcy + Math.sin(a - 2.5) * 13 },
    { x: pcx - Math.cos(a) * 10, y: pcy - Math.sin(a) * 10 },
  ]);
  ctx.fillStyle = PALETTE.player;
  disc(ctx, pcx, pcy, 11);
  ctx.fillStyle = PALETTE.playerCloak;
  disc(ctx, pcx + Math.cos(a) * 4, pcy + Math.sin(a) * 4, 5);

  drawHud(ctx, run);
}

export function drawHud(ctx, run) {
  const level = run.level;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, HUD_H - 3, VIEW_W, 3);

  ctx.fillStyle = PALETTE.hud;
  drawText(ctx, NIGHT_NAMES[run.night], 24, 18, 3);
  drawText(ctx, `SCORE ${run.score}`, 24, 52, 3);
  drawText(ctx, `LOOT ${run.nightLoot}/${level.loot.length}`, 330, 52, 3);
  drawText(ctx, `COINS ${run.coins}`, 560, 52, 3);
  drawText(ctx, `KEY ${run.hasKey ? 'YES' : 'NO'}`, 760, 52, 3);
  drawText(ctx, `TIME ${Math.floor(run.nightTime)}s`, 950, 52, 3);

  // Nerve: three small hearts (two triangles and a circle each, kept simple
  // as a diamond) in red for the lives left, dim for the ones lost.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < run.nerve ? PALETTE.alarm : '#3a2f4e';
    diamond(ctx, 1150 + i * 34, 30, 11);
  }
  ctx.fillStyle = PALETTE.hudDim;
  drawText(ctx, 'NERVE', 1100, 52, 2);

  // Detection: the highest alert of any guard, green to red. It lives on
  // the top row, right of the night name, clear of every other label.
  let worst = 0;
  for (const g of level.guards) worst = Math.max(worst, g.alert);
  ctx.fillStyle = PALETTE.hudDim;
  drawText(ctx, 'SEEN', 600, 18, 2);
  ctx.fillStyle = '#1a1026';
  ctx.fillRect(660, 16, 300, 14);
  ctx.fillStyle = worst > 0.6 ? PALETTE.alarm : worst > 0.35 ? PALETTE.door : PALETTE.calm;
  ctx.fillRect(661, 17, 298 * worst, 12);
  if (worst > 0.6) {
    ctx.fillStyle = PALETTE.alarm;
    drawText(ctx, 'SPOTTED', 980, 16, 2);
  }

  if (run.messageTimer > 0 && run.message) {
    ctx.fillStyle = PALETTE.hud;
    drawTextCentered(ctx, run.message, VIEW_W / 2, VIEW_H - 40, 3);
  }
}

function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(8, 5, 18, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, title, lines, accent) {
  veil(ctx, 0.72);
  const w = 760;
  const h = 150 + lines.length * 34;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillStyle = accent;
  drawTextCentered(ctx, title, VIEW_W / 2, y + 34, 4);
  ctx.fillStyle = PALETTE.hud;
  lines.forEach((line, i) => drawTextCentered(ctx, line, VIEW_W / 2, y + 92 + i * 34, 3));
}

export function drawTitle(ctx) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // A museum hall behind the title: floor, cases, one lantern cone.
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(120, 470, VIEW_W - 240, 260);
  ctx.fillStyle = PALETTE.floorDark;
  for (let i = 0; i < 8; i++) ctx.fillRect(120 + i * 130, 470, 2, 260);
  ctx.fillStyle = PALETTE.display;
  ctx.fillRect(220, 560, 90, 90);
  ctx.fillRect(970, 560, 90, 90);
  ctx.fillStyle = PALETTE.displayGlass;
  ctx.fillRect(232, 572, 66, 66);
  ctx.fillRect(982, 572, 66, 66);
  ctx.fillStyle = PALETTE.cone;
  poly(ctx, [
    { x: 640, y: 470 },
    { x: 500, y: 730 },
    { x: 780, y: 730 },
  ]);
  ctx.fillStyle = PALETTE.guard;
  disc(ctx, 640, 480, 14);
  ctx.fillStyle = PALETTE.player;
  disc(ctx, 420, 690, 11);

  ctx.fillStyle = PALETTE.door;
  drawTextCentered(ctx, 'THE VELVET VAULT', VIEW_W / 2, 150, 7);
  ctx.fillStyle = PALETTE.hud;
  drawTextCentered(ctx, 'A STEALTH GAME IN THREE NIGHTS', VIEW_W / 2, 240, 3);
  ctx.fillStyle = PALETTE.hudDim;
  drawTextCentered(ctx, 'YOU ARE WREN, THIEF OF THE SLEEPING MUSEUM', VIEW_W / 2, 300, 3);
  drawTextCentered(ctx, 'DODGE THE LANTERNS. STEAL EVERYTHING. LEAVE BY THE ROPE.', VIEW_W / 2, 340, 3);
  ctx.fillStyle = PALETTE.hud;
  drawTextCentered(ctx, 'ARROWS OR WASD TO MOVE - SHIFT TO SNEAK', VIEW_W / 2, 420, 3);
  drawTextCentered(ctx, 'CLICK TO THROW A COIN - M TO MUTE', VIEW_W / 2, 452, 2);
  ctx.fillStyle = PALETTE.exit;
  drawTextCentered(ctx, 'PRESS ENTER TO BEGIN NIGHT ONE', VIEW_W / 2, 540, 3);
}

export function drawNightClear(ctx, run) {
  drawWorld(ctx, run);
  const lines = [
    `${NIGHT_NAMES[run.night]} CLEARED`,
    `SCORE ${run.score}`,
    'PRESS ENTER FOR THE NEXT NIGHT',
  ];
  panel(ctx, 'NIGHT CLEAR', lines, PALETTE.exit);
}

export function drawCaught(ctx, run) {
  drawWorld(ctx, run);
  panel(ctx, 'CAUGHT', [`A WARDEN CAUGHT WREN - NERVE LEFT ${run.nerve}`, 'PRESS ENTER TO TRY THE NIGHT AGAIN'], PALETTE.alarm);
}

export function drawRunOver(ctx, run) {
  drawWorld(ctx, run);
  const title = run.won ? 'THE VAULT IS YOURS' : 'THE RUN IS OVER';
  const lines = [
    `FINAL SCORE ${run.score}`,
    `LOOT TAKEN ${run.lootTaken}`,
    rankFor(run.score),
    'PRESS ENTER TO PLAY AGAIN',
  ];
  panel(ctx, title, lines, run.won ? PALETTE.door : PALETTE.alarm);
}

export { textWidth };
