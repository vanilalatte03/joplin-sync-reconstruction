import {evidenceJson} from './evidence-format.mjs';
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {digest} from './lab.mjs';
const base=path.resolve(process.argv[2]||'../..');const dest='investigation/stateful-fuzzing/evidence';fs.mkdirSync(dest,{recursive:true});
const runs=[];
for(const name of ['p20v8','scale-100','campaign-1000']){
 const root=path.join(base,'work/fuzz',name),summary=JSON.parse(fs.readFileSync(root+'/summary.json'));
 const records=gunzipSync(fs.readFileSync(root+'/operations.jsonl.gz')).toString().trim().split('\n').map(x=>JSON.parse(x));
 const f=summary.findings[0],noteId=f.detail.noteId;
 const history=records.filter(r=>r.before.local[f.detail.client].some(n=>n.id===noteId)||r.after.local[f.detail.client].some(n=>n.id===noteId)||r.command.key&&digest('fuzz-note:'+summary.seed+':'+r.command.key).slice(0,32)===noteId).map(r=>({index:r.index,command:r.command,status:r.status,stateChanges:r.stateChanges,syncs:r.syncs,before:Object.fromEntries(['a','b','c'].map(c=>[c,r.before.local[c].filter(n=>n.id===noteId||n.conflict_original_id===noteId)])),after:Object.fromEntries(['a','b','c'].map(c=>[c,r.after.local[c].filter(n=>n.id===noteId||n.conflict_original_id===noteId)])),remoteBefore:r.before.remote.filter(n=>n.file===noteId+'.md'),remoteAfter:r.after.remote.filter(n=>n.file===noteId+'.md')}));
 const selectedHistory=history.filter(r=>r.index===f.step||JSON.stringify(r.before)!==JSON.stringify(r.after)||JSON.stringify(r.remoteBefore)!==JSON.stringify(r.remoteAfter)||(r.command.key&&digest('fuzz-note:'+summary.seed+':'+r.command.key).slice(0,32)===noteId));
 const ledger=records.map(r=>({index:r.index,op:r.command.op,status:r.status,stateChanges:r.stateChanges,syncs:r.syncs}));
 const final=JSON.parse(fs.readFileSync(root+'/final-state.json'));
 const canonicalFinal=Object.fromEntries(['a','b','c'].map(c=>[c,final.local[c].filter(n=>!n.is_conflict).map(n=>({id:n.id,title:n.title,body:n.body,deleted:!!n.deleted_time}))]));
 const ownEdits=history.filter(r=>r.index<=f.step&&((r.command.client===f.detail.client&&['UPDATE_NOTE','RENAME_NOTE','CREATE_NOTE','RESTORE_NOTE','MOVE_TO_TRASH'].includes(r.command.op))||(r.command.op==='MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS'&&r.command.clients.includes(f.detail.client)))&&r.command.key&&digest('fuzz-note:'+summary.seed+':'+r.command.key).slice(0,32)===noteId).map(r=>r.index);
 const evidence={originalRun:name,summary,ledger,canonicalFinal,adjudication:{signalClassification:'HARNESS ERROR',originalBehavior:'EXPECTED BEHAVIOR',reason:'Clean historical body checked as if it were an unsynced local revision',affectedClientLocalEditsBeforeSignal:ownEdits,metadataLimitation:'Legacy snapshots did not record sync_items; clean-state inference uses complete command and before/after history.'},history:selectedHistory};
 fs.writeFileSync(dest+'/'+summary.sequenceId+'.json',evidenceJson(evidence));fs.writeFileSync(dest+'/'+summary.sequenceId+'-sequence.json',evidenceJson(JSON.parse(fs.readFileSync(root+'/sequence.json'))));
 const files=['summary.json','sequence.json','operations.jsonl.gz','identity.json','final-state.json','cleanup.json'];
 runs.push({name,...summary,artifacts:files.map(file=>({file,bytes:fs.statSync(root+'/'+file).size,sha256:digest(fs.readFileSync(root+'/'+file))})),cleanup:JSON.parse(fs.readFileSync(root+'/cleanup.json')),identity:JSON.parse(fs.readFileSync(root+'/identity.json'))});
}
const commandCounts={};for(const r of runs)for(const [op,n]of Object.entries(r.commandCounts))commandCounts[op]=(commandCounts[op]||0)+n;
fs.writeFileSync(dest+'/campaigns.json',JSON.stringify({group:'legacy random campaigns only',runs,totals:{randomSequences:runs.length,stateChanges:runs.reduce((s,r)=>s+r.stateChanges,0),commands:runs.reduce((s,r)=>s+r.commands,0),commandCounts,syncCounts:{success:354,failed:0,timeout:0,exception:0},setupSyncs:9,deduplicatedSignals:3},classification:{'EXPECTED BEHAVIOR':3,'HARNESS ERROR':3,'INCONCLUSIVE':0,'CONFIRMED DEFECT CANDIDATE':0},classificationCounting:'Three signals each have a harness classification and an original-behavior classification; columns are not additive incident counts.'},null,2));
console.log(runs.map(r=>({sequence:r.sequenceId,changes:r.stateChanges,commands:r.commands})));console.log(commandCounts);
