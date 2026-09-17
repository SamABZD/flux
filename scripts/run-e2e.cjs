const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { readFile, mkdir, writeFile, copyFile } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Client } = require('pg');
require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });

const root = resolve(__dirname, '..');
const output = resolve(root, '.local/e2e');
const webRoot = resolve(output, 'web');
const apiRoot = resolve(output, 'api');
const databaseName = `flux_e2e_${randomBytes(8).toString('hex')}`;
const sourceUrl = new URL(process.env.DATABASE_URL);
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = '/' + databaseName;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl.href,
  FLUX_E2E_DATABASE_URL: databaseUrl.href,
  API_PORT: '3201',
  WEB_API_BASE_URL: 'http://localhost:3201',
  FRONTEND_URL: 'http://localhost:3200',
  CARD_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
};
let api;
let server;
let created = false;
const admin = new Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 5000 });
function run(script, args, cwd = root) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? done() : reject(new Error(`Validation command exited ${code}`)),
    );
  });
}
async function ready(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (api?.exitCode !== null && api?.exitCode !== undefined)
      throw new Error('Isolated API stopped before readiness');
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch (error) {
      void error;
    }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error('Isolated API did not become ready');
}
async function main() {
  await mkdir(output, { recursive: true });
  await admin.connect();
  if (!/^flux_e2e_[a-f0-9]{16}$/.test(databaseName) || sourceUrl.pathname === databaseUrl.pathname)
    throw new Error('Unsafe test database name');
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await run(
    require.resolve('prisma/build/index.js'),
    ['migrate', 'deploy'],
    resolve(root, 'apps/api'),
  );
  await run(resolve(root, 'apps/api/prisma/seed.cjs'), []);
  await run(
    require.resolve('typescript/bin/tsc'),
    ['-p', 'tsconfig.build.json', '--outDir', apiRoot],
    resolve(root, 'apps/api'),
  );
  const prismaRuntime = resolve(output, 'prisma');
  await mkdir(prismaRuntime, { recursive: true });
  await copyFile(
    resolve(root, 'apps/api/prisma/card-credentials.cjs'),
    resolve(prismaRuntime, 'card-credentials.cjs'),
  );
  await run(
    require.resolve('webpack-cli/bin/cli.js'),
    [
      '--mode',
      'production',
      '--output-path',
      webRoot,
      '--json=' + resolve(output, 'webpack-stats.json'),
    ],
    resolve(root, 'apps/web'),
  );
  await run(resolve(root, 'scripts/report-bundle.cjs'), []);
  api = spawn(process.execPath, [resolve(apiRoot, 'main.js')], {
    cwd: root,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  api.on('error', (error) => {
    process.stderr.write(error.message + '\n');
  });
  await ready('http://localhost:3201/health');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let target = resolve(webRoot, '.' + pathname);
      if (target !== webRoot && !target.startsWith(webRoot + sep)) {
        response.writeHead(403).end();
        return;
      }
      if (!extname(pathname)) target = resolve(webRoot, 'index.html');
      const body = await readFile(target);
      response.writeHead(200, {
        'Content-Type': mime[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  server.listen(3200, 'localhost');
  await once(server, 'listening');
  process.env.FLUX_E2E_DATABASE_URL = databaseUrl.href;
  const result = await require('cypress').run({
    project: root,
    browser: 'chrome',
    headless: true,
    ...(process.argv[2] ? { spec: process.argv[2] } : {}),
  });
  const report =
    'totalTests' in result
      ? {
          tests: result.totalTests,
          passed: result.totalPassed,
          failed: result.totalFailed,
          durationMs: result.totalDuration,
          runs: result.runs.map((item) => ({ spec: item.spec.relative, stats: item.stats })),
        }
      : { error: result.message, failed: 1 };
  await writeFile(resolve(output, 'cypress-report.json'), JSON.stringify(report, null, 2));
  if (report.failed) throw new Error(`Cypress failed: ${report.failed}`);
}
main()
  .catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    if (api && api.exitCode === null) {
      const exited = once(api, 'exit');
      api.kill();
      await exited;
    }
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  });
