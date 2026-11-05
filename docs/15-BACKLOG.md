# 15 : Backlog

Épopées par phase, avec dépendances, propriétaire (un agent par périmètre), et preuve de fin exigée. Taille : S ≤ 2 jours, M ≤ 1 semaine, L ≤ 3 semaines. Tailles estimées, non engageantes.

## Équipe et périmètres

| # | agent | périmètre | interdit de toucher |
| --- | --- | --- | --- |
| 1 | CTO / Orchestrator | arbitrages, gates, synthèse | code d'un autre agent |
| 2 | REA Analyst | `docs/02`, `docs/04`, `replica/` | code |
| 3 | UI/UX Architect | `docs/05`, `06`, `07`, `mobile/src/ui`, `mobile/src/theme` | backend |
| 4 | Software Architect | `docs/08`, `09`, `10`, `docs/adr/`, `backend/openapi.yaml` | code métier |
| 5 | Backend Engineer | `backend/app`, `database`, `routes`, `Filament` | `mobile/`, `infra/` |
| 6 | Mobile Engineer | `mobile/app`, `mobile/src/features` | `backend/`, `mobile/src/ui` |
| 7 | Realtime Engineer | `backend/app/Realtime`, Reverb, LiveKit, appels côté mobile (`mobile/src/features/calls`) | |
| 8 | Security Engineer | `docs/11`, politiques, limites de débit, revues de sécurité | |
| 9 | QA Engineer | `backend/tests`, `mobile/__tests__`, `.maestro/`, `docs/13` | code de production |
| 10 | Independent Reviewer | rapports `docs/reviews/` | tout le reste (lecture seule) |
| 11 | DevOps Engineer | `infra/`, `.github/`, `docs/14` | |
| 12 | Release Manager | fiches stores, `docs/release/`, gate G6 | |

Règle de concurrence : une branche par épopée, un seul propriétaire par fichier ; toute demande de modification d'un fichier d'un autre agent passe par une demande au propriétaire.

## Phase 0 : cadrage (en cours)

| ID | tâche | propriétaire | preuve de fin | statut |
| --- | --- | --- | --- | --- |
| P0-1 | Recon publique | REA | `replica/recon.md`, `features.csv` | fait |
| P0-2 | ADR 001 stack | Architecte | `docs/adr/001-…` | **acceptée** le 2026-11-05 |
| P0-3 | Documents 00 à 15 | divers | fichiers présents | rédigés, corrigés après relecture |
| P0-4 | Lire Google Play, App Store FR, accueil du site | REA | notes dans `02-REA-REPORT.md` | **fait** sauf Google Play (page tronquée) |
| P0-5 | Relecture indépendante des documents | Reviewer | `docs/reviews/phase0.md` | **fait** (G1 non franchi) |
| P0-5b | Passes de relecture suivantes | Reviewer | `docs/reviews/phase0-bis.md`, `phase0-ter.md` | **fait** |
| P0-6 | Validation propriétaire (gates G0, G1) | CTO | décision écrite | G0 fait ; **G1 franchi** (voir `reviews/phase0-bis-suivi.md`) |
| P0-7 | Choix du nom, marque, domaine | propriétaire | décision écrite | nom de travail « Ayelo » proposé, recherche de marque à faire |
| P0-8 | Tableau de coûts mensuel sourcé (URL + date de lecture par poste) | DevOps | `docs/14` section coûts | **produit** (`14b-COSTS.md`), à valider par le propriétaire ; reste : domaine, modération, Google Play, SMS Afrique |
| P0-9 | Matrice juridique par marché, validée par un juriste | Security | `docs/11` annexe | à faire |
| P0-10 | Ouvrir comptes Apple Developer et Google Play ; décider l'entité juridique avant | propriétaire | comptes ouverts | à faire (délais longs) |

## Phase A : socle

