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
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Empty catch is a deliberate pattern here — best-effort Web Audio /
      // localStorage calls that must never throw (e.g. private browsing).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Build/config files run in Node, not the browser — give them Node globals
  // (e.g. `process`) so they don't trip no-undef.
  {
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
