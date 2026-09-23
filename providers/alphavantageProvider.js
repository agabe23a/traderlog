const fetch = require('node-fetch');

const BASE_URL = 'https://www.alphavantage.co/query';
const name = 'alphavantage';

function apiKey() {
  return process.env.ALPHAVANTAGE_API_KEY;
}

function isConfigured() {
  return Boolean(apiKey());
}

async function getQuote(instrument) {
  if (!isConfigured()) return { status: 'UNAVAILABLE', reason: 'ALPHAVANTAGE_API_KEY not set' };

  const isForex = instrument.market_code === 'FOREX' && instrument.symbol.includes('/');
  let url;
  if (isForex) {
    const [from, to] = instrument.symbol.split('/');
    url = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${apiKey()}`;
  } else {
    url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(instrument.symbol)}&apikey=${apiKey()}`;
  }

  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `alphavantage HTTP ${res.status}` };
  const data = await res.json();

  if (isForex) {
    const r = data['Realtime Currency Exchange Rate'];
    if (!r) return { status: 'UNAVAILABLE', reason: data.Note || data.Information || 'alphavantage returned no forex rate' };
    return {
      status: 'LIVE',
      provider: name,
      symbol: instrument.symbol,
      price: Number(r['5. Exchange Rate']),
      fetched_at: new Date().toISOString()
    };
  }

  const q = data['Global Quote'];
  if (!q || !q['05. price']) {
    return { status: 'UNAVAILABLE', reason: data.Note || data.Information || 'alphavantage returned no quote' };
  }
  return {
    status: 'LIVE',
    provider: name,
    symbol: instrument.symbol,
    price: Number(q['05. price']),
    change_abs: Number(q['09. change']),
    change_pct: parseFloat(q['10. change percent']),
    day_high: Number(q['03. high']),
    day_low: Number(q['04. low']),
    day_open: Number(q['02. open']),
    volume: Number(q['06. volume']),
    fetched_at: new Date().toISOString()
  };
}

// Alpha Vantage candle support intentionally omitted from this scaffold —
// TIME_SERIES_INTRADAY/DAILY can be added here following the same shape
// as twelveDataProvider.getCandles when needed.

module.exports = { name, isConfigured, getQuote };
