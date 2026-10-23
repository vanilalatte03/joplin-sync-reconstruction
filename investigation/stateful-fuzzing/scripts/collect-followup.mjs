import {evidenceJson} from './evidence-format.mjs';
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {digest} from './lab.mjs';
const base=path.resolve(process.argv[2]||'../../work/fuzz');const dest='investigation/stateful-fuzzing/evidence';
const load=file=>JSON.parse(fs.readFileSync(file));
function run(root){const summary=load(root+'/summary.json'),sequence=load(root+'/sequence.json'),cleanup=load(root+'/cleanup.json');const records=gunzipSync(fs.readFileSync(root+'/operations.jsonl.gz')).toString().trim().split('\n').map(x=>JSON.parse(x));return {summary,sequence,cleanup,ledger:records.map(r=>({index:r.index,op:r.command.op,status:r.status,stateChanges:r.stateChanges,syncs:r.syncs})),artifactHashes:['summary.json','sequence.json','operations.jsonl.gz','cleanup.json'].map(file=>({file,sha256:digest(fs.readFileSync(root+'/'+file))})),...(fs.existsSync(root+'/final-state.json')?{canonicalFinal:Object.fromEntries(Object.entries(load(root+'/final-state.json').local).map(([c,notes])=>[c,notes.filter(n=>!n.is_conflict).map(n=>({id:n.id,title:n.title,body:n.body,deleted:!!n.deleted_time}))]))}:{})};}
const reduction=base+'/reduction-pilot';const trials=load(reduction+'/trials.json').map(t=>({...t,run:run(reduction+'/trial-'+String(t.trial).padStart(3,'0'))}));
const minimal={...load(reduction+'/minimal.json'),oracle:'legacy-v1'};
fs.writeFileSync(dest+'/minimal.json',evidenceJson(minimal));
fs.writeFileSync(dest+'/reduction.json',evidenceJson({result:load(reduction+'/result.json'),trials}));
const followup={dirtyReplay:run(base+'/minimal-dirty-v2'),controlled:{...run(base+'/controlled-v2'),observations:load(base+'/controlled-v2/observations.json')},randomImproved:run(base+'/campaign-v2-1000')};
const faultRoot=base+'/controlled-v2';const failureLog=fs.readFileSync(faultRoot+'/sync-logs/'+followup.controlled.observations.failedSync.id+'-a.log','utf8');
followup.controlled.observations.failureLog.errorLines=failureLog.split('\n').filter(l=>/Fail-safe|error|ENOTDIR|not a directory/i.test(l)).map(l=>l.replaceAll(faultRoot,'<RUN_ROOT>').replaceAll(faultRoot.replaceAll('\\','/'),'<RUN_ROOT>'));
fs.writeFileSync(dest+'/followup.json',evidenceJson(followup));
fs.writeFileSync(dest+'/campaign-v2-1000-sequence.json',evidenceJson(followup.randomImproved.sequence));
const legacy=load(dest+'/campaigns.json');
const groups={randomLegacy:legacy.runs.map(r=>({summary:r})),reductionSearch:trials.filter(t=>!t.phase.startsWith('repeat-')).map(t=>t.run),reductionRepeats:trials.filter(t=>t.phase.startsWith('repeat-')).map(t=>t.run),dirtyReplay:[followup.dirtyReplay],controlled:[followup.controlled],randomImproved:[followup.randomImproved]};
function sum(runs){const out={sequences:runs.length,stateChanges:0,commands:0,setupSyncs:0,syncCounts:{success:0,failed:0,timeout:0,exception:0},commandCounts:{}};for(const {summary:s}of runs){out.stateChanges+=s.stateChanges;out.commands+=s.commands;out.setupSyncs+=s.setupSyncs;for(const k of Object.keys(out.syncCounts))out.syncCounts[k]+=s.syncCounts[k];for(const [k,n]of Object.entries(s.commandCounts))out.commandCounts[k]=(out.commandCounts[k]||0)+n;}return out;}
const totals={groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,sum(v)])),allCompleted:sum(Object.values(groups).flat()),notes:['Startup and instrumentation syncs excluded; folder setup syncs included.','Random sequences, deletion trials and repeats count separately.','The controlled failed sync was deliberately injected and issued outside the command ledger.','Early startup failures are excluded from completed-sequence counts.']};
fs.writeFileSync(dest+'/execution-totals.json',JSON.stringify(totals,null,2));
console.log(JSON.stringify(totals,null,2));
