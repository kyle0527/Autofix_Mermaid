/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
        diagnostics: false
      }
    ]
  },
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__']
};/** @type {import('jest').Config} */
module.exports = {
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  testEnvironment: 'node'
};