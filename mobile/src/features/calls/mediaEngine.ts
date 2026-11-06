import type { CallKind, LiveKitInfo } from '../../api/types';

export class MediaUnavailableError extends Error {
  constructor() {
    super('Call media is not available in this build (prototype D0 required)');
    this.name = 'MediaUnavailableError';
  }
}

/**
 * Moteur média d'un appel (audio / vidéo). Interface abstraite : le vrai moteur (LiveKit via @livekit/react-native)
 * exige un build de développement et le prototype D0 ; il n'est PAS implémenté ici.
 * Voir mobile/README.md, section « Appels : prototype D0 requis ».
 */
export interface MediaEngine {
  /** false = aucun média ne circule : l'interface l'indique clairement. */
  readonly available: boolean;
  connect(info: LiveKitInfo, kind: CallKind): Promise<void>;
  disconnect(): Promise<void>;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
}

/** Implémentation « non disponible » : toute tentative de connexion échoue explicitement (aucune simulation d'appel). */
export class UnavailableMediaEngine implements MediaEngine {
  readonly available = false;
  async connect(): Promise<void> {
    throw new MediaUnavailableError();
  }
  async disconnect(): Promise<void> {}
  async setMicrophoneEnabled(): Promise<void> {
    throw new MediaUnavailableError();
  }
  async setCameraEnabled(): Promise<void> {
    throw new MediaUnavailableError();
  }
}
