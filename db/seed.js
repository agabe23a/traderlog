require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function run() {
  const seed = fs.readFileSync(path.join(__dirname, 'seed_instruments.sql'), 'utf8');
  console.log('[seed] loading instrument universe ...');
  await pool.query(seed);
  console.log('[seed] done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] FAILED:', err.message);
  process.exit(1);
});
