export interface Environment {
  DATABASE_URL: string;
  API_PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  SERVE_FRONTEND: boolean;
  FRONTEND_URL: string;
  CARD_ENCRYPTION_KEY: string;
}

function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required. Run npm run setup and configure .env.`);
  }
  return value;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const databaseUrl = requiredString(config, 'DATABASE_URL');
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !database.hostname ||
    database.pathname.length < 2
  ) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a database name.');
  }

  const portValue: unknown = config.PORT ?? config.API_PORT ?? '3001';
  const port = typeof portValue === 'string' && /^\d+$/.test(portValue) ? Number(portValue) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT or API_PORT must be between 1 and 65535.');

  const nodeEnvValue = config.NODE_ENV ?? 'development';
  if (
    typeof nodeEnvValue !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnvValue)
  )
    throw new Error('NODE_ENV must be development, test, or production.');
  const nodeEnv = nodeEnvValue as Environment['NODE_ENV'];

  const serveFrontendValue = config.SERVE_FRONTEND ?? 'false';
  if (typeof serveFrontendValue !== 'string' || !['true', 'false'].includes(serveFrontendValue))
    throw new Error('SERVE_FRONTEND must be true or false.');
  const serveFrontend = serveFrontendValue === 'true';

  const frontendUrl = requiredString(config, 'FRONTEND_URL');
  let frontend: URL;
  try {
    frontend = new URL(frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be an HTTP(S) origin.');
  }
  if (
    !['http:', 'https:'].includes(frontend.protocol) ||
    frontend.origin !== frontendUrl ||
    frontend.username ||
    frontend.password
  ) {
    throw new Error(
      'FRONTEND_URL must be an exact HTTP(S) origin without a path or trailing slash.',
    );
  }
  const cardKey = requiredString(config, 'CARD_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(cardKey))
    throw new Error('CARD_ENCRYPTION_KEY must be 32 bytes encoded as hex. Run npm run setup.');
  return {
    DATABASE_URL: databaseUrl,
    API_PORT: port,
    NODE_ENV: nodeEnv,
    SERVE_FRONTEND: serveFrontend,
    FRONTEND_URL: frontendUrl,
    CARD_ENCRYPTION_KEY: cardKey,
  };
}
