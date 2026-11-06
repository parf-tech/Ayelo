# Tâches 011 : Préparation du lancement

## Que l'équipe peut faire seule
- [x] T001 Revue de sécurité du code → `docs/reviews/code-security-1.md` (0 critique, 9 hauts, 9 moyens, 12 bas)
- [~] T002 Corriger les constats hauts : 7 corrigés, 2 atténués, 24 tests (`SecurityHardeningTest`, suite de 158 tests verte, CI verte) ; **relecture de contrôle à faire**
- [~] T003 `infra/docker-compose.prod.yml`, `infra/php/Dockerfile`, `infra/caddy/Caddyfile`, `infra/backup/{backup,restore}.sh`, `docs/runbooks/restauration.md` : **écrits, jamais exécutés** (Docker absent) ; essai de restauration à faire sur un serveur
- [ ] T004 Contrat OpenAPI généré depuis le code + client TypeScript pour le mobile
- [ ] T005 Parcours Maestro (inscription, match, message, blocage, signalement, suppression)
- [ ] T006 Test de concurrence réelle pour les matchs et l'ouverture de conversation
- [ ] T007 Présence calculée côté serveur (Redis) ; filtre de texte fr/en
- [~] T008 Brouillons juridiques étiquetés « brouillon » dans `docs/legal/` (CGU, confidentialité, règles de la communauté, matrice marché × obligation) : **à faire valider par un juriste**
- [~] T009 Liste de contrôle des stores `docs/release/01-checklist-stores.md` : rédigée, à comparer aux politiques officielles le jour de la soumission

## Dépend du propriétaire ou d'un tiers
- [ ] T020 Accords écrits : budget, serveur, domaine
- [ ] T021 Entité juridique, comptes Apple Developer et Google Play, 12 testeurs Google
- [ ] T022 Clés et comptes : RevenueCat, FCM, R2, Google / Apple OAuth, LiveKit
- [ ] T023 Validation juridique de la matrice et des textes
- [ ] T024 Budget et recrutement de la modération humaine
- [ ] T025 Recherche d'antériorité professionnelle du nom, domaines
- [ ] T026 Prototype D0 sur iPhone et Android réels
- [ ] T027 Déploiement réel, sauvegarde restaurée, supervision (G5)
- [ ] T028 Soumission aux stores et décision de lancement (G6, G7)
