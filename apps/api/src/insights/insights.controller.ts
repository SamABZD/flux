import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DemoSessionGuard } from '../transfers/demo-session';
import type { SessionRequest } from '../transfers/demo-session';
import {
  AnalyticsQueryDto,
  CreateBudgetDto,
  EditBudgetDto,
  InsightMonthDto,
  ReportingCurrencyDto,
  RevisionDto,
  CreateSubscriptionDto,
  EditSubscriptionDto,
} from './insights.dto';
import { AnalyticsService } from './analytics.service';
import { BudgetsService } from './budgets.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('analytics')
@UseGuards(DemoSessionGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}
  @Get('summary') summary(@Req() request: SessionRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.summary(request.userId, query);
  }
  @Get('spending') async spending(
    @Req() request: SessionRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    const result = await this.analytics.summary(request.userId, query);
    return {
      range: result.range,
      baseCurrency: result.baseCurrency,
      spendingMinor: result.spendingMinor,
      previousSpendingMinor: result.previousSpendingMinor,
      trend: result.trend,
      previousTrend: result.previousTrend,
    };
  }
  @Get('categories') async categories(
    @Req() request: SessionRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    const result = await this.analytics.summary(request.userId, query);
    return { range: result.range, baseCurrency: result.baseCurrency, items: result.categories };
  }
  @Get('merchants') async merchants(
    @Req() request: SessionRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    const result = await this.analytics.summary(request.userId, query);
    return { range: result.range, baseCurrency: result.baseCurrency, items: result.merchants };
  }
  @Get('income') async income(@Req() request: SessionRequest, @Query() query: AnalyticsQueryDto) {
    const result = await this.analytics.summary(request.userId, query);
    return {
      range: result.range,
      baseCurrency: result.baseCurrency,
      incomeMinor: result.incomeMinor,
      previousIncomeMinor: result.previousIncomeMinor,
      sources: result.incomeSources,
      merchants: result.incomeMerchants,
    };
  }
  @Get('cashflow') async cashflow(
    @Req() request: SessionRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    const result = await this.analytics.summary(request.userId, query);
    return {
      range: result.range,
      baseCurrency: result.baseCurrency,
      spendingMinor: result.spendingMinor,
      incomeMinor: result.incomeMinor,
      netCashFlowMinor: result.netCashFlowMinor,
      previousNetCashFlowMinor: result.previousNetCashFlowMinor,
      transfersOutMinor: result.transfersOutMinor,
      transfersInMinor: result.transfersInMinor,
    };
  }
}
@Controller('budgets')
@UseGuards(DemoSessionGuard)
export class BudgetsController {
  constructor(@Inject(BudgetsService) private readonly budgets: BudgetsService) {}
  @Get() list(@Req() request: SessionRequest, @Query() query: InsightMonthDto) {
    return this.budgets.list(request.userId, query);
  }
  @Post() create(
    @Req() request: SessionRequest,
    @Headers('idempotency-key') key = '',
    @Body() body: CreateBudgetDto,
  ) {
    return this.budgets.create(request.userId, key, body);
  }
  @Patch(':id') edit(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: EditBudgetDto,
  ) {
    return this.budgets.edit(request.userId, id, body);
  }
  @Post(':id/archive') archive(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: RevisionDto,
  ) {
    return this.budgets.archive(request.userId, id, body.revision);
  }
  @Delete(':id') remove(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: RevisionDto,
  ) {
    return this.budgets.archive(request.userId, id, body.revision);
  }
}
@Controller('subscriptions')
@UseGuards(DemoSessionGuard)
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}
  @Get() list(@Req() request: SessionRequest, @Query() query: ReportingCurrencyDto) {
    return this.subscriptions.read(request.userId, query.baseCurrency);
  }
  @Post() create(
    @Req() request: SessionRequest,
    @Headers('idempotency-key') key = '',
    @Body() body: CreateSubscriptionDto,
  ) {
    return this.subscriptions.create(request.userId, key, body);
  }
  @Patch(':id') edit(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: EditSubscriptionDto,
  ) {
    return this.subscriptions.edit(request.userId, id, body);
  }
}
