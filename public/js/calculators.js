(()=>{const $=id=>document.getElementById(id),n=id=>Number($(id).value);function calc(){const risk=n('balance')*n('riskPct')/100,dist=Math.abs(n('entry')-n('stop')),mult=n('mult'),size=dist&&mult?risk/(dist*mult):0;$('riskCash').textContent=risk.toFixed(2);$('distance').textContent=dist.toFixed(5);$('size').textContent=size?size.toFixed(4):'—';const rrRisk=Math.abs(n('rrEntry')-n('rrStop')),rrReward=Math.abs(n('rrTarget')-n('rrEntry')),rr=rrRisk?rrReward/rrRisk:0;$('rrValue').textContent=rr?rr.toFixed(2)+' R':'—';$('rrText').textContent=rr?'Reward is '+rr.toFixed(2)+' times the defined risk.':'Enter valid levels.';$('pnl').textContent=((n('pExit')-n('pEntry'))*n('pUnits')-n('pFees')).toFixed(2);const peak=n('peak'),cur=n('current');$('dd').textContent=peak>0?((peak-cur)/peak*100).toFixed(2)+'%':'—'}document.querySelectorAll('input').forEach(x=>x.addEventListener('input',calc));calc();

  // --- Pair-based sizing: search an instrument, pull its live quote, and
  // autofill Entry + a sensible lot/contract multiplier for Position Size.
  (function initPairPicker(){
    const searchInput = $('calcPairSearch');
    const resultsEl = $('calcPairResults');
    const statusEl = $('calcPairStatus');
    if (!searchInput || !resultsEl) return;
    let debounceTimer = null;
    const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

    function hideResults(){ resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }

    async function search(q){
      if (!q || q.trim().length < 1) { hideResults(); return; }
      try {
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(q.trim())}`, { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        const results = (data.results || []).slice(0, 8);
        if (!results.length) { hideResults(); return; }
        resultsEl.innerHTML = results.map((r) => `
          <li><button type="button" class="dropdown-item calc-pair-item" data-id="${esc(r.id)}" data-symbol="${esc(r.symbol)}" data-market="${esc(r.market_code || '')}">
            <strong>${esc(r.symbol)}</strong> <span class="tl-muted small">${esc(r.name || '')}</span>
          </button></li>`).join('');
        resultsEl.style.display = 'block';
        resultsEl.querySelectorAll('.calc-pair-item').forEach((item) => {
          item.addEventListener('click', () => selectPair(item.dataset.id, item.dataset.symbol, item.dataset.market));
        });
      } catch (_) { hideResults(); }
    }

    async function selectPair(id, symbol, marketCode){
      searchInput.value = symbol;
      hideResults();
      statusEl.textContent = `Fetching live price for ${symbol}…`;
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        const q = data.quote || {};
        if (q.data_status === 'UNAVAILABLE' || !Number.isFinite(Number(q.price))) {
          statusEl.textContent = `No live price available for ${symbol} — enter levels manually.`;
          return;
        }
        const suggestedMult = marketCode === 'FOREX' ? 100000 : 1;
        $('entry').value = Number(q.price);
        $('mult').value = suggestedMult;
        $('entry').dispatchEvent(new Event('input', { bubbles: true }));
        statusEl.textContent = marketCode === 'FOREX'
          ? `${symbol} @ ${Number(q.price).toFixed(5)} — multiplier set to 100,000 (1 standard lot). Adjust for mini/micro lots.`
          : `${symbol} @ ${Number(q.price).toFixed(5)} — multiplier set to 1 unit.`;
      } catch (_) {
        statusEl.textContent = `Could not fetch a live price for ${symbol} — enter levels manually.`;
      }
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = searchInput.value;
      debounceTimer = setTimeout(() => search(q), 250);
    });
    document.addEventListener('click', (e) => {
      if (!resultsEl.contains(e.target) && e.target !== searchInput) hideResults();
    });
  })();
})()
