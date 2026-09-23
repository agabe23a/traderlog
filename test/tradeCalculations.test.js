const test=require('node:test');const assert=require('node:assert/strict');const {calculateTrade}=require('../services/tradeCalculations');
test('long P&L includes fees',()=>assert.equal(calculateTrade({direction:'LONG',entry_price:100,exit_price:110,position_size:2,fees:3}).pnl,17));
test('short P&L reverses direction',()=>assert.equal(calculateTrade({direction:'SHORT',entry_price:100,exit_price:90,position_size:2,fees:0}).pnl,20));
test('risk reward and duration are derived server-side',()=>{const x=calculateTrade({direction:'LONG',entry_price:100,stop_loss:95,take_profit:115,position_size:2,entry_time:'2026-01-01T00:00:00Z',exit_time:'2026-01-01T01:30:00Z'});assert.equal(x.risk_reward,3);assert.equal(x.duration_seconds,5400);});
