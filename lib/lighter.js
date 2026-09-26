// Public, read-only market observations. No credentials or trading endpoints.
export const BASE='https://mainnet.zklighter.elliot.ai/api/v1';
const positive=v=>v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const nonnegative=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export function parseLighter(details,book,funding,received=new Date().toISOString()){
 const markets=details?.order_book_details;if(details?.code!==200||!Array.isArray(markets))throw Error('Invalid catalogue');
 const m=markets.find(x=>x.symbol==='H100'&&x.market_type==='perp');if(!m||m.status!=='active')throw Error('H100 not active');
 if(book?.code!==200||!Array.isArray(book.bids)||!Array.isArray(book.asks))throw Error('Invalid book');
 const side=(rows,dir)=>rows.map(x=>({price:positive(x.price),size:positive(x.remaining_base_amount)})).filter(x=>x.price&&x.size).sort((a,b)=>dir*(a.price-b.price));
 const bids=side(book.bids,-1),asks=side(book.asks,1);if(!bids.length||!asks.length||bids[0].price>=asks[0].price)throw Error('Empty or crossed book');
 const bid=bids[0].price,ask=asks[0].price,mid=(bid+ask)/2,mark=positive(m.mark_price),index=positive(m.index_price);
 const f=funding?.code===200?funding.funding_rates?.find(x=>x.market_id===m.market_id&&x.symbol==='H100'&&x.exchange==='lighter'):null;
 return {venue:'Lighter',symbol:m.symbol,marketId:m.market_id,type:m.market_type,received,exchangeTimestamp:null,mark,index,last:positive(m.last_trade_price),bid,ask,spreadBps:(ask-bid)/mid*1e4,premiumBps:mark&&index?(mark/index-1)*1e4:null,volume24h:nonnegative(m.daily_quote_token_volume),trades24h:nonnegative(m.daily_trades_count),openInterestRaw:nonnegative(m.open_interest),minBase:positive(m.min_base_amount),minQuote:positive(m.min_quote_amount),multiplier:positive(m.multiplier),fundingRaw:f&&Number.isFinite(Number(f.rate))?Number(f.rate):null,bidDepth1pct:bids.filter(x=>x.price>=mid*.99).reduce((s,x)=>s+x.price*x.size,0),askDepth1pct:asks.filter(x=>x.price<=mid*1.01).reduce((s,x)=>s+x.price*x.size,0),ordersReturned:{bids:bids.length,asks:asks.length},bids:bids.slice(0,8),asks:asks.slice(0,8),sources:[BASE+'/orderBookDetails?market_id='+m.market_id,BASE+'/orderBookOrders?market_id='+m.market_id+'&limit=100',BASE+'/funding-rates']};
}
export async function getLighter(fetcher=fetch){
 const get=async path=>{const r=await fetcher(BASE+path,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Lighter upstream unavailable');return r.json();};
 const details=await get('/orderBookDetails');const m=details.order_book_details?.find(x=>x.symbol==='H100'&&x.market_type==='perp');if(!Number.isInteger(m?.market_id))throw Error('H100 unavailable');
 const [book,funding]=await Promise.all([get('/orderBookOrders?market_id='+m.market_id+'&limit=100'),get('/funding-rates').catch(()=>null)]);
 return parseLighter(details,book,funding);
}
