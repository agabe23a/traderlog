const db = require('../config/db');

const DIRECTIONS = new Set(['LONG','SHORT']);
const STATUSES = new Set(['OPEN','CLOSED','CANCELLED']);

function num(v, { min=null, max=null }={}) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || (min !== null && n < min) || (max !== null && n > max)) return null;
  return n;
}
function validateTrade(input, partial=false) {
  const d = {};
  if (!partial || input.instrument_id !== undefined) {
    if (!/^[0-9a-f-]{36}$/i.test(String(input.instrument_id||''))) throw Object.assign(new Error('Valid instrument_id is required'),{status:400});
    d.instrument_id=String(input.instrument_id);
  }
  if (!partial || input.direction !== undefined) {
    d.direction=String(input.direction||'').toUpperCase();
    if (!DIRECTIONS.has(d.direction)) throw Object.assign(new Error('Direction must be LONG or SHORT'),{status:400});
  }
  for (const k of ['entry_price','exit_price','position_size','stop_loss','take_profit','fees']) {
    if (!partial || input[k] !== undefined) {
      const n=num(input[k],{min:k==='position_size'?Number.EPSILON:0});
      if (n===null && input[k]!==null && input[k]!=='') throw Object.assign(new Error(`${k} must be a valid number`),{status:400});
      d[k]=n;
    }
  }
  for (const k of ['entry_time','exit_time']) {
    if (!partial || input[k] !== undefined) {
      const t=input[k] ? new Date(input[k]) : null;
      if (input[k] && Number.isNaN(t.getTime())) throw Object.assign(new Error(`${k} must be a valid date`),{status:400});
      d[k]=t ? t.toISOString() : null;
    }
  }
  for (const k of ['session','strategy','setup','emotions','notes']) if (!partial || input[k] !== undefined) d[k]=String(input[k]||'').trim().slice(0,10000)||null;
  if (!partial || input.tags !== undefined) {
    if (input.tags != null && !Array.isArray(input.tags)) throw Object.assign(new Error('tags must be an array'),{status:400});
    d.tags=[...new Set((input.tags||[]).map(x=>String(x).trim().slice(0,40)).filter(Boolean))].slice(0,30);
  }
  if (!partial || input.screenshots !== undefined) {
    if (input.screenshots != null && !Array.isArray(input.screenshots)) throw Object.assign(new Error('screenshots must be an array'),{status:400});
    d.screenshots=(input.screenshots||[]).map(u=>String(u)).filter(u=>/^https?:\/\//i.test(u)||/^\/uploads\//.test(u)).slice(0,10);
  }
  if (!partial || input.status !== undefined) {
    d.status=String(input.status || 'CLOSED').toUpperCase();
    if (!STATUSES.has(d.status)) throw Object.assign(new Error('Invalid trade status'),{status:400});
  }
  return d;
}
const { calculateTrade } = require('./tradeCalculations');
const calc = calculateTrade;
async function list(userId, opts={}) {
  const page=Math.max(1,Number(opts.page)||1), limit=Math.min(100,Math.max(1,Number(opts.limit)||25)), offset=(page-1)*limit;
  const vals=[userId]; const where=['t.user_id=$1'];
  if(opts.status){vals.push(String(opts.status).toUpperCase());where.push(`t.status=$${vals.length}`);}
  if(opts.strategy){vals.push(`%${String(opts.strategy).slice(0,80)}%`);where.push(`t.strategy ILIKE $${vals.length}`);}
  if(opts.q){vals.push(`%${String(opts.q).slice(0,80)}%`);where.push(`(i.symbol ILIKE $${vals.length} OR t.notes ILIKE $${vals.length})`);}
  const count=await db.query(`SELECT count(*)::int count FROM journal_trades t LEFT JOIN instruments i ON i.id=t.instrument_id WHERE ${where.join(' AND ')}`,vals);
  vals.push(limit,offset);
  const rows=await db.query(`SELECT t.*,i.symbol,i.name FROM journal_trades t LEFT JOIN instruments i ON i.id=t.instrument_id WHERE ${where.join(' AND ')} ORDER BY COALESCE(t.entry_time,t.created_at) DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,vals);
  return {items:rows.rows,total:count.rows[0].count,page,limit,pages:Math.ceil(count.rows[0].count/limit)};
}
async function listForExport(userId, opts={}) {
  const vals=[userId]; const where=['t.user_id=$1'];
  if(opts.status){vals.push(String(opts.status).toUpperCase());where.push(`t.status=$${vals.length}`);}
  if(opts.strategy){vals.push(`%${String(opts.strategy).slice(0,80)}%`);where.push(`t.strategy ILIKE $${vals.length}`);}
  if(opts.q){vals.push(`%${String(opts.q).slice(0,80)}%`);where.push(`(i.symbol ILIKE $${vals.length} OR t.notes ILIKE $${vals.length})`);}
  const rows=await db.query(`SELECT t.*,i.symbol,i.name FROM journal_trades t LEFT JOIN instruments i ON i.id=t.instrument_id WHERE ${where.join(' AND ')} ORDER BY COALESCE(t.entry_time,t.created_at) DESC`,vals);
  return rows.rows;
}
async function get(userId,id){
 const {rows}=await db.query(`SELECT t.*,i.symbol,i.name FROM journal_trades t LEFT JOIN instruments i ON i.id=t.instrument_id WHERE t.id=$1 AND t.user_id=$2`,[id,userId]); return rows[0];
}
async function create(userId,input){
 const d=calc(validateTrade(input));
 if(d.status==='CLOSED' && (!d.entry_price || !d.exit_price || !d.position_size)) throw Object.assign(new Error('Closed trades require entry price, exit price and position size'),{status:400});
 const {rows}=await db.query(`INSERT INTO journal_trades
 (user_id,instrument_id,direction,entry_price,entry_time,exit_price,exit_time,position_size,stop_loss,take_profit,risk_reward,fees,pnl,pnl_pct,duration_seconds,strategy,setup,session,emotions,notes,tags,screenshots,status)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`,
 [userId,d.instrument_id,d.direction,d.entry_price,d.entry_time,d.exit_price,d.exit_time,d.position_size,d.stop_loss,d.take_profit,d.risk_reward,d.fees||0,d.pnl,d.pnl_pct,d.duration_seconds,d.strategy,d.setup,d.session,d.emotions,d.notes,d.tags,JSON.stringify(d.screenshots),d.status]);
 return get(userId,rows[0].id);
}
async function update(userId,id,input){
 const current=await get(userId,id); if(!current) throw Object.assign(new Error('Trade not found'),{status:404});
 const d=calc(validateTrade({...current,...input},true));
 const {rows}=await db.query(`UPDATE journal_trades SET instrument_id=$3,direction=$4,entry_price=$5,entry_time=$6,position_size=$7,stop_loss=$8,take_profit=$9,risk_reward=$10,fees=$11,pnl=$12,pnl_pct=$13,duration_seconds=$14,strategy=$15,setup=$16,session=$17,emotions=$18,notes=$19,tags=$20,screenshots=$21,status=$22,exit_price=$23,exit_time=$24 WHERE id=$1 AND user_id=$2 RETURNING id`,
 [id,userId,d.instrument_id,d.direction,d.entry_price,d.entry_time,d.position_size,d.stop_loss,d.take_profit,d.risk_reward,d.fees||0,d.pnl,d.pnl_pct,d.duration_seconds,d.strategy,d.setup,d.session,d.emotions,d.notes,d.tags,JSON.stringify(d.screenshots),d.status,d.exit_price,d.exit_time]);
 return get(userId,rows[0].id);
}
async function remove(userId,id){const r=await db.query('DELETE FROM journal_trades WHERE id=$1 AND user_id=$2',[id,userId]); if(!r.rowCount) throw Object.assign(new Error('Trade not found'),{status:404});}
async function analytics(userId){
 const {rows}=await db.query(`WITH closed AS (
 SELECT t.*, COALESCE(t.pnl,0) realized FROM journal_trades t WHERE t.user_id=$1 AND t.status='CLOSED' AND t.pnl IS NOT NULL
), ordered AS (
 SELECT *, SUM(realized) OVER(ORDER BY COALESCE(exit_time,entry_time,created_at),id) equity FROM closed
), dd AS (
 SELECT *, equity-MAX(equity) OVER(ORDER BY COALESCE(exit_time,entry_time,created_at),id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) drawdown FROM ordered
)
SELECT COUNT(*)::int trades, COUNT(*) FILTER(WHERE realized>0)::int wins, COUNT(*) FILTER(WHERE realized<0)::int losses,
COALESCE(SUM(realized),0) net_pnl, COALESCE(AVG(realized) FILTER(WHERE realized>0),0) avg_win,
COALESCE(AVG(realized) FILTER(WHERE realized<0),0) avg_loss,
COALESCE(SUM(realized) FILTER(WHERE realized>0)/NULLIF(ABS(SUM(realized) FILTER(WHERE realized<0)),0),0) profit_factor,
COALESCE(AVG(realized),0) expectancy, COALESCE(ABS(MIN(drawdown)),0) max_drawdown,
COALESCE(AVG(risk_reward),0) avg_risk_reward FROM dd`,[userId]);
 const groups=await db.query(`SELECT strategy,COUNT(*)::int trades,COALESCE(SUM(pnl),0) pnl,COUNT(*) FILTER(WHERE pnl>0)::int wins FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY strategy ORDER BY pnl DESC NULLS LAST`,[userId]);
 const instruments=await db.query(`SELECT COALESCE(i.symbol,'Unknown') symbol,COUNT(*)::int trades,COALESCE(SUM(t.pnl),0) pnl FROM journal_trades t LEFT JOIN instruments i ON i.id=t.instrument_id WHERE t.user_id=$1 AND t.status='CLOSED' GROUP BY i.symbol ORDER BY pnl DESC`,[userId]);
 const daily=await db.query(`SELECT date_trunc('day',COALESCE(exit_time,entry_time,created_at)) day,COALESCE(SUM(pnl),0) pnl FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 1 ORDER BY 1`,[userId]);
 const periods=await db.query(`SELECT 'week' period,date_trunc('week',COALESCE(exit_time,entry_time,created_at)) bucket,COALESCE(SUM(pnl),0) pnl FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 2
 UNION ALL SELECT 'month',date_trunc('month',COALESCE(exit_time,entry_time,created_at)),COALESCE(SUM(pnl),0) FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 2 ORDER BY 2`,[userId]);
 const sessions=await db.query(`SELECT COALESCE(session,'Unspecified') session,COUNT(*)::int trades,COALESCE(SUM(pnl),0) pnl FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 1 ORDER BY pnl DESC`,[userId]);
 const setups=await db.query(`SELECT COALESCE(setup,'Unspecified') setup,COUNT(*)::int trades,COALESCE(SUM(pnl),0) pnl FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 1 ORDER BY pnl DESC`,[userId]);
 const equity=await db.query(`WITH x AS (SELECT COALESCE(exit_time,entry_time,created_at) at, SUM(pnl) pnl FROM journal_trades WHERE user_id=$1 AND status='CLOSED' GROUP BY 1) SELECT at,pnl,SUM(pnl) OVER(ORDER BY at) equity FROM x ORDER BY at`,[userId]);
 return {summary:rows[0],strategies:groups.rows,instruments:instruments.rows,daily:daily.rows,periods:periods.rows,sessions:sessions.rows,setups:setups.rows,equity:equity.rows};
}
module.exports={validateTrade,calc,list,listForExport,get,create,update,remove,analytics};
