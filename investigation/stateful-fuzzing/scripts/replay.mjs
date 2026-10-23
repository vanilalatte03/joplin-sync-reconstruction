import fs from 'node:fs';import path from 'node:path';
import {Run} from './fuzz.mjs';

export async function replay({fixture,root,exe}){
  const run=new Run({root:path.resolve(root),exe,sequenceId:fixture.sequenceId,seed:fixture.seed,oracle:fixture.oracle||'dirty-v2',target:0,breakpoints:path.resolve('investigation/conflict-algorithm/evidence/breakpoint-locations.json')});
  let summary;
  try{await run.open();for(const command of fixture.commands)await run.command(command);if(fixture.settle)await run.settle();}
  catch(e){if(run.lab)fs.writeFileSync(path.join(root,'fatal.json'),JSON.stringify({message:e.message,classification:'INCONCLUSIVE'},null,2));throw e;}
  finally{if(run.gz)summary=await run.finish();else if(run.lab)await run.lab.close();}
  const reproduced=fixture.target?summary.findings.some(f=>f.kind===fixture.target.kind&&(!fixture.target.body||f.detail.body===fixture.target.body)):null;
  const result={reproduced,summary};fs.writeFileSync(path.join(root,'replay-result.json'),JSON.stringify(result,null,2));return result;
}
if(process.argv[1]?.endsWith('replay.mjs')){
  const [file,root,exe]=process.argv.slice(2);if(!exe)throw Error('Usage: replay.mjs FIXTURE_JSON NEW_RUN_ROOT JOPLIN_EXE');
  await replay({fixture:JSON.parse(fs.readFileSync(file)),root,exe});
}
