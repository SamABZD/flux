import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowUpRight, Plus, Repeat, CalendarBlank } from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { MoneyInput } from '@/design-system/money-input';
import { ResponsiveDialog } from '@/design-system/modal';
import { EmptyState, ErrorState, Skeleton } from '@/design-system/feedback';
import { useToast } from '@/design-system/toast';
import { MerchantIcon, TransactionRows } from '@/features/finance/transaction-rows';
import { currencies } from '@/features/finance/types';
import { formatMoney, formatDate } from '@/features/finance/format';
import { amountMinor } from '@/features/transfers/draft';
import { transferError } from '@/features/transfers/transfers-api';
import { InsightNavigation } from './insight-controls';
import {
  useGetSubscriptionsQuery,
  useCreateSubscriptionMutation,
  useEditSubscriptionMutation,
} from './insights-api';
import type {
  Subscription,
  SubscriptionCandidate,
  Subscriptions,
  Cadence,
  SubscriptionStatus,
} from './types';
import './insights.css';

const cadenceNames: Record<Cadence, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};
const statusNames: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Tracking',
  PAUSED: 'Paused',
  CANCELLED: 'Marked cancelled',
};
export function SubscriptionsPage() {
  const [params, setParams] = useSearchParams();
  const { id } = useParams();
  const currency = currencies.find((item) => item === params.get('baseCurrency')) ?? 'USD';
  const query = useGetSubscriptionsQuery(currency, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const data = query.currentData;
  const selected = data?.items.find((item) => item.id === id);
  const [editing, setEditing] = useState<Subscription | SubscriptionCandidate | 'new' | null>(null);
  const [changing, setChanging] = useState<{
    item: Subscription;
    status: SubscriptionStatus;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const suffix = '?baseCurrency=' + currency;
  const close = () => {
    setEditing(null);
    setChanging(null);
    void query.refetch();
  };
  return (
    <>
      <PageHeader
        title={id ? (selected?.label ?? 'Subscription details') : 'Subscriptions'}
        description={
          id ? 'Your schedule and the payments behind it.' : 'Keep the recurring things in view.'
        }
        actions={
          id ? (
            <Link className="button button--secondary" to={'/subscriptions' + suffix}>
              <ArrowLeft size={16} />
              All subscriptions
            </Link>
          ) : (
            <Button
              leadingIcon={<Plus size={17} />}
              disabled={!data}
              onClick={() => setEditing('new')}
            >
              Track subscription
            </Button>
          )
        }
      />
      <InsightNavigation active="subscriptions" />
      {!id && (
        <div className="planning-toolbar">
          <p className="finance-caption">
            Track upcoming payments. Billing stays with the merchant.
          </p>
          <Select
            label="Reporting currency"
            value={currency}
            onChange={(event) => setParams({ baseCurrency: event.target.value }, { replace: true })}
          >
            {currencies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
      )}
      {query.isError && data && (
        <ErrorState
          headingLevel={2}
          title="Couldn’t refresh subscriptions"
          description="The last loaded schedules and suggestions are shown below. Retry to refresh them."
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isError && !data ? (
        <ErrorState
          headingLevel={2}
          title="Subscriptions couldn’t load"
          description="Your tracking settings are saved. Try loading them again."
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <div className="insight-loading">
          <Skeleton height="5rem" />
          <Skeleton height="15rem" />
        </div>
      ) : id && !selected ? (
        <ErrorState
          headingLevel={2}
          title="Subscription not found"
          description="It may belong to another workspace. Return to your subscriptions."
        />
      ) : selected ? (
        <>
          <section className="subscription-detail-summary" aria-label="Subscription overview">
            <MerchantIcon merchant={selected.merchant} />
            <div>
              <Badge
                tone={
                  selected.status === 'ACTIVE'
                    ? 'neutral'
                    : selected.status === 'PAUSED'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {statusNames[selected.status]}
              </Badge>
              <p className="subscription-price money">
                {formatMoney(selected.amountMinor, selected.currency)}
                <span>
                  {' '}
                  /{' '}
                  {selected.cadence === 'WEEKLY'
                    ? 'week'
                    : selected.cadence === 'MONTHLY'
                      ? 'month'
                      : 'year'}
                </span>
              </p>
              <p className="finance-caption">
                {selected.nextPaymentDate
                  ? 'Next estimated payment ' + formatDate(selected.nextPaymentDate)
                  : 'Excluded from upcoming estimates'}{' '}
                · {selected.currency} account
              </p>
            </div>
          </section>
          <div className="subscription-actions">
            <Button variant="secondary" onClick={() => setEditing(selected)}>
              Edit tracking
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setChanging({
                  item: selected,
                  status: selected.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                })
              }
            >
              {selected.status === 'ACTIVE' ? 'Pause tracking' : 'Resume tracking'}
            </Button>
            {selected.status !== 'CANCELLED' && (
              <Button
                variant="ghost"
                onClick={() => setChanging({ item: selected, status: 'CANCELLED' })}
              >
                Mark as cancelled
              </Button>
            )}
          </div>
          <p className="subscription-boundary">
            Tracking changes affect Flux’s estimates only. To change or cancel billing, contact{' '}
            {selected.merchant.name} directly. No charge is created by this schedule.
          </p>
          <dl className="subscription-facts">
            <div>
              <dt>Net paid this year</dt>
              <dd className="money">
                {formatMoney(selected.spentThisYearMinor, selected.currency)}
              </dd>
            </div>
            <div>
              <dt>Most recent payment card</dt>
              <dd>
                {selected.paymentCard ? (
                  <Link className="text-link" to={`/cards/${selected.paymentCard.id}`}>
                    {selected.paymentCard.label} · •••• {selected.paymentCard.last4}
                  </Link>
                ) : (
                  'No linked Flux card in payment history'
                )}
              </dd>
            </div>
            <div>
              <dt>Spent this month</dt>
              <dd className="money">
                {formatMoney(selected.spentThisMonthMinor, selected.currency)}
              </dd>
            </div>
            <div>
              <dt>Monthly equivalent</dt>
              <dd className="money">
                {formatMoney(selected.monthlyEquivalentMinor, selected.currency)}
              </dd>
            </div>
            <div>
              <dt>Last payment</dt>
              <dd>
                {selected.lastPaidAt ? formatDate(selected.lastPaidAt) : 'No matching payment yet'}
              </dd>
            </div>
            <div>
              <dt>History match</dt>
              <dd>
                {selected.merchant.name} · {selected.currency} account
              </dd>
            </div>
          </dl>
          {selected.cardWarning && (
            <p className="subscription-boundary">
              {selected.cardWarning}{' '}
              {selected.paymentCard && (
                <Link className="text-link" to={`/cards/${selected.paymentCard.id}`}>
                  Review card controls
                </Link>
              )}
            </p>
          )}
          <section className="insight-activity">
            <SectionHeader
              title="Payment history"
              description="Existing transactions from this merchant and account. Refunds reduce net spending on the date credited."
              action={
                <Link
                  className="text-link"
                  to={`/transactions?merchant=${encodeURIComponent(selected.merchant.id)}&account=${selected.accountId}`}
                >
                  All transactions
                  <ArrowUpRight size={16} />
                </Link>
              }
            />
            {selected.transactions.length ? (
              <TransactionRows items={selected.transactions} />
            ) : (
              <EmptyState
                icon={<Repeat size={28} />}
                title="No payments matched yet"
                description="Settled purchases from this merchant and account will appear here automatically."
              />
            )}
          </section>
        </>
      ) : (
        <>
          <section className="subscription-summary" aria-label="Subscription estimates">
            <div>
              <p>
                Tracked monthly estimate <span>· {currency}</span>
              </p>
              <strong className="money">
                {formatMoney(data.monthlyEquivalentMinor, currency)}
              </strong>
              <span>
                {formatMoney(data.yearlyEquivalentMinor, currency)} yearly equivalent ·{' '}
                {data.items.filter((item) => item.status === 'ACTIVE').length} tracking
              </span>
            </div>
            <div>
              <span>All subscription spending this month</span>
              <strong className="money">
                {formatMoney(data.actualSubscriptionSpendingMinor, currency)}
              </strong>
              <Link
                className="text-link"
                to={`/analytics/categories/subscriptions?baseCurrency=${currency}`}
              >
                Explore spending <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>
          <div className="subscription-columns">
            <section className="subscription-upcoming" aria-label="Upcoming payments">
              <SectionHeader
                title="Coming up"
                description={`Next 30 days · ${formatMoney(data.upcomingTotalMinor, currency)} estimated`}
              />
              {data.upcoming.length ? (
                <ol>
                  {data.upcoming.slice(0, showAllUpcoming ? undefined : 12).map((item) => (
                    <li key={item.subscriptionId + item.date}>
                      <Link to={`/subscriptions/${item.subscriptionId}${suffix}`}>
                        <time dateTime={item.date}>
                          <strong>{item.date.slice(8)}</strong>
                          <span>
                            {new Intl.DateTimeFormat('en-GB', {
                              month: 'short',
                              timeZone: 'UTC',
                            }).format(new Date(item.date))}
                          </span>
                        </time>
                        <span>
                          {item.label}
                          <small>{item.currency} account</small>
                          {item.cardWarning && <small>{item.cardWarning}</small>}
                        </span>
                        <strong className="money">
                          {formatMoney(item.amountMinor, item.currency)}
                        </strong>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  icon={<CalendarBlank size={28} />}
                  title="Nothing scheduled in the next 30 days"
                  description="Active tracking schedules will show their next estimated payments here."
                />
              )}
              {data.upcoming.length > 12 && (
                <Button variant="ghost" onClick={() => setShowAllUpcoming(!showAllUpcoming)}>
                  {showAllUpcoming
                    ? 'Show fewer payments'
                    : `Show all ${data.upcoming.length} payments`}
                </Button>
              )}
            </section>
            <section className="subscription-tracked" aria-label="Tracked subscriptions">
              <SectionHeader
                title="Your subscriptions"
                action={
                  <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show current' : 'Show all statuses'}
                  </Button>
                }
              />
              <ul className="insight-merchants">
                {data.items
                  .filter((item) => showAll || item.status !== 'CANCELLED')
                  .map((item) => (
                    <li key={item.id}>
                      <Link to={`/subscriptions/${item.id}${suffix}`}>
                        <MerchantIcon merchant={item.merchant} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>
                            {cadenceNames[item.cadence]} · {item.currency} ·{' '}
                            {statusNames[item.status]}
                          </small>
                          {item.paymentCard && (
                            <small>
                              {item.paymentCard.label} · •••• {item.paymentCard.last4}
                            </small>
                          )}
                          {item.cardWarning && <small>{item.cardWarning}</small>}
                        </span>
                        <strong className="money">
                          {formatMoney(item.amountMinor, item.currency)}
                        </strong>
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
              </ul>
              {!data.items.filter((item) => showAll || item.status !== 'CANCELLED').length && (
                <EmptyState
                  icon={<Repeat size={28} />}
                  title="Track your first subscription"
                  description="Add a schedule manually or review a recurring payment below."
                  action={<Button onClick={() => setEditing('new')}>Track subscription</Button>}
                />
              )}
            </section>
          </div>
          {data.candidates.length > 0 && (
            <section className="subscription-candidates">
              <SectionHeader
                title="Looks recurring"
                description="Patterns in your payments. Review a suggestion before adding it to your estimates."
              />
              <ul>
                {data.candidates.map((item) => (
                  <li key={item.key}>
                    <MerchantIcon merchant={item.merchant} />
                    <div>
                      <strong>{item.merchant.name}</strong>
                      <span>
                        {formatMoney(item.amountMinor, item.currency)} ·{' '}
                        {cadenceNames[item.cadence].toLowerCase()} · {item.currency} account
                      </span>
                      <small>
                        {item.evidenceIds.length} regular payments · last paid{' '}
                        {formatDate(item.lastPaidAt)}
                      </small>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(item)}
                      aria-label={`Review ${item.merchant.name} ${item.currency} subscription`}
                    >
                      Review
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!data.candidates.length && (
            <p className="finance-caption">
              No new recurring payments detected. You can track a subscription manually if you know
              its schedule.
            </p>
          )}
        </>
      )}
      {data && (
        <details className="insight-method">
          <summary>About estimates and recurring detection</summary>
          <p>
            Tracking is a planning tool. Pausing or marking a subscription cancelled does not stop
            merchant billing. Payment history stays available.
          </p>
          <p>
            Monthly estimates include active tracked schedules only. Weekly plans use 52 payments
            per year; yearly plans are divided by 12. The next 30 days uses actual estimated
            schedule dates, including repeated weekly payments. Amounts use current illustrative FX
            rates.
          </p>
          <p>
            “All subscription spending” includes settled transactions categorized as subscriptions
            and recurring or subscription-tagged card payments, including those you have not
            tracked. History matches a merchant and an account; purchases of other products from
            that merchant may also appear. Suggestions require at least three regular, similarly
            priced payments and can be wrong.
          </p>
          <p>
            Month-end billing stays anchored to its original day: January 31 becomes February’s last
            day, then March 31. Dates are estimates in UTC, not authorizations or merchant
            confirmations.
          </p>
        </details>
      )}
      {editing && data && (
        <SubscriptionEditor
          value={editing === 'new' ? null : editing}
          accounts={data.accounts}
          onClose={close}
        />
      )}
      {changing && (
        <SubscriptionStatusDialog item={changing.item} status={changing.status} onClose={close} />
      )}
    </>
  );
}
function SubscriptionEditor({
  value,
  accounts,
  onClose,
}: {
  value: Subscription | SubscriptionCandidate | null;
  accounts: Subscriptions['accounts'];
  onClose: () => void;
}) {
  const existing = value && 'id' in value ? value : null;
  const candidate = value && 'key' in value ? value : null;
  const [accountId, setAccountId] = useState(value?.accountId ?? accounts[0]?.id ?? '');
  const currency = accounts.find((item) => item.id === accountId)?.currency ?? 'USD';
  const [merchant, setMerchant] = useState(value?.merchant.name ?? '');
  const [label, setLabel] = useState(existing?.label ?? value?.merchant.name ?? '');
  const [amount, setAmount] = useState(value ? (value.amountMinor / 100).toFixed(2) : '');
  const [cadence, setCadence] = useState<Cadence>(value?.cadence ?? 'MONTHLY');
  const [date, setDate] = useState(
    value?.nextPaymentDate ?? existing?.anchorDate ?? new Date().toISOString().slice(0, 10),
  );
  const [create, creation] = useCreateSubscriptionMutation();
  const [edit, editing] = useEditSubscriptionMutation();
  const loading = creation.isLoading || editing.isLoading;
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const notify = useToast();
  const save = async () => {
    const minor = amountMinor(amount);
    if (minor === null) return;
    setError('');
    try {
      if (existing)
        await edit({
          id: existing.id,
          body: {
            revision: existing.revision,
            label,
            amountMinor: minor,
            cadence,
            ...(date !== (existing.nextPaymentDate ?? existing.anchorDate) ||
            cadence !== existing.cadence
              ? { nextPaymentDate: date }
              : {}),
          },
        }).unwrap();
      else
        await create({
          key,
          body: {
            accountId,
            merchantName: merchant,
            ...(candidate ? { merchantId: candidate.merchant.id } : {}),
            label,
            amountMinor: minor,
            cadence,
            nextPaymentDate: date,
            source: candidate ? 'DETECTED' : 'MANUAL',
          },
        }).unwrap();
      notify(existing ? 'Tracking updated' : 'Subscription tracked');
      onClose();
    } catch (error) {
      const failure = transferError(error);
      setUncertain(failure.ambiguous);
      setError(
        failure.ambiguous
          ? 'The save could not be confirmed. Retry these same values, or close and inspect your subscriptions before editing again.'
          : failure.message,
      );
    }
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
      title={
        existing
          ? 'Edit subscription tracking'
          : candidate
            ? 'Review recurring payment'
            : 'Track a subscription'
      }
      description={
        candidate
          ? candidate.confidence
          : 'Set an estimated schedule. Flux will not make or stop any payments.'
      }
    >
      <form
        className="planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Input
          label="Merchant"
          value={merchant}
          minLength={2}
          maxLength={80}
          required
          disabled={Boolean(value) || loading || uncertain}
          onChange={(event) => {
            setMerchant(event.target.value);
            if (!label || label === merchant) setLabel(event.target.value);
          }}
        />
        <Input
          label="Label"
          value={label}
          minLength={2}
          maxLength={60}
          required
          disabled={loading || uncertain}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Select
          label="Payment account"
          value={accountId}
          disabled={Boolean(value) || loading || uncertain}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.currency} · {account.name}
            </option>
          ))}
        </Select>
        <MoneyInput
          label="Payment amount"
          currency={currency}
          value={amount}
          onValueChange={setAmount}
          disabled={loading || uncertain}
        />
        <div className="planning-form-columns">
          <Select
            label="Repeats"
            value={cadence}
            disabled={loading || uncertain}
            onChange={(event) => setCadence(event.target.value as Cadence)}
          >
            {Object.entries(cadenceNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Next payment date"
            type="date"
            value={date}
            required
            disabled={loading || uncertain}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        {candidate && (
          <p className="finance-caption">
            Matched {candidate.evidenceIds.length} payments from {candidate.merchant.name} in your{' '}
            {candidate.currency} account. Confirm the amount and date with the merchant.
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={
              !accountId ||
              merchant.trim().length < 2 ||
              label.trim().length < 2 ||
              amountMinor(amount) === null ||
              !date
            }
          >
            {uncertain ? 'Retry save' : existing ? 'Save changes' : 'Start tracking'}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
function SubscriptionStatusDialog({
  item,
  status,
  onClose,
}: {
  item: Subscription;
  status: SubscriptionStatus;
  onClose: () => void;
}) {
  const [edit, { isLoading }] = useEditSubscriptionMutation();
  const [error, setError] = useState('');
  const notify = useToast();
  const action =
    status === 'ACTIVE'
      ? 'Resume tracking'
      : status === 'PAUSED'
        ? 'Pause tracking'
        : 'Mark as cancelled';
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title={`${action}?`}
      description={
        status === 'ACTIVE'
          ? `${item.label} will rejoin your upcoming estimates. This does not restart billing with the merchant.`
          : `${item.label} will leave your upcoming estimates. This does not cancel or pause merchant billing; contact ${item.merchant.name} directly. Payment history remains available.`
      }
    >
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" disabled={isLoading} onClick={onClose}>
          Keep current status
        </Button>
        <Button
          variant={status === 'CANCELLED' ? 'danger' : 'primary'}
          loading={isLoading}
          onClick={() => {
            void edit({ id: item.id, body: { revision: item.revision, status } })
              .unwrap()
              .then(() => {
                notify(action === 'Mark as cancelled' ? 'Marked as cancelled' : 'Tracking updated');
                onClose();
              })
              .catch((error) => setError(transferError(error).message));
          }}
        >
          {action}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
