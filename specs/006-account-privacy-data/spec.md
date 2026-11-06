# Spécification 006 : Compte, vie privée et données

**Statut** : livré côté serveur | **Phase** : A | **Exigences** : FR-A-8, FR-A-11, FR-I-8, I-13, I-14, I-15, FR-B-7 | **Origine** : suppression dans les réglages = **confirmé** (CGU) ; export, consentements = obligations légales (RGPD, à valider par un juriste)

## Parcours
- **US1 (P1)** Supprimer son compte avec ré-authentification (mot de passe, ou id_token frais du fournisseur) : profil masqué et sessions fermées aussitôt, anonymisation après 30 jours (tâche planifiée).
- **US2 (P1)** Demander la suppression depuis le **web** (page exigée par les stores) : lien envoyé à l'e-mail du compte, réponse identique que le compte existe ou non.
- **US3 (P2)** Exporter ses données (JSON, lien signé 7 jours, une demande par jour).
- **US4 (P1)** Consulter et retirer ses consentements ; retirer « données sensibles » masque le profil.
- **US5 (P2)** Contacter le support (5 demandes par jour).

## Règles de conservation
Après anonymisation : e-mail, téléphone, mot de passe, profil, médias (objets supprimés), messages envoyés (contenu effacé), swipes, appareils, identités sociales effacés ; la ligne `users` minimale, les signalements, les sanctions et les consentements sont conservés ; un compte sanctionné laisse un **hash** de son e-mail pour empêcher le contournement d'un bannissement.

## Non décidé (juriste)
Durées de conservation légales exactes, politique de sauvegardes (rejeu des suppressions à la restauration), obligations par marché.
