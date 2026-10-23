import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=path.resolve(process.argv[2]||'../..');
const {Client}=await import(pathToFileURL(path.join(base,'work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(path.join(base,'work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const raw=path.join(base,'work/fuzz/rea-followup');fs.mkdirSync(raw,{recursive:true});
const client=new Client({name:'stateful-fuzzing-followup',version:'1'});
const calls=[];
const sanitize=x=>JSON.parse(JSON.stringify(x).replaceAll(base.replaceAll('\\','/'),'<LAB_BASE>').replaceAll(base.replaceAll('\\','\\\\'),'<LAB_BASE>'));
async function call(name,args,label){const r=await client.callTool({name,arguments:args},undefined,{timeout:180000});fs.writeFileSync(path.join(raw,label+'.json'),JSON.stringify(r,null,2));if(r.isError)throw Error(r.content[0].text);const e=r.structuredContent||JSON.parse(r.content[0].text);calls.push({label,operation:name,evidenceId:e.evidence_id,normalized:e.normalized_result});return e;}
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(base,'work/tools/node_modules/rea-agents/scripts/rea.mjs'),'mcp'],stderr:'pipe'}));
 const e=await call('analyze_javascript_application',{input_path:path.join(base,'work/conflict-static'),source_paths:['BaseItem.probe.js','Synchronizer.probe.js','syncDeleteStep.probe.js'],detail:'summary',analysis_timeout_ms:60000},'analysis');
 const application={kind:'retained-evidence',evidence_id:e.normalized_result.parent_evidence_id};
 for(const name of ['sync_time','force_sync','updated_time'])await call('trace_javascript_semantics',{application,query:{seed:{kind:'property',name},direction:'forward-influence'}},name);
 await call('trace_application_feature',{application,seed:{kind:'module',value:'syncDeleteStep.probe.js',match:'exact'},direction:'outgoing'},'delete-trace');
 await call('export_evidence_bundle',{path:path.join(raw,'evidence-bundle.json'),overwrite:true},'export');
 fs.mkdirSync('investigation/stateful-fuzzing/evidence',{recursive:true});
 const summary=calls.map(({label,operation,evidenceId,normalized:n})=>({label,operation,evidenceId,summary:n?.summary,coverage:n?.coverage,limitations:n?.limitations,status:n?.status,nodeCount:n?.nodes?.length,relationCount:n?.relations?.length}));
 fs.writeFileSync('investigation/stateful-fuzzing/evidence/rea-analysis.json',JSON.stringify(sanitize(summary),null,2));
 console.log(JSON.stringify(summary.map(x=>({label:x.label,relationCount:x.relationCount,summary:x.summary})),null,2));
}finally{await client.close();}
