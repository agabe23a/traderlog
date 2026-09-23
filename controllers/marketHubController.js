const marketHub = require('../services/marketHubService');
const finnhub = require('../providers/finnhubProvider');

exports.overview = async (req, res, next) => {
  try {
    const market = req.query.market ? String(req.query.market).toUpperCase() : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 80);
    const rows = await marketHub.overview({ market, limit });
    res.json({
      data: rows.map(({ instrument, quote }) => ({
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        market_code: instrument.market_code,
        exchange_code: instrument.exchange_code,
        quote
      })),
      fetched_at: new Date().toISOString()
    });
  } catch (err) { next(err); }
};

exports.calendar = async (req, res, next) => {
  try {
    const now = new Date();
    const from = String(req.query.from || now.toISOString().slice(0, 10));
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + 7);
    const to = String(req.query.to || toDate.toISOString().slice(0, 10));
    const result = await finnhub.getEconomicCalendar(from, to);
    if (result.status === 'UNAVAILABLE') {
      return res.json({
        data: [],
        data_status: 'UNAVAILABLE',
        reason: result.reason,
        provider: finnhub.name,
        fetched_at: new Date().toISOString()
      });
    }
    res.json({ data: result.events, data_status: result.status, provider: result.provider, fetched_at: new Date().toISOString() });
  } catch (err) { next(err); }
};
