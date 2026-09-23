const db = require('../config/db');

async function search(term, limit = 20) {
  const like = `%${term}%`;
  const { rows } = await db.query(
    `SELECT i.*, m.code AS market_code, m.name AS market_name
     FROM instruments i
     JOIN markets m ON m.id = i.market_id
     LEFT JOIN instrument_aliases a ON a.instrument_id = i.id
     WHERE i.is_active = true
       AND (i.symbol ILIKE $1 OR i.name ILIKE $1 OR a.alias ILIKE $1)
     GROUP BY i.id, m.code, m.name
     ORDER BY (i.symbol ILIKE $2) DESC, i.symbol ASC
     LIMIT $3`,
    [like, term, limit]
  );
  return rows;
}

async function getByMarket(marketCode, limit = 500) {
  const { rows } = await db.query(
    `SELECT i.*, m.code AS market_code, m.name AS market_name
     FROM instruments i
     JOIN markets m ON m.id = i.market_id
     WHERE m.code = $1 AND i.is_active = true
     ORDER BY i.symbol ASC
     LIMIT $2`,
    [marketCode, limit]
  );
  return rows;
}

async function getById(id) {
  const { rows } = await db.query(
    `SELECT i.*, m.code AS market_code, m.name AS market_name
     FROM instruments i
     JOIN markets m ON m.id = i.market_id
     WHERE i.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getBySymbol(symbol) {
  const { rows } = await db.query(
    `SELECT i.*, m.code AS market_code, m.name AS market_name
     FROM instruments i
     JOIN markets m ON m.id = i.market_id
     WHERE i.symbol = $1
     LIMIT 1`,
    [symbol]
  );
  return rows[0] || null;
}

async function listAll(limit = 1000) {
  const { rows } = await db.query(
    `SELECT i.*, m.code AS market_code, m.name AS market_name
     FROM instruments i
     JOIN markets m ON m.id = i.market_id
     WHERE i.is_active = true
     ORDER BY m.code, i.symbol
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { search, getByMarket, getById, getBySymbol, listAll };
