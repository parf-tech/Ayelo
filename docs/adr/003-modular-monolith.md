# ADR 003 : Monolithe modulaire Laravel

Statut : accepté (implémenté)

## Décision
Une seule application Laravel, découpée en modules. Un module = un fichier de routes (`routes/api/<module>.php`, chargé sous `/api/v1`), des contrôleurs fins, des services (`app/Services`) qui portent les règles métier, des politiques (`app/Policies`) pour l'autorisation.

## Règles
- Écriture : un module ne modifie pas les tables d'un autre module sauf par ses services.
- Autorisation : toute lecture d'une donnée d'autrui passe par une politique (`ProfilePolicy`, `MediaPolicy`) ou par `Conversations::forParticipant`. Les identifiants ne sont jamais crus quand ils viennent du client pour décider des droits.
- Réponses d'erreur uniformes (`{error:{code,message,fields?}}`), 404 identique pour « inexistant », « masqué » ou « bloqué » (on ne révèle pas le blocage).
- Le schéma SQL de référence (`docs/schema/001_initial.sql`) est la seule source de vérité ; la migration Laravel l'applique.
