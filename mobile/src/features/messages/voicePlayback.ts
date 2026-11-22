import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '../../api/errors';
import { createVoicePlayer, type VoicePlayer } from '../../media/voicePlayer';
import type { LoadMessageImage } from './useMessageImages';

/** Une seule note vocale à la fois : celle qui démarre met la précédente en pause. */
let active: { id: string; pause: () => void } | null = null;

export type VoicePhase = 'idle' | 'loading' | 'ready' | 'pending' | 'rejected' | 'error';

export type VoiceState = {
  phase: VoicePhase;
  playing: boolean;
  /** Secondes. */
  position: number;
  /** Secondes ; 0 tant que le lecteur ne l'a pas lue (on affiche alors la durée annoncée par le serveur). */
  duration: number;
};

/**
 * Lecture d'une note vocale approuvée. L'adresse signée n'est demandée qu'au premier « Écouter » (aucune demande pour les notes
 * qu'on ne lit pas) ; le lecteur natif n'est créé qu'à ce moment, réutilisé ensuite, et libéré avec la bulle.
 * Une course avec la modération se lit comme « en vérification » (409) ou « refusée » (410).
 */
export function useVoicePlayback(messageId: string, loadUrl: LoadMessageImage) {
  const [state, setState] = useState<VoiceState>({ phase: 'idle', playing: false, position: 0, duration: 0 });
  const player = useRef<VoicePlayer | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (active?.id === messageId) active = null;
      player.current?.release();
      player.current = null;
    };
  }, [messageId]);

  const start = useCallback(
    (instance: VoicePlayer) => {
      if (active && active.id !== messageId) active.pause();
      active = { id: messageId, pause: () => instance.pause() };
      instance.play();
    },
    [messageId],
  );

  const open = useCallback(
    async (force: boolean) => {
      setState((s) => ({ ...s, phase: 'loading' }));
      try {
        const url = await loadUrl(messageId, force);
        if (!mounted.current) return;
        const instance = createVoicePlayer(url, (status) => {
          if (!mounted.current) return;
          setState((s) => ({
            ...s,
            playing: status.playing,
            // À la fin, retour au début : la note est prête à être réécoutée.
            position: status.finished ? 0 : status.position,
            duration: status.duration > 0 ? status.duration : s.duration,
          }));
        });
        player.current = instance;
        setState((s) => ({ ...s, phase: 'ready', playing: true }));
        start(instance);
      } catch (error) {
        if (!mounted.current) return;
        const phase = isApiError(error) && error.code === 'media_pending' ? 'pending' : isApiError(error) && error.code === 'media_rejected' ? 'rejected' : 'error';
        setState((s) => ({ ...s, phase, playing: false }));
      }
    },
    [loadUrl, messageId, start],
  );

  const play = useCallback(() => {
    if (player.current) {
      setState((s) => ({ ...s, playing: true }));
      start(player.current);
      return;
    }
    void open(false);
  }, [open, start]);

  const pause = useCallback(() => {
    player.current?.pause();
    setState((s) => ({ ...s, playing: false }));
  }, []);

  const reload = useCallback(() => {
    player.current?.release();
    player.current = null;
    void open(true);
  }, [open]);

  return { state, play, pause, reload };
}
