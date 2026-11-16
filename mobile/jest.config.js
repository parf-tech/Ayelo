/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  // Les tests d'ecrans rendent des arbres complets (Poppins, icones) : 5 s par defaut depassait sous charge (suite en parallele).
  testTimeout: 15000,
  // lucide-react-native : jest-expo résout la build ESM (.mjs) que Jest ne sait pas charger ; on pointe la build CommonJS.
  moduleNameMapper: {
    '^lucide-react-native/icons/(.+)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};
