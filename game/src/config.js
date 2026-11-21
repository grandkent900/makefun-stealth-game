// Tuning values and the night palette for The Velvet Vault.
// One place for every number a designer would want to tweak.

export const TILE = 48;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const FLOOR_X = 160;
export const FLOOR_Y = 118;
export const HUD_H = 96;

export const WALK_SPEED = 3.4; // tiles per second, normal stride
export const SNEAK_SPEED = 1.7; // tiles per second, held Shift
export const GUARD_SPEED = 1.5; // patrol tiles per second
export const CHASE_SPEED = 2.6;
export const INVESTIGATE_SPEED = 2.1;

export const CONE_RANGE = 4.6; // tiles a lantern reaches
export const CONE_HALF_ANGLE = 0.62; // radians either side of facing
export const ALERT_RISE = 0.62; // detection per second, point blank, walking, lit floor
export const ALERT_FALL = 0.24; // detection per second while unseen
export const SNEAK_VISIBILITY = 0.45; // multiplier on alert rise while sneaking
export const SHADOW_VISIBILITY = 0.5; // multiplier while standing on a shadow carpet
export const SUSPECT_AT = 0.35; // guard turns and stares
export const HUNT_AT = 0.62; // guard leaves the beat to look
export const CHASE_AT = 1.0; // full alarm, guard runs at the player
export const CALM_AFTER = 5.0; // seconds unseen before a guard gives up and goes home
export const CATCH_DIST = 0.55; // tiles: a chasing guard this close catches Wren
export const NOISE_RADIUS = 3.0; // tiles a walking step carries
export const NOISE_NUDGE = 0.05; // alert added when a guard hears a step nearby

export const GEM_SCORE = 100;
export const ARTIFACT_SCORE = 300;
export const CLEAR_BONUS = 250; // per night, multiplied by the night number
export const GHOST_BONUS = 400; // a night finished without ever being hunted
export const SWEEP_BONUS = 300; // every piece of loot on the night taken
export const SPEED_BONUS_RATE = 5; // points per second under the night's par time
export const COINS_PER_NIGHT = 3;
export const MAX_NERVE = 3;

export const PALETTE = {
  bg: '#0d0a1a',
  floor: '#241d3a',
  floorDark: '#1c1630',
  wall: '#4a3f6e',
  wallTop: '#6b5b9e',
  display: '#3d2f5e',
  displayGlass: '#8f7fd0',
  shadow: '#5b2d8e',
  shadowEdge: '#7a3fb8',
  door: '#c9a227',
  doorShut: '#7a5c14',
  exit: '#39d98a',
  exitGlow: '#1d7a4c',
  gem: '#41d6ff',
  artifact: '#ffb347',
  key: '#ffd94d',
  player: '#f2e6c9',
  playerCloak: '#7a1f3d',
  guard: '#e8b23a',
  guardCoat: '#2c4a6e',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneHot: 'rgba(255, 90, 60, 0.28)',
  coin: '#ffe98a',
  hud: '#efe7d0',
  hudDim: '#9a8fc0',
  alarm: '#ff4d4d',
  calm: '#7ddb8a',
  panel: '#17122b',
  panelEdge: '#4a3f6e',
};

export const NIGHT_NAMES = ['Night One - The Quiet Wing', 'Night Two - The Brass Key', 'Night Three - The Velvet Vault'];
export const NIGHT_PAR = [75, 110, 140]; // seconds under par earns the speed bonus

export function rankFor(score) {
  if (score >= 4200) return 'S — Master of the Dark';
  if (score >= 3200) return 'A — Shadow Artist';
  if (score >= 2200) return 'B — Quiet Professional';
  if (score >= 1300) return 'C — Lucky Amateur';
  if (score >= 600) return 'D — Noisy Beginner';
  return 'E — Caught in the Act';
}
