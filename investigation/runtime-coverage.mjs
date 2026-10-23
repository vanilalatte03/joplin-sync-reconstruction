import {connect} from './cdp.mjs';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {TraceMap,originalPositionFor}=require('../work/tools/node_modules/@jridgewell/trace-mapping/dist/trace-mapping.umd.js');const asar=require('../work/tools/node_modules/@electron/asar/lib/asar.js');
const c=await connect();const root='work/joplin-portable/resources/app.asar';const js=asar.extractFile(root,'main-html.bundle.js').toString();const map=new TraceMap(JSON.parse(asar.extractFile(root,'main-html.bundle.js.map').toString()));const starts=[0];for(let i=0;i<js.length;i++)if(js[i]==='\n')starts.push(i+1);
const token=fs.readFileSync('work/runtime/clipper-token.txt','utf8');const folder=JSON.parse(fs.readFileSync('work/runtime/fixture.json')).folderId;
const note=await(await fetch('http://127.0.0.1:41184/notes?token='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parent_id:folder,title:'REA runtime coverage',body:'coverage-controlled-payload'})})).json();
try{
 await c.send('Profiler.enable');await c.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
 await c.eval('require("@electron/remote").Menu.getApplicationMenu().getMenuItemById("synchronize").click()');
 const logfile='work/runtime/profile-a/log.txt';const began=fs.readFileSync(logfile,'utf8').length;let deadline=Date.now()+15000;
 while(Date.now()<deadline){if(fs.readFileSync(logfile,'utf8').slice(began).includes('Synchronisation finished'))break;await new Promise(r=>setTimeout(r,200));}
 const coverage=await c.send('Profiler.takePreciseCoverage');await c.send('Profiler.stopPreciseCoverage');await c.send('Profiler.disable');
 const bundle=coverage.result.find(s=>s.url.endsWith('/main-html.bundle.js'));if(!bundle)throw Error('No main bundle coverage');
 const functions=[];
 for(const fn of bundle.functions){if(!fn.ranges.some(r=>r.count>0))continue;const offset=fn.ranges[0].startOffset;let lo=0,hi=starts.length-1;while(lo<hi){let mid=Math.ceil((lo+hi)/2);if(starts[mid]<=offset)lo=mid;else hi=mid-1}const original=originalPositionFor(map,{line:lo+1,column:offset-starts[lo]});if(original.source&&/Synchronizer|file-api-driver-local|SyncTargetFilesystem|BaseItem|serialize|syncItems|upload|download/i.test(original.source))functions.push({functionName:fn.functionName,generatedStart:offset,generatedEnd:fn.ranges[0].endOffset,count:fn.ranges[0].count,source:original.source,line:original.line,column:original.column});}
 const result={method:'CDP precise coverage during actual menu-triggered sync; source map attribution',observedAt:new Date().toISOString(),noteId:note.id,functions,limitations:['Coverage proves execution in window, not caller/callee order','Profiler resets counters and can affect timing; not passive observation','Source-map names and locations are shipped metadata; lexical names can be minified']};
 fs.writeFileSync('evidence/runtime-sync-coverage.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close()}
