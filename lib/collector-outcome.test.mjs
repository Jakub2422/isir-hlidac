import assert from 'node:assert/strict';
import {collectorOutcome} from './collector-outcome.ts';
assert.deepEqual(collectorOutcome([{ok:true}],0,0),{complete:true,status:200});
assert.deepEqual(collectorOutcome([{ok:true}],0,1),{complete:false,status:207});
assert.deepEqual(collectorOutcome([{ok:true}],1,0),{complete:false,status:207});
assert.deepEqual(collectorOutcome([{ok:false},{ok:true}],0,0),{complete:false,status:207});
console.log('collector-outcome: success and partial failure cases passed');
