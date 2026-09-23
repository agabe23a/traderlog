const db = require('../config/db');

async function listForUser(userId) {
 const {rows}=await db.query('SELECT * FROM watchlists WHERE user_id=$1 ORDER BY sort_order,created_at',[userId]); return rows;
}
async function create(userId,name){const {rows}=await db.query('INSERT INTO watchlists(user_id,name) VALUES($1,$2) RETURNING *',[userId,name]);return rows[0];}
async function rename(userId,id,name){const {rows}=await db.query('UPDATE watchlists SET name=$3 WHERE id=$2 AND user_id=$1 RETURNING *',[userId,id,name]);return rows[0];}
async function remove(userId,id){const r=await db.query('DELETE FROM watchlists WHERE id=$2 AND user_id=$1',[userId,id]);if(!r.rowCount)throw Object.assign(new Error('Watchlist not found'),{status:404});}
async function owns(userId,id){const {rows}=await db.query('SELECT 1 FROM watchlists WHERE id=$1 AND user_id=$2',[id,userId]);return !!rows[0];}
async function addInstrument(userId,id,instrumentId){if(!await owns(userId,id))throw Object.assign(new Error('Watchlist not found'),{status:404});await db.query('INSERT INTO watchlist_items(watchlist_id,instrument_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,instrumentId]);}
async function removeInstrument(userId,id,instrumentId){if(!await owns(userId,id))throw Object.assign(new Error('Watchlist not found'),{status:404});await db.query('DELETE FROM watchlist_items WHERE watchlist_id=$1 AND instrument_id=$2',[id,instrumentId]);}
async function getInstruments(userId,id){if(!await owns(userId,id))throw Object.assign(new Error('Watchlist not found'),{status:404});const {rows}=await db.query(`SELECT i.*,m.code market_code,m.name market_name FROM watchlist_items wi JOIN instruments i ON i.id=wi.instrument_id JOIN markets m ON m.id=i.market_id WHERE wi.watchlist_id=$1 ORDER BY wi.sort_order,i.symbol`,[id]);return rows;}
module.exports={listForUser,create,rename,remove,addInstrument,removeInstrument,getInstruments};
