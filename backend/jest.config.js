module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  setupFiles: ['<rootDir>/test/setupTestEnv.js'],
  // EmotionAnalysisService schedules a 60s re-check timer the first time
  // checkLocalModel() runs; forceExit keeps that (and similarly any stray
  // handle from a route under test) from holding the test process open.
  forceExit: true,
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/python_services/'],
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!services/**/__tests__/**',
    '!services/**/*.test.js',
    '!python_services/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
};
