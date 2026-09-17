const { spawn } = require('node:child_process');
const { copyFile, mkdir, readFile, readdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });

const root = resolve(__dirname, '..');
const output = resolve(root, '.local/production');
const apiOutput = resolve(output, 'api');
const databaseName = `flux_production_${randomBytes(8).toString('hex')}`;
const sourceUrl = new URL(process.env.DATABASE_URL);
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = '/' + databaseName;
const port = 3301;
const frontendOrigin = 'http://localhost:3300';
const cardKey = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl.href,
  PORT: String(port),
  API_PORT: '3999',
  NODE_ENV: 'production',
  SERVE_FRONTEND: 'true',
  FRONTEND_URL: frontendOrigin,
  CARD_ENCRYPTION_KEY: cardKey,
};
const admin = new Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 5000 });
let database;
let api;
let created = false;

function run(script, args, cwd = root, overrides = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: { ...env, ...overrides },
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? done() : reject(new Error(`Validation command exited ${code}`)),
    );
  });
}

function runExpectingFailure(script, overrides = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: { ...env, ...overrides },
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => (code ? done() : reject(new Error('Unsafe reset was accepted'))));
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (api?.exitCode !== null && api?.exitCode !== undefined)
      throw new Error('Production API stopped before readiness');
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch (error) {
      void error;
    }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error('Production API did not become ready');
}

async function javascriptAssets(directory) {
  const names = await readdir(directory);
  return Promise.all(
    names
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFile(resolve(directory, name), 'utf8')),
  );
}

async function main() {
  if (
    !/^flux_production_[a-f0-9]{16}$/.test(databaseName) ||
    sourceUrl.pathname === databaseUrl.pathname
  )
    throw new Error('Unsafe production verification database name');
  await mkdir(output, { recursive: true });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await run(
    require.resolve('prisma/build/index.js'),
    ['migrate', 'deploy'],
    resolve(root, 'apps/api'),
  );
  await run(resolve(root, 'apps/api/prisma/seed.cjs'), []);

  database = new Client({ connectionString: databaseUrl.href, connectionTimeoutMillis: 5000 });
  await database.connect();
  await database.query('UPDATE "Account" SET "balanceMinor"=1 WHERE id=\'usd\'');
  await database.query(
    `INSERT INTO "DemoSession" ("tokenHash","userId","expiresAt")
     VALUES ($1,'demo-alex',now() + interval '1 day')`,
    ['f'.repeat(64)],
  );
  await runExpectingFailure(resolve(root, 'apps/api/prisma/reset-demo.cjs'), {
    ALLOW_DEMO_RESET: '',
  });
  const unchanged = await database.query('SELECT "balanceMinor" FROM "Account" WHERE id=\'usd\'');
  if (unchanged.rows[0].balanceMinor !== 1) throw new Error('Rejected reset changed demo data');
  await run(resolve(root, 'apps/api/prisma/reset-demo.cjs'), [], root, {
    ALLOW_DEMO_RESET: 'scheduled-demo-reset',
  });

  const counts = await database.query(
    `SELECT
      (SELECT count(*)::int FROM "Account") accounts,
      (SELECT count(*)::int FROM "Transaction") transactions,
      (SELECT count(*)::int FROM "DemoSession") sessions`,
  );
  const balances = await database.query(
    `SELECT currency, sum("amountMinor")::int total
     FROM "LedgerEntry" GROUP BY currency ORDER BY currency`,
  );
  if (
    counts.rows[0].accounts !== 4 ||
    counts.rows[0].transactions !== 444 ||
    counts.rows[0].sessions !== 0 ||
    balances.rows.some(({ total }) => total !== 0)
  ) {
    throw new Error('Demo reset did not restore the canonical reconciled baseline');
  }

  await run(
    require.resolve('webpack-cli/bin/cli.js'),
    ['--mode', 'production'],
    resolve(root, 'apps/web'),
    { WEB_API_BASE_URL: '/api' },
  );
  await run(
    require.resolve('typescript/bin/tsc'),
    ['-p', 'tsconfig.build.json', '--outDir', apiOutput],
    resolve(root, 'apps/api'),
  );
  const prismaRuntime = resolve(output, 'prisma');
  await mkdir(prismaRuntime, { recursive: true });
  await copyFile(
    resolve(root, 'apps/api/prisma/card-credentials.cjs'),
    resolve(prismaRuntime, 'card-credentials.cjs'),
  );
  api = spawn(process.execPath, [resolve(apiOutput, 'main.js')], {
    cwd: root,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  await waitForHealth();

  for (const route of [
    '/home',
    '/accounts',
    '/transactions',
    '/payments',
    '/cards',
    '/analytics',
    '/budgets',
    '/subscriptions',
  ]) {
    const response = await fetch(`http://localhost:${port}${route}`, {
      headers: { Accept: 'text/html' },
    });
    if (!response.ok || !/<div id=(?:"root"|root)><\/div>/.test(await response.text()))
      throw new Error(`Production SPA deep link failed: ${route}`);
  }

  const sessionResponse = await fetch(`http://localhost:${port}/api/session/demo`, {
    method: 'POST',
    headers: {
      Origin: frontendOrigin,
      'X-Flux-Client': 'web',
      'X-Forwarded-Proto': 'https',
    },
  });
  const setCookie = sessionResponse.headers.get('set-cookie') ?? '';
  if (!sessionResponse.ok || !setCookie.includes('HttpOnly') || !setCookie.includes('Secure'))
    throw new Error('Production demo session cookie is not secure');
  const cookie = setCookie.split(';', 1)[0];
  const accountsResponse = await fetch(`http://localhost:${port}/api/accounts`, {
    headers: { Cookie: cookie, Origin: frontendOrigin, 'X-Flux-Client': 'web' },
  });
  const accounts = await accountsResponse.json();
  if (!accountsResponse.ok || accounts.items?.length !== 4)
    throw new Error('Production demo session could not read the four accounts');
  const missingResponse = await fetch(`http://localhost:${port}/api/definitely-missing`);
  const missingBody = await missingResponse.text();
  if (missingResponse.status !== 404 || /stack|node_modules|database_url/i.test(missingBody))
    throw new Error('Production error response exposed internal details');

  const webAssets = (await javascriptAssets(resolve(root, 'apps/web/dist'))).join('\n');
  for (const secret of [sourceUrl.password, databaseUrl.password, cardKey].filter(Boolean)) {
    if (webAssets.includes(secret)) throw new Error('A server secret appeared in the web bundle');
  }
  if (!webAssets.includes('/api'))
    throw new Error('Web bundle does not target the same-origin API path');

  const report = {
    status: 'passed',
    database: {
      migrations: 'all committed migrations applied',
      accounts: counts.rows[0].accounts,
      transactions: counts.rows[0].transactions,
      ledgerTotals: balances.rows,
      guardedReset: true,
    },
    api: { health: 200, demoSession: 200, accounts: accounts.items.length, safe404: true },
    spa: { deepLinks: 8, fallback: true },
    web: { sameOriginApiPath: '/api', serverSecretsFound: 0 },
  };
  await writeFile(resolve(output, 'production-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (api) {
      api.kill();
      await new Promise((done) => setTimeout(done, 250));
    }
    if (database) await database.end().catch(() => undefined);
    if (created) {
      await admin
        .query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [
          databaseName,
        ])
        .catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
  });
