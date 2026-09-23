(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const state = {
    scanning: false,
    startedAt: 0,
    timer: null,
    results: [],
    auto: false,
    autoTimer: null
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function actionOf(r) {
    return r.action || (r.bias === 'Bullish' ? 'BUY' : r.bias === 'Bearish' ? 'SELL' : 'WAIT');
  }

  function actionClass(action) {
    return action === 'BUY' ? 'buy' : action === 'SELL' ? 'sell' : 'wait';
  }

  function setEngine(status, phase) {
    if ($('#engineStatus')) $('#engineStatus').textContent = status;
    if ($('#scanPhase')) $('#scanPhase').textContent = phase;
    if ($('#heroEngineState')) $('#heroEngineState').textContent = status.split(' // ')[0];
  }

  function addLog(message) {
    const log = $('#scanLog');
    if (!log) return;
    const row = document.createElement('div');
    row.innerHTML = `<span>${new Date().toLocaleTimeString([], { hour12: false })}</span> ${esc(message)}`;
    log.appendChild(row);
    while (log.children.length > 8) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function setProgress(value) {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    if ($('#scanProgressBar')) $('#scanProgressBar').style.width = `${safe}%`;
    if ($('#scanProgressText')) $('#scanProgressText').textContent = `${safe}%`;
    if ($('#radarPercent')) $('#radarPercent').textContent = safe < 100 ? `${safe}%` : 'LOCKED';
    if ($('#radarSub')) $('#radarSub').textContent = safe < 100 ? 'MAPPING' : 'SIGNAL LOCK';
  }

  function startTelemetry() {
    state.startedAt = performance.now();
    const phases = [
      [0, 'HANDSHAKE // PROVIDER LINK'],
      [14, 'MAPPING // INSTRUMENT UNIVERSE'],
      [32, 'INGEST // CANDLE STREAM'],
      [52, 'COMPUTE // TECHNICAL FACTORS'],
      [70, 'STRUCTURE // CRT + S/R'],
      [86, 'RANK // CONFLUENCE FIELD'],
      [94, 'VERIFY // DATA CONSISTENCY']
    ];
    let phaseIndex = 0;
    let visualProgress = 0;

    $('#scannerPanel')?.classList.add('is-scanning');
    $('#scanLog').innerHTML = '';
    $('#scanDataState').textContent = 'INGESTING PROVIDER DATA';
    addLog('Scanner engine initialized.');
    addLog('Opening market-data channels…');

    state.timer = setInterval(() => {
      const elapsed = (performance.now() - state.startedAt) / 1000;
      if ($('#scanDuration')) $('#scanDuration').textContent = `${elapsed.toFixed(1)}s`;
      const target = phases[Math.min(phaseIndex, phases.length - 1)];
      if (visualProgress < target[0]) visualProgress = target[0];
      visualProgress = Math.min(97, visualProgress + (visualProgress < 55 ? 1.35 : .62));
      setProgress(visualProgress);
      if (phaseIndex < phases.length - 1 && visualProgress >= phases[phaseIndex + 1][0]) {
        phaseIndex += 1;
        setEngine('SCANNING // ACTIVE', phases[phaseIndex][1]);
        addLog(phases[phaseIndex][1]);
      }
    }, 110);

    setEngine('SCANNING // ACTIVE', phases[0][1]);
  }

  function stopTelemetry() {
    clearInterval(state.timer);
    state.timer = null;
  }

  function scoreTone(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return 'neutral';
    if (n >= 70) return 'strong';
    if (n >= 55) return 'medium';
    return 'weak';
  }

  function fmt(v, digits = 2) {
    if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—';
    return Number(v).toFixed(digits);
  }

  function confidenceRank(v) {
    return ({ High: 3, Medium: 2, Low: 1 }[v] || 0);
  }

  function filteredResults() {
    const bias = $('#resultBiasFilter')?.value || 'ALL';
    const confidence = $('#confidenceFilter')?.value || 'ALL';
    return state.results.filter((r) => {
      if (bias !== 'ALL' && r.bias !== bias) return false;
      if (confidence !== 'ALL' && r.confidence !== confidence) return false;
      return true;
    });
  }

  function renderResults() {
    const container = $('#scanResults');
    if (!container) return;

    let results = filteredResults();
    const sort = $('#resultSort')?.value || 'score';
    results = [...results].sort((a, b) => {
      if (sort === 'symbol') return String(a.symbol).localeCompare(String(b.symbol));
      if (sort === 'confidence') return confidenceRank(b.confidence) - confidenceRank(a.confidence) || Number(b.score || 0) - Number(a.score || 0);
      return Number(b.score || 0) - Number(a.score || 0);
    });

    $('#resultCountLabel').textContent = `${results.length} RESULT${results.length === 1 ? '' : 'S'}`;

    if (!results.length) {
      container.innerHTML = `
        <div class="tl-empty-scanner">
          <div class="tl-empty-radar"><i class="bi bi-funnel"></i></div>
          <strong>No instruments match these filters</strong>
          <span>Adjust bias or confidence filters, or run a broader scan.</span>
        </div>`;
      return;
    }

    container.innerHTML = results.map((r, index) => {
      const action = actionOf(r);
      const sr = r.support_resistance || {};
      const crt = r.crt || {};
      const metrics = r.metrics || {};
      const plan = r.trade_plan || {};
      const evidence = Array.isArray(r.evidence) ? r.evidence.slice(0, 3) : [];
      const score = Number(r.score);
      const scorePct = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
      const tone = scoreTone(score);
      const dataStatus = r.data_status || 'UNKNOWN';

      const instrumentHref = `/instrument/${encodeURIComponent(r.instrument_id)}`;

      return `
      <article class="tl-opportunity-card" data-href="${instrumentHref}" tabindex="0" role="link" aria-label="Open ${esc(r.symbol)} workspace">
        <div class="tl-opportunity-top">
          <div class="tl-rank">#${index + 1}</div>
          <div class="tl-symbol-block">
            <a href="${instrumentHref}" class="tl-symbol">${esc(r.symbol)}</a>
            <div class="tl-subline">${esc(r.timeframe || '—')} · ${esc(r.condition || 'No setup')} · ${esc(dataStatus)}</div>
          </div>
          <div class="tl-action ${actionClass(action)}"><span>${esc(action)}</span><small>${esc(r.bias || 'Neutral')}</small></div>
          <div class="tl-score ${tone}">
            <div class="tl-score-ring" style="--score:${scorePct * 3.6}deg"><span>${Number.isFinite(score) ? Math.round(score) : '—'}</span></div>
            <small>CONFLUENCE</small>
          </div>
        </div>

        <div class="tl-evidence-strip">
          ${evidence.length ? evidence.map((e) => `<span><i class="bi bi-check2"></i>${esc(e)}</span>`).join('') : '<span><i class="bi bi-dash"></i>No additional evidence returned</span>'}
        </div>

        <div class="tl-opportunity-grid">
          <div class="tl-metric"><span>RSI</span><strong>${fmt(metrics.rsi, 1)}</strong></div>
          <div class="tl-metric"><span>ADX</span><strong>${fmt(metrics.adx, 1)}</strong></div>
          <div class="tl-metric"><span>ATR %</span><strong>${fmt(metrics.atr_pct, 2)}</strong></div>
          <div class="tl-metric"><span>MACD HIST</span><strong>${fmt(metrics.macd_histogram, 5)}</strong></div>
          <div class="tl-level"><span>SUPPORT</span><strong>${fmt(sr.support, 5)}</strong></div>
          <div class="tl-level"><span>RESISTANCE</span><strong>${fmt(sr.resistance, 5)}</strong></div>
          <div class="tl-level"><span>INVALIDATION</span><strong>${fmt(r.invalidation, 5)}</strong></div>
          <div class="tl-level"><span>CRT</span><strong>${esc(crt.signal || 'Neutral')}</strong></div>
        </div>

        <div class="tl-plan-row">
          <div><span>TRADE CONTEXT</span><strong>${esc(plan.action || action)} · ENTRY ${fmt(plan.entry, 5)}</strong></div>
          <div><span>STOP / INVALIDATION</span><strong>${fmt(plan.stop, 5)}</strong></div>
          <div><span>TARGET 1</span><strong>${fmt(plan.target1, 5)}</strong></div>
          <div><span>CONFIDENCE</span><strong>${esc(r.confidence || 'Low')}</strong></div>
        </div>

        <div class="tl-opportunity-footer">
          <span><i class="bi bi-shield-check"></i> Analytical output — verify price, news and execution conditions.</span>
          <a href="${instrumentHref}">OPEN WORKSPACE <i class="bi bi-arrow-up-right"></i></a>
        </div>
      </article>`;
    }).join('');
  }

  function renderSummary(results) {
    const valid = results.filter((r) => r.data_status !== 'UNAVAILABLE');
    $('#kpiAnalyzed').textContent = results.length;
    $('#kpiMatches').textContent = valid.length;
    $('#kpiBullish').textContent = valid.filter((r) => r.bias === 'Bullish').length;
    $('#kpiBearish').textContent = valid.filter((r) => r.bias === 'Bearish').length;
    $('#resultCountLabel').textContent = `${filteredResults().length} RESULTS`;
  }

  async function runScan() {
    if (state.scanning) return;

    const asset = $('#scanAsset').value;
    const timeframe = $('#scanTimeframe').value;
    const minScore = $('#scanMinScore').value;
    const button = $('#runScanBtn');

    state.scanning = true;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>SCANNING…</span><kbd>LIVE</kbd>';
    $('#clearScanBtn').disabled = true;
    startTelemetry();

    $('#pulseUniverse').textContent = asset;
    $('#pulseTimeframe').textContent = timeframe === 'Daily' ? '1D' : timeframe === 'Weekly' ? '1W' : timeframe;
    const started = performance.now();

    try {
      addLog(`Universe ${asset} // timeframe ${timeframe} // score floor ${minScore}`);
      await sleep(180);

      const response = await fetch(
        `/api/scanner?asset=${encodeURIComponent(asset)}&timeframe=${encodeURIComponent(timeframe)}&minScore=${encodeURIComponent(minScore)}`,
        { cache: 'no-store', headers: { Accept: 'application/json' } }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Scanner request failed (${response.status})`);

      state.results = Array.isArray(data.results) ? data.results : [];
      setProgress(100);
      setEngine('SCAN COMPLETE // SIGNAL LOCK', 'RESULTS // OPPORTUNITY FIELD READY');
      $('#scanDataState').textContent = state.results.length ? 'PROVIDER DATA PROCESSED' : 'NO QUALIFYING DATA';
      addLog(`Scan complete. ${data.count ?? state.results.length} ranked matches returned.`);
      renderSummary(state.results);
      renderResults();

      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      $('#lastScanLabel').textContent = `${new Date().toLocaleTimeString()} · ${seconds}s`;
      try {
        localStorage.setItem('traderslog.lastScan', JSON.stringify({
          at: new Date().toISOString(), asset, timeframe, count: data.count || 0
        }));
      } catch (_) {}
    } catch (err) {
      state.results = [];
      setEngine('SCAN INTERRUPTED', 'ERROR // DATA LINK CHECK REQUIRED');
      $('#scanDataState').textContent = 'DATA LINK ERROR';
      addLog(`ERROR: ${err.message}`);
      $('#scanResults').innerHTML = `
        <div class="tl-error">
          <strong><i class="bi bi-exclamation-triangle"></i> Scanner unavailable</strong>
          <div class="small mt-1">${esc(err.message)}</div>
        </div>`;
      $('#resultCountLabel').textContent = 'ERROR';
      setProgress(0);
    } finally {
      state.scanning = false;
      button.disabled = false;
      button.innerHTML = '<span class="scan-btn-icon"><i class="bi bi-radar"></i></span><span>RUN SCAN</span><kbd>CTRL ↵</kbd>';
      $('#clearScanBtn').disabled = false;
      stopTelemetry();
      $('#scannerPanel')?.classList.remove('is-scanning');
    }
  }

  function clearScan() {
    if (state.scanning) return;
    state.results = [];
    setProgress(0);
    setEngine('STANDBY // AWAITING COMMAND', 'SIGNAL GRID // STANDBY');
    $('#heroEngineState').textContent = 'READY';
    $('#radarPercent').textContent = 'READY';
    $('#radarSub').textContent = 'SYSTEM IDLE';
    $('#scanDuration').textContent = '00.0s';
    $('#scanDataState').textContent = 'DATA LINK STANDBY';
    $('#scanLog').innerHTML = '<div>Scanner engine ready. Awaiting universe selection.</div>';
    $('#scanResults').innerHTML = `
      <div class="tl-empty-scanner">
        <div class="tl-empty-radar"><i class="bi bi-radar"></i></div>
        <strong>Awaiting market reconnaissance</strong>
        <span>Configure the universe and timeframe, then run the scanner.</span>
      </div>`;
    $('#resultCountLabel').textContent = '0 RESULTS';
    ['kpiAnalyzed', 'kpiMatches', 'kpiBullish', 'kpiBearish'].forEach((id) => { $('#' + id).textContent = '—'; });
  }

  async function loadSessions() {
    const el = $('#sessionPanel');
    try {
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      const data = await res.json();
      const sessions = data.sessions || [];
      el.innerHTML = sessions.map((s) => `
        <div class="tl-session-row">
          <span><i class="bi bi-circle-fill ${s.is_open ? 'open' : ''}"></i>${esc(s.name)}</span>
          <strong class="${s.is_open ? 'tl-bullish' : 'tl-muted'}">${s.is_open ? 'OPEN' : 'CLOSED'}</strong>
        </div>
      `).join('') + (data.london_ny_overlap
        ? '<div class="tl-overlap-badge"><i class="bi bi-lightning-charge-fill"></i> LONDON / NY OVERLAP ACTIVE</div>' : '');
      $('#sessionPulse').textContent = 'SYNCED';
    } catch {
      el.innerHTML = '<span class="tl-muted">Session data unavailable.</span>';
      $('#sessionPulse').textContent = 'OFFLINE';
    }
  }

  async function loadCurrencyStrength() {
    const el = $('#currencyStrengthPanel');
    try {
      const res = await fetch('/api/currency-strength', { cache: 'no-store' });
      const data = await res.json();
      if (data.data_status === 'UNAVAILABLE' || !Array.isArray(data.matrix) || !data.matrix.length) {
        el.innerHTML = `<span class="tl-muted">DATA UNAVAILABLE — ${esc(data.reason || 'configure a forex provider')}</span>`;
        return;
      }
      const sorted = [...data.matrix].sort((a, b) => Number(b.score) - Number(a.score));
      const max = Math.max(...sorted.map(c => Math.abs(Number(c.score) || 0)), 1);
      el.innerHTML = sorted.map((c) => {
        const score = Number(c.score) || 0;
        const width = Math.min(100, Math.abs(score) / max * 100);
        return `<div class="tl-strength-row">
          <span class="tl-mono">${esc(c.currency)}</span>
          <div class="tl-strength-bar"><i class="${score >= 0 ? 'positive' : 'negative'}" style="width:${width}%"></i></div>
          <strong class="${score >= 0 ? 'tl-bullish' : 'tl-bearish'}">${score >= 0 ? '+' : ''}${esc(score)}</strong>
        </div>`;
      }).join('');
    } catch {
      el.innerHTML = '<span class="tl-muted">Currency strength unavailable.</span>';
    }
  }

  async function loadQuickWatchlist() {
    const el = $('#quickWatchlist');
    try {
      const res = await fetch('/api/watchlists', { cache: 'no-store' });
      const data = await res.json();
      const lists = data.watchlists || [];
      el.innerHTML = lists.length
        ? lists.slice(0, 5).map((w) => `<div class="tl-watch-row"><span><i class="bi bi-star-fill"></i>${esc(w.name)}</span><em>LIST</em></div>`).join('')
        : '<span class="tl-muted">Sign in to build watchlists.</span>';
    } catch {
      el.innerHTML = '<span class="tl-muted">Watchlists unavailable.</span>';
    }
  }

  function setTimeframe(value) {
    $('#scanTimeframe').value = value;
    document.querySelectorAll('.tl-tf-chip').forEach((b) => b.classList.toggle('is-active', b.dataset.tf === value));
    $('#pulseTimeframe').textContent = value === 'Daily' ? '1D' : value === 'Weekly' ? '1W' : value;
  }

  function updatePulse() {
    $('#pulseUniverse').textContent = $('#scanAsset').value;
    const tf = $('#scanTimeframe').value;
    $('#pulseTimeframe').textContent = tf === 'Daily' ? '1D' : tf === 'Weekly' ? '1W' : tf;
  }

  function toggleAuto() {
    state.auto = !state.auto;
    const btn = $('#autoScanBtn');
    btn.classList.toggle('is-active', state.auto);
    btn.setAttribute('aria-pressed', String(state.auto));
    if (state.auto) {
      btn.innerHTML = '<i class="bi bi-broadcast"></i> Auto ON';
      state.autoTimer = setInterval(() => { if (!state.scanning) runScan(); }, 5 * 60 * 1000);
      if (!state.results.length) runScan();
    } else {
      btn.innerHTML = '<i class="bi bi-broadcast"></i> Auto';
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  }

  function clock() {
    if ($('#scannerClock')) $('#scannerClock').textContent = new Date().toLocaleTimeString([], { hour12: false });
  }

  document.querySelectorAll('.tl-tf-chip').forEach((button) => {
    button.addEventListener('click', () => setTimeframe(button.dataset.tf));
  });

  $('#scanAsset')?.addEventListener('change', updatePulse);
  $('#scanMinScore')?.addEventListener('input', (event) => {
    $('#minScoreVal').textContent = event.target.value;
  });
  $('#resultBiasFilter')?.addEventListener('change', renderResults);
  $('#confidenceFilter')?.addEventListener('change', renderResults);
  $('#resultSort')?.addEventListener('change', renderResults);

  // Scan results are re-rendered into #scanResults on every filter/sort
  // change, so listeners are delegated on the stable container instead of
  // being bound to individual cards. Clicking/tapping anywhere on a card
  // opens its instrument page; clicks on the card's own <a> links are left
  // alone so they navigate natively without double-firing this handler.
  $('#scanResults')?.addEventListener('click', (event) => {
    const card = event.target.closest('.tl-opportunity-card');
    if (!card) return;
    if (event.target.closest('a')) return;
    const href = card.dataset.href;
    if (href) window.location.href = href;
  });
  $('#scanResults')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.tl-opportunity-card');
    if (!card || event.target.closest('a')) return;
    event.preventDefault();
    const href = card.dataset.href;
    if (href) window.location.href = href;
  });
  $('#runScanBtn')?.addEventListener('click', runScan);
  $('#clearScanBtn')?.addEventListener('click', clearScan);
  $('#refreshScanBtn')?.addEventListener('click', runScan);
  $('#autoScanBtn')?.addEventListener('click', toggleAuto);

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      runScan();
    }
  });

  clock();
  updatePulse();
  setInterval(clock, 1000);
  loadSessions();
  loadCurrencyStrength();
  loadQuickWatchlist();
  setInterval(loadSessions, 30000);
  setInterval(loadCurrencyStrength, 60000);
  setInterval(loadQuickWatchlist, 60000);
})();
