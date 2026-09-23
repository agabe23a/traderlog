const bcrypt = require('bcryptjs');
const db = require('../config/db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createUser({ email, password, displayName }) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw Object.assign(new Error('A valid email address is required'), { status: 400 });
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw Object.assign(new Error('Password must be 10–128 characters'), { status: 400 });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email,password_hash,display_name) VALUES ($1,$2,$3)
       RETURNING id,email,display_name,timezone,created_at`,
      [email, hash, String(displayName || '').trim().slice(0,80) || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw Object.assign(new Error('An account with that email already exists'), { status: 409 });
    throw err;
  }
}

async function authenticate(email, password) {
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1 LIMIT 1', [String(email || '').trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) return null;
  await db.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
  return { id:user.id, email:user.email, display_name:user.display_name, timezone:user.timezone };
}

module.exports = { createUser, authenticate };
