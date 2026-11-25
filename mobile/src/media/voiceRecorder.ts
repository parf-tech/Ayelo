import { AudioModule, RecordingPresets, setAudioModeAsync, type AudioRecorder, type RecordingOptions } from 'expo-audio';

// Le constructeur de l'enregistreur est porté par le module natif ; typé ici pour éviter l'accès par espace de noms.
const NativeRecorder = (AudioModule as unknown as { AudioRecorder: new (options: RecordingOptions) => AudioRecorder }).AudioRecorder;

/** Durée maximale d'une note vocale, en secondes (celle du serveur : config/media.php, `message_voice.max_seconds`). */
export const MAX_VOICE_SECONDS = 120;

export type VoiceRecording = { uri: string; durationSeconds: number };

/** Enregistrement en cours : `stop` rend le fichier, `cancel` l'abandonne. Dans les deux cas le micro est rendu au système. */
export type RecordingSession = {
  stop: () => Promise<VoiceRecording | null>;
  cancel: () => Promise<void>;
};

export type StartResult = { kind: 'started'; session: RecordingSession } | { kind: 'denied' } | { kind: 'error' };

/** AAC mono 64 kbit/s : une minute pèse moins d'un demi-mégaoctet, la voix reste claire. */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, sampleRate: 44100 };

async function releaseMicrophone(): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: false });
  } catch {
    // rien à faire : le système reprendra la main à la fermeture de l'application
  }
}

/**
 * Demande la permission du micro, puis démarre l'enregistrement. Aucune permission, ou un matériel indisponible, ne lève jamais :
 * le résultat dit pourquoi (`denied`, `error`), l'écran l'explique. La durée est mesurée à l'horloge et bornée à MAX_VOICE_SECONDS.
 */
export async function startVoiceRecording(): Promise<StartResult> {
  const permission = await AudioModule.requestRecordingPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };

  let recorder: AudioRecorder | null = null;
  try {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    recorder = new NativeRecorder(OPTIONS);
    await recorder.prepareToRecordAsync();
    recorder.record();
  } catch {
    try {
      recorder?.release();
    } catch {
      // déjà libéré
    }
    await releaseMicrophone();
    return { kind: 'error' };
  }

  const active = recorder;
  const startedAt = Date.now();

  const finish = async (): Promise<void> => {
    try {
      await active.stop();
    } finally {
      await releaseMicrophone();
    }
  };

  return {
    kind: 'started',
    session: {
      stop: async () => {
        const seconds = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
        try {
          await finish();
          const uri = active.uri;
          return uri ? { uri, durationSeconds: seconds } : null;
        } catch {
          return null;
        } finally {
          try {
            active.release();
          } catch {
            // déjà libéré
          }
        }
      },
      cancel: async () => {
        try {
          await finish();
        } catch {
          // l'enregistreur était déjà arrêté
        }
        try {
          active.release();
        } catch {
          // déjà libéré
        }
      },
    },
  };
}
