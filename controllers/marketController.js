const instrumentService = require('../services/instrumentService');
const quoteService = require('../services/quoteService');
const candleService = require('../services/candleService');
const db = require('../config/db');

exports.listMarkets = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM markets ORDER BY id');
    res.json({ markets: rows });
  } catch (err) { next(err); }
};

exports.listInstruments = async (req, res, next) => {
  try {
    const { market, q } = req.query;
    let instruments;
    if (q) instruments = await instrumentService.search(String(q).slice(0, 80), 50);
    else if (market) instruments = await instrumentService.getByMarket(String(market).toUpperCase(), 500);
    else instruments = await instrumentService.listAll(500);
    res.json({ instruments });
  } catch (err) { next(err); }
};

exports.getQuote = async (req, res, next) => {
  try {
    const instrument = await instrumentService.getById(req.params.id);
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });
    const quote = await quoteService.getQuote(instrument);
    return res.json({ instrument: { id: instrument.id, symbol: instrument.symbol, name: instrument.name }, quote });
  } catch (err) { return next(err); }
};

exports.getQuoteBySymbol = async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol);
    const instrument = await instrumentService.getBySymbol(symbol);
    if (!instrument) return res.json({ symbol, quote: { data_status: 'UNAVAILABLE', reason: 'Instrument not in the database' } });
    const quote = await quoteService.getQuote(instrument);
    return res.json({ instrument: { id: instrument.id, symbol: instrument.symbol, name: instrument.name }, quote });
  } catch (err) { return next(err); }
};

exports.getCandles = async (req, res, next) => {
  try {
    const instrument = await instrumentService.getById(req.params.id);
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });
    const timeframe = String(req.query.timeframe || '1H');
    const requested = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 200, 30), 500);
    const result = await candleService.getCandles(instrument, timeframe, limit);
    return res.json({ instrument: { id: instrument.id, symbol: instrument.symbol }, timeframe, ...result });
  } catch (err) { return next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 80);
    if (!term) return res.json({ results: [] });
    const results = await instrumentService.search(term, 20);
    return res.json({ results });
  } catch (err) { return next(err); }
};
