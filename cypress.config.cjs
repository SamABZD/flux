const { defineConfig } = require('cypress');
const { Client } = require('pg');
module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: '.local/e2e/cypress-screenshots',
  viewportWidth: 1440,
  viewportHeight: 1000,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  responseTimeout: 30000,
  retries: 0,
  e2e: {
    baseUrl: 'http://localhost:3200',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    testIsolation: true,
    setupNodeEvents(on) {
      const url = process.env.FLUX_E2E_DATABASE_URL;
      if (!url || !/^\/flux_e2e_[a-f0-9]{16}$/.test(new URL(url).pathname))
        throw new Error('Run npm run test:e2e to create an isolated test database');
      async function query(sql, args = []) {
        const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
        await client.connect();
        try {
          return (await client.query(sql, args)).rows;
        } finally {
          await client.end();
        }
      }
      on('task', {
        async setHistorySize(size) {
          if (![500, 1000, 5000].includes(size))
            throw new Error('Unsupported performance fixture size');
          await query('DELETE FROM "Transaction" WHERE id LIKE \'performance:%\'');
          const [{ count }] = await query('SELECT COUNT(*)::int AS count FROM "Transaction"');
          await query(
            "INSERT INTO \"Merchant\" (id,name,icon) VALUES ('performance','Scale merchant','shopping') ON CONFLICT (id) DO NOTHING",
          );
          await query(
            `INSERT INTO "Transaction" (id,"accountId",currency,"merchantId","amountMinor",direction,kind,category,timestamp,status,"paymentMethod",location,reference,notes)
            SELECT 'performance:'||i,'usd','USD','performance',100,'debit','purchase','shopping',now()-i*interval '1 second','failed','card','Demo','SCALE-'||i,CASE WHEN i%7=0 THEN 'performance needle' ELSE 'scale fixture' END FROM generate_series(1,$1::int) i`,
            [size - count],
          );
          return { total: size, added: size - count };
        },
        async accountState(id) {
          const [account] = await query('SELECT "balanceMinor" FROM "Account" WHERE id=$1', [id]);
          return account;
        },
        async transferByKey(key) {
          const rows = await query(
            'SELECT id,status,"totalDebitMinor",reference FROM "Transfer" WHERE "idempotencyKey"=$1',
            [key],
          );
          return rows;
        },
        async expireQuote(id) {
          await query(
            'UPDATE "TransferQuote" SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',
            [id],
          );
          return null;
        },
        async financialIntegrity() {
          const unbalanced = await query(
            'SELECT "journalId",currency FROM "LedgerEntry" GROUP BY "journalId",currency HAVING SUM("amountMinor")<>0',
          );
          const mismatch = await query(
            'SELECT a.id FROM "Account" a JOIN "LedgerAccount" l ON l."accountId"=a.id JOIN "LedgerEntry" e ON e."ledgerAccountId"=l.id GROUP BY a.id HAVING a."balanceMinor"<>SUM(e."amountMinor")',
          );
          return { unbalanced, mismatch };
        },
      });
    },
  },
});
