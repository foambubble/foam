'use strict';

const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const globals = require('globals');

module.exports = [
  // Global ignores
  {
    ignores: [
      '**/core/common/**',
      '**/*.js',
      'out/**',
      '.vscode-test/**',
      'webview-ui/**',
    ],
  },

  // typescript-eslint base setup: parser, plugin, and recommended rules
  ...tsPlugin.configs['flat/recommended'],

  // Main config for all TypeScript files
  {
    files: ['**/*.ts'],
    plugins: {
      import: importPlugin,
      jest: jestPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...jestPlugin.configs['flat/recommended'].languageOptions.globals,
        // Node 18+ globals not in the older globals package
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    settings: {
      'import/core-modules': ['vscode'],
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...jestPlugin.configs['flat/recommended'].rules,
      // base rules superseded by @typescript-eslint equivalents
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      // @typescript-eslint overrides
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      // import plugin
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/src/test/**', '**/src/**/*{test,spec}.ts'],
        },
      ],
    },
  },

  // Non-test source files: restrict direct `fs` usage
  {
    files: ['src/**/*.ts'],
    ignores: ['src/test/**', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'fs',
          message:
            'Extension code must not rely on Node.js filesystem, use vscode.workspace.fs instead.',
        },
      ],
    },
  },

  // Core test files: restrict vscode imports
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'vscode',
          message: 'Core submodule must not depend on VS Code.',
        },
      ],
    },
  },

  // Core non-test files: restrict both fs and vscode (overrides the two above)
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'fs',
          message:
            'Extension code must not rely on Node.js filesystem, use vscode.workspace.fs instead.',
        },
        {
          name: 'vscode',
          message: 'Core submodule must not depend on VS Code.',
        },
      ],
    },
  },
];
