module.exports = [
  {
    // global ignore patterns
    ignores: [
      'js/vendor/**',
      'wasm/**',
      'assets/**',
      '**/*.min.js'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022
    },
    env: {
      browser: true,
      worker: true,
      es2022: true
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
