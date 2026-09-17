import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { DemoSessionGuard } from '../transfers/demo-session';
import type { SessionRequest } from '../transfers/demo-session';
import {
  CreateCardDto,
  PatchCardDto,
  RevealCardDto,
  TerminateCardDto,
  AuthorizeCardDto,
  RefundCardDto,
} from './card.dto';
import { CardsService } from './cards.service';
import { CardPaymentsService } from './card-payments.service';
@Controller('cards')
@UseGuards(DemoSessionGuard)
export class CardsController {
  constructor(@Inject(CardsService) private readonly cards: CardsService) {}
  @Get() list(@Req() request: SessionRequest) {
    return this.cards.list(request.userId);
  }
  @Post() create(@Req() request: SessionRequest, @Body() body: CreateCardDto) {
    return this.cards.create(request.userId, body);
  }
  @Get(':id') get(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.cards.get(request.userId, id);
  }
  @Patch(':id') patch(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: PatchCardDto,
  ) {
    return this.cards.patch(request.userId, id, body);
  }
  @Post(':id/terminate') terminate(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() _body: TerminateCardDto,
  ) {
    void _body;
    return this.cards.terminate(request.userId, id);
  }
  @Post(':id/reveal') reveal(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: RevealCardDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    return this.cards.reveal(request.userId, id, body.pin);
  }
  @Post(':id/wallet-enrollment') wallet(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.cards.enrollWallet(request.userId, id);
  }
  @Get(':id/audit') audit(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.cards.audit(request.userId, id);
  }
}
@Controller('card-payments')
@UseGuards(DemoSessionGuard)
export class CardPaymentsController {
  constructor(@Inject(CardPaymentsService) private readonly payments: CardPaymentsService) {}
  @Post('authorize') authorize(
    @Req() request: SessionRequest,
    @Headers('idempotency-key') key = '',
    @Body() body: AuthorizeCardDto,
  ) {
    return this.payments.authorize(request.userId, key, body);
  }
  @Get() list(@Req() request: SessionRequest, @Query('cardId') cardId?: string) {
    return this.payments.list(request.userId, cardId);
  }
  @Get('by-key/:key') byKey(@Req() request: SessionRequest, @Param('key') key: string) {
    return this.payments.byKey(request.userId, key);
  }
  @Get(':id') get(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.payments.get(request.userId, id);
  }
  @Post(':id/refund') refund(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key = '',
    @Body() body: RefundCardDto,
  ) {
    return this.payments.refund(request.userId, id, key, body);
  }
}
