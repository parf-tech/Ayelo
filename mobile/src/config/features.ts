/**
 * Indicateurs de fonctions (décision de conception 1, docs/design/01-decisions.md).
 * Les appels audio et vidéo restent masqués tant que le moteur média (LiveKit) n'est pas branché :
 * on ne montre pas une fonction qui ne marche pas. Le code des appels est conservé.
 * Passer à `true` quand `MediaEngine.available` le sera réellement.
 */
export const CALLS_ENABLED = false as boolean;
