import { request } from '@playwright/test';
import { API, MEMBER_EMAIL, memberPassword } from './helpers';

/**
 * Échauffement de l'API d'aperçu avant la suite.
 *
 * Le serveur PHP intégré démarre à froid : la toute première connexion peut dépasser le délai de requête du client
 * (15 s), l'application affiche alors « Connexion impossible » et le premier test échoue pour une raison qui tient
 * à l'environnement et non à l'application (constaté : 19 s, puis 2 à 6 s par requête). On passe donc une fois par
 * les routes utilisées par tous les écrans, avec un appareil à part, puis on referme la session.
 * Ne masque rien : le comportement du client à un dépassement de délai reste couvert par F01-E10 (réseau coupé).
 */
export default async function globalSetup() {
  const ctx = await request.newContext({ timeout: 120_000 });
  const device = crypto.randomUUID();
  try {
    await ctx.get(`${API}/health`);
    const login = await ctx.post(`${API}/auth/login`, {
      headers: { 'X-Device-Id': device, Accept: 'application/json' },
      data: { email: MEMBER_EMAIL, password: memberPassword(), platform: 'android' },
    });
    if (!login.ok()) throw new Error(`Échauffement : connexion refusée (${login.status()}). L'aperçu est-il démarré ?`);
    const headers = { Authorization: `Bearer ${(await login.json()).token}`, 'X-Device-Id': device, Accept: 'application/json' };
    for (const route of ['/me', '/discover', '/conversations', '/billing/status']) await ctx.get(`${API}${route}`, { headers });
    await ctx.post(`${API}/auth/logout`, { headers });
  } finally {
    await ctx.dispose();
  }
}
