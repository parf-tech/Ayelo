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
    // Icônes : aucun import de lucide-react-native (racine ou sous-chemin) hors de src/ui/icons.ts.
    // Metro n'élague pas l'arbre : un import racine embarquerait toutes les icônes (docs/design/03-composants.md, 3).
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message: "Importer les icônes uniquement via src/ui/icons.ts (import icône par icône), puis utiliser <Icon />.",
            },
          ],
          patterns: [
            {
              group: ['lucide-react-native/*'],
              message: "Seul src/ui/icons.ts peut importer 'lucide-react-native/icons/<nom>'. Utiliser <Icon name=... />.",
            },
          ],
        },
      ],
    },
  },
  {
    // Le module d'enveloppe des icônes : import par icône autorisé, racine toujours interdite.
    files: ['src/ui/icons.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lucide-react-native', message: "Racine interdite : importer 'lucide-react-native/icons/<nom>'." },
          ],
          patterns: [
            {
              regex: '^lucide-react-native/(?!icons/[a-z0-9-]+$)',
              message: "Seul le chemin 'lucide-react-native/icons/<nom>' est autorisé.",
            },
          ],
        },
      ],
    },
  },
  {
    // Fichiers de configuration et mocks Jest (CommonJS).
    files: ['jest.setup.ts', '*.config.js', 'scripts/**', '__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
