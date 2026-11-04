import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const parent='http://127.0.0.1:4333',privateHost='http://127.0.0.1:4334';
await mkdir('.cache/isolation-host',{recursive:true});
await writeFile('.cache/isolation-host/index.html',`<!doctype html><html lang="es"><title>Isolation test</title><iframe src="${privateHost}/convert/" title="Private"></iframe></html>`);
const processes=[['4333','.cache/isolation-host'],['4334','build/private']].map(([PORT,SERVE_DIR])=>spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT,SERVE_DIR,PUBLIC_SITE_ORIGIN:parent,PUBLIC_CONVERTER_ORIGIN:privateHost},stdio:'ignore'}));
let browser;
try{
 for(const url of [parent,privateHost]){let ready=false;for(let i=0;i<40;i++){if(await fetch(url).then(r=>r.ok).catch(()=>false)){ready=true;break;}await delay(100);}assert.ok(ready,'server ready');}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext(),page=await context.newPage(),external=[],externalResponses=[],failed=[];
 page.on('requestfailed',request=>failed.push({url:request.url(),reason:request.failure()?.errorText}));
 context.on('response',response=>{if(![parent,privateHost].includes(new URL(response.url()).origin))externalResponses.push(response.url());});
 context.on('request',r=>{if(![parent,privateHost].includes(new URL(r.url()).origin))external.push(r.url());});
 await page.goto(parent);const frame=page.frameLocator('iframe');await frame.locator('#choose').waitFor({timeout:10000});
 assert.equal(await page.evaluate(()=>document.querySelector('iframe').contentDocument),null,'parent cannot read the private document');
 await frame.locator('#pdf').setInputFiles('tests/fixtures/simple.pdf');await frame.locator('#result:not([hidden])').waitFor({timeout:30_000});
 assert.equal(await page.evaluate(()=>{try{return document.querySelector('iframe').contentWindow.document.body.textContent;}catch{return 'denied';}}),'denied');
 const privateFrame=page.frames().find(f=>f.url().startsWith(privateHost));
 assert.equal(external.length,0,'no external document requests');
 const violation=await privateFrame.evaluate(()=>new Promise(resolve=>{
   document.addEventListener('securitypolicyviolation',e=>resolve({directive:e.effectiveDirective,blocked:e.blockedURI}),{once:true});
   const script=document.createElement('script');script.src='https://example.org/advertising-probe.js';document.head.append(script);
 }));
 assert.equal(violation.directive,'script-src-elem');assert.equal(externalResponses.length,0,'no third party response');assert.ok(failed.some(r=>r.url==='https://example.org/advertising-probe.js'&&r.reason==='csp'),'CSP blocked before transmission');
 const response=await fetch(`${privateHost}/engine/ocr-worker.min.js`);assert.match(response.headers.get('content-security-policy'),/'wasm-unsafe-eval'/);assert.doesNotMatch(response.headers.get('content-security-policy'),/googlesyndication/);
 await writeFile('tests/output/security-results.json',JSON.stringify({crossOriginDocumentAccess:'denied',privateConversion:'passed',thirdPartyScript:'blocked by CSP',documentRequestsExternal:0,externalResponses:externalResponses.length,privateWorkerCsp:'wasm only, same origin'},null,2));
 console.log('Cross-origin isolation, private conversion, CSP and local worker policy passed.');
}finally{await browser?.close();processes.forEach(p=>p.kill());}
