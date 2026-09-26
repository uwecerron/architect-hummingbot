import {getLighter} from './lighter.js';
export const HL='https://api.hyperliquid.xyz/info';
export const BG='https://api.bitget.com/api/v2/mix/market/';
export const INJ='https://sentry.lcd.injective.network/injective/exchange/v1beta1/derivative/markets/0x56cb0ef0b9d59125373112523b0adfc446dff989268547fa1a3379a6f98f5efd';
export const number=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export function quote(b,a){const bid=number(b),ask=number(a);return bid>0&&ask>bid?{bid,ask,spreadBps:(ask-bid)/((ask+bid)/2)*10000}:{bid:null,ask:null,spreadBps:null};}
export function hyperRows(data,dex){
 if(!Array.isArray(data?.[0]?.universe)||!Array.isArray(data?.[1]))throw Error('Invalid catalogue');
 const rows=data[0].universe.flatMap((m,i)=>{
 if(!/^(?:xyz|para):(H100|H200|B200|B300|A100)$/.test(m.name))return [];
 const c=data[1][i]||{},inactive=m.isDelisted===true;
 return [{venue:dex==='xyz'?'trade[XYZ]':'Paragon',network:'Hyperliquid · HIP-3',symbol:m.name,status:inactive?'Delisted':'Listed',mark:inactive?null:number(c.markPx),index:inactive?null:number(c.oraclePx),volume24h:number(c.dayNtlVlm),openInterestBase:number(c.openInterest),fundingRaw:inactive?null:number(c.funding),note:inactive?'API confirms delisting. Retained reference prices are hidden.':'Funding shown as raw API rate; benchmark comparability not established.',source:HL,request:{type:'metaAndAssetCtxs',dex}}];});
 return rows.length?rows:[{venue:dex==='xyz'?'trade[XYZ]':'Paragon',network:'Hyperliquid · HIP-3',symbol:'Compute',status:'Not listed',note:'No tracked GPU symbol in this builder catalogue.',source:HL}];
}
export function bitgetRows(tickers,contracts){
 if(tickers?.code!=='00000'||!Array.isArray(tickers.data)||contracts?.code!=='00000'||!Array.isArray(contracts.data))throw Error('Invalid Bitget response');
 return ['H100USDT','B200USDT'].map(symbol=>{const t=tickers.data.find(m=>m.symbol===symbol),m=contracts.data.find(m=>m.symbol===symbol);if(!t||!m)return {venue:'Bitget',network:'Centralized exchange',symbol,status:'Not listed',source:BG+'contracts?productType=USDT-FUTURES'};
 const active=m.symbolStatus==='normal';return {venue:'Bitget',network:'Centralized exchange',symbol,status:active?'Listed':m.symbolStatus,mark:active?number(t.markPrice):null,index:active?number(t.indexPrice):null,...(active?quote(t.bidPr,t.askPr):{}),volume24h:number(t.quoteVolume),fundingRaw:active?number(t.fundingRate):null,fundingHours:number(m.fundInterval),exchangeTimestamp:number(t.ts)?new Date(Number(t.ts)).toISOString():null,note:'Silicon Data rental-price indices. Quote volume in USDT. Contract status: '+m.symbolStatus,source:BG+'tickers?productType=USDT-FUTURES'};});
}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Upstream HTTP '+r.status);return r.json();}
const failure=(venue,network,symbol)=>[{venue,network,symbol,status:'Feed unavailable',note:'Public API request failed. No substitute prices.'}];
export async function getVenues(){
 const jobs=[
 ['Lighter','Lighter','H100',async()=>{const d=await getLighter();return [{...d,network:'Lighter',status:'Listed',fundingRaw:d.fundingRaw,source:d.sources[0],note:'Public order book snapshot. Funding interval not verified.'}];}],
 ...['xyz','para'].map(dex=>[dex==='xyz'?'trade[XYZ]':'Paragon','Hyperliquid · HIP-3','H100',async()=>{const rows=hyperRows(await json(HL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'metaAndAssetCtxs',dex})}),dex);for(const row of rows)if(row.status==='Listed'){try{const b=await json(HL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'l2Book',coin:row.symbol})});Object.assign(row,quote(b.levels?.[0]?.[0]?.px,b.levels?.[1]?.[0]?.px));row.exchangeTimestamp=b.time?new Date(b.time).toISOString():null;}catch{row.note+=' Order book unavailable.';}}return rows;}]),
 ['Bitget','Centralized exchange','H100 / B200',async()=>{const [t,c]=await Promise.all([json(BG+'tickers?productType=USDT-FUTURES'),json(BG+'contracts?productType=USDT-FUTURES')]);return bitgetRows(t,c);}],
 ['Helix','Injective','H100/USDT',async()=>{const root=INJ.slice(0,INJ.lastIndexOf('/'));const lists=await Promise.all([json(root),json(root+'?status=Paused')]);const full=lists.flatMap(d=>d.markets||[]).find(x=>x.market?.market_id===INJ.split('/').pop()),m=full?.market;if(!m?.ticker?.includes('H100')||!m.status)throw Error('Unexpected market');const active=m.status==='Active',scale=10**Number(m.quote_decimals);return [{venue:'Helix',network:'Injective',symbol:m.ticker,status:m.status,mark:active?number(full.mark_price)/scale:null,index:null,...(active?quote(number(full.mid_price_and_tob?.best_buy_price)/scale,number(full.mid_price_and_tob?.best_sell_price)/scale):{}),note:'Chain market status. Oracle: '+m.oracle_base+' via '+m.oracle_type+'. No volume feed connected.',marketId:m.market_id,source:root+(m.status==='Paused'?'?status=Paused':'')}];}]
 ];
 const results=await Promise.all(jobs.map(async([venue,network,symbol,run])=>{try{return await run();}catch{return failure(venue,network,symbol);}}));
 return {received:new Date().toISOString(),cacheSeconds:60,rows:[...results.flat(),{venue:'ByteStrike',network:'Not verified',symbol:'H100 / H200 / B200 / T4',status:'Watchlist',note:'Website advertises compute perps. Public production API and liquidity not verified; no price feed connected.',source:'https://byte-strike.com/'},{venue:'Architect',network:'Centralized exchange',symbol:'H100 DEC 2026',status:'Authentication required',note:'Saved dated-future specification. Use authenticated Check books below. No public quote substituted.',source:'/instruments.json'}]};
}
