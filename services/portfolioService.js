const db = require('../config/db');

function clean(v, max=120) { return String(v ?? '').trim().slice(0,max); }
function num(v, required=false) {
  if (v === '' || v == null) { if (required) throw Object.assign(new Error('Numeric value is required'),{status:400}); return null; }
  const n=Number(v); if (!Number.isFinite(n)) throw Object.assign(new Error('Invalid numeric value'),{status:400}); return n;
}
async function ensureAccount(userId, input={}) {
  if (input.account_id) {
    const r=await db.query('SELECT * FROM trading_accounts WHERE id=$1 AND user_id=$2',[input.account_id,userId]);
    if (!r.rows[0]) throw Object.assign(new Error('Account not found'),{status:404});
    return r.rows[0];
  }
  const r=await db.query('SELECT * FROM trading_accounts WHERE user_id=$1 ORDER BY created_at LIMIT 1',[userId]);
  if (r.rows[0]) return r.rows[0];
  const created=await db.query(`INSERT INTO trading_accounts(user_id,name,broker,account_type,currency,initial_balance)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId,clean(input.name||'Main Trading Account'),clean(input.broker),clean(input.account_type||'DEMO'),clean(input.currency||'USD',8),num(input.initial_balance)||0]);
  return created.rows[0];
}
async function accounts(userId){ return (await db.query('SELECT * FROM trading_accounts WHERE user_id=$1 ORDER BY created_at',[userId])).rows; }
async function createAccount(userId,input){
  const balance=num(input.initial_balance)||0;
  const r=await db.query(`INSERT INTO trading_accounts(user_id,name,broker,account_type,currency,initial_balance)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId,clean(input.name||'Trading Account'),clean(input.broker),clean(input.account_type||'DEMO'),clean(input.currency||'USD',8),balance]);
  return r.rows[0];
}
async function positions(userId){
 const r=await db.query(`SELECT p.*,i.symbol,i.name,a.name account_name,
   CASE WHEN p.current_price IS NULL THEN NULL
   WHEN p.direction='LONG' THEN (p.current_price-p.entry_price)*p.quantity
   ELSE (p.entry_price-p.current_price)*p.quantity END unrealized_pnl
   FROM portfolio_positions p
   LEFT JOIN instruments i ON i.id=p.instrument_id
   LEFT JOIN trading_accounts a ON a.id=p.account_id
   WHERE p.user_id=$1 ORDER BY p.created_at DESC`,[userId]);
 return r.rows;
}
async function createPosition(userId,input){
 const instrument=String(input.instrument_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(instrument)) throw Object.assign(new Error('Valid instrument_id is required'),{status:400});
 const direction=clean(input.direction).toUpperCase(); if(!['LONG','SHORT'].includes(direction)) throw Object.assign(new Error('Direction must be LONG or SHORT'),{status:400});
 const quantity=num(input.quantity,true), entry=num(input.entry_price,true);
 if(quantity<=0 || entry<0) throw Object.assign(new Error('Quantity and entry price must be valid positive values'),{status:400});
 const account=await ensureAccount(userId,input);
 const r=await db.query(`INSERT INTO portfolio_positions(user_id,account_id,instrument_id,direction,quantity,entry_price,current_price,stop_loss,take_profit,notes)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
 [userId,account.id,instrument,direction,quantity,entry,num(input.current_price),num(input.stop_loss),num(input.take_profit),clean(input.notes,2000)]);
 return (await positions(userId)).find(x=>x.id===r.rows[0].id);
}
async function updatePosition(userId,id,input){
 const current=await db.query('SELECT * FROM portfolio_positions WHERE id=$1 AND user_id=$2',[id,userId]);
 if(!current.rows[0]) throw Object.assign(new Error('Position not found'),{status:404});
 const row=current.rows[0];
 // Partial update: a field only changes if the caller actually sent it.
 // Falling back to Number(undefined)/String(undefined) here would silently
 // null out stop_loss/take_profit/notes on every edit that only touches
 // current_price (e.g. a live-price refresh) — this preserves the rest.
 const has=(k)=>Object.prototype.hasOwnProperty.call(input,k);
 const currentPrice=has('current_price')?num(input.current_price):row.current_price;
 const stopLoss=has('stop_loss')?num(input.stop_loss):row.stop_loss;
 const takeProfit=has('take_profit')?num(input.take_profit):row.take_profit;
 const notes=has('notes')?clean(input.notes,2000):row.notes;
 const r=await db.query(`UPDATE portfolio_positions SET current_price=$3,stop_loss=$4,take_profit=$5,notes=$6 WHERE id=$1 AND user_id=$2 RETURNING id`,
 [id,userId,currentPrice,stopLoss,takeProfit,notes]);
 if(!r.rows[0]) throw Object.assign(new Error('Position not found'),{status:404});
 return (await positions(userId)).find(x=>x.id===id);
}
async function removePosition(userId,id){
 const r=await db.query('DELETE FROM portfolio_positions WHERE id=$1 AND user_id=$2',[id,userId]);
 if(!r.rowCount) throw Object.assign(new Error('Position not found'),{status:404});
}
async function summary(userId){
 const [p,a,t]=await Promise.all([positions(userId),accounts(userId),db.query(`SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('DEPOSIT','DIVIDEND') THEN amount WHEN transaction_type IN ('WITHDRAWAL','FEE') THEN -amount ELSE 0 END),0) cash_adjustments FROM portfolio_transactions WHERE user_id=$1`,[userId])]);
 const unrealized=p.reduce((s,x)=>s+Number(x.unrealized_pnl||0),0);
 const capital=a.reduce((s,x)=>s+Number(x.initial_balance||0),0)+Number(t.rows[0].cash_adjustments||0);
 return {accounts:a,positions:p,capital,unrealized_pnl:unrealized,estimated_equity:capital+unrealized};
}
module.exports={accounts,createAccount,positions,createPosition,updatePosition,removePosition,summary};
