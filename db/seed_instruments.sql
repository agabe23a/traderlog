-- Instrument universe seed — a representative default set.
-- The architecture (instruments table + provider_symbols JSONB) supports
-- adding thousands more dynamically; this seed just populates the
-- default watchlists described in the spec.

-- Helper: insert instrument if not exists
DO $$
DECLARE
  v_market_id INTEGER;
BEGIN
  -- ===== FOREX MAJORS =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'FOREX';
  INSERT INTO instruments (symbol, name, market_id, base_currency, quote_currency)
  VALUES
    ('EUR/USD','Euro / US Dollar', v_market_id, 'EUR','USD'),
    ('GBP/USD','British Pound / US Dollar', v_market_id, 'GBP','USD'),
    ('USD/JPY','US Dollar / Japanese Yen', v_market_id, 'USD','JPY'),
    ('USD/CHF','US Dollar / Swiss Franc', v_market_id, 'USD','CHF'),
    ('AUD/USD','Australian Dollar / US Dollar', v_market_id, 'AUD','USD'),
    ('NZD/USD','New Zealand Dollar / US Dollar', v_market_id, 'NZD','USD'),
    ('USD/CAD','US Dollar / Canadian Dollar', v_market_id, 'USD','CAD'),
    -- Crosses
    ('EUR/GBP','Euro / British Pound', v_market_id, 'EUR','GBP'),
    ('EUR/JPY','Euro / Japanese Yen', v_market_id, 'EUR','JPY'),
    ('GBP/JPY','British Pound / Japanese Yen', v_market_id, 'GBP','JPY'),
    ('AUD/JPY','Australian Dollar / Japanese Yen', v_market_id, 'AUD','JPY'),
    -- Exotics incl. Kenya
    ('USD/KES','US Dollar / Kenyan Shilling', v_market_id, 'USD','KES'),
    ('USD/ZAR','US Dollar / South African Rand', v_market_id, 'USD','ZAR'),
    ('USD/TRY','US Dollar / Turkish Lira', v_market_id, 'USD','TRY'),
    ('USD/MXN','US Dollar / Mexican Peso', v_market_id, 'USD','MXN'),
    ('USD/INR','US Dollar / Indian Rupee', v_market_id, 'USD','INR')
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== COMMODITIES (metals, energy, agriculture) =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'COMMODITIES';
  INSERT INTO instruments (symbol, name, market_id, base_currency, quote_currency)
  VALUES
    ('XAU/USD','Gold', v_market_id, 'XAU','USD'),
    ('XAG/USD','Silver', v_market_id, 'XAG','USD'),
    ('XPT/USD','Platinum', v_market_id, 'XPT','USD'),
    ('XPD/USD','Palladium', v_market_id, 'XPD','USD'),
    ('WTI','WTI Crude Oil', v_market_id, NULL, 'USD'),
    ('BRENT','Brent Crude Oil', v_market_id, NULL, 'USD'),
    ('NATGAS','Natural Gas', v_market_id, NULL, 'USD'),
    ('COPPER','Copper', v_market_id, NULL, 'USD'),
    ('WHEAT','Wheat', v_market_id, NULL, 'USD'),
    ('CORN','Corn', v_market_id, NULL, 'USD'),
    ('COFFEE','Coffee', v_market_id, NULL, 'USD')
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== INDICES =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'INDICES';
  INSERT INTO instruments (symbol, name, market_id, country)
  VALUES
    ('SPX500','S&P 500', v_market_id, 'US'),
    ('NAS100','NASDAQ 100', v_market_id, 'US'),
    ('US30','Dow Jones Industrial Average', v_market_id, 'US'),
    ('RUT2000','Russell 2000', v_market_id, 'US'),
    ('VIX','CBOE Volatility Index', v_market_id, 'US'),
    ('GER40','DAX', v_market_id, 'DE'),
    ('UK100','FTSE 100', v_market_id, 'GB'),
    ('FRA40','CAC 40', v_market_id, 'FR'),
    ('JPN225','Nikkei 225', v_market_id, 'JP'),
    ('HK50','Hang Seng', v_market_id, 'HK'),
    ('IN50','Nifty 50', v_market_id, 'IN'),
    ('NSE20','NSE 20 Share Index', v_market_id, 'KE')
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== STOCKS (US large caps sample) =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'STOCKS';
  INSERT INTO instruments (symbol, name, market_id, sector, country)
  VALUES
    ('AAPL','Apple Inc.', v_market_id, 'Technology','US'),
    ('MSFT','Microsoft Corp.', v_market_id, 'Technology','US'),
    ('NVDA','NVIDIA Corp.', v_market_id, 'Technology','US'),
    ('AMZN','Amazon.com Inc.', v_market_id, 'Consumer','US'),
    ('GOOGL','Alphabet Inc. Class A', v_market_id, 'Technology','US'),
    ('META','Meta Platforms Inc.', v_market_id, 'Technology','US'),
    ('TSLA','Tesla Inc.', v_market_id, 'Consumer','US'),
    ('JPM','JPMorgan Chase & Co.', v_market_id, 'Financials','US'),
    ('LLY','Eli Lilly and Co.', v_market_id, 'Healthcare','US'),
    ('XOM','Exxon Mobil Corp.', v_market_id, 'Energy','US')
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== ETFs =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'ETF';
  INSERT INTO instruments (symbol, name, market_id)
  VALUES
    ('SPY','SPDR S&P 500 ETF', v_market_id),
    ('QQQ','Invesco QQQ Trust', v_market_id),
    ('GLD','SPDR Gold Shares', v_market_id),
    ('TLT','iShares 20+ Year Treasury Bond ETF', v_market_id)
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== BONDS =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'BONDS';
  INSERT INTO instruments (symbol, name, market_id, country)
  VALUES
    ('US10Y','US Treasury 10Y', v_market_id, 'US'),
    ('US2Y','US Treasury 2Y', v_market_id, 'US'),
    ('US30Y','US Treasury 30Y', v_market_id, 'US'),
    ('DE10Y','German Bund 10Y', v_market_id, 'DE'),
    ('UK10Y','UK Gilt 10Y', v_market_id, 'GB')
  ON CONFLICT (symbol, market_id) DO NOTHING;

  -- ===== CRYPTO =====
  SELECT id INTO v_market_id FROM markets WHERE code = 'CRYPTO';
  INSERT INTO instruments (symbol, name, market_id, base_currency, quote_currency)
  VALUES
    ('BTC/USD','Bitcoin', v_market_id, 'BTC','USD'),
    ('ETH/USD','Ethereum', v_market_id, 'ETH','USD'),
    ('BNB/USD','BNB', v_market_id, 'BNB','USD'),
    ('SOL/USD','Solana', v_market_id, 'SOL','USD'),
    ('XRP/USD','XRP', v_market_id, 'XRP','USD'),
    ('ADA/USD','Cardano', v_market_id, 'ADA','USD'),
    ('DOGE/USD','Dogecoin', v_market_id, 'DOGE','USD'),
    ('LINK/USD','Chainlink', v_market_id, 'LINK','USD')
  ON CONFLICT (symbol, market_id) DO NOTHING;

END $$;
