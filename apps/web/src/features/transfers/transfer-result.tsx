import { Link } from 'react-router';
import { Check, WarningCircle, ArrowUpRight } from '@phosphor-icons/react';
import { Button } from '@/design-system/button';
import { formatMoney } from '@/features/finance/format';
import { TransferSummary } from './transfer-summary';
import type { Transfer } from './types';

export function TransferResult({ transfer, onAgain }: { transfer: Transfer; onAgain: () => void }) {
  const success = transfer.status === 'COMPLETED';
  return (
    <>
      <div className={`transfer-result-heading ${success ? 'is-success' : 'is-failure'}`}>
        <span className="transfer-result-icon" aria-hidden="true">
          {success ? <Check size={32} /> : <WarningCircle size={32} />}
        </span>
        <h2>
          {success
            ? transfer.kind === 'exchange'
              ? 'Exchange complete'
              : 'Money sent'
            : 'Transfer failed'}
        </h2>
        <p>
          {success
            ? `${formatMoney(transfer.destinationAmountMinor, transfer.destinationCurrency)} ${transfer.kind === 'send' ? `sent to ${transfer.recipient?.name ?? 'your recipient'}` : 'added to your account'}.`
            : (transfer.failureReason ??
              'The transfer could not be completed. No funds were moved.')}
        </p>
      </div>
      <TransferSummary transfer={transfer} />
      <div className="flow-actions">
        <Link className="button button--primary" to={`/payments/transfers/${transfer.id}`}>
          View transfer <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Button variant="secondary" onClick={onAgain}>
          {success ? (transfer.kind === 'send' ? 'Send again' : 'Exchange again') : 'Get new quote'}
        </Button>
        <Link className="text-link" to={success ? '/home' : '/payments'}>
          {success ? 'Back home' : 'Back to Payments'}
        </Link>
      </div>
    </>
  );
}
