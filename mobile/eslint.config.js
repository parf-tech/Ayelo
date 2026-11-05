const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'coverage/**', 'assets/**'],
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Fichiers de configuration et mocks Jest (CommonJS).
    files: ['jest.setup.ts', '*.config.js', '__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
