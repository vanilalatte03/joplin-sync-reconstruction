import fs from 'node:fs';
import path from 'node:path';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {Lab,clients,digest,sleep} from './lab.mjs';
import {needsUpload} from './oracle.mjs';

export function random(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const choose=(r,a)=>a[Math.floor(r()*a.length)];
const semantic=n=>n?{id:n.id,title:n.title,body:n.body,deleted_time:n.deleted_time,is_conflict:n.is_conflict,conflict_original_id:n.conflict_original_id}:null;
const localSignature=s=>digest(Object.fromEntries(clients.map(c=>[c,s.local[c].map(semantic)])));
const canonical=s=>Object.fromEntries(clients.map(c=>[c,s.local[c].filter(n=>!n.is_conflict).map(n=>({id:n.id,title:n.title,body:n.body,deleted:!!n.deleted_time}))]));
export class Run {
  constructor(options){this.options=options;this.r=random(options.seed);this.records=[];this.findings=[];this.mutations=0;this.commandCounts={};this.symbols={};this.nextNote=0;this.step=0;this.ledger=[]}
  id(key){return digest('fuzz-note:'+this.options.seed+':'+key).slice(0,32)}
  key(id){return Object.keys(this.symbols).find(k=>this.symbols[k]===id)}
  async open(){this.lab=new Lab(this.options);await this.lab.start();this.state=await this.lab.snapshot();const file=fs.createWriteStream(this.options.root+'/operations.jsonl.gz');this.gz=createGzip();this.gz.pipe(file);this.file=file;this.startedAt=new Date().toISOString();return this}
  find(c,key){return this.state.local[c].find(n=>n.id===this.id(key))}
  addFinding(kind,detail){const key=kind+':'+(detail.reason||'');if(this.findings.some(f=>f.dedupe===key))return;this.findings.push({id:'F'+(this.findings.length+1),kind,classification:'INCONCLUSIVE',step:this.step,dedupe:key,detail});console.log(JSON.stringify({finding:kind,step:this.step,detail}));}
  async command(cmd){
    const before=this.state,start=Date.now();const syncStart=this.lab.syncs.length;let status='success',error,changes=0;
    const one=async(c,fn)=>{const old=this.state.local[c].find(n=>n.id===this.id(cmd.key));await fn();const after=await this.lab.notes(c);const next=after.find(n=>n.id===this.id(cmd.key));if(JSON.stringify(semantic(old))!==JSON.stringify(semantic(next)))changes++;this.state={...this.state,local:{...this.state.local,[c]:after}}};
    try{
      if(cmd.op==='CREATE_NOTE'){this.symbols[cmd.key]=this.id(cmd.key);await one(cmd.client,()=>this.lab.api(cmd.client,'POST','notes',{id:this.id(cmd.key),parent_id:this.lab.folder,title:cmd.title,body:cmd.body}));}
      else if(['UPDATE_NOTE','RENAME_NOTE','MOVE_TO_TRASH','RESTORE_NOTE','DELETE_PERMANENTLY'].includes(cmd.op)){
        const n=this.find(cmd.client,cmd.key);if(!n){status='precondition-unavailable';}
        else if(cmd.op==='UPDATE_NOTE')await one(cmd.client,()=>this.lab.api(cmd.client,'PUT','notes/'+n.id,{body:cmd.body}));
        else if(cmd.op==='RENAME_NOTE')await one(cmd.client,()=>this.lab.api(cmd.client,'PUT','notes/'+n.id,{title:cmd.title}));
        else if(cmd.op==='MOVE_TO_TRASH'){if(n.deleted_time)status='precondition-unavailable';else await one(cmd.client,()=>this.lab.api(cmd.client,'DELETE','notes/'+n.id));}
        else if(cmd.op==='RESTORE_NOTE'){if(!n.deleted_time)status='precondition-unavailable';else await one(cmd.client,()=>this.lab.api(cmd.client,'PUT','notes/'+n.id,{deleted_time:0,parent_id:this.lab.folder}));}
        else await one(cmd.client,()=>this.lab.api(cmd.client,'DELETE','notes/'+n.id+'?permanent=1'));
      }
      else if(cmd.op==='MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS'){for(const c of cmd.clients){if(!this.find(c,cmd.key))continue;await one(c,()=>this.lab.api(c,'PUT','notes/'+this.id(cmd.key),{body:cmd.bodies[c]}));}}
      else if(cmd.op==='SYNC'||cmd.op==='RETRY_SYNC')await this.lab.sync(cmd.client,cmd.op);
      else if(cmd.op==='SYNC_ALL')for(const c of cmd.order)await this.lab.sync(c,cmd.op);
      else throw Error('Unknown command '+cmd.op);
    }catch(e){status='exception';error=e.message.replaceAll(this.lab.root,'<RUN_ROOT>');this.addFinding('operation-exception',{reason:cmd.op,error});}
    this.state=await this.lab.snapshot();const syncs=this.lab.syncs.slice(syncStart);if(syncs.some(s=>s.status!=='success'))this.addFinding('sync-error',{reason:syncs.find(s=>s.status!=='success').status,syncs});
    this.step++;this.mutations+=changes;this.commandCounts[cmd.op]=(this.commandCounts[cmd.op]||0)+1;
    const record={sequenceId:this.options.sequenceId,seed:this.options.seed,index:this.step,command:cmd,status,...(error?{error}:{}),stateChanges:changes,elapsedMs:Date.now()-start,before,after:this.state,syncs};
    if(!this.gz.write(JSON.stringify(record)+'\n'))await once(this.gz,'drain');this.records.push({index:this.step,command:cmd,status,stateChanges:changes,elapsedMs:record.elapsedMs,syncs});
    if(syncs.length)this.checkPreservation(before,this.state,cmd);
    if(this.step%25===0){this.checkpoint();console.log(JSON.stringify({sequence:this.options.sequenceId,steps:this.step,mutations:this.mutations,syncs:this.lab.syncs.length,findings:this.findings.length}));}
    if(this.step>6000)throw Error('Operation budget reached');
    return record;
  }
  checkPreservation(before,after,command){
    // A disappearance is a signal, not a universal preservation assertion: permanent deletion is a known exception.
    for(const c of clients)for(const n of before.local[c]){
      if(n.is_conflict||n.deleted_time||!n.body.includes('FUZZ:'))continue;
      if(this.options.oracle!=='legacy-v1'){
        if(!before.syncMetadata?.[c])throw Error('dirty-v2 oracle requires sync metadata');
        if(!needsUpload(n,before.syncMetadata[c]))continue;
      }
      const changed=after.local[c].find(x=>x.id===n.id);if(changed?.body===n.body)continue;
      const sameAnywhere=clients.some(k=>after.local[k].some(x=>x.body===n.body));if(sameAnywhere)continue;
      const remoteHad=before.remote.some(x=>x.serialized.includes(n.body));
      if(!remoteHad&&command.op!=='DELETE_PERMANENTLY')this.addFinding('unrepresented-local-revision',{reason:'body absent from all live/trash/conflict API results',client:c,noteId:n.id,body:n.body,command,oracle:this.options.oracle||'dirty-v2',syncMetadata:before.syncMetadata?.[c]?.find(x=>x.item_id===n.id),localUpdatedTime:n.updated_time});
    }
  }
  checkpoint(){fs.writeFileSync(this.options.root+'/checkpoint.json',JSON.stringify({sequenceId:this.options.sequenceId,seed:this.options.seed,step:this.step,mutations:this.mutations,commands:this.records,findings:this.findings,state:this.state},null,2));}
  next(){
    const r=this.r,c=choose(r,clients),notes=this.state.local[c].filter(n=>!n.is_conflict&&this.key(n.id));const live=notes.filter(n=>!n.deleted_time),trash=notes.filter(n=>n.deleted_time);const roll=r();
    if(!notes.length||roll<0.16){const key='n'+(++this.nextNote);return {op:'CREATE_NOTE',client:c,key,title:'FUZZ title '+key,body:`FUZZ:${this.options.sequenceId}:${key}:create`};}
    const n=choose(r,notes),key=this.key(n.id),tag=`FUZZ:${this.options.sequenceId}:${this.step}:${Math.floor(r()*1e8)}`;
    if(roll<0.46)return {op:'UPDATE_NOTE',client:c,key,body:tag+' body\n'+choose(r,['한글','line\nline','😀','same pattern',''])};
    if(roll<0.62)return {op:'RENAME_NOTE',client:c,key,title:tag+' title'};
    if(roll<0.73&&live.length)return {op:'MOVE_TO_TRASH',client:c,key:this.key(choose(r,live).id)};
    if(roll<0.83&&trash.length)return {op:'RESTORE_NOTE',client:c,key:this.key(choose(r,trash).id)};
    if(roll<0.9)return {op:'DELETE_PERMANENTLY',client:c,key};
    const shared=notes.filter(n=>clients.filter(k=>this.state.local[k].some(x=>x.id===n.id&&!x.is_conflict)).length>1);
    if(shared.length){const s=choose(r,shared),k=this.key(s.id);const cs=clients.filter(c=>this.find(c,k));const same=r()<0.25;return {op:'MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS',key:k,clients:cs,bodies:Object.fromEntries(cs.map(c=>[c,tag+(same?':identical':':'+c)]))};}
    return {op:'UPDATE_NOTE',client:c,key,body:tag};
  }
  async settle(){
    for(let i=0;i<3;i++)await this.command({op:'SYNC_ALL',order:['a','b','c'],purpose:'settle-'+i});
    const before=this.state;await this.command({op:'SYNC_ALL',order:['c','b','a'],purpose:'stability'});
    if(localSignature(before)!==localSignature(this.state))this.addFinding('quiescence-instability',{reason:'state changed after three full successful rounds',beforeSignature:localSignature(before),afterSignature:localSignature(this.state)});
    const values=Object.values(canonical(this.state)).map(x=>JSON.stringify(x));if(new Set(values).size>1)this.addFinding('canonical-divergence',{reason:'canonical fields differ after settling',canonical:canonical(this.state)});
    fs.writeFileSync(this.options.root+'/final-state.json',JSON.stringify(this.state,null,2));
  }
  async generate(){
    while(this.mutations<this.options.target){await this.command(this.next());if(this.step%7===0)await this.command({op:choose(this.r,['SYNC','RETRY_SYNC']),client:choose(this.r,clients)});if(this.step%19===0)await this.command({op:'SYNC_ALL',order:[...clients].sort(()=>this.r()-0.5)});}
    await this.settle();
  }
  async finish(){this.checkpoint();this.gz.end();await once(this.file,'close');await this.lab.close();const summary={sequenceId:this.options.sequenceId,seed:this.options.seed,joplinVersion:'3.7.21',reaVersion:'6.7.0',oracle:this.options.oracle||'dirty-v2',startedAt:this.startedAt,finishedAt:new Date().toISOString(),stateChanges:this.mutations,commands:this.step,commandCounts:this.commandCounts,syncCounts:{success:this.lab.syncs.filter(s=>s.status==='success').length,failed:this.lab.syncs.filter(s=>s.status==='failed').length,timeout:this.lab.syncs.filter(s=>s.status==='timeout').length,exception:this.lab.syncs.filter(s=>s.status==='exception').length},setupSyncs:3,findings:this.findings,elapsedMs:Date.now()-Date.parse(this.startedAt)};fs.writeFileSync(this.options.root+'/summary.json',JSON.stringify(summary,null,2));fs.writeFileSync(this.options.root+'/sequence.json',JSON.stringify({sequenceId:this.options.sequenceId,seed:this.options.seed,commands:this.records.map(r=>r.command)},null,2));console.log(JSON.stringify(summary));return summary}
}

if(process.argv[1]?.endsWith('fuzz.mjs')){
  const [root,exe,sequenceId,seed,target]=process.argv.slice(2);if(!target)throw Error('Usage: fuzz.mjs NEW_RUN_ROOT JOPLIN_EXE SEQUENCE_ID SEED MUTATION_TARGET');
  const run=new Run({root:path.resolve(root),exe,sequenceId,seed:Number(seed),target:Number(target),breakpoints:path.resolve('investigation/conflict-algorithm/evidence/breakpoint-locations.json')});
  try{await run.open();await run.generate();}catch(e){if(run.lab&&fs.existsSync(run.options.root))fs.writeFileSync(run.options.root+'/fatal.json',JSON.stringify({classification:'HARNESS ERROR pending investigation',message:e.message,step:run.step},null,2));throw e;}finally{if(run.gz)await run.finish();else if(run.lab)await run.lab.close()}
}
