import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {connect} from '../../conflict-algorithm/scripts/cdp.mjs';

export const clients=['a','b','c'];
const fields='id,parent_id,title,body,updated_time,user_updated_time,is_conflict,conflict_original_id,deleted_time';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const compact=n=>Object.fromEntries(fields.split(',').filter(k=>k in n).map(k=>[k,n[k]]));

export class Lab {
  constructor({root,exe,breakpoints}){
    this.root=path.resolve(root);this.exe=path.resolve(exe);this.positions=JSON.parse(fs.readFileSync(breakpoints));
    this.instances={};this.syncs=[];this.traces=[];this.nextSync=0;
    if(fs.existsSync(this.root))throw Error('Fresh environment required: refusing to overwrite existing run');
    fs.mkdirSync(this.root,{recursive:true});fs.mkdirSync(this.root+'/target');fs.writeFileSync(this.root+'/LAB_ONLY','Synthetic Joplin fuzz environment');
  }
  file(client,name){return path.join(this.root,client,name)}
  async start(){
    for(const port of [9251,9253,9255,41184,41185,41186])await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error('Required test port occupied: '+port)));s.listen(port,'127.0.0.1',()=>s.close(resolve))});
    for(const [index,client]of clients.entries()){
      const base=this.file(client,'');fs.mkdirSync(base+'/profile',{recursive:true});fs.mkdirSync(base+'/home/.config/joplin-desktop',{recursive:true});
      const token=crypto.randomBytes(64).toString('hex');
      fs.writeFileSync(base+'/profile/settings.json',JSON.stringify({'$schema':'https://joplinapp.org/schema/settings.json','sync.target':2,'sync.2.path':this.root+'/target','sync.interval':0,'locale':'en_GB','clipperServer.autoStart':true,'api.token':token,'autoUpdateEnabled':false}));
      const log=fs.openSync(base+'/electron.log','a');const port=9251+index*2;
      const proc=spawn(this.exe,['--profile',base+'/profile','--user-data-dir='+base+'/chromium','--remote-debugging-port='+port,'--no-welcome'],{stdio:['ignore',log,log],windowsHide:true,env:{...process.env,HOME:base+'/home',USERPROFILE:base+'/home',APPDATA:base+'/appdata',LOCALAPPDATA:base+'/localappdata'}});
      fs.closeSync(log);
      this.instances[client]={proc,port,apiPort:41184+index};
      const until=Date.now()+60000;let c;
      while(Date.now()<until){try{c=await connect(port);break}catch{}await sleep(300)}if(!c)throw Error('Desktop start timeout '+client);
      this.instances[client].cdp=c;
      await c.eval('require("@electron/remote").session.defaultSession.webRequest.onBeforeRequest({urls:["http://*/*","https://*/*"]},(_details,callback)=>callback({cancel:true}));true');
      await this.bootstrap(client);
      let ready=false;for(let i=0;i<100;i++){try{await this.api(client,'GET','ping');ready=true;break}catch{}await sleep(200)}if(!ready)throw Error('Clipper not ready '+client);
    }
    const identity=[];for(const client of clients){const i=this.instances[client];await i.cdp.send('Debugger.enable');const e=i.cdp.events.find(e=>e.method==='Debugger.scriptParsed'&&e.params.url.endsWith('/main-html.bundle.js'));if(!e)throw Error('No bundle');const src=await i.cdp.send('Debugger.getScriptSource',{scriptId:e.params.scriptId});const sha=digest(src.scriptSource);if(sha!=='7123656e59c7d2585d84176a793ab1f4b06c6db4c2981bd7c14d06104aa28a20')throw Error('Unsupported Joplin bundle');identity.push({client,bundleSha256:sha,settings:await i.cdp.eval('({target:__fuzz.Setting.value("sync.target"),interval:__fuzz.Setting.value("sync.interval"),autoUpdate:__fuzz.Setting.value("autoUpdateEnabled"),uploadDelay:__fuzz.reg.syncAsYouTypeInterval()})')});await i.cdp.send('Debugger.disable');i.cdp.events.length=0;}
    fs.writeFileSync(this.root+'/identity.json',JSON.stringify(identity,null,2));
    const folder=await this.api('a','POST','folders',{title:'Synthetic Stateful Fuzz'});this.folder=folder.id;
    for(const c of clients)await this.sync(c,'setup-folder');
    return this;
  }
  async bootstrap(client){
    const c=this.instances[client].cdp;await c.send('Runtime.enable');await c.send('Log.enable');
    let menuReady=false;
    for(let i=0;i<200;i++){try{menuReady=await c.eval('!!require("@electron/remote").Menu.getApplicationMenu()?.getMenuItemById("synchronize")')}catch{}if(menuReady)break;await sleep(100)}
    if(!menuReady){fs.writeFileSync(this.file(client,'startup-events.json'),JSON.stringify(c.events,null,2));fs.writeFileSync(this.file(client,'startup-debug.json'),JSON.stringify(await c.eval('({url:location.href,ready:document.readyState,text:document.body.innerText,resources:performance.getEntriesByType("resource").map(r=>r.name)})'),null,2));throw Error('Original menu did not finish initializing');}
    await sleep(4000);
    for(let k=0;k<200;k++){const logFile=this.file(client,'profile/log.txt');const text=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'';if(text.lastIndexOf('Starting synchronisation')<=text.lastIndexOf('Synchronisation finished'))break;await sleep(100);}
    await c.send('Debugger.enable');const p=this.positions.bootstrap;
    const bp=await c.send('Debugger.setBreakpointByUrl',{urlRegex:'main-html[.]bundle[.]js$',lineNumber:p.lineNumber,columnNumber:p.columnNumber});fs.writeFileSync(this.file(client,'bootstrap-breakpoint.json'),JSON.stringify(bp));const offset=c.events.length;
    let triggerError;const trigger=c.eval('require("@electron/remote").Menu.getApplicationMenu().getMenuItemById("synchronize").click()').catch(e=>{triggerError=e});
    let event;for(let i=0;i<1200;i++){event=c.events.slice(offset).find(e=>e.method==='Debugger.paused');if(event)break;if(triggerError)throw triggerError;await sleep(25)}if(!event)throw Error('Bootstrap breakpoint timeout');
    const r=await c.send('Debugger.evaluateOnCallFrame',{callFrameId:event.params.callFrames[0].callFrameId,expression:'globalThis.__fuzz={Note:ci().default,BaseItem:Ha().default,Setting:Pn().default,reg:lOr.reg};lOr.reg.syncAsYouTypeInterval=()=>86400000;true',returnByValue:true});if(r.exceptionDetails)throw Error('Bootstrap evaluation failed');
    await c.send('Debugger.removeBreakpoint',{breakpointId:bp.breakpointId});await c.send('Debugger.resume');await trigger;await c.send('Debugger.disable');await sleep(200);
  }
  async api(client,method,route,data){
    const s=JSON.parse(fs.readFileSync(this.file(client,'profile/settings.json')));const port=this.instances[client].apiPort;
    const r=await fetch(`http://127.0.0.1:${port}/${route}${route.includes('?')?'&':'?'}token=${s['api.token']}`,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
    const text=await r.text();if(!r.ok)throw Error(`Clipper ${client} ${method} ${route.split('?')[0]} HTTP ${r.status}: ${text.slice(0,500)}`);
    return text.startsWith('{')||text.startsWith('[')?JSON.parse(text):text;
  }
  async notes(client){const notes=[];for(let page=1;;page++){const r=await this.api(client,'GET',`notes?include_conflicts=1&include_deleted=1&limit=100&page=${page}&fields=${fields}`);notes.push(...r.items.map(compact));if(!r.has_more)break;}return notes.sort((a,b)=>a.id.localeCompare(b.id))}
  async snapshot(){const local={},syncMetadata={};for(const c of clients){local[c]=await this.notes(c);syncMetadata[c]=await this.instances[c].cdp.eval('__fuzz.BaseItem.db().selectAll("SELECT item_id,sync_time,force_sync,sync_disabled FROM sync_items WHERE sync_target=2")');}const remote=[];for(const name of fs.readdirSync(this.root+'/target').sort()){if(!/^[a-f0-9]{32}\.md$/.test(name))continue;const text=fs.readFileSync(this.root+'/target/'+name,'utf8');const stat=fs.statSync(this.root+'/target/'+name);remote.push({file:name,sha256:digest(text),bytes:stat.size,mtimeMs:stat.mtimeMs,serialized:text})}return {local,remote,syncMetadata}}
  async sync(client,label='command'){
    const id=++this.nextSync;const start=Date.now();const logfile=this.file(client,'profile/log.txt');const offset=fs.existsSync(logfile)?fs.statSync(logfile).size:0;
    let done=false,error;this.instances[client].cdp.eval('require("@electron/remote").Menu.getApplicationMenu().getMenuItemById("synchronize").click()').then(()=>done=true,e=>{done=true;error=e.message});
    let log='',status='timeout';while(Date.now()-start<45000){log=fs.readFileSync(logfile).subarray(offset).toString();if(error){status='exception';break}if(done&&log.includes('Synchronisation finished')){status=/\[error\]|Fail-safe: Sync was interrupted|There was some errors/.test(log)?'failed':'success';break}await sleep(20)}
    const record={id,client,label,status,elapsedMs:Date.now()-start,...(error?{error}:{})};fs.mkdirSync(this.root+'/sync-logs',{recursive:true});fs.writeFileSync(this.root+`/sync-logs/${id}-${client}.log`,log);this.syncs.push(record);return record;
  }
  async close(){const cleanup=[];for(const [client,i]of Object.entries(this.instances)){try{await i.cdp?.send('Debugger.resume')}catch{}try{await i.cdp?.eval('setTimeout(()=>require("@electron/remote").app.quit(),100);true')}catch{}i.cdp?.close();}for(const [client,i]of Object.entries(this.instances)){for(let k=0;k<100&&i.proc.exitCode===null;k++)await sleep(100);if(i.proc.exitCode===null)i.proc.kill();cleanup.push({client,pid:i.proc.pid,exited:i.proc.exitCode!==null})}fs.writeFileSync(this.root+'/cleanup.json',JSON.stringify(cleanup,null,2));}
}
