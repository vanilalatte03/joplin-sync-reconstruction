import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Client} from './client.mjs';

for(const id of ['__proto__','constructor','toString']) {
 test('persists a valid note ID named '+id,()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sync-client-'));
  try {
   const client=new Client(root,'a');
   client.edit(id,'title','offline payload');
   const reloaded=new Client(root,'a');
   assert.equal(Object.hasOwn(reloaded.state.notes,id),true);
   assert.equal(reloaded.state.notes[id].body,'offline payload');
   assert.equal(reloaded.state.pending[0].baseVersion,0);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
 });
}
