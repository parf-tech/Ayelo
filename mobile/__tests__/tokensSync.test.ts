import { spawnSync } from 'child_process';
import path from 'path';

// Les fichiers générés (tokens.ts, tokens.css, couleurs de app.json) doivent correspondre à design/tokens.json.
// Échec : relancer `npm run tokens` (depuis mobile/) et commiter le résultat.
describe('jetons générés', () => {
  it('tokens.ts, tokens.css et app.json sont à jour par rapport à design/tokens.json', () => {
    const script = path.resolve(__dirname, '..', '..', 'design', 'build-tokens.mjs');
    const result = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`design/build-tokens.mjs --check a échoué :\n${result.stdout}\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
  });
});
