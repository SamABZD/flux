const DEMO_DATE = '2026-09-14T12:00:00.000Z';
const USER = { id: 'demo-alex', name: 'Alex Morgan', email: 'demo@flux.example' };
const ACCOUNTS = [
  {
    id: 'usd',
    name: 'Everyday dollar',
    currency: 'USD',
    balanceMinor: 482040,
    identifier: 'DEMO · USD · 0842',
  },
  {
    id: 'eur',
    name: 'Euro account',
    currency: 'EUR',
    balanceMinor: 284012,
    identifier: 'DEMO · EUR · 1906',
  },
  {
    id: 'gbp',
    name: 'Sterling account',
    currency: 'GBP',
    balanceMinor: 142082,
    identifier: 'DEMO · GBP · 3721',
  },
  {
    id: 'aed',
    name: 'Dirham account',
    currency: 'AED',
    balanceMinor: 794000,
    identifier: 'DEMO · AED · 5604',
  },
];

const catalog = [
  ['Roadster', 'dining', 1450, 5800, ['USD'], 'Beirut, Lebanon', 'dining'],
  ['Zaatar w Zeit', 'dining', 600, 2400, ['USD'], 'Beirut, Lebanon', 'dining'],
  ['Tawlet', 'dining', 1800, 5200, ['USD'], 'Beirut, Lebanon', 'dining'],
  ['Urbanista', 'dining', 480, 2700, ['USD'], 'Beirut, Lebanon', 'coffee'],
  ['Spinneys', 'groceries', 2450, 12500, ['USD'], 'Beirut, Lebanon', 'groceries'],
  ['Le Charcutier', 'groceries', 1100, 9600, ['USD'], 'Beirut, Lebanon', 'groceries'],
  ['Uber', 'transport', 450, 3300, ['USD', 'EUR', 'GBP'], 'Local ride', 'transport'],
  ['Careem', 'transport', 800, 12000, ['USD', 'AED'], 'Local ride', 'transport'],
  ['Starbucks', 'dining', 420, 2400, ['USD', 'GBP', 'AED'], 'Coffee & a break', 'coffee'],
  ['Amazon', 'shopping', 1299, 22000, ['USD', 'EUR', 'GBP', 'AED'], 'Online', 'shopping'],
  ['Apple', 'shopping', 1900, 29900, ['USD', 'EUR', 'GBP', 'AED'], 'Online', 'shopping'],
  ['Decathlon', 'shopping', 1290, 14900, ['EUR', 'GBP', 'AED'], 'In store', 'shopping'],
  ['Uniqlo', 'shopping', 1990, 12500, ['EUR', 'GBP'], 'In store', 'shopping'],
  ['Carrefour', 'groceries', 1800, 18500, ['EUR', 'AED'], 'In store', 'groceries'],
  ['Monoprix', 'groceries', 1290, 9500, ['EUR'], 'Paris, France', 'groceries'],
  ['Boulangerie Utopie', 'dining', 380, 2400, ['EUR'], 'Paris, France', 'coffee'],
  ['Café Kitsuné', 'dining', 550, 2900, ['EUR'], 'Paris, France', 'coffee'],
  ['Le Petit Marché', 'dining', 2100, 6900, ['EUR'], 'Paris, France', 'dining'],
  ['SNCF Connect', 'travel', 2200, 18000, ['EUR'], 'France', 'travel'],
  ['RATP', 'transport', 250, 1800, ['EUR'], 'Paris, France', 'transport'],
  ['Galeries Lafayette', 'shopping', 2500, 23000, ['EUR'], 'Paris, France', 'shopping'],
  ['Tesco', 'groceries', 1200, 8300, ['GBP'], 'London, United Kingdom', 'groceries'],
  ['Waitrose', 'groceries', 1900, 11600, ['GBP'], 'London, United Kingdom', 'groceries'],
  ['Pret A Manger', 'dining', 450, 1800, ['GBP'], 'London, United Kingdom', 'coffee'],
  ['Dishoom', 'dining', 2800, 7800, ['GBP'], 'London, United Kingdom', 'dining'],
  ['Transport for London', 'transport', 280, 1420, ['GBP'], 'London, United Kingdom', 'transport'],
  ['National Rail', 'travel', 2100, 9500, ['GBP'], 'United Kingdom', 'travel'],
  ['Boots', 'health', 600, 5800, ['GBP'], 'London, United Kingdom', 'health'],
  ['Talabat', 'dining', 3200, 14500, ['AED'], 'Dubai, United Arab Emirates', 'dining'],
  ['Al Hallab', 'dining', 6500, 23000, ['AED'], 'Dubai, United Arab Emirates', 'dining'],
  ['Arabica', 'dining', 2400, 7600, ['AED'], 'Dubai, United Arab Emirates', 'coffee'],
  ['Waitrose UAE', 'groceries', 6500, 31000, ['AED'], 'Dubai, United Arab Emirates', 'groceries'],
  ['Dubai Metro', 'transport', 300, 2500, ['AED'], 'Dubai, United Arab Emirates', 'transport'],
  ['ENOC', 'transport', 9500, 22000, ['AED'], 'Dubai, United Arab Emirates', 'transport'],
  ['Airbnb', 'travel', 9500, 72000, ['USD', 'EUR', 'GBP', 'AED'], 'Online booking', 'travel'],
  ['Booking.com', 'travel', 12500, 88000, ['USD', 'EUR', 'GBP', 'AED'], 'Online booking', 'travel'],
  ['Cinema City', 'entertainment', 1000, 3600, ['USD'], 'Beirut, Lebanon', 'entertainment'],
  ['Pathé', 'entertainment', 1400, 4600, ['EUR'], 'Paris, France', 'entertainment'],
  ['Picturehouse', 'entertainment', 1600, 5400, ['GBP'], 'London, United Kingdom', 'entertainment'],
  [
    'VOX Cinemas',
    'entertainment',
    4500,
    14000,
    ['AED'],
    'Dubai, United Arab Emirates',
    'entertainment',
  ],
  ['Pharmacie du Centre', 'health', 850, 6700, ['EUR'], 'Paris, France', 'health'],
  ['Life Pharmacy', 'health', 2500, 14500, ['AED'], 'Dubai, United Arab Emirates', 'health'],
  ['Ogero', 'utilities', 2900, 3900, ['USD'], 'Beirut, Lebanon', 'utilities'],
  ['EDF', 'utilities', 6200, 11500, ['EUR'], 'Paris, France', 'utilities'],
  ['Octopus Energy', 'utilities', 6500, 13000, ['GBP'], 'London, United Kingdom', 'utilities'],
  ['DEWA', 'utilities', 28000, 47000, ['AED'], 'Dubai, United Arab Emirates', 'utilities'],
];
const slug = (name) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '');

