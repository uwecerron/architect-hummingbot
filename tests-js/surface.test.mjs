import test from 'node:test';import assert from 'node:assert/strict';import {sweep,surfaceRow} from '../lib/surface.js';
test('sweep uses partial last level and does not extrapolate',()=>{assert.equal(sweep([[2,10],[4,10]],40),40/15);assert.equal(sweep([[2,10]],21),null);});
test('stale and crossed books rejected',()=>{const b={code:'00000',data:{ts:1000,bids:[[2,1000]],asks:[[3,1000]]}};assert.throws(()=>surfaceRow(b,'H100',200000));b.data.asks=[[1,1000]];assert.throws(()=>surfaceRow(b,'H100',1000));});
