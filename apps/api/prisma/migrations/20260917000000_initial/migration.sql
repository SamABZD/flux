CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'AED');


CREATE TYPE "AccountStatus" AS ENUM ('active', 'frozen');


CREATE TYPE "TransactionStatus" AS ENUM ('completed', 'pending', 'refunded', 'failed');


CREATE TYPE "TransactionDirection" AS ENUM ('credit', 'debit');


CREATE TYPE "TransactionKind" AS ENUM ('purchase', 'income', 'transfer', 'refund');


CREATE TYPE "PaymentMethod" AS ENUM ('card', 'bank_transfer', 'direct_debit');


CREATE TYPE "TransactionCategory" AS ENUM ('dining', 'transport', 'shopping', 'subscriptions', 'entertainment', 'travel', 'groceries', 'utilities', 'health', 'other', 'income', 'transfers');


CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "balanceMinor" INTEGER NOT NULL,
    "openingBalanceMinor" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "location" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


CREATE INDEX "Account_userId_idx" ON "Account"("userId");


CREATE UNIQUE INDEX "Account_id_currency_key" ON "Account"("id", "currency");


CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");


CREATE INDEX "Transaction_accountId_timestamp_id_idx" ON "Transaction"("accountId", "timestamp" DESC, "id");


CREATE INDEX "Transaction_timestamp_id_idx" ON "Transaction"("timestamp" DESC, "id");


CREATE INDEX "Transaction_category_status_direction_idx" ON "Transaction"("category", "status", "direction");


ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_currency_fkey" FOREIGN KEY ("accountId", "currency") REFERENCES "Account"("id", "currency") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "RecipientType" AS ENUM ('person', 'business');


CREATE TYPE "RecipientStatus" AS ENUM ('active', 'blocked');


CREATE TYPE "TransferKind" AS ENUM ('send', 'exchange');


CREATE TYPE "TransferStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');


CREATE TYPE "LedgerAccountKind" AS ENUM ('customer', 'fx', 'fee', 'external', 'opening');


ALTER TABLE "Transaction" ADD COLUMN     "transferId" TEXT;


CREATE TABLE "DemoSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("tokenHash")
);


CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecipientType" NOT NULL,
    "country" TEXT NOT NULL,
    "preferredCurrency" "Currency" NOT NULL,
    "supportedCurrencies" "Currency"[],
    "bankName" TEXT NOT NULL,
    "accountIdentifier" TEXT NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMPTZ(3),
    "bankRoute" TEXT NOT NULL DEFAULT 'demo-clearing',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "FxRate" (
    "currency" "Currency" NOT NULL,
    "usdMicros" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("currency")
);


