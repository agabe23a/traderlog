function calculateTrade(d){
 const result={...d};
 if(d.entry_price!=null&&d.exit_price!=null&&d.position_size!=null){const sign=d.direction==='SHORT'?-1:1;result.pnl=(d.exit_price-d.entry_price)*d.position_size*sign-(d.fees||0);result.pnl_pct=(result.pnl/(Math.abs(d.entry_price*d.position_size)||1))*100;}else{result.pnl=null;result.pnl_pct=null;}
 if(d.entry_price!=null&&d.stop_loss!=null&&d.take_profit!=null){const risk=Math.abs(d.entry_price-d.stop_loss)*d.position_size;const reward=Math.abs(d.take_profit-d.entry_price)*d.position_size;result.risk_reward=risk>0?reward/risk:null;}else result.risk_reward=null;
 if(d.entry_time&&d.exit_time)result.duration_seconds=Math.max(0,Math.round((new Date(d.exit_time)-new Date(d.entry_time))/1000));else result.duration_seconds=null;
 return result;
}
module.exports={calculateTrade};
