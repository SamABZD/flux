import { amountMinor, DRAFT_KEY, newDraft, readDraft, saveDraft } from './draft';
import { pastedMoney } from '@/design-system/money-text';
afterEach(() => sessionStorage.clear());
test.each([
  ['0.01', 1],
  ['.01', 1],
  ['500', 50000],
  ['500.1', 50010],
  ['1000000.00', 100000000],
  ['1.', 100],
])('converts %s to exact minor units', (input, expected) =>
  expect(amountMinor(input)).toBe(expected),
);
test.each(['', '0', '-10', '1e3', '10.123', '1000000.01', '1,000', 'NaN', 'Infinity', '.'])(
  'rejects invalid monetary amount %s',
  (input) => expect(amountMinor(input)).toBeNull(),
);
test.each([
  ['€1,234.56', '1234.56'],
  ['EUR 1.234,56', '1234.56'],
  ['AED 0.01', '0.01'],
  ['1,000', '1000'],
  ['.01', '0.01'],
  ['12,50', '12.50'],
])('normalizes pasted %s', (input, expected) => expect(pastedMoney(input)).toBe(expected));
test.each(['1,23,456', '-20', '$1.234', '1e3', 'abc', '1.2.3', '10000000'])(
  'rejects malformed paste %s',
  (input) => expect(pastedMoney(input)).toBeNull(),
);
test('round trips the exact pending submission; malformed storage cannot crash the flow', () => {
  const draft = {
    ...newDraft('send', 'maya-haddad'),
    step: 'uncertain' as const,
    submission: {
      key: '0a8ebcd8-bc5f-4893-82bf-37b64d82e20f',
      body: {
        quoteId: 'cbcefbaf-a7d2-43d1-87d0-1277ed149779',
        sourceAccountId: 'usd',
        recipientId: 'maya-haddad',
        note: 'Rent',
      },
    },
  };
  saveDraft(draft);
  expect(readDraft()).toEqual(draft);
  for (const invalid of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...draft, destinationCurrency: 'BTC' }),
    JSON.stringify({ ...draft, submission: { key: 42, body: {} } }),
  ]) {
    sessionStorage.setItem(DRAFT_KEY, invalid);
    expect(readDraft()).toBeNull();
  }
});
