# 00 : Résumé exécutif

## Projet

Construire une application de rencontres **indépendante** pour Android et iOS, inspirée des fonctionnalités publiques de Chat&Yamo (Affinity Square US Inc.). Aucun code, ressource protégée, donnée privée ou identité de marque de l'original n'est repris.

## Établi par des sources lues (niveau C, voir `02-REA-REPORT.md`)

- Chat&Yamo est une application de rencontres pour les célibataires d'Afrique et de la diaspora, éditée par Affinity Square US Inc., gratuite avec achats intégrés, notée 4,2 sur l'App Store US (≈1,1 k avis) et 4,0 sur l'App Store FR (≈3 000 avis).
- Fonctions documentées par l'App Store et le site officiel : filtres par origine et pays, intentions de rencontre, invitations vidéo, Explore (swipe), stories vidéo de 15 à 20 s, cadeaux virtuels achetés avec des crédits, appels voix et vidéo depuis le chat (selon le site), proximité par géolocalisation, certification des profils, signalement et blocage, abonnement Premium, achats ponctuels.

## Déclaré par des tiers ou par l'éditeur (niveau T, non vérifié)

- Statistiques Android (≈13 k avis, 3,97/5, 2,3 M+ installations, ≈53 k utilisateurs actifs, revenus estimés) : AppGoblin. La page Google Play n'a pas pu être lue.
- Chiffres marketing du site (4 M d'inscrits, etc.) : déclaratifs.

## Non établi

- Les écrans réels : aucune capture de l'app n'a été analysée, la cartographie est **déduite**.
- Notes vocales, images dans le chat, accusés de lecture, présence, vérification email / téléphone : choix produit du clone, sans preuve dans l'original.
- L'architecture interne de l'original : inconnue et non étudiée (pas de rétro-ingénierie du binaire ni du réseau).

## Décisions clés

| sujet | décision | référence |
| --- | --- | --- |
| Stack | Expo, Laravel 12, PostgreSQL, Redis, Reverb, LiveKit, Filament (acceptée le 2026-11-05) | ADR 001 |
| Paiements | achats in-app Apple / Google via RevenueCat | `12-MONETIZATION.md` |
| Appels | **inclus au lancement** (matchs seulement, 20 min, 480p) ; LiveKit Cloud au départ ; prototype D0 obligatoire | `DECISIONS-PROPRIETAIRE.md` |
| Marchés | vague 1 France / Belgique / Suisse / Canada francophone ; vague 2 Afrique francophone ; vague 3 États-Unis, Royaume-Uni, Afrique anglophone | `DECISIONS-PROPRIETAIRE.md` |
| Langues | français et anglais dès la V1 | |
| Hébergement | VPS 8 Go pour l'API, stockage Cloudflare R2 ; budget cible 30 à 80 € par mois (**non démontré**, voir `14-DEPLOYMENT.md`) | `14-DEPLOYMENT.md` |
| Base de données | `schema/001_initial.sql` exécuté sur PGlite (PostgreSQL 18 émulé), 36 tables, 33 tests passés sur PostgreSQL 16.15 natif | `09-DATABASE-SCHEMA.md` |

## Livraison en phases

Le périmètre de **lancement** est A + B + D. Les phases C et E viennent après.

1. **Phase A : socle.** Comptes, profils, découverte, messagerie, blocage / signalement, administration, i18n fr/en.
2. **Phase B : monétisation et confiance.** Premium, crédits conversation, vérification de profil, modération.
3. **Phase D : appels audio et vidéo** (LiveKit), avec le prototype D0 lancé en parallèle dès la fin de la phase A.
4. **Lancement** : gate G6 (stores) et G7, après A, B et D.
5. **Phase C (après lancement) :** stories, invitations vidéo, notes vocales.
6. **Phase E (après lancement) :** cadeaux virtuels, proximité, parrainage, optimisation.

Chaque phase passe des gates de livraison (`13-TEST-STRATEGY.md`). Rien n'est déclaré terminé sans preuve vérifiable : tests exécutés, journaux, captures.

## Risques majeurs

1. **Modération et arnaques sentimentales** : risque légal et de réputation.
2. **Exigences des stores** pour l'UGC (signalement, blocage, filtrage, suppression de compte) et les achats numériques.
3. **Effet de réseau** : une app de rencontres vide ne fonctionne pas. Prévoir une stratégie de lancement par ville ou communauté.
4. **Coût et complexité du temps réel** (appels, vidéos).
5. **Protection des mineurs et des données** (RGPD).

## État actuel (2026-11-05)

- Recon publique faite : `replica/recon.md`, `replica/features.csv`. App Store FR et site officiel lus ; Google Play non lu (page tronquée).
- ADR 001 acceptée par le propriétaire. Décisions du propriétaire et arbitrages du CTO dans `DECISIONS-PROPRIETAIRE.md`.
- Relectures indépendantes : passe 1 (`reviews/phase0.md` : 4 bloquants, 31 majeurs, 20 mineurs) et passe 2 (`reviews/phase0-bis.md` : 1 bloquant, 9 majeurs, 15 mineurs). Corrections suivies dans `reviews/phase0-bis-suivi.md`. **G1 conditionnel accepté par le propriétaire (2026-11-05)** : la phase A1 a démarré. Le SQL est vérifié sur PostgreSQL 16.15 natif en local (33 tests) ; il reste la CI GitHub, le test de la migration Laravel et une troisième passe de relecture pour déclarer G1 définitif.
- Reste à produire : tableau de coûts sourcé (MAJ-06), matrice juridique par marché (MAJ-05), spécifications manquantes (voir `reviews/phase0-suivi.md`).
- Aucun code d'application écrit.
