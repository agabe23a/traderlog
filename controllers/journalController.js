const journal = require('../services/journalService');

exports.list = async (req,res,next)=>{try{const data=await journal.list(req.session.userId,req.query);res.json({data:data.items,meta:{page:data.page,limit:data.limit,total:data.total,pages:data.pages}});}catch(e){next(e);}};
exports.get = async (req,res,next)=>{try{const trade=await journal.get(req.session.userId,req.params.id);if(!trade)return res.status(404).json({error:'Trade not found'});res.json({data:trade});}catch(e){next(e);}};
exports.create = async (req,res,next)=>{try{res.status(201).json({data:await journal.create(req.session.userId,req.body)});}catch(e){next(e);}};
exports.update = async (req,res,next)=>{try{res.json({data:await journal.update(req.session.userId,req.params.id,req.body)});}catch(e){next(e);}};
exports.remove = async (req,res,next)=>{try{await journal.remove(req.session.userId,req.params.id);res.status(204).end();}catch(e){next(e);}};
exports.analytics = async (req,res,next)=>{try{res.json({data:await journal.analytics(req.session.userId)});}catch(e){next(e);}};

exports.exportCsv = async (req,res,next)=>{
 try{
  const rows=await journal.listForExport(req.session.userId,req.query);
  const cols=['entry_time','symbol','direction','status','position_size','entry_price','exit_price','stop_loss','take_profit','risk_reward','fees','pnl','pnl_pct','strategy','setup','session','emotions','tags','notes'];
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv=[cols.join(','),...rows.map(r=>cols.map(c=>Array.isArray(r[c])?esc(r[c].join('|')):esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="traders-log-journal.csv"');
  res.send('\ufeff'+csv);
 }catch(e){next(e);}
};
exports.exportJson = async (req,res,next)=>{
 try{
  const rows=await journal.listForExport(req.session.userId,req.query);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="traders-log-journal.json"');
  res.send(JSON.stringify({exported_at:new Date().toISOString(),trades:rows},null,2));
 }catch(e){next(e);}
};
