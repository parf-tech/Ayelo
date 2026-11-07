import { AccessibilityInfo } from 'react-native';

// Mocks communs : stockage sécurisé en mémoire, localisation, identifiants aléatoires, zones sûres.
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => (mockStore.has(key) ? (mockStore.get(key) as string) : null)),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  __store: mockStore,
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'fr', languageTag: 'fr-FR' }]),
}));

let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => {
    mockUuidCounter += 1;
    const n = String(mockUuidCounter).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }),
  getRandomBytes: jest.fn((n: number) => new Uint8Array(require('crypto').randomBytes(n))),
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => require('crypto').createHash('sha256').update(data).digest('hex')),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Les animations en boucle (Skeleton) empêcheraient act() de se terminer : on simule « réduire les animations ».
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
