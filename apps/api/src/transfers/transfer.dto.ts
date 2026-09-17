import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Currency, RecipientType, TransferKind } from '../generated/prisma/enums';
import { MAX_AMOUNT_MINOR } from './money';

export class RecipientDto {
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/) name!: string;
  @IsEnum(RecipientType) type!: RecipientType;
  @IsString() @Matches(/^[A-Z]{2}$/) country!: string;
  @IsEnum(Currency) preferredCurrency!: Currency;
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/) bankName!: string;
  @IsString() @Matches(/^[A-Z0-9][A-Z0-9 -]{5,33}$/) accountIdentifier!: string;
}
export class QuoteDto {
  @IsEnum(TransferKind) kind!: TransferKind;
  @IsString() @MinLength(1) @MaxLength(80) sourceAccountId!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) recipientId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) destinationAccountId?: string;
  @IsEnum(Currency) sourceCurrency!: Currency;
  @IsEnum(Currency) destinationCurrency!: Currency;
  @IsInt() @Min(1) @Max(MAX_AMOUNT_MINOR) destinationAmountMinor!: number;
}
export class ExecuteTransferDto {
  @IsUUID() quoteId!: string;
  @IsString() @MinLength(1) @MaxLength(80) sourceAccountId!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) recipientId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) destinationAccountId?: string;
  @IsOptional() @IsString() @MaxLength(140) note?: string;
}
