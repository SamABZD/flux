import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DemoSessionGuard } from './demo-session';
import type { SessionRequest } from './demo-session';
import { RecipientDto, QuoteDto, ExecuteTransferDto } from './transfer.dto';
import { RecipientsService } from './recipients.service';
import { QuotesService } from './quotes.service';
import { TransfersService } from './transfers.service';

@Controller()
@UseGuards(DemoSessionGuard)
export class TransfersController {
  constructor(
    @Inject(RecipientsService) private readonly recipients: RecipientsService,
    @Inject(QuotesService) private readonly quotes: QuotesService,
    @Inject(TransfersService) private readonly transfers: TransfersService,
  ) {}
  @Get('recipients') listRecipients(@Req() request: SessionRequest) {
    return this.recipients.list(request.userId);
  }
  @Post('recipients') createRecipient(@Req() request: SessionRequest, @Body() body: RecipientDto) {
    return this.recipients.create(request.userId, body);
  }
  @Post('transfers/quote') quote(@Req() request: SessionRequest, @Body() body: QuoteDto) {
    return this.quotes.create(request.userId, body);
  }
  @Get('transfers/quotes/:id') getQuote(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.quotes.get(request.userId, id);
  }
  @Get('transfers') list(@Req() request: SessionRequest) {
    return this.transfers.list(request.userId);
  }
  @Get('transfers/by-key/:key') byKey(@Req() request: SessionRequest, @Param('key') key: string) {
    return this.transfers.byKey(request.userId, key);
  }
  @Get('transfers/:id') get(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.transfers.get(request.userId, id);
  }
  @Post('transfers') execute(
    @Req() request: SessionRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: ExecuteTransferDto,
  ) {
    return this.transfers.execute(request.userId, key ?? '', body);
  }
}
