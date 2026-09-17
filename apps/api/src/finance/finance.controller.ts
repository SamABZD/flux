import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { OverviewService } from './overview.service';
import { CategoryUpdateDto, OverviewQueryDto, TransactionQueryDto } from './finance.dto';

@Controller()
export class FinanceController {
  constructor(
    @Inject(FinanceService) private readonly finance: FinanceService,
    @Inject(OverviewService) private readonly summaries: OverviewService,
  ) {}
  @Get('accounts') accounts() {
    return this.finance.accounts();
  }
  @Get('accounts/:id') account(@Param('id') id: string) {
    return this.finance.account(id);
  }
  @Get('transactions') transactions(@Query() query: TransactionQueryDto) {
    return this.finance.transactions(query);
  }
  @Get('transactions/:id') transaction(@Param('id') id: string) {
    return this.finance.transaction(id);
  }
  @Patch('transactions/:id/category') category(
    @Param('id') id: string,
    @Body() body: CategoryUpdateDto,
  ) {
    return this.finance.updateCategory(id, body);
  }
  @Get('merchants') merchants() {
    return this.finance.merchants();
  }
  @Get('overview') overview(@Query() query: OverviewQueryDto) {
    return this.summaries.overview(query.account);
  }
}
