import { formatDate, formatMoney } from '@/features/finance/format';
import { Badge } from '@/design-system/badge';
import type { Transfer } from './types';
export function TransferStatus({ status }: { status: Transfer['status'] }) {
  return (
    <Badge tone={status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'neutral'}>
      {status === 'COMPLETED' ? 'Completed' : status === 'FAILED' ? 'Failed' : 'Processing'}
    </Badge>
  );
}
export function TransferSummary({ transfer }: { transfer: Transfer }) {
  return (
    <dl className="transfer-breakdown">
      <div>
        <dt>{transfer.kind === 'send' ? 'Recipient' : 'Destination account'}</dt>
        <dd>{transfer.recipient?.name ?? transfer.destinationAccount?.name}</dd>
      </div>
      <div>
        <dt>Source account</dt>
        <dd>
          {transfer.sourceCurrency} · {transfer.sourceAccount.name}
        </dd>
      </div>
      <div>
        <dt>{transfer.status === 'FAILED' ? 'Planned send' : 'You send'}</dt>
        <dd>{formatMoney(transfer.sourceAmountMinor, transfer.sourceCurrency)}</dd>
      </div>
      <div>
        <dt>
          {transfer.status === 'FAILED'
            ? 'Planned receipt'
            : transfer.kind === 'send'
              ? 'Recipient receives'
              : 'You receive'}
        </dt>
        <dd>{formatMoney(transfer.destinationAmountMinor, transfer.destinationCurrency)}</dd>
      </div>
      <div>
        <dt>Exchange rate</dt>
        <dd>
          1 {transfer.sourceCurrency} = {transfer.rateLabel} {transfer.destinationCurrency}
        </dd>
      </div>
      <div>
        <dt>{transfer.status === 'FAILED' ? 'Fee (not charged)' : 'Transfer fee'}</dt>
        <dd>{formatMoney(transfer.feeMinor, transfer.sourceCurrency)}</dd>
      </div>
      <div className="transfer-breakdown-total">
        <dt>Total debit</dt>
        <dd>
          {formatMoney(
            transfer.status === 'FAILED' ? 0 : transfer.totalDebitMinor,
            transfer.sourceCurrency,
          )}
        </dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <TransferStatus status={transfer.status} />
        </dd>
      </div>
      <div>
        <dt>Date & time</dt>
        <dd>{formatDate(transfer.completedAt ?? transfer.createdAt, true)} UTC</dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd>{transfer.reference}</dd>
      </div>
      <div>
        <dt>Note</dt>
        <dd>{transfer.note || 'No note added'}</dd>
      </div>
    </dl>
  );
}
