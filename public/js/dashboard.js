if (window.Chart) {
  Chart.defaults.color = '#8b9188';
  Chart.defaults.borderColor = 'rgba(139,145,136,.18)';
  Chart.defaults.font.family = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function pnlColors(values) { return values.map((v) => Number(v) >= 0 ? '#1f6e42' : '#d1453b'); }

function renderPnlList(elId, rows, labelKey, emptyMessage) {
  document.getElementById(elId).innerHTML = rows.map((x) => `
    <div class="d-flex justify-content-between border-bottom py-2">
      <span>${esc(x[labelKey])}</span>
      <strong>${Number(x.pnl).toFixed(2)}</strong>
    </div>`).join('') || `<span class="tl-muted">${emptyMessage}</span>`;
}

async function load() {
  const r = await fetch('/api/journal/analytics');
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(raw.error || 'Unable to load analytics');

  const d = raw.data || {};
  const s = d.summary || {};

  const cards = [
    ['Trades', s.trades || 0],
    ['Win rate', s.trades ? ((s.wins / s.trades) * 100).toFixed(1) + '%' : '0%'],
    ['Net P&L', Number(s.net_pnl || 0).toFixed(2)],
    ['Avg win', Number(s.avg_win || 0).toFixed(2)],
    ['Avg loss', Number(s.avg_loss || 0).toFixed(2)],
    ['Profit factor', Number(s.profit_factor || 0).toFixed(2)],
    ['Expectancy', Number(s.expectancy || 0).toFixed(2)],
    ['Max drawdown', Number(s.max_drawdown || 0).toFixed(2)],
    ['Avg R:R', Number(s.avg_risk_reward || 0).toFixed(2)]
  ];
  document.getElementById('metrics').innerHTML = cards.map((x) => `
    <div class="col-6 col-md-4 col-xl-3">
      <div class="tl-card p-3 h-100">
        <div class="tl-terminal-label">${esc(x[0])}</div>
        <div class="fs-4 fw-bold mt-1">${esc(x[1])}</div>
      </div>
    </div>`).join('');

  const daily = d.daily || [];
  const dailyVals = daily.map((x) => Number(x.pnl));
  new Chart(document.getElementById('daily'), {
    type: 'bar',
    data: {
      labels: daily.map((x) => new Date(x.day).toLocaleDateString()),
      datasets: [{ label: 'P&L', data: dailyVals, backgroundColor: pnlColors(dailyVals), borderRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const strategies = (d.strategies || []).slice(0, 8);
  const stratVals = strategies.map((x) => Number(x.pnl));
  new Chart(document.getElementById('strategies'), {
    type: 'bar',
    data: {
      labels: strategies.map((x) => x.strategy || 'Unspecified'),
      datasets: [{ label: 'P&L', data: stratVals, backgroundColor: pnlColors(stratVals), borderRadius: 4 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
  });

  renderPnlList('instruments', (d.instruments || []).slice(0, 12), 'symbol', 'No closed trades yet.');
  renderPnlList('sessions', d.sessions || [], 'session', 'No session data.');
  renderPnlList('setups', (d.setups || []).slice(0, 10), 'setup', 'No setup data.');

  const eq = (d.equity || []).map((x) => Number(x.equity));
  new Chart(document.getElementById('equity'), {
    type: 'line',
    data: {
      labels: (d.equity || []).map((x) => new Date(x.at).toLocaleDateString()),
      datasets: [{
        label: 'Equity', data: eq, tension: .25, borderColor: '#d4af37',
        backgroundColor: 'rgba(212,175,55,.12)', fill: true, pointRadius: 0
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

load().catch((e) => {
  document.getElementById('metrics').innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
});
