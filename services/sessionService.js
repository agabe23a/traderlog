const db = require('../config/db');

/**
 * Pure UTC-clock-based session state. Session open/close times are stored
 * in market_sessions (UTC). We compute "is this session open right now"
 * in server UTC time and let the frontend render it in the user's timezone.
 */
async function getSessionStates() {
  const { rows } = await db.query(`SELECT name, open_utc, close_utc FROM market_sessions`);
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  return rows.map((s) => {
    const [oh, om] = s.open_utc.split(':').map(Number);
    const [ch, cm] = s.close_utc.split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    let isOpen;
    if (openMin < closeMin) {
      isOpen = nowMinutes >= openMin && nowMinutes < closeMin;
    } else {
      // session wraps past midnight UTC (e.g. Sydney, Tokyo)
      isOpen = nowMinutes >= openMin || nowMinutes < closeMin;
    }

    const minutesUntilClose = isOpen
      ? (closeMin > nowMinutes ? closeMin - nowMinutes : closeMin + 1440 - nowMinutes)
      : null;
    const minutesUntilOpen = !isOpen
      ? (openMin > nowMinutes ? openMin - nowMinutes : openMin + 1440 - nowMinutes)
      : null;

    return {
      name: s.name,
      open_utc: s.open_utc,
      close_utc: s.close_utc,
      is_open: isOpen,
      minutes_until_close: minutesUntilClose,
      minutes_until_open: minutesUntilOpen
    };
  });
}

function londonNewYorkOverlap(states) {
  const london = states.find((s) => s.name === 'London');
  const ny = states.find((s) => s.name === 'New York');
  return Boolean(london && ny && london.is_open && ny.is_open);
}

module.exports = { getSessionStates, londonNewYorkOverlap };
