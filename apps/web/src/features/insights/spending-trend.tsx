import { useId, useState } from 'react';
import type { PointerEvent } from 'react';
import { formatMoney, categoryNames } from '@/features/finance/format';
import type { Currency } from '@/features/finance/types';
import type { TrendPoint } from './types';
import { shortDate } from './insight-controls';

export function SpendingTrend({
  points,
  currency,
  bucket,
}: {
  points: TrendPoint[];
  currency: Currency;
  bucket: 'day' | 'month';
}) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const width = 760,
    height = 210,
    top = 16,
    bottom = 24,
    pad = 8;
  const max = Math.max(100, ...points.map((point) => point.amountMinor));
  const min = Math.min(0, ...points.map((point) => point.amountMinor));
  const x = (index: number) =>
    pad + (points.length > 1 ? index / (points.length - 1) : 0.5) * (width - 2 * pad);
  const y = (amount: number) =>
    height - bottom - ((amount - min) / (max - min)) * (height - bottom - top);
  const path = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.amountMinor)}`)
    .join(' ');
  const index = Math.min(selected ?? Math.max(0, points.length - 1), points.length - 1);
  const point = points[index];
  const label = (date: string) =>
    bucket === 'month'
      ? new Intl.DateTimeFormat('en-GB', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(date))
      : shortDate(date);
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setSelected(
      Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.round(((event.clientX - box.left) / box.width) * (points.length - 1)),
        ),
      ),
    );
  };
  return (
    <figure className={'insight-trend' + (focused ? ' insight-trend--focused' : '')}>
      <figcaption id={id}>
        Spending by {bucket}
        <span>
          {' '}
          {min < 0 ? `${formatMoney(min, currency)} to ` : ''}
          {formatMoney(max, currency)} scale
        </span>
      </figcaption>
      <div className="insight-chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Spending trend with ${points.length} ${bucket === 'month' ? 'monthly' : 'daily'} points. Use the chart selector or data table for exact amounts.`}
          onPointerMove={move}
          onPointerLeave={() => {
            if (!focused) setSelected(null);
          }}
        >
          <line className="insight-baseline" x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} />
          {points.length > 0 && (
            <>
              <path
                className="insight-area"
                d={`${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              />
              <path className="insight-line" d={path} />
              {point && (
                <circle className="insight-point" cx={x(index)} cy={y(point.amountMinor)} r="4" />
              )}
            </>
          )}
        </svg>
        {point && (selected !== null || focused) && (
          <div className="insight-chart-tooltip" role="status">
            <span>{label(point.date)}</span>
            <strong>{formatMoney(point.amountMinor, currency)} spent</strong>
            <span>
              {point.topCategory
                ? `Top category: ${categoryNames[point.topCategory]}`
                : 'No settled spending'}
            </span>
          </div>
        )}
        <input
          className="sr-only insight-chart-selector"
          type="range"
          aria-label="Select spending chart date"
          aria-valuetext={
            point
              ? `${label(point.date)}, ${formatMoney(point.amountMinor, currency)} spent${point.topCategory ? ', top category ' + categoryNames[point.topCategory] : ''}`
              : 'No data'
          }
          min={0}
          max={Math.max(0, points.length - 1)}
          value={Math.max(0, index)}
          onChange={(event) => setSelected(Number(event.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setSelected(null);
          }}
        />
      </div>
      <div className="insight-chart-labels" aria-hidden="true">
        <span>{points[0] ? label(points[0].date) : ''}</span>
        <span>{points.length > 1 ? label(points[points.length - 1]!.date) : ''}</span>
      </div>
      <details className="insight-chart-data">
        <summary>View chart data</summary>
        <table>
          <caption>Spending in {currency}</caption>
          <thead>
            <tr>
              <th scope="col">{bucket === 'month' ? 'Month' : 'Date'}</th>
              <th scope="col">Spent</th>
              <th scope="col">Top category</th>
            </tr>
          </thead>
          <tbody>
            {points.map((item) => (
              <tr key={item.date}>
                <th scope="row">{label(item.date)}</th>
                <td>{formatMoney(item.amountMinor, currency)}</td>
                <td>{item.topCategory ? categoryNames[item.topCategory] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
