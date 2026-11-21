// Render the game's four screenshot scenes headlessly: run each scene
// through the game's own simulation and drawing code on the software
// canvas, and write the PNGs into screenshots/.
//   node tools/render-shots.mjs
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageShot } from '../game/src/shots.js';
import { SoftwareCanvas } from './software-canvas.mjs';
import { encodePng } from './png.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
mkdirSync(join(root, 'screenshots'), { recursive: true });

for (const shot of shots) {
  const name = shot.query.replace('?shot=', '');
  const canvas = new SoftwareCanvas(1280, 800);
  const staged = stageShot(canvas, name);
  const png = encodePng(1280, 800, canvas.pixels);
  const out = join(root, 'screenshots', shot.name);
  writeFileSync(out, png);
  console.log(`${shot.name}: ${name} scene (${staged.scene}), ${png.length} bytes`);
}
