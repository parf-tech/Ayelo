# ADR 005 : Modération des médias

Statut : accepté (file humaine) ; prestataire automatique **non choisi**

## Décision
Aucun média n'est public avant approbation. À la fin de l'envoi, un média passe en `processing` et attend la revue humaine (interface d'administration). Le réglage `MEDIA_AUTO_APPROVE` (faux par défaut) n'existe que pour le développement local.
Contrôles côté serveur : type MIME et taille relus sur l'objet réellement déposé (`HEAD`), jamais ceux déclarés par le client ; fichier non conforme supprimé ; 6 photos maximum ; quotas par heure.

## Images de conversation (2026-11-22)
Un message `image` peut référencer un média encore en revue (`processing`) : le message part tout de suite. Le principe « aucun média n'est public avant approbation » est tenu à la lecture : `GET /conversations/{id}/messages/{messageId}/media` ne remet l'adresse signée (10 minutes) qu'aux deux membres de la conversation et seulement si le média est `approved` (409 `media_pending` en revue, 410 `media_rejected` après un rejet). L'approbation et le rejet préviennent la conversation en direct (signal `message.media`, sans le motif) et par notification push (expéditeur : approuvée ou refusée ; destinataire : photo visible, si la conversation est encore écrivable ; texte générique). Un média `rejected` ou non finalisé ne peut pas être envoyé. Les modérateurs voient ces images dans la même file que les autres médias (type « Image de message ») : les textes légaux doivent le dire.

## Notes vocales et vidéos de conversation (2026-11-22)
Le propriétaire a demandé les notes vocales (2 minutes au plus) et les vidéos (30 secondes et 50 Mo au plus) en conversation, et autorisé la modification de `infra/`. Elles restent **fermées par défaut** (`MEDIA_CHAT_AV_ENABLED=false`) : la revue de sécurité F-05 exige qu'aucun fichier audio ou vidéo ne soit servi sans réencodage sans métadonnées, et `docs/14-DEPLOYMENT.md` impose que ffmpeg tourne dans un conteneur sans réseau.
Parcours : fin de dépôt, statut `transcoding` (état interne, présenté comme `processing`), conteneur `transcode` (dossier partagé, sans réseau, plafonds de CPU, de mémoire, de durée), contrôle du résultat (type, taille, durée mesurée), statut `processing`, revue humaine, `approved` ou `rejected`. Un média `transcoding` n'entre pas dans la file de modération et n'est jamais servi. Un fichier illisible, hors limites ou un traitement trop long est refusé (`rejected`, motif interne `unreadable`) et l'expéditeur est prévenu. Mode d'emploi et essai réel obligatoire avant l'ouverture : `docs/runbooks/transcode.md`.

## Reste à décider
Un prestataire de classification d'images (y compris détection de contenus d'abus d'enfants), son coût (non chiffré dans `docs/14b-COSTS.md`) et la procédure légale de signalement aux autorités par pays (juriste). Sans prestataire, la capacité de modération dépend de l'effectif humain, non budgété.
