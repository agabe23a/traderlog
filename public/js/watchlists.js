(() => {
  'use strict';
  let activeWatchlistId = null;
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = (v) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 });

  function statusBadge(status) {
    const safe = esc(status || 'UNKNOWN');
    const cls = status === 'LIVE' ? 'tl-bullish' : status === 'UNAVAILABLE' ? 'tl-bearish' : 'tl-neutral';
    return `<span class="${cls}">${safe}</span>`;
  }

  async function loadWatchlist(id) {
    activeWatchlistId = id;
    document.querySelectorAll('.watchlist-link').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
    const selected = document.querySelector(`.watchlist-link[data-id="${CSS.escape(id)}"]`);
    const title = document.getElementById('activeWatchlistTitle');
    if (title && selected) title.innerHTML = `<i class="bi bi-broadcast-pin"></i> ${esc(selected.textContent.trim())}`;

    const tbody = document.getElementById('watchlistBody');
    const status = document.getElementById('watchlistStatus');
    tbody.innerHTML = '<tr><td colspan="7" class="tl-muted text-center py-5"><span class="spinner-border spinner-border-sm me-2"></span>Synchronizing market link…</td></tr>';
    if (status) status.textContent = 'SYNCING';

    try {
      const res = await fetch(`/api/watchlists/${encodeURIComponent(id)}/quotes`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      const items = data.items || [];
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="tl-muted text-center py-5">No instruments in this watchlist yet.</td></tr>';
        if (status) status.textContent = 'EMPTY';
        return;
      }

      tbody.innerHTML = items.map(({ instrument, quote }) => {
        const change = quote?.change_pct;
        const cls = Number(change) >= 0 ? 'tl-bullish' : 'tl-bearish';
        return `<tr>
          <td><a class="tl-link fw-semibold" href="/instrument/${encodeURIComponent(instrument.id)}">${esc(instrument.symbol)}</a><div class="tl-terminal-label">${esc(instrument.market_code || '')}</div></td>
          <td class="tl-mono">${fmt(quote?.price)}</td>
          <td class="${cls}">${change == null ? '—' : `${Number(change) >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`}</td>
          <td>${fmt(quote?.day_high)}</td><td>${fmt(quote?.day_low)}</td><td>${statusBadge(quote?.data_status)}</td>
          <td><button class="btn btn-sm btn-outline-danger remove-item" data-instrument="${esc(instrument.id)}" title="Remove instrument"><i class="bi bi-x-lg"></i></button></td>
        </tr>`;
      }).join('');
      if (status) status.textContent = `${items.length} INSTRUMENT${items.length === 1 ? '' : 'S'} // SYNCED`;

      document.querySelectorAll('.remove-item').forEach((btn) => btn.addEventListener('click', async () => {
        if (!activeWatchlistId) return;
        btn.disabled = true;
        try {
          await fetch(`/api/watchlists/${encodeURIComponent(activeWatchlistId)}/items/${encodeURIComponent(btn.dataset.instrument)}`, { method: 'DELETE', headers: {'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''} });
          await loadWatchlist(activeWatchlistId);
        } catch (_) { btn.disabled = false; }
      }));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="tl-error">${esc(err.message)}</div></td></tr>`;
      if (status) status.textContent = 'OFFLINE';
    }
  }

  document.querySelectorAll('.watchlist-link').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); loadWatchlist(el.dataset.id); });
  });

  document.getElementById('watchlistCount').textContent = document.querySelectorAll('.watchlist-link').length;

  document.getElementById('newWatchlistBtn')?.addEventListener('click', async () => {
    const name = prompt('Watchlist name:');
    if (!name?.trim()) return;
    const res = await fetch('/api/watchlists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (!res.ok || !data.watchlist) {
      alert(data.error || 'Could not create watchlist.');
      return;
    }
    const nav = document.getElementById('watchlistNav');
    const empty = nav.querySelector('.tl-muted');
    if (empty) empty.remove();
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'list-group-item tl-list-item watchlist-link';
    link.dataset.id = data.watchlist.id;
    link.innerHTML = `<span><i class="bi bi-chevron-right small me-1"></i>${esc(data.watchlist.name)}</span>`;
    link.addEventListener('click', (e) => { e.preventDefault(); loadWatchlist(data.watchlist.id); });
    nav.appendChild(link);
    document.getElementById('watchlistCount').textContent = document.querySelectorAll('.watchlist-link').length;
    loadWatchlist(data.watchlist.id);
  });

  const first = document.querySelector('.watchlist-link');
  if (first) loadWatchlist(first.dataset.id);
})();
