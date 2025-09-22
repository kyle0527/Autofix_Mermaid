export default [
  {
    ignores: [
      'js/vendor/**',
      '_backup_removed/**',
      'wasm/**',
      'assets/**',
      '**/*.min.js',
      'engine-src/**/dist/**',
      'docs/legacy/**',
      'DiagramMender_plus/**',
      'js/engine.browser.js',
      'js/ai/**'
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
