// Deterministic teaching scenarios, not observations, fits or backtests.
export function scenario(kind='reversion'){
  return Array.from({length:360},(_,i)=>{
    const energy=15*Math.exp(0.00007*i+0.004*Math.sin(i/25));
    let spread=0.007*Math.sin(i/12)+0.002*Math.cos(i/3);
    if(kind==='reversion')spread+=0.04*Math.exp(-(((i-110)/13)**2))-0.035*Math.exp(-(((i-238)/17)**2));
    if(kind==='breakdown')spread+=i>95?(i-95)*0.0009:0;
    if(kind==='friction')spread*=0.18;
    const compute=3.05*(energy/15)*Math.exp(spread),width=kind==='friction'?0.0018:0.0006,ts=1790269200+i*60;
    return {timestamp:ts,compute_bid:compute*(1-width/2),compute_ask:compute*(1+width/2),energy_bid:energy*(1-width/2),energy_ask:energy*(1+width/2),compute_timestamp:ts,energy_timestamp:ts};
  });
}
