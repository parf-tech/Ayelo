# ADR 005 : Modération des médias

Statut : accepté (file humaine) ; prestataire automatique **non choisi**

## Décision
Aucun média n'est public avant approbation. À la fin de l'envoi, un média passe en `processing` et attend la revue humaine (interface d'administration). Le réglage `MEDIA_AUTO_APPROVE` (faux par défaut) n'existe que pour le développement local.
Contrôles côté serveur : type MIME et taille relus sur l'objet réellement déposé (`HEAD`), jamais ceux déclarés par le client ; fichier non conforme supprimé ; 6 photos maximum ; quotas par heure.

## Reste à décider
Un prestataire de classification d'images (y compris détection de contenus d'abus d'enfants), son coût (non chiffré dans `docs/14b-COSTS.md`) et la procédure légale de signalement aux autorités par pays (juriste). Sans prestataire, la capacité de modération dépend de l'effectif humain, non budgété.
