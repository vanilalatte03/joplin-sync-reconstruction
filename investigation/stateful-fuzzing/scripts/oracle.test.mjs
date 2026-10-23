import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run} from './fuzz.mjs';
import {needsUpload} from './oracle.mjs';

test('upload boundary follows strict timestamp and force_sync, excluding disabled items', () => {
  const n={id:'n',updated_time:100};
  assert.equal(needsUpload(n,[]),true);
  for(const [sync_time,force_sync,sync_disabled,expected] of [[99,0,0,true],[100,0,0,false],[101,0,0,false],[101,1,0,true],[99,1,1,false]])
    assert.equal(needsUpload(n,[{item_id:'n',sync_time,force_sync,sync_disabled}]),expected);
});

test('clean downloaded body replacement is legacy false positive; dirty disappearance remains a signal', () => {
  const note={id:'n',body:'FUZZ:old',updated_time:100,is_conflict:0,deleted_time:0};
  const before={local:{a:[note],b:[],c:[]},remote:[],syncMetadata:{a:[{item_id:'n',sync_time:100,force_sync:0,sync_disabled:0}],b:[],c:[]}};
  const after={local:{a:[{...note,body:'FUZZ:new'}],b:[],c:[]},remote:[]};
  const check=oracle=>{const run=new Run({oracle});run.checkPreservation(before,after,{op:'SYNC',client:'a'});return run.findings;};
  assert.equal(check('legacy-v1').length,1);
  assert.equal(check('dirty-v2').length,0);
  before.syncMetadata.a[0].sync_time=99;
  assert.equal(check('dirty-v2').length,1);
  after.local.b=[note];
  assert.equal(check('dirty-v2').length,0);
});
