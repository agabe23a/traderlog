const crypto = require('crypto');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required' });
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/')}`);
}

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function csrfProtection(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const supplied = req.get('x-csrf-token') || req.body?._csrf;
  if (!supplied || !req.session.csrfToken) return res.status(403).json({ error: 'Invalid CSRF token' });
  const a=Buffer.from(String(supplied)); const b=Buffer.from(String(req.session.csrfToken));
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { requireAuth, csrfToken, csrfProtection };
