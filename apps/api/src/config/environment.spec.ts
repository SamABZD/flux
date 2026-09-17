import { validateEnvironment } from './environment';

const valid = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  API_PORT: '3001',
  FRONTEND_URL: 'http://localhost:3000',
  CARD_ENCRYPTION_KEY: '42'.repeat(32),
};

test('validates and coerces the API environment', () => {
  expect(validateEnvironment(valid)).toEqual({
    ...valid,
    API_PORT: 3001,
    NODE_ENV: 'development',
    SERVE_FRONTEND: false,
  });
});

test('enables the production frontend host explicitly', () => {
  expect(validateEnvironment({ ...valid, SERVE_FRONTEND: 'true' })).toMatchObject({
    SERVE_FRONTEND: true,
  });
});

test('rejects an invalid frontend hosting flag', () => {
  expect(() => validateEnvironment({ ...valid, SERVE_FRONTEND: 'yes' })).toThrow('SERVE_FRONTEND');
});

test('prefers the provider PORT and validates production mode', () => {
  expect(validateEnvironment({ ...valid, PORT: '8080', NODE_ENV: 'production' })).toMatchObject({
    API_PORT: 8080,
    NODE_ENV: 'production',
  });
});

test('rejects an unknown NODE_ENV', () => {
  expect(() => validateEnvironment({ ...valid, NODE_ENV: 'preview' })).toThrow('NODE_ENV');
});
test.each(['', 'short', 'g'.repeat(64)])(
  'rejects an invalid synthetic-card key',
  (CARD_ENCRYPTION_KEY) => {
    expect(() => validateEnvironment({ ...valid, CARD_ENCRYPTION_KEY })).toThrow(
      'CARD_ENCRYPTION_KEY',
    );
  },
);

test.each(['', 'abc', '0', '65536', '3001.5'])('rejects invalid port %s', (API_PORT) => {
  expect(() => validateEnvironment({ ...valid, API_PORT })).toThrow('API_PORT');
});

test.each(['', 'invalid', 'https://localhost/db', 'postgresql://localhost'])(
  'rejects invalid database URL %s',
  (DATABASE_URL) => {
    expect(() => validateEnvironment({ ...valid, DATABASE_URL })).toThrow('DATABASE_URL');
  },
);

test.each([
  '*',
  'http://localhost:3000/path',
  'http://localhost:3000/',
  'http://user:password@localhost:3000',
])('rejects invalid CORS origin %s', (FRONTEND_URL) => {
  expect(() => validateEnvironment({ ...valid, FRONTEND_URL })).toThrow('FRONTEND_URL');
});
