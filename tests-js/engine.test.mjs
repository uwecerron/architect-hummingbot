import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {PairEngine,parseCSV,replay,ticket,DEFAULTS,validateQuote,csv} from '../lib/engine.js';
import {scenario} from '../lib/scenarios.js';
const quotes=parseCSV(readFileSync('data/SYNTHETIC_demo.csv','utf8'));
for(const name of ['reversion','breakdown','friction'])test('Python/Node parity on '+name,()=>{
 const qs=scenario(name);
 const python=JSON.parse(execFileSync('python3',['-c','import json,sys; from scripts.energy_compute_core import PairEngine,Quote; e=PairEngine(); print(json.dumps([e.step(Quote(**q)) for q in json.load(sys.stdin)]))'],{input:JSON.stringify(qs),encoding:'utf8'}));
 const js=replay(qs).rows;assert.equal(js.length,python.length);
 for(let i=0;i<js.length;i++)for(const k of Object.keys(python[i])){if(typeof python[i][k]==='number')assert.ok(Math.abs(js[i][k]-python[i][k])<1e-7,`${i} ${k}`);else assert.equal(js[i][k],python[i][k]);}
});
test('Original demo exact actions and P&L match Python',()=>{
 const python=JSON.parse(execFileSync('python3',['-c','import json; from scripts.energy_compute_core import PairEngine,read_quotes; e=PairEngine(); print(json.dumps([e.step(q) for q in read_quotes("data/SYNTHETIC_demo.csv")]))'],{encoding:'utf8'}));
 const js=replay(quotes).rows;for(let i=0;i<js.length;i++){assert.equal(js[i].action,python[i].action);assert.ok(Math.abs(js[i].realized_pnl-python[i].realized_pnl)<1e-7);}
});
test('Reject malformed, blank and non-finite CSV',()=>{
 assert.throws(()=>parseCSV('foo\n1'),/columns/);
 assert.throws(()=>parseCSV(csv(quotes.slice(0,4)).replace(String(quotes[0].compute_bid),'Infinity')),/numeric/);
 assert.throws(()=>parseCSV(csv(quotes.slice(0,4)).replace(String(quotes[0].compute_bid),'')),/numeric/);
});
test('Reject stale, crossed and reversed timestamp data',()=>{
 const q=quotes[0];assert.throws(()=>validateQuote({...q,compute_timestamp:q.timestamp-121}),/Stale/);
 assert.throws(()=>validateQuote({...q,compute_bid:q.compute_ask+1}),/crossed/);
 const e=new PairEngine();e.step(q);assert.throws(()=>e.step(q),/increase/);
});
test('Lagged baseline is not influenced by current observation',()=>{
 const e=new PairEngine({lookback:3}),q=quotes[0];
 for(let i=0;i<3;i++)e.step({...q,timestamp:q.timestamp+i,compute_bid:3+i*.01,compute_ask:3+i*.01});
 const r=e.step({...q,timestamp:q.timestamp+3,compute_bid:30,compute_ask:30});assert.ok(r.z>100);assert.equal(r.compute_contracts,0);
});
test('Invalid config rejected and integer contract sizing used',()=>{
 assert.throws(()=>new PairEngine({beta:0}));assert.throws(()=>new PairEngine({entry_z:5}));
 const t=ticket(quotes[0]);assert.equal(t.qc,Math.floor(DEFAULTS.leg_usd/((quotes[0].compute_bid+quotes[0].compute_ask)/2*730)));assert.ok(t.cost>0);assert.ok(t.mismatch>=0);
});
test('Gap with open paper exposure halts without fake closure',()=>{
 const e=new PairEngine();let q;
 for(const x of quotes){q=x;e.step(x);if(e.position)break;}
 assert.ok(e.position);const before={...e.position};const next={...q,timestamp:q.timestamp+500,compute_timestamp:q.timestamp+500,energy_timestamp:q.timestamp+500};
 const r=e.step(next);assert.equal(r.action,'HALTED');assert.deepEqual(e.position,before);
});
test('No-trade equity and drawdown start at zero',()=>{
 const r=replay(quotes,{entry_z:100,stop_z:101});assert.equal(r.closed,0);assert.equal(r.drawdown,0);assert.ok(r.rows.every(v=>v.equity===0));
});
