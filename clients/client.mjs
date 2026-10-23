import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';

export class Client {
 constructor(root,id,base='http://127.0.0.1:8087') {
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid client ID');
  this.id=id;this.base=base;this.file=path.join(root,id+'.json');fs.mkdirSync(root,{recursive:true});
  this.state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{cursor:0,notes:{},pending:[],conflicts:[]};
  this.state.notes=Object.assign(Object.create(null),this.state.notes);
 }
 save(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state,null,2));fs.renameSync(tmp,this.file);}
 edit(id,title,body,deleted=false){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||title.length>1000||body.length>100000)throw Error('Invalid note or payload too large');
  const existing=this.state.pending.find(p=>p.noteId===id);
  if(existing?.attempted)throw Error('Retry this note sync before editing an operation whose outcome is unknown');
  const old=this.state.notes[id];
  const mutation={opId:existing?.opId||randomUUID(),clientId:this.id,noteId:id,baseVersion:existing?.baseVersion??old?.version??0,title,body,deleted};
  if(existing)this.state.pending[this.state.pending.indexOf(existing)]=mutation;else this.state.pending.push(mutation);
  this.state.notes[id]={id,title,body,deleted,version:mutation.baseVersion};this.save();return mutation;
 }
 async request(route,options={}){
  let error;
  for(let attempt=0;attempt<3;attempt++){
   try{const r=await fetch(this.base+route,{...options,signal:AbortSignal.timeout(3000)});if(r.status>=500)throw Error('Transient HTTP '+r.status);return {status:r.status,data:await r.json()};}
   catch(e){error=e;if(attempt<2)await new Promise(r=>setTimeout(r,100*2**attempt));}
  }
  throw error;
 }
 async sync(){
  while(this.state.pending.length){
   const entry=this.state.pending[0];entry.attempted=true;this.save();
   const {attempted,...mutation}=entry;
   const r=await this.request('/sync/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mutation)});
   if(r.status!==200&&r.status!==409)throw Error('Rejected operation: '+JSON.stringify(r.data));
   if(r.status===409)this.state.conflicts.push({mutation,server:r.data});
   if(r.data.note)this.state.notes[entry.noteId]=r.data.note;
   else delete this.state.notes[entry.noteId];
   this.state.pending.shift();this.save();
  }
  const r=await this.request('/sync/pull?after='+this.state.cursor);
  if(r.status!==200)throw Error('Pull failed: '+JSON.stringify(r.data));
  for(const change of r.data.changes)this.state.notes[change.note.id]=change.note;
  this.state.cursor=r.data.cursor;this.save();return this.state;
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [id,command,noteId,title,body]=process.argv.slice(2);
 if(!id||!command)throw Error('Usage: node clients/client.mjs <a|b> <put|delete|sync|show> [noteId title body]');
 const client=new Client(path.resolve('work/clients'),id,process.env.SYNC_URL||'http://127.0.0.1:8087');
 if(command==='put')client.edit(noteId,title||'',body||'');
 else if(command==='delete'){const note=client.state.notes[noteId];if(!note)throw Error('Unknown local note');client.edit(noteId,note.title,note.body,true);}
 else if(command==='sync')await client.sync();
 else if(command!=='show')throw Error('Unknown command');
 console.log(JSON.stringify(client.state,null,2));
}
