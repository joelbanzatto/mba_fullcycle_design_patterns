# Invoice generation

Billing exercise based on the Full Cycle design patterns course, using TypeScript, Express, pg-promise, and Jest.

## Requirements

- Node.js 24 LTS and npm.
- PostgreSQL and the `psql` client. Validated with PostgreSQL 17.
- Port 3000 available for the API.

On macOS with Homebrew's `libpq`, add its client tools to your shell path if needed:

```sh
export PATH="$(brew --prefix libpq)/bin:$PATH"
```

## Database setup

The database adapter connects to `localhost:5432`, database `app`, with user `postgres` and password `123456`.

To start a dedicated PostgreSQL instance with Docker:

```sh
docker run --name mba-design-patterns-postgres \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=app \
  -p 127.0.0.1:5432:5432 \
  -d postgres:17-alpine
```

Alternatively, use a local PostgreSQL server with those credentials and create the database:

```sh
psql -h localhost -U postgres -c 'create database app;'
```

Once PostgreSQL accepts connections, load the schema and seed:

```sh
export PGPASSWORD=123456
psql -h localhost -U postgres -d app -v ON_ERROR_STOP=1 \
  -c 'create extension if not exists "uuid-ossp";'
psql -h localhost -U postgres -d app -f create.sql
```

The original schema script requires the extension to be installed separately. On its first run, it reports that schema `branas` does not exist before creating it and loading the seed. The seed contains one contract for 6000 across 12 periods and one payment of 6000 in January 2022.

The script recreates the `branas` schema. Stop the API before reseeding and restart it afterward.

## Run the API

```sh
npm install
npm start
```

The API listens on port 3000. The start and test scripts set `TZ=America/Sao_Paulo`, which the original date assertions require.

Generate invoices for January 2022:

```sh
curl -s -X POST http://localhost:3000/generate_invoices \
  -H 'Content-Type: application/json' \
  -d '{"month":1,"year":2022,"type":"cash"}'
```

Expected response:

```json
[{"date":"2022-01-05T13:00:00.000Z","amount":6000}]
```

Using `"type":"accrual"` returns one invoice for 500 dated `2022-01-01T13:00:00.000Z`. Generation is a simulation and does not persist invoices.

The optional `format` field accepts `json` (the default) or `csv`. To request CSV:

```sh
curl -s -X POST http://localhost:3000/generate_invoices \
  -H 'Content-Type: application/json' \
  -d '{"month":1,"year":2022,"type":"accrual","format":"csv"}'
```

Expected response, as plain text without JSON quotes:

```text
2022-01-01;500
```

CSV contains one `YYYY-MM-DD;amount` line per invoice. An empty result produces an empty body. Unsupported formats cause the presenter factory to throw `Invalid format`.

## Validation

Keep the API running, then use a second terminal:

```sh
npm test
npm run typecheck
```

The suite includes the seven original tests, presenter factory and format tests, and API checks for JSON and unquoted CSV. API tests call port 3000. The equivalent direct test command is `TZ=America/Sao_Paulo npx jest`.

## Dependency boundaries

`GenerateInvoices` receives a contract repository, presenter factory, and Mediator through application interfaces. The factory selects a presenter from the request's `format` before contracts are loaded. Presenters share a generic interface, and invoice data lives in a shared DTO. New formats can be added to the factory without changing the use case.

The concrete implementations are wired in `src/main.ts`, which also registers `SendEmail` for `InvoicesGenerated` and wraps the use case in `LoggerDecorator`. The event carries invoice DTOs regardless of the response format.

Application and domain code must not import infrastructure implementations. This command should produce no matches:

```sh
grep -rEn "from ['\"][^'\"]*infra" src/application src/domain
```
