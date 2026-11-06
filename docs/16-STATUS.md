# 16 : État d'avancement réel

Date : 2026-11-06. Ce document dit ce qui **existe et a été vérifié**, ce qui existe sans être vérifié, et ce qui n'existe pas. Il prime sur les statuts optimistes des autres documents.

## Preuves disponibles

| preuve | résultat |
| --- | --- |
| Tests backend (Pest, PostgreSQL 16.15) | **242 tests, 1602 assertions, 0 échec** (exécution du CTO le 2026-11-06, y compris l'administration) |
| Tests du schéma SQL (PostgreSQL 16.15) | 33 tests, 0 échec |
| CI GitHub | `backend` vert (commit `a1a091e`), `schema` vert (commit `20e9427`) |
| Contrôle de secrets (gitleaks, historique complet) | propre ; 4 faux positifs (mots de passe factices dans les tests) exclus par `.gitleaks.toml`, limité à `backend/tests` et `mobile/__tests__` |
| Audit des dépendances PHP | `composer audit` : aucune faille signalée (2026-11-05) |
| Mobile (Jest, typecheck, lint) | 141 tests, typecheck et lint propres ; `expo export --platform android` compile (rapport du sous-agent, non rejoué par le CTO) |

## Backend : fait et testé

| module | contenu | épopée |
| --- | --- | --- |
| Socle | Laravel 12, PostgreSQL, Sanctum à clés uuid, format d'erreur unique, limites de débit par appareil / compte | A1, A2 |
| Authentification | contrôle d'âge avant compte (jeton chiffré lié à l'appareil, refus mémorisé 90 jours), inscription, connexion, déconnexion, vérification d'e-mail, mot de passe oublié, sessions, Google / Apple (vérification JWT RS256 par JWKS), Argon2id | A3 |
| Profils | création / mise à jour, confidentialité, préférences, pays de résidence limité à un changement par semaine, profil public avec politique de visibilité | A6 |
| Médias | URL présignées, relecture de l'objet déposé, file de modération, réordonnancement, suppression | A6 |
| Découverte | filtres, pagination par curseur, swipes, quotas, matchs avec verrou consultatif, annulation Premium | A7 |
| Messagerie | conversations, messages idempotents, lu / remis / saisie, médias approuvés, masquage, ouverture hors match par crédit ou Premium, détection simple de demande d'argent | A9 |
| Temps réel | Reverb, canaux privés `user.{id}` et `conversation.{id}` autorisés par participation | A9 |
| Notifications | préférences, jeton par appareil, envoi FCM isolé derrière une interface | A9 |
| Sécurité | blocage, signalements (quota, priorité, suspension préventive d'un mineur suspecté, seuil de 3 signalements), sanctions, contestation | A11 |
| Compte | suppression avec ré-authentification, page web publique de demande, anonymisation après 30 jours (planifiée), export, consentements, support | A13, A16 |
| Facturation | webhook RevenueCat idempotent, abonnements, crédits, remboursements, statut | B1 |
| Vérification de profil | demande, consentement biométrique, décision, suppression du selfie | B2 |
| Appels (serveur) | sonnerie, réponse, refus, fin, manqué, durée maximale, jetons LiveKit | D (signalisation) |

70 routes sont implémentées (`17-IMPLEMENTED-ROUTES.md`).

## En cours au moment de la rédaction

| lot | responsable | état |
| --- | --- | --- |
| Administration Filament | livrée côté code (242 tests) ; rendu navigateur et 2FA avec une vraie application non vérifiés | voir spec 009 |
| Écrans mobiles de la phase 2 (profil, découverte, messagerie, paramètres, Premium, vérification, interface d'appel) | sous-agent Mobile | en cours, rien de livré |

## Non fait

| élément | raison |
| --- | --- |
| Stories, invitations vidéo, notes vocales, cadeaux, proximité | phases C et E, décidées après lancement |
| Vérification du téléphone par SMS, connexion TikTok | phase B, hors périmètre du lancement tant que le coût des SMS n'est pas validé |
| Modération automatique des images et filtrage de texte au-delà de la détection simple | prestataire non choisi (ADR 005) |
| Transcodage vidéo | sans objet tant que les vidéos de profil ne sont pas ouvertes |
| Redis en production | configuré dans le code (Predis) mais jamais exécuté contre un vrai Redis |
| i18n côté serveur au-delà des e-mails | seuls les e-mails sont traduits (fr, en) ; les messages d'API sont en français |
| Contrat OpenAPI généré | non produit ; `17-IMPLEMENTED-ROUTES.md` liste les routes |

## Non vérifié (écrit mais jamais exécuté)

- **Stockage objet réel (Cloudflare R2)** : le code S3 existe mais seul un faux stockage en mémoire est testé.
- **FCM** : l'envoi réel n'a jamais été exécuté ; seule la désactivation sans configuration est testée.
- **Reverb réel** : les événements sont testés par simulation ; aucune connexion WebSocket réelle n'a été établie.
- **RevenueCat réel** : le format des événements est supposé (ADR 002) ; aucun événement réel reçu.
- **Google / Apple réels** : la vérification est testée avec des clés générées localement, pas avec les vrais JWKS.
- **LiveKit réel** : les jetons sont décodés par les tests ; aucun appel établi.
- **Applications mobiles** : jamais lancées sur appareil ni émulateur.
- **Docker Compose** : non testé (Docker absent du poste de développement).
- **Charge et concurrence réelle** : le verrou de match n'est testé que séquentiellement.

## Ce que l'équipe ne peut pas faire seule (dépend du propriétaire ou d'un tiers)

1. Ouvrir les comptes Apple Developer et Google Play (identité, entité juridique) ; réunir 12 testeurs pour le test fermé Google (14 jours).
2. Faire valider la matrice juridique par marché par un juriste (RGPD / DSA, Loi 25, PIPEDA, CCPA, lois africaines, retrait d'images intimes).
3. Choisir et payer l'hébergement (VPS, R2, LiveKit Cloud) ; fournir les clés (RevenueCat, FCM, Google / Apple, R2).
4. Budgéter la modération humaine (le plus gros poste réel non chiffré).
5. Valider le nom et faire la recherche de marque.
6. Prototype D0 des appels sur appareils réels, puis soumission aux stores.
7. Décisions d'exploitation : politique de confidentialité, CGU, adresse de contact du support, procédure de signalement aux autorités.

## Gates

| gate | état |
| --- | --- |
| G0 cadrage | franchi |
| G1 conception | franchi (3 relectures, CI verte) |
| G2 module | franchi pour les modules backend ci-dessus (tests verts), pas encore pour l'administration ni le mobile |
| G3 sécurité | **non franchi** : revue de sécurité du code faite (9 constats hauts, traités : voir `reviews/code-security-1-suivi.md`) ; seconde revue, `npm audit`, attestation d'appareil et matrice juridique manquent |
| G4 intégration (E2E) | **non franchi** : aucun test de bout en bout mobile / backend |
| G5 pré-production | **non franchi** : aucun déploiement, aucune sauvegarde restaurée |
| G6 stores et appels | **non franchi** |
| G7 lancement | **non franchi** |
