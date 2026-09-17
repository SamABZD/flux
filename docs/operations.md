# Production operations

Flux runs on Railway as three services:

- the web and API service
- PostgreSQL with persistent storage
- a scheduled demo reset worker

The application service builds both workspaces, applies migrations, seeds missing demo records, and starts the compiled NestJS server. Railway checks `GET /health` before routing traffic.

The reset worker has no public domain. It acquires an advisory lock, clears application tables without changing migration history, restores the canonical demo data, and commits once.

## Required variables

| Variable              | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `DATABASE_URL`        | PostgreSQL connection                                  |
| `CARD_ENCRYPTION_KEY` | 32-byte hexadecimal key for synthetic card credentials |
| `FRONTEND_URL`        | Allowed browser origin                                 |
| `NODE_ENV`            | Runtime mode                                           |
| `SERVE_FRONTEND`      | Serve the compiled client from the API process         |
| `WEB_API_BASE_URL`    | Browser API base, `/api` in production                 |
| `ALLOW_DEMO_RESET`    | Guard required by the reset worker                     |

## Release checks

`npm run check` runs formatting, lint, TypeScript, unit tests, and production builds. `npm run test:integration` exercises PostgreSQL behavior. `npm run test:e2e` creates a temporary database, applies migrations, seeds it, runs production browser journeys, and removes only that generated database. `npm run test:production` verifies the compiled same-origin service and guarded demo reset.
