module.exports = [
  {
    ignores: [
  'js/vendor/**',
  '_backup_removed/**',
      'wasm/**',
      'assets/**',
      '**/*.min.js'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        self: 'readonly',
        importScripts: 'readonly'
      }
    },
    rules: {
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-implicit-globals': 'warn',
      'no-unused-vars': ['warn', { 'varsIgnorePattern': '^_' }],
      'no-restricted-globals': ['error', 'event', 'fdescribe']
    }
  }
];
