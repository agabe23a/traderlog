/**
 * providerManager
 * ----------------
 * Central router for all market-data providers. NOTHING in this app is
 * allowed to invent a price, candle, or news item. Every provider method
 * either returns real data from the upstream API, or a clearly-tagged
 * UNAVAILABLE result: { status: 'UNAVAILABLE', reason: '...' }.
 *
 * To add a new provider: implement the same method shape as the ones
 * below (getQuote, getCandles, getNews, ...) and register it here.
 * Swapping providers never requires touching services/ or routes/.
 */

const twelveData = require('./twelveDataProvider');
const coingecko = require('./coingeckoProvider');
const alphaVantage = require('./alphavantageProvider');

const UNAVAILABLE = (reason) => ({ status: 'UNAVAILABLE', reason });

// Which provider is authoritative for which market. Order = fallback chain.
const QUOTE_PROVIDER_CHAIN = {
  FOREX: [twelveData, alphaVantage],
  STOCKS: [twelveData, alphaVantage],
  INDICES: [twelveData],
  COMMODITIES: [twelveData],
  ETF: [twelveData, alphaVantage],
  BONDS: [twelveData],
  CRYPTO: [coingecko, twelveData]
};

async function getQuote(instrument) {
  const chain = QUOTE_PROVIDER_CHAIN[instrument.market_code] || [];
  if (chain.length === 0) {
    return UNAVAILABLE(`No provider configured for market ${instrument.market_code}`);
  }
  for (const provider of chain) {
    if (!provider.isConfigured()) continue;
    try {
      const result = await provider.getQuote(instrument);
      if (result && result.status !== 'UNAVAILABLE') return result;
    } catch (err) {
      console.error(`[providerManager] ${provider.name} getQuote failed for ${instrument.symbol}:`, err.message);
      // fall through to next provider in chain
    }
  }
  return UNAVAILABLE('No configured provider returned live data for this instrument. Add an API key in .env to enable live quotes.');
}

async function getCandles(instrument, timeframe, limit = 200) {
  const chain = QUOTE_PROVIDER_CHAIN[instrument.market_code] || [];
  for (const provider of chain) {
    if (!provider.isConfigured() || !provider.getCandles) continue;
    try {
      const result = await provider.getCandles(instrument, timeframe, limit);
      if (result && result.status !== 'UNAVAILABLE') return result;
    } catch (err) {
      console.error(`[providerManager] ${provider.name} getCandles failed for ${instrument.symbol}:`, err.message);
    }
  }
  return UNAVAILABLE('No configured provider returned candle history for this instrument/timeframe.');
}

function listConfiguredProviders() {
  return [twelveData, coingecko, alphaVantage]
    .filter((p) => p.isConfigured())
    .map((p) => p.name);
}

module.exports = {
  getQuote,
  getCandles,
  listConfiguredProviders,
  UNAVAILABLE
};