CREATE TABLE "TransferQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "recipientId" TEXT,
    "sourceAccountId" TEXT NOT NULL,
    "destinationAccountId" TEXT,
    "sourceCurrency" "Currency" NOT NULL,
    "destinationCurrency" "Currency" NOT NULL,
    "sourceAmountMinor" INTEGER NOT NULL,
    "destinationAmountMinor" INTEGER NOT NULL,
    "feeMinor" INTEGER NOT NULL,
    "totalDebitMinor" INTEGER NOT NULL,
    "sourceUsdMicros" INTEGER NOT NULL,
    "destinationUsdMicros" INTEGER NOT NULL,
    "rateLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TransferQuote_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "recipientId" TEXT,
    "sourceAccountId" TEXT NOT NULL,
    "destinationAccountId" TEXT,
    "quoteId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "sourceCurrency" "Currency" NOT NULL,
    "destinationCurrency" "Currency" NOT NULL,
    "sourceAmountMinor" INTEGER NOT NULL,
    "destinationAmountMinor" INTEGER NOT NULL,
    "feeMinor" INTEGER NOT NULL,
    "totalDebitMinor" INTEGER NOT NULL,
    "rateLabel" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "kind" "LedgerAccountKind" NOT NULL,
    "accountId" TEXT,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "LedgerJournal" (
    "id" TEXT NOT NULL,
    "transferId" TEXT,
    "reference" TEXT NOT NULL,
    "postedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerJournal_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);


CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");


CREATE INDEX "Recipient_userId_lastUsedAt_idx" ON "Recipient"("userId", "lastUsedAt" DESC);


CREATE INDEX "TransferQuote_userId_expiresAt_idx" ON "TransferQuote"("userId", "expiresAt");


CREATE UNIQUE INDEX "Transfer_quoteId_key" ON "Transfer"("quoteId");


CREATE UNIQUE INDEX "Transfer_reference_key" ON "Transfer"("reference");


CREATE INDEX "Transfer_userId_createdAt_idx" ON "Transfer"("userId", "createdAt" DESC);


CREATE UNIQUE INDEX "Transfer_userId_idempotencyKey_key" ON "Transfer"("userId", "idempotencyKey");


CREATE UNIQUE INDEX "LedgerAccount_accountId_key" ON "LedgerAccount"("accountId");


CREATE UNIQUE INDEX "LedgerAccount_id_currency_key" ON "LedgerAccount"("id", "currency");


CREATE UNIQUE INDEX "LedgerJournal_transferId_key" ON "LedgerJournal"("transferId");


CREATE UNIQUE INDEX "LedgerJournal_reference_key" ON "LedgerJournal"("reference");


CREATE INDEX "LedgerEntry_ledgerAccountId_journalId_idx" ON "LedgerEntry"("ledgerAccountId", "journalId");


CREATE UNIQUE INDEX "Transaction_transferId_accountId_key" ON "Transaction"("transferId", "accountId");


ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "TransferQuote" ADD CONSTRAINT "TransferQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "TransferQuote" ADD CONSTRAINT "TransferQuote_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "TransferQuote" ADD CONSTRAINT "TransferQuote_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "TransferQuote" ADD CONSTRAINT "TransferQuote_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "TransferQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerAccountId_currency_fkey" FOREIGN KEY ("ledgerAccountId", "currency") REFERENCES "LedgerAccount"("id", "currency") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferQuote" ADD CONSTRAINT quote_amounts_valid CHECK (
  "sourceAmountMinor">0 AND "destinationAmountMinor">0 AND "feeMinor">=0
  AND "totalDebitMinor"="sourceAmountMinor"+"feeMinor"
  AND "sourceUsdMicros">0 AND "destinationUsdMicros">0
  AND ((kind='send' AND "recipientId" IS NOT NULL AND "destinationAccountId" IS NULL)
    OR (kind='exchange' AND "recipientId" IS NULL AND "destinationAccountId" IS NOT NULL AND "destinationAccountId"<>"sourceAccountId"))
);
ALTER TABLE "Transfer" ADD CONSTRAINT transfer_amounts_valid CHECK (
  "sourceAmountMinor">0 AND "destinationAmountMinor">0 AND "feeMinor">=0
  AND "totalDebitMinor"="sourceAmountMinor"+"feeMinor"
  AND ((kind='send' AND "recipientId" IS NOT NULL AND "destinationAccountId" IS NULL)
    OR (kind='exchange' AND "recipientId" IS NULL AND "destinationAccountId" IS NOT NULL AND "destinationAccountId"<>"sourceAccountId"))
);
ALTER TABLE "FxRate" ADD CONSTRAINT fx_rate_positive CHECK ("usdMicros">0);
ALTER TABLE "Transaction" ADD CONSTRAINT transaction_amount_positive CHECK ("amountMinor">0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT ledger_entry_nonzero CHECK ("amountMinor"<>0);



INSERT INTO "LedgerAccount" (id,currency,kind,"accountId")
  SELECT 'customer:'||id,currency,'customer',id FROM "Account";
INSERT INTO "LedgerAccount" (id,currency,kind)
  SELECT k||':'||c::text,c,k::"LedgerAccountKind"
  FROM unnest(enum_range(NULL::"Currency")) c CROSS JOIN unnest(ARRAY['fx','fee','external','opening']) k;
INSERT INTO "LedgerJournal" (id,reference)
  SELECT 'opening:'||id,'OPENING-'||id FROM "Account";
INSERT INTO "LedgerEntry" (id,"journalId","ledgerAccountId",currency,"amountMinor")
  SELECT 'opening-customer:'||id,'opening:'||id,'customer:'||id,currency,"balanceMinor" FROM "Account" WHERE "balanceMinor"<>0;
INSERT INTO "LedgerEntry" (id,"journalId","ledgerAccountId",currency,"amountMinor")
  SELECT 'opening-contra:'||id,'opening:'||id,'opening:'||currency::text,currency,-"balanceMinor" FROM "Account" WHERE "balanceMinor"<>0;


CREATE FUNCTION check_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_id text;
BEGIN
  journal_id := COALESCE(NEW."journalId",OLD."journalId");
  IF EXISTS (SELECT 1 FROM "LedgerEntry" WHERE "journalId"=journal_id GROUP BY currency HAVING SUM("amountMinor")<>0) THEN
    RAISE EXCEPTION 'Ledger journal is not balanced by currency' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_balance AFTER INSERT OR UPDATE OR DELETE ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_ledger_balance();

CREATE OR REPLACE FUNCTION check_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF EXISTS (SELECT 1 FROM "LedgerEntry" WHERE "journalId"=OLD."journalId" GROUP BY currency HAVING SUM("amountMinor")<>0) THEN
      RAISE EXCEPTION 'Original ledger journal is not balanced by currency' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    IF EXISTS (SELECT 1 FROM "LedgerEntry" WHERE "journalId"=NEW."journalId" GROUP BY currency HAVING SUM("amountMinor")<>0) THEN
      RAISE EXCEPTION 'Ledger journal is not balanced by currency' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TYPE "CardType" AS ENUM ('PHYSICAL', 'VIRTUAL', 'SINGLE_USE');


CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'FROZEN', 'TERMINATED', 'EXPIRED', 'PENDING');


