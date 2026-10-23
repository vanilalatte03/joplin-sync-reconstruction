import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {Run} from './fuzz.mjs';import {replay} from './replay.mjs';import {sleep,digest} from './lab.mjs';
const [baseArg,exe]=process.argv.slice(2);if(!exe)throw Error('Usage: supplement.mjs FUZZ_ROOT JOPLIN_EXE');
const base=path.resolve(baseArg),reduction=path.join(base,'reduction-pilot');
while(!fs.existsSync(reduction+'/result.json')){console.log('Waiting for original reducer to release test ports');await sleep(30000);}
const minimal=JSON.parse(fs.readFileSync(reduction+'/minimal.json'));
await replay({fixture:{...minimal,oracle:'dirty-v2'},root:base+'/minimal-dirty-v2',exe});
const options={root:base+'/controlled-v2',exe,seed:2026102304,sequenceId:'controlled-v2',breakpoints:path.resolve('investigation/conflict-algorithm/evidence/breakpoint-locations.json')};
const run=new Run(options);const observations={};
try{
 await run.open();
 await run.command({op:'CREATE_NOTE',client:'a',key:'clean',title:'FUZZ clean',body:'FUZZ:clean:old'});
 await run.command({op:'SYNC_ALL',order:['a','b','c']});
 await sleep(10);await run.command({op:'UPDATE_NOTE',client:'b',key:'clean',body:'FUZZ:clean:new'});
 await run.command({op:'SYNC',client:'b'});observations.cleanBefore=run.state;
 await run.command({op:'SYNC',client:'a'});observations.cleanAfter=run.state;
 assert.equal(run.find('a','clean').body,'FUZZ:clean:new');assert.equal(run.findings.length,0);
 await sleep(10);await run.command({op:'MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS',key:'clean',clients:['a','b'],bodies:{a:'FUZZ:dirty:a',b:'FUZZ:dirty:b'}});
 await run.command({op:'SYNC',client:'a'});observations.dirtyBefore=run.state;
 // A real conditional breakpoint records the original conflict predicate and stack.
 const c=run.lab.instances.b.cdp,p=run.lab.positions.timestampCandidate;await c.send('Debugger.enable');
 const bp=await c.send('Debugger.setBreakpointByUrl',{urlRegex:'main-html[.]bundle[.]js$',lineNumber:p.lineNumber,columnNumber:p.columnNumber,condition:`D.id===${JSON.stringify(run.id('clean'))}`});
 const offset=c.events.length;const pending=run.command({op:'SYNC',client:'b'});
 let paused;for(let k=0;k<2000;k++){paused=c.events.slice(offset).find(e=>e.method==='Debugger.paused');if(paused)break;await sleep(10);}
 try{assert.ok(paused,'Expected original timestamp predicate breakpoint');const hit=await c.send('Debugger.evaluateOnCallFrame',{callFrameId:paused.params.callFrames[0].callFrameId,expression:'({localId:D.id,localUpdated:D.updated_time,syncTime:D.sync_time,remoteUpdated:B.updated_time,predicate:B.updated_time>D.sync_time})',returnByValue:true});assert.ok(!hit.exceptionDetails);observations.breakpoint={location:p,values:hit.result.value,stack:paused.params.callFrames.map(f=>({functionName:f.functionName,lineNumber:f.location.lineNumber,columnNumber:f.location.columnNumber}))};}
 finally{await c.send('Debugger.removeBreakpoint',{breakpointId:bp.breakpointId});await c.send('Debugger.resume');await c.send('Debugger.disable');}
 await pending;observations.dirtyAfter=run.state;
 assert.ok(run.state.local.b.some(n=>n.is_conflict&&n.body==='FUZZ:dirty:b'));
 await run.command({op:'CREATE_NOTE',client:'a',key:'retry',title:'FUZZ retry',body:'FUZZ:retry:pending'});
 const target=path.resolve(run.lab.root,'target'),held=path.resolve(run.lab.root,'target-held');
 assert.equal(path.dirname(target),run.lab.root);assert.ok(fs.existsSync(path.join(run.lab.root,'LAB_ONLY')));assert.ok(!fs.existsSync(held));assert.ok(fs.statSync(target).isDirectory());
 fs.renameSync(target,held);
 try{fs.writeFileSync(target,'Synthetic filesystem fault: target must be a directory');observations.failedSync=await run.lab.sync('a','FAULT_TARGET_IS_FILE');}
 finally{if(fs.existsSync(target)&&fs.statSync(target).isFile())fs.unlinkSync(target);fs.renameSync(held,target);}
 assert.equal(observations.failedSync.status,'failed','Must observe actual failed sync, not a timeout');
 const raw=fs.readFileSync(run.lab.root+`/sync-logs/${observations.failedSync.id}-a.log`,'utf8');
 observations.failureLog={sha256:digest(raw),errorLines:raw.split('\n').filter(l=>/Fail-safe|error|ENOTDIR|not a directory/i.test(l)).map(l=>l.replaceAll(run.lab.root,'<RUN_ROOT>').replaceAll(run.lab.root.replaceAll('\\','/'),'<RUN_ROOT>')).slice(0,8)};
 await run.command({op:'RETRY_SYNC',client:'a'});assert.equal(run.lab.syncs.at(-1).status,'success');
 await run.command({op:'SYNC_ALL',order:['b','c','a']});assert.ok(run.state.local.b.some(n=>n.body==='FUZZ:retry:pending'));
 await run.settle();observations.final=run.state;
 assert.equal(run.findings.length,0);fs.writeFileSync(run.lab.root+'/observations.json',JSON.stringify(observations,null,2));
}finally{if(run.gz)await run.finish();else if(run.lab)await run.lab.close();}
const campaign=new Run({root:base+'/campaign-v2-1000',exe,seed:2026102305,sequenceId:'campaign-v2-1000',target:1000,breakpoints:options.breakpoints});
try{await campaign.open();await campaign.generate();}finally{if(campaign.gz)await campaign.finish();else if(campaign.lab)await campaign.lab.close();}
console.log('SUPPLEMENT_COMPLETE');
