# ADR 001 : Évaluation de la stack cible

Statut : **accepté par le propriétaire le 2026-11-05** (voir `docs/DECISIONS-PROPRIETAIRE.md`). Réserve : la décision 2 ci-dessous (appels en phase 2) est modifiée, les appels sont inclus dans le lancement.
Date : 2026-11-05
Décideur : CTO / Orchestrateur

## Contexte

Le master prompt propose une stack de référence : Expo (React Native, TypeScript), Laravel 12, PostgreSQL, Redis, Reverb, LiveKit, Filament, Docker, Caddy/Nginx, S3 compatible, GitHub Actions. Contraintes connues : budget serré (Firebase écarté pour le coût), hébergement sur un VPS, deux plateformes (Android et iOS), contenu généré par les utilisateurs (UGC) et paiements numériques.

Le master prompt demande de **ne pas imposer cette stack aveuglément**. Ce document l'évalue composant par composant.

## Évaluation

| composant | verdict | raison | limite / risque |
| --- | --- | --- | --- |
| Expo + React Native + TypeScript | **retenu** | une base de code pour iOS et Android, écosystème large, EAS Build pour compiler sans Mac | LiveKit, RevenueCat, caméra et notifications natives exigent un **development build** : Expo Go ne suffit pas. Un compte Apple Developer (99 $/an) et Google Play (25 $ une fois) sont nécessaires |
| Laravel 12 (API REST) | **retenu** | productivité forte, auth (Sanctum), files d'attente, validation, politiques d'autorisation, migrations, tests Pest | PHP-FPM consomme plus de mémoire par requête que Node. Utiliser Octane (FrankenPHP) seulement si le profilage le justifie |
| PostgreSQL | **retenu** | contraintes d'intégrité (paires uniques, check), JSONB, index partiels, extension PostGIS possible pour la proximité | une seule instance en V1 : sauvegardes et restauration testées obligatoires |
| Redis | **retenu** | files Laravel (Horizon), cache, limitation de débit, diffusion Reverb à plusieurs instances, présence | ajoute un service à surveiller ; mémoire à limiter (`maxmemory`) |
| Laravel Reverb | **retenu avec réserve** | WebSocket natif Laravel, protocole compatible Pusher, gratuit, bon pour messagerie et présence | process PHP long-lived à superviser (Supervisor) ; au-delà de quelques milliers de connexions simultanées, prévoir Redis scaling ou un déplacement vers un service dédié. Aucun SLA hors de notre infra |
| LiveKit (appels audio/vidéo) | **retenu, hébergé à part** | SFU open source mature, SDK React Native, gère reconnexion et réseaux instables | consomme beaucoup de CPU et de bande passante UDP. **Ne pas le mettre sur le même VPS** que l'API. Alternative : LiveKit Cloud (offre gratuite limitée, puis facturation à la minute) pour démarrer. Nécessite TURN/TLS et ports UDP ouverts |
| Filament (administration) | **retenu** | dashboard, ressources CRUD, modération, journaux : gain de plusieurs semaines | bien isoler l'accès (sous-domaine, 2FA, IP optionnelle) |
| Docker + Caddy | **retenu** | TLS automatique, déploiement reproductible | Docker Compose suffit en V1 ; Kubernetes inutile |
| Stockage S3 compatible | **retenu : Cloudflare R2** | pas de frais de sortie, URL présignées | transcodage et modération à notre charge |
| GitHub Actions | **retenu** | CI gratuite à petite échelle | minutes limitées sur les dépôts privés |
| Pest / PHPUnit, Jest, Maestro | **retenu** | couvre API, composants, E2E mobile | Maestro Cloud est payant ; en local il fonctionne sur émulateur |
| RevenueCat (paiements in-app) | **ajouté** | Apple et Google **imposent** leurs systèmes d'achat pour abonnements, crédits et cadeaux virtuels ; RevenueCat gère reçus, webhooks, restauration | gratuit jusqu'à un seuil de revenu mensuel, puis pourcentage du chiffre d'affaires |
| FCM / APNs (push) | **ajouté** | notifications gratuites | nécessite des clés Apple et Google |

## Décisions

1. La stack de référence est **adoptée**, avec deux ajouts : RevenueCat et FCM/APNs.
2. LiveKit est déployé **séparément** de l'API (LiveKit Cloud au début, serveur dédié ensuite). **Mise à jour du 2026-11-05 : le propriétaire a décidé d'inclure les appels au lancement** (voir `DECISIONS-PROPRIETAIRE.md`), sous réserve du prototype D0 (appels app fermée) et d'un modèle de coût.
3. Les paiements passent par les stores. Aucun Stripe pour les crédits, cadeaux ou abonnements affichés dans l'app mobile.
4. Une base PostgreSQL, un Redis, pas de microservices. Un monolithe Laravel modulaire.

## Dimensionnement et coûts indicatifs (à confirmer avec les tarifs réels)

| élément | lancement (appels inclus) | plus tard |
| --- | --- | --- |
| VPS application (Laravel, Reverb, Postgres, Redis, workers, Caddy) | 8 Go RAM, 4 vCPU | idem |
| Serveur LiveKit | aucun | 1 serveur dédié, ou LiveKit Cloud |
| Stockage R2 | quelques Go | croît avec les vidéos |
| Comptes développeur | Apple 99 $/an, Google 25 $ une fois | idem |

Les prix exacts ne sont pas vérifiés ici : ils seront validés avec les grilles tarifaires officielles avant achat.

## Conséquences

- Le backend est PHP, le mobile est TypeScript : deux langages, contrats d'API générés depuis une spécification OpenAPI pour éviter les écarts.
- Les builds iOS passent par EAS Build (pas besoin de Mac pour compiler, mais un Mac ou un appareil est utile pour tester).
- L'ancien plan Flutter + Node.js est archivé dans `replica/archive/`.

## Points ouverts (mis à jour le 2026-11-05)

Décidés par le propriétaire (voir `DECISIONS-PROPRIETAIRE.md`) : budget de 30 à 80 € par mois, marchés et langues (fr, en), LiveKit Cloud au départ, appels inclus au lancement.

Encore ouverts :
1. Comptes Apple Developer et Google Play : non ouverts ; entité juridique à décider d'abord.
2. Tableau de coûts sourcé : à produire (tâche P0-8) ; le budget n'est pas démontré.
3. ADR 006 (sessions) et ADR 004 (hébergement de LiveKit) à écrire.
