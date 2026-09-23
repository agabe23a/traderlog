const sessionService = require('../services/sessionService');
const currencyStrengthService = require('../services/currencyStrengthService');

exports.getSessions = async (req, res) => {
  const states = await sessionService.getSessionStates();
  res.json({
    sessions: states,
    london_ny_overlap: sessionService.londonNewYorkOverlap(states)
  });
};

exports.getCurrencyStrength = async (req, res) => {
  const timeframe = req.query.timeframe || 'Daily';
  const result = await currencyStrengthService.computeMatrix(timeframe);
  res.json(result);
};