CREATE TYPE "CardPaymentType" AS ENUM ('ONLINE', 'CONTACTLESS', 'CHIP_AND_PIN', 'MAGSTRIPE', 'ATM', 'RECURRING', 'DIGITAL_WALLET');


CREATE TYPE "CardPaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'COMPLETED', 'DECLINED', 'REFUNDED', 'REVERSED');


CREATE TYPE "CardDeclineReason" AS ENUM ('CARD_FROZEN', 'CARD_TERMINATED', 'CARD_EXPIRED', 'CARD_PENDING', 'INVALID_CARD', 'ONLINE_PAYMENTS_DISABLED', 'CONTACTLESS_DISABLED', 'ATM_DISABLED', 'MAGSTRIPE_DISABLED', 'LOCATION_MISMATCH', 'LOCATION_REQUIRED', 'SPENDING_LIMIT_EXCEEDED', 'INSUFFICIENT_FUNDS', 'UNSUPPORTED_CURRENCY', 'STALE_CREDENTIALS', 'SINGLE_USE_RECURRING_NOT_ALLOWED', 'SINGLE_USE_ATM_NOT_ALLOWED', 'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED', 'SINGLE_USE_WALLET_NOT_ALLOWED', 'VIRTUAL_ATM_NOT_ALLOWED', 'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED', 'WALLET_NOT_ENROLLED');


CREATE TYPE "CardAuditAction" AS ENUM ('CREATED', 'FROZEN', 'UNFROZEN', 'TERMINATED', 'LABEL_CHANGED', 'LIMIT_CHANGED', 'SECURITY_CHANGED', 'DETAILS_REVEALED', 'REVEAL_DENIED', 'CREDENTIALS_ROTATED', 'WALLET_ENROLLED', 'WALLET_ENROLLMENT_DECLINED', 'PAYMENT_COMPLETED', 'PAYMENT_DECLINED', 'PAYMENT_REFUNDED');


ALTER TABLE "LedgerJournal" ADD COLUMN     "cardPaymentId" TEXT,
ADD COLUMN     "cardRefundId" TEXT;


ALTER TABLE "Transaction" ADD COLUMN     "cardPaymentId" TEXT,
ADD COLUMN     "cardRefundId" TEXT;


CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" VARCHAR(32) NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'FLUX_DEMO',
    "last4" VARCHAR(4) NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "monthlyLimitMinor" INTEGER,
    "onlinePayments" BOOLEAN NOT NULL DEFAULT true,
    "contactlessPayments" BOOLEAN NOT NULL DEFAULT false,
    "atmWithdrawals" BOOLEAN NOT NULL DEFAULT false,
    "magstripePayments" BOOLEAN NOT NULL DEFAULT false,
    "locationSecurity" BOOLEAN NOT NULL DEFAULT false,
    "walletEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "lastCredentialRotation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "terminatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "CardCredential" (
    "cardId" TEXT NOT NULL,
    "encryptedNumber" TEXT NOT NULL,
    "encryptedCvv" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CardCredential_pkey" PRIMARY KEY ("cardId")
);


