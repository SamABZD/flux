import { useEffect, useMemo, useState } from 'react';
import { Clock } from '@phosphor-icons/react';
import { Button } from '@/design-system/button';
import { formatMoney } from '@/features/finance/format';
import type { Account } from '@/features/finance/types';
import type { Recipient, TransferQuote } from './types';

export function useQuoteRemaining(quote: TransferQuote) {
  const deadline = useMemo(
    () => Date.now() + Math.max(0, Date.parse(quote.expiresAt) - Date.parse(quote.serverNow)),
    [quote.expiresAt, quote.serverNow],
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function ReviewStep({
  quote,
  recipient,
  account,
  destinationName,
  note,
  busy,
  onConfirm,
  onRefresh,
  onEdit,
}: {
  quote: TransferQuote;
  recipient: Recipient | undefined;
  account: Account | undefined;
  destinationName: string;
  note: string;
  busy: boolean;
  onConfirm: () => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const remaining = useQuoteRemaining(quote),
    expired = remaining === 0;
  return (
    <>
      <div className="review-amount">
        <span>
          {quote.kind === 'send' ? `${recipient?.name ?? 'Recipient'} receives` : 'You receive'}
        </span>
        <p>
          {formatMoney(quote.destinationAmountMinor, quote.destinationCurrency)}
          <span>{quote.destinationCurrency === 'AED' ? '' : quote.destinationCurrency}</span>
        </p>
      </div>
      <div className={`quote-clock ${remaining <= 10 ? 'quote-clock--warning' : ''}`}>
        <Clock size={18} aria-hidden="true" />
        <span aria-live="off">
          {expired
            ? 'This quote has expired'
            : `Rate guaranteed for 00:${String(remaining).padStart(2, '0')}`}
        </span>
      </div>
      {expired && (
        <p className="field-error" role="status">
          Get a fresh quote to confirm. No money has moved.
        </p>
      )}
      <dl className="transfer-breakdown">
        <div>
          <dt>{quote.kind === 'send' ? 'To' : 'Destination account'}</dt>
          <dd>{recipient?.name ?? destinationName}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>
            {quote.sourceCurrency} · {account?.name ?? 'Your account'}
          </dd>
        </div>
        <div>
          <dt>You send</dt>
          <dd>{formatMoney(quote.sourceAmountMinor, quote.sourceCurrency)}</dd>
        </div>
        <div>
          <dt>Exchange rate</dt>
          <dd>
            1 {quote.sourceCurrency} = {quote.rateLabel} {quote.destinationCurrency}
          </dd>
        </div>
        <div>
          <dt>Transfer fee</dt>
          <dd>{formatMoney(quote.feeMinor, quote.sourceCurrency)}</dd>
        </div>
        <div className="transfer-breakdown-total">
          <dt>Total debit</dt>
          <dd>{formatMoney(quote.totalDebitMinor, quote.sourceCurrency)}</dd>
        </div>
        <div>
          <dt>Estimated arrival</dt>
          <dd>{quote.estimatedArrival}</dd>
        </div>
        {note && (
          <div>
            <dt>Note</dt>
            <dd>{note}</dd>
          </div>
        )}
      </dl>
      <p className="finance-caption">
        {quote.rateSource}. Fee: 0.40%, with a 0.50 USD-equivalent minimum. Required source amount
        and fee round up to the next cent.
      </p>
      {quote.shortfallMinor > 0 && (
        <div className="transfer-failure-copy" role="alert">
          <strong>You need {formatMoney(quote.shortfallMinor, quote.sourceCurrency)} more</strong>
          <p>
            Your available balance is{' '}
            {formatMoney(quote.availableBalanceMinor, quote.sourceCurrency)}. Reduce the amount or
            choose another source account.
          </p>
        </div>
      )}
      <div className="flow-actions">
        <Button disabled={expired || quote.shortfallMinor > 0} loading={busy} onClick={onConfirm}>
          {quote.kind === 'send' ? 'Confirm transfer' : 'Confirm exchange'}
        </Button>
        {expired && (
          <Button variant="secondary" onClick={onRefresh} loading={busy}>
            Refresh quote
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onEdit}>
          Change amount or account
        </Button>
      </div>
    </>
  );
}
