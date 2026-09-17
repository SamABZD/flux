module.exports = {
  ...require('./jest.config.cjs'),
  displayName: 'api-integration',
  testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
  testTimeout: 15000,
};
