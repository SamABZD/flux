import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DemoSessionController, DemoSessionGuard, DemoSessionService } from './demo-session';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { QuotesService } from './quotes.service';
import { RecipientsService } from './recipients.service';
import { LedgerService } from './ledger.service';
import { DemoClearingService } from './demo-clearing.service';
@Module({
  imports: [DatabaseModule],
  controllers: [DemoSessionController, TransfersController],
  providers: [
    DemoSessionService,
    DemoSessionGuard,
    TransfersService,
    QuotesService,
    RecipientsService,
    LedgerService,
    DemoClearingService,
  ],
  exports: [DemoSessionService, DemoSessionGuard, LedgerService],
})
export class TransfersModule {}
