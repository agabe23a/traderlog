const instrumentService = require('./instrumentService');
const quoteService = require('./quoteService');

async function overview({ market, limit = 24 } = {}) {
  const instruments = market
    ? await instrumentService.getByMarket(String(market).toUpperCase(), Math.min(Number(limit) || 24, 80))
    : await instrumentService.listAll(Math.min(Number(limit) || 24, 80));
  return quoteService.getQuotesForInstruments(instruments);
}

module.exports = { overview };
