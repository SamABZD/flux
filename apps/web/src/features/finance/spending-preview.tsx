import { ErrorState } from '@/design-system/feedback';
import { Link } from 'react-router';
import { useGetOverviewQuery } from './finance-api';
import { BalanceSkeleton } from './loading';
import { categoryNames, formatMoney, formatMonth } from './format';

export function SpendingPreview({ account }: { account: string }) {
  const query = useGetOverviewQuery(account);
  if (query.isError)
    return <ErrorState title="Spending unavailable" onRetry={() => void query.refetch()} />;
  if (!query.currentData) return <BalanceSkeleton />;
  const spending = query.currentData.spending;
  const max = Math.max(...spending.daily.map((day) => day.amountMinor), 1);
  const min = Math.min(...spending.daily.map((day) => day.amountMinor), 0);
  const y = (amount: number) => 96 - ((amount - min) / (max - min)) * 90;
  const step = 336 / Math.max(1, spending.daily.length);
  return (
    <>
      <h2>
        {formatMonth(spending.month)} spending <span>{spending.currency}</span>
      </h2>
      <p className="spending-value">{formatMoney(spending.currentMinor, spending.currency)}</p>
      <p className="spending-comparison">
        {spending.changePercent === null
          ? 'No spending to compare last month'
          : `${spending.changePercent > 0 ? '↑' : spending.changePercent < 0 ? '↓' : '→'} ${Math.abs(spending.changePercent)}% vs ${formatMonth(spending.previousMonth)}`}
        <span>First {spending.throughDay} days of each month</span>
      </p>
      <svg
        className="spending-chart"
        viewBox="0 0 336 100"
        role="img"
        aria-label={`Daily ${spending.currency} net spending for ${formatMonth(spending.month)} 1–${spending.throughDay}. Total ${formatMoney(spending.currentMinor, spending.currency)}. View analytics for an accessible data table.`}
      >
        {spending.daily.map((day, index) => (
          <rect
            key={day.day}
            x={index * step + step * 0.2}
            y={Math.min(y(0), y(day.amountMinor))}
            width={step * 0.6}
            height={Math.max(Math.abs(y(day.amountMinor) - y(0)), 1)}
            rx="3"
            className={day.amountMinor === max ? 'spending-chart-highlight' : undefined}
          >
            <title>{`${formatMonth(spending.month)} ${day.day}: ${formatMoney(day.amountMinor, spending.currency)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        <span>1 {formatMonth(spending.month)}</span>
        <span>
          {spending.throughDay} {formatMonth(spending.month)}
        </span>
      </div>
      <ul className="spending-categories" aria-label="Top spending categories">
        {spending.categories.slice(0, 3).map((item) => (
          <li key={item.category}>
            <span>{categoryNames[item.category]}</span>
            <span>{formatMoney(item.amountMinor, spending.currency)}</span>
          </li>
        ))}
      </ul>
      {!spending.categories.length && (
        <p className="finance-caption">No completed purchases this month.</p>
      )}
      <p className="finance-caption">
        Net spending after refunds. Transfer principal and unsettled payments are excluded.
      </p>
      <Link
        className="text-link"
        to={`/analytics?accountId=${encodeURIComponent(account)}&baseCurrency=${spending.currency}`}
      >
        View analytics
      </Link>
    </>
  );
}
