import {connect} from './cdp.mjs';import fs from 'node:fs';import path from 'node:path';
const c=await connect(9233);const wait=()=>new Promise(r=>setTimeout(r,300));
try{
await c.eval('require("@electron/remote").Menu.getApplicationMenu().items.flatMap(x=>x.submenu?.items||[]).find(x=>x.label==="옵션").click()');await wait();
await c.eval('document.getElementById("setting-tab-sync").click()');await wait();
await c.eval('(()=>{const s=[...document.querySelectorAll("select")].find(e=>e.getBoundingClientRect().width&&e.innerText.includes("파일 시스템"));s.value="2";s.dispatchEvent(new Event("change",{bubbles:true}));})()');await wait();
await c.eval(`(()=>{const i=[...document.querySelectorAll("input")].find(e=>e.getBoundingClientRect().width&&e.type==="text");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,${JSON.stringify(path.resolve('work/runtime/sync-target'))});i.dispatchEvent(new Event("input",{bubbles:true}));const s=[...document.querySelectorAll("select")].find(e=>e.getBoundingClientRect().width&&e.innerText.includes("5 minute"));s.value="0";s.dispatchEvent(new Event("change",{bubbles:true}));})()`);await wait();
await c.eval('[...document.querySelectorAll("button")].find(e=>e.getBoundingClientRect().width&&e.innerText==="확인").click()');await wait();
await c.eval('require("@electron/remote").Menu.getApplicationMenu().items.flatMap(x=>x.submenu?.items||[]).find(x=>x.label==="옵션").click()');await wait();
await c.eval('document.getElementById("setting-tab-server").click()');await wait();
const token=await c.eval('document.body.innerText.match(/[a-f0-9]{128}/)?.[0]');if(!token)throw Error('Missing test token');fs.writeFileSync('work/runtime-b/clipper-token.txt',token);
await c.eval('[...document.querySelectorAll("button")].find(e=>e.innerText==="웹 수집기 서비스 사용")?.click()');await wait();
await c.eval('[...document.querySelectorAll("button")].find(e=>e.innerText==="뒤로 가기")?.click()');
console.log('B configured with isolated profile and common lab filesystem target.');
}finally{c.close()}
