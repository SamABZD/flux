const { createCredential } = require('./card-credentials.cjs');
async function seedCards(client, userId) {
  for (const [id, type, label, last4, limit] of [
    ['card-physical', 'PHYSICAL', 'Everyday', null, 150000],
    ['card-virtual', 'VIRTUAL', 'Online shopping', null, null],
    ['card-single-use', 'SINGLE_USE', 'One-time purchases', null, null],
  ]) {
    const exists = await client.query('SELECT id FROM "Card" WHERE id=$1', [id]);
    if (exists.rowCount) continue;
    const details = createCredential(id, process.env.CARD_ENCRYPTION_KEY, last4 ?? undefined);
    const physical = type === 'PHYSICAL';
    await client.query(
      'INSERT INTO "Card" (id,"userId",type,label,last4,"expiryMonth","expiryYear","monthlyLimitMinor","contactlessPayments","atmWithdrawals","updatedAt") VALUES ($1,$2,$3,$4,$5,8,2029,$6,$7,$7,now())',
      [id, userId, type, label, details.last4, limit, physical],
    );
    await client.query(
      'INSERT INTO "CardCredential" ("cardId","encryptedNumber","encryptedCvv","updatedAt") VALUES ($1,$2,$3,now())',
      [id, details.encryptedNumber, details.encryptedCvv],
    );
    await client.query(
      'INSERT INTO "CardAuditEvent" (id,"userId","cardId",action,metadata) VALUES ($1,$2,$3,\'CREATED\',$4)',
      [`seed:${id}`, userId, id, JSON.stringify({ type, source: 'demo-seed' })],
    );
  }
}
module.exports = { seedCards };
