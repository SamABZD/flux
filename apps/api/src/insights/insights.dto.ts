import { Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  Currency,
  TransactionCategory,
  SubscriptionCadence,
  SubscriptionStatus,
} from '../generated/prisma/enums';

export const insightPeriods = ['week', 'month', 'quarter', 'half-year', 'year'] as const;
export type InsightPeriod = (typeof insightPeriods)[number];
export class AnalyticsQueryDto {
  @IsOptional() @IsIn(insightPeriods) period: InsightPeriod = 'month';
  @IsOptional() @IsEnum(Currency) baseCurrency: Currency = 'USD';
  @IsOptional() @IsString() @MaxLength(64) accountId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) dateTo?: string;
  @IsOptional() @IsEnum(TransactionCategory) category?: TransactionCategory;
  @IsOptional() @IsString() @MaxLength(100) merchantId?: string;
  @IsOptional() @IsIn(['spending', 'income']) direction: 'spending' | 'income' = 'spending';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
const present = (_object: unknown, value: unknown) => value !== undefined;
export class ReportingCurrencyDto {
  @IsOptional() @IsEnum(Currency) baseCurrency: Currency = 'USD';
}
export class InsightMonthDto extends ReportingCurrencyDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
}
export class CreateBudgetDto {
  @IsEnum(TransactionCategory) category!: TransactionCategory;
  @IsEnum(Currency) currency!: Currency;
  @IsInt() @Min(1) @Max(100000000) amountMinor!: number;
}
export class EditBudgetDto {
  @IsInt() @Min(1) revision!: number;
  @ValidateIf(present) @IsInt() @Min(1) @Max(100000000) amountMinor?: number;
  @ValidateIf(present) @IsBoolean() enabled?: boolean;
}
export class RevisionDto {
  @IsInt() @Min(1) revision!: number;
}
export class CreateSubscriptionDto {
  @IsString() @MinLength(1) @MaxLength(64) accountId!: string;
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/) merchantName!: string;
  @ValidateIf(present) @IsString() @MaxLength(100) merchantId?: string;
  @IsString() @MinLength(2) @MaxLength(60) @Matches(/\S/) label!: string;
  @IsInt() @Min(1) @Max(100000000) amountMinor!: number;
  @IsEnum(SubscriptionCadence) cadence!: SubscriptionCadence;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) nextPaymentDate!: string;
  @ValidateIf(present) @IsIn(['MANUAL', 'DETECTED']) source: 'MANUAL' | 'DETECTED' = 'MANUAL';
}
export class EditSubscriptionDto {
  @IsInt() @Min(1) revision!: number;
  @ValidateIf(present) @IsString() @MinLength(2) @MaxLength(60) @Matches(/\S/) label?: string;
  @ValidateIf(present) @IsInt() @Min(1) @Max(100000000) amountMinor?: number;
  @ValidateIf(present) @IsEnum(SubscriptionCadence) cadence?: SubscriptionCadence;
  @ValidateIf(present)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  nextPaymentDate?: string;
  @ValidateIf(present) @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
}
