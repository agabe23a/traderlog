(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input=document.getElementById('globalSearch'), mobile=document.getElementById('tlMobileSearch'), box=document.getElementById('globalSearchResults');
let timer;
async function search(q){
 if(!box)return;
 if(!q.trim()){box.classList.add('d-none');box.innerHTML='';return}
 try{
  const r=await fetch('/api/instruments/search?q='+encodeURIComponent(q.trim()),{cache:'no-store'});
  const d=await r.json(); const rows=d.results||[];
  box.innerHTML=rows.map(x=>`<a class="tl-search-item" href="/instrument/${encodeURIComponent(x.id)}"><strong>${esc(x.symbol)}</strong><span>${esc(x.market_code||'MARKET')} · ${esc(x.name||'')}</span></a>`).join('')||'<div class="p-3 tl-muted">No instrument found in the current universe.</div>';
  box.classList.remove('d-none');
 }catch{box.innerHTML='<div class="p-3 tl-muted">Search unavailable.</div>';box.classList.remove('d-none')}
}
function bind(el){el?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(el.value),180)});el?.addEventListener('focus',()=>{if(el.value)search(el.value)});}
bind(input);bind(mobile);document.addEventListener('click',e=>{if(box&&!e.target.closest('#globalSearch')&&!e.target.closest('#globalSearchResults'))box.classList.add('d-none')});
})();