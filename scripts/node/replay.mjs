import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseCSV,replay,csv} from '../../lib/engine.js';
const path=process.argv[2]||'data/SYNTHETIC_demo.csv';
const result=replay(parseCSV(await readFile(path,'utf8')));
await mkdir('output',{recursive:true});await writeFile('output/node-replay.csv',csv(result.rows));
console.log(JSON.stringify({file:'output/node-replay.csv',closed:result.closed,open:result.open,drawdown:result.drawdown,last:result.rows.at(-1),note:'Paper simulation. No orders. Funding/margin/impact excluded.'},null,2));
