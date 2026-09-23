const fetch = require('node-fetch');

const BASE_URL = 'https://finnhub.io/api/v1';
const name = 'finnhub';

function apiKey() { return process.env.FINNHUB_API_KEY; }
function isConfigured() { return Boolean(apiKey()); }

async function getEconomicCalendar(from, to) {
  if (!isConfigured()) return { status: 'UNAVAILABLE', reason: 'FINNHUB_API_KEY not set' };
  const url = `${BASE_URL}/calendar/economic?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&token=${encodeURIComponent(apiKey())}`;
  const res = await fetch(url, { timeout: 12000 });
  if (!res.ok) return { status: 'UNAVAILABLE', reason: `finnhub HTTP ${res.status}` };
  const data = await res.json();
  const events = Array.isArray(data?.economicCalendar) ? data.economicCalendar : [];
  return {
    status: 'LIVE',
    provider: name,
    events: events.map(e => ({
      event: e.event || e.name || 'Economic event',
      country: e.country || null,
      currency: e.currency || null,
      date: e.time || e.date || null,
      impact: e.impact || e.importance || null,
      actual: e.actual ?? null,
      estimate: e.estimate ?? null,
      previous: e.prev ?? e.previous ?? null,
      unit: e.unit || null
    }))
  };
}

module.exports = { name, isConfigured, getEconomicCalendar };
