# Spécification 008 : Appels audio et vidéo

**Statut** : signalisation et jetons livrés ; **média réel non prouvé** | **Phase** : D | **Exigences** : FR-E-1 à E-10 | **Origine** : appels vidéo = **confirmé** (App Store, site) ; limites (20 min, 480p, matchs seulement) = décision propriétaire E2

## Parcours
- **US1 (P1)** Appeler un match en audio ou vidéo : sonnerie 30 s, l'appelé accepte ou refuse, l'appelant peut annuler.
- **US2 (P1)** Appel entrant app fermée (push VoIP + CallKit iOS, ConnectionService Android) — **non réalisé**.
- **US3 (P2)** Appel manqué : message dans la conversation et notification ; appelé occupé : état `busy`.
- **US4 (P2)** Fin automatique à 20 minutes ; renouvellement du jeton de 10 minutes ; reconnexion après coupure.

## Règles de sécurité
Réservé aux matchs actifs, sans blocage, entre comptes actifs ; un appel à la fois par appelant ; jeton limité à la salle, vidéo interdite pour un appel audio ; signalement possible pendant l'appel.

## Prototype D0 (go / no-go)
Appel entrant app fermée sur un iPhone et un Android d'entrée de gamme ; reconnexion après 20 s de coupure ; 3 appels de suite sans plantage. Si no-go : repli par notification classique, décision du propriétaire sur la date de lancement.
