import fs from 'node:fs';import assert from 'node:assert/strict';
const file='evidence/persistence.json';const base=process.env.SYNC_URL||'http://127.0.0.1:8087';
const delta=await(await fetch(base+'/sync/pull?after=0')).json();
if(process.argv[2]==='before'){
 fs.writeFileSync(file,JSON.stringify({before:delta,observedBefore:new Date().toISOString()},null,2));console.log('Saved '+delta.changes.length+' committed changes before shutdown.');
}else{
 const result=JSON.parse(fs.readFileSync(file));assert.deepEqual(delta,result.before);result.observedAfter=new Date().toISOString();result.pass=true;result.method='Stop original JVM, start a new JVM with same H2 file, compare full change log and cursor';fs.writeFileSync(file,JSON.stringify(result,null,2));console.log('PASS restart persistence: '+delta.changes.length+' changes');
}
