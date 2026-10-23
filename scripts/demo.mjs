import {Client} from '../clients/client.mjs';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {randomUUID} from 'node:crypto';
const base=process.env.SYNC_URL||'http://127.0.0.1:8087';
const run=randomUUID();const root=path.resolve('work/demo-'+run);const results=[];
const a=new Client(root,'a',base),b=new Client(root,'b',base);const id='note-'+run;
const record=(scenario,checks)=>{results.push({scenario,checks,pass:true});console.log('PASS '+scenario)};
await fetch(base+'/health').then(r=>assert.equal(r.status,200));
a.edit(id,'demo','initial 한글');await a.sync();await b.sync();assert.equal(b.state.notes[id].body,'initial 한글');record('create propagation',{version:1});
a.edit(id,'demo','edited');await a.sync();await b.sync();assert.equal(b.state.notes[id].body,'edited');record('edit propagation',{version:2});
b.edit(id,'demo','B offline');const reloaded=new Client(root,'b',base);assert.equal(reloaded.state.pending.length,1);assert.equal(reloaded.state.notes[id].body,'B offline');record('offline durable local edit',{pendingSurvivesClientRestart:true});
a.edit(id,'demo','A concurrent');await a.sync();await b.sync();assert.equal(b.state.notes[id].body,'A concurrent');assert.equal(b.state.conflicts[0].mutation.body,'B offline');assert.equal(b.state.conflicts[0].server.note.body,'A concurrent');record('conflict preservation',{bothBodiesPreserved:true});
// Real HTTP fault: forward and commit a request, then destroy the client's response socket.
let cut=true,forwarded=0;
const proxy=http.createServer(async(req,res)=>{
 try{let parts=[];for await(const p of req)parts.push(p);let payload=Buffer.concat(parts);const upstream=await fetch(base+req.url,{method:req.method,headers:{'Content-Type':'application/json'},body:payload.length?payload:undefined});const body=await upstream.text();
 if(req.url==='/sync/push'){forwarded++;if(cut){cut=false;res.destroy();return}}
 res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(body);
 }catch{res.writeHead(502);res.end('{}')}
});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
try{const c=new Client(root,'network',`http://127.0.0.1:${proxy.address().port}`);c.edit('retry-'+run,'retry','committed once');await c.sync();assert.equal(c.state.notes['retry-'+run].version,1);assert(forwarded>=2);const delta=await(await fetch(base+'/sync/pull?after=0')).json();assert.equal(delta.changes.filter(c=>c.note.id==='retry-'+run).length,1);record('connection lost after server commit then retry',{actualHttpSocketDestroyed:true,requestsForwarded:forwarded,version:1,changeCount:1});}finally{await new Promise(r=>proxy.close(r));}
// Persistent outage must retain the exact operation across process restarts.
const unavailable=http.createServer();await new Promise(r=>unavailable.listen(0,'127.0.0.1',r));const closedPort=unavailable.address().port;await new Promise(r=>unavailable.close(r));
const offline=new Client(root,'outage',`http://127.0.0.1:${closedPort}`);offline.edit('outage-'+run,'outage','durable');const opId=offline.state.pending[0].opId;await assert.rejects(()=>offline.sync());const recovered=new Client(root,'outage',base);assert.equal(recovered.state.pending[0].opId,opId);await recovered.sync();assert.equal(recovered.state.pending.length,0);record('outage restart and later retry',{stableOperationId:true,pendingPreserved:true});
a.edit(id,'demo','A concurrent',true);await a.sync();await b.sync();assert.equal(b.state.notes[id].deleted,true);record('delete propagation',{tombstonePreserved:true});
// HTTP validation and conflict audit surface are exercised on the running server.
const invalid=await fetch(base+'/sync/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:'a',noteId:'bad'})});assert.equal(invalid.status,400);
const conflicts=await(await fetch(base+'/conflicts?clientId=b')).json();assert(conflicts.some(x=>x.incoming.noteId===id));record('http validation and conflict audit',{invalidRequestStatus:400,conflictRetrievable:true});
const output={run,observedAt:new Date().toISOString(),base,results};fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/rebuild-demo.json',JSON.stringify(output,null,2));
console.log('All '+results.length+' scenarios passed.');
