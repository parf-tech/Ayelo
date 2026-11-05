// Mock d'expo-router, sans import du code applicatif (évite un cycle avec helpers/app).
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const redirects: string[] = [];

export const expoRouterMock = {
  useRouter: () => router,
  Redirect: ({ href }: { href: string }) => {
    redirects.push(href);
    return null;
  },
};

export function resetRouterMocks() {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  redirects.length = 0;
}
