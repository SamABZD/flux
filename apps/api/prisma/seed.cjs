const { resolve } = require('node:path');
const { Client } = require('pg');
const { createDemoData } = require('./demo-data.cjs');
const { seedTransfers } = require('./seed-transfers.cjs');
const { seedCards } = require('./seed-cards.cjs');
const { seedInsights } = require('./seed-insights.cjs');
require('dotenv').config({ path: resolve(__dirname, '../../../.env'), quiet: true });

async function seed({ reset = false } = {}) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Run npm run setup.');
  if (reset && process.env.ALLOW_DEMO_RESET !== 'scheduled-demo-reset') {
    throw new Error('Demo reset requires ALLOW_DEMO_RESET=scheduled-demo-reset.');
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const data = createDemoData();
  try {
    await client.connect();
    await client.query('BEGIN');
    if (reset) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('flux-demo-reset'))");
      const { rows } = await client.query(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
         ORDER BY tablename`,
      );
      if (rows.length) {
        const tables = rows
          .map(({ tablename }) => `"${String(tablename).replaceAll('"', '""')}"`)
          .join(', ');
        await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
      }
    }
    await client.query(
      'INSERT INTO "User" (id,name,email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
      [data.user.id, data.user.name, data.user.email],
    );
    for (const account of data.accounts)
      await client.query(
        'INSERT INTO "Account" (id,"userId",name,currency,"balanceMinor","openingBalanceMinor",identifier,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
        [
          account.id,
          account.userId,
          account.name,
          account.currency,
          account.balanceMinor,
          account.openingBalanceMinor,
          account.identifier,
          account.status,
        ],
      );
    for (const merchant of data.merchants)
      await client.query(
        'INSERT INTO "Merchant" (id,name,icon) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
        [merchant.id, merchant.name, merchant.icon],
      );
    for (const t of data.transactions)
      await client.query(
        'INSERT INTO "Transaction" (id,"accountId",currency,"merchantId","amountMinor",direction,kind,category,timestamp,status,"paymentMethod",location,reference,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO UPDATE SET "amountMinor"=EXCLUDED."amountMinor", "merchantId"=EXCLUDED."merchantId", notes=EXCLUDED.notes, timestamp=EXCLUDED.timestamp',
        [
          t.id,
          t.accountId,
          t.currency,
          t.merchantId,
          t.amountMinor,
          t.direction,
          t.kind,
          t.category,
          t.timestamp,
          t.status,
          t.paymentMethod,
          t.location,
          t.reference,
          t.notes,
        ],
      );
    await seedTransfers(client, data.user.id);
    await seedCards(client, data.user.id);
    await seedInsights(client, data.user.id);
    await client.query('COMMIT');
    console.log(
      reset
        ? `Demo reset complete: ${data.accounts.length} accounts and ${data.transactions.length} transactions restored.`
        : `Demo seed ready: ${data.accounts.length} accounts, ${data.transactions.length} transactions, ${data.merchants.length} merchants. Existing category edits are preserved.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
module.exports = { seed };

if (require.main === module) {
  seed().catch(() => {
    console.error('Seed failed. Check migrations, DATABASE_URL, and PostgreSQL availability.');
    process.exitCode = 1;
  });
}
