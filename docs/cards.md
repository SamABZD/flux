# Cards and card payments

Cards are payment instruments backed by the user's accounts. They do not hold balances.

Flux models physical, reusable virtual, and single-use cards. Card settings cover status, label, monthly limit, online payments, contactless payments, ATM use, magstripe use, location checks, and wallet enrollment.

## Credentials

Synthetic card numbers and security codes are encrypted at rest. Ordinary API responses expose only safe metadata. Reveal requests require the demo PIN and return credentials directly without placing them in Redux or browser storage.

Single-use credentials rotate after an eligible completed payment. Stale credential versions are rejected.

## Authorization

Authorization validates the card state and payment method, locks the card and all candidate accounts, checks available funds and monthly usage, then selects one account. Balances are never combined.

A matching-currency account is preferred. Foreign-currency funding uses the shared quote engine and posts principal, fee, and currency-clearing entries. A completed payment, ledger journal, account projection, transaction history, and audit event commit together.

Declines are persisted with a structured reason and do not move money. Supported reasons include card status, disabled payment methods, location mismatch, spending limits, insufficient funds, stale credentials, and invalid single-use-card usage.

## Refunds

The demo supports one full refund per completed payment. The refund reverses the original ledger amounts and currency snapshot, updates transaction history, and restores the original month's card-limit usage.

The demo does not connect to an issuer, card network, ATM, or digital wallet. It does not implement authorization holds, partial capture, partial refunds, disputes, or chargebacks.
