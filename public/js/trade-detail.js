(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = document.querySelector('[data-trade-id]');
  const tradeId = root?.dataset.tradeId;
  if (!tradeId) return;

  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
  const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 5 });

  async function api(url, opt = {}) {
    opt.headers = { ...(opt.headers || {}), 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() };
    const res = await fetch(url, opt);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function showError(message) {
    const el = $('tdError');
    el.textContent = message;
    el.classList.remove('d-none');
  }

  async function load() {
    try {
      const { data: t } = await api(`/api/journal/${encodeURIComponent(tradeId)}`);
      document.title = `${t.symbol || 'Trade'} — TRADERS LOG`;
      $('tdSymbol').innerHTML = `${esc(t.symbol || 'Trade')} <span class="${t.direction === 'LONG' ? 'tl-bullish' : 'tl-bearish'} fs-5">${esc(t.direction)}</span>`;

      const pnl = t.pnl === null || t.pnl === undefined ? null : Number(t.pnl);
      const pnlClass = pnl === null ? 'tl-neutral' : pnl > 0 ? 'tl-bullish' : pnl < 0 ? 'tl-bearish' : 'tl-neutral';

      $('tdSummary').innerHTML = `
        <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
          <div>
            <div class="tl-terminal-label">REALISED P&amp;L</div>
            <div class="display-6 fw-bold ${pnlClass}">${pnl === null ? '—' : (pnl >= 0 ? '+' : '') + pnl.toFixed(2)}</div>
          </div>
          <span class="badge tl-badge-gold">${esc(t.status)}</span>
        </div>
        <div class="row g-2">
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">ENTRY</div><div class="tl-kpi-value">${fmt(t.entry_price)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">EXIT</div><div class="tl-kpi-value">${fmt(t.exit_price)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">SIZE</div><div class="tl-kpi-value">${fmt(t.position_size)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">FEES</div><div class="tl-kpi-value">${fmt(t.fees)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">STOP LOSS</div><div class="tl-kpi-value">${fmt(t.stop_loss)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">TAKE PROFIT</div><div class="tl-kpi-value">${fmt(t.take_profit)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">RISK:REWARD</div><div class="tl-kpi-value">${fmt(t.risk_reward)}</div></div></div>
          <div class="col-6 col-md-3"><div class="tl-kpi"><div class="tl-terminal-label">P&amp;L %</div><div class="tl-kpi-value">${t.pnl_pct == null ? '—' : Number(t.pnl_pct).toFixed(2) + '%'}</div></div></div>
        </div>
        <div class="tl-muted small mt-3 tl-mono">
          ENTRY ${t.entry_time ? esc(new Date(t.entry_time).toLocaleString()) : '—'} · EXIT ${t.exit_time ? esc(new Date(t.exit_time).toLocaleString()) : '—'}
        </div>`;

      $('tdNotes').textContent = t.notes || 'No notes recorded for this trade.';
      $('tdEmotions').textContent = t.emotions || 'Not recorded.';

      $('tdFactors').innerHTML = `
        <div class="d-flex justify-content-between border-bottom py-2" style="border-color:var(--tl-border)!important"><span class="tl-muted">Strategy</span><strong>${esc(t.strategy || '—')}</strong></div>
        <div class="d-flex justify-content-between border-bottom py-2" style="border-color:var(--tl-border)!important"><span class="tl-muted">Setup</span><strong>${esc(t.setup || '—')}</strong></div>
        <div class="d-flex justify-content-between border-bottom py-2" style="border-color:var(--tl-border)!important"><span class="tl-muted">Session</span><strong>${esc(t.session || '—')}</strong></div>
        <div class="d-flex justify-content-between py-2"><span class="tl-muted">Tags</span><strong>${(t.tags || []).map(esc).join(', ') || '—'}</strong></div>`;

      const screenshots = Array.isArray(t.screenshots) ? t.screenshots : (typeof t.screenshots === 'string' ? JSON.parse(t.screenshots || '[]') : []);
      $('tdScreens').innerHTML = screenshots.length
        ? `<div class="d-flex flex-wrap gap-2">${screenshots.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Trade screenshot" style="width:140px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--tl-border)"></a>`).join('')}</div>`
        : 'No screenshots attached.';

      $('tdEdit').onclick = () => { window.location.href = `/journal?edit=${encodeURIComponent(tradeId)}`; };
      $('tdDelete').onclick = async () => {
        if (!confirm('Delete this trade? This cannot be undone.')) return;
        try {
          await api(`/api/journal/${encodeURIComponent(tradeId)}`, { method: 'DELETE' });
          window.location.href = '/journal';
        } catch (err) { showError(err.message); }
      };
    } catch (err) {
      $('tdSymbol').textContent = 'Trade not found';
      $('tdSummary').innerHTML = '';
      showError(err.message);
    }
  }

  load();
})();
