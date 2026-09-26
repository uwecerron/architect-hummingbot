// Node + browser port of scripts/energy_compute_core.py. Never submits orders.
export const DEFAULTS = Object.freeze({lookback:60,entry_z:2,exit_z:0.5,stop_z:4,beta:1,leg_usd:10000,compute_multiplier:730,energy_multiplier:1,fee_bps:5,slippage_bps:3,max_spread_bps:50,max_age_seconds:120,max_gap_seconds:180,max_hold_seconds:86400,max_loss_usd:500,cooldown_seconds:300});
export const COLUMNS=['timestamp','compute_bid','compute_ask','energy_bid','energy_ask','compute_timestamp','energy_timestamp'];
export function validateConfig(c){
  for(const [k,v] of Object.entries(c)) if(!Number.isFinite(v)||v<0) throw Error(`Invalid ${k}`);
  if(!Number.isInteger(c.lookback)||c.lookback<3||c.lookback>10000) throw Error('Lookback must be an integer from 3 to 10000');
  if(!(c.exit_z<c.entry_z&&c.entry_z<c.stop_z)) throw Error('Require exit < entry < stop');
  for(const k of ['beta','leg_usd','compute_multiplier','energy_multiplier']) if(c[k]<=0) throw Error(`${k} must be positive`);
}
export function validateQuote(q,c=DEFAULTS){
  if(COLUMNS.some(k=>!Number.isFinite(q[k]))) throw Error('Missing or non-finite quote');
  for(const leg of ['compute','energy']){
    const bid=q[`${leg}_bid`],ask=q[`${leg}_ask`],age=q.timestamp-q[`${leg}_timestamp`];
    if(!(bid>0&&bid<=ask)) throw Error('Invalid/crossed book');
    if(age<0||age>c.max_age_seconds) throw Error('Stale/future quote');
    if(10000*(ask-bid)/((ask+bid)/2)>c.max_spread_bps) throw Error('Spread too wide');
  }
}
export class PairEngine {
  constructor(config={}){this.cfg={...DEFAULTS,...config};validateConfig(this.cfg);this.history=[];this.position=null;this.realized=0;this.last_timestamp=null;this.cooldown_until=0;this.halted=false;}
  fill(q,leg,quantity){return q[`${leg}_${quantity>0?'ask':'bid'}`]*(1+Math.sign(quantity)*this.cfg.slippage_bps/10000);}
  fee(qc,qe,pc,pe){return (Math.abs(qc)*this.cfg.compute_multiplier*pc+Math.abs(qe)*this.cfg.energy_multiplier*pe)*this.cfg.fee_bps/10000;}
  liquidation(q){if(!this.position)return 0;const p=this.position,pc=this.fill(q,'compute',-p.qc),pe=this.fill(q,'energy',-p.qe);return p.qc*this.cfg.compute_multiplier*(pc-p.pc)+p.qe*this.cfg.energy_multiplier*(pe-p.pe)-p.entry_fee-this.fee(p.qc,p.qe,pc,pe);}
  step(q){
    const cfg=this.cfg;validateQuote(q,cfg);
    if(this.last_timestamp!==null&&q.timestamp<=this.last_timestamp)throw Error('Timestamps must increase strictly');
    const gap=this.last_timestamp!==null&&q.timestamp-this.last_timestamp>cfg.max_gap_seconds;
    this.last_timestamp=q.timestamp;
    if(gap){this.history=[];if(this.position)this.halted=true;}
    const c=(q.compute_bid+q.compute_ask)/2,e=(q.energy_bid+q.energy_ask)/2,residual=Math.log(c)-cfg.beta*Math.log(e);
    let z=null;
    if(this.history.length===cfg.lookback){const mean=this.history.reduce((a,b)=>a+b,0)/cfg.lookback;const std=Math.sqrt(this.history.reduce((a,b)=>a+(b-mean)**2,0)/cfg.lookback);if(std>1e-9)z=(residual-mean)/std;}
    this.history.push(residual);if(this.history.length>cfg.lookback)this.history.shift();
    let action=this.halted?'HALTED':z===null?'WARMUP':'HOLD';const pnl=this.liquidation(q);
    if(this.position&&!this.halted){
      const p=this.position;
      const reason=this.realized+pnl<=-cfg.max_loss_usd?'LOSS_LIMIT':q.timestamp-p.opened>=cfg.max_hold_seconds?'TIME_LIMIT':z!==null&&Math.abs(z)>=cfg.stop_z?'STOP_Z':z!==null&&(Math.abs(z)<=cfg.exit_z||z*p.entry_z<=0)?'MEAN_REVERSION':null;
      if(reason){this.realized+=pnl;this.position=null;this.cooldown_until=q.timestamp+cfg.cooldown_seconds;this.halted=reason==='LOSS_LIMIT';action='CLOSE_'+reason;}
    }else if(!this.halted&&z!==null&&q.timestamp>=this.cooldown_until&&cfg.entry_z<=Math.abs(z)&&Math.abs(z)<cfg.stop_z){
      const sign=z>0?-1:1,qc=sign*Math.floor(cfg.leg_usd/(c*cfg.compute_multiplier));
      const qe=-sign*Math.floor(Math.abs(qc)*c*cfg.compute_multiplier*cfg.beta/(e*cfg.energy_multiplier));
      if(qc&&qe){const pc=this.fill(q,'compute',qc),pe=this.fill(q,'energy',qe);this.position={qc,qe,pc,pe,opened:q.timestamp,entry_z:z,entry_fee:this.fee(qc,qe,pc,pe)};action=sign<0?'OPEN_SHORT_COMPUTE':'OPEN_LONG_COMPUTE';}else action='SKIP_MIN_CONTRACT';
    }
    return {timestamp:q.timestamp,z,action,realized_pnl:this.realized,open_liquidation_pnl:this.liquidation(q),compute_contracts:this.position?.qc||0,energy_contracts:this.position?.qe||0};
  }
}
export function parseCSV(text){
  if(text.length>8_000_000)throw Error('CSV exceeds 8 MB');
  const lines=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/),head=lines.shift().split(',').map(s=>s.trim());
  if(new Set(head).size!==head.length||COLUMNS.some(k=>!head.includes(k)))throw Error(`Required columns: ${COLUMNS.join(', ')}`);
  if(lines.length<4||lines.length>30000)throw Error('Use 4 to 30,000 observations');
  return lines.map((line,i)=>{const values=line.split(',');if(values.length!==head.length)throw Error(`Malformed row ${i+2}`);const q={};for(const k of COLUMNS){const s=values[head.indexOf(k)].trim();q[k]=s===''?NaN:Number(s);}if(COLUMNS.some(k=>!Number.isFinite(q[k])))throw Error(`Invalid numeric row ${i+2}`);return q;});
}
export function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>r[k]??'').join(',')).join('\n')+'\n';}
export function replay(quotes,config={}){
  const engine=new PairEngine(config),rows=[];let peak=0,drawdown=0;
  for(const [i,q] of quotes.entries()){let r;try{r=engine.step(q);}catch(e){throw Error(`Row ${i+2}: ${e.message}`);}r.equity=r.realized_pnl+r.open_liquidation_pnl;peak=Math.max(peak,r.equity);drawdown=Math.max(drawdown,peak-r.equity);rows.push(r);}
  return {rows,drawdown,closed:rows.filter(r=>r.action.startsWith('CLOSE_')).length,open:!!engine.position,halted:engine.halted};
}
export function ticket(q,config={}){
  const c={...DEFAULTS,...config};validateConfig(c);validateQuote(q,c);
  const pc=(q.compute_bid+q.compute_ask)/2,pe=(q.energy_bid+q.energy_ask)/2;
  const qc=Math.floor(c.leg_usd/(pc*c.compute_multiplier)),nc=qc*pc*c.compute_multiplier,qe=Math.floor(nc*c.beta/(pe*c.energy_multiplier)),ne=qe*pe*c.energy_multiplier;
  const cost=qc*c.compute_multiplier*(q.compute_ask-q.compute_bid)+qe*c.energy_multiplier*(q.energy_ask-q.energy_bid)+2*(nc+ne)*(c.fee_bps+c.slippage_bps)/10000;
  return {qc,qe,nc,ne,cost,breakEven:nc>0?cost/nc*10000:null,mismatch:nc*c.beta-ne};
}
