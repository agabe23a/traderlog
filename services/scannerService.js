const db = require('../config/db');
const candleService = require('./candleService');
const ind = require('./indicators');

function unavailable(instrument, timeframe, reason = 'Insufficient live data to compute a signal') {
  return {
    instrument_id: instrument.id,
    symbol: instrument.symbol,
    timeframe,
    data_status: 'UNAVAILABLE',
    bias: null,
    condition: null,
    momentum: null,
    volatility: null,
    score: null,
    confidence: null,
    evidence: [],
    risks: [reason],
    invalidation: null
  };
}

async function scanInstrument(instrument, timeframe = '1H') {
  const { data_status, candles = [] } = await candleService.getCandles(instrument, timeframe, 200);

  if (data_status === 'UNAVAILABLE' || candles.length < 30) {
    return unavailable(instrument, timeframe);
  }

  const closes = candles.map((c) => Number(c.close));
  const highs = candles.map((c) => Number(c.high));
  const lows = candles.map((c) => Number(c.low));
  if ([...closes, ...highs, ...lows].some((v) => !Number.isFinite(v))) {
    return unavailable(instrument, timeframe, 'Candle data contained invalid numeric values');
  }

  const lastClose = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2];
  const rsiVal = ind.rsi(closes, 14);
  const sma20 = ind.sma(closes, 20);
  const sma50 = ind.sma(closes, 50);
  const ema20 = ind.ema(closes, 20);
  const ema50 = ind.ema(closes, 50);
  const macdVal = ind.macd(closes);
  const atrVal = ind.atr(highs, lows, closes, 14);
  const bb = ind.bollingerBands(closes, 20);
  const adxVal = ind.adx(highs, lows, closes, 14);
  const sr = ind.supportResistance(highs, lows, 50);
  const crt = ind.candleRangeTheory(candles);

  // Lightweight market-structure context: compare the latest confirmed swing
  // window with its preceding window. This is descriptive context, not a
  // prediction engine.
  const structureWindow = Math.min(10, Math.floor(candles.length / 3));
  const recent = candles.slice(-structureWindow);
  const prior = candles.slice(-(structureWindow * 2), -structureWindow);
  const recentHigh = Math.max(...recent.map((c) => Number(c.high)));
  const recentLow = Math.min(...recent.map((c) => Number(c.low)));
  const priorHigh = Math.max(...prior.map((c) => Number(c.high)));
  const priorLow = Math.min(...prior.map((c) => Number(c.low)));
  let marketStructure = 'Mixed';
  if (recentHigh > priorHigh && recentLow > priorLow) marketStructure = 'Higher highs / higher lows';
  else if (recentHigh < priorHigh && recentLow < priorLow) marketStructure = 'Lower highs / lower lows';
  else if (recentHigh > priorHigh || recentLow < priorLow) marketStructure = 'Expansion / transition';

  const volumes = candles.map((c) => Number(c.volume)).filter(Number.isFinite);
  let volumeContext = null;
  if (volumes.length >= 20) {
    const avgVolume = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const lastVolume = volumes[volumes.length - 1];
    if (avgVolume > 0) {
      volumeContext = {
        last: lastVolume,
        average20: avgVolume,
        ratio: lastVolume / avgVolume
      };
    }
  }

  const evidence = [];
  const risks = [];
  let bullPoints = 0;
  let bearPoints = 0;

  if (sma20 != null && sma50 != null) {
    if (lastClose > sma20 && sma20 > sma50) {
      bullPoints += 2;
      evidence.push('Price > SMA20 > SMA50 — bullish trend structure');
    } else if (lastClose < sma20 && sma20 < sma50) {
      bearPoints += 2;
      evidence.push('Price < SMA20 < SMA50 — bearish trend structure');
    } else {
      evidence.push('Moving averages are mixed — trend alignment is incomplete');
    }
  }

  if (ema20 != null && ema50 != null) {
    if (lastClose > ema20 && ema20 > ema50) {
      bullPoints += 1;
      evidence.push('EMA20 > EMA50 — short/medium trend alignment');
    } else if (lastClose < ema20 && ema20 < ema50) {
      bearPoints += 1;
      evidence.push('EMA20 < EMA50 — short/medium trend alignment');
    }
  }

  if (marketStructure === 'Higher highs / higher lows') {
    bullPoints += 1;
    evidence.push('Market structure: higher highs / higher lows');
  } else if (marketStructure === 'Lower highs / lower lows') {
    bearPoints += 1;
    evidence.push('Market structure: lower highs / lower lows');
  } else {
    evidence.push(`Market structure: ${marketStructure.toLowerCase()}`);
  }

  if (volumeContext) {
    const ratio = volumeContext.ratio;
    if (ratio >= 1.25) evidence.push(`Volume ${ratio.toFixed(2)}× its 20-candle average — participation elevated`);
    else if (ratio <= 0.75) evidence.push(`Volume ${ratio.toFixed(2)}× its 20-candle average — participation subdued`);
    else evidence.push(`Volume ${ratio.toFixed(2)}× its 20-candle average — participation normal`);
  }

  let momentum = 'Neutral';
  if (rsiVal != null) {
    if (rsiVal >= 70) {
      bearPoints += 1;
      momentum = 'Weakening';
      evidence.push(`RSI ${rsiVal.toFixed(1)} — overbought pressure`);
    } else if (rsiVal <= 30) {
      bullPoints += 1;
      momentum = 'Weakening';
      evidence.push(`RSI ${rsiVal.toFixed(1)} — oversold pressure`);
    } else if (rsiVal > 55) {
      bullPoints += 1;
      momentum = 'Increasing';
      evidence.push(`RSI ${rsiVal.toFixed(1)} — bullish momentum`);
    } else if (rsiVal < 45) {
      bearPoints += 1;
      momentum = 'Decreasing';
      evidence.push(`RSI ${rsiVal.toFixed(1)} — bearish momentum`);
    }
  }

  if (macdVal != null) {
    if (macdVal.histogram > 0) {
      bullPoints += 1;
      evidence.push('MACD histogram positive');
    } else if (macdVal.histogram < 0) {
      bearPoints += 1;
      evidence.push('MACD histogram negative');
    }
  }

  let condition = 'Range-bound';
  if (adxVal != null) {
    if (adxVal.adx >= 25) {
      condition = adxVal.plusDI >= adxVal.minusDI ? 'Bullish trend continuation' : 'Bearish trend continuation';
      evidence.push(`ADX ${adxVal.adx.toFixed(1)} — directional market`);
    } else {
      evidence.push(`ADX ${adxVal.adx.toFixed(1)} — consolidation / non-trending`);
    }
  }

  if (bb != null) {
    if (lastClose > bb.upper) {
      bullPoints += 1;
      condition = 'Breakout candidate';
      evidence.push('Close above upper Bollinger Band');
    } else if (lastClose < bb.lower) {
      bearPoints += 1;
      condition = 'Breakout candidate';
      evidence.push('Close below lower Bollinger Band');
    }
  }

  if (sr) {
    evidence.push(`Support ${sr.support.toFixed(5)} · Resistance ${sr.resistance.toFixed(5)} — recent swing range`);
  }

  if (crt) {
    if (crt.signal === 'Bullish CRT') { bullPoints += 2; evidence.push(`CRT bullish — ${crt.reason}`); }
    else if (crt.signal === 'Bearish CRT') { bearPoints += 2; evidence.push(`CRT bearish — ${crt.reason}`); }
    else evidence.push(`CRT neutral — ${crt.reason}`);
  }

  // --- Additional strategy families: momentum, trend, volume and price action ---
  const stoch = ind.stochastic(highs, lows, closes);
  if (stoch != null) {
    if (stoch.k <= 20 && stoch.d <= 20) { bullPoints += 1; evidence.push(`Stochastic %K ${stoch.k.toFixed(1)} / %D ${stoch.d.toFixed(1)} — oversold`); }
    else if (stoch.k >= 80 && stoch.d >= 80) { bearPoints += 1; evidence.push(`Stochastic %K ${stoch.k.toFixed(1)} / %D ${stoch.d.toFixed(1)} — overbought`); }
    else if (stoch.k > stoch.d) { bullPoints += 1; evidence.push('Stochastic %K crossed above %D — bullish momentum shift'); }
    else if (stoch.k < stoch.d) { bearPoints += 1; evidence.push('Stochastic %K crossed below %D — bearish momentum shift'); }
  }

  const willR = ind.williamsR(highs, lows, closes);
  if (willR != null) {
    if (willR <= -80) { bullPoints += 1; evidence.push(`Williams %R ${willR.toFixed(1)} — oversold`); }
    else if (willR >= -20) { bearPoints += 1; evidence.push(`Williams %R ${willR.toFixed(1)} — overbought`); }
  }

  const obvSeries = ind.obv(closes, candles.map((c) => Number(c.volume)));
  if (obvSeries && obvSeries.length >= 11) {
    const obvNow = obvSeries[obvSeries.length - 1];
    const obvAvg = ind.sma(obvSeries.slice(-11, -1), 10);
    if (obvAvg != null && obvNow !== obvAvg) {
      if (obvNow > obvAvg) { bullPoints += 1; evidence.push('OBV above its 10-period average — buying volume confirms'); }
      else { bearPoints += 1; evidence.push('OBV below its 10-period average — selling volume confirms'); }
    }
  }

  const psar = ind.parabolicSar(highs, lows);
  if (psar != null) {
    if (psar.trend === 'up') { bullPoints += 1; evidence.push(`Parabolic SAR ${psar.sar.toFixed(5)} — below price, uptrend`); }
    else { bearPoints += 1; evidence.push(`Parabolic SAR ${psar.sar.toFixed(5)} — above price, downtrend`); }
  }

  const ichi = ind.ichimoku(highs, lows);
  if (ichi != null) {
    if (lastClose > ichi.cloudTop && ichi.tenkan > ichi.kijun) { bullPoints += 1; evidence.push('Price above the Ichimoku cloud with Tenkan > Kijun — bullish'); }
    else if (lastClose < ichi.cloudBottom && ichi.tenkan < ichi.kijun) { bearPoints += 1; evidence.push('Price below the Ichimoku cloud with Tenkan < Kijun — bearish'); }
    else evidence.push('Price inside the Ichimoku cloud — trend undecided');
  }

  const donchian = ind.donchianChannel(highs, lows, 20);
  if (donchian != null) {
    if (lastClose >= donchian.upper) { bullPoints += 1; evidence.push('Price at/above the 20-period Donchian high — Turtle-style breakout'); }
    else if (lastClose <= donchian.lower) { bearPoints += 1; evidence.push('Price at/below the 20-period Donchian low — Turtle-style breakdown'); }
  }

  const prevCandle = candles[candles.length - 2];
  const pivots = ind.pivotPoints(Number(prevCandle.high), Number(prevCandle.low), Number(prevCandle.close));
  if (pivots != null) {
    evidence.push(`Classic pivot ${pivots.pivot.toFixed(5)} · R1 ${pivots.r1.toFixed(5)} · S1 ${pivots.s1.toFixed(5)}`);
  }

  if (sr) {
    const fib = ind.fibonacciLevels(sr.resistance, sr.support);
    if (fib != null) {
      const fibLabels = { level_0: '0%', level_236: '23.6%', level_382: '38.2%', level_50: '50%', level_618: '61.8%', level_786: '78.6%', level_100: '100%' };
      const tolerance = (sr.resistance - sr.support) * 0.01;
      const nearLevel = Object.entries(fib).find(([, lvl]) => Math.abs(lastClose - lvl) <= tolerance);
      if (nearLevel) evidence.push(`Price sitting at the ${fibLabels[nearLevel[0]] || nearLevel[0]} Fibonacci retracement — key confluence zone`);
    }
  }

  const vwapVal = ind.vwap(candles.slice(-50));
  if (vwapVal != null) {
    if (lastClose > vwapVal) { bullPoints += 1; evidence.push(`Price above VWAP ${vwapVal.toFixed(5)} — buyers in control`); }
    else if (lastClose < vwapVal) { bearPoints += 1; evidence.push(`Price below VWAP ${vwapVal.toFixed(5)} — sellers in control`); }
  }

  const pattern = ind.candlestickPattern(candles);
  if (pattern != null) {
    if (pattern.bias === 'Bullish') { bullPoints += 1; evidence.push(`Candlestick pattern: ${pattern.pattern}`); }
    else if (pattern.bias === 'Bearish') { bearPoints += 1; evidence.push(`Candlestick pattern: ${pattern.pattern}`); }
    else evidence.push(`Candlestick pattern: ${pattern.pattern}`);
  }

  if (previousClose !== 0 && Number.isFinite(previousClose)) {
    const impulsePct = ((lastClose - previousClose) / previousClose) * 100;
    if (Math.abs(impulsePct) >= 1) {
      evidence.push(`Latest candle impulse ${impulsePct > 0 ? '+' : ''}${impulsePct.toFixed(2)}%`);
    }
  }

  let volatility = 'NORMAL';
  let atrPct = null;
  if (atrVal != null && lastClose) {
    atrPct = (atrVal / lastClose) * 100;
    if (atrPct > 3) volatility = 'EXTREME';
    else if (atrPct > 1.5) volatility = 'ELEVATED';
    else if (atrPct < 0.3) volatility = 'LOW';
  }

  const bias = bullPoints > bearPoints ? 'Bullish' : bearPoints > bullPoints ? 'Bearish' : 'Neutral';
  const action = bias === 'Bullish' ? 'BUY' : bias === 'Bearish' ? 'SELL' : 'WAIT';
  const totalSignals = bullPoints + bearPoints;
  const score = totalSignals === 0
    ? 50
    : Math.max(0, Math.min(100, Math.round(50 + ((bullPoints - bearPoints) / (totalSignals + 1)) * 50)));

  let confidence = 'Low';
  if (totalSignals >= 10 && Math.abs(bullPoints - bearPoints) >= 4) confidence = 'High';
  else if (totalSignals >= 5) confidence = 'Medium';

  const invalidation = bias === 'Bullish'
    ? Math.min(...lows.slice(-10))
    : bias === 'Bearish'
      ? Math.max(...highs.slice(-10))
      : null;

  if (sr && bias === 'Bullish' && lastClose >= sr.resistance) evidence.push('BUY context: price is testing/above recent resistance — wait for a clean breakout/retest confirmation.');
  if (sr && bias === 'Bearish' && lastClose <= sr.support) evidence.push('SELL context: price is testing/below recent support — wait for a clean breakdown/retest confirmation.');

  const entry = lastClose;
  const riskDistance = invalidation != null ? Math.abs(entry - invalidation) : null;
  const target1 = bias === 'Bullish' && sr ? sr.resistance : bias === 'Bearish' && sr ? sr.support : null;

  if (invalidation != null && Number.isFinite(invalidation)) {
    risks.push(`A close beyond ${invalidation.toFixed(5)} would invalidate the ${bias.toLowerCase()} bias`);
  }
  if (volatility === 'EXTREME') risks.push('Extreme volatility detected — reduce exposure and verify execution conditions');
  risks.push('Scanner output is analytical, not a guaranteed trade signal. Confirm price action and risk before trading.');

  const result = {
    instrument_id: instrument.id,
    symbol: instrument.symbol,
    timeframe,
    data_status,
    bias,
    action,
    condition,
    momentum,
    volatility,
    score,
    confidence,
    evidence,
    risks,
    invalidation,
    support_resistance: sr,
    crt,
    trade_plan: { action, entry, stop: invalidation, target1, risk_distance: riskDistance },
    metrics: {
      rsi: rsiVal,
      sma20,
      sma50,
      ema20,
      ema50,
      market_structure: marketStructure,
      volume: volumeContext,
      atr: atrVal,
      atr_pct: atrPct,
      adx: adxVal ? adxVal.adx : null,
      plus_di: adxVal ? adxVal.plusDI : null,
      minus_di: adxVal ? adxVal.minusDI : null,
      macd_histogram: macdVal ? macdVal.histogram : null,
      stochastic_k: stoch ? stoch.k : null,
      stochastic_d: stoch ? stoch.d : null,
      williams_r: willR,
      parabolic_sar: psar ? psar.sar : null,
      parabolic_sar_trend: psar ? psar.trend : null,
      ichimoku: ichi,
      donchian: donchian,
      pivots,
      vwap: vwapVal,
      candlestick_pattern: pattern ? pattern.pattern : null,
      last_close: lastClose,
      candle_count: candles.length
    },
    scanned_at: new Date().toISOString()
  };

  try {
    await persist(result);
  } catch (err) {
    // A database history failure must not turn a valid live scan into fake data.
    console.error(`[scanner] persistence failed for ${instrument.symbol}:`, err.message);
  }
  return result;
}

async function persist(r) {
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO scanner_results
        (instrument_id, timeframe, bias, condition, momentum, volatility, score, confidence, evidence, risks, invalidation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.instrument_id, r.timeframe, r.bias, r.condition, r.momentum, r.volatility,
        r.score, r.confidence, JSON.stringify(r.evidence), JSON.stringify(r.risks), r.invalidation
      ]
    );
  } finally {
    client.release();
  }
}

async function scanUniverse(instruments, timeframe = '1H', minScore = 0) {
  const results = [];
  const concurrency = Math.max(1, Math.min(5, Number(process.env.SCANNER_CONCURRENCY || 5)));
  const threshold = Number.isFinite(Number(minScore)) ? Number(minScore) : 0;

  for (let i = 0; i < instruments.length; i += concurrency) {
    const batch = instruments.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((inst) => scanInstrument(inst, timeframe)));
    results.push(...batchResults);
  }

  return results
    .filter((r) => r.data_status !== 'UNAVAILABLE' && r.score != null && r.score >= threshold)
    .sort((a, b) => Number(b.score) - Number(a.score));
}

module.exports = { scanInstrument, scanUniverse };
