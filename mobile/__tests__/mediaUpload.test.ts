import { createApiClient } from '../src/api/client';
import { createEndpoints } from '../src/api/endpoints';
import { resolveMediaMime, uploadMedia } from '../src/media/upload';
import { installFakeApi } from './helpers/fakeApi';

/** Dépôt d'un média : formats acceptés selon le type (image, note vocale, vidéo) et durée déclarée au serveur. */

const blobResponse = (size: number) => ({ ok: true, status: 200, blob: async () => ({ size }) }) as unknown as Response;
const api = () => createEndpoints(createApiClient({ baseUrl: 'https://api.example.test', getDeviceId: async () => 'd', getToken: async () => 'T' }));

describe('resolveMediaMime', () => {
  const AUDIO = ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg'];
  const VIDEO = ['video/mp4', 'video/quicktime'];

  it.each([
    [{ uri: 'file:///a.m4a', mimeType: null }, AUDIO, 'audio/mp4'],
    [{ uri: 'file:///a.m4a?x=1', mimeType: null }, AUDIO, 'audio/mp4'],
    [{ uri: 'file:///a', mimeType: 'audio/x-m4a' }, AUDIO, 'audio/x-m4a'],
    [{ uri: 'file:///a.mp3', mimeType: null }, AUDIO, 'audio/mpeg'],
    [{ uri: 'file:///v.mov', mimeType: null }, VIDEO, 'video/quicktime'],
    [{ uri: 'file:///v', mimeType: 'VIDEO/MP4' }, VIDEO, 'video/mp4'],
    [{ uri: 'file:///v.mp4', mimeType: null }, VIDEO, 'video/mp4'],
  ])('%j accepté : %s', (file, allowed, expected) => {
    expect(resolveMediaMime(file, allowed)).toBe(expected);
  });

  it.each([
    [{ uri: 'file:///v.webm', mimeType: null }, ['video/mp4', 'video/quicktime']],
    [{ uri: 'file:///a.mp4', mimeType: 'video/mp4' }, ['audio/mp4']],
    [{ uri: 'file:///a.wav', mimeType: null }, ['audio/mp4']],
    [{ uri: 'file:///x.jpg', mimeType: null }, ['video/mp4']],
    [{ uri: 'file:///x', mimeType: 'application/octet-stream' }, ['video/mp4']],
  ])('%j refusé', (file, allowed) => {
    expect(resolveMediaMime(file, allowed)).toBeNull();
  });
});

describe('uploadMedia, notes vocales et vidéos', () => {
  const routes = (mediaId: string) => ({
    'POST /media/upload-url': [201, { media_id: mediaId, upload: { url: 'https://storage.example.test/put', headers: {} } }],
    'PUT https://storage.example.test/put': [200, {}],
    [`POST /media/${mediaId}/complete`]: [200, { media_id: mediaId, status: 'processing' }],
  });

  it('une note vocale : type audio/mp4 déduit du fichier, kind et durée envoyés', async () => {
    const fake = installFakeApi({ 'GET file:///v.m4a': blobResponse(900_000), ...routes('a1') } as never);
    const result = await uploadMedia(api(), { kind: 'message_voice', image: { uri: 'file:///v.m4a', mimeType: null, fileSize: null }, durationSeconds: 42 });
    expect(result).toEqual({ media_id: 'a1', status: 'processing' });
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_voice', mime_type: 'audio/mp4', size_bytes: 900_000, duration_seconds: 42 });
  });

  it('une vidéo iPhone : video/quicktime', async () => {
    const fake = installFakeApi({ 'GET file:///v.mov': blobResponse(5_000_000), ...routes('v1') } as never);
    await uploadMedia(api(), { kind: 'message_video', image: { uri: 'file:///v.mov', mimeType: 'video/quicktime', fileSize: null }, durationSeconds: 12 });
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_video', mime_type: 'video/quicktime', size_bytes: 5_000_000, duration_seconds: 12 });
  });

  it('sans durée, aucun champ duration_seconds (photos)', async () => {
    const fake = installFakeApi({ 'GET file:///p.jpg': blobResponse(100), ...routes('p1') } as never);
    await uploadMedia(api(), { kind: 'message_image', image: { uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileSize: null } });
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_image', mime_type: 'image/jpeg', size_bytes: 100 });
  });

  it.each([
    ['message_voice', 'file:///v.mp4', 'video/mp4'],
    ['message_video', 'file:///a.m4a', 'audio/mp4'],
    ['message_image', 'file:///v.mp4', 'video/mp4'],
  ] as const)('%s : un fichier du mauvais type est refusé avant tout appel', async (kind, uri, mimeType) => {
    const fake = installFakeApi({} as never);
    await expect(uploadMedia(api(), { kind, image: { uri, mimeType, fileSize: null } })).rejects.toMatchObject({ code: 'unsupported_format' });
    expect(fake.calls).toHaveLength(0);
  });
});
