/**
 * Indicateurs de fonctions (décision de conception 1, docs/design/01-decisions.md).
 * Les appels audio et vidéo restent masqués tant que le moteur média (LiveKit) n'est pas branché :
 * on ne montre pas une fonction qui ne marche pas. Le code des appels est conservé.
 * Passer à `true` quand `MediaEngine.available` le sera réellement.
 */
export const CALLS_ENABLED = false as boolean;

/**
 * Notes vocales et vidéos en conversation : l'envoi n'est proposé que si le serveur les accepte. Côté serveur elles sont fermées
 * tant que le conteneur `transcode` n'est pas déployé (MEDIA_CHAT_AV_ENABLED, docs/runbooks/transcode.md) ; un envoi serait refusé.
 * Activé à la construction : EXPO_PUBLIC_CHAT_AV_ENABLED=true. La LECTURE des messages vocaux et vidéo reçus ne dépend pas de ce
 * réglage : seul le serveur décide de ce qui existe.
 */
export const CHAT_AV_ENABLED = process.env.EXPO_PUBLIC_CHAT_AV_ENABLED === 'true';
