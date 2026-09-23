const instrumentService = require('../services/instrumentService');
const scannerService = require('../services/scannerService');

const TIMEFRAMES = new Set(['1M', '5M', '15M', '30M', '1H', '4H', 'Daily', 'Weekly', 'Monthly']);
const ASSETS = new Set(['ALL', 'FOREX', 'STOCKS', 'INDICES', 'COMMODITIES', 'CRYPTO', 'ETF', 'BONDS']);

function normalizeTimeframe(value) {
  return TIMEFRAMES.has(value) ? value : '1H';
}

exports.runScan = async (req, res, next) => {
  try {
    const asset = String(req.query.asset || 'ALL').toUpperCase();
    const timeframe = normalizeTimeframe(String(req.query.timeframe || '1H'));
    const parsedScore = Number(req.query.minScore ?? 0);
    const minScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : 0;

    if (!ASSETS.has(asset)) {
      return res.status(400).json({ error: `Unsupported asset class: ${asset}` });
    }

    const instruments = asset === 'ALL'
      ? await instrumentService.listAll(200)
      : await instrumentService.getByMarket(asset, 200);

    if (!instruments.length) {
      return res.json({ asset, timeframe, count: 0, results: [], note: 'No instruments found for this asset class.' });
    }

    const results = await scannerService.scanUniverse(instruments, timeframe, minScore);
    return res.json({
      asset,
      timeframe,
      min_score: minScore,
      scanned: instruments.length,
      count: results.length,
      results
    });
  } catch (err) {
    return next(err);
  }
};

exports.scanOne = async (req, res, next) => {
  try {
    const instrument = await instrumentService.getById(req.params.id);
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });
    const timeframe = normalizeTimeframe(String(req.query.timeframe || '1H'));
    const result = await scannerService.scanInstrument(instrument, timeframe);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

exports.multiTimeframe = async (req, res, next) => {
  try {
    const instrument = await instrumentService.getById(req.params.id);
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });

    const timeframes = ['1M', '5M', '15M', '30M', '1H', '4H', 'Daily', 'Weekly', 'Monthly'];
    const results = {};
    for (const tf of timeframes) {
      // Sequential execution protects free-tier provider limits.
      // eslint-disable-next-line no-await-in-loop
      const r = await scannerService.scanInstrument(instrument, tf);
      results[tf] = { bias: r.bias, data_status: r.data_status, score: r.score, confidence: r.confidence };
    }

    return res.json({ symbol: instrument.symbol, timeframes: results });
  } catch (err) {
    return next(err);
  }
};
