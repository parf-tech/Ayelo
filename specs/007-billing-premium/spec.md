# Spécification 007 : Premium et crédits

**Statut** : serveur livré ; achat mobile à faire | **Phase** : B | **Exigences** : FR-G-1, G-2, G-4 à G-7 | **Origine** : abonnements, achats « Conversation » = **confirmé** (App Store FR/US) ; paliers multiples de l'original = **volontairement non repris** (décision propriétaire E4)

## Parcours
- **US1 (P1)** Acheter un Premium (1, 3, 12 mois) via l'achat intégré ; le serveur active l'accès à réception du webhook RevenueCat authentifié.
- **US2 (P1)** Acheter des crédits « Conversation » (packs 1, 5, 10) pour écrire à un profil sans match.
- **US3 (P1)** Annulation : accès conservé jusqu'à la fin de la période payée. Remboursement : accès retiré, crédits repris sans solde négatif, signal de risque si déjà dépensés.
- **US4 (P2)** Consulter son statut, ses offres, son historique ; restaurer ses achats (exigence des stores).

## Règles
Idempotence à trois niveaux (événement, achat, abonnement) ; registre de crédits en ajout seulement ; un utilisateur inconnu est ignoré sans erreur.

## Hors périmètre
« Propositions » et « filtres avancés » (non spécifiés, hors lancement) ; cadeaux et pièces (012).

## [NEEDS CLARIFICATION]
Noms exacts des événements RevenueCat et authentification du webhook à confirmer dans la documentation officielle (ADR 002) ; prix par pays ; entité juridique vendeuse.
