# Tâches 011 : Préparation du lancement

## Que l'équipe peut faire seule
- [ ] T001 Revue de sécurité du code (relancer l'agent après la limite d'usage) → `docs/reviews/code-security-1.md`
- [ ] T002 Corriger les constats critiques et hauts, rejouer les tests, relecture de contrôle
- [ ] T003 `infra/docker-compose.prod.yml` + `Caddyfile` + scripts de sauvegarde et de restauration (écrits, essai de restauration dès qu'un serveur existe)
- [ ] T004 Contrat OpenAPI généré depuis le code + client TypeScript pour le mobile
- [ ] T005 Parcours Maestro (inscription, match, message, blocage, signalement, suppression)
- [ ] T006 Test de concurrence réelle pour les matchs et l'ouverture de conversation
- [ ] T007 Présence calculée côté serveur (Redis) ; filtre de texte fr/en
- [ ] T008 Brouillons (étiquetés brouillons) : CGU, confidentialité, règles de la communauté, matrice marché × obligation pour le juriste
- [ ] T009 Listes de contrôle des stores (Apple 1.2, Play) dans `docs/release/`

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
