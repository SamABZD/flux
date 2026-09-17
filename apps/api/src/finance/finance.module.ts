import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { OverviewService } from './overview.service';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [DatabaseModule, InsightsModule],
  controllers: [FinanceController],
  providers: [FinanceService, OverviewService],
})
export class FinanceModule {}
