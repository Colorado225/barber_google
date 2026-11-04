import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Configuration ESLint volontairement minimale (Lot 1) :
// on fait respecter les erreurs réelles (hooks React, variables inutilisées,
// code mort) sans inonder le dépôt de règles de style. Le typage des fichiers
// TypeScript est vérifié séparément par `npm run typecheck` (tsc --noEmit).
//
// Limite documentée : TypeScript 7 n'expose pas d'API de parsing publique et
// `typescript-eslint` n'est pas encore compatible avec cette version. Les
// fichiers .ts/.tsx sont donc ignorés par ESLint pour l'instant (ils restent
// analysés par `tsc` et Prettier). À réactiver avec `typescript-eslint` dès
// qu'une version compatible TS 7 sera publiée.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.ts', '**/*.tsx'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
    },
  },
];
