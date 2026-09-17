import { useState } from 'react';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { Input } from '@/design-system/input';
import { MoneyInput } from '@/design-system/money-input';
import { Avatar } from '@/design-system/avatar';
import { formatMoney } from '@/features/finance/format';
import { currencies } from '@/features/finance/types';
import type { Account } from '@/features/finance/types';
import type { Recipient } from './types';
import { amountMinor } from './draft';
import type { TransferDraft } from './draft';

export function AmountStep({
  draft,
  accounts,
  recipient,
  onChange,
  onQuote,
  busy,
}: {
  draft: TransferDraft;
  accounts: Account[];
  recipient: Recipient | undefined;
  onChange: (next: Partial<TransferDraft>) => void;
  onQuote: () => void;
  busy: boolean;
}) {
  const [attempted, setAttempted] = useState(false);
  const account = accounts.find((item) => item.id === draft.sourceAccountId);
  const destination = accounts.find((item) => item.id === draft.destinationAccountId);
  const valid =
    amountMinor(draft.amount) !== null &&
    account?.status === 'active' &&
    account.availableBalanceMinor > 0 &&
    (draft.kind === 'send'
      ? recipient?.status === 'active'
      : destination?.status === 'active' && destination.currency !== account.currency);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (valid) onQuote();
      }}
    >
      {recipient && (
        <div className="flow-recipient">
          <Avatar name={recipient.name} />
          <div>
            <strong>{recipient.name}</strong>
            <p>
              {recipient.bankName} · {recipient.accountIdentifier}
            </p>
          </div>
          <Button variant="ghost" onClick={() => onChange({ step: 'recipient' })}>
            Change
          </Button>
        </div>
      )}
      <div className="source-select">
        <Select
          label="You pay from"
          value={draft.sourceAccountId}
          onChange={(event) => onChange({ sourceAccountId: event.target.value })}
        >
          {accounts.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={item.status !== 'active' || item.availableBalanceMinor <= 0}
            >
              {item.currency} · {item.name}
              {item.status !== 'active' ? ' · Unavailable' : ''}
            </option>
          ))}
        </Select>
        {account && (
          <p>
            {formatMoney(account.availableBalanceMinor, account.currency)} available{' '}
            <span>· {formatMoney(account.balanceMinor, account.currency)} balance</span>
          </p>
        )}
      </div>
      <div className="transfer-money-input" data-long-amount={draft.amount.length > 8 || undefined}>
        <MoneyInput
          label={draft.kind === 'send' ? 'Recipient receives' : 'You receive'}
          currency={draft.destinationCurrency}
          value={draft.amount}
          onValueChange={(amount) => {
            setAttempted(false);
            onChange({ amount });
          }}
          placeholder="0.00"
          autoComplete="off"
          error={
            attempted && amountMinor(draft.amount) === null
              ? 'Enter an amount from 0.01 to 1,000,000.00.'
              : undefined
          }
        />
      </div>
      <div className="amount-destination">
        {draft.kind === 'send' ? (
          <Select
            label="Recipient receives in"
            value={draft.destinationCurrency}
            onChange={(event) =>
              onChange({
                destinationCurrency: event.target.value as TransferDraft['destinationCurrency'],
              })
            }
          >
            {currencies.map((currency) => (
              <option key={currency} disabled={!recipient?.supportedCurrencies.includes(currency)}>
                {currency}
              </option>
            ))}
          </Select>
        ) : (
          <Select
            label="You receive into"
            value={draft.destinationAccountId}
            onChange={(event) => {
              const next = accounts.find((item) => item.id === event.target.value);
              if (next)
                onChange({ destinationAccountId: next.id, destinationCurrency: next.currency });
            }}
          >
            {accounts.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={item.status !== 'active' || item.currency === account?.currency}
              >
                {item.currency} · {item.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <p className="amount-explainer">
        Enter the exact amount to receive. Your quote will show the amount to pay and the fee in{' '}
        {account?.currency ?? 'your source currency'}.
      </p>
      <Input
        label="Note (optional)"
        value={draft.note}
        onChange={(event) => onChange({ note: event.target.value })}
        maxLength={140}
        placeholder="What’s this for?"
      />
      {attempted && !valid && amountMinor(draft.amount) !== null && (
        <p className="field-error" role="alert">
          Choose active source and destination accounts in different currencies, or an available
          recipient.
        </p>
      )}
      <div className="flow-actions">
        <Button type="submit" loading={busy}>
          Get quote
        </Button>
        <span className="finance-caption">Rate and fee shown before you confirm.</span>
      </div>
    </form>
  );
}
