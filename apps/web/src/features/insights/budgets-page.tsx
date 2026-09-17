import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowUpRight, Plus, Target } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { MoneyInput } from '@/design-system/money-input';
import { ResponsiveDialog } from '@/design-system/modal';
import { Badge } from '@/design-system/badge';
import { EmptyState, ErrorState, Skeleton } from '@/design-system/feedback';
import { useToast } from '@/design-system/toast';
import { amountMinor } from '@/features/transfers/draft';
import { transferError } from '@/features/transfers/transfers-api';
import { currencies, categories } from '@/features/finance/types';
import type { Currency, TransactionCategory } from '@/features/finance/types';
import { categoryNames, formatMoney } from '@/features/finance/format';
import { InsightNavigation } from './insight-controls';
import {
  useGetBudgetsQuery,
  useCreateBudgetMutation,
  useEditBudgetMutation,
  useArchiveBudgetMutation,
} from './insights-api';
import type { BudgetItem } from './types';
import './insights.css';

export function BudgetsPage() {
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? new Date().toISOString().slice(0, 7);
  const baseCurrency = currencies.find((item) => item === params.get('baseCurrency')) ?? 'USD';
  const query = useGetBudgetsQuery(
    { month, baseCurrency },
    { refetchOnMountOrArgChange: true, refetchOnFocus: true },
  );
  const data = query.currentData;
  const [editing, setEditing] = useState<BudgetItem | 'new' | null>(null);
  const [archiving, setArchiving] = useState<BudgetItem | null>(null);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const monthName =
    /^\d{4}-\d{2}$/.test(month) && Number(month.slice(5)) >= 1 && Number(month.slice(5)) <= 12
      ? new Intl.DateTimeFormat('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(month + '-01'))
      : 'Selected month';
  return (
    <>
      <PageHeader
        title="Budgets"
        description="Make room for what matters this month."
        actions={
          <Button
            leadingIcon={<Plus size={17} />}
            onClick={() => setEditing('new')}
            disabled={!data?.editable}
          >
            Create budget
          </Button>
        }
      />
      <InsightNavigation active="budgets" />
      <div className="planning-toolbar">
        <Input
          label="Budget month"
          type="month"
          value={month}
          max={new Date().toISOString().slice(0, 7)}
          onChange={(event) => {
            if (event.target.value) update('month', event.target.value);
          }}
        />
        <Select
          label="Reporting currency"
          value={baseCurrency}
          onChange={(event) => update('baseCurrency', event.target.value)}
        >
          {currencies.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </Select>
      </div>
      {query.isError && !data ? (
        <ErrorState
          headingLevel={2}
          title="Budgets couldn’t load"
          description="Check the month or try again. Your saved targets are unchanged."
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <div className="insight-loading">
          <Skeleton height="5rem" />
          <Skeleton height="15rem" />
        </div>
      ) : (
        <>
          {query.isError && (
            <ErrorState
              headingLevel={2}
              title="Couldn’t refresh budgets"
              description="The last loaded targets and progress are shown below. Retry for current figures."
              onRetry={() => void query.refetch()}
            />
          )}
          <section className="budget-summary" aria-label="Budget summary">
            <div>
              <p>{monthName} · planned spending</p>
              <strong className="money">{formatMoney(data.totalPlannedMinor, baseCurrency)}</strong>
              <span>
                Across {data.items.length} categor{data.items.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
            <div>
              <span>Spent in budgeted categories</span>
              <strong className="money">{formatMoney(data.totalSpentMinor, baseCurrency)}</strong>
              <span>
                {data.editable
                  ? `${data.daysRemaining} days left, including today`
                  : 'Past month · targets preserved'}
              </span>
            </div>
            <div>
              <span>Remaining across enabled budgets</span>
              <strong className="money">
                {formatMoney(data.totalPlannedMinor - data.totalSpentMinor, baseCurrency)}
              </strong>
              {data.items.some((item) => !item.enabled) && (
                <span>Disabled budgets are excluded</span>
              )}
            </div>
          </section>
          <p className="finance-caption">
            Budgets track spending across your accounts. They don’t block payments. Each target
            keeps its own currency.
          </p>
          {data.items.length ? (
            <ul className="budget-list">
              {data.items.map((item) => (
                <li key={item.id} className={'budget-row budget-row--' + item.status.toLowerCase()}>
                  <div className="budget-row-heading">
                    <Link
                      to={`/analytics/categories/${item.category}?baseCurrency=${item.currency}&dateFrom=${month}-01&dateTo=${data.editable ? new Date().toISOString().slice(0, 10) : new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)}`}
                    >
                      <h2>{categoryNames[item.category]}</h2>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                    <Badge
                      tone={
                        item.status === 'OVER'
                          ? 'error'
                          : item.status === 'NEAR' || item.status === 'AT_LIMIT'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {item.status === 'DISABLED'
                        ? 'Disabled'
                        : item.status === 'AT_LIMIT'
                          ? 'At limit'
                          : item.status === 'OVER'
                            ? 'Over budget'
                            : item.status === 'NEAR'
                              ? 'Close to limit'
                              : 'Within budget'}
                    </Badge>
                  </div>
                  <div className="budget-amounts">
                    <span>
                      <strong className="money">
                        {formatMoney(item.spentMinor, item.currency)}
                      </strong>{' '}
                      of {formatMoney(item.amountMinor, item.currency)}
                    </span>
                    <span className="money">
                      {formatMoney(Math.abs(item.remainingMinor), item.currency)}{' '}
                      {item.remainingMinor < 0 ? 'over' : 'left'}
                    </span>
                  </div>
                  <div
                    className="budget-progress"
                    role="progressbar"
                    aria-label={`${categoryNames[item.category]} budget used`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.max(0, Math.min(100, item.usagePercent))}
                    aria-valuetext={`${item.usagePercent}% used. ${formatMoney(Math.abs(item.remainingMinor), item.currency)} ${item.remainingMinor < 0 ? 'over budget' : 'remaining'}.`}
                  >
                    <span style={{ width: Math.max(0, Math.min(100, item.usagePercent)) + '%' }} />
                  </div>
                  <p className="finance-caption">
                    {item.usagePercent}% used
                    {item.spentMinor < 0 ? ' · Refunds exceed spending this month' : ''}
                  </p>
                  {data.editable && item.enabled && (
                    <p className="budget-forecast">
                      Projected month end:{' '}
                      <strong className="money">
                        {formatMoney(item.projectedMinor, item.currency)}
                      </strong>
                      .
                      {item.projectedOverMinor > 0
                        ? ` At the current pace, spending may exceed your target by ${formatMoney(item.projectedOverMinor, item.currency)}.`
                        : ' Based on your spending pace so far.'}
                    </p>
                  )}
                  <div className="budget-row-footer">
                    <p>
                      {item.transactionCount} payments
                      {data.editable && item.remainingMinor > 0
                        ? ` · ${formatMoney(item.dailyAllowanceMinor, item.currency)} per day remaining`
                        : ''}
                    </p>
                    {data.editable && (
                      <div>
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(item)}
                          aria-label={`Edit ${categoryNames[item.category]} budget`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setArchiving(item)}
                          aria-label={`Delete ${categoryNames[item.category]} budget`}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              headingLevel={2}
              icon={<Target size={30} />}
              title={data.editable ? 'Start with one category' : 'No budgets for this month'}
              description={
                data.editable
                  ? 'Set a monthly target for dining, groceries or another part of your spending.'
                  : 'Choose another month to see the targets that applied then.'
              }
              action={
                data.editable ? (
                  <Button onClick={() => setEditing('new')}>Create your first budget</Button>
                ) : undefined
              }
            />
          )}
          <details className="insight-method">
            <summary>How budget usage works</summary>
            <p>
              {data.fx} Targets repeat each month until changed, disabled or deleted. Editing this
              month preserves previous months’ targets. Deletion removes the target from this month
              onward. Projections divide non-negative net spending by elapsed calendar days,
              including today, then multiply by days in the month. They are estimates; the current
              day is incomplete.
            </p>
          </details>
        </>
      )}
      {editing && (
        <BudgetEditor
          budget={editing === 'new' ? null : editing}
          taken={data?.items.map((item) => item.category) ?? []}
          onClose={() => {
            setEditing(null);
            void query.refetch();
          }}
        />
      )}
      {archiving && (
        <ArchiveBudget
          budget={archiving}
          onClose={() => {
            setArchiving(null);
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
function BudgetEditor({
  budget,
  taken,
  onClose,
}: {
  budget: BudgetItem | null;
  taken: TransactionCategory[];
  onClose: () => void;
}) {
  const [category, setCategory] = useState<TransactionCategory>(
    budget?.category ??
      categories.find((item) => item !== 'income' && !taken.includes(item)) ??
      'dining',
  );
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? 'USD');
  const [amount, setAmount] = useState(budget ? (budget.amountMinor / 100).toFixed(2) : '');
  const [enabled, setEnabled] = useState(budget?.enabled ?? true);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [create, creation] = useCreateBudgetMutation();
  const [edit, editing] = useEditBudgetMutation();
  const loading = creation.isLoading || editing.isLoading;
  const notify = useToast();
  const save = async () => {
    const value = amountMinor(amount);
    if (value === null) return;
    setError('');
    try {
      if (budget)
        await edit({
          id: budget.id,
          revision: budget.revision,
          amountMinor: value,
          enabled,
        }).unwrap();
      else await create({ key, body: { category, currency, amountMinor: value } }).unwrap();
      notify('Budget saved');
      onClose();
    } catch (error) {
      const failure = transferError(error);
      setUncertain(failure.ambiguous);
      setError(
        failure.ambiguous
          ? 'The save could not be confirmed. Retry these same values, or close and inspect your budgets before editing again.'
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
      title={budget ? `Edit ${categoryNames[budget.category]} budget` : 'Create a monthly budget'}
      description="A spending target across your accounts. Changes start this month."
    >
      <form
        className="planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Select
          label="Category"
          value={category}
          disabled={Boolean(budget) || loading || uncertain}
          onChange={(event) => setCategory(event.target.value as TransactionCategory)}
        >
          {categories
            .filter((item) => item !== 'income')
            .map((item) => (
              <option key={item} value={item} disabled={!budget && taken.includes(item)}>
                {categoryNames[item]}
              </option>
            ))}
        </Select>
        <Select
          label="Budget currency"
          value={currency}
          disabled={Boolean(budget) || loading || uncertain}
          onChange={(event) => setCurrency(event.target.value as Currency)}
        >
          {currencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        <MoneyInput
          label="Monthly target"
          currency={currency}
          value={amount}
          onValueChange={setAmount}
          disabled={loading || uncertain}
          hint="Payments remain available even if you go over your target."
        />
        {budget && (
          <Select
            label="Budget status"
            value={enabled ? 'enabled' : 'disabled'}
            disabled={loading || uncertain}
            onChange={(event) => setEnabled(event.target.value === 'enabled')}
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </Select>
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
          <Button type="submit" loading={loading} disabled={amountMinor(amount) === null}>
            {uncertain ? 'Retry save' : 'Save budget'}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
function ArchiveBudget({ budget, onClose }: { budget: BudgetItem; onClose: () => void }) {
  const [archive, { isLoading }] = useArchiveBudgetMutation();
  const [error, setError] = useState('');
  const notify = useToast();
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title={`Delete ${categoryNames[budget.category]} budget?`}
      description="This removes the target for this month and future months. Previous months and all transactions remain available."
    >
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" disabled={isLoading} onClick={onClose}>
          Keep budget
        </Button>
        <Button
          variant="danger"
          loading={isLoading}
          onClick={() => {
            void archive({ id: budget.id, revision: budget.revision })
              .unwrap()
              .then(() => {
                notify('Budget deleted');
                onClose();
              })
              .catch((error) => setError(transferError(error).message));
          }}
        >
          Delete budget
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
