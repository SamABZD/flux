module.exports = {
  displayName: 'web',
  testEnvironment: '<rootDir>/test/environment.cjs',
  testTimeout: 15000,
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/test/polyfills.cjs'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          ...require('./tsconfig.json').compilerOptions,
          module: 'CommonJS',
          moduleResolution: 'Node',
          noEmit: false,
        },
      },
    ],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '\\.css$': '<rootDir>/test/style-mock.cjs' },
  clearMocks: true,
  globals: { __API_BASE_URL__: 'http://localhost:3001' },
};
