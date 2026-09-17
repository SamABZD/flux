import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TransfersModule } from '../transfers/transfers.module';
import {
  AnalyticsController,
  BudgetsController,
  SubscriptionsController,
} from './insights.controller';
import { AnalyticsService } from './analytics.service';
import { BudgetsService } from './budgets.service';
import { SubscriptionsService } from './subscriptions.service';
@Module({
  imports: [DatabaseModule, TransfersModule],
  controllers: [AnalyticsController, BudgetsController, SubscriptionsController],
  providers: [AnalyticsService, BudgetsService, SubscriptionsService],
  exports: [AnalyticsService],
})
export class InsightsModule {}
