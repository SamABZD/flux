# Transfers and ledger

Flux supports transfers to saved fictional recipients and exchanges between the demo user's currency accounts.

## Quotes

The server calculates every quote from integer minor units and rates stored as millionths of USD. A quote fixes the principal, fee, total debit, destination amount, currencies, accounts, recipient, and expiry for 45 seconds.

The fee is 0.40% of source principal with a 0.50 USD-equivalent minimum. Division rounds upward so the requested destination amount is fully funded.

## Execution

Transfer execution requires a UUID idempotency key. The service fingerprints the request, takes a transaction-scoped request lock, and returns an earlier result when the same request is replayed. Reusing a key with changed input fails.

Affected accounts are locked in sorted order. The service rechecks ownership, account status, quote expiry, quote reuse, recipient state, pending debits, available funds, and destination limits before posting money.

The current clearing adapter is local and synchronous. Connecting a real payment provider would require durable jobs, an outbox, provider idempotency, webhooks, settlement states, and reconciliation.

## Ledger

Every journal balances independently in each currency. Ledger accounts represent customers, fees, currency clearing, external destinations, and opening offsets.

An exchange debits the source customer account and credits the destination customer account through currency-specific clearing accounts. An external transfer credits an external destination ledger account instead.

Database constraints reject invalid amounts, currency mismatches, and unbalanced journals. No product endpoint edits or deletes a ledger entry.

## Recovery

The client stores the immutable execution request and key before dispatch. If a response is lost, it retrieves the result by key or retries the exact request. It never creates a second key for an uncertain operation.
