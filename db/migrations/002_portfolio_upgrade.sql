-- TRADERS LOG 3.0 — portfolio, journal exports and user preferences
CREATE TABLE IF NOT EXISTS trading_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 broker TEXT,
 account_type TEXT NOT NULL DEFAULT 'DEMO',
 currency TEXT NOT NULL DEFAULT 'USD',
 initial_balance NUMERIC(28,8) NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user ON trading_accounts(user_id, created_at);

CREATE TABLE IF NOT EXISTS portfolio_positions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
 instrument_id UUID REFERENCES instruments(id) ON DELETE CASCADE,
 direction TEXT NOT NULL CHECK(direction IN ('LONG','SHORT')),
 quantity NUMERIC(28,10) NOT NULL CHECK(quantity > 0),
 entry_price NUMERIC(20,8) NOT NULL CHECK(entry_price >= 0),
 current_price NUMERIC(20,8),
 stop_loss NUMERIC(20,8),
 take_profit NUMERIC(20,8),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_positions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
 transaction_type TEXT NOT NULL CHECK(transaction_type IN ('DEPOSIT','WITHDRAWAL','FEE','DIVIDEND','TRANSFER')),
 amount NUMERIC(28,8) NOT NULL,
 note TEXT,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_tx_user ON portfolio_transactions(user_id, occurred_at DESC);

DROP TRIGGER IF EXISTS trg_trading_accounts_updated_at ON trading_accounts;
CREATE TRIGGER trg_trading_accounts_updated_at BEFORE UPDATE ON trading_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_portfolio_positions_updated_at ON portfolio_positions;
CREATE TRIGGER trg_portfolio_positions_updated_at BEFORE UPDATE ON portfolio_positions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
