const express = require('express');
const router = express.Router();
const instrumentService = require('../services/instrumentService');
const watchlistService = require('../services/watchlistService');
const providerManager = require('../providers/providerManager');
const authController = require('../controllers/authController');
const { requireAuth, csrfToken } = require('../middleware/auth');

router.get('/', (req,res)=>res.render('landing',{title:'TRADERS LOG'}));
router.get('/login', authController.loginPage);
router.post('/login', authController.login);
router.get('/register', authController.registerPage);
router.post('/register', authController.register);
router.post('/logout', authController.logout);

router.get('/markets', (req,res)=>res.render('markets',{title:'Live Markets',user:req.session.user}));
router.get('/wallstreet', (req,res)=>res.render('wallstreet',{title:'Wall Street',user:req.session.user}));
router.get('/calculators', (req,res)=>res.render('calculators',{title:'Trading Calculators',user:req.session.user}));
router.get('/calendar', (req,res)=>res.render('calendar',{title:'Economic Calendar',user:req.session.user}));
router.get('/news', (req,res)=>res.render('news',{title:'Market News',user:req.session.user}));
router.get('/strategies', (req,res)=>res.render('strategies',{title:'Trading Strategy Lab',user:req.session.user}));
router.get('/education', (req,res)=>res.render('education',{title:'Trading Education',user:req.session.user}));
router.get('/portfolio', requireAuth, (req,res)=>res.render('portfolio',{title:'Trading Portfolio',user:req.session.user,csrfToken:csrfToken(req)}));

router.get('/scanner', (req,res)=>res.render('scanner',{title:'AI Market Scanner',configuredProviders:providerManager.listConfiguredProviders(),user:req.session.user}));

router.get('/dashboard', requireAuth, async (req,res,next)=>{
  try { res.render('dashboard',{title:'Trading Dashboard',user:req.session.user,csrfToken:csrfToken(req)}); } catch(e){next(e);}
});
router.get('/journal', requireAuth, async (req,res,next)=>{
  try { res.render('journal',{title:'Trading Journal',user:req.session.user,csrfToken:csrfToken(req)}); } catch(e){next(e);}
});
router.get('/journal/:id', requireAuth, async (req,res,next)=>{
  try { res.render('trade-detail',{title:'Trade detail',user:req.session.user,csrfToken:csrfToken(req),tradeId:req.params.id}); } catch(e){next(e);}
});
router.get('/watchlists', requireAuth, async (req,res,next)=>{
  try { const watchlists=await watchlistService.listForUser(req.session.userId); res.render('watchlists',{title:'Watchlists',watchlists,csrfToken:csrfToken(req),user:req.session.user}); } catch(e){next(e);}
});
router.get('/instrument/:id', async (req,res,next)=>{
 try { const instrument=await instrumentService.getById(req.params.id); if(!instrument)return res.status(404).render('404',{title:'Not found'}); res.render('instrument',{title:instrument.symbol,instrument,user:req.session.user}); }catch(e){next(e);}
});
module.exports=router;
