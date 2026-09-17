# Analytics and planning

Analytics, budgets, and subscription tracking read from the same account, transaction, transfer, card-payment, and ledger records used by the rest of the application.

## Analytics

Reports cover spending, income, cash flow, categories, merchants, refunds, fees, and transfers. Users can select a reporting currency, account, date range, category, merchant, and direction.

Settled purchases, withdrawals, and fees increase spending. Refunds reduce spending on their credit date. Exchanges between owned accounts are excluded from spending. External transfer principal is reported separately.

Current and comparison periods use one repeatable-read snapshot. Currency conversion uses integer arithmetic and the current illustrative rate table. The interface does not claim historical market pricing.

## Budgets

Budgets store category, currency, month, amount, enabled state, and revision. Editing a current allocation leaves earlier months intact. Usage comes from the analytics classification rules.

Statuses distinguish within budget, close to limit, at limit, and over budget. Projection and daily allowance are simple calendar-based pace estimates.

## Subscriptions

Tracked subscriptions retain merchant, account, amount, cadence, anchor date, status, and revision. Detection requires at least three qualifying charges with similar amounts and plausible weekly, monthly, or yearly spacing.

The schedule preserves month-end and leap-day anchors. Details include recent payments, spending totals, upcoming estimates, and warnings when the most recently used card is unavailable or restricted.

Tracking does not schedule payments or cancel merchant billing.
