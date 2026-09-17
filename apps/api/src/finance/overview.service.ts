import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { DEMO_AS_OF, DEMO_USER_ID } from './transaction-query';
import { equivalentUsdMinor, USD_RATE_MICROS } from './finance-mappers';
import { AnalyticsService } from '../insights/analytics.service';
import { AnalyticsQueryDto } from '../insights/insights.dto';

@Injectable()
export class OverviewService {
  constructor(
    @Inject(FinanceService) private readonly finance: FinanceService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}
  async overview(accountId = 'usd') {
    const workspace = await this.finance.accounts();
    const selected = workspace.items.find((account) => account.id === accountId);
    if (!selected) throw new NotFoundException('Account not found.');
    const insight = await this.analytics.summary(
      DEMO_USER_ID,
      Object.assign(new AnalyticsQueryDto(), {
        accountId,
        baseCurrency: selected.currency,
        period: 'month',
        limit: 1,
      }),
    );
    return {
      ...workspace,
      asOf: insight.asOf,
      totalBalanceMinor: equivalentUsdMinor(workspace.items),
      reportingCurrency: 'USD' as const,
      fx: { label: 'Illustrative demo rates', asOf: DEMO_AS_OF, usdRateMicros: USD_RATE_MICROS },
      spending: {
        accountId,
        currency: selected.currency,
        currentMinor: insight.spendingMinor,
        previousMinor: insight.previousSpendingMinor,
        changePercent: insight.spendingChangePercent,
        month: insight.range.dateFrom,
        previousMonth: insight.range.previousFrom,
        throughDay: Number(insight.range.dateTo.slice(8)),
        daily: insight.trend.map((point) => ({
          day: Number(point.date.slice(8)),
          amountMinor: point.amountMinor,
        })),
        categories: insight.categories.map(({ category, amountMinor }) => ({
          category,
          amountMinor,
        })),
      },
    };
  }
}
