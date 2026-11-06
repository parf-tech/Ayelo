# Spécification 009 : Administration (back-office)

**Statut** : à faire (un premier agent a été interrompu ; fichiers partiels non validés) | **Phase** : A/B | **Exigences** : FR-H-1 à H-9, FR-B-6 (décision), FR-I-11 | **Origine** : interne (non observable chez l'original)

## Parcours
- **US1 (P1)** Un membre du personnel se connecte avec 2FA obligatoire (table `staff_users` séparée de `users`, aucun accès pour les utilisateurs normaux).
- **US2 (P1)** Modérer les médias en attente : approuver, ou rejeter (objet supprimé).
- **US3 (P1)** Traiter les signalements par priorité : avertir, suspendre (durée), bannir, classer, lever la suspension préventive d'un mineur suspecté ; l'utilisateur voit la sanction et peut contester.
- **US4 (P1)** Traiter les contestations : accepter (lève la sanction) ou rejeter avec note.
- **US5 (P2)** Vérifier les profils : voir le selfie par URL signée courte (consultation journalisée), approuver / rejeter ; le selfie est supprimé à la décision.
- **US6 (P2)** Gérer les utilisateurs : recherche, suspension / bannissement avec motif, score de risque, ajustement de crédits et Premium offert (admin seulement, motif obligatoire).
- **US7 (P2)** Support : tickets avec statut et attribution.
- **US8 (P1)** Journal d'audit en lecture seule : **toute** action d'administration y est écrite (acteur, objet, avant / après, IP).
- **US9 (P3)** Tableau de bord : inscriptions, signalements ouverts par priorité, files en attente.

## Rôles
moderator : médias, signalements, contestations, vérifications ; support : tickets, lecture seule des utilisateurs ; admin : tout.

## Critères de réussite
Aucune action sans ligne d'audit ; aucun accès sans 2FA ; aucun secret affiché.
