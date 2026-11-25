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
  // Couverture (`npm run test:coverage`, et la CI) : TOUTES les sources comptent, y compris celles qu'aucun test ne charge (sans
  // `collectCoverageFrom`, Jest ne mesure que les fichiers requis par un test et gonfle le résultat). Le contrat généré est exclu.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', '!**/*.d.ts', '!src/api/openapi.d.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  // Seuil : environ 3 points SOUS la valeur mesurée le 2026-11-23 (instructions 88,75 %, branches 83,87 %, fonctions 84,92 %, lignes
  // 90,82 %), pour détecter une régression de la couverture sans bloquer sur le bruit. À relever quand elle monte ; jamais à abaisser
  // pour faire passer un changement. Ne s'applique que lorsque la couverture est collectée (`--coverage`).
  coverageThreshold: { global: { statements: 86, branches: 80, functions: 82, lines: 88 } },
};
