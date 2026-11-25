// Scénarios de charge : découverte, liste des conversations, lecture et envoi de messages, dépôt d'image.
// Objectifs de docs/13-TEST-STRATEGY.md : p95 de l'API < 300 ms hors médias ; envoi d'un message p95 < 1 s.
// SCALE multiplie les débits de pointe ; STAGE est la durée de chaque palier.
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE || 'http://web';
const SCALE = Number(__ENV.SCALE || 1);
const STAGE = __ENV.STAGE || '90s';
// Pointe des dépôts d'images (par seconde) ; 0 = aucun dépôt, pour mesurer l'API seule.
const UPLOAD = __ENV.UPLOAD === undefined ? 2 : Number(__ENV.UPLOAD);
// IDLE=1 : un seul utilisateur, une requête à la fois, pour connaître le coût de chaque route sans concurrence.
const IDLE = __ENV.IDLE === '1';
const actors = new SharedArray('acteurs', () => JSON.parse(open('/work/actors.json')));
const photo = open('/work/photo.jpg', 'b');

// Débit croissant (requêtes par `seconds` secondes) : 25 %, 50 %, 100 % de la pointe, puis palier à la pointe.
function ramp(peak, exec, seconds = 1) {
  const top = Math.max(1, Math.round(peak * SCALE * seconds));
  return {
    executor: 'ramping-arrival-rate', exec, startRate: 1, timeUnit: `${seconds}s`, preAllocatedVUs: top * 2 + 5, maxVUs: top * 6 + 20,
    stages: [
      { target: Math.max(1, Math.round(top / 4)), duration: STAGE },
      { target: Math.max(1, Math.round(top / 2)), duration: STAGE },
      { target: top, duration: STAGE },
      { target: top, duration: STAGE },
    ],
  };
}

const scenarios = {
  discover: ramp(30, 'discover'),
  conversations: ramp(30, 'conversations'),
  thread: ramp(30, 'thread'),
  send: ramp(10, 'send'),
};
// Les dépôts sont rares : débit compté par tranche de 10 s, pour pouvoir descendre sous un par seconde.
if (UPLOAD > 0) scenarios.upload = ramp(UPLOAD, 'upload', 10);
const ROUTES = ['discover', 'conversations', 'thread', 'send', 'upload-url', 'upload-complete'];

export const options = {
  scenarios: IDLE ? { idle: { executor: 'per-vu-iterations', exec: 'idle', vus: 1, iterations: 15 } } : scenarios,
  // SMOKE=1 (essai à blanc) : tout doit répondre ; la latence à froid ne compte pas.
  thresholds: __ENV.SMOKE === '1' ? { checks: ['rate==1'] } : IDLE ? Object.fromEntries(ROUTES.map((n) => [`http_req_duration{name:${n}}`, ['max>=0']])) : {
    'http_req_duration{name:discover}': ['p(95)<300'],
    'http_req_duration{name:conversations}': ['p(95)<300'],
    'http_req_duration{name:thread}': ['p(95)<300'],
    'http_req_duration{name:send}': ['p(95)<1000'],
    'http_req_duration{name:upload-url}': ['p(95)<300'],
    // Pas d'objectif écrit pour les médias : seuil large, pour obtenir les statistiques.
    'http_req_duration{name:upload-complete}': ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count<100'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  discardResponseBodies: false,
};

const actor = () => actors[Math.floor(Math.random() * actors.length)];
const headers = (a) => ({ Authorization: `Bearer ${a.token}`, Accept: 'application/json', 'Content-Type': 'application/json' });
const params = (a, name) => ({ headers: headers(a), tags: { name } });
const withConversation = () => {
  for (let i = 0; i < 20; i++) {
    const a = actor();
    if (a.conversations.length > 0) return [a, a.conversations[Math.floor(Math.random() * a.conversations.length)]];
  }
  throw new Error('aucun acteur avec conversation');
};
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.floor(Math.random() * 16);
  return (c === 'x' ? r : (r % 4) + 8).toString(16);
});

export function idle() {
  discover();
  conversations();
  thread();
  send();
  upload();
}

export function discover() {
  const r = http.get(`${BASE}/api/v1/discover?limit=20`, params(actor(), 'discover'));
  check(r, { 'découverte 200': (x) => x.status === 200 });
}

export function conversations() {
  const r = http.get(`${BASE}/api/v1/conversations?limit=50`, params(actor(), 'conversations'));
  check(r, { 'conversations 200': (x) => x.status === 200 });
}

export function thread() {
  const [a, id] = withConversation();
  const r = http.get(`${BASE}/api/v1/conversations/${id}/messages`, params(a, 'thread'));
  check(r, { 'messages 200': (x) => x.status === 200 });
}

export function send() {
  const [a, id] = withConversation();
  const body = JSON.stringify({ client_id: uuid(), type: 'text', body: 'Bonjour, message du banc de charge.' });
  const r = http.post(`${BASE}/api/v1/conversations/${id}/messages`, body, params(a, 'send'));
  check(r, { 'envoi 201': (x) => x.status === 201 });
}

export function upload() {
  const a = actor();
  const asked = http.post(`${BASE}/api/v1/media/upload-url`,
    JSON.stringify({ kind: 'message_image', mime_type: 'image/jpeg', size_bytes: photo.byteLength }), params(a, 'upload-url'));
  if (!check(asked, { 'adresse de dépôt 201': (x) => x.status === 201 })) return;
  const { media_id: mediaId, upload: target } = asked.json();
  const put = http.put(target.url, photo, { headers: target.headers, tags: { name: 'upload-put' } });
  if (!check(put, { 'dépôt 200': (x) => x.status === 200 })) return;
  const done = http.post(`${BASE}/api/v1/media/${mediaId}/complete`, null, params(a, 'upload-complete'));
  if (!check(done, { 'fin de dépôt 200': (x) => x.status === 200 })) {
    console.warn(`fin de dépôt ${done.status} : ${String(done.body).slice(0, 300)}`);
  }
}
