import { Link } from 'react-router';
import { ArrowUpRight, ArrowsLeftRight, Users, ArrowRight } from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Avatar } from '@/design-system/avatar';
import { ErrorState, EmptyState } from '@/design-system/feedback';
import { TransactionSkeleton } from '@/features/finance/loading';
import { formatDate, formatMoney } from '@/features/finance/format';
import { useGetTransfersQuery, useGetRecipientsQuery } from './transfers-api';
import { TransferStatus } from './transfer-summary';
import { readDraft } from './draft';

export function PaymentsPage() {
  const transfers = useGetTransfersQuery(undefined, { refetchOnMountOrArgChange: true });
  const recipients = useGetRecipientsQuery();
  const draft = readDraft();
  return (
    <>
      <PageHeader title="Payments" description="Good things, on their way." />
      {draft && draft.step !== 'result' && (
        <div className="transfer-resume">
          <div>
            <strong>
              {draft.submission ? 'Check your last transfer' : 'Pick up where you left off'}
            </strong>
            <p>
              {draft.submission
                ? 'Your last confirmation is saved. Check its result before starting again.'
                : 'Your recipient and amount are saved on this tab.'}
            </p>
          </div>
          <Link
            className="button button--secondary"
            to={`/payments/${draft.kind === 'exchange' ? 'exchange' : 'send'}`}
          >
            Resume <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className="payments-entry">
        <section className="send-entry">
          <span className="payments-entry-icon" aria-hidden="true">
            <ArrowUpRight size={28} />
          </span>
          <h2>Send a little further.</h2>
          <p>
            Across currencies, to the people and places that matter. Know the rate and fee before
            you confirm.
          </p>
          <Link className="button button--primary" to="/payments/send?again=1">
            Send money <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </section>
        <div className="payment-secondary">
          <Link to="/payments/exchange?again=1">
            <ArrowsLeftRight size={25} aria-hidden="true" />
            <div>
              <h2>Exchange</h2>
              <p>Move between your currency accounts.</p>
            </div>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/payments/recipients">
            <Users size={25} aria-hidden="true" />
            <div>
              <h2>Recipients</h2>
              <p>Your people, all in one place.</p>
            </div>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <section className="payments-recents">
        <SectionHeader
          title="Your recent recipients"
          action={
            <Link className="text-link" to="/payments/recipients">
              View all <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {recipients.isError ? (
          <ErrorState title="Recipients unavailable" onRetry={() => void recipients.refetch()} />
        ) : !recipients.data ? (
          <TransactionSkeleton rows={2} />
        ) : (
          <div className="recipient-shortcuts">
            {recipients.data
              ?.filter((recipient) => recipient.lastUsedAt && recipient.status === 'active')
              .slice(0, 4)
              .map((recipient) => (
                <Link key={recipient.id} to={`/payments/send?recipient=${recipient.id}`}>
                  <Avatar name={recipient.name} />
                  <span>{recipient.name}</span>
                  <span>{recipient.preferredCurrency}</span>
                </Link>
              ))}
          </div>
        )}
      </section>
      <section className="finance-activity">
        <SectionHeader
          title="Recent transfers"
          description="The latest 50 transfers and exchanges."
        />
        {transfers.isError ? (
          <ErrorState title="Transfers couldn’t load" onRetry={() => void transfers.refetch()} />
        ) : !transfers.data ? (
          <TransactionSkeleton rows={4} />
        ) : !transfers.data.length ? (
          <EmptyState
            icon={<ArrowsLeftRight size={28} />}
            title="Your first transfer starts here"
            description="Send money or exchange between your accounts. Every completed movement will appear here."
            action={
              <Link className="text-link" to="/payments/send?again=1">
                Send money <ArrowRight size={16} aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <ul className="transfer-history">
            {transfers.data.map((transfer) => (
              <li key={transfer.id}>
                <Link to={`/payments/transfers/${transfer.id}`}>
                  <Avatar name={transfer.recipient?.name ?? 'Flux Exchange'} />
                  <div className="recipient-copy">
                    <strong>
                      {transfer.recipient?.name ??
                        `${transfer.sourceCurrency} to ${transfer.destinationCurrency}`}
                    </strong>
                    <span>
                      {formatDate(transfer.createdAt)} ·{' '}
                      {transfer.kind === 'send' ? 'Transfer' : 'Exchange'}
                    </span>
                  </div>
                  <div className="transfer-history-value">
                    <strong>
                      {formatMoney(transfer.destinationAmountMinor, transfer.destinationCurrency)}
                    </strong>
                    <TransferStatus status={transfer.status} />
                  </div>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="finance-footnote">
        Demo transfers use fictional balances and illustrative rates. No real money is sent.
      </p>
    </>
  );
}
