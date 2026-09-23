(() => {
  'use strict';

  const root = document.querySelector('[data-instrument-id]');
  const instrumentId = root?.dataset.instrumentId;
  if (!instrumentId) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
  const n = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  const fmt = (v, max = 5) => {
    const x = n(v);
    return x == null ? '—' : x.toLocaleString(undefined, { maximumFractionDigits: max });
  };
  const biasClass = (bias) => bias === 'Bullish' ? 'tl-bullish' : bias === 'Bearish' ? 'tl-bearish' : 'tl-neutral';
  const actionClass = (action) => action === 'BUY' ? 'tl-bullish' : action === 'SELL' ? 'tl-bearish' : 'tl-neutral';

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function postJson(url, body) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function initWatchlistButton() {
    const btn = document.getElementById('addToWatchlistBtn');
    const menu = document.getElementById('watchlistDropdownMenu');
    if (!btn || !menu) return;

    function renderMenu(watchlists) {
      const items = (watchlists || []).map((wl) => `
        <li><button type="button" class="dropdown-item watchlist-add-item" data-id="${esc(wl.id)}" data-name="${esc(wl.name)}">
          <i class="bi bi-star"></i> ${esc(wl.name)}
        </button></li>`).join('');
      menu.innerHTML = `
        ${items || '<li><span class="dropdown-item-text tl-muted small">No watchlists yet — create one below.</span></li>'}
        <li><hr class="dropdown-divider"></li>
        <li>
          <div class="px-2 py-1 d-flex gap-1">
            <input type="text" class="form-control form-control-sm tl-select" id="newWatchlistName" placeholder="New watchlist name" maxlength="60">
            <button type="button" class="btn btn-sm tl-btn-gold" id="createWatchlistBtn" title="Create and add"><i class="bi bi-plus-lg"></i></button>
          </div>
        </li>`;

      menu.querySelectorAll('.watchlist-add-item').forEach((item) => {
        item.addEventListener('click', async (e) => {
          e.preventDefault();
          if (item.disabled) return;
          const id = item.dataset.id;
          const name = item.dataset.name;
          item.disabled = true;
          try {
            await postJson(`/api/watchlists/${encodeURIComponent(id)}/items`, { instrument_id: instrumentId });
            item.innerHTML = `<i class="bi bi-check2"></i> Added to ${esc(name)}`;
          } catch (err) {
            item.disabled = false;
            item.innerHTML = `<i class="bi bi-star"></i> ${esc(name)}`;
            alert(err.message || 'Could not add to that watchlist.');
          }
        });
      });

      document.getElementById('createWatchlistBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('newWatchlistName');
        const name = input?.value.trim();
        if (!name) { input?.focus(); return; }
        const createBtn = document.getElementById('createWatchlistBtn');
        createBtn.disabled = true;
        try {
          const created = await postJson('/api/watchlists', { name });
          const newId = created.watchlist?.id;
          if (newId) await postJson(`/api/watchlists/${encodeURIComponent(newId)}/items`, { instrument_id: instrumentId });
          btn.innerHTML = '<i class="bi bi-star-fill"></i> Saved';
          await loadWatchlists();
        } catch (err) {
          createBtn.disabled = false;
          alert(err.message || 'Could not create that watchlist.');
        }
      });
    }

    async function loadWatchlists() {
      menu.innerHTML = '<li><span class="dropdown-item-text tl-muted small">Loading watchlists…</span></li>';
      try {
        const data = await getJson('/api/watchlists');
        renderMenu(data.watchlists);
      } catch (err) {
        menu.innerHTML = `<li><span class="dropdown-item-text small tl-error">${esc(err.message || 'Could not load watchlists.')}</span></li>`;
      }
    }

    loadWatchlists();
  }

  async function loadQuote() {
    const el = document.getElementById('quoteBlock');
    try {
      const data = await getJson(`/api/quotes/${encodeURIComponent(instrumentId)}`);
      const q = data.quote || {};
      if (q.data_status === 'UNAVAILABLE') {
        el.innerHTML = `<div class="tl-error"><strong>DATA UNAVAILABLE</strong><div class="small mt-1">${esc(q.reason || 'No provider returned live data.')}</div></div>`;
        return;
      }
      const change = n(q.change_pct);
      const cls = change == null ? 'tl-neutral' : change >= 0 ? 'tl-bullish' : 'tl-bearish';
      el.innerHTML = `
        <div class="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <div class="tl-terminal-label">LIVE QUOTE</div>
            <div class="display-6 text-white fw-bold tl-mono">${fmt(q.price)}</div>
          </div>
          <div class="text-end">
            <div class="${cls} fs-5 fw-bold">${change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}</div>
            <span class="badge tl-badge-gold">${esc(q.data_status || 'UNKNOWN')}</span>
          </div>
        </div>
        <div class="row g-2 mt-3">
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">HIGH</div><div class="tl-kpi-value">${fmt(q.day_high)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">LOW</div><div class="tl-kpi-value">${fmt(q.day_low)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">OPEN</div><div class="tl-kpi-value">${fmt(q.day_open)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">VOLUME</div><div class="tl-kpi-value">${fmt(q.volume, 0)}</div></div></div>
        </div>
        <div class="tl-muted small mt-3 tl-mono">SOURCE ${esc(q.provider || '—')} · UPDATED ${q.fetched_at ? esc(new Date(q.fetched_at).toLocaleTimeString()) : '—'}</div>`;
    } catch (err) {
      el.innerHTML = `<div class="tl-error">${esc(err.message)}</div>`;
    }
  }

  async function loadScanner() {
    const el = document.getElementById('scannerBlock');
    try {
      const r = await getJson(`/api/scanner/${encodeURIComponent(instrumentId)}?timeframe=1H`);
      if (r.data_status === 'UNAVAILABLE') {
        el.innerHTML = `<div class="tl-error"><strong>NO SIGNAL</strong><div class="small mt-1">${esc(r.risks?.[0] || 'Insufficient live candle history.')}</div></div>`;
        return;
      }
      const metrics = r.metrics || {};
      const action = r.action || (r.bias === 'Bullish' ? 'BUY' : r.bias === 'Bearish' ? 'SELL' : 'WAIT');
      const sr = r.support_resistance || {};
      const crt = r.crt || {};
      el.innerHTML = `
        <div class="scanner-callout ${actionClass(action)}"><span class="scanner-callout-label">MODEL DECISION</span><strong>${esc(action)}</strong><span>${esc(r.bias || 'Neutral')} bias</span></div>
        <div class="${biasClass(r.bias)} fs-5 fw-bold mb-1">${esc(r.bias)} <span class="tl-muted">—</span> ${esc(r.condition)}</div>
        <div class="small tl-muted mb-3">${esc(r.momentum)} momentum · ${esc(r.volatility)} volatility · ${esc(r.confidence)} confidence</div>
        <div class="tl-kpi mb-3"><div class="d-flex justify-content-between"><span class="tl-terminal-label">SIGNAL SCORE</span><strong class="tl-heading">${esc(r.score)}/100</strong></div><div class="tl-mini-bar"><span style="width:${Math.max(0, Math.min(100, Number(r.score) || 0))}%"></span></div></div>
        <div class="row g-2 mb-3">
          <div class="col-6"><div class="tl-kpi"><div class="tl-terminal-label">RSI</div><div class="tl-kpi-value">${fmt(metrics.rsi, 1)}</div></div></div>
          <div class="col-6"><div class="tl-kpi"><div class="tl-terminal-label">ADX</div><div class="tl-kpi-value">${fmt(metrics.adx, 1)}</div></div></div>
          <div class="col-6"><div class="tl-kpi"><div class="tl-terminal-label">SUPPORT</div><div class="tl-kpi-value">${fmt(sr.support)}</div></div></div>
          <div class="col-6"><div class="tl-kpi"><div class="tl-terminal-label">RESISTANCE</div><div class="tl-kpi-value">${fmt(sr.resistance)}</div></div></div>
        </div>
        <div class="tl-kpi mb-3"><div class="tl-terminal-label">CRT RANGE MODEL</div><div class="fw-semibold text-white">${esc(crt.signal || 'Neutral')}</div><div class="small tl-muted mt-1">${esc(crt.reason || 'No CRT confirmation.')}</div></div>
        <div class="tl-terminal-label mb-1">EVIDENCE</div>
        <ul class="small ps-3">${(r.evidence || []).map((e) => `<li>${esc(e)}</li>`).join('') || '<li class="tl-muted">No supporting signals.</li>'}</ul>
        <div class="tl-terminal-label mt-3 mb-1">RISK / INVALIDATION</div>
        <ul class="small tl-muted ps-3">${(r.risks || []).map((rk) => `<li>${esc(rk)}</li>`).join('')}</ul>`;
    } catch (err) {
      el.innerHTML = `<div class="tl-error">${esc(err.message)}</div>`;
    }
  }

  async function loadMultiTimeframe() {
    const el = document.getElementById('multiTimeframeBlock');
    try {
      const data = await getJson(`/api/scanner/${encodeURIComponent(instrumentId)}/multi-timeframe`);
      const rows = Object.entries(data.timeframes || {});
      el.innerHTML = rows.map(([tf, r]) => `
        <div class="d-flex align-items-center justify-content-between border-bottom py-2" style="border-color:var(--tl-border)!important">
          <span class="tl-mono small">${esc(tf)}</span>
          <span class="${r.data_status === 'UNAVAILABLE' ? 'tl-muted' : biasClass(r.bias)}">${r.data_status === 'UNAVAILABLE' ? 'NO DATA' : esc(r.bias)}</span>
        </div>`).join('') || '<span class="tl-muted">No timeframe data.</span>';
    } catch (err) {
      el.innerHTML = `<div class="tl-error">${esc(err.message)}</div>`;
    }
  }

  function loadInstrumentChart(symbol) {
    const chart = document.getElementById('instrumentChart');
    if (!chart) return;
    chart.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%'; wrap.style.width = '100%';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%'; widget.style.width = '100%';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';
    script.innerHTML = JSON.stringify({ autosize:true, symbol, interval:'60', timezone:tz, theme:'dark', style:'1', locale:'en', allow_symbol_change:true, withdateranges:true, hide_side_toolbar:false, details:true, hotlist:false, calendar:false, studies:['RSI@tv-basicstudies','MACD@tv-basicstudies'], support_host:'https://www.tradingview.com' });
    wrap.appendChild(widget); wrap.appendChild(script); chart.appendChild(wrap);
  }

  async function toggleFullscreen(el) {
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else el.classList.toggle('chart-expanded');
    } catch (_) { el.classList.toggle('chart-expanded'); }
  }

  const instrumentSymbol = root?.dataset.symbol || '';
  const symbolMap = { 'EUR/USD':'FX:EURUSD','GBP/USD':'FX:GBPUSD','USD/JPY':'FX:USDJPY','USD/CHF':'FX:USDCHF','XAU/USD':'OANDA:XAUUSD','BTC/USD':'COINBASE:BTCUSD','ETH/USD':'COINBASE:ETHUSD' };
  loadInstrumentChart(symbolMap[instrumentSymbol] || instrumentSymbol.replace('/',''));
  document.getElementById('instrumentChartExpand')?.addEventListener('click', () => toggleFullscreen(document.querySelector('.instrument-chart-card')));

  loadQuote();
  loadScanner();
  loadMultiTimeframe();
  initWatchlistButton();
  setInterval(loadQuote, 30000);
})();
