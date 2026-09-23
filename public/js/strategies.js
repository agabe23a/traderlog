(()=>{const data=[
['Trend Following','Market structure, moving-average alignment, pullbacks, ADX confirmation.','Trend','Works best in sustained directional conditions; whipsaw risk in ranges.'],
['Breakout','Range compression → breakout → optional retest; volume/volatility confirmation.','Momentum','False-breakout risk; define invalidation around the failed level.'],
['Mean Reversion','Fade statistically stretched moves back toward a mean/VWAP/value area.','Reversion','Can fail badly during strong trends; regime filter matters.'],
['Price Action','Support/resistance, swing structure, rejection candles, engulfing patterns.','Discretionary','Requires consistent definitions and sample-based review.'],
['Liquidity Sweep','Identify a stop run beyond a prior high/low, then require confirmation.','Liquidity','Avoid assuming every wick is manipulation; use objective rules.'],
['ICT / SMC Concepts','Market structure shifts, imbalance/FVG, order blocks, liquidity concepts.','Price Action','Terminology varies; convert concepts into testable rules.'],
['CRT / Candle Range Theory','Use a defined reference candle/range, sweep and confirmation framework.','Price Action','Specify exact candle/timeframe rules before testing.'],
['Opening Range','Trade expansion from a defined session opening range with risk rules.','Session','Session timing and market hours must be standardized.'],
['VWAP','Trade relationship to VWAP and deviations with trend/context filters.','Intraday','More relevant for instruments/session structures where VWAP is meaningful.'],
['RSI / Momentum','Use RSI regimes, divergence or threshold rules with price context.','Indicator','Oscillators can remain extreme in trends.'],
['MACD / Trend Momentum','Signal-line/cross, histogram and zero-line rules with trend filter.','Indicator','Lagging by construction; test entry timing carefully.'],
['Fibonacci Retracement','Predefine swing anchors and retracement/extension levels.','Technical','Anchor selection can introduce subjectivity.'],
['Pairs / Relative Value','Trade relative performance between correlated instruments.','Quantitative','Correlation can break; monitor regime and costs.'],
['Carry / Macro','Use rate differentials, macro data and positioning to express longer-horizon views.','Fundamental','Event and gap risk can be material.'],
['Systematic Quant','Rule-based signals, position sizing and portfolio constraints executed consistently.','Systematic','Requires clean data, validation and robust out-of-sample testing.']
];const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));document.getElementById('strategyGrid').innerHTML=data.map(x=>`<div class="col-md-6 col-xl-4"><article class="tl-strategy-card h-100"><span class="tl-badge-gold">${esc(x[2])}</span><h5>${esc(x[0])}</h5><p>${esc(x[1])}</p><small class="tl-muted"><strong>Watch:</strong> ${esc(x[3])}</small></article></div>`).join('')})();