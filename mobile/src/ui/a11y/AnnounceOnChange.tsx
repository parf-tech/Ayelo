import { useEffect, useRef } from 'react';
import { announce } from './announce';

/**
 * Annonce `message` aux lecteurs d'écran iOS à chaque changement (iOS n'a pas de région vivante ; Android lit déjà la région
 * vivante du texte, `announce` n'y fait rien). Composant sans rendu : il se place où le message apparaît, sans toucher à
 * l'ordre des hooks de l'écran (utilisable après un retour anticipé). `skipInitial` : pas d'annonce au premier rendu
 * (valeur initiale d'un champ, par opposition à un changement).
 */
export function Announce({ message, skipInitial = false }: { message?: string; skipInitial?: boolean }) {
  const first = useRef(true);
  useEffect(() => {
    const initial = first.current;
    first.current = false;
    if (initial && skipInitial) return;
    if (message) announce(message);
  }, [message, skipInitial]);
  return null;
}
