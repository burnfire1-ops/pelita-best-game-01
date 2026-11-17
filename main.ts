// PELITA's entry program (Node 22, standard library only). It hands the game in:
// it copies this repository's game/ (the playable static files) and screenshots/
// (the 4 real renders) next to /output, then writes /output/dossier.json with the
// vendored make.fun library, so the judge reads exactly what the scorer reads.
// Nothing is built or transformed; the files go in as they are.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game itself with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const source = join(repoRoot, name);
  if (!existsSync(source)) return;
  cpSync(source, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// The scorer's caps (reference/gate.json): only text_max_bytes changes the dossier's bytes;
// the rest refuse an entry the scorer would refuse (more than 4 screenshots, one over
// 256 KiB, more than 993 files or 48 MiB in game/, or a game path over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
