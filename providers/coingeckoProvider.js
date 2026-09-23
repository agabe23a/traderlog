const fetch = require('node-fetch');

const BASE_URL = 'https://api.coingecko.com/api/v3';
const name = 'coingecko';

// Map our BTC/USD-style symbols to CoinGecko's coin ids.
// Extend this map (or move to provider_symbols on the instrument) as the
// crypto universe grows.
const SYMBOL_TO_ID = {
  'BTC/USD': 'bitcoin', 'ETH/USD': 'ethereum', 'BNB/USD': 'binancecoin',
  'SOL/USD': 'solana', 'XRP/USD': 'ripple', 'ADA/USD': 'cardano',
  'DOGE/USD': 'dogecoin', 'LINK/USD': 'chainlink', 'AVAX/USD': 'avalanche-2',
  'DOT/USD': 'polkadot', 'LTC/USD': 'litecoin', 'BCH/USD': 'bitcoin-cash',
  'ATOM/USD': 'cosmos', 'NEAR/USD': 'near', 'ARB/USD': 'arbitrum',
  'OP/USD': 'optimism', 'SUI/USD': 'sui', 'TON/USD': 'the-open-network',
  'TRX/USD': 'tron', 'XLM/USD': 'stellar', 'SHIB/USD': 'shiba-inu'
};

function isConfigured() {
  // CoinGecko's public endpoint works without a key at low volume; a key
  // just raises rate limits. Treat as "configured" so crypto works by default.
  return true;
}

function coinId(instrument) {
  return (instrument.provider_symbols && instrument.provider_symbols.coingecko)
    || SYMBOL_TO_ID[instrument.symbol];
}

function authHeaders() {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

async function getQuote(instrument) {
  const id = coinId(instrument);
  if (!id) return { status: 'UNAVAILABLE', reason: `No CoinGecko id mapped for ${instrument.symbol}` };

  const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${id}`;
  const res = await fetch(url, { headers: authHeaders(), timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `coingecko HTTP ${res.status}` };

  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    return { status: 'UNAVAILABLE', reason: 'coingecko returned no data' };
  }
  const d = arr[0];

  return {
    status: 'LIVE',
    provider: name,
    symbol: instrument.symbol,
    price: d.current_price,
    change_abs: d.price_change_24h,
    change_pct: d.price_change_percentage_24h,
    day_high: d.high_24h,
    day_low: d.low_24h,
    volume: d.total_volume,
    market_cap: d.market_cap,
    fetched_at: new Date().toISOString()
  };
}

async function getCandles(instrument, timeframe, limit = 200) {
  const id = coinId(instrument);
  if (!id) return { status: 'UNAVAILABLE', reason: `No CoinGecko id mapped for ${instrument.symbol}` };

  // CoinGecko's free OHLC endpoint only supports a fixed set of day ranges.
  const daysMap = { '1H': 1, '4H': 7, 'Daily': 30, 'Weekly': 90, 'Monthly': 365 };
  const days = daysMap[timeframe];
  if (!days) return { status: 'UNAVAILABLE', reason: `Unsupported timeframe ${timeframe} for coingecko` };

  const url = `${BASE_URL}/coins/${id}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { headers: authHeaders(), timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `coingecko HTTP ${res.status}` };

  const arr = await res.json();
  if (!Array.isArray(arr)) return { status: 'UNAVAILABLE', reason: 'coingecko returned no candles' };

  const candles = arr.slice(-limit).map(([ts, open, high, low, close]) => ({
    open_time: new Date(ts).toISOString(),
    open, high, low, close, volume: null
  }));

  return { status: 'LIVE', provider: name, timeframe, candles };
}

module.exports = { name, isConfigured, getQuote, getCandles };
