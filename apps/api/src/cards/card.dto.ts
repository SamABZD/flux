import {
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
import { CardPaymentType, TransactionCategory } from '../generated/prisma/enums';
const present = (_object: unknown, value: unknown) => value !== undefined;
export class CreateCardDto {
  @IsIn(['VIRTUAL', 'SINGLE_USE']) type!: 'VIRTUAL' | 'SINGLE_USE';
  @IsString() @MinLength(2) @MaxLength(32) @Matches(/\S/) label!: string;
}
export class PatchCardDto {
  @ValidateIf(present) @IsString() @MinLength(2) @MaxLength(32) @Matches(/\S/) label?: string;
  @ValidateIf(present) @IsIn(['ACTIVE', 'FROZEN']) status?: 'ACTIVE' | 'FROZEN';
  @IsOptional() @IsInt() @Min(1) @Max(100000000) monthlyLimitMinor?: number | null;
  @ValidateIf(present) @IsBoolean() onlinePayments?: boolean;
  @ValidateIf(present) @IsBoolean() contactlessPayments?: boolean;
  @ValidateIf(present) @IsBoolean() atmWithdrawals?: boolean;
  @ValidateIf(present) @IsBoolean() magstripePayments?: boolean;
  @ValidateIf(present) @IsBoolean() locationSecurity?: boolean;
}
export class RevealCardDto {
  @IsString() @Matches(/^\d{4}$/) pin!: string;
}
export class TerminateCardDto {
  @IsIn(['TERMINATE']) confirmation!: 'TERMINATE';
}
export class AuthorizeCardDto {
  @IsString() @MinLength(1) @MaxLength(80) cardId!: string;
  @IsInt() @Min(1) @Max(2147483646) credentialVersion!: number;
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/) merchantName!: string;
  @IsEnum(TransactionCategory) merchantCategory!: TransactionCategory;
  @IsInt() @Min(1) @Max(100000000) amountMinor!: number;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsEnum(CardPaymentType) paymentType!: CardPaymentType;
  @ValidateIf(present) @IsBoolean() isSubscription?: boolean;
  @ValidateIf(present) @IsBoolean() requiresPin?: boolean;
  @ValidateIf(present) @IsString() @Matches(/^[A-Z]{2}$/) merchantLocation?: string;
  @ValidateIf(present) @IsString() @Matches(/^[A-Z]{2}$/) cardholderLocation?: string;
  @ValidateIf(present) @IsString() @MaxLength(140) note?: string;
}
export class RefundCardDto {
  @IsString() @MinLength(2) @MaxLength(120) @Matches(/\S/) reason!: string;
}
