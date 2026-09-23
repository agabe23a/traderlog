/**
 * Pure technical-indicator functions.
 * No I/O. Every function returns null when there is insufficient data.
 */

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let emaVal = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i += 1) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  if (!Array.isArray(values) || values.length < slow + signalPeriod) return null;
  const macdLine = [];
  for (let i = slow; i <= values.length; i += 1) {
    const slice = values.slice(0, i);
    const f = ema(slice, fast);
    const s = ema(slice, slow);
    if (f != null && s != null) macdLine.push(f - s);
  }
  if (macdLine.length < signalPeriod) return null;
  const signal = ema(macdLine, signalPeriod);
  const macdValue = macdLine[macdLine.length - 1];
  return { macd: macdValue, signal, histogram: macdValue - signal };
}

function trueRanges(highs, lows, closes) {
  const ranges = [];
  for (let i = 1; i < closes.length; i += 1) {
    ranges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return ranges;
}

function atr(highs, lows, closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  return sma(trueRanges(highs, lows, closes), period);
}

function bollingerBands(values, period = 20, stdDevMultiplier = 2) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    middle: mean,
    upper: mean + stdDevMultiplier * stdDev,
    lower: mean - stdDevMultiplier * stdDev
  };
}

function adx(highs, lows, closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period * 2) return null;
  const plusDM = [];
  const minusDM = [];
  const trs = [];

  for (let i = 1; i < closes.length; i += 1) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  const atrVal = sma(trs, period);
  if (!atrVal || !Number.isFinite(atrVal)) return null;

  const plusAvg = sma(plusDM, period);
  const minusAvg = sma(minusDM, period);
  const plusDI = 100 * (plusAvg / atrVal);
  const minusDI = 100 * (minusAvg / atrVal);
  const denominator = plusDI + minusDI;
  const dx = denominator === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / denominator;

  return { adx: dx, plusDI, minusDI };
}


function supportResistance(highs, lows, lookback = 50) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || highs.length < 5 || lows.length < 5) return null;
  const start = Math.max(0, highs.length - lookback);
  const h = highs.slice(start).filter(Number.isFinite);
  const l = lows.slice(start).filter(Number.isFinite);
  if (!h.length || !l.length) return null;
  const swingHighs = [];
  const swingLows = [];
  for (let i = 1; i < h.length - 1; i += 1) {
    if (h[i] >= h[i - 1] && h[i] >= h[i + 1]) swingHighs.push(h[i]);
    if (l[i] <= l[i - 1] && l[i] <= l[i + 1]) swingLows.push(l[i]);
  }
  return {
    resistance: swingHighs.length ? Math.max(...swingHighs.slice(-8)) : Math.max(...h),
    support: swingLows.length ? Math.min(...swingLows.slice(-8)) : Math.min(...l)
  };
}

function candleRangeTheory(candles) {
  if (!Array.isArray(candles) || candles.length < 3) return null;
  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const prevHigh = Number(prev.high), prevLow = Number(prev.low), lastHigh = Number(last.high), lastLow = Number(last.low), lastClose = Number(last.close);
  if (![prevHigh, prevLow, lastHigh, lastLow, lastClose].every(Number.isFinite)) return null;
  const bullish = lastLow < prevLow && lastClose > prevLow;
  const bearish = lastHigh > prevHigh && lastClose < prevHigh;
  if (bullish) return { signal: 'Bullish CRT', reason: 'Latest candle swept the prior range low and reclaimed the range.' };
  if (bearish) return { signal: 'Bearish CRT', reason: 'Latest candle swept the prior range high and rejected back inside the range.' };
  return { signal: 'Neutral', reason: 'No clear prior-range sweep and reclaim/rejection.' };
}

// Slow stochastic oscillator: %K smoothed, then %D = SMA(%K).
function stochastic(highs, lows, closes, period = 14, smoothK = 3, smoothD = 3) {
  if (!Array.isArray(closes) || closes.length < period + smoothK + smoothD) return null;
  const rawK = [];
  for (let i = period - 1; i < closes.length; i += 1) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    rawK.push(hh === ll ? 50 : 100 * (closes[i] - ll) / (hh - ll));
  }
  const smoothedK = [];
  for (let i = smoothK - 1; i < rawK.length; i += 1) {
    smoothedK.push(sma(rawK.slice(i - smoothK + 1, i + 1), smoothK));
  }
  if (smoothedK.length < smoothD) return null;
  return { k: smoothedK[smoothedK.length - 1], d: sma(smoothedK.slice(-smoothD), smoothD) };
}

// Williams %R: momentum oscillator, -100 (oversold) to 0 (overbought).
function williamsR(highs, lows, closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return null;
  return -100 * (hh - closes[closes.length - 1]) / (hh - ll);
}

// On-Balance Volume: cumulative volume signed by close-to-close direction.
// Missing/invalid volume ticks are treated as zero rather than breaking the series.
function obv(closes, volumes) {
  if (!Array.isArray(closes) || !Array.isArray(volumes) || closes.length !== volumes.length || closes.length < 2) return null;
  const series = [0];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = series[series.length - 1];
    const vol = Number.isFinite(volumes[i]) ? volumes[i] : 0;
    if (closes[i] > closes[i - 1]) series.push(prev + vol);
    else if (closes[i] < closes[i - 1]) series.push(prev - vol);
    else series.push(prev);
  }
  return series;
}

