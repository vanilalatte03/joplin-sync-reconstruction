import {Client} from '../work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../work/tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import fs from 'node:fs';import path from 'node:path';
const evidence=path.resolve('evidence');fs.mkdirSync(evidence,{recursive:true});
const client=new Client({name:'joplin-lab',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('work/tools/node_modules/rea-agents/scripts/rea.mjs'),'mcp'],stderr:'pipe'}));
const call=async(name,args,file)=>{console.log('Calling '+name);const r=await client.callTool({name,arguments:args},undefined,{timeout:600000});fs.writeFileSync(path.join(evidence,file),JSON.stringify(r,null,2));console.log('Saved '+file+' error='+!!r.isError);return r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);};
try{
 const targets=await call('list_electron_targets',{cdp_endpoint:'http://127.0.0.1:9231'},'rea-targets.json');
 const t=targets.normalized_result?.targets?.find(t=>t.file_path.endsWith('index.html')&&!t.file_path.includes('plugins'));if(t)await call('inspect_electron_page',{cdp_endpoint:'http://127.0.0.1:9231',target_id:t.target_id,observation_ms:100},'rea-page.json');
 await call('analyze_javascript_application',{input_path:path.resolve('work/joplin-portable/resources/app.asar'),source_paths:['package.json','gui/note-viewer/preload.js','utils/window/eventHandlerOverrides.js'],detail:'summary',max_heap_mb:1024,analysis_timeout_ms:30000},'rea-static-focused.json');
 await call('export_evidence_bundle',{path:path.join(evidence,'rea-bundle.json'),overwrite:true},'rea-export.json');
}finally{await client.close();}
