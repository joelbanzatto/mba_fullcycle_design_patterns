# Invoice generation and closing

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
psql -h localhost -U postgres -d app -v ON_ERROR_STOP=1 -f create.sql
```

The script installs `uuid-ossp` and creates the contract, payment, and invoice tables. Use the `postgres` superuser to create the extension. It succeeds on a fresh database and on subsequent runs. The seed contains one contract for 6000 across 12 periods and one payment of 6000 in January 2022.

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

## Close an invoice period

Closing generates and persists the invoices for a month, year, and regime:

```sh
curl -s -X POST http://localhost:3000/close_invoicing \
  -H 'Content-Type: application/json' \
  -d '{"month":1,"year":2022,"type":"accrual"}'
```

Expected response:

```json
[{"date":"2022-01-01T13:00:00.000Z","amount":500}]
```

The API console also prints the `InvoicesClosed` summary through `SendEmail`:

```text
{ month: 1, year: 2022, type: 'accrual', invoices: 1, total: 500 }
```

Repeating the request replaces the entire closing for that period and regime. Other periods and regimes remain intact. If no invoices are generated, the old closing is removed and the response is `[]`.

The closing endpoint accepts the same formats as generation. For cash CSV:

```sh
curl -s -X POST http://localhost:3000/close_invoicing \
  -H 'Content-Type: application/json' \
  -d '{"month":1,"year":2022,"type":"cash","format":"csv"}'
```

Expected body: `2022-01-05;6000`, as plain text. The response contains the batch persisted by that execution; the summary is sent only through the event.

## Validation

Keep the API running, then use a second terminal:

```sh
npm test
npm run typecheck
```

The suite includes the seven original tests, presenter and format tests, repository and closing integration tests, and API checks. API tests call port 3000. The equivalent direct test command is `TZ=America/Sao_Paulo npx jest`.

Closing API tests use the 2022 seed period. Repository and rollback tests use separate years and remove their invoice fixtures after each test, so they can run together without changing the seeded contracts or payments.

## Atomic persistence

`InvoiceDatabaseRepository.replacePeriod` is the Unit of Work boundary. It uses `DatabaseConnection.transaction`, implemented with pg-promise's native transaction support, to delete the old closing and insert every new invoice in one transaction. `CloseInvoicing` publishes `InvoicesClosed` only after that transaction completes.

`test/CloseInvoicingIntegration.test.ts` proves rollback against real PostgreSQL: the first new invoice is valid, but the second references a nonexistent contract. The test checks that the previous rows, including their IDs, remain unchanged and no closing event is published. A failed first closing leaves no invoices behind. Invalid `format` and `type` values are also tested before persistence.

## Dependency boundaries

`GenerateInvoices` receives a contract repository, presenter factory, and Mediator through application interfaces. The factory selects a presenter from the request's `format` before contracts are loaded. Presenters share a generic interface, and invoice data lives in a shared DTO. New formats can be added to the factory without changing the use case.

The concrete implementations are wired in `src/main.ts`, which also registers `SendEmail` for `InvoicesGenerated` and wraps the use case in `LoggerDecorator`. The event carries invoice DTOs regardless of the response format.

`CloseInvoicing` reuses the domain's invoice generation strategies and adds an invoice repository dependency through its application interface. It pairs each invoice with the contract that generated it. The composition root applies `LoggerDecorator` to closing and registers `SendEmail` for `InvoicesClosed`.

Application and domain code must not import infrastructure implementations. This command should produce no matches:

```sh
grep -rEn "from ['\"][^'\"]*infra" src/application src/domain
```
