const db = require('../config/db');
const instrumentService = require('./instrumentService');
const quoteService = require('./quoteService');

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];

/**
 * Calculates a relative strength score per currency using the % change
 * of every major/cross pair that currency appears in. Purely derived
 * from live quotes fetched through quoteService — no manual entry.
 */
async function computeMatrix(timeframe = 'Daily') {
  const pairs = await instrumentService.getByMarket('FOREX', 200);
  const relevant = pairs.filter((p) => p.base_currency && p.quote_currency
    && CURRENCIES.includes(p.base_currency) && CURRENCIES.includes(p.quote_currency));

  if (relevant.length === 0) {
    return { data_status: 'UNAVAILABLE', reason: 'No forex instruments seeded', matrix: [] };
  }

  const quotes = await quoteService.getQuotesForInstruments(relevant);
  const scores = {};
  CURRENCIES.forEach((c) => { scores[c] = { sum: 0, count: 0 }; });

  let anyLive = false;
  for (const { instrument, quote } of quotes) {
    if (quote.data_status === 'UNAVAILABLE' || quote.change_pct == null) continue;
    anyLive = true;
    const pct = Number(quote.change_pct);
    // base currency gains when pair rises; quote currency gains when pair falls
    scores[instrument.base_currency].sum += pct;
    scores[instrument.base_currency].count += 1;
    scores[instrument.quote_currency].sum -= pct;
    scores[instrument.quote_currency].count += 1;
  }

  if (!anyLive) {
    return { data_status: 'UNAVAILABLE', reason: 'No live forex quotes available — configure a data provider API key', matrix: [] };
  }

  const matrix = CURRENCIES.map((c) => ({
    currency: c,
    score: scores[c].count > 0 ? Number((scores[c].sum / scores[c].count).toFixed(3)) : null
  })).sort((a, b) => (b.score || -999) - (a.score || -999));

  for (const row of matrix) {
    if (row.score != null) {
      await db.query(
        `INSERT INTO currency_strength (currency, strength_score, timeframe) VALUES ($1,$2,$3)`,
        [row.currency, row.score, timeframe]
      );
    }
  }

  return { data_status: 'LIVE', matrix };
}

module.exports = { computeMatrix, CURRENCIES };
