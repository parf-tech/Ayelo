import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export type VoiceStatus = { playing: boolean; position: number; duration: number; finished: boolean };

export type VoicePlayer = { play: () => void; pause: () => void; release: () => void };

/**
 * Lecteur d'une note vocale (adresse signée), derrière une interface minimale remplaçable dans les tests. Le son passe même
 * quand le téléphone est en mode silencieux (c'est un message qu'on a demandé à écouter). `release` libère le lecteur natif :
 * à appeler quand la bulle disparaît.
 */
export function createVoicePlayer(url: string, onUpdate: (status: VoiceStatus) => void): VoicePlayer {
  void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  const player = createAudioPlayer({ uri: url });
  let finished = false;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    finished = status.didJustFinish;
    onUpdate({ playing: status.playing, position: status.currentTime, duration: status.duration, finished: status.didJustFinish });
  });

  return {
    play: () => {
      // Après la fin, le lecteur reste en fin de fichier : on revient au début avant de relancer.
      if (finished) {
        finished = false;
        void player.seekTo(0).then(() => player.play());
        return;
      }
      player.play();
    },
    pause: () => player.pause(),
    release: () => {
      subscription.remove();
      player.release();
    },
  };
}