| ID | épopée | dépend de | propriétaire | taille | écrans / FR | preuve |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Mise en place des dépôts, CI, Docker Compose local | G0 | DevOps | M | | CI verte, `docker compose up` OK |
| A2 | Backend socle : Laravel, PostgreSQL, Redis, Sanctum, politiques | A1 | Backend | M | FR-A | tests Pest verts |
| A3 | Auth : contrôle d'âge puis inscription, connexion, vérification email, mot de passe oublié, sessions | A2 | Backend | M | FR-A-1,2,3,5,6,7,9 ; FR-I-12 | tests API verts (âge : refus puis nouvelle tentative, chemin OAuth) |
| A4 | Design system mobile | A1 | UI/UX | M | `07` | page de démo, tests Jest |
| A5 | App Expo : navigation, consentements, âge, auth, onboarding | A3, A4, A0 | Mobile | L | S01–S07, S63, S64, S68 | E2E Maestro : inscription jusqu'à S06 (la découverte est vérifiée en A8) |
| A6 | Profils et médias (upload, modération basique) | A3 | Backend | L | FR-B | tests API |
| A7 | Découverte, swipes, matchs, filtres | A6 | Backend | L | FR-C | tests (concurrence incluse) |
| A8 | Écrans découverte, match, détail profil | A5, A7 | Mobile | L | S09–S12 | E2E parcours 2 |
| A9 | Messagerie texte + Reverb + push | A7 | Realtime | L | FR-D-1..4, 9 | tests de canaux, E2E parcours 3 |
| A10 | Écrans conversations | A8, A9 | Mobile | M | S13, S14 | E2E |
| A11 | Blocage, signalement, protection des mineurs, filtrage de texte | A7 | Security / Backend | M | FR-I-1,2,7,10 | tests S1, S5, S6 |
| A12 | Administration Filament : utilisateurs, médias, signalements, audit | A11 | Backend | L | FR-H | tests + démo |
| A13 | Paramètres, suppression de compte | A3 | Mobile / Backend | M | S50–S55, S57–S60 ; FR-A-8, A-11 | E2E parcours 8 |
| A14 | Gate sécurité et audit indépendant de la phase A | A0–A13, A16, A17 | Security / Reviewer | M | | rapports, G3 |
| A15 | Déploiement staging + sauvegarde/restauration | A1 | DevOps | M | | procès-verbal, G5 (dans le chemin critique avant A14) |

## Phase B : monétisation et confiance

| ID | épopée | propriétaire | taille | écrans / FR |
| --- | --- | --- | --- | --- |
| B1 | Paiements RevenueCat, abonnements, webhook, crédits | Backend | L | FR-G-1,2,4..7 ; S30–S32, S34 |
| B2 | Vérification de profil (selfie) et file de revue | Backend / Mobile | M | FR-B-6 ; S40, S41 |
| B3 | Modération automatique d'images | Security / Backend | M | FR-I-3 |
| B4 | Détection de faux profils et anti-spam | Security | M | FR-I-4, I-5, I-6 (FR-I-5 est phase A dans 03 : limites de base en A11, détection en B4) |
| B5 | Vérification téléphone (SMS) | Backend | S | FR-A-4 |
| B6 | Vidéo de profil, images dans le chat | Backend / Mobile | L | FR-B-4, D-6 ; S08 |
| B7 | Suggestions et super-like | Backend | M | FR-C-5, C-6, C-7 |
| B8 | Statistiques d'administration | Backend | S | FR-H-8 |
| B9 | **Déplacé** : la soumission aux stores se fait après la phase D (gate G6 = stores + appels) | | | |

## Phase D : appels (incluse au lancement)

