# Spécification 004 : Messagerie et temps réel

**Statut** : livré côté serveur | **Phase** : A | **Exigences** : FR-D-1 à D-6, D-9 à D-11 | **Origine** : chat = **confirmé** ; accusés, présence, images = **hypothèse** ; message avant match (Premium / crédit) = **confirmé**

## Parcours
- **US1 (P1)** Écrire dans une conversation issue d'un match : texte jusqu'à 2 000 caractères, renvoi sans doublon après coupure réseau (`client_id`), historique paginé et trié.
- **US2 (P1)** Recevoir en direct (Reverb) sur un canal privé autorisé aux seuls participants ; fermé après blocage.
- **US3 (P2)** Accusés remis / lus, indicateur de saisie.
- **US4 (P2)** Supprimer son message (contenu effacé), masquer une conversation pour soi (réapparaît au prochain message).
- **US5 (P2)** Ouvrir une conversation sans match avec un crédit « Conversation » ou un Premium ; limite de 10 nouvelles conversations par jour en gratuit.
- **US6 (P2)** Images en pièce jointe : média approuvé, du bon type, appartenant à l'expéditeur.
- **US7 (P2)** Notifications push (FCM) selon préférences ; conseil de sécurité sur demande d'argent détectée.

## Cas limites
Conversation bloquée, utilisateur suspendu, média non approuvé ou d'autrui, deux ouvertures simultanées avec un seul crédit, message de la même seconde (ordre par microsecondes).

## Hors périmètre
Notes vocales et vidéos dans le chat (C3/012), filtre de texte avancé (011).
