const db = require('../config/db');
const providerManager = require('../providers/providerManager');

const MIN_CANDLES = 30;

async function getCandles(instrument, timeframe, limit = 200) {
  const safeLimit = Math.max(MIN_CANDLES, Math.min(Number(limit) || 200, 500));
  const cached = await getFromDb(instrument.id, timeframe, safeLimit);

  if (cached.length >= Math.min(safeLimit, MIN_CANDLES)) {
    return { data_status: 'LIVE', candles: cached };
  }

  const live = await providerManager.getCandles(instrument, timeframe, safeLimit);
  if (live.status === 'UNAVAILABLE') {
    if (cached.length > 0) return { data_status: 'STALE', candles: cached };
    return { data_status: 'UNAVAILABLE', reason: live.reason, candles: [] };
  }

  try {
    await persistCandles(instrument.id, timeframe, live.provider, live.candles);
  } catch (err) {
    // The live candles remain usable even when historical persistence is unavailable.
    console.error(`[candles] persistence failed for ${instrument.symbol}:`, err.message);
  }

  return { data_status: 'LIVE', candles: live.candles };
}

async function persistCandles(instrumentId, timeframe, provider, candles) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const c of candles) {
      await client.query(
        `INSERT INTO market_candles
          (instrument_id, timeframe, open_time, open, high, low, close, volume, provider, data_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'LIVE')
         ON CONFLICT (instrument_id, timeframe, open_time, provider) DO UPDATE
           SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
               close = EXCLUDED.close, volume = EXCLUDED.volume, data_status = 'LIVE'`,
        [instrumentId, timeframe, c.open_time, c.open, c.high, c.low, c.close, c.volume, provider]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getFromDb(instrumentId, timeframe, limit) {
  const { rows } = await db.query(
    `SELECT open_time, open, high, low, close, volume
     FROM market_candles
     WHERE instrument_id = $1 AND timeframe = $2
     ORDER BY open_time DESC
     LIMIT $3`,
    [instrumentId, timeframe, limit]
  );
  return rows.reverse();
}

module.exports = { getCandles };
