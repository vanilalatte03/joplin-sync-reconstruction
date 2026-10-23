import {Lab,output,target} from './conflict-lab.mjs';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const lab=await new Lab().open();const results=process.argv.includes('--natural')?JSON.parse(fs.readFileSync(path.join(output,'results.json'))).map(r=>JSON.parse(fs.readFileSync(path.join(output,r.caseId,'result.json')))):[];const folder=await lab.api('a','POST','folders',{title:'Conflict algorithm controlled experiments'});await lab.sync('a','folder');await lab.sync('b','folder');
async function baseline(caseId,natural=false){lab.caseId=caseId;lab.phase='baseline';const id=crypto.randomBytes(16).toString('hex');let base=Date.now()-3600000;await lab.active(id);let note=await lab.api('a','POST','notes',{id,parent_id:folder.id,title:caseId,body:'BASE'});if(natural)base=note.updated_time;else note=await lab.setTimes('a',id,{updated_time:base,user_updated_time:base});assert.equal(note.updated_time,base);await lab.sync('a','baseline');await lab.sync('b','baseline');const before={a:await lab.state('a',id),b:await lab.state('b',id),remote:lab.remote(id)};assert.equal(before.b.canonical.body,'BASE');assert.equal(before.b.syncItem.sync_time,base);lab.phase='experiment';return {id,base,before};}
async function edits(id,base,{aTime=10000,bTime=20000,aBody='A_EDIT',bBody='B_EDIT',aTitle,bTitle,aUser,bUser}={},natural=false){const data={};for(const c of ['a','b']){const body=c==='a'?aBody:bBody,time=base+(c==='a'?aTime:bTime),title=c==='a'?aTitle:bTitle,user=c==='a'?aUser:bUser;const change={body,...(title===undefined?{}:{title}),...(natural?{}:{updated_time:time,...(user===undefined?{}:{user_updated_time:user})})};data[c]=await lab.api(c,'PUT','notes/'+id,change);if(!natural){data[c]=await lab.setTimes(c,id,{updated_time:time,...(user===undefined?{}:{user_updated_time:user})});assert.equal(data[c].updated_time,time);}assert.equal(data[c].body,body)}return data;}
async function run(config){const start=lab.trace.length;const {id,base,before}=await baseline(config.caseId,config.natural);let inputs,remoteBeforeSecond;
 if(config.deletion){await lab.api('a','DELETE','notes/'+id+(config.deletion==='permanent'?'?permanent=1':''));inputs={deletion:config.deletion,b:await lab.api('b','PUT','notes/'+id,{body:'B_OFFLINE_EDIT',...(config.natural?{}:{updated_time:base+20000})})};}
 else inputs=await edits(id,base,config.edits,config.natural);
 const afterEdits={a:await lab.state('a',id),b:await lab.state('b',id),remote:lab.remote(id)};
 const first=config.order?.[0]||'a',second=config.order?.[1]||'b';await lab.sync(first,'first');
 if(config.remoteOffset!==undefined){const file=path.join(target,id+'.md');const text=fs.readFileSync(file,'utf8').replace(/^updated_time: .*$/m,'updated_time: '+new Date(base+config.remoteOffset).toISOString());fs.writeFileSync(file,text);}
 if(config.fileMtimeOffset!==undefined){const time=new Date(base+config.fileMtimeOffset);fs.utimesSync(path.join(target,id+'.md'),time,time);}
 remoteBeforeSecond=lab.remote(id);const beforeSecond={a:await lab.state('a',id),b:await lab.state('b',id)};
 await lab.sync(second,'second');const afterSecond={a:await lab.state('a',id),b:await lab.state('b',id),remote:lab.remote(id)};await lab.sync(first,'converge');const final={a:await lab.state('a',id),b:await lab.state('b',id),remote:lab.remote(id)};
 const trace=lab.trace.slice(start).filter(x=>x.phase==='experiment');const result={caseId:config.caseId,observedAt:new Date().toISOString(),configuration:config,noteId:id,baseUpdatedTime:base,before,afterEdits,inputs,remoteBeforeSecond,beforeSecond,afterSecond,final,trace};fs.mkdirSync(path.join(output,config.caseId),{recursive:true});fs.writeFileSync(path.join(output,config.caseId,'result.json'),JSON.stringify(result,null,2));results.push(result);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results.map(r=>({caseId:r.caseId,noteId:r.noteId,configuration:r.configuration,canonicalA:r.final.a.canonical,canonicalB:r.final.b.canonical,conflictsA:r.final.a.conflicts,conflictsB:r.final.b.conflicts,trace:r.trace})),null,2));console.log(JSON.stringify({case:config.caseId,canonicalA:final.a.canonical?.body||null,deletedA:final.a.canonical?.deleted_time??null,conflictsA:final.a.conflicts.map(n=>({body:n.body,deleted_time:n.deleted_time})),conflictsB:final.b.conflicts.map(n=>({body:n.body,deleted_time:n.deleted_time})),trace:trace.map(t=>({client:t.client,kind:t.kind,remoteGreater:t.captured?.remoteGreaterThanSync,predicate:t.captured?.predicateExpression}))}));return result;}
const configs=[
{caseId:'order-ab',order:['a','b']},
{caseId:'order-ba',order:['b','a']},
{caseId:'local-clock-ahead',edits:{aTime:10000,bTime:30000}},
{caseId:'local-clock-behind',edits:{aTime:30000,bTime:10000}},
{caseId:'local-updated-equals-sync',edits:{aTime:10000,bTime:0}},
{caseId:'local-updated-before-sync',edits:{aTime:10000,bTime:-1}},
{caseId:'remote-updated-equals-sync',remoteOffset:0},
{caseId:'remote-updated-before-sync',remoteOffset:-1},
{caseId:'remote-updated-one-ms-after-sync',remoteOffset:1},
{caseId:'filesystem-mtime-old',fileMtimeOffset:-100000},
{caseId:'user-updated-time-inverted',edits:{aUser:Date.now()-100000000,bUser:Date.now()+100000000}},
{caseId:'same-title-and-body',edits:{aBody:'SAME',bBody:'SAME'}},
{caseId:'same-body-different-title',edits:{aBody:'SAME',bBody:'SAME',aTitle:'TITLE_A',bTitle:'TITLE_B'}},
{caseId:'trash-delete-ab',deletion:'trash',order:['a','b']},
{caseId:'trash-delete-ba',deletion:'trash',order:['b','a']},
{caseId:'permanent-delete-ab',deletion:'permanent',order:['a','b']},
{caseId:'permanent-delete-ba',deletion:'permanent',order:['b','a']},
{caseId:'natural-order-ab',natural:true,order:['a','b']},
{caseId:'natural-order-ba',natural:true,order:['b','a']},
{caseId:'natural-identical',natural:true,edits:{aBody:'SAME',bBody:'SAME'}},
{caseId:'natural-trash-ab',natural:true,deletion:'trash',order:['a','b']},
{caseId:'natural-trash-ba',natural:true,deletion:'trash',order:['b','a']},
{caseId:'natural-permanent-ab',natural:true,deletion:'permanent',order:['a','b']},
{caseId:'natural-permanent-ba',natural:true,deletion:'permanent',order:['b','a']}
];
try{for(const config of configs.filter(c=>!!c.natural===process.argv.includes('--natural')))await run(config);console.log('Completed '+results.length+' controlled original Desktop experiments.');}finally{await lab.close()}
