import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TransfersModule } from '../transfers/transfers.module';
import { CardCredentialsService } from './card-credentials.service';
import { CardsService } from './cards.service';
import { CardPaymentsService } from './card-payments.service';
import { CardsController, CardPaymentsController } from './cards.controller';
@Module({
  imports: [DatabaseModule, TransfersModule],
  controllers: [CardsController, CardPaymentsController],
  providers: [CardCredentialsService, CardsService, CardPaymentsService],
})
export class CardsModule {}
