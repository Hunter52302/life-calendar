import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_NAME__: 'readonly',
        __APP_VERSION__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // React Compiler is not enabled. Keep its compatibility diagnostics
      // visible without making established runtime patterns fail lint.
      'react-hooks/globals': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Node runtime code (Express server + maintenance scripts) — these use Node
    // globals like `process`, not browser globals.
    files: ['server/**/*.js', 'scripts/**/*.js', 'vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // PocketBase injects this migration DSL at runtime.
    files: ['pocketbase/pb_migrations/**/*.js'],
    languageOptions: {
      globals: {
        BoolField: 'readonly',
        Collection: 'readonly',
        DateField: 'readonly',
        EmailField: 'readonly',
        JSONField: 'readonly',
        NumberField: 'readonly',
        RelationField: 'readonly',
        SelectField: 'readonly',
        TextField: 'readonly',
        URLField: 'readonly',
        migrate: 'readonly',
      },
    },
    rules: {
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['public/sw-push.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Expo replaces process.env.EXPO_PUBLIC_* during bundling.
    files: ['mobile/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
])
