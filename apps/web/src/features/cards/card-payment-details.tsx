import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle, WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { ResponsiveDialog } from '@/design-system/modal';
import { ErrorState } from '@/design-system/feedback';
import { useToast } from '@/design-system/toast';
import { BalanceSkeleton } from '@/features/finance/loading';
import { categoryNames, formatDate } from '@/features/finance/format';
import { transferError } from '@/features/transfers/transfers-api';
import { useGetCardPaymentQuery, useRefundCardPaymentMutation } from './cards-api';
import { CardPaymentStatus } from './card-history';
import { readRefund, refundKey } from './pending-payment';
import type { CardPayment } from './types';
import { cardMoney, methodNames, cardTypeNames } from './types';
import './cards.css';
export function PaymentOutcome({ payment }: { payment: CardPayment }) {
  return (
    <div
      className={`card-payment-outcome ${payment.status === 'DECLINED' ? 'card-payment-outcome--declined' : ''}`}
      role="status"
    >
      <span aria-hidden="true">
        {payment.status === 'DECLINED' ? (
          <WarningCircle size={25} />
        ) : payment.status === 'REFUNDED' ? (
          <ArrowClockwise size={25} />
        ) : (
          <CheckCircle size={25} />
        )}
      </span>
      <div>
        <h2>
          {payment.status === 'DECLINED'
            ? 'Payment declined'
            : payment.status === 'REFUNDED'
              ? 'Payment refunded'
              : 'Payment completed'}
        </h2>
        <p>
          {payment.decline
            ? `${payment.decline.message} ${payment.decline.action}`
            : payment.status === 'REFUNDED'
              ? 'The original debit, including its FX fee, was returned to your funding account.'
              : `${cardMoney(payment.billingAmountMinor ?? 0, payment.billingCurrency ?? payment.currency)} debited from ${payment.account?.name ?? 'your account'}.`}
        </p>
        {payment.status === 'DECLINED' && <p>No money was debited.</p>}
        {payment.card.type === 'SINGLE_USE' &&
          payment.currentCredentialVersion > payment.card.credentialVersion && (
            <p className="card-rotation-note">
              Card details refreshed for your security. This payment stays linked to the original
              details.
            </p>
          )}
      </div>
    </div>
  );
}
function RefundPayment({ payment, onClose }: { payment: CardPayment; onClose: () => void }) {
  const [saved, setSaved] = useState(() => readRefund(payment.id));
  const [reason, setReason] = useState(saved?.reason ?? 'Merchant returned the purchase');
  const [refund, { isLoading }] = useRefundCardPaymentMutation();
  const [error, setError] = useState('');
  const notify = useToast();
  const submit = async () => {
    setError('');
    const submission = saved ?? { key: crypto.randomUUID(), reason: reason.trim() };
    try {
      sessionStorage.setItem(refundKey(payment.id), JSON.stringify(submission));
      setSaved(submission);
    } catch {
      setError(
        'Enable storage for this tab so the refund can be retried safely. No request was sent.',
      );
      return;
    }
    try {
      await refund({ id: payment.id, ...submission }).unwrap();
      sessionStorage.removeItem(refundKey(payment.id));
      notify('Full refund completed');
      onClose();
    } catch (err) {
      const issue = transferError(err);
      setError(
        issue.ambiguous
          ? 'The refund result is uncertain. Retry this exact refund to recover its result.'
          : issue.message,
      );
      if (!issue.ambiguous) {
        sessionStorage.removeItem(refundKey(payment.id));
        setSaved(null);
      }
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title="Simulate a full refund"
      description={`${payment.merchantName} · ${cardMoney(payment.amountMinor, payment.currency)}`}
    >
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>
          This returns{' '}
          {cardMoney(payment.billingAmountMinor ?? 0, payment.billingCurrency ?? payment.currency)}{' '}
          to {payment.account?.name}, including the original FX fee. It also works after single-use
          details refresh or a virtual card is terminated.
        </p>
        <Input
          label="Refund reason"
          value={reason}
          maxLength={120}
          onChange={(e) => setReason(e.target.value)}
          disabled={isLoading || Boolean(saved)}
        />
        {saved && (
          <p className="card-notice">
            An existing refund request is saved on this tab. Retrying cannot credit this purchase
            twice.
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            Close
          </Button>
          <Button type="submit" loading={isLoading} disabled={reason.trim().length < 2}>
            {saved ? 'Retry saved refund' : 'Refund full amount'}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
export function CardPaymentDetails() {
  const { id = '' } = useParams();
  const query = useGetCardPaymentQuery(id, { refetchOnMountOrArgChange: true });
  const payment = query.currentData;
  const [refund, setRefund] = useState(false);
  return (
    <>
      <Link className="text-link back-link" to={payment ? `/cards/${payment.card.id}` : '/cards'}>
        <ArrowLeft size={17} aria-hidden="true" />
        Back to card
      </Link>
      <PageHeader
        title="Card payment details"
        description="The purchase, the funding, and what happened."
      />
      {query.isError ? (
        <ErrorState title="Payment unavailable" onRetry={() => void query.refetch()} />
      ) : !payment ? (
        <BalanceSkeleton />
      ) : (
        <div className="card-payment-detail">
          <PaymentOutcome payment={payment} />
          <article className="transaction-detail">
            <header className="transaction-detail-hero">
              <h2>{payment.merchantName}</h2>
              <p className="transaction-detail-amount">
                {cardMoney(payment.amountMinor, payment.currency)} <span>{payment.currency}</span>
              </p>
              <CardPaymentStatus status={payment.status} />
            </header>
            <dl className="transaction-detail-fields">
              <div>
                <dt>Card used</dt>
                <dd>
                  <Link className="text-link" to={`/cards/${payment.card.id}`}>
                    {payment.card.label} · {cardTypeNames[payment.card.type]} · {payment.card.last4}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Payment method</dt>
                <dd>
                  {methodNames[payment.paymentType]}
                  {payment.isSubscription ? ' · Subscription' : ''}
                </dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{categoryNames[payment.merchantCategory]}</dd>
              </div>
              <div>
                <dt>Date & time</dt>
                <dd>{formatDate(payment.createdAt, true)} UTC</dd>
              </div>
              {payment.account && (
                <>
                  <div>
                    <dt>
                      {payment.status === 'DECLINED' ? 'Proposed funding' : 'Funding account'}
                    </dt>
                    <dd>
                      <Link className="text-link" to={`/accounts/${payment.account.id}`}>
                        {payment.account.currency} · {payment.account.name}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {payment.status === 'DECLINED'
                        ? 'Calculated debit (not charged)'
                        : 'Original account debit'}
                    </dt>
                    <dd>
                      {cardMoney(
                        payment.billingAmountMinor ?? 0,
                        payment.billingCurrency ?? payment.currency,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>FX fee</dt>
                    <dd>
                      {cardMoney(
                        payment.feeMinor ?? 0,
                        payment.billingCurrency ?? payment.currency,
                      )}
                    </dd>
                  </div>
                  {payment.rateLabel && (
                    <div>
                      <dt>Exchange rate</dt>
                      <dd>
                        1 {payment.billingCurrency} = {payment.rateLabel} {payment.currency}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Funding choice</dt>
                    <dd>
                      {payment.fundingReason === 'MATCHING_CURRENCY'
                        ? 'Available balance in the purchase currency'
                        : 'A supported currency account with enough funds, converted using the demo rate'}
                    </dd>
                  </div>
                </>
              )}
              {payment.merchantLocation && (
                <div>
                  <dt>Simulated merchant country</dt>
                  <dd>{payment.merchantLocation}</dd>
                </div>
              )}
              <div>
                <dt>Reference</dt>
                <dd className="transaction-reference">{payment.reference}</dd>
              </div>
              {payment.note && (
                <div>
                  <dt>Note</dt>
                  <dd>{payment.note}</dd>
                </div>
              )}
              {payment.refund && (
                <>
                  <div>
                    <dt>Refund reference</dt>
                    <dd className="transaction-reference">{payment.refund.reference}</dd>
                  </div>
                  <div>
                    <dt>Refund reason</dt>
                    <dd>{payment.refund.reason}</dd>
                  </div>
                  <div>
                    <dt>Refund date</dt>
                    <dd>{formatDate(payment.refund.createdAt, true)} UTC</dd>
                  </div>
                </>
              )}
            </dl>
            {payment.status !== 'DECLINED' && (
              <Link
                className="text-link"
                to={`/transactions?search=${encodeURIComponent(payment.reference)}`}
              >
                View account transaction
              </Link>
            )}
          </article>
          <details className="card-security-history">
            <summary>Demo Tools</summary>
            <p className="finance-caption">
              Portfolio simulation. Completed payments can be fully refunded once.
            </p>
            {payment.status === 'COMPLETED' ? (
              <Button variant="secondary" onClick={() => setRefund(true)}>
                Simulate refund
              </Button>
            ) : (
              <p>
                {payment.status === 'REFUNDED'
                  ? 'This payment has already been fully refunded.'
                  : 'Only completed payments can be refunded.'}
              </p>
            )}
            <Link className="text-link" to="/demo/card-payments">
              Open payment simulator
            </Link>
          </details>
          {refund && <RefundPayment payment={payment} onClose={() => setRefund(false)} />}
        </div>
      )}
    </>
  );
}
