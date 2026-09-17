const { createHash } = require('node:crypto');
const hash = (value) => createHash('sha256').update(value).digest('hex');
async function seedInsights(client, userId) {
  for (const [category, amount] of [
    ['dining', 30000],
    ['groceries', 45000],
    ['shopping', 35000],
  ]) {
    const id = 'budget-' + category;
    if ((await client.query('SELECT id FROM "Budget" WHERE id=$1', [id])).rowCount) continue;

    if (
      (
        await client.query(
          'SELECT id FROM "Budget" WHERE "userId"=$1 AND category=$2 AND "archivedAt" IS NULL',
          [userId, category],
        )
      ).rowCount
    )
      continue;
    await client.query(
      'INSERT INTO "Budget" (id,"userId",category,currency,"createdMonth","createKey","requestHash","updatedAt") VALUES ($1,$2,$3,\'USD\',\'2026-04-01\',$1,$4,now())',
      [id, userId, category, hash(id)],
    );
    await client.query(
      'INSERT INTO "BudgetAllocation" (id,"budgetId",month,"amountMinor") VALUES ($1,$2,\'2026-04-01\',$3)',
      ['allocation-' + category, id, amount],
    );
  }
  for (const [merchantId, label, amount, day] of [
    ['spotify', 'Spotify', 1099, '04'],
    ['netflix', 'Netflix', 1549, '07'],
    ['apple-icloud', 'Apple iCloud', 299, '10'],
  ]) {
    const id = 'subscription-' + merchantId;
    if (
      (
        await client.query(
          'SELECT id FROM "Subscription" WHERE id=$1 OR ("userId"=$2 AND "accountId"=\'usd\' AND "merchantId"=$3 AND status<>\'CANCELLED\')',
          [id, userId, merchantId],
        )
      ).rowCount
    )
      continue;
    await client.query(
      'INSERT INTO "Subscription" (id,"userId","accountId","merchantId",label,currency,"amountMinor",cadence,"anchorDate",source,"createKey","requestHash","updatedAt") VALUES ($1,$2,\'usd\',$3,$4,\'USD\',$5,\'MONTHLY\',$6,\'DETECTED\',$1,$7,now())',
      [id, userId, merchantId, label, amount, '2026-04-' + day, hash(id)],
    );
  }
}
module.exports = { seedInsights };
