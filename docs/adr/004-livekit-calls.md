# ADR 004 : Appels audio et vidéo avec LiveKit

Statut : accepté pour la signalisation et les jetons (implémenté) ; **média réel non validé** (prototype D0 requis)

## Décision
- Le serveur gère la sonnerie, l'acceptation, le refus, la fin, les appels manqués et la durée maximale (20 minutes) ; il émet des jetons LiveKit JWT HS256 de 10 minutes, limités à une salle `call-<uuid>`, avec publication vidéo seulement pour un appel vidéo. Le secret d'API ne quitte jamais le serveur.
- Appels **réservés aux matchs** (décision propriétaire E2). Un appelé déjà en appel reçoit l'état `busy`.
- Hébergement : LiveKit Cloud au départ (offre gratuite : 5 000 minutes-participant par mois), serveur dédié plus tard si le modèle de coût le justifie (`docs/14b-COSTS.md`).

## Reste à faire (non réalisé)
Le média réel côté mobile (SDK LiveKit React Native) et la sonnerie app fermée (push VoIP + CallKit sur iOS, ConnectionService sur Android) exigent un **build de développement** et des appareils réels. Le prototype D0 doit prouver : appel entrant app fermée sur un iPhone et un Android d'entrée de gamme, reconnexion après 20 s de coupure, 3 appels de suite sans plantage. Tant que D0 n'est pas en « go », la promesse « appels au lancement » n'est pas tenue.
