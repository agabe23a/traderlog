(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const nav=$('#landingNav');
  window.addEventListener('scroll',()=>nav&&nav.classList.toggle('scrolled',window.scrollY>24),{passive:true});

  // Mobile hamburger: robust open/close animation, independent of
  // Bootstrap's aria-expanded timing across browsers/webviews.
  const navToggler=$('.landing-toggler'), mobileNav=$('#mobileNav');
  if(navToggler && mobileNav){
    navToggler.addEventListener('click',()=>{
      setTimeout(()=>navToggler.classList.toggle('is-active',navToggler.getAttribute('aria-expanded')==='true'),0);
    });
    mobileNav.addEventListener('hidden.bs.collapse',()=>navToggler.classList.remove('is-active'));
    mobileNav.addEventListener('shown.bs.collapse',()=>navToggler.classList.add('is-active'));
    mobileNav.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>{
      navToggler.classList.remove('is-active');
      bootstrap.Collapse.getOrCreateInstance(mobileNav).hide();
    }));
  }

  const fadeObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});
  document.querySelectorAll('.fade-up').forEach(el=>fadeObserver.observe(el));

  const preferred=['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','NZD/USD','USD/CAD','XAU/USD','BTC/USD','ETH/USD','AAPL','TSLA','SPX'];
  const marketTable=$('#marketTable'), tickerTrack=$('#tickerTrack'), status=$('#marketStatus'), refreshLabel=$('#refreshLabel');
  let liveRows=[];

  function fmt(v, decimals=4){ if(v===null||v===undefined||Number.isNaN(Number(v)))return '—'; return Number(v).toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}); }
  function quoteDecimals(symbol){ if(/BTC|ETH|AAPL|TSLA|SPX|NASDAQ/.test(symbol)) return 2; if(/JPY/.test(symbol)) return 3; return 4; }
  function changeClass(v){ return Number(v)>0?'up':Number(v)<0?'down':'neutral'; }

  async function getInstruments(){
    const res=await fetch('/api/instruments');
    if(!res.ok) throw new Error('Instrument request failed');
    return (await res.json()).instruments||[];
  }
  async function getQuote(symbol){
    try{const res=await fetch('/api/quotes/symbol/'+encodeURIComponent(symbol),{cache:'no-store'}); if(!res.ok) return {symbol,quote:{data_status:'UNAVAILABLE'}}; return await res.json();}
    catch{return {symbol,quote:{data_status:'UNAVAILABLE'}};}
  }
  async function loadMarkets(){
    try{
      const instruments=await getInstruments();
      const bySymbol=new Map(instruments.map(i=>[String(i.symbol).toUpperCase(),i]));
      const selected=[];
      preferred.forEach(s=>{const i=bySymbol.get(s);if(i)selected.push(i)});
      instruments.forEach(i=>{if(selected.length<10&&!selected.includes(i)&&['FOREX','CRYPTO','STOCKS','INDICES','COMMODITIES'].includes(i.market_code))selected.push(i)});
      const results=await Promise.all(selected.slice(0,10).map(i=>getQuote(i.symbol)));
      liveRows=results.map((r,idx)=>({...selected[idx],...(r.quote||{})}));
      renderMarket();renderTicker();
      const live=liveRows.filter(r=>r.data_status==='LIVE').length;
      if(status){status.textContent=live?`${live} LIVE QUOTE${live===1?'':'S'}`:'DATA UNAVAILABLE';status.className='status-pill '+(live?'':'unavailable');}
      if(refreshLabel)refreshLabel.textContent='Updated '+new Date().toLocaleTimeString();
    }catch(err){
      console.error(err);if(status)status.textContent='DATA UNAVAILABLE';
      if(marketTable)marketTable.innerHTML='<tr><td colspan="6" class="empty-row">Live market data could not be loaded. Check your provider configuration.</td></tr>';
    }
  }
  function renderMarket(){
    if(!marketTable)return;
    if(!liveRows.length){marketTable.innerHTML='<tr><td colspan="6" class="empty-row">No instruments are available in the database.</td></tr>';return;}
    marketTable.innerHTML=liveRows.map(r=>{
      const d=quoteDecimals(r.symbol), ch=Number(r.change_pct), cls=changeClass(ch), statusCls=r.data_status==='LIVE'?'live':'unavailable';
      return `<tr><td><a class="symbol-link" href="/instrument/${encodeURIComponent(r.id)}">${escapeHtml(r.symbol)}</a><div class="tl-muted" style="font-size:.65rem">${escapeHtml(r.market_code||'')}</div></td><td>${fmt(r.price,d)}</td><td class="${cls}">${Number.isFinite(ch)?(ch>0?'▲ ':'▼ ')+Math.abs(ch).toFixed(2)+'%':'—'}</td><td>${fmt(r.day_high,d)}</td><td>${fmt(r.day_low,d)}</td><td><span class="data-badge ${statusCls}">${escapeHtml(r.data_status||'UNAVAILABLE')}</span></td></tr>`;
    }).join('');
  }
  function renderTicker(){
    if(!tickerTrack)return;
    const html=liveRows.map(r=>{const ch=Number(r.change_pct),cls=changeClass(ch),d=quoteDecimals(r.symbol);return `<span class="ticker-item"><strong>${escapeHtml(r.symbol)}</strong>${fmt(r.price,d)} <b class="${cls}">${Number.isFinite(ch)?(ch>0?'▲ ':'▼ ')+Math.abs(ch).toFixed(2)+'%':'—'}</b></span>`}).join('');
    tickerTrack.innerHTML=html+html;
  }
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  loadMarkets();setInterval(loadMarkets,60000);

  const sessionPanel=$('#sessionPanel');
  async function loadSessions(){
    if(!sessionPanel)return;
    try{const res=await fetch('/api/sessions',{cache:'no-store'});const data=await res.json();const sessions=data.sessions||[];sessionPanel.innerHTML=sessions.map(s=>`<div class="session-card ${s.is_open?'active':''}"><div class="session-name">${escapeHtml(s.name||'Session')}</div><div class="session-time">UTC ${escapeHtml(s.open_utc||'')} — ${escapeHtml(s.close_utc||'')}</div><div class="session-state">${s.is_open?'● ACTIVE':'○ CLOSED'}</div></div>`).join('') + (data.london_ny_overlap ? '<div class="session-card active"><div class="session-name">London–New York</div><div class="session-time">Overlap</div><div class="session-state">● ACTIVE</div></div>' : '');}catch{sessionPanel.innerHTML='<div class="tl-muted">Session data unavailable.</div>';}
  }
  loadSessions();setInterval(loadSessions,30000);

  // TradingView embed. The chart itself is a visualization service; prices shown in the market table remain provider/API driven.
  const chart=$('#tradingviewChart');
  function loadChart(symbol){
    if(!chart)return;
    chart.innerHTML='';
    const wrap=document.createElement('div');wrap.className='tradingview-widget-container';wrap.style.height='100%';wrap.style.width='100%';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';widget.style.height='100%';widget.style.width='100%';
    const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';script.async=true;const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Etc/UTC';script.innerHTML=JSON.stringify({autosize:true,symbol:symbol,interval:'60',timezone:tz,theme:'dark',style:'1',locale:'en',allow_symbol_change:true,withdateranges:true,hide_side_toolbar:false,details:true,hotlist:false,calendar:false,studies:['RSI@tv-basicstudies','MACD@tv-basicstudies'],support_host:'https://www.tradingview.com'});wrap.appendChild(widget);wrap.appendChild(script);chart.appendChild(wrap);
    document.querySelectorAll('.chart-symbol').forEach(b=>b.classList.toggle('active',b.dataset.symbol===symbol));
  }
  document.querySelectorAll('.chart-symbol').forEach(b=>b.addEventListener('click',()=>loadChart(b.dataset.symbol)));
  loadChart('FX:EURUSD');

  // Expand / collapse the analysis chart to fullscreen. Falls back to a
  // fixed full-viewport overlay (.chart-expanded) when the Fullscreen
  // API isn't available, e.g. inside mobile in-app browsers.
  const chartWrap=$('#tradingviewChart');
  const expandBtn=$('#chartExpandBtn');
  async function toggleChartExpand(){
    if(!chartWrap) return;
    try{
      if(document.fullscreenElement){ await document.exitFullscreen(); }
      else if(chartWrap.requestFullscreen){ await chartWrap.requestFullscreen(); }
      else { chartWrap.classList.toggle('chart-expanded'); document.body.classList.toggle('chart-lock-scroll'); }
    }catch(_){
      chartWrap.classList.toggle('chart-expanded');
      document.body.classList.toggle('chart-lock-scroll');
    }
  }
  function syncExpandLabel(){
    const expanded=document.fullscreenElement===chartWrap || chartWrap?.classList.contains('chart-expanded');
    if(!expandBtn) return;
    expandBtn.querySelector('span').textContent = expanded ? 'Collapse' : 'Expand';
    expandBtn.querySelector('i').className = expanded ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
  }
  expandBtn&&expandBtn.addEventListener('click',()=>{toggleChartExpand();setTimeout(syncExpandLabel,50);});
  document.addEventListener('fullscreenchange',syncExpandLabel);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&chartWrap&&chartWrap.classList.contains('chart-expanded')){chartWrap.classList.remove('chart-expanded');document.body.classList.remove('chart-lock-scroll');syncExpandLabel();}});

  const form=$('#contactForm');
  form&&form.addEventListener('submit',e=>{e.preventDefault();const name=$('#cfName').value.trim(),email=$('#cfEmail').value.trim(),phone=$('#cfPhone').value.trim(),message=$('#cfMessage').value.trim();const text=`Hello TRADERS LOG. My name is ${name}. Email: ${email}${phone?` Phone: ${phone}`:''}. ${message}`;window.open('https://wa.me/qr/UMC3HRXEUSROD1?text='+encodeURIComponent(text),'_blank','noopener');form.reset();});
})();
