(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  async function api(u, o = {}) {
    o.headers = { ...(o.headers || {}), 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() };
    const r = await fetch(u, o);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  }

  async function instruments() {
    const d = await api('/api/instruments?limit=500');
    $('#pInstrument').innerHTML = d.instruments.map((i) => `<option value="${esc(i.id)}">${esc(i.symbol)} — ${esc(i.name || '')}</option>`).join('');
  }

  function money(v) { return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  let positionsById = new Map();

  async function load() {
    try {
      const d = (await api('/api/portfolio/summary')).data;
      positionsById = new Map(d.positions.map((p) => [String(p.id), p]));

      $('#portfolioMetrics').innerHTML = [
        ['Capital', money(d.capital)],
        ['Unrealized P&L', money(d.unrealized_pnl)],
        ['Estimated Equity', money(d.estimated_equity)],
        ['Open Positions', d.positions.length]
      ].map((x) => `<div class="col-6 col-lg-3"><div class="tl-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div></div>`).join('');

      $('#accounts').innerHTML = d.accounts.map((a) => `
        <div class="tl-list-item p-3 rounded mb-2">
          <div class="d-flex justify-content-between"><strong>${esc(a.name)}</strong><span class="tl-badge-gold px-2 rounded-pill">${esc(a.account_type)}</span></div>
          <div class="small tl-muted">${esc(a.broker || 'No broker')} · ${esc(a.currency)} · ${money(a.initial_balance)}</div>
        </div>`).join('') || '<div class="tl-muted">Create your first account.</div>';

      $('#positions').innerHTML = d.positions.map((p) => `
        <tr>
          <td><strong>${esc(p.symbol || '—')}</strong><div class="small tl-muted">${esc(p.account_name || '')}</div></td>
          <td class="${p.direction === 'LONG' ? 'tl-bullish' : 'tl-bearish'}">${esc(p.direction)}</td>
          <td>${esc(p.quantity)}</td>
          <td>${esc(p.entry_price)}</td>
          <td>${p.current_price == null ? '—' : esc(p.current_price)}</td>
          <td class="${Number(p.unrealized_pnl) > 0 ? 'tl-bullish' : Number(p.unrealized_pnl) < 0 ? 'tl-bearish' : ''}">${p.unrealized_pnl == null ? '—' : money(p.unrealized_pnl)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-light edit-pos" data-id="${p.id}" title="Update price / stop / target"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger del-pos" data-id="${p.id}" title="Remove position"><i class="bi bi-x"></i></button>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-center tl-muted py-5">No open positions.</td></tr>';
    } catch (e) {
      $('#portfolioMetrics').innerHTML = '<div class="col-12"><div class="alert alert-danger">' + esc(e.message) + '</div></div>';
    }
  }

  $('#accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target));
    try {
      await api('/api/portfolio/accounts', { method: 'POST', body: JSON.stringify(o) });
      bootstrap.Modal.getInstance($('#accountModal')).hide();
      e.target.reset();
      load();
    } catch (x) { alert(x.message); }
  });

  $('#positionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target));
    o.instrument_id = $('#pInstrument').value;
    try {
      await api('/api/portfolio/positions', { method: 'POST', body: JSON.stringify(o) });
      bootstrap.Modal.getInstance($('#positionModal')).hide();
      e.target.reset();
      load();
    } catch (x) { alert(x.message); }
  });

  // Mark-to-market editing. The backend endpoint has always supported this
  // (PATCH /api/portfolio/positions/:id) but nothing in the UI ever called
  // it, so unrealized P&L was frozen at whatever price was entered when the
  // position was created. This modal — plus the "Refresh live prices"
  // button below — closes that gap.
  const editModalEl = $('#editPositionModal');
  const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;
  const editForm = $('#editPositionForm');

  function openEditModal(id) {
    const p = positionsById.get(String(id));
    if (!p || !editForm) return;
    editForm.dataset.id = id;
    $('#editPositionSymbol').textContent = `${p.symbol || 'Position'} · ${p.direction} ${p.quantity} @ ${p.entry_price}`;
    editForm.elements.current_price.value = p.current_price ?? '';
    editForm.elements.stop_loss.value = p.stop_loss ?? '';
    editForm.elements.take_profit.value = p.take_profit ?? '';
    editForm.elements.notes.value = p.notes ?? '';
    editModal?.show();
  }

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editForm.dataset.id;
    const o = Object.fromEntries(new FormData(editForm));
    try {
      await api('/api/portfolio/positions/' + id, { method: 'PATCH', body: JSON.stringify(o) });
      editModal?.hide();
      load();
    } catch (x) { alert(x.message); }
  });

  const refreshBtn = $('#refreshPricesBtn');
  refreshBtn?.addEventListener('click', async () => {
    const ids = [...positionsById.values()];
    if (!ids.length) return;
    refreshBtn.disabled = true;
    const original = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Refreshing…';
    try {
      const results = await Promise.allSettled(ids.map(async (p) => {
        const q = await api('/api/quotes/' + encodeURIComponent(p.instrument_id));
        const price = q.quote?.price;
        if (q.quote?.data_status === 'UNAVAILABLE' || price == null || !Number.isFinite(Number(price))) return;
        await api('/api/portfolio/positions/' + p.id, { method: 'PATCH', body: JSON.stringify({ current_price: price }) });
      }));
      const failed = results.filter((r) => r.status === 'rejected').length;
      await load();
      if (failed) alert(`${failed} of ${ids.length} position(s) could not be repriced (no live quote available).`);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = original;
    }
  });

  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-pos');
    if (editBtn) { openEditModal(editBtn.dataset.id); return; }
    const delBtn = e.target.closest('.del-pos');
    if (delBtn && confirm('Remove this position?')) {
      try {
        await api('/api/portfolio/positions/' + delBtn.dataset.id, { method: 'DELETE' });
        load();
      } catch (x) { alert(x.message); }
    }
  });

  instruments().then(load).catch((e) => alert(e.message));
})();
