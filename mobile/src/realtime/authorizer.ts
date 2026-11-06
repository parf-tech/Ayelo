import { buildUrl } from '../api/client';
import type { ChannelAuthorizer } from './types';

type Options = {
  baseUrl: () => string | undefined;
  getToken: () => Promise<string | null>;
  getDeviceId: () => Promise<string>;
  fetchImpl?: typeof fetch;
};

/** Autorisation d'un canal privé : POST /api/v1/broadcasting/auth avec le jeton Sanctum (jamais stocké ailleurs que dans SecureStore). */
export function createChannelAuthorizer({ baseUrl, getToken, getDeviceId, fetchImpl }: Options): ChannelAuthorizer {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return async (socketId, channelName) => {
    const root = baseUrl();
    const token = await getToken();
    if (!root || !token) throw new Error('realtime authorization unavailable');
    const response = await doFetch(buildUrl(root, '/broadcasting/auth'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-Id': await getDeviceId(),
      },
      body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
    });
    if (!response.ok) throw new Error(`broadcasting auth refused (${response.status})`);
    return (await response.json()) as { auth: string; channel_data?: string };
  };
}
