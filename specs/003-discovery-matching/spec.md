# Spécification 003 : Découverte, swipes et matchs

**Statut** : livré côté serveur | **Phase** : A | **Exigences** : FR-C-1 à C-9 (sauf C-8) | **Origine** : filtres pays/origine/intention et Explore swipe = **confirmé** ; logique de match = **hypothèse** (inconnue chez l'original)

## Parcours
- **US1 (P1)** Découvrir des profils : actifs, visibles, avec au moins une photo approuvée, non bloqués, jamais déjà swipés, filtrés par préférences surchargées par la requête (âge, pays de résidence y compris étranger, origine, intention, vérifiés). Pagination par curseur sans doublon.
- **US2 (P1)** Liker / refuser. Deux likes réciproques créent **exactement un** match et une conversation, même rejoués.
- **US3 (P2)** Quota de likes quotidien pour un compte gratuit ; super-like et annulation du dernier refus réservés au Premium.
- **US4 (P2)** Lister et rompre un match.
- **US5 (P1)** Bloquer / débloquer (voir 005 pour les effets).

## Cas limites
Swiper un profil masqué/bloqué/inconnu/soi-même ; rejouer un swipe ; deux likes simultanés ; quota atteint ; annulation hors délai (1 h).

## Hors périmètre
Suggestions classées (B7), singles à proximité (012), Explore/test de compatibilité (012).

## Critères de réussite
Aucune paire ne produit deux matchs ; un profil bloqué ou masqué n'est jamais proposé.
