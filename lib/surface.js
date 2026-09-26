import {getLighter} from './lighter.js';
export function sweep(levels,notional){
 if(!(notional>0))throw Error('Positive notional required');let remaining=notional,base=0;
 for(const [p,q] of levels){const spend=Math.min(remaining,p*q);base+=spend/p;remaining-=spend;if(remaining<1e-7)break;}
 return remaining>1e-7?null:notional/base;
}
export function surfaceRow(payload,symbol,now=Date.now()){
 const d=payload?.data;if(payload?.code!=='00000'||!Array.isArray(d?.bids)||!Array.isArray(d?.asks))throw Error('Invalid book');
 const timestamp=Number(d.ts);if(!Number.isFinite(timestamp)||now-timestamp>120000||timestamp-now>60000)throw Error('Stale book');
 const side=(a,dir)=>a.map(r=>r.map(Number)).filter(([p,q])=>Number.isFinite(p)&&Number.isFinite(q)&&p>0&&q>0).sort((a,b)=>dir*(a[0]-b[0]));
 const bids=side(d.bids,-1),asks=side(d.asks,1);if(!bids.length||!asks.length||bids[0][0]>=asks[0][0])throw Error('Invalid quotes');
 const mid=(bids[0][0]+asks[0][0])/2,notionals=[100,1000,5000,10000,25000,100000,500000];
 return {symbol,timestamp:new Date(timestamp).toISOString(),mid,rows:[['Buy',asks],['Sell',bids]].map(([direction,levels])=>({direction,cells:notionals.map(notional=>{const vwap=sweep(levels,notional);return {notional,vwap,impactBps:vwap===null?null:(direction==='Buy'?vwap/mid-1:1-vwap/mid)*10000};})}))};
}
export async function getSurface(){const markets=await Promise.all(['H100USDT','B200USDT'].map(async symbol=>{
 const source='https://api.bitget.com/api/v2/mix/market/merge-depth?symbol='+symbol+'&productType=USDT-FUTURES&precision=scale0&limit=50';
 try{const r=await fetch(source,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();return {...surfaceRow(await r.json(),symbol),source};}catch{return {symbol,error:'Fresh order book unavailable',source};}
 }));try {const d=await getLighter(fetch,true);
 const converted=surfaceRow({code:'00000',data:{...d.depth,ts:Date.now()}},'H100');
 markets.push({...converted,venue:'Lighter',quoteCurrency:'USDC',timestamp:null,received:d.received,freshness:'Exchange timestamp unavailable; receipt only',source:d.sources[1]});
 }catch{markets.push({venue:'Lighter',symbol:'H100',quoteCurrency:'USDC',error:'Public order book unavailable'});}
 markets.forEach(m=>{if(!m.venue){m.venue='Bitget';m.quoteCurrency='USDT';}});
 markets.push({venue:'Architect',symbol:'H100 DEC 2026',quoteCurrency:'USD',error:'Authenticated depth not connected. Dated future; 730 GPU-hours per contract.',source:'/instruments.json'});
 return {received:new Date().toISOString(),markets};}