D0 **Prototype** (en parallèle dès la fin de A14) : push VoIP + CallKit (iOS), ConnectionService / notification d'appel (Android), jeton LiveKit, module natif via config plugin Expo. **Critères go/no-go** : appel entrant app fermée sur un iPhone et sur un Android d'entrée de gamme réel, reconnexion après 20 s de coupure réseau, 3 appels de suite sans plantage. **Si no-go** : le repli (notification classique « appel entrant », ouverture manuelle de l'app) est présenté au propriétaire, qui décide s'il lance sans appels ou retarde.
D1 Serveur LiveKit ou Cloud (ADR 004) et modèle de coût en minutes d'appel. D2 Signalisation et jetons (FR-E-3). D3 Écrans S15–S18. D4 Reconnexion, appels manqués, limites 20 min / 480p (FR-E-5, E-6, E-9). D5 Tests réseau dégradé (3G simulé) et signalement pendant l'appel (FR-E-8).

## Gate de lancement

**G6 (stores) = stores + appels.** Soumission après A, B et D. Voir `14-DEPLOYMENT.md`.

## Phase C : contenus (après lancement)

C1 Stories (FR-F-1..5 ; S20–S23), C2 Invitations vidéo (FR-F-6 ; S24, S25), C3 Notes vocales et vidéos dans le chat (FR-D-7, D-8).

## Phase E : après lancement

E1 Cadeaux virtuels, pièces, catalogue (FR-G-3 ; S33). E2 Parrainage et crédits promo (FR-G-8). E3 **Singles à proximité** (FR-C-8, avec migration PostGIS, localisation consentie, revue stores renforcée). E4 Optimisations de performance, tests de charge.

## Épopées ajoutées après la relecture indépendante

| ID | épopée | phase | propriétaire |
| --- | --- | --- | --- |
| A0 | Internationalisation fr / en (clés de traduction, `users.locale`, notifications et e-mails bilingues, modération et mots-clés par langue, textes légaux) | A | Mobile + Backend | dépend de A1 ; taille M ; FR-Z-1..3 ; preuve : tests Jest des clés, Maestro en/fr |
| A16 | Export des données, consentements, contestation des sanctions, support, page web de suppression | A | Backend | dépend de A3 ; taille M ; FR-I-8, I-11, I-13, I-14 ; preuve : tests API, export généré |
| A17 | Écrans manquants : mot de passe oublié (S61), compte suspendu (S65), contestation (S66), export (S67) ; le code SMS (S62) suit B5 | A | Mobile | dépend de A5, A16 ; taille M ; FR-A-10 ; preuve : Maestro |
| B10 | Tableau de coûts, modèle de coût des appels, procédure de modération humaine | B | DevOps / Security | dépend de P0-8 ; taille S ; preuve : tableau sourcé validé par le propriétaire |

## Chemin critique (lancement)

`G0 → A1 → A2 → A3 → A6 → A7 → A9 → A11 → A0, A16, A17, A15 → A14 → (D0 en parallèle) → B1 → D1..D5 → G6 → G7 → lancement`

## Risques de planification

1. Les comptes développeur (Apple, Google) et les certificats peuvent retarder les premiers tests sur appareil : à ouvrir dès G0.
2. La modération (B3, A12) est sous-estimée dans beaucoup de projets de ce type.
3. D0 peut invalider la phase D telle que décrite.
4. Aucune estimation n'a été faite avec une équipe réelle : les tailles sont indicatives.

## Décisions en attente du propriétaire

Déjà décidées (voir `DECISIONS-PROPRIETAIRE.md`) : stack, budget 30 à 80 €, marchés, langues fr / en, Mac et iPhone disponibles, appels au lancement.

Encore ouvertes :
1. Valider le nom de travail « Ayelo » après recherche de marque.
2. Entité juridique qui vend et édite l'app (conditionne les comptes développeur, le RGPD, la fiscalité).
3. Un téléphone Android d'entrée de gamme pour les tests d'appels.
4. Budget de modération humaine (pas inclus dans le budget d'infrastructure).

## Traçabilité

Matrice exigence → épopée → type de test : [`15b-TRACEABILITY.md`](15b-TRACEABILITY.md) (92 exigences, toutes rattachées à une épopée, générée par script depuis 03).