// Wilder's Parabolic SAR (stop-and-reverse trend follower).
function parabolicSar(highs, lows, step = 0.02, maxStep = 0.2) {
  if (!Array.isArray(highs) || highs.length < 5) return null;
  let isUpTrend = highs[1] >= highs[0];
  let sarVal = isUpTrend ? Math.min(lows[0], lows[1]) : Math.max(highs[0], highs[1]);
  let ep = isUpTrend ? Math.max(highs[0], highs[1]) : Math.min(lows[0], lows[1]);
  let af = step;
  for (let i = 2; i < highs.length; i += 1) {
    const prevSar = sarVal;
    sarVal = prevSar + af * (ep - prevSar);
    if (isUpTrend) {
      sarVal = Math.min(sarVal, lows[i - 1], lows[i - 2]);
      if (lows[i] < sarVal) { isUpTrend = false; sarVal = ep; ep = lows[i]; af = step; }
      else if (highs[i] > ep) { ep = highs[i]; af = Math.min(maxStep, af + step); }
    } else {
      sarVal = Math.max(sarVal, highs[i - 1], highs[i - 2]);
      if (highs[i] > sarVal) { isUpTrend = true; sarVal = ep; ep = highs[i]; af = step; }
      else if (lows[i] < ep) { ep = lows[i]; af = Math.min(maxStep, af + step); }
    }
  }
  return { sar: sarVal, trend: isUpTrend ? 'up' : 'down' };
}

// Ichimoku Kinko Hyo, read on the current (unshifted) bar rather than the
// forward-projected cloud a chart plots — a live "where do we stand now" read.
function ichimoku(highs, lows, conversionPeriod = 9, basePeriod = 26, spanBPeriod = 52) {
  if (!Array.isArray(highs) || highs.length < spanBPeriod) return null;
  const mid = (period) => (Math.max(...highs.slice(-period)) + Math.min(...lows.slice(-period))) / 2;
  const tenkan = mid(conversionPeriod);
  const kijun = mid(basePeriod);
  const spanA = (tenkan + kijun) / 2;
  const spanB = mid(spanBPeriod);
  return { tenkan, kijun, spanA, spanB, cloudTop: Math.max(spanA, spanB), cloudBottom: Math.min(spanA, spanB) };
}

// Donchian channel — classic Turtle-trading breakout channel.
function donchianChannel(highs, lows, period = 20) {
  if (!Array.isArray(highs) || highs.length < period) return null;
  const upper = Math.max(...highs.slice(-period));
  const lower = Math.min(...lows.slice(-period));
  return { upper, lower, middle: (upper + lower) / 2 };
}

// Classic (floor trader) pivot points from the prior period's H/L/C.
function pivotPoints(prevHigh, prevLow, prevClose) {
  if (![prevHigh, prevLow, prevClose].every(Number.isFinite)) return null;
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  return {
    pivot,
    r1: 2 * pivot - prevLow,
    s1: 2 * pivot - prevHigh,
    r2: pivot + (prevHigh - prevLow),
    s2: pivot - (prevHigh - prevLow)
  };
}

// Fibonacci retracement levels across a swing high/low.
function fibonacciLevels(swingHigh, swingLow) {
  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow) || swingHigh <= swingLow) return null;
  const range = swingHigh - swingLow;
  return {
    level_0: swingHigh,
    level_236: swingHigh - range * 0.236,
    level_382: swingHigh - range * 0.382,
    level_50: swingHigh - range * 0.5,
    level_618: swingHigh - range * 0.618,
    level_786: swingHigh - range * 0.786,
    level_100: swingLow
  };
}

// Volume-weighted average price over the supplied candle window.
function vwap(candles) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typical = (Number(c.high) + Number(c.low) + Number(c.close)) / 3;
    const vol = Number(c.volume);
    if (!Number.isFinite(typical) || !Number.isFinite(vol) || vol <= 0) continue;
    cumPV += typical * vol;
    cumVol += vol;
  }
  return cumVol > 0 ? cumPV / cumVol : null;
}

// Rule-based candlestick pattern read on the latest 1-2 candles: engulfing,
// hammer/pin bar, shooting star, doji.
function candlestickPattern(candles) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const po = Number(prev.open), pc = Number(prev.close);
  const lo = Number(last.open), lc = Number(last.close), lh = Number(last.high), ll = Number(last.low);
  if (![po, pc, lo, lc, lh, ll].every(Number.isFinite)) return null;
  const body = Math.abs(lc - lo);
  const range = lh - ll;
  if (range <= 0) return null;
  if (pc < po && lc > lo && lc >= po && lo <= pc) return { pattern: 'Bullish engulfing', bias: 'Bullish' };
  if (pc > po && lc < lo && lc <= po && lo >= pc) return { pattern: 'Bearish engulfing', bias: 'Bearish' };
  const upperWick = lh - Math.max(lo, lc);
  const lowerWick = Math.min(lo, lc) - ll;
  if (lowerWick >= body * 2 && upperWick <= body * 0.5 && body / range <= 0.4) return { pattern: 'Hammer / bullish pin bar', bias: 'Bullish' };
  if (upperWick >= body * 2 && lowerWick <= body * 0.5 && body / range <= 0.4) return { pattern: 'Shooting star / bearish pin bar', bias: 'Bearish' };
  if (body / range <= 0.1) return { pattern: 'Doji — indecision', bias: null };
  return null;
}

module.exports = {
  sma, ema, rsi, macd, atr, bollingerBands, adx, supportResistance, candleRangeTheory,
  stochastic, williamsR, obv, parabolicSar, ichimoku, donchianChannel, pivotPoints, fibonacciLevels, vwap, candlestickPattern
};
