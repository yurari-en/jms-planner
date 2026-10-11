import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'public', 'scripts', 'coverage', 'tests/reference'],
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.worker },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactRefresh.configs.vite()],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
