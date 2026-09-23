require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const morgan = require('morgan');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const { pool, healthCheck } = require('./config/db');
const { helmetMiddleware, apiLimiter } = require('./middleware/security');
const { csrfToken, csrfProtection } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmetMiddleware);
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use('/uploads', express.static(path.join(__dirname,'public/uploads'), { maxAge: isProduction ? '7d' : 0, index:false }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProduction ? '1d' : 0,
  etag: true
}));

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) { if (isProduction) throw new Error('SESSION_SECRET must be set to at least 32 characters in production'); sessionSecret=crypto.randomBytes(32).toString('hex'); console.warn('[security] generated an ephemeral development session secret.'); }

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: process.env.SESSION_COOKIE_NAME || 'traderslog.sid',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}));

app.use((req,res,next)=>{ res.locals.csrfToken=csrfToken(req); res.locals.user=req.session.user || null; next(); });
app.use(csrfProtection);

app.get('/health', async (req, res) => {
  try {
    const db = await healthCheck();
    res.json({
      ok: true,
      service: 'TRADERS LOG',
      uptime_seconds: Math.round(process.uptime()),
      db
    });
  } catch (err) {
    console.error('[health]', err.message);
    res.status(503).json({
      ok: false,
      service: 'TRADERS LOG',
      error: 'Database unavailable'
    });
  }
});

app.use('/api', apiLimiter, apiRoutes);
app.use('/', pageRoutes);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  return res.status(404).render('404', { title: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[error]', { message: err.message, code: err.code, status: err.status });
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: isProduction ? 'Internal server error' : err.message
    });
  }
  return res.status(err.status || 500).render('404', { title: 'Something went wrong' });
});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => console.log(`TRADERS LOG // terminal online // http://localhost:${PORT}`));
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  if (!server) return process.exit(0);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, get server(){ return server; } };
