const authService = require('../services/authService');
const { csrfToken } = require('../middleware/auth');

exports.loginPage = (req,res) => res.render('login', { title:'Sign in', csrfToken:csrfToken(req), next:String(req.query.next || '/dashboard') });
exports.registerPage = (req,res) => res.render('register', { title:'Create account', csrfToken:csrfToken(req) });

exports.login = async (req,res,next) => {
  try {
    const user = await authService.authenticate(req.body.email, req.body.password);
    if (!user) return res.status(401).render('login', { title:'Sign in', csrfToken:csrfToken(req), next:String(req.body.next || '/dashboard'), error:'Invalid email or password.' });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.user = user;
      req.session.csrfToken = csrfToken(req);
      res.redirect(String(req.body.next || '/dashboard').startsWith('/') ? String(req.body.next || '/dashboard') : '/dashboard');
    });
  } catch (err) { next(err); }
};

exports.register = async (req,res,next) => {
  try {
    const user = await authService.createUser(req.body);
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId=user.id; req.session.user=user; req.session.csrfToken=csrfToken(req);
      res.redirect('/dashboard');
    });
  } catch (err) {
    res.status(err.status || 500).render('register', { title:'Create account', csrfToken:csrfToken(req), error: err.status ? err.message : 'Unable to create account.' });
  }
};

exports.logout = (req,res,next) => req.session.destroy(err => err ? next(err) : res.redirect('/'));
