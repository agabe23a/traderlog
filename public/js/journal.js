const csrf=()=>document.querySelector('meta[name="csrf-token"]')?.content||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
let modal;
async function uploadScreenshots(){const f=$('screenshotFiles').files;if(!f.length)return [];const fd=new FormData();[...f].forEach(x=>fd.append('screenshots',x));const r=await fetch('/api/journal/screenshots',{method:'POST',headers:{'X-CSRF-Token':csrf()},body:fd});const d=await r.json();if(!r.ok)throw Error(d.error||'Screenshot upload failed');return d.files.map(x=>x.url);}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json','X-CSRF-Token':csrf()};const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d;}
async function loadInstruments(){const d=await api('/api/instruments?limit=500');$('instrument').innerHTML=d.instruments.map(i=>`<option value="${esc(i.id)}">${esc(i.symbol)} — ${esc(i.name||'')}</option>`).join('');}
async function loadTrades(){const p=new URLSearchParams({page:1,limit:50});if($('status').value)p.set('status',$('status').value);if($('strategy').value)p.set('strategy',$('strategy').value);if($('search').value)p.set('q',$('search').value);const d=await api('/api/journal?'+p);const items=d.data||[];$('trades').innerHTML=items.length?items.map(t=>`<tr><td>${esc((t.entry_time||t.created_at||'').slice(0,16).replace('T',' '))}</td><td><a href="/journal/${esc(t.id)}" class="tl-link">${esc(t.symbol||'—')}</a></td><td class="${t.direction==='LONG'?'tl-bullish':'tl-bearish'}">${esc(t.direction)}</td><td>${esc(t.position_size??'—')}</td><td>${esc(t.entry_price??'—')}</td><td>${esc(t.exit_price??'—')}</td><td class="${Number(t.pnl)>0?'text-success':Number(t.pnl)<0?'text-danger':''}">${t.pnl==null?'—':Number(t.pnl).toFixed(2)}</td><td>${esc(t.status)}</td><td class="text-nowrap"><button class="btn btn-sm btn-outline-light edit" data-id="${t.id}"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger del" data-id="${t.id}"><i class="bi bi-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="9" class="text-center tl-muted py-5">No trades found.</td></tr>';document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>editTrade(b.dataset.id));document.querySelectorAll('.del').forEach(b=>b.onclick=()=>deleteTrade(b.dataset.id));}
async function deleteTrade(id){if(!confirm('Delete this trade? This cannot be undone.'))return;try{await api('/api/journal/'+id,{method:'DELETE'});await loadTrades();}catch(err){alert(err.message);}}
function val(id){return $(id).value||null}
// datetime-local inputs only accept "YYYY-MM-DDTHH:mm" (local wall-clock, no
// timezone suffix). The API returns full ISO strings with a "Z"/offset, which
// the input silently rejects — so without this conversion the field renders
// blank and re-saving the form wipes out entry_time/exit_time. Convert using
// local getters (not UTC) so the input shows the same moment the rest of the
// UI displays.
function toLocalInput(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fill(t={}){['instrument','direction','tradeStatus'].forEach((id)=>$(id).value=t[id==='instrument'?'instrument_id':id==='tradeStatus'?'status':id]||$(id).value);['entry_price','exit_price','position_size','stop_loss','take_profit','fees','emotions','notes'].forEach(id=>$(id).value=t[id]||'');$('entry_time').value=toLocalInput(t.entry_time);$('exit_time').value=toLocalInput(t.exit_time);$('strategyInput').value=t.strategy||'';$('setupInput').value=t.setup||'';$('sessionInput').value=t.session||'';$('tags').value=(t.tags||[]).join(', ');$('screenshots').value=(t.screenshots||[]).join(', ');}
function payload(){return {instrument_id:val('instrument'),direction:val('direction'),status:val('tradeStatus'),entry_price:val('entry_price'),exit_price:val('exit_price'),position_size:val('position_size'),stop_loss:val('stop_loss'),take_profit:val('take_profit'),fees:val('fees')||0,entry_time:val('entry_time'),exit_time:val('exit_time'),strategy:val('strategyInput'),setup:val('setupInput'),session:val('sessionInput'),emotions:val('emotions'),notes:val('notes'),tags:val('tags')?.split(',').map(x=>x.trim()).filter(Boolean)||[],screenshots:val('screenshots')?.split(',').map(x=>x.trim()).filter(Boolean)||[]};}
async function editTrade(id){const d=await api('/api/journal/'+id);$('tradeId').value=id;fill(d.data);$('formError').classList.add('d-none');modal.show();}
$('newTrade').onclick=()=>{$('tradeId').value='';fill();$('formError').classList.add('d-none');modal.show();};
$('filter').onclick=loadTrades;
$('tradeForm').onsubmit=async e=>{e.preventDefault();try{const id=$('tradeId').value;const uploaded=await uploadScreenshots();const p=payload();p.screenshots=[...(p.screenshots||[]),...uploaded];await api(id?'/api/journal/'+id:'/api/journal',{method:id?'PATCH':'POST',body:JSON.stringify(p)});modal.hide();await loadTrades();}catch(err){$('formError').textContent=err.message;$('formError').classList.remove('d-none');}};
modal=new bootstrap.Modal($('tradeModal'));loadInstruments().then(loadTrades).then(()=>{const editId=new URLSearchParams(location.search).get('edit');if(editId)editTrade(editId);}).catch(e=>{$('trades').innerHTML=`<tr><td colspan="9" class="text-danger">${esc(e.message)}</td></tr>`});
