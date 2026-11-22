import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { MAX_VOICE_SECONDS, startVoiceRecording } from '../src/media/voiceRecorder';

/** Enregistrement d'une note vocale : permission, mode audio, enregistreur, durée, annulation. Aucun matériel : expo-audio est simulé. */

type FakeRecorder = {
  uri: string | null;
  prepareToRecordAsync: jest.Mock;
  record: jest.Mock;
  stop: jest.Mock;
  release: jest.Mock;
};

const recorders: FakeRecorder[] = [];
const requestPermission = AudioModule.requestRecordingPermissionsAsync as jest.Mock;
const recorderCtor = (AudioModule as unknown as { AudioRecorder: jest.Mock }).AudioRecorder;
const setMode = setAudioModeAsync as jest.Mock;

beforeEach(() => {
  recorders.length = 0;
  requestPermission.mockResolvedValue({ granted: true });
  setMode.mockResolvedValue(undefined);
  recorderCtor.mockImplementation(() => {
    const recorder: FakeRecorder = {
      uri: null,
      prepareToRecordAsync: jest.fn(async () => undefined),
      record: jest.fn(),
      stop: jest.fn(async () => {
        recorder.uri = 'file:///cache/rec.m4a';
      }),
      release: jest.fn(),
    };
    recorders.push(recorder);
    return recorder;
  });
  jest.useFakeTimers({ now: 1_000_000 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('startVoiceRecording', () => {
  it('refuse sans permission du micro : aucun enregistreur créé', async () => {
    requestPermission.mockResolvedValue({ granted: false });
    await expect(startVoiceRecording()).resolves.toEqual({ kind: 'denied' });
    expect(recorderCtor).not.toHaveBeenCalled();
  });

  it('démarre un enregistrement mono AAC léger, mode audio « enregistrement »', async () => {
    const result = await startVoiceRecording();
    expect(result.kind).toBe('started');
    expect(setMode).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true, playsInSilentMode: true }));
    expect(recorderCtor).toHaveBeenCalledWith(expect.objectContaining({ numberOfChannels: 1, bitRate: 64000, sampleRate: 44100, extension: '.m4a' }));
    expect(recorders[0]?.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(recorders[0]?.record).toHaveBeenCalledTimes(1);
  });

  it('« stop » rend le fichier et la durée arrondie à la seconde, puis rend le micro', async () => {
    const result = await startVoiceRecording();
    if (result.kind !== 'started') throw new Error('démarrage attendu');
    jest.setSystemTime(1_000_000 + 7_400);

    const recording = await result.session.stop();

    expect(recording).toEqual({ uri: 'file:///cache/rec.m4a', durationSeconds: 7 });
    expect(setMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
    expect(recorders[0]?.release).toHaveBeenCalled();
  });

  it('une durée de moins d’une seconde compte pour une seconde (le serveur refuse zéro)', async () => {
    const result = await startVoiceRecording();
    if (result.kind !== 'started') throw new Error('démarrage attendu');
    jest.setSystemTime(1_000_000 + 200);
    await expect(result.session.stop()).resolves.toMatchObject({ durationSeconds: 1 });
  });

  it('la durée n’excède jamais la limite, même si l’arrêt tarde', async () => {
    const result = await startVoiceRecording();
    if (result.kind !== 'started') throw new Error('démarrage attendu');
    jest.setSystemTime(1_000_000 + (MAX_VOICE_SECONDS + 30) * 1000);
    await expect(result.session.stop()).resolves.toMatchObject({ durationSeconds: MAX_VOICE_SECONDS });
  });

  it('un enregistreur sans fichier ne rend rien', async () => {
    const result = await startVoiceRecording();
    if (result.kind !== 'started') throw new Error('démarrage attendu');
    recorders[0]!.stop.mockImplementation(async () => undefined);
    await expect(result.session.stop()).resolves.toBeNull();
  });

  it('« cancel » arrête, libère et rend le micro, sans jamais rendre le fichier ; une erreur à l’arrêt ne remonte pas', async () => {
    const result = await startVoiceRecording();
    if (result.kind !== 'started') throw new Error('démarrage attendu');
    recorders[0]!.stop.mockRejectedValue(new Error('déjà arrêté'));

    await expect(result.session.cancel()).resolves.toBeUndefined();

    expect(recorders[0]?.release).toHaveBeenCalled();
    expect(setMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
  });

  it('une panne au démarrage rend le micro et ne lève rien', async () => {
    recorderCtor.mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(async () => {
        throw new Error('micro occupé');
      }),
      record: jest.fn(),
      stop: jest.fn(),
      release: jest.fn(),
    }));
    await expect(startVoiceRecording()).resolves.toEqual({ kind: 'error' });
    expect(setMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
  });

  it('la limite est de 2 minutes, celle du serveur', () => {
    expect(MAX_VOICE_SECONDS).toBe(120);
  });
});
