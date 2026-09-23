const db = require('../config/db');
const providerManager = require('../providers/providerManager');

const STALE_AFTER_MS = 2 * 60 * 1000;

async function getQuote(instrument) {
  const cached = await getLatestFromDb(instrument.id);
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < STALE_AFTER_MS) {
    return { ...cached, data_status: 'LIVE' };
  }

  const live = await providerManager.getQuote(instrument);
  if (live.status === 'UNAVAILABLE') {
    if (cached) return { ...cached, data_status: 'STALE' };
    return { data_status: 'UNAVAILABLE', reason: live.reason, symbol: instrument.symbol };
  }

  try {
    await persistQuote(instrument.id, live);
  } catch (err) {
    // Preserve the live upstream result even if historical persistence is temporarily down.
    console.error(`[quotes] persistence failed for ${instrument.symbol}:`, err.message);
  }
  return { ...live, data_status: 'LIVE' };
}

async function persistQuote(instrumentId, q) {
  await db.query(
    `INSERT INTO market_quotes
      (instrument_id, price, change_abs, change_pct, day_high, day_low, day_open, volume, market_cap, provider, data_status, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'LIVE',$11)`,
    [instrumentId, q.price, q.change_abs, q.change_pct, q.day_high, q.day_low, q.day_open, q.volume, q.market_cap || null, q.provider, q.fetched_at]
  );
}

async function getLatestFromDb(instrumentId) {
  const { rows } = await db.query(
    `SELECT * FROM market_quotes WHERE instrument_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
    [instrumentId]
  );
  return rows[0] || null;
}

async function getQuotesForInstruments(instruments) {
  const results = [];
  const concurrency = Math.max(1, Math.min(5, Number(process.env.SCANNER_CONCURRENCY || 5)));
  for (let i = 0; i < instruments.length; i += concurrency) {
    const batch = instruments.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((inst) => getQuote(inst).then((quote) => ({ instrument: inst, quote })))
    );
    results.push(...batchResults);
  }
  return results;
}

module.exports = { getQuote, getQuotesForInstruments };
