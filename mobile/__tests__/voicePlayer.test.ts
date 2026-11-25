import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { createVoicePlayer } from '../src/media/voicePlayer';

/** Lecteur d'une note vocale : source, mode silencieux, suivi, reprise après la fin, libération. */

type Listener = (status: { playing: boolean; currentTime: number; duration: number; didJustFinish: boolean }) => void;

let listener: Listener = () => undefined;
const remove = jest.fn();
const fake = {
  play: jest.fn(),
  pause: jest.fn(),
  release: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  addListener: jest.fn((_event: string, l: Listener) => {
    listener = l;
    return { remove };
  }),
};

beforeEach(() => {
  (createAudioPlayer as jest.Mock).mockReturnValue(fake);
  (setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('createVoicePlayer', () => {
  it('lit l’adresse signée, même en mode silencieux, sans micro', () => {
    createVoicePlayer('https://s/get/a1', jest.fn());
    expect(createAudioPlayer).toHaveBeenCalledWith({ uri: 'https://s/get/a1' });
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, allowsRecording: false });
  });

  it('traduit l’état du lecteur natif (position, durée, fin)', () => {
    const onUpdate = jest.fn();
    createVoicePlayer('https://s/get/a1', onUpdate);
    listener({ playing: true, currentTime: 2.5, duration: 10, didJustFinish: false });
    expect(onUpdate).toHaveBeenLastCalledWith({ playing: true, position: 2.5, duration: 10, finished: false });
    listener({ playing: false, currentTime: 10, duration: 10, didJustFinish: true });
    expect(onUpdate).toHaveBeenLastCalledWith({ playing: false, position: 10, duration: 10, finished: true });
  });

  it('lecture et pause sont relayées', () => {
    const player = createVoicePlayer('https://s/get/a1', jest.fn());
    player.play();
    player.pause();
    expect(fake.play).toHaveBeenCalledTimes(1);
    expect(fake.pause).toHaveBeenCalledTimes(1);
  });

  it('après la fin, « play » revient au début avant de relancer', async () => {
    const player = createVoicePlayer('https://s/get/a1', jest.fn());
    listener({ playing: false, currentTime: 10, duration: 10, didJustFinish: true });
    player.play();
    expect(fake.seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.play).toHaveBeenCalledTimes(1);
  });

  it('« release » détache l’écoute puis libère le lecteur natif', () => {
    createVoicePlayer('https://s/get/a1', jest.fn()).release();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(fake.release).toHaveBeenCalledTimes(1);
  });
});
