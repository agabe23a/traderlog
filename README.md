# TRADERS LOG — Production Upgrade

TRADERS LOG is a Node.js/Express/PostgreSQL trading workspace with provider-backed market data, scanner analysis, watchlists and a private trading journal.

## Phase 1 audit

**Stack:** Node.js 18+, Express 4, EJS, vanilla JavaScript/CSS, PostgreSQL, `pg`, server-side sessions with `connect-pg-simple`, Helmet, rate limiting, bcryptjs, provider adapters for Twelve Data / Alpha Vantage / CoinGecko.

**Architecture:** browser → EJS/static assets → Express routes/controllers → services → provider/database layers → PostgreSQL.

**Key findings before this upgrade**
- Authentication was only a placeholder: watchlists used a hard-coded demo user.
- Journal schema existed but was only an integration hook and lacked most trading fields.
- Watchlist mutations did not verify ownership, creating an authorization vulnerability.
- `db/migrate.js` reapplied one monolithic schema and had no migration history.
- PostgreSQL configuration could silently resolve to a local role that did not exist; this matches errors such as `role "u0_a123" does not exist`.
- Production session secrets had a development fallback.
- Production PostgreSQL TLS used `rejectUnauthorized:false`.
- API validation/response conventions were inconsistent.
- There were no automated tests.

## Prioritized implementation plan

1. Protect identity/session and tenant boundaries.
2. Add additive versioned database migration and preserve existing rows.
3. Upgrade journal calculations and API.
4. Add analytics dashboard and charts.
5. Add validated screenshot upload path.
6. Improve security headers, configuration and error handling.
7. Add regression tests and developer documentation.

## What was implemented

### Authentication
- Email/password registration and login.
- Password hashing with bcrypt.
- Session regeneration on login.
- Private dashboard, journal and watchlists.
- Logout.
- CSRF protection for state-changing requests.
- No hard-coded demo-user fallback in authenticated workflows.

### Trading journal
Supports:
- Long/short
- Instrument
- Entry/exit price and time
- Position size
- Stop loss / take profit
- Fees
- Server-derived P&L and P&L %
- Server-derived risk/reward
- Trade duration
- Strategy, setup and session
- Emotions and notes
- Tags
- Screenshot URLs and validated image uploads
- Open/closed/cancelled status

Client-supplied P&L, risk/reward and duration are never trusted.

### Analytics
Dashboard includes:
- Trade count
- Win rate
- Net P&L
- Average win/loss
- Profit factor
- Expectancy
- Maximum drawdown
- Average risk/reward
- Equity curve
- Daily P&L
- Strategy, instrument, session and setup performance

### Security
- Helmet CSP is enabled and scoped to required application/CDN/chart origins.
- Secure production cookies.
- Production requires a strong `SESSION_SECRET`.
- Parameterized SQL remains the standard.
- Authenticated journal/watchlist resources are scoped to the current user.
- Screenshot upload type/size/count limits.
- Safe production API errors; detailed internals are not returned.
- Existing API rate limiting retained.
- Request-size limits retained.

### Database safety
Migration `db/migrations/001_journal_upgrade.sql` is **additive**. It does not DROP, TRUNCATE or delete user/trade rows. It adds journal fields, constraints, indexes and an `updated_at` trigger.

The migration runner:
- Applies the existing baseline schema first.
- Records applied migration filenames in `schema_migrations`.
- Skips migrations already applied.
- Wraps each migration in a transaction.
- Diagnoses PostgreSQL authentication/role errors without printing credentials.

### PostgreSQL configuration
You may use either `DATABASE_URL` or explicit:
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

TLS is opt-in with `DB_SSL=true`. Certificate verification remains enabled by default. Only set `DB_SSL_REJECT_UNAUTHORIZED=false` when your provider explicitly requires it and you understand the trust implications.

## Safe upgrade procedure

Before upgrading production, take a PostgreSQL backup.

```bash
pg_dump "$DATABASE_URL" > traderslog-before-upgrade.sql
```

Do not run `DROP` or `TRUNCATE` as part of this upgrade.

Then:

```bash
npm install
cp .env.example .env
# edit .env with your real database/provider/session settings

npm run migrate
npm run seed
npm test
npm run lint
npm start
```

Health check:

```text
GET /health
```

Development:

```bash
npm run dev
```

## Fixing the PostgreSQL `role "... " does not exist` problem

That error means the PostgreSQL connection is asking for a database role that is not present on the server. It is not a JavaScript/npm error.

Check your `.env` without pasting its password/token into chat:

```bash
echo "$DATABASE_URL"
```

Prefer explicit Termux/local settings if appropriate:

```text
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=traderslog
DB_USER=<existing-postgres-role>
DB_PASSWORD=<password>
DB_SSL=false
```

Then verify the role/database using your PostgreSQL administrator account. Do not create a random application role unless you control the PostgreSQL instance and intend to grant it access.

## Screenshot storage

Uploads are written to `public/uploads` by default. JPEG, PNG, WebP and GIF are accepted; SVG is intentionally rejected. Maximum 5 files per request and 5 MB per file.

For containerized/ephemeral production hosting, configure `UPLOAD_DIR` to durable storage or replace the upload controller with object storage. The database stores the resulting application URL, not binary image data.

## Environment variables

See `.env.example`. Never commit `.env`.

Required in production:
- `SESSION_SECRET`
- database connection (`DATABASE_URL` or DB_* credentials)

Provider keys remain server-side.

## Testing

