const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'","https://cdnjs.cloudflare.com","https://cdn.jsdelivr.net","https://s3.tradingview.com","https://www.tradingview.com"],
      styleSrc: ["'self'","'unsafe-inline'","https://fonts.googleapis.com","https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'","https://fonts.gstatic.com","https://cdnjs.cloudflare.com","data:"],
      imgSrc: ["'self'","data:","https:"],
      connectSrc: ["'self'","https://api.twelvedata.com","https://www.alphavantage.co","https://api.coingecko.com","https://*.tradingview.com","wss://*.tradingview.com"],
      frameSrc: ["'self'","https://www.tradingview.com","https://s.tradingview.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProduction ? undefined : false
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT || 180),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again.' }
});

module.exports = { helmetMiddleware, apiLimiter };