function createDemoData() {
  let state = 20260914;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const merchants = new Map(
    catalog.map(([name, , , , , , icon]) => [slug(name), { id: slug(name), name, icon }]),
  );
  const transactions = [];
  const add = (account, name, amountMinor, timestamp, category, options = {}) => {
    const id = `tx_${String(transactions.length + 1).padStart(4, '0')}`;
    if (!merchants.has(slug(name)))
      merchants.set(slug(name), { id: slug(name), name, icon: options.icon || category });
    transactions.push({
      id,
      accountId: account.id,
      currency: account.currency,
      merchantId: slug(name),
      amountMinor,
      direction: options.direction || 'debit',
      kind: options.kind || 'purchase',
      category,
      timestamp,
      status: options.status || 'completed',
      paymentMethod: options.paymentMethod || 'card',
      location: options.location || 'Online',
      reference: `FLX-${timestamp.slice(0, 7).replace('-', '')}-${id.slice(3)}`,
      notes: options.notes || '',
    });
  };
  for (let i = 0; i < 320; i++) {
    const selection = random();
    const account = ACCOUNTS[selection < 0.4 ? 0 : selection < 0.66 ? 1 : selection < 0.84 ? 2 : 3];
    const choices = catalog.filter((entry) => entry[4].includes(account.currency));
    const merchant = choices[Math.floor(random() * choices.length)];
    const date = new Date(Date.UTC(2026, 3, 1) + Math.floor(random() * 166) * 86400000);
    date.setUTCHours(7 + Math.floor(random() * 14), Math.floor(random() * 60), 0, 0);
    const status =
      random() < 0.035
        ? 'failed'
        : date >= new Date('2026-09-12') && random() < 0.5
          ? 'pending'
          : 'completed';
    const amount = Math.round((merchant[2] + random() * (merchant[3] - merchant[2])) / 5) * 5;
    add(account, merchant[0], amount, date.toISOString(), merchant[1], {
      status,
      location: merchant[5],
      paymentMethod: merchant[1] === 'utilities' ? 'direct_debit' : 'card',
      notes:
        merchant[1] === 'travel'
          ? 'Weekend trip reservation'
          : merchant[1] === 'groceries'
            ? 'Weekly essentials'
            : '',
    });
  }
  for (const account of ACCOUNTS) {
    const subAmounts = {
      USD: [1099, 1549, 299],
      EUR: [1099, 1399, 299],
      GBP: [1099, 1299, 299],
      AED: [2299, 4900, 1099],
    }[account.currency];
    for (let month = 3; month <= 8; month++) {
      ['Spotify', 'Netflix', 'Apple iCloud'].forEach((name, index) =>
        add(
          account,
          name,
          subAmounts[index],
          new Date(Date.UTC(2026, month, 4 + index * 3, 8, 15)).toISOString(),
          'subscriptions',
          { paymentMethod: 'direct_debit', notes: 'Monthly subscription', icon: 'subscriptions' },
        ),
      );
      add(
        account,
        {
          USD: 'Northstar Studio',
          EUR: 'Atelier Nord',
          GBP: 'Eastbank Design',
          AED: 'Palm Studio',
        }[account.currency],
        { USD: 220000, EUR: 180000, GBP: 150000, AED: 200000 }[account.currency],
        new Date(Date.UTC(2026, month, 1, 9, 0)).toISOString(),
        'income',
        {
          direction: 'credit',
          kind: 'income',
          paymentMethod: 'bank_transfer',
          notes:
            account.currency === 'USD'
              ? 'Monthly salary · Northstar Studio'
              : 'Monthly design retainer',
          icon: 'income',
        },
      );
    }
  }
  for (let i = 0; i < 12; i++) {
    const account = ACCOUNTS[i % 4];
    add(
      account,
      i % 2 ? 'Jamie Lee' : 'Savings account',
      i % 2 ? 8500 : 25000,
      new Date(Date.UTC(2026, 4 + Math.floor(i / 4), 18 + (i % 4), 11, 22)).toISOString(),
      'transfers',
      {
        direction: i % 2 ? 'credit' : 'debit',
        kind: 'transfer',
        paymentMethod: 'bank_transfer',
        notes: i % 2 ? 'Shared weekend expenses' : 'Personal savings transfer',
        icon: 'transfers',
      },
    );
  }
  for (let i = 0; i < 8; i++) {
    const account = ACCOUNTS[i % 4];
    add(
      account,
      i % 2 ? 'Amazon' : 'Apple',
      i % 2 ? 4999 : 2900,
      new Date(Date.UTC(2026, 6 + Math.floor(i / 4), 6 + i, 13, 17)).toISOString(),
      'shopping',
      {
        direction: 'credit',
        kind: 'refund',
        status: 'refunded',
        notes: 'Returned item · refund completed',
      },
    );
  }
  const recent = [
    ['usd', 'Roadster', 2240, 'dining', '2026-09-14T10:42:00.000Z', 'completed', 'Beirut, Lebanon'],
    [
      'aed',
      'Careem',
      3850,
      'transport',
      '2026-09-14T09:20:00.000Z',
      'pending',
      'Dubai, United Arab Emirates',
    ],
    [
      'eur',
      'Monoprix',
      4836,
      'groceries',
      '2026-09-14T08:31:00.000Z',
      'completed',
      'Paris, France',
    ],
    [
      'gbp',
      'Pret A Manger',
      865,
      'dining',
      '2026-09-14T07:45:00.000Z',
      'completed',
      'London, United Kingdom',
    ],
    ['usd', 'Uber', 1280, 'transport', '2026-09-13T18:24:00.000Z', 'pending', 'Beirut, Lebanon'],
    [
      'usd',
      'Spinneys',
      7645,
      'groceries',
      '2026-09-13T14:08:00.000Z',
      'completed',
      'Beirut, Lebanon',
    ],
    ['eur', 'Amazon', 6890, 'shopping', '2026-09-13T12:05:00.000Z', 'failed', 'Online'],
    ['usd', 'Urbanista', 840, 'dining', '2026-09-13T08:15:00.000Z', 'completed', 'Beirut, Lebanon'],
  ];
  recent.forEach(([id, name, amount, category, timestamp, status, location]) =>
    add(
      ACCOUNTS.find((a) => a.id === id),
      name,
      amount,
      timestamp,
      category,
      { status, location },
    ),
  );
  const accounts = ACCOUNTS.map((account) => {
    const movement = transactions
      .filter((t) => t.accountId === account.id && ['completed', 'refunded'].includes(t.status))
      .reduce((sum, t) => sum + (t.direction === 'credit' ? t.amountMinor : -t.amountMinor), 0);
    return {
      ...account,
      userId: USER.id,
      status: 'active',
      openingBalanceMinor: account.balanceMinor - movement,
    };
  });
  return {
    user: USER,
    accounts,
    merchants: [...merchants.values()],
    transactions,
    asOf: DEMO_DATE,
  };
}
module.exports = { createDemoData, DEMO_DATE };
