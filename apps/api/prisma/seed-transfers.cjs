const recipients = [
  [
    'maya-haddad',
    'Maya Haddad',
    'person',
    'FR',
    'EUR',
    'Banque Lumière',
    'DEMO-FR-MAYA-2401',
    '2026-09-13T10:00:00Z',
    'demo-clearing',
  ],
  [
    'jamie-lee',
    'Jamie Lee',
    'person',
    'GB',
    'GBP',
    'Northbank',
    'DEMO-GB-JAMIE-8024',
    '2026-09-12T09:00:00Z',
    'demo-clearing',
  ],
  [
    'omar-khalil',
    'Omar Khalil',
    'person',
    'AE',
    'AED',
    'Palm Bank',
    'DEMO-AE-OMAR-6382',
    '2026-09-10T14:00:00Z',
    'demo-clearing',
  ],
  [
    'sara-nasser',
    'Sara Nasser',
    'person',
    'LB',
    'USD',
    'Cedar Bank',
    'DEMO-LB-SARA-9145',
    '2026-09-08T11:00:00Z',
    'demo-clearing',
  ],
  [
    'leo-martin',
    'Léo Martin',
    'person',
    'FR',
    'EUR',
    'Banque Lumière',
    'DEMO-FR-LEO-7022',
    null,
    'demo-clearing',
  ],
  [
    'nour-studio',
    'Nour Studio',
    'business',
    'AE',
    'AED',
    'Emirates Demo Bank',
    'DEMO-AE-NOUR-3011',
    null,
    'demo-clearing',
  ],
  [
    'emma-wilson',
    'Emma Wilson',
    'person',
    'US',
    'USD',
    'Harbor Bank',
    'DEMO-US-EMMA-0634',
    null,
    'demo-clearing',
  ],
  [
    'daniel-weber',
    'Daniel Weber',
    'person',
    'DE',
    'EUR',
    'Rhein Bank',
    'DEMO-DE-DANIEL-4420',
    null,
    'demo-clearing',
  ],
  [
    'aisha-rahman',
    'Aisha Rahman',
    'person',
    'GB',
    'GBP',
    'Northbank',
    'DEMO-GB-AISHA-2248',
    null,
    'demo-clearing',
  ],
  [
    'atelier-lune',
    'Atelier Lune',
    'business',
    'FR',
    'EUR',
    'Banque Lumière',
    'DEMO-FR-LUNE-5942',
    null,
    'demo-clearing',
  ],
  [
    'lucas-visser',
    'Lucas Visser',
    'person',
    'NL',
    'EUR',
    'Canal Bank',
    'DEMO-NL-LUCAS-3104',
    null,
    'demo-clearing',
  ],
  [
    'test-bank',
    'Demo receiving bank',
    'business',
    'US',
    'USD',
    'Unavailable bank · demo failure',
    'DEMO-UNAVAILABLE-0001',
    null,
    'demo-unavailable',
  ],
];
async function seedTransfers(client, userId) {
  for (const [id, name, type, country, currency, bank, identifier, lastUsedAt, route] of recipients)
    await client.query(
      'INSERT INTO "Recipient" (id,"userId",name,type,country,"preferredCurrency","supportedCurrencies","bankName","accountIdentifier","lastUsedAt","bankRoute") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING',
      [id, userId, name, type, country, currency, [currency], bank, identifier, lastUsedAt, route],
    );
  for (const [currency, usdMicros] of Object.entries({
    USD: 1000000,
    EUR: 1100000,
    GBP: 1300000,
    AED: 272294,
  })) {
    await client.query(
      'INSERT INTO "FxRate" (currency,"usdMicros") VALUES ($1,$2) ON CONFLICT (currency) DO NOTHING',
      [currency, usdMicros],
    );
    for (const kind of ['fx', 'fee', 'external', 'opening'])
      await client.query(
        'INSERT INTO "LedgerAccount" (id,currency,kind) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
        [`${kind}:${currency}`, currency, kind],
      );
  }
  const { rows: accounts } = await client.query(
    'SELECT id,currency,"balanceMinor" FROM "Account" WHERE "userId"=$1',
    [userId],
  );
  for (const account of accounts) {
    await client.query(
      'INSERT INTO "LedgerAccount" (id,currency,kind,"accountId") VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [`customer:${account.id}`, account.currency, 'customer', account.id],
    );
    const journal = await client.query(
      'INSERT INTO "LedgerJournal" (id,reference) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING RETURNING id',
      [`opening:${account.id}`, `OPENING-${account.id}`],
    );
    if (journal.rowCount && account.balanceMinor !== 0) {
      for (const [suffix, ledgerId, amount] of [
        ['customer', `customer:${account.id}`, account.balanceMinor],
        ['contra', `opening:${account.currency}`, -account.balanceMinor],
      ])
        await client.query(
          'INSERT INTO "LedgerEntry" (id,"journalId","ledgerAccountId",currency,"amountMinor") VALUES ($1,$2,$3,$4,$5)',
          [
            `opening-${suffix}:${account.id}`,
            `opening:${account.id}`,
            ledgerId,
            account.currency,
            amount,
          ],
        );
    }
  }
}
module.exports = { seedTransfers };
