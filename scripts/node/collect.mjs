import {mkdir,appendFile,access,writeFile,readFile} from 'node:fs/promises';
import {getSnapshot,SYMBOLS} from '../../lib/architect.js';
import {COLUMNS,validateQuote} from '../../lib/engine.js';
try{process.loadEnvFile('.env.local');}catch{}
const once=process.argv.includes('--once'),file='output/architect-quotes.csv';
await mkdir('output',{recursive:true});
const manifest='output/architect-quotes.meta.json',identity={environment:process.env.ARCHITECT_ENV||'sandbox',symbols:SYMBOLS};
try {
  const old=JSON.parse(await readFile(manifest,'utf8'));
  if(JSON.stringify(old)!==JSON.stringify(identity))throw Error('Output belongs to another environment. Archive it before collecting.');
} catch(e) {
  if(e.code!=='ENOENT')throw e;
  let exists=false;try{await access(file);exists=true;}catch{}
  if(exists)throw Error('Existing CSV has no manifest. Archive it before collecting.');
  await writeFile(manifest,JSON.stringify(identity,null,2));
}
try{await access(file);}catch{await writeFile(file,COLUMNS.join(',')+'\n');}
console.log('Read-only collector. 60s interval; Ctrl+C to stop. No orders.');
do{
  try{
    const s=await getSnapshot();if(!s.quote)throw Error(s.message);validateQuote(s.quote);
    await appendFile(file,COLUMNS.map(k=>s.quote[k]).join(',')+'\n');
    await writeFile('output/latest-market.json',JSON.stringify(s,null,2));
    console.log(new Date().toISOString(),'Saved paired book observation.');
  }catch(e){console.error('Observation skipped:',e.message);if(once)process.exitCode=1;}
  if(!once)await new Promise(r=>setTimeout(r,60000));
}while(!once);
