import { renderHook } from '@testing-library/react-native';
import { ApiError } from '../src/api/errors';
import { useMessageImages } from '../src/features/messages/useMessageImages';

/** Adresses de lecture des images : mises en mémoire jusqu'à une minute avant leur expiration, jamais plus longtemps. */

const mockAuth = { api: { messaging: { messageMedia: jest.fn() } } };
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));

const messageMedia = mockAuth.api.messaging.messageMedia;
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeEach(() => messageMedia.mockReset());

describe('useMessageImages', () => {
  it('garde l’adresse en mémoire tant qu’elle a plus d’une minute devant elle', async () => {
    messageMedia.mockResolvedValue({ url: 'https://s/1', expires_at: inMs(10 * 60_000) });
    const { result } = await renderHook(() => useMessageImages('c1'));
    await expect(result.current('m1')).resolves.toBe('https://s/1');
    await expect(result.current('m1')).resolves.toBe('https://s/1');
    expect(messageMedia).toHaveBeenCalledTimes(1);
    expect(messageMedia).toHaveBeenCalledWith('c1', 'm1');
  });

  it('redemande une adresse qui expire dans moins d’une minute, ou déjà expirée', async () => {
    messageMedia
      .mockResolvedValueOnce({ url: 'https://s/short', expires_at: inMs(30_000) })
      .mockResolvedValueOnce({ url: 'https://s/fresh', expires_at: inMs(10 * 60_000) });
    const { result } = await renderHook(() => useMessageImages('c1'));
    await expect(result.current('m1')).resolves.toBe('https://s/short');
    await expect(result.current('m1')).resolves.toBe('https://s/fresh');
    expect(messageMedia).toHaveBeenCalledTimes(2);
  });

  it('une date d’expiration illisible n’est jamais gardée', async () => {
    messageMedia.mockResolvedValue({ url: 'https://s/x', expires_at: 'pas une date' });
    const { result } = await renderHook(() => useMessageImages('c1'));
    await result.current('m1');
    await result.current('m1');
    expect(messageMedia).toHaveBeenCalledTimes(2);
  });

  it('« force » ignore la mémoire (image qui ne se charge plus)', async () => {
    messageMedia
      .mockResolvedValueOnce({ url: 'https://s/1', expires_at: inMs(10 * 60_000) })
      .mockResolvedValueOnce({ url: 'https://s/2', expires_at: inMs(10 * 60_000) });
    const { result } = await renderHook(() => useMessageImages('c1'));
    await result.current('m1');
    await expect(result.current('m1', true)).resolves.toBe('https://s/2');
    await expect(result.current('m1')).resolves.toBe('https://s/2');
    expect(messageMedia).toHaveBeenCalledTimes(2);
  });

  it('deux affichages simultanés de la même image partagent une seule demande', async () => {
    let release: (value: unknown) => void = () => undefined;
    messageMedia.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useMessageImages('c1'));
    const first = result.current('m1');
    const second = result.current('m1');
    release({ url: 'https://s/1', expires_at: inMs(10 * 60_000) });
    await expect(Promise.all([first, second])).resolves.toEqual(['https://s/1', 'https://s/1']);
    expect(messageMedia).toHaveBeenCalledTimes(1);
  });

  it('un échec n’est pas mis en mémoire : l’appel suivant réessaie', async () => {
    messageMedia
      .mockRejectedValueOnce(new ApiError({ status: 409, code: 'media_pending', message: 'x' }))
      .mockResolvedValueOnce({ url: 'https://s/ok', expires_at: inMs(10 * 60_000) });
    const { result } = await renderHook(() => useMessageImages('c1'));
    await expect(result.current('m1')).rejects.toMatchObject({ code: 'media_pending' });
    await expect(result.current('m1')).resolves.toBe('https://s/ok');
  });

  it('une autre conversation repart d’une mémoire vide', async () => {
    messageMedia.mockResolvedValue({ url: 'https://s/1', expires_at: inMs(10 * 60_000) });
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useMessageImages(id), { initialProps: { id: 'c1' } });
    await result.current('m1');
    await rerender({ id: 'c2' });
    await result.current('m1');
    expect(messageMedia).toHaveBeenCalledTimes(2);
    expect(messageMedia).toHaveBeenLastCalledWith('c2', 'm1');
  });
});
