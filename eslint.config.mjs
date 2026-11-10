import js from '@eslint/js';
import tsPlugin from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  nextPlugin.configs.recommended,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
