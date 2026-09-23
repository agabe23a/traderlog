-- TRADERS LOG 2.1 — additive, non-destructive journal/auth hardening
-- Safe to run repeatedly. No DROP/TRUNCATE/DELETE.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE journal_trades
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS position_size NUMERIC(28,10),
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS take_profit NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS risk_reward NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS fees NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pnl_pct NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS duration_seconds BIGINT,
  ADD COLUMN IF NOT EXISTS strategy TEXT,
  ADD COLUMN IF NOT EXISTS setup TEXT,
  ADD COLUMN IF NOT EXISTS emotions TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'CLOSED',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Normalize any legacy rows without changing their financial data.
UPDATE journal_trades
SET direction = COALESCE(direction, 'LONG'),
    status = CASE WHEN exit_time IS NULL THEN 'OPEN' ELSE COALESCE(status, 'CLOSED') END,
    fees = COALESCE(fees, 0),
    tags = COALESCE(tags, '{}'),
    screenshots = COALESCE(screenshots, '[]'::jsonb)
WHERE direction IS NULL OR status IS NULL OR fees IS NULL OR tags IS NULL OR screenshots IS NULL;

ALTER TABLE journal_trades
  DROP CONSTRAINT IF EXISTS journal_trades_direction_check;
ALTER TABLE journal_trades
  ADD CONSTRAINT journal_trades_direction_check
  CHECK (direction IN ('LONG','SHORT'));

ALTER TABLE journal_trades
  DROP CONSTRAINT IF EXISTS journal_trades_status_check;
ALTER TABLE journal_trades
  ADD CONSTRAINT journal_trades_status_check
  CHECK (status IN ('OPEN','CLOSED','CANCELLED'));

ALTER TABLE journal_trades
  DROP CONSTRAINT IF EXISTS journal_trades_size_check;
ALTER TABLE journal_trades
  ADD CONSTRAINT journal_trades_size_check
  CHECK (position_size IS NULL OR position_size > 0);

ALTER TABLE journal_trades
  DROP CONSTRAINT IF EXISTS journal_trades_fees_check;
ALTER TABLE journal_trades
  ADD CONSTRAINT journal_trades_fees_check
  CHECK (fees >= 0);

CREATE INDEX IF NOT EXISTS idx_journal_user_created ON journal_trades (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_status ON journal_trades (user_id, status, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_instrument ON journal_trades (user_id, instrument_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_strategy ON journal_trades (user_id, strategy);
CREATE INDEX IF NOT EXISTS idx_journal_user_session ON journal_trades (user_id, session);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs (user_id, created_at DESC);

-- Ensure updated_at is maintained without application trust.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_trades_updated_at ON journal_trades;
CREATE TRIGGER trg_journal_trades_updated_at
BEFORE UPDATE ON journal_trades
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
