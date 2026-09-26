// Read-only Architect market data. No order, account, position or balance routes.
export const SYMBOLS=['NVDA-H100-2026-DEC','UNG-PERP'];
export function baseURL(env=process.env){
  const target=env.ARCHITECT_ENV||'sandbox';
  if(!['sandbox','production'].includes(target))throw Error('ARCHITECT_ENV must be sandbox or production');
  return target==='production'?'https://gateway.architect.exchange':'https://gateway.sandbox.architect.exchange';
}
export function parseBook(payload,symbol,received=Date.now()/1000){
  const b=payload?.book;if(!b||!Array.isArray(b.b)||!Array.isArray(b.a))throw Error('Missing order book');
  const side=(rows,descending)=>rows.map(v=>({price:Number(v.p),size:Number(v.q)})).filter(v=>Number.isFinite(v.price)&&v.price>0&&Number.isFinite(v.size)&&v.size>0).sort((x,y)=>descending?y.price-x.price:x.price-y.price);
  const bids=side(b.b,true),asks=side(b.a,false);if(!bids.length||!asks.length)throw Error('Empty order book');
  // Architect/Hummingbot snapshot ts is epoch seconds. Never substitute receipt time.
  const timestamp=Number(b.ts);
  if(!Number.isFinite(timestamp)||timestamp<1e9||timestamp>1e11)throw Error('Unexpected book timestamp unit');
  if(timestamp>received+2||received-timestamp>120)throw Error('Stale/future order book');
  if(bids[0].price>asks[0].price)throw Error('Crossed order book');
  return {symbol,timestamp,received,bid:bids[0].price,ask:asks[0].price,bidSize:bids[0].size,askSize:asks[0].size,bids:bids.slice(0,20),asks:asks.slice(0,20)};
}
export function quoteFromBooks(books,received=Date.now()/1000){
  const [c,e]=SYMBOLS.map(s=>books.find(b=>b.symbol===s));
  if(!c||!e)throw Error('Both books required');
  if(Math.abs(c.timestamp-e.timestamp)>30)throw Error('Books are not synchronized within 30 seconds');
  return {timestamp:received,compute_bid:c.bid,compute_ask:c.ask,energy_bid:e.bid,energy_ask:e.ask,compute_timestamp:c.timestamp,energy_timestamp:e.timestamp};
}
let cachedToken=null,tokenUntil=0,tokenOwner='';
async function json(url,options={},fetcher=fetch){
  const r=await fetcher(url,{...options,signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error(`Architect HTTP ${r.status}`);
  return r.json();
}
export async function getSnapshot(env=process.env,fetcher=fetch){
  const base=baseURL(env);
  if(!env.ARCHITECT_API_KEY||!env.ARCHITECT_API_SECRET)return {mode:'disconnected',environment:env.ARCHITECT_ENV||'sandbox',message:'No market-data credentials configured. Synthetic replay remains available.',books:[]};
  const owner=base+'|'+env.ARCHITECT_API_KEY;
  if(!cachedToken||Date.now()>tokenUntil||owner!==tokenOwner){
    const r=await json(base+'/api/authenticate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:env.ARCHITECT_API_KEY,api_secret:env.ARCHITECT_API_SECRET,expiration_seconds:3600})},fetcher);
    if(typeof r.token!=='string'||!r.token)throw Error('Authentication returned no token');
    cachedToken=r.token;tokenUntil=Date.now()+3300_000;tokenOwner=owner;
  }
  try{
    const payloads=await Promise.all(SYMBOLS.map(s=>json(base+'/api/book?symbol='+encodeURIComponent(s)+'&level=2',{headers:{Authorization:'Bearer '+cachedToken}},fetcher)));
    const received=Date.now()/1000,books=payloads.map((p,i)=>parseBook(p,SYMBOLS[i],received));
    return {mode:'observed',environment:env.ARCHITECT_ENV||'sandbox',received,source:base+'/api/book',books,quote:quoteFromBooks(books,received),executionEnabled:false};
  }catch(e){cachedToken=null;throw e;}
}
