// Public-data collector. No credentials, signing or order endpoints.
import {mkdir,appendFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {getSurface} from '../../lib/surface.js';
import {getLighter} from '../../lib/lighter.js';
const args=process.argv.slice(2);
if(args.some(x=>!['--once','--help'].includes(x))) throw Error('Usage: npm run collect:compute -- [--once]');
if(args.includes('--help')) {console.log('Public Bitget H100/B200 surfaces + Lighter H100 snapshots. Output: output/compute-venues.jsonl. Polls every 60s; Ctrl+C stops.');process.exit(0);}
const path=resolve('output/compute-venues.jsonl');
await mkdir(dirname(path),{recursive:true});
let running=true;const abort=new AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{running=false;abort.abort();});
do {
 const observations=await Promise.allSettled([getSurface().then(d=>({...d,markets:d.markets.filter(m=>m.venue==='Bitget')})),getLighter()]);
 const row={schemaVersion:1,received:new Date().toISOString(),readOnly:true,venues:observations.map((r,i)=>({venue:i===0?'Bitget':'Lighter',quoteCurrency:i===0?'USDT':'USDC',...(r.status==='fulfilled'?{observation:r.value}:{error:'Public snapshot unavailable'})}))};
 await appendFile(path,JSON.stringify(row)+'\n');
 console.log(`${row.received} saved ${path}; ${row.venues.map(v=>v.venue+': '+(v.error?'unavailable':'received')).join(', ')}`);
 if(args.includes('--once')||!running)break;
 try{await delay(60000,undefined,{signal:abort.signal});}catch{break;}
}while(running);
