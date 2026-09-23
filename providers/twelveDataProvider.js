const fetch = require('node-fetch');

const BASE_URL = 'https://api.twelvedata.com';
const name = 'twelvedata';

function apiKey() {
  return process.env.TWELVE_DATA_API_KEY;
}

function isConfigured() {
  return Boolean(apiKey());
}

function resolveSymbol(instrument) {
  // provider_symbols JSONB can override the default symbol per provider
  return (instrument.provider_symbols && instrument.provider_symbols.twelvedata) || instrument.symbol;
}

async function getQuote(instrument) {
  if (!isConfigured()) return { status: 'UNAVAILABLE', reason: 'TWELVE_DATA_API_KEY not set' };

  const symbol = resolveSymbol(instrument);
  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey()}`;
  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `twelvedata HTTP ${res.status}` };

  const data = await res.json();
  if (data.status === 'error' || data.code) {
    return { status: 'UNAVAILABLE', reason: data.message || 'twelvedata error' };
  }

  return {
    status: 'LIVE',
    provider: name,
    symbol: instrument.symbol,
    price: data.close != null ? Number(data.close) : null,
    change_abs: data.change != null ? Number(data.change) : null,
    change_pct: data.percent_change != null ? Number(data.percent_change) : null,
    day_high: data.high != null ? Number(data.high) : null,
    day_low: data.low != null ? Number(data.low) : null,
    day_open: data.open != null ? Number(data.open) : null,
    volume: data.volume != null ? Number(data.volume) : null,
    fetched_at: new Date().toISOString()
  };
}

async function getCandles(instrument, timeframe, limit = 200) {
  if (!isConfigured()) return { status: 'UNAVAILABLE', reason: 'TWELVE_DATA_API_KEY not set' };

  const intervalMap = {
    '1M': '1min', '5M': '5min', '15M': '15min', '30M': '30min',
    '1H': '1h', '4H': '4h', 'Daily': '1day', 'Weekly': '1week', 'Monthly': '1month'
  };
  const interval = intervalMap[timeframe];
  if (!interval) return { status: 'UNAVAILABLE', reason: `Unsupported timeframe ${timeframe}` };

  const symbol = resolveSymbol(instrument);
  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${limit}&apikey=${apiKey()}`;
  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `twelvedata HTTP ${res.status}` };

  const data = await res.json();
  if (data.status === 'error' || !data.values) {
    return { status: 'UNAVAILABLE', reason: data.message || 'twelvedata returned no candles' };
  }

  const candles = data.values.map((v) => ({
    open_time: v.datetime,
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: v.volume != null ? Number(v.volume) : null
  })).reverse(); // twelvedata returns newest-first; we want chronological

  return { status: 'LIVE', provider: name, timeframe, candles };
}

module.exports = { name, isConfigured, getQuote, getCandles };
