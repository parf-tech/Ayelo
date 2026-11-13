// PostgreSQL 16 embarque, instance SEPAREE pour l'apercu local (docs/runbooks/apercu-local.md).
// Meme principe que tests/schema/pg16-dev.mjs (port 54330, base app_test, utilise par les tests Pest), mais parametre :
//   node scripts/pg16-preview.mjs [--port 54350] [--db app_preview] [--dir <dossier de donnees>]
// Les donnees sont jetables : dossier temporaire supprime a l'arret (Ctrl+C), sauf si --dir est fourni (le script appelant le gere).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const port = Number(arg('port', '54350'));
const database = arg('db', 'app_preview');
const given = arg('dir', null);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Port invalide : ${port}`);
if (!/^[a-z_][a-z0-9_]*$/.test(database)) throw new Error(`Nom de base invalide : ${database}`);

// Le module embedded-postgres est installe dans tests/schema (npm ci y est deja fait pour les tests de schema).
const here = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(here, '..', 'tests', 'schema', 'node_modules', 'embedded-postgres', 'dist', 'index.js');
if (!fs.existsSync(modulePath)) throw new Error('embedded-postgres introuvable : lancer `npm ci` dans tests/schema.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(modulePath).href);

const root = given ?? fs.mkdtempSync(path.join(os.tmpdir(), 'pg16preview-'));
const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, 'data'),
  user: 'postgres',
  password: 'postgres', // jetable : instance locale, liee a 127.0.0.1, donnees d'apercu uniquement
  port,
  persistent: false,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});
await pg.initialise();
await pg.start();
await pg.createDatabase(database);
console.log(`PG16 pret sur ${port} (base ${database})`);

const stop = async () => {
  await pg.stop().catch(() => {});
  if (!given) fs.rmSync(root, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
