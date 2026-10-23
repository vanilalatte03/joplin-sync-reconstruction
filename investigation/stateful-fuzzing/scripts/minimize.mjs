import fs from 'node:fs';import path from 'node:path';
import {replay} from './replay.mjs';
const [input,root,exe]=process.argv.slice(2);if(!exe)throw Error('Usage: minimize.mjs FIXTURE_JSON NEW_OUTPUT_ROOT JOPLIN_EXE');
if(fs.existsSync(root))throw Error('Refusing existing reduction directory');fs.mkdirSync(root,{recursive:true});
let fixture=JSON.parse(fs.readFileSync(input));let current=fixture.commands;const trials=[];let counter=0;
async function test(commands,phase){const trial=++counter;const dir=path.join(root,'trial-'+String(trial).padStart(3,'0'));let reproduced=false,error;try{reproduced=(await replay({fixture:{...fixture,commands},root:dir,exe})).reproduced;}catch(e){error=e.message;}const result={trial,phase,length:commands.length,reproduced,error};trials.push(result);fs.writeFileSync(path.join(root,'trials.json'),JSON.stringify(trials,null,2));console.log(JSON.stringify(result));return reproduced;}
if(!await test(current,'baseline'))throw Error('Baseline does not reproduce; evidence retained');
let n=2;
while(current.length>=2){let reduced=false;const size=Math.ceil(current.length/n);for(let start=0;start<current.length;start+=size){const candidate=current.filter((_,i)=>i<start||i>=start+size);if(!candidate.length)continue;if(await test(candidate,'ddmin')){current=candidate;n=Math.max(2,n-1);reduced=true;break;}}if(reduced)continue;if(n>=current.length)break;n=Math.min(current.length,n*2);}
const minimal={...fixture,commands:current};fs.writeFileSync(path.join(root,'minimal.json'),JSON.stringify(minimal,null,2));
const repeats=[];for(let i=0;i<3;i++)repeats.push(await test(current,'repeat-'+(i+1)));
fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({originalLength:fixture.commands.length,minimizedLength:current.length,trials:trials.length,repeats,successes:repeats.filter(Boolean).length,failures:repeats.filter(x=>!x).length,minimality:'1-minimal under command deletion for this predicate and ordered fixture; not global shortest proof'},null,2));
