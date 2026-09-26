import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBook,quoteFromBooks,SYMBOLS,getSnapshot,baseURL} from '../lib/architect.js';
import handler from '../api/market.js';
const now=1790269200,raw={book:{ts:now,b:[{p:'3.00',q:'2'},{p:'3.01',q:'5'}],a:[{p:'3.04',q:'3'},{p:'3.03',q:'8'}]}};
test('Book parser sorts and retains observed depth',()=>{const b=parseBook(raw,SYMBOLS[0],now);assert.equal(b.bid,3.01);assert.equal(b.ask,3.03);assert.equal(b.bidSize,5);});
test('Reject stale, empty, crossed and wrong timestamp units',()=>{
 assert.throws(()=>parseBook(raw,SYMBOLS[0],now+121));
 assert.throws(()=>parseBook({book:{...raw.book,b:[]}},SYMBOLS[0],now));
 assert.throws(()=>parseBook({book:{...raw.book,a:[{p:1,q:2}]}},SYMBOLS[0],now));
 assert.throws(()=>parseBook({book:{...raw.book,ts:now*1000}},SYMBOLS[0],now));
});
test('Reject asynchronous pair rather than invent alignment',()=>{
 const c=parseBook(raw,SYMBOLS[0],now),e={...c,symbol:SYMBOLS[1],timestamp:now-31};assert.throws(()=>quoteFromBooks([c,e],now),/synchronized/);
});
test('No credentials means disconnected and zero upstream calls',async()=>{const s=await getSnapshot({},()=>{throw Error('Must not call');});assert.equal(s.mode,'disconnected');});
test('Environment allowlist',()=>{assert.throws(()=>baseURL({ARCHITECT_ENV:'https://attacker.example'}));assert.match(baseURL({}),/sandbox/);});
test('API requires a separate access token when configured; never leaks keys',async()=>{
 const saved={...process.env};Object.assign(process.env,{ARCHITECT_API_KEY:'TEST_SECRET_KEY',ARCHITECT_API_SECRET:'TEST_SECRET_SECRET',DATA_ACCESS_TOKEN:'TEST_GATE'});
 let status,body;const res={setHeader(){},status(n){status=n;return this;},json(v){body=v;}};
 try{await handler({method:'GET',headers:{}},res);assert.equal(status,401);assert.ok(!JSON.stringify(body).includes('TEST_SECRET'));await handler({method:'POST',headers:{}},res);assert.equal(status,405);}finally{for(const k of ['ARCHITECT_API_KEY','ARCHITECT_API_SECRET','DATA_ACCESS_TOKEN']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test('Authenticated reader calls only auth and two book endpoints',async()=>{
 const called=[];const fetcher=async(url,opts)=>{called.push(url);return {ok:true,json:async()=>url.endsWith('/api/authenticate')?{token:'FAKE_TOKEN'}:{book:{...raw.book,ts:Date.now()/1000}}};};
 const r=await getSnapshot({ARCHITECT_API_KEY:'test_unique',ARCHITECT_API_SECRET:'test',ARCHITECT_ENV:'sandbox'},fetcher);
 assert.equal(r.mode,'observed');assert.equal(r.executionEnabled,false);assert.equal(called.length,3);assert.ok(called.every(s=>/\/api\/(authenticate|book)/.test(s)));assert.ok(!JSON.stringify(r).includes('FAKE_TOKEN'));
});
