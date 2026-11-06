# Spécification 010 : Application mobile (Expo)

**Statut** : fondations livrées ; écrans fonctionnels à faire | **Phase** : A→D | **Exigences** : FR-A-10, FR-B-*, FR-C-*, FR-D-*, FR-E-*, FR-G-*, FR-Z-* | **Écrans** : `docs/05-SCREEN-INVENTORY.md` (déduits, **aucune capture de l'original**)

## Parcours (ordre de livraison)
- **US1 (P1)** Inscription et connexion : accueil, consentements, date de naissance, refus d'âge, formulaire, profil de base, intention — **livré** (S01, S63, S68, S64, S02, S04, S05).
- **US2 (P1)** Profil complet : envoi du profil au serveur, photos (S06), préférences (S07), vérification d'e-mail (S03), mot de passe oublié (S61).
- **US3 (P1)** Découvrir : pile de cartes, filtres, match, détail, blocage / signalement en 3 taps (S09 à S12).
- **US4 (P1)** Messages : liste, conversation, envoi optimiste, temps réel, avis de sécurité (S13, S14).
- **US5 (P2)** Paramètres et vie privée : confidentialité, notifications, sessions, bloqués, suppression de compte, export, support, consentements, sanctions (S50 à S58, S65 à S67).
- **US6 (P2)** Premium : offres, achat (build de développement + RevenueCat), restauration (S30 à S32).
- **US7 (P2)** Vérification de profil par selfie (S40, S41).
- **US8 (P2)** Appels : interface (S15 à S18) puis média réel (après D0).

## Règles
Tout texte via `t('clé')` en français ET anglais (test de parité) ; aucune couleur en dur ; jeton uniquement dans `expo-secure-store` ; accessibilité (labels, cibles ≥ 44) ; états vide / chargement / erreur / hors ligne ; le client n'évalue jamais l'âge.
