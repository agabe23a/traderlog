const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const scannerController = require('../controllers/scannerController');
const watchlistController = require('../controllers/watchlistController');
const marketStateController = require('../controllers/marketStateController');
const journalController = require('../controllers/journalController');
const { requireAuth, csrfProtection } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const uploadController = require('../controllers/uploadController');
const portfolioController = require('../controllers/portfolioController');
const newsController = require('../controllers/newsController');
const marketHubController = require('../controllers/marketHubController');

router.get('/markets', marketController.listMarkets);
router.get('/instruments', marketController.listInstruments);
router.get('/instruments/search', marketController.search);
router.get('/quotes/:id', marketController.getQuote);
router.get('/quotes/symbol/:symbol', marketController.getQuoteBySymbol);
router.get('/candles/:id', marketController.getCandles);

router.get('/scanner', scannerController.runScan);
router.get('/scanner/:id', scannerController.scanOne);
router.get('/scanner/:id/multi-timeframe', scannerController.multiTimeframe);

router.use('/watchlists', requireAuth);
router.get('/watchlists', watchlistController.list);
router.post('/watchlists', csrfProtection, watchlistController.create);
router.patch('/watchlists/:id', csrfProtection, watchlistController.rename);
router.delete('/watchlists/:id', csrfProtection, watchlistController.remove);
router.get('/watchlists/:id/quotes', watchlistController.getWithQuotes);
router.post('/watchlists/:id/items', csrfProtection, watchlistController.addInstrument);
router.delete('/watchlists/:id/items/:instrumentId', csrfProtection, watchlistController.removeInstrument);

router.get('/sessions', marketStateController.getSessions);
router.get('/currency-strength', marketStateController.getCurrencyStrength);

router.use('/journal', requireAuth);
router.post('/journal/screenshots', csrfProtection, upload.array('screenshots',5), uploadController.screenshots);
router.get('/journal/export.csv', journalController.exportCsv);
router.get('/journal/export.json', journalController.exportJson);
router.get('/journal', journalController.list);
router.get('/journal/analytics', journalController.analytics);
router.get('/journal/:id', journalController.get);
router.post('/journal', csrfProtection, journalController.create);
router.patch('/journal/:id', csrfProtection, journalController.update);
router.delete('/journal/:id', csrfProtection, journalController.remove);

router.use('/portfolio', requireAuth);
router.get('/portfolio/summary', portfolioController.summary);
router.get('/portfolio/accounts', portfolioController.accounts);
router.post('/portfolio/accounts', csrfProtection, portfolioController.createAccount);
router.get('/portfolio/positions', portfolioController.positions);
router.post('/portfolio/positions', csrfProtection, portfolioController.createPosition);
router.patch('/portfolio/positions/:id', csrfProtection, portfolioController.updatePosition);
router.delete('/portfolio/positions/:id', csrfProtection, portfolioController.removePosition);

router.get('/news', newsController.latest);
router.get('/market-overview', marketHubController.overview);
router.get('/economic-calendar', marketHubController.calendar);

module.exports = router;