CREATE TABLE "CardPayment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" VARCHAR(80) NOT NULL,
    "merchantCategory" "TransactionCategory" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "paymentType" "CardPaymentType" NOT NULL,
    "isSubscription" BOOLEAN NOT NULL DEFAULT false,
    "requiresPin" BOOLEAN NOT NULL DEFAULT false,
    "merchantLocation" VARCHAR(2),
    "cardholderLocation" VARCHAR(2),
    "status" "CardPaymentStatus" NOT NULL,
    "declineReason" "CardDeclineReason",
    "accountId" TEXT,
    "billingCurrency" "Currency",
    "billingAmountMinor" INTEGER,
    "principalMinor" INTEGER,
    "feeMinor" INTEGER,
    "sourceUsdMicros" INTEGER,
    "destinationUsdMicros" INTEGER,
    "rateLabel" TEXT,
    "fundingReason" TEXT,
    "limitAmountUsdMinor" INTEGER,
    "credentialVersion" INTEGER NOT NULL,
    "cardLast4" VARCHAR(4) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" VARCHAR(140) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "refundedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "CardRefund" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardPaymentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardRefund_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "CardAuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "action" "CardAuditAction" NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardAuditEvent_pkey" PRIMARY KEY ("id")
);


CREATE INDEX "Card_userId_status_createdAt_idx" ON "Card"("userId", "status", "createdAt");


CREATE UNIQUE INDEX "CardPayment_reference_key" ON "CardPayment"("reference");


CREATE INDEX "CardPayment_cardId_createdAt_idx" ON "CardPayment"("cardId", "createdAt" DESC);


CREATE INDEX "CardPayment_userId_createdAt_idx" ON "CardPayment"("userId", "createdAt" DESC);


CREATE UNIQUE INDEX "CardPayment_userId_idempotencyKey_key" ON "CardPayment"("userId", "idempotencyKey");


CREATE UNIQUE INDEX "CardRefund_cardPaymentId_key" ON "CardRefund"("cardPaymentId");


CREATE UNIQUE INDEX "CardRefund_reference_key" ON "CardRefund"("reference");


CREATE UNIQUE INDEX "CardRefund_userId_idempotencyKey_key" ON "CardRefund"("userId", "idempotencyKey");


CREATE INDEX "CardAuditEvent_cardId_createdAt_idx" ON "CardAuditEvent"("cardId", "createdAt" DESC);


CREATE UNIQUE INDEX "LedgerJournal_cardPaymentId_key" ON "LedgerJournal"("cardPaymentId");


CREATE UNIQUE INDEX "LedgerJournal_cardRefundId_key" ON "LedgerJournal"("cardRefundId");


CREATE UNIQUE INDEX "Transaction_cardRefundId_key" ON "Transaction"("cardRefundId");


CREATE UNIQUE INDEX "Transaction_cardPaymentId_direction_key" ON "Transaction"("cardPaymentId", "direction");


ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardPaymentId_fkey" FOREIGN KEY ("cardPaymentId") REFERENCES "CardPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardRefundId_fkey" FOREIGN KEY ("cardRefundId") REFERENCES "CardRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_cardPaymentId_fkey" FOREIGN KEY ("cardPaymentId") REFERENCES "CardPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_cardRefundId_fkey" FOREIGN KEY ("cardRefundId") REFERENCES "CardRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardCredential" ADD CONSTRAINT "CardCredential_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "CardRefund" ADD CONSTRAINT "CardRefund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardRefund" ADD CONSTRAINT "CardRefund_cardPaymentId_fkey" FOREIGN KEY ("cardPaymentId") REFERENCES "CardPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardAuditEvent" ADD CONSTRAINT "CardAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CardAuditEvent" ADD CONSTRAINT "CardAuditEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Card" ADD CONSTRAINT card_metadata_valid CHECK (
 "expiryMonth" BETWEEN 1 AND 12 AND "expiryYear">=2026 AND "credentialVersion">0
 AND last4 ~ '^[0-9]{4}$' AND ("monthlyLimitMinor" IS NULL OR "monthlyLimitMinor" BETWEEN 1 AND 100000000)
 AND (type='PHYSICAL' OR NOT ("contactlessPayments" OR "atmWithdrawals" OR "magstripePayments" OR "locationSecurity"))
 AND (type<>'SINGLE_USE' OR NOT "walletEnrolled")
);
CREATE UNIQUE INDEX one_live_single_use_card ON "Card" ("userId")
 WHERE type='SINGLE_USE' AND status IN ('ACTIVE','FROZEN','PENDING');
