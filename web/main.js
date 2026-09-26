import './style.css';
import {DEFAULTS,replay,ticket,parseCSV,csv} from '../lib/engine.js';
import {scenario} from '../lib/scenarios.js';
const $=s=>document.querySelector(s), money=(n,d=0)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:d}).format(n), num=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
const time=t=>new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let config={...DEFAULTS},quotes=scenario(),result=replay(quotes,config),cursor=quotes.length-1,timer=null,uploaded=false;
let source='Synthetic / convergence',currentScenario='reversion';

function chart(series,{height=190,thresholds=[],zero=false,format=v=>v.toFixed(1),label='Chart'}={}){
  const w=700,h=height,p={l:50,r:15,t:16,b:29},all=series.flatMap(s=>s.values.filter(Number.isFinite));if(!all.length)return '<div class="empty">Collecting observations for the signal…</div>';
  let low=Math.min(...all,...thresholds,...(zero?[0]:[])),high=Math.max(...all,...thresholds,...(zero?[0]:[]));const pad=(high-low)*.12||1;low-=pad;high+=pad;
  const len=Math.max(...series.map(s=>s.values.length)),x=i=>p.l+i/Math.max(1,len-1)*(w-p.l-p.r),y=v=>p.t+(high-v)/(high-low)*(h-p.t-p.b);
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>`;
  for(let i=0;i<4;i++){const v=low+(high-low)*i/3,yy=y(v);svg+=`<line x1="${p.l}" x2="${w-p.r}" y1="${yy}" y2="${yy}" stroke="#e7ebe8"/><text x="${p.l-8}" y="${yy+4}" text-anchor="end">${esc(format(v))}</text>`;}
  for(const v of [...thresholds,...(zero?[0]:[])])svg+=`<line x1="${p.l}" x2="${w-p.r}" y1="${y(v)}" y2="${y(v)}" stroke="#aebcb7" stroke-dasharray="4 5"/>`;
  for(const s of series){let drawing=false;const path=s.values.map((v,i)=>{if(!Number.isFinite(v)){drawing=false;return '';}const cmd=drawing?'L':'M';drawing=true;return `${cmd}${x(i).toFixed(2)},${y(v).toFixed(2)}`;}).join(' ');svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;}
  for(const i of [0,Math.floor((len-1)/2),len-1])svg+=`<text x="${x(i)}" y="${h-5}" text-anchor="middle">${quotes[i]?time(quotes[i].timestamp):''}</text>`;
  return svg+'</svg>';
}
function render(){
 const qs=quotes.slice(0,cursor+1),rs=result.rows.slice(0,cursor+1),r=rs.at(-1),q=qs.at(-1);const t=ticket(q,config);
 $('#source').textContent=source;$('#source-note').textContent=uploaded?'User-supplied quotes, not independently verified. Paper results only.':'Constructed quotes, not historical returns. No exchange orders.';
 $('#z').textContent=r.z===null?'Warmup':num(r.z)+'σ';$('#signal-description').textContent=r.action==='HALTED'?'Halted: unresolved exposure / loss limit':r.z===null?`${rs.length} / ${config.lookback} baseline observations`:r.z>0?'Compute above its recent relative baseline':'Compute below its recent relative baseline';
 $('#pnl').textContent=money(r.equity,2);$('#pnl').className='metric '+(r.equity<0?'negative':'positive');$('#pnl-note').textContent=`${rs.filter(v=>v.action.startsWith('CLOSE_')).length} exits · ${r.compute_contracts?'open position marked':'flat'} · ${uploaded?'imported data':'synthetic data'}`;
 let peak=0,dd=0;for(const v of rs){peak=Math.max(peak,v.equity);dd=Math.max(dd,peak-v.equity);}$('#drawdown').textContent=money(dd,2);$('#cost').textContent=money(t.cost,2);$('#cost-note').textContent='At selected quote · excludes funding / impact';
 $('#range').textContent=time(qs[0].timestamp)+'–'+time(q.timestamp);$('#clock').textContent=time(q.timestamp)+' UTC';$('#scrub').value=cursor;
 const initialC=(quotes[0].compute_bid+quotes[0].compute_ask)/2,initialE=(quotes[0].energy_bid+quotes[0].energy_ask)/2;
 $('#prices-chart').innerHTML=chart([{color:'#128370',values:qs.map(q=>(q.compute_bid+q.compute_ask)/2/initialC*100)},{color:'#c49335',values:qs.map(q=>(q.energy_bid+q.energy_ask)/2/initialE*100)}],{height:270,label:'Constructed or imported compute and energy midquotes, indexed to 100'});
 $('#z-chart').innerHTML=chart([{color:'#128370',values:rs.map(r=>r.z)}],{thresholds:[-2,2],zero:true,label:'Relative deviation versus preceding observations'});
 $('#pnl-chart').innerHTML=chart([{color:'#52788f',values:rs.map(r=>r.equity)}],{zero:true,format:v=>money(v),label:'Paper P&L after modeled costs, no-trade baseline zero'});
 $('#compute-count').textContent=`${t.qc} / proposed size`;$('#energy-count').textContent=`${t.qe} / proposed size`;
 $('#gross').textContent=money(t.nc+t.ne);$('#breakeven').textContent=t.breakEven===null?'Below minimum size':num(t.breakEven,1)+' bps';
 $('#ticket-title').textContent=r.action==='HALTED'?'Experiment halted':r.compute_contracts<0?'Short compute / long energy':r.compute_contracts>0?'Long compute / short energy':'No open paper position';
 $('#ticket-description').textContent='Heading shows the current paper position. Sizing below is a fresh hypothetical ticket at this quote, not an executable order.';
 const events=rs.filter((v,i)=>!['WARMUP','HOLD'].includes(v.action)&&(v.action!=='HALTED'||rs[i-1]?.action!=='HALTED'));$('#event-count').textContent=events.length+' decision events';$('#events').innerHTML=events.slice(-30).reverse().map(v=>`<tr><td>${time(v.timestamp)}</td><td><span class="event ${v.action.startsWith('OPEN')?'enter':''}">${esc(v.action.replaceAll('_',' ').toLowerCase())}</span></td><td>${num(v.z)}σ</td><td>${v.compute_contracts}</td><td>${v.energy_contracts}</td><td>${money(v.realized_pnl,2)}</td></tr>`).join('')||'<tr><td colspan="6">No decisions yet. The model first needs 60 observations.</td></tr>';
}
function stop(){if(timer)clearInterval(timer);timer=null;$('#play').textContent='↺ Replay';}
function fail(e){$('#error').textContent=e.message;$('#error').hidden=false;}
function run(nextQuotes=quotes,nextConfig=config){try{const next=replay(nextQuotes,nextConfig);stop();quotes=nextQuotes;config=nextConfig;result=next;cursor=quotes.length-1;$('#scrub').max=cursor;$('#error').hidden=true;render();return true;}catch(e){fail(e);return false;}}
$('#scenario').onchange=e=>{const selected=e.target.value;if(run(scenario(selected))){uploaded=false;currentScenario=selected;source='Synthetic / '+({reversion:'convergence',breakdown:'structural break',friction:'cost drag'}[selected]);render();}};
$('#apply').onclick=()=>run(quotes,{...config,leg_usd:Number($('#budget').value),beta:Number($('#beta').value),fee_bps:Number($('#fees').value),slippage_bps:Number($('#slippage').value)});
$('#play').onclick=()=>{if(timer){stop();return;}if(cursor>=quotes.length-1)cursor=0;$('#play').textContent='Ⅱ Pause';timer=setInterval(()=>{cursor=Math.min(cursor+3,quotes.length-1);render();if(cursor===quotes.length-1)stop();},100);};
$('#scrub').oninput=e=>{stop();cursor=Number(e.target.value);render();};
function download(name,text){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>download('guild-'+(uploaded?'imported':'synthetic-'+currentScenario)+'-paper-replay.csv',csv(result.rows));
$('#download-input').onclick=()=>download((uploaded?'USER_SUPPLIED':'SYNTHETIC_'+currentScenario)+'-quotes.csv',csv(quotes));
$('#upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>8_000_000)throw Error('CSV exceeds 8 MB');const qs=parseCSV(await f.text());if(run(qs)){uploaded=true;source='Imported / '+f.name;render();}}catch(err){fail(err);}e.target.value='';};
$('#fetch-market').onclick=async()=>{
 const btn=$('#fetch-market');btn.disabled=true;$('#architect-compare').textContent='Requesting authenticated snapshot…';$('#market-status').textContent='Requesting two validated book snapshots…';$('#book-view').innerHTML='';
 try{const token=$('#access-token').value;const r=await fetch('/api/market',{headers:token?{Authorization:'Bearer '+token}:{}});const s=await r.json();
 if(!r.ok||s.mode!=='observed'){$('#market-status').textContent=s.message||'Unavailable';return;}
 $('#architect-compare').textContent=`${s.environment.toUpperCase()} · H100 ${money(s.books[0].bid,4)} / ${money(s.books[0].ask,4)} · received ${new Date(s.received*1000).toISOString()}`;
 $('#market-status').textContent=`${s.environment.toUpperCase()} · observed ${new Date(s.received*1000).toISOString()} · snapshot only, not a live stream.`;
 $('#book-view').innerHTML='<div class="table-scroll"><table><thead><tr><th>SYMBOL</th><th>BID × SIZE</th><th>ASK × SIZE</th><th>AGE AT FETCH</th></tr></thead><tbody>'+s.books.map(b=>`<tr><td>${esc(b.symbol)}</td><td>${num(b.bid,3)} × ${b.bidSize}</td><td>${num(b.ask,3)} × ${b.askSize}</td><td>${num(s.received-b.timestamp,1)}s</td></tr>`).join('')+'</tbody></table></div><p class="small">Top-of-book sizes are displayed, not assumed fills. Run the collector to accumulate a replayable series.</p>';
 }catch{$('#market-status').textContent='Market endpoint unavailable. Run npm run dev or deploy on Vercel; static preview has no API.';}finally{btn.disabled=false;}
};
render();

async function refreshLighter(){
 const btn=$('#refresh-lighter');btn.disabled=true;$('#lighter-status').textContent='Fetching public Lighter H100 book and metadata…';$('#lighter-stats').innerHTML='';$('#lighter-book').innerHTML='';
 for(const id of ['lighter-size','lighter-funding','lighter-quote'])$('#'+id).textContent='Awaiting observation';
 try{const r=await fetch('/api/lighter');if(!r.ok)throw Error('Unavailable');const d=await r.json();
 $('#lighter-status').textContent=`H100 perpetual · market ${d.marketId} · received ${d.received} · exchange timestamp unavailable. Refresh to update.`;
 const fmt=v=>v===null?'Unavailable':money(v,4);
 $('#lighter-stats').innerHTML=[['MARK / INDEX',fmt(d.mark)+' / '+fmt(d.index),'Reference prices, not executable quotes'],['BID–ASK SPREAD',num(d.spreadBps,1)+' bps','Observed top of book'],['24H QUOTE VOLUME',d.volume24h===null?'Unavailable':money(d.volume24h),`${d.trades24h??'Unknown'} trades · exchange reported`],['MARK–INDEX PREMIUM',d.premiumBps===null?'Unavailable':num(d.premiumBps,1)+' bps','Same-venue reference difference']].map(([a,b,c])=>`<article><div class="kicker">${esc(a)}</div><div class="metric">${esc(b)}</div><p>${esc(c)}</p></article>`).join('');
 $('#lighter-size').textContent=`API multiplier ${d.multiplier??'unknown'}; minimum base ${d.minBase??'unknown'}, minimum quote ${d.minQuote??'unknown'}. Not Architect contract units.`;
 $('#lighter-funding').textContent=d.fundingRaw===null?'Unavailable':`Raw API rate: ${d.fundingRaw}; period / normalization not verified`;
 $('#lighter-quote').textContent=`${fmt(d.bid)} / ${fmt(d.ask)}`;
 $('#lighter-book').innerHTML=`<h3>Visible H100 book</h3><p class="small">Within 1% of mid: bids ${money(d.bidDepth1pct,2)} · asks ${money(d.askDepth1pct,2)}. Orders returned: ${d.ordersReturned.bids} bids / ${d.ordersReturned.asks} asks. Zero means no sampled orders in that band.</p><div class="table-scroll"><table><thead><tr><th>BID PRICE</th><th>BASE SIZE</th><th>ASK PRICE</th><th>BASE SIZE</th></tr></thead><tbody>${Array.from({length:Math.max(d.bids.length,d.asks.length)},(_,i)=>`<tr><td>${d.bids[i]?fmt(d.bids[i].price):'—'}</td><td>${d.bids[i]?num(d.bids[i].size):'—'}</td><td>${d.asks[i]?fmt(d.asks[i].price):'—'}</td><td>${d.asks[i]?num(d.asks[i].size):'—'}</td></tr>`).join('')}</tbody></table></div>`;
 }catch{$('#lighter-status').textContent='Lighter data unavailable or invalid. No synthetic prices substituted. Try refresh.';}finally{btn.disabled=false;}
}
$('#refresh-lighter').addEventListener('click',refreshLighter);refreshLighter();
