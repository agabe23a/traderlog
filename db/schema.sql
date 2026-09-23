-- TRADERS LOG — core schema
-- Uses NUMERIC for all financial values (never float) per spec section 23.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    TEXT,
    timezone        TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    preferred_timeframes TEXT[] DEFAULT ARRAY['15M','1H','4H','Daily'],
    risk_settings   JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- MARKETS / EXCHANGES / INSTRUMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS markets (
    id              SERIAL PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,      -- FOREX, STOCKS, INDICES, COMMODITIES, CRYPTO, BONDS, ETF
    name            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchanges (
    id              SERIAL PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,      -- NYSE, NASDAQ, LSE, NSE_KE, etc.
    name            TEXT NOT NULL,
    country         TEXT,
    timezone        TEXT
);

CREATE TABLE IF NOT EXISTS instruments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          TEXT NOT NULL,             -- EUR/USD, AAPL, XAU/USD, BTC/USD
    name            TEXT,
    market_id       INTEGER REFERENCES markets(id),
    exchange_id     INTEGER REFERENCES exchanges(id),
    sector          TEXT,
    industry        TEXT,
    country         TEXT,
    base_currency   TEXT,
    quote_currency  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    provider_symbols JSONB DEFAULT '{}'::jsonb, -- {"twelvedata":"EUR/USD","polygon":"C:EURUSD"}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (symbol, market_id)
);
CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments (symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_market ON instruments (market_id);

CREATE TABLE IF NOT EXISTS instrument_aliases (
    id              SERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    alias           TEXT NOT NULL,
    UNIQUE (instrument_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_instrument_aliases_alias ON instrument_aliases (alias);

-- =========================================================
-- MARKET DATA (quotes / candles)
-- =========================================================
CREATE TABLE IF NOT EXISTS market_quotes (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    price           NUMERIC(20,8),
    bid             NUMERIC(20,8),
    ask             NUMERIC(20,8),
    change_abs      NUMERIC(20,8),
    change_pct      NUMERIC(10,4),
    day_high        NUMERIC(20,8),
    day_low         NUMERIC(20,8),
    day_open        NUMERIC(20,8),
    volume          NUMERIC(24,4),
    market_cap      NUMERIC(28,4),
    provider        TEXT NOT NULL,
    data_status     TEXT NOT NULL DEFAULT 'LIVE', -- LIVE, DELAYED, STALE, UNAVAILABLE
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_instrument_time ON market_quotes (instrument_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS market_candles (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe       TEXT NOT NULL,  -- 1M,5M,15M,30M,1H,4H,Daily,Weekly,Monthly
    open_time       TIMESTAMPTZ NOT NULL,
    open            NUMERIC(20,8),
    high            NUMERIC(20,8),
    low             NUMERIC(20,8),
    close           NUMERIC(20,8),
    volume          NUMERIC(24,4),
    provider        TEXT NOT NULL,
    data_status     TEXT NOT NULL DEFAULT 'LIVE',
    UNIQUE (instrument_id, timeframe, open_time, provider)
);
CREATE INDEX IF NOT EXISTS idx_candles_lookup ON market_candles (instrument_id, timeframe, open_time DESC);

-- =========================================================
-- SESSIONS (trading sessions, not web sessions)
-- =========================================================
CREATE TABLE IF NOT EXISTS market_sessions (
    id              SERIAL PRIMARY KEY,
    name            TEXT UNIQUE NOT NULL,   -- Sydney, Tokyo, London, New York
    open_utc        TIME NOT NULL,
    close_utc       TIME NOT NULL
);

-- =========================================================
-- WATCHLISTS
-- =========================================================
CREATE TABLE IF NOT EXISTS watchlists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    columns         JSONB DEFAULT '["symbol","price","change_pct","ai_bias","scanner_score"]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id    UUID REFERENCES watchlists(id) ON DELETE CASCADE,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    sort_order      INTEGER DEFAULT 0,
    UNIQUE (watchlist_id, instrument_id)
);

-- =========================================================
-- SCANNER
-- =========================================================
CREATE TABLE IF NOT EXISTS scanner_results (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe       TEXT NOT NULL,
    bias            TEXT,          -- Bullish, Bearish, Neutral
    condition       TEXT,          -- Breakout, Reversal, Trend continuation, Range-bound...
    momentum        TEXT,          -- Strong, Weak, Increasing, Decreasing
    volatility      TEXT,          -- LOW, NORMAL, ELEVATED, EXTREME
    score           NUMERIC(5,2),
    confidence      TEXT,          -- Low, Medium, High
    evidence        JSONB DEFAULT '[]'::jsonb,
    risks           JSONB DEFAULT '[]'::jsonb,
    invalidation    NUMERIC(20,8),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scanner_results_instrument ON scanner_results (instrument_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_results_score ON scanner_results (score DESC);

CREATE TABLE IF NOT EXISTS scanner_signals (
    id              BIGSERIAL PRIMARY KEY,
    scanner_result_id BIGINT REFERENCES scanner_results(id) ON DELETE CASCADE,
    signal_type     TEXT NOT NULL,  -- rsi_oversold, macd_cross, breakout, liquidity_sweep, crt_confirmed...
    detail          JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS technical_indicators (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe       TEXT NOT NULL,
    indicator       TEXT NOT NULL,  -- RSI, MACD, SMA20, EMA50, ATR14, ADX...
    value           NUMERIC(20,8),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indicators_lookup ON technical_indicators (instrument_id, timeframe, indicator, computed_at DESC);

-- =========================================================
-- NEWS / ECONOMIC CALENDAR
-- =========================================================
CREATE TABLE IF NOT EXISTS market_news (
    id              BIGSERIAL PRIMARY KEY,
    headline        TEXT NOT NULL,
    source          TEXT,
    url             TEXT,
    published_at    TIMESTAMPTZ,
    category        TEXT,   -- Central Banks, Inflation, Employment, Geopolitics...
    affected_assets TEXT[],
    sentiment       TEXT,   -- Positive, Negative, Neutral
    importance      TEXT,   -- LOW, MEDIUM, HIGH
    ai_summary      TEXT,
    confidence      TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_published ON market_news (published_at DESC);

CREATE TABLE IF NOT EXISTS economic_events (
    id              BIGSERIAL PRIMARY KEY,
    event_name      TEXT NOT NULL,   -- CPI, NFP, GDP, FOMC Rate Decision...
    country         TEXT,
    currency        TEXT,
    event_time      TIMESTAMPTZ,
    previous_value  TEXT,
    forecast_value  TEXT,
    actual_value    TEXT,
    surprise        TEXT,
    impact          TEXT,  -- LOW, MEDIUM, HIGH
    provider        TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_econ_events_time ON economic_events (event_time);

-- =========================================================
-- AI ANALYSIS
-- =========================================================
CREATE TABLE IF NOT EXISTS ai_analyses (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    market_summary  TEXT,
    technical_view  TEXT,
    fundamental_view TEXT,
    session_view    TEXT,
    liquidity_view  TEXT,
    crt_view        TEXT,
    bullish_scenario TEXT,
    bearish_scenario TEXT,
    invalidation    TEXT,
    risk            TEXT,
    confidence      TEXT,   -- Low, Medium, High
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- CORRELATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS market_correlations (
    id              BIGSERIAL PRIMARY KEY,
    instrument_a_id UUID REFERENCES instruments(id) ON DELETE CASCADE,
    instrument_b_id UUID REFERENCES instruments(id) ON DELETE CASCADE,
    period          TEXT NOT NULL,  -- 1D,5D,20D,60D,120D,1Y
    coefficient     NUMERIC(6,4),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (instrument_a_id, instrument_b_id, period)
);

-- =========================================================
-- ALERTS
-- =========================================================
CREATE TABLE IF NOT EXISTS market_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    alert_type      TEXT NOT NULL,  -- price, pct_change, indicator, breakout, volatility, news, scanner_score, crt, liquidity_sweep
    condition       JSONB NOT NULL, -- {"operator":">","value":1.17}
    is_active       BOOLEAN NOT NULL DEFAULT true,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- FUNDAMENTALS / BONDS / CRYPTO METRICS / CURRENCY STRENGTH
-- =========================================================
CREATE TABLE IF NOT EXISTS fundamentals (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    metric          TEXT NOT NULL,  -- pe_ratio, eps, market_cap, dividend_yield...
    value           NUMERIC(28,6),
    period          TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_financials (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    fiscal_period   TEXT,
    revenue         NUMERIC(28,4),
    net_income      NUMERIC(28,4),
    eps             NUMERIC(12,4),
    provider        TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bond_data (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    yield_value     NUMERIC(10,4),
    yield_change    NUMERIC(10,4),
    price           NUMERIC(20,8),
    duration        NUMERIC(10,4),
    maturity        DATE,
    spread          NUMERIC(10,4),
    provider        TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crypto_metrics (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    market_cap      NUMERIC(30,4),
    dominance_pct   NUMERIC(8,4),
    funding_rate    NUMERIC(10,6),
    open_interest   NUMERIC(28,4),
    liquidations_24h NUMERIC(28,4),
    volatility      NUMERIC(10,4),
    provider        TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS currency_strength (
    id              BIGSERIAL PRIMARY KEY,
    currency        TEXT NOT NULL,   -- USD, EUR, GBP...
    strength_score  NUMERIC(6,2) NOT NULL,
    timeframe       TEXT NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_currency_strength_time ON currency_strength (computed_at DESC);

-- =========================================================
-- CRT / LIQUIDITY
-- =========================================================
CREATE TABLE IF NOT EXISTS crt_analyses (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe       TEXT NOT NULL,
    reference_high  NUMERIC(20,8),
    reference_low   NUMERIC(20,8),
    range_expansion BOOLEAN,
    liquidity_sweep BOOLEAN,
    reclaim         BOOLEAN,
    displacement    BOOLEAN,
    status          TEXT NOT NULL,  -- CONFIRMED, POTENTIAL, INVALIDATED, WATCH
    entry_zone      NUMERIC(20,8),
    stop_zone       NUMERIC(20,8),
    target_zone     NUMERIC(20,8),
    session_context TEXT,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liquidity_events (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,  -- equal_highs, equal_lows, pdh, pdl, swing_high, swing_low, bos, sweep
    price_level     NUMERIC(20,8),
    timeframe       TEXT,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- JOURNAL (section 34 integration hook)
-- =========================================================
CREATE TABLE IF NOT EXISTS journal_trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE CASCADE,
    entry_price     NUMERIC(20,8),
    entry_time      TIMESTAMPTZ,
    session         TEXT,
    scanner_score   NUMERIC(5,2),
    technical_snapshot JSONB,
    ai_analysis_snapshot JSONB,
    news_snapshot   JSONB,
    exit_price      NUMERIC(20,8),
    exit_time       TIMESTAMPTZ,
    pnl             NUMERIC(20,8),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    action          TEXT NOT NULL,
    details         JSONB DEFAULT '{}'::jsonb,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed base markets/sessions
INSERT INTO markets (code, name) VALUES
  ('FOREX','Forex'), ('STOCKS','Stocks'), ('INDICES','Indices'),
  ('COMMODITIES','Commodities'), ('CRYPTO','Crypto'), ('BONDS','Bonds / Fixed Income'),
  ('ETF','ETFs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO market_sessions (name, open_utc, close_utc) VALUES
  ('Sydney','22:00','07:00'),
  ('Tokyo','00:00','09:00'),
  ('London','08:00','17:00'),
  ('New York','13:00','22:00')
ON CONFLICT (name) DO NOTHING;
