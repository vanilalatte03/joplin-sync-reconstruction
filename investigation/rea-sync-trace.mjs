import {Client} from '../work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import fs from 'node:fs';import path from 'node:path';
const dir=path.resolve('evidence');const client=new Client({name:'joplin-sync-trace',version:'1'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('work/tools/node_modules/rea-agents/scripts/rea.mjs'),'mcp'],stderr:'pipe'}));
const call=async(name,args,file)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});fs.writeFileSync(path.join(dir,file),JSON.stringify(r,null,2));console.log(name+' error='+!!r.isError);if(r.isError)throw Error(r.content[0].text);return r.structuredContent||JSON.parse(r.content[0].text)};
try{
const summary=await call('analyze_javascript_application',{input_path:path.resolve('work/static-probes'),detail:'summary',analysis_timeout_ms:30000},'rea-sync-summary.json');
const parent=summary.normalized_result.parent_evidence_id;
await call('trace_application_feature',{application:{kind:'retained-evidence',evidence_id:parent},seed:{kind:'module',value:'Synchronizer.probe.js',match:'exact'},direction:'outgoing'},'rea-sync-trace.json');
await call('trace_javascript_semantics',{application:{kind:'retained-evidence',evidence_id:parent},query:{seed:{kind:'property',name:'unserialize'},direction:'callers'}},'rea-unserialize-callers.json');
const targets=await call('list_javascript_runtime_targets',{inspector_endpoint:'http://127.0.0.1:9231'},'rea-runtime-targets.json');
const target=targets.normalized_result.targets.find(t=>t.location?.file_path?.endsWith('index.html'));
if(target)await call('observe_javascript_runtime',{inspector_endpoint:'http://127.0.0.1:9231',target_id:target.target_id,runtime_kind:'electron-renderer',observation_ms:250},'rea-runtime-observation.json');
await call('export_evidence_bundle',{path:path.join(dir,'rea-sync-bundle.json'),overwrite:true},'rea-sync-export.json');
}finally{await client.close()}