The repository includes deterministic unit tests for the core trade calculations:

```bash
npm test
```

Static JavaScript syntax checks:

```bash
npm run lint
```

Full dependency installation and live database/API tests require a configured environment. In this build environment, `npm install` could not complete because registry access timed out, so a live PostgreSQL integration run was not claimed as successful.

## Backward compatibility

Existing market-data, scanner, instrument, session and watchlist structures are retained. The journal migration only adds columns/indexes/constraints. Existing rows are not deleted.

The previous monolithic `db/schema.sql` remains as the baseline for fresh installs; subsequent changes belong in `db/migrations/`.

## Production notes

- Use HTTPS.
- Use a strong random session secret.
- Use a dedicated least-privilege PostgreSQL role.
- Keep provider credentials out of source control.
- Use durable object storage for screenshots in ephemeral deployments.
- Restrict database network access.
- Monitor `/health` and server logs.
- Review backup/restore procedures before production launch.

TRADERS LOG is an analysis and journaling tool, not a broker or a guarantee of trading returns.


## TRADERS LOG 3.0 — Upgrade Pack

New modules:
- Premium responsive UI shell and animated mobile navigation.
- Trading Portfolio: accounts, capital, open positions and unrealized P&L.
- Journal downloads: CSV and JSON export.
- Market News dashboard with cached public RSS aggregation and source links.
- Strategy Lab covering trend, breakout, mean-reversion, price action, liquidity, CRT, ICT/SMC concepts, VWAP, indicators, macro and systematic approaches.
- Explicit "DO / DON'T" risk checklist.
- Telegram, WhatsApp and Instagram links in the navigation.
- Additive PostgreSQL migration: `db/migrations/002_portfolio_upgrade.sql`.

After extracting:
```bash
npm install
npm run db:migrate
npm run db:seed
npm run check
npm test
npm start
```

Set `DATABASE_URL`/PostgreSQL credentials and your market-data API keys in `.env`. News feeds are external and can occasionally be unavailable; the application handles source failures without crashing.

## TRADERS LOG 3.1 — Bug fix & hardening pass

A full source read-through of journal, portfolio and scanner (plus everything they touch) turned up the following, all fixed in this pass. No `npm install`/live-database run was available in the environment that produced this pass either, so this was static review + `node --check` + the existing unit tests, not a live end-to-end run — verify against your own database before relying on it in production.

**Journal**
- `journalService.create()` never wrote `exit_price`/`exit_time` to the database — a closed trade's P&L was computed and saved correctly, but its exit price/time silently vanished on creation. Fixed.
- The edit-trade form populated `entry_time`/`exit_time` with raw ISO strings, which `<input type="datetime-local">` silently rejects (it only accepts local, timezone-less values). The field would render blank, and saving without noticing would overwrite the real value with `null`. Fixed with a proper ISO → local `datetime-local` converter.
- CSV/JSON export was routed through the paginated list endpoint, which caps at 100 rows — any journal bigger than that silently lost trades on export. Export now uses an uncapped query.

**Portfolio**
- The "update position" endpoint existed on the backend but nothing in the UI ever called it, so unrealized P&L was a one-time snapshot from whenever the position was created. Added an edit modal (current price / stop loss / take profit / notes) and a "Refresh live prices" button that pulls a live quote per position and marks it to market.
- While building that: `updatePosition` did a full-column overwrite, so an edit that only touched `current_price` would null out `stop_loss`/`take_profit`/`notes`. Changed to a proper partial update — a field only changes if the caller actually sent it.

**Scanner**
- The ADX trend-continuation condition had a copy-paste ternary that returned the same string on both branches, so bullish vs. bearish continuation was never actually distinguished. Fixed.

**Security**
- `dashboard.js` interpolated journal-entered strategy/session/setup text into `innerHTML` with no escaping (every other frontend file in the app does escape). Since those are free-text fields, this was a stored-XSS path. Fixed.
- The "New Watchlist" button's request was missing its CSRF header, so it always failed — creating a watchlist was completely broken. Fixed.

**Cleanup**
- Removed `controllers/demoUser.js` and the `DEMO_USER_ID` fallback in `watchlistController.js` — dead scaffolding from before auth existed, contradicting this README's own "no hard-coded demo-user fallback" claim above. Removed the matching seed row too.
- `routes/api.js` had `module.exports` positioned mid-file (harmless in Node, since the rest of the file still runs, but fragile to edit around). Moved to the end.
- `views/partials/nav.ejs` had a `<div>` as a direct child of `<ul class="navbar-nav">`, which is invalid HTML; moved it outside the list. Also fixed an Instagram link that pointed at a different handle than the rest of the site.
- The TradingView chart embed hardcoded `timezone:'Africa/Nairobi'` for every visitor everywhere; now derived from the visitor's own browser timezone.
- `instrument.js` picked up the current instrument's symbol via `document.querySelector('.tl-heading')`, which only worked because of DOM ordering luck. Replaced with an explicit `data-symbol` attribute.
- Recompressed `public/assets/traders-log-logo.png` (1.4 MB, displayed at 34–44px almost everywhere and at most 410px on the landing hero) down to ~175 KB at 900×900 — same file, same path, no template changes needed.
- `npm run check`/`npm run lint` used `node --check dir/*.js` patterns. `node --check` only checks its *first* argument — every other file the glob matched was being silently skipped, so most of the codebase was never actually being syntax-checked by CI despite the script exiting 0. Rewritten as an explicit loop that checks every file and fails on the first real error.
