// Démarre un vrai PostgreSQL 16 local (binaires du paquet embedded-postgres), lance les tests, puis l'arrête.
// Sert de preuve locale tant que la CI n'est pas branchée. En CI, on utilise le service postgres:16.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg16-'));
const port = 54329;
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'data'),
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});

let code = 1;
try {
  await pg.initialise();
  await pg.start();
  code = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['schema.test.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: `postgres://postgres:postgres@localhost:${port}/postgres` },
    });
    child.on('exit', (c) => resolve(c ?? 1));
  });
} finally {
  await pg.stop().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
