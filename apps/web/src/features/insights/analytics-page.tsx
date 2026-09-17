import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChartLine } from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { EmptyState, ErrorState, Skeleton } from '@/design-system/feedback';
import { categoryNames, formatMoney, formatDate } from '@/features/finance/format';
import { categories } from '@/features/finance/types';
import { MerchantIcon } from '@/features/finance/transaction-rows';
import { useGetAnalyticsQuery } from './insights-api';
import {
  InsightControls,
  InsightNavigation,
  readInsightFilters,
  rangeLabel,
  Comparison,
} from './insight-controls';
import { SpendingTrend } from './spending-trend';
import type { Analytics } from './types';
import './insights.css';

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const route = useParams();
  const location = useLocation();
  const filters = readInsightFilters(params);
  const category = categories.find((item) => item === route.category);
  const merchantId = route.merchantId;
  const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
  const query = useGetAnalyticsQuery(
    {
      ...filters,
      ...(category ? { category } : {}),
      ...(merchantId ? { merchantId } : {}),
      page: Math.floor(page),
      limit: route.category || merchantId ? 20 : 5,
      direction: params.get('direction') === 'income' ? 'income' : 'spending',
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      skip: Boolean(route.category && !category),
    },
  );
  const data = query.currentData;
  const detail = Boolean(route.category || merchantId);
  const suffix = new URLSearchParams(params);
  suffix.delete('page');
  suffix.delete('direction');
  const search = suffix.size ? '?' + suffix.toString() : '';
  const title = category
    ? categoryNames[category]
    : merchantId
      ? (data?.selectedMerchant?.name ?? 'Merchant activity')
      : 'Analytics';
  const changePage = (value: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(value));
    setParams(next);
  };
  return (
    <>
      <PageHeader
        title={title}
        description={
          detail
            ? 'The activity behind your spending.'
            : 'A clearer picture of where your money goes.'
        }
        actions={
          detail ? (
            <Link className="button button--secondary" to={'/analytics' + search}>
              <ArrowLeft size={16} />
              All analytics
            </Link>
          ) : undefined
        }
      />
      <InsightNavigation active="analytics" />
      <InsightControls accounts={query.data?.accounts ?? []} />
      {route.category && !category ? (
        <ErrorState
          headingLevel={2}
          title="Category not found"
          description="Choose a category from Analytics to explore its activity."
        />
      ) : query.isError && !data ? (
        <ErrorState
          headingLevel={2}
          title="Analytics couldn’t load"
          description="Check your dates and account, or try loading again. Your filters are kept in the address."
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <div className="insight-loading" aria-label="Loading analytics">
          <Skeleton height="3.5rem" width="16rem" />
          <Skeleton height="15rem" />
          <Skeleton height="12rem" />
        </div>
      ) : (
        <div className="insight-content" aria-busy={query.isFetching}>
          {query.isError && (
            <ErrorState
              headingLevel={2}
              title="Couldn’t refresh analytics"
              description="The last loaded figures are shown below. Try again to refresh them."
              onRetry={() => void query.refetch()}
            />
          )}
          <section className="insight-spending" aria-label="Period spending">
            <div className="insight-spending-heading">
              <div>
                <p className="insight-period-label">
                  {detail ? title + ' spending' : 'Your spending'}{' '}
                  <span>· {data.baseCurrency}</span>
                </p>
                <div className="insight-spending-value money">
                  {formatMoney(data.spendingMinor, data.baseCurrency)}
                </div>
                <Comparison
                  current={rangeLabel(data.range.dateFrom, data.range.dateTo)}
                  previous={rangeLabel(data.range.previousFrom, data.range.previousTo)}
                  percent={data.spendingChangePercent}
                />
                {!detail && (
                  <p className="insight-context-totals">
                    Income{' '}
                    <strong className="money">
                      {formatMoney(data.incomeMinor, data.baseCurrency)}
                    </strong>
                    <span aria-hidden="true"> · </span>Net cash flow{' '}
                    <strong className="money">
                      {formatMoney(data.netCashFlowMinor, data.baseCurrency)}
                    </strong>
                  </p>
                )}
              </div>
              <div className="insight-previous">
                <span>Previous period</span>
                <strong className="money">
                  {formatMoney(data.previousSpendingMinor, data.baseCurrency)}
                </strong>
                <span>
                  {data.transactionCount} outgoing payment{data.transactionCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <SpendingTrend
              key={`${data.range.dateFrom}:${data.range.dateTo}:${data.baseCurrency}:${data.accountId}:${title}`}
              points={data.trend}
              bucket={data.range.bucket}
              currency={data.baseCurrency}
            />
            {data.transactionCount === 0 && data.spendingMinor === 0 && (
              <p className="insight-empty-note">
                No settled spending in this range. Try another period or account to explore your
                history.
              </p>
            )}
          </section>
          {detail ? (
            <div className="insight-detail-stats">
              <div>
                <span>Payments</span>
                <strong>{data.transactionCount}</strong>
              </div>
              <div>
                <span>Average payment</span>
                <strong className="money">
                  {formatMoney(data.averageTransactionMinor, data.baseCurrency)}
                </strong>
              </div>
            </div>
          ) : null}
          <div className="insight-breakdowns">
            {!detail && (
              <section aria-label="Spending by category">
                <SectionHeader
                  title="Where it went"
                  description="Net spending after refunds · bars show shares of positive category totals"
                />
                <ul className="insight-categories">
                  {data.categories.map((item, index) => (
                    <li key={item.category}>
                      <Link to={`/analytics/categories/${item.category}${search}`}>
                        <span className="insight-category-label">
                          <span
                            className={`insight-category-dot insight-category-dot--${index % 4}`}
                            aria-hidden="true"
                          />
                          {categoryNames[item.category]}
                        </span>
                        <span className="money">
                          {formatMoney(item.amountMinor, data.baseCurrency)}
                        </span>
                        <span className="insight-category-bar" aria-hidden="true">
                          <span style={{ width: `${item.sharePercent}%` }} />
                        </span>
                        <span className="insight-category-share">
                          {item.sharePercent}%<ArrowUpRight size={14} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!data.categories.length && (
                  <p className="finance-caption">Categories appear when spending settles.</p>
                )}
              </section>
            )}
            {!merchantId && (
              <section aria-label="Top merchants">
                <SectionHeader
                  title="Most spent with"
                  description="Your top merchants, after refunds"
                />
                <ul className="insight-merchants">
                  {data.merchants.slice(0, detail ? 10 : 6).map((item) => (
                    <li key={item.merchant.id}>
                      <Link
                        to={`/analytics/merchants/${encodeURIComponent(item.merchant.id)}${search}`}
                      >
                        <MerchantIcon merchant={item.merchant} />
                        <span>
                          <strong>{item.merchant.name}</strong>
                          <small>
                            {item.count} payment{item.count === 1 ? '' : 's'}
                          </small>
                        </span>
                        <strong className="money">
                          {formatMoney(item.amountMinor, data.baseCurrency)}
                        </strong>
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {!data.merchants.length && (
                  <p className="finance-caption">No merchants in this range.</p>
                )}
              </section>
            )}
          </div>
          {!detail && <IncomeSummary data={data} />}
          <section className="insight-activity" aria-label="Underlying transactions">
            <SectionHeader
              title={
                detail
                  ? 'Related transactions'
                  : params.get('direction') === 'income'
                    ? 'Money received'
                    : 'Recent spending'
              }
              description={`Original account amounts · ${data.transactions.total} ${params.get('direction') === 'income' ? 'incoming' : 'outgoing'} transaction${data.transactions.total === 1 ? '' : 's'}`}
              action={
                !detail ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set(
                        'direction',
                        params.get('direction') === 'income' ? 'spending' : 'income',
                      );
                      next.delete('page');
                      setParams(next, { replace: true });
                    }}
                  >
                    {params.get('direction') === 'income' ? 'Show spending' : 'Show income'}
                  </Button>
                ) : undefined
              }
            />
            {data.transactions.items.length ? (
              <ul className="insight-transactions">
                {data.transactions.items.map((row) => (
                  <li key={row.transaction.id}>
                    <Link
                      to={`/transactions/${row.transaction.id}?from=${encodeURIComponent(location.pathname + location.search)}`}
                    >
                      <MerchantIcon merchant={row.transaction.merchant} />
                      <span>
                        <strong>{row.transaction.merchant.name}</strong>
                        <small>
                          {formatDate(row.transaction.timestamp)} · {row.transaction.currency}
                        </small>
                      </span>
                      <span className="insight-transaction-amount">
                        <strong className="money">
                          {formatMoney(row.transaction.amountMinor, row.transaction.currency)}
                        </strong>
                        <small>
                          {row.feeOnly ? 'Fee counted: ' : 'Reported: '}
                          {formatMoney(row.reportingAmountMinor, data.baseCurrency)}
                        </small>
                      </span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ChartLine size={28} />}
                title="No matching activity"
                description="Change the period or account to see more of your history."
              />
            )}
            {data.transactions.totalPages > 1 && (
              <nav className="transaction-pagination" aria-label="Insight transaction pages">
                <p>
                  Page {data.transactions.page} of {data.transactions.totalPages}
                </p>
                <div>
                  <Button
                    variant="secondary"
                    leadingIcon={<ArrowLeft size={16} />}
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => changePage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    leadingIcon={<ArrowRight size={16} />}
                    disabled={page >= data.transactions.totalPages || query.isFetching}
                    onClick={() => changePage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </section>
          <InsightMethod data={data} />
        </div>
      )}
    </>
  );
}
function IncomeSummary({ data }: { data: Analytics }) {
  const sourceNames: Record<string, string> = {
    income: 'Salary & other income',
    refunds: 'Refunds',
    transfers: 'Transfers received',
  };
  return (
    <section className="insight-cashflow" aria-label="Income and cash flow">
      <SectionHeader
        title="In, out, and what’s left"
        description="Income minus outgoing spending for the selected period"
      />
      <dl className="insight-cashflow-values">
        <div>
          <dt>Income</dt>
          <dd className="money">{formatMoney(data.incomeMinor, data.baseCurrency)}</dd>
        </div>
        <div>
          <dt>Spending</dt>
          <dd className="money">{formatMoney(data.spendingMinor, data.baseCurrency)}</dd>
        </div>
        <div>
          <dt>Net cash flow</dt>
          <dd className="money">
            {data.netCashFlowMinor > 0 ? '+' : ''}
            {formatMoney(data.netCashFlowMinor, data.baseCurrency)}
          </dd>
        </div>
      </dl>
      <p className="finance-caption">
        {data.incomeChangePercent === null
          ? 'No income in the comparison period.'
          : `${Math.abs(data.incomeChangePercent)}% ${data.incomeChangePercent > 0 ? 'more' : data.incomeChangePercent < 0 ? 'less' : 'change in'} income than the comparison period.`}{' '}
        Previously {formatMoney(data.previousIncomeMinor, data.baseCurrency)}.
      </p>
      <p className="finance-caption">
        Transfers shown separately: {formatMoney(data.transfersOutMinor, data.baseCurrency)} sent ·{' '}
        {formatMoney(data.transfersInMinor, data.baseCurrency)} received. Transfer principal is
        excluded from income and spending.
      </p>
      <div className="insight-income-detail">
        <div>
          <h3>Income sources</h3>
          <ul>
            {data.incomeSources.map((item) => (
              <li key={item.source}>
                <span>{sourceNames[item.source] ?? item.source}</span>
                <strong className="money">
                  {formatMoney(item.amountMinor, data.baseCurrency)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Main contributors</h3>
          <ul>
            {data.incomeMerchants.map((item) => (
              <li key={item.merchant.id}>
                <span>{item.merchant.name}</span>
                <strong className="money">
                  {formatMoney(item.amountMinor, data.baseCurrency)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
export function InsightMethod({ data }: { data: Analytics }) {
  return (
    <details className="insight-method">
      <summary>How these numbers are calculated</summary>
      <p>
        Settled purchases, cash withdrawals and transfer fees count as spending. Refunds reduce
        spending on the date credited, using the linked purchase’s current category when available.
        Unlinked legacy refunds use their recorded category. Net spending can be negative when
        refunds exceed purchases. Pending, declined, failed and reversed card payments are excluded.
      </p>
      <p>
        Transfers between your Flux currency accounts contribute only their fee, once. Their
        principal is excluded from both income and spending, even with an account filter. Net cash
        flow is income minus net spending, rather than a selected account’s balance change. External
        and unlinked legacy transfer principal is shown separately and never ranked as merchant
        spending.
      </p>
      <p>
        {data.fx.strategy} These are demo rates, not historical market quotes. Current-day figures
        are still accumulating; comparisons use the corresponding UTC dates.
      </p>
      <ul>
        {data.fx.rates.map((rate) => (
          <li key={rate.currency}>
            1 {rate.currency} = {(rate.usdMicros / 1000000).toFixed(6)} USD ·{' '}
            {formatDate(rate.updatedAt)}
          </li>
        ))}
      </ul>
    </details>
  );
}
