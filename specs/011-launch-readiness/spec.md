# Spécification 011 : Préparation du lancement (gates G3 à G7)

**Statut** : à faire | **Phase** : fin A/B/D | **Origine** : exigences des stores, de la sécurité et du droit ; plusieurs lots **dépendent du propriétaire ou d'un tiers**

## Parcours / jalons
- **US1 (P1)** Sécurité : revue de sécurité indépendante du code, correction des constats critiques et hauts, rejeu des exigences S1 à S9 de `docs/11` (gate G3).
- **US2 (P1)** Juridique : matrice par marché validée par un juriste, CGU, confidentialité, mentions, AIPD, procédure de signalement aux autorités, durées de conservation.
- **US3 (P1)** Comptes et clés : comptes Apple Developer et Google Play (test fermé de 12 testeurs pendant 14 jours), RevenueCat, FCM, R2, Google / Apple OAuth, LiveKit.
- **US4 (P1)** Déploiement : VPS, Docker Compose de production, Caddy, sauvegardes chiffrées avec **restauration prouvée**, supervision, alertes (gate G5).
- **US5 (P1)** Bout en bout : parcours critiques (Maestro) sur émulateurs contre un backend réel (gate G4).
- **US6 (P1)** Appels : prototype D0 sur appareils réels, modèle de coût (gate G6, partie appels).
- **US7 (P1)** Stores : fiches, captures, étiquettes de confidentialité, UGC (Apple 1.2), achats, suppression de compte, soumission (gate G6).
- **US8 (P2)** Modération humaine : organisation, budget, procédures.
- **US9 (P2)** Marque : recherche d'antériorité professionnelle (AILO), domaine, noms de stores.

## Critères de réussite
Chaque gate franchi avec sa preuve (voir `docs/13-TEST-STRATEGY.md`) ; décision G7 écrite par le CTO et le propriétaire.
