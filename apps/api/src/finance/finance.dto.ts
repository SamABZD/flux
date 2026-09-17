import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionDirection,
} from '../generated/prisma/enums';

export class TransactionQueryDto {
  @IsOptional() @IsString() @MaxLength(64) account?: string;
  @IsOptional() @IsEnum(TransactionCategory) category?: TransactionCategory;
  @IsOptional() @IsEnum(TransactionStatus) status?: TransactionStatus;
  @IsOptional() @IsEnum(TransactionDirection) direction?: TransactionDirection;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsString() @MaxLength(100) merchant?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class CategoryUpdateDto {
  @IsEnum(TransactionCategory) category!: TransactionCategory;
}
export class OverviewQueryDto {
  @IsOptional() @IsString() @MaxLength(64) account?: string;
}
