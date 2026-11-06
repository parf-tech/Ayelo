# ADR 006 : Sessions et jetons

Statut : accepté (implémenté)

## Décision
Jetons Laravel Sanctum, un par appareil (`devices.token_id`), d'expiration **fixe** de 30 jours (`SANCTUM_EXPIRATION`, en minutes). Pas de jeton de rafraîchissement ni d'expiration glissante en V1.
Mots de passe hachés en Argon2id. Réinitialisation du mot de passe, ou suppression de compte : toutes les sessions sont fermées. Liste et fermeture des sessions par l'utilisateur (`/auth/sessions`).

## Conséquences et limites
Un jeton volé reste valable jusqu'à sa révocation ou 30 jours. Une expiration glissante ou un couple accès/rafraîchissement pourra être ajouté si l'analyse de risque l'exige. Les jetons sont stockés côté mobile dans le trousseau sécurisé (`expo-secure-store`).
