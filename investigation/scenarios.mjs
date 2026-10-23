import {connect} from './cdp.mjs';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const dir=path.resolve('evidence/original-scenarios');fs.mkdirSync(dir,{recursive:true});
const target=path.resolve('work/runtime/sync-target');const fixture=JSON.parse(fs.readFileSync('work/runtime/fixture.json'));
const cs={a:await connect(9231),b:await connect(9233)};
const roots={a:'work/runtime',b:'work/runtime-b'};const ports={a:41184,b:41185};const results=process.argv.includes('--finish-delete')?JSON.parse(fs.readFileSync(path.join(dir,'results.json'))):[];
const api=async(client,method,route,data)=>{const token=fs.readFileSync(roots[client]+'/clipper-token.txt','utf8');const r=await fetch(`http://127.0.0.1:${ports[client]}/${route}${route.includes('?')?'&':'?'}token=${token}`,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const text=await r.text();const x=text?JSON.parse(text):null;if(!r.ok)throw Error(JSON.stringify(x));return x};
const read=(client)=>api(client,'GET',`notes/${fixture.noteId}?fields=id,title,body,updated_time,is_conflict,deleted_time`);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function sync(client,label='sync'){const logfile=roots[client]+`/profile-${client}/log.txt`;let before=fs.readFileSync(logfile,'utf8').length;await cs[client].eval('require("@electron/remote").Menu.getApplicationMenu().getMenuItemById("synchronize").click()');let deadline=Date.now()+60000;while(Date.now()<deadline){let log=fs.readFileSync(logfile,'utf8').slice(before);if(log.includes('Synchronisation finished')){await pause(250);fs.writeFileSync(path.join(dir,`${results.length}-${client}-${label}.log`),fs.readFileSync(logfile,'utf8').slice(before));return log}await pause(200)}throw Error('Sync timeout '+client)}
function record(scenario,observations){const r={scenario,observedAt:new Date().toISOString(),observations};results.push(r);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(r));}
try{
if(!process.argv.includes('--finish-delete')){
await sync('b');assert.equal((await read('b')).body,(await read('a')).body);record('create propagation',{sameIdAndBody:true});
await api('a','PUT','notes/'+fixture.noteId,{body:'edited-online-v2\n한글 수정'});await sync('a');await sync('b');assert.equal((await read('b')).body,'edited-online-v2\n한글 수정');record('edit propagation',{sameBody:true,remoteFileNameUnchanged:fs.existsSync(path.join(target,fixture.noteId+'.md'))});
// Local filesystem analogue of offline: B does not sync while A changes.
await api('b','PUT','notes/'+fixture.noteId,{body:'B-offline-edit'});assert.equal((await read('b')).body,'B-offline-edit');assert(fs.readFileSync(path.join(target,fixture.noteId+'.md'),'utf8').includes('edited-online-v2'));record('offline local edit',{localSaved:true,remoteUnchangedBeforeSync:true,limitation:'Sync withheld; no real network isolation applied to filesystem target'});
await api('a','PUT','notes/'+fixture.noteId,{body:'A-concurrent-edit'});await sync('a');await sync('b');
let all=await api('b','GET','notes?include_conflicts=1&include_deleted=1&fields=id,title,body,is_conflict,conflict_original_id,deleted_time');let conflict=all.items.find(n=>n.is_conflict&&n.body==='B-offline-edit');assert(conflict);assert.equal((await read('b')).body,'A-concurrent-edit');record('concurrent divergent edits',{canonical:(await read('b')).body,conflict,localAndRemoteContentsPreserved:true});
// Destination unavailable before an attempted sync: reversible rename, no user files involved.
const failureNote=await api('a','POST','notes',{parent_id:fixture.folderId,title:'REA failure probe',body:'retained-on-failure'});
const held=target+'-held';assert(!fs.existsSync(held));fs.renameSync(target,held);fs.writeFileSync(target,'controlled unavailable target');
let failureLog;
try{failureLog=await sync('a','failure')}finally{fs.unlinkSync(target);fs.renameSync(held,target)}
assert(/ENOTDIR|EEXIST|Error:|Fail-safe:|\[warn\] There was some errors/i.test(failureLog));await sync('a','retry');assert(fs.readFileSync(path.join(target,failureNote.id+'.md'),'utf8').includes('retained-on-failure'));record('destination failure and retry',{failureReported:true,retryStoredPayload:true,limitation:'Filesystem unavailable before sync; mid-transfer network interruption remains unverified'});
await api('a','DELETE','notes/'+fixture.noteId);
}
await sync('a');await sync('b');let deleted=await read('b');record('delete propagation',{deletedTime:deleted.deleted_time,remoteFileStillExists:fs.existsSync(path.join(target,fixture.noteId+'.md')),trashPropagated:deleted.deleted_time>0});assert(deleted.deleted_time>0);
}finally{for(const c of Object.values(cs))c.close()}
