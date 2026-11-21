// The Velvet Vault — hand-in program (Node 22, standard library only).
// It copies this repository's game/ and screenshots/ into the output
// directory and writes dossier.json there with the vendored make.fun
// library, so the grader can judge the entry from /output alone.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('main.ts: game/index.html is missing, so there is no game to hand in');
}

mkdirSync(out, { recursive: true });
// Clear the previous hand-in first: a stale file left in the output from
// an earlier run would otherwise be handed in again and could break the
// grader's byte-identical second run.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(out, name), { recursive: true, force: true });
}
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (from the kit's RULES.txt): only text_max_bytes
// shapes the bytes; the others refuse an entry the scorer would refuse.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
const shotBytes = shotFiles.reduce((n, f) => n + statSync(join(out, 'screenshots', f)).size, 0);
console.log(`handed in ${gameFiles.length} game entries, ${shotFiles.length} screenshots (${shotBytes} bytes), dossier ${dossier.length} bytes -> ${out}`);