ALTER TABLE "CardPayment" ADD CONSTRAINT card_payment_amounts_valid CHECK (
 "amountMinor">0 AND "credentialVersion">0
 AND ("billingAmountMinor" IS NULL OR ("billingAmountMinor">0 AND "principalMinor">0 AND "feeMinor">=0 AND "billingAmountMinor"="principalMinor"+"feeMinor"))
 AND (status NOT IN ('COMPLETED','REFUNDED') OR ("accountId" IS NOT NULL AND "billingCurrency" IS NOT NULL AND "billingAmountMinor" IS NOT NULL AND "limitAmountUsdMinor">0 AND "completedAt" IS NOT NULL))
 AND (status<>'DECLINED' OR "declineReason" IS NOT NULL)
);
ALTER TABLE "LedgerJournal" ADD CONSTRAINT journal_single_owner CHECK (num_nonnulls("transferId","cardPaymentId","cardRefundId")<=1);
ALTER TABLE "Transaction" ADD CONSTRAINT history_single_movement CHECK (num_nonnulls("transferId","cardPaymentId")<=1 AND ("cardRefundId" IS NULL OR ("cardPaymentId" IS NOT NULL AND direction='credit')));

ALTER TABLE "CardPayment" DROP CONSTRAINT card_payment_amounts_valid;
ALTER TABLE "CardPayment" ADD CONSTRAINT card_payment_amounts_valid CHECK (
 "amountMinor">0 AND "credentialVersion">0
 AND ("billingAmountMinor" IS NULL OR (
   "billingAmountMinor">0 AND "principalMinor" IS NOT NULL AND "principalMinor">0
   AND "feeMinor" IS NOT NULL AND "feeMinor">=0
   AND "billingAmountMinor"="principalMinor"+"feeMinor"
 ))
 AND (status NOT IN ('COMPLETED','REFUNDED') OR (
   "accountId" IS NOT NULL AND "billingCurrency" IS NOT NULL
   AND "billingAmountMinor" IS NOT NULL AND "limitAmountUsdMinor" IS NOT NULL
   AND "limitAmountUsdMinor">0 AND "completedAt" IS NOT NULL
 ))
 AND (status<>'DECLINED' OR "declineReason" IS NOT NULL)
);

CREATE TYPE "SubscriptionCadence" AS ENUM ('WEEKLY','MONTHLY','YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE','PAUSED','CANCELLED');
CREATE TABLE "Budget" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), category "TransactionCategory" NOT NULL,
 currency "Currency" NOT NULL, "createdMonth" DATE NOT NULL, "archivedAt" TIMESTAMPTZ(3), revision INTEGER NOT NULL DEFAULT 1,
 "createKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT budget_values_valid CHECK(category<>'income' AND revision>0 AND EXTRACT(DAY FROM "createdMonth")=1)
);
CREATE UNIQUE INDEX "Budget_userId_createKey_key" ON "Budget"("userId","createKey");
CREATE INDEX "Budget_userId_category_idx" ON "Budget"("userId",category);
CREATE UNIQUE INDEX budget_one_active_category ON "Budget"("userId",category) WHERE "archivedAt" IS NULL;
CREATE TABLE "BudgetAllocation" (
 id TEXT PRIMARY KEY, "budgetId" TEXT NOT NULL REFERENCES "Budget"(id), month DATE NOT NULL, "amountMinor" INTEGER NOT NULL,
 CONSTRAINT budget_allocation_valid CHECK("amountMinor">0 AND "amountMinor"<=100000000 AND EXTRACT(DAY FROM month)=1)
);
CREATE UNIQUE INDEX "BudgetAllocation_budgetId_month_key" ON "BudgetAllocation"("budgetId",month);
CREATE TABLE "Subscription" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), "accountId" TEXT NOT NULL, "merchantId" TEXT NOT NULL REFERENCES "Merchant"(id),
 label VARCHAR(60) NOT NULL, currency "Currency" NOT NULL, "amountMinor" INTEGER NOT NULL, cadence "SubscriptionCadence" NOT NULL,
 "anchorDate" DATE NOT NULL, status "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE', source TEXT NOT NULL DEFAULT 'MANUAL',
 revision INTEGER NOT NULL DEFAULT 1, "createKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "Subscription_accountId_currency_fkey" FOREIGN KEY("accountId",currency) REFERENCES "Account"(id,currency),
 CONSTRAINT subscription_values_valid CHECK("amountMinor">0 AND "amountMinor"<=100000000 AND revision>0 AND LENGTH(TRIM(label))>=2 AND source IN ('MANUAL','DETECTED'))
);
CREATE UNIQUE INDEX "Subscription_userId_createKey_key" ON "Subscription"("userId","createKey");
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId",status);
CREATE INDEX "Subscription_merchantId_accountId_idx" ON "Subscription"("merchantId","accountId");
CREATE UNIQUE INDEX subscription_one_tracked_merchant_account ON "Subscription"("userId","accountId","merchantId") WHERE status<>'CANCELLED';

ALTER TABLE "BudgetAllocation" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
