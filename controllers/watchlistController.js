const watchlistService = require('../services/watchlistService');
const quoteService = require('../services/quoteService');

// requireAuth guards the entire /watchlists namespace (see routes/api.js),
// so req.session.userId is always set by the time these run.
exports.list = async (req, res) => {
  const watchlists = await watchlistService.listForUser(req.session.userId);
  res.json({ watchlists });
};

exports.create = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const wl = await watchlistService.create(req.session.userId, name);
  res.json({ watchlist: wl });
};

exports.rename = async (req, res) => {
  const wl = await watchlistService.rename(req.session.userId, req.params.id, req.body.name);
  res.json({ watchlist: wl });
};

exports.remove = async (req, res) => {
  await watchlistService.remove(req.session.userId, req.params.id);
  res.json({ ok: true });
};

exports.addInstrument = async (req, res) => {
  await watchlistService.addInstrument(req.session.userId, req.params.id, req.body.instrument_id);
  res.json({ ok: true });
};

exports.removeInstrument = async (req, res) => {
  await watchlistService.removeInstrument(req.session.userId, req.params.id, req.params.instrumentId);
  res.json({ ok: true });
};

exports.getWithQuotes = async (req, res) => {
  const instruments = await watchlistService.getInstruments(req.session.userId, req.params.id);
  const quotes = await quoteService.getQuotesForInstruments(instruments);
  res.json({
    items: quotes.map(({ instrument, quote }) => ({ instrument, quote }))
  });
};
