# Architecture

Flux is a TypeScript monorepo with a React client, a NestJS API, and PostgreSQL. The production service serves the compiled client and API from one HTTPS origin.

```text
Browser
  ├── React routes and components
  ├── Redux Toolkit Query
  └── HttpOnly demo session
        │
        ▼
NestJS API
  ├── accounts and transaction history
  ├── transfers and currency exchange
  ├── cards and card payments
  └── analytics, budgets, and subscriptions
        │
        ▼
PostgreSQL
  ├── operational records
  ├── double-entry journals
  └── idempotency and audit records
```

## Repository layout

```text
apps/api/       NestJS application, Prisma schema, migrations, and seed data
apps/web/       React application and design system
cypress/        Production browser journeys
docs/           Domain and operational documentation
scripts/        Environment setup and isolated verification tools
```

## Runtime boundaries

The browser receives only `WEB_API_BASE_URL`. Database credentials and the card-encryption key remain server-side. Production uses same-origin `/api` requests and an HttpOnly, SameSite cookie.

The public demo has one shared fictional user. It is not an authentication, identity, or banking system. All people, accounts, cards, merchants, rates, and balances are synthetic.

## Data access

Prisma owns the application schema and migrations. Services validate ownership and input before reading or writing records. Financial mutations run in database transactions and lock affected rows in a consistent order.

Accounts store a balance projection for fast reads. Every financial write also posts a balanced journal, then verifies that the projection matches the customer ledger before commit.

## Client state

Redux Toolkit Query owns remote state, caching, retries, and invalidation. URL parameters own shareable filters. Short-lived transfer and card recovery data uses `sessionStorage` with allowlisted fields and stable idempotency keys.

Routes are lazy-loaded. The shared entry has a size budget, transaction history is paginated, and analytics endpoints return bounded series.

## Error handling

API errors use a stable envelope with a request ID. Server logs include method, path, status, duration, and request ID while excluding bodies, cookies, credentials, and database values. Unknown failures return a generic message.

## Related documents

- [Transfers and ledger](transfers-and-ledger.md)
- [Cards and card payments](cards.md)
- [Analytics and planning](insights.md)
- [Production operations](operations.md)
