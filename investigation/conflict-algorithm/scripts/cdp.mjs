export async function connect(port=9231){
 const ts=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const t=ts.find(t=>t.type==='page'&&t.url.endsWith('/app.asar/index.html'));
 const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let seq=0;const pending=new Map();
 const events=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method)events.push(m);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id,method,params}));});
 return {events,send,close:()=>ws.close(),eval:async expression=>{let r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;}};
}
if(process.argv[1]?.endsWith('cdp.mjs')){const c=await connect(Number(process.argv[2]||9231));try{console.log(JSON.stringify(await c.eval(process.argv[3]||'document.body.innerText'),null,2));}finally{c.close();}}
