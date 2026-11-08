// Tests du schéma docs/schema/001_initial.sql sur un vrai PostgreSQL.
// Usage : DATABASE_URL=postgres://user:pass@host:5432/postgres node schema.test.mjs
// La base cible sert de point d'entrée : le test crée puis supprime sa propre base temporaire.
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = process.env.SCHEMA_SQL || path.resolve(here, '../../docs/schema/001_initial.sql');
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) {
  console.error('DATABASE_URL manquant');
  process.exit(2);
}

const dbName = 'schema_test_' + Date.now();
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`create database ${dbName}`);
const url = new URL(adminUrl);
url.pathname = '/' + dbName;
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

const results = [];
const q = (text, params) => client.query(text, params);
async function expectOk(name, fn) {
  try { await fn(); results.push([name, true, 'ok']); }
  catch (e) { results.push([name, false, e.message.split('\n')[0]]); }
}
async function expectFail(name, fn) {
  try { await fn(); results.push([name, false, 'aucune erreur levée']); }
  catch (e) { results.push([name, true, e.message.split('\n')[0]]); }
}

let exitCode = 0;
try {
  const version = (await q('select version() as v')).rows[0].v;
  console.log('moteur:', version);
  await client.query(fs.readFileSync(sqlPath, 'utf8'));
  const n = (await q("select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows[0].n;
  console.log('tables créées:', n);
  await expectOk('37 tables créées', async () => { if (n !== 37) throw new Error('attendu 37, obtenu ' + n); });

  const mkUser = async (email) =>
    (await q("insert into users(email,birthdate) values ($1,'1990-01-01') returning id", [email])).rows[0].id;
  const a = await mkUser('a@example.com');
  const b = await mkUser('b@example.com');
  const [lo, hi] = a < b ? [a, b] : [b, a];

  await expectFail('mineur refusé à la création du compte', () =>
    q("insert into users(email,birthdate) values ('kid@example.com','2020-01-01')"));
  await expectOk('profil accepté', () =>
    q("insert into profiles(user_id,display_name,gender,origin_country,residence_country,intent) values ($1,'Alice','woman','CM','FR','flirt')", [a]));
  await expectFail('date de naissance non modifiable', () =>
    q("update users set birthdate='1991-01-01' where id=$1", [a]));
  await expectOk('match canonique', () => q('insert into matches(user_a,user_b) values ($1,$2)', [lo, hi]));
  await expectFail('match ordre inverse refusé', () => q('insert into matches(user_a,user_b) values ($1,$2)', [hi, lo]));
  await expectFail('match doublon refusé', () => q('insert into matches(user_a,user_b) values ($1,$2)', [lo, hi]));

  const conv = (await q("insert into conversations(user_a,user_b,initiated_by,unlocked_by) values ($1,$2,$1,'match') returning id", [lo, hi])).rows[0].id;
  const cid = '11111111-1111-1111-1111-111111111111';
  await expectOk('message texte', () =>
    q("insert into messages(conversation_id,sender_id,client_id,type,body) values ($1,$2,$3,'text','salut')", [conv, lo, cid]));
  await expectFail('message renvoyé (doublon) refusé', () =>
    q("insert into messages(conversation_id,sender_id,client_id,type,body) values ($1,$2,$3,'text','salut')", [conv, lo, cid]));
  await expectOk('même client_id pour l’autre participant accepté', () =>
    q("insert into messages(conversation_id,sender_id,client_id,type,body) values ($1,$2,$3,'text','coucou')", [conv, hi, cid]));
  await expectFail('texte vide refusé', () =>
    q("insert into messages(conversation_id,sender_id,client_id,type,body) values ($1,$2,gen_random_uuid(),'text',null)", [conv, lo]));

  await expectOk('crédit +1', () =>
    q("insert into credit_ledger(user_id,credit_type,delta,reason,idempotency_key) values ($1,'conversation',1,'purchase','k1')", [a]));
  await expectFail('même clé, même utilisateur refusée', () =>
    q("insert into credit_ledger(user_id,credit_type,delta,reason,idempotency_key) values ($1,'conversation',1,'purchase','k1')", [a]));
  await expectOk('même clé, autre utilisateur acceptée', () =>
    q("insert into credit_ledger(user_id,credit_type,delta,reason,idempotency_key) values ($1,'conversation',1,'purchase','k1')", [b]));
  await expectOk('webhook inséré', () => q("insert into webhook_events(id,payload) values ('evt1','{}')"));
  await expectFail('webhook rejoué refusé', () => q("insert into webhook_events(id,payload) values ('evt1','{}')"));

  const staff = (await q("insert into staff_users(email,password,role) values ('m@example.com','x','moderator') returning id")).rows[0].id;
  await expectOk('audit : insertion', () => q("insert into audit_logs(actor_staff_id,action) values ($1,'ban')", [staff]));
  await expectFail('audit : update refusé', () => q("update audit_logs set action='x'"));
  await expectFail('audit : delete refusé', () => q('delete from audit_logs'));
  await expectFail('audit : truncate refusé', () => q('truncate audit_logs'));

  await expectOk('signalement', () => q("insert into reports(reporter_id,reported_id,reason) values ($1,$2,'money_request')", [a, b]));
  await expectFail('suppression d’un utilisateur signalé refusée (restrict)', () => q('delete from users where id=$1', [b]));

  await expectOk('Premium offert (promotional)', () =>
    q("insert into subscriptions(user_id,store,product_id,status,period_start,period_end,granted_by) values ($1,'promotional','premium','active',now(),now()+interval '30 days',$2)", [a, staff]));
  await expectFail('abonnement de store sans transaction refusé', () =>
    q("insert into subscriptions(user_id,store,product_id,status,period_start,period_end) values ($1,'apple','premium','active',now(),now()+interval '30 days')", [a]));

  await expectOk('photo position 0', () =>
    q("insert into media(user_id,kind,storage_key,mime_type,position) values ($1,'profile_photo','k/a0','image/jpeg',0)", [a]));
  await expectFail('photo même position refusée', () =>
    q("insert into media(user_id,kind,storage_key,mime_type,position) values ($1,'profile_photo','k/a0b','image/jpeg',0)", [a]));

  const mimg = (await q("insert into media(user_id,kind,storage_key,mime_type,position) values ($1,'message_image','k/m1','image/jpeg',0) returning id", [a])).rows[0].id;
  await expectOk('message image', () =>
    q("insert into messages(conversation_id,sender_id,client_id,type,media_id) values ($1,$2,gen_random_uuid(),'image',$3)", [conv, lo, mimg]));
  await expectOk('suppression d’un média lié à un message (set null)', () => q('delete from media where id=$1', [mimg]));
  await expectOk('photo position 1', () =>
    q("insert into media(user_id,kind,storage_key,mime_type,position) values ($1,'profile_photo','k/a1','image/jpeg',1)", [a]));
  await expectFail('échange direct de positions refusé (unique)', () =>
    q("update media set position = 1 - position where user_id=$1 and kind='profile_photo'", [a]));
  await expectOk('réordonnancement en deux mises à jour', async () => {
    await q("update media set position = position + 6 where user_id=$1 and kind='profile_photo'", [a]);
    await q("update media set position = case position when 6 then 1 when 7 then 0 end where user_id=$1 and kind='profile_photo'", [a]);
  });
  await expectOk('appel occupé (busy)', () =>
    q("insert into call_sessions(conversation_id,caller_id,callee_id,kind,status,livekit_room) values ($1,$2,$3,'video','busy','room1')", [conv, lo, hi]));

  // Concurrence : deux insertions simultanées du même match -> une seule ligne
  const c = (await q("insert into users(email,birthdate) values ('c@example.com','1990-01-01'),('d@example.com','1990-01-01') returning id")).rows.map(r => r.id).sort();
  const c1 = new pg.Client({ connectionString: url.toString() });
  const c2 = new pg.Client({ connectionString: url.toString() });
  await c1.connect(); await c2.connect();
  const ins = (cl) => cl.query('insert into matches(user_a,user_b) values ($1,$2) on conflict do nothing', [c[0], c[1]]);
  await Promise.all([ins(c1), ins(c2)]);
  await c1.end(); await c2.end();
  await expectOk('deux insertions simultanées du même match : une seule ligne', async () => {
    const cnt = (await q('select count(*)::int as n from matches where user_a=$1 and user_b=$2', [c[0], c[1]])).rows[0].n;
    if (cnt !== 1) throw new Error('lignes: ' + cnt);
  });
} catch (e) {
  console.error('ERREUR FATALE:', e.message);
  exitCode = 1;
} finally {
  await client.end();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
}

let failed = 0;
for (const [name, ok, msg] of results) {
  if (!ok) failed++;
  console.log((ok ? 'v ' : 'x ') + name + ' -> ' + msg);
}
console.log(`tests: ${results.length}, échecs: ${failed}`);
process.exit(exitCode || (failed ? 1 : 0));
