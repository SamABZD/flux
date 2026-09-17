import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { TransfersModule } from './transfers/transfers.module';
import { CardsModule } from './cards/cards.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../../../.env'),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    FinanceModule,
    TransfersModule,
    CardsModule,
    InsightsModule,
  ],
})
export class AppModule {}
