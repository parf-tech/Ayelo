// Démarre un PostgreSQL 16 local persistant le temps du développement (port 54330) et crée la base app_test.
// Arrêt : Ctrl+C. Utilisé par les tests Pest du backend (phpunit.xml).
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg16dev-'));
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'data'),
  user: 'postgres',
  password: 'postgres',
  port: 54330,
  persistent: false,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});
await pg.initialise();
await pg.start();
await pg.createDatabase('app_test');
console.log('PG16 prêt sur 54330 (base app_test)');
const stop = async () => {
  await pg.stop().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
