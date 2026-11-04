import { chromium, firefox } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import JSZip from 'jszip';
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const engine=process.env.BROWSER==='firefox'?firefox:chromium;
const browser=await engine.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
await mkdir('tests/output',{recursive:true});
const results=[],requests=[],errors=[];
const context=await browser.newContext({acceptDownloads:true,locale:'es-MX'});
context.on('request',r=>requests.push({url:r.url(),method:r.method(),post:r.postData()}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await page.locator('iframe').waitFor();
 await page.locator('.hero.is-drawing').waitFor();
 await page.waitForTimeout(1100);
 const ink=await page.locator('.pen-stroke').evaluateAll(paths=>paths.map(path=>parseFloat(getComputedStyle(path).strokeDashoffset)));
 assert.ok(ink.some(offset=>offset===0)&&ink.some(offset=>offset>0),'title is being drawn in stroke order');
 await page.screenshot({path:'tests/output/title-writing.png',fullPage:true});
 await page.waitForTimeout(4600);await page.screenshot({path:'tests/output/subtitle-uncrumpling.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.screenshot({path:'tests/output/desktop.png',fullPage:true});
 assert.equal(await page.locator('h1 .sr-only').innerText(),'Un PDF. Tres movimientos.');
 assert.equal(await page.locator('script[src*="googlesyndication"]').count(),0);
 assert.equal(await page.locator('script:not([src])').count(),0,'CSP requires external entry scripts');
 assert.equal(await page.locator('.hero-doodle,.eyebrow,.preview-panel,.guide,.faq').count(),0,'approved minimalist UI has no extra panels');
 const initialFrame=page.frameLocator('iframe');
 await initialFrame.locator('#options summary').click();await page.locator('iframe[data-layout="options"]').waitFor();
 await initialFrame.locator('#pdf').setInputFiles('tests/fixtures/fake.pdf');await initialFrame.locator('#error:not([hidden])').waitFor();
 const optionHeight=await page.locator('iframe').evaluate(el=>el.clientHeight),optionErrorBottom=await initialFrame.locator('#error').evaluate(el=>el.getBoundingClientRect().bottom);
 assert.ok(optionErrorBottom<=optionHeight,'expanded options and errors must both fit');
 await initialFrame.locator('#options summary').click();await page.locator('iframe[data-layout="error"]').waitFor();
 const successes=['simple','columns','table','formula','image','scan','partial-scan','mixed','links','unicode','long'];
 for(const name of successes){
  await page.goto(`${base}/convert/`);await page.locator('#options summary').click();await page.locator('#language').selectOption('es');const start=performance.now();
  await page.locator('#pdf').setInputFiles(`tests/fixtures/${name}.pdf`);
  await page.waitForFunction(()=>!document.getElementById('result').hidden||!document.getElementById('error').hidden,{},{timeout:120_000});
  const error=await page.locator('#error').isVisible()?await page.locator('#error').innerText():null;
  if(error){results.push({name,status:'failed',error});console.log(`${name}: FAILED ${error}`);continue;}
  assert.equal(await page.locator('#processing').isVisible(),false);assert.equal(await page.locator('#playful').innerText(),'');
  let download=page.waitForEvent('download');await page.locator('#download').click();await (await download).saveAs(`tests/output/${name}.epub`);
  await page.locator('.report-details summary').click();download=page.waitForEvent('download');await page.locator('#download-report').click();await (await download).saveAs(`tests/output/${name}-report.json`);
  const report=JSON.parse(await readFile(`tests/output/${name}-report.json`,'utf8'));
  const zip=await JSZip.loadAsync(await readFile(`tests/output/${name}.epub`));
  const coverMatches=await page.locator('#thumbnail').evaluate(async(image,base64)=>{
   await image.decode();const expected=new Image();expected.src='data:image/png;base64,'+base64;await expected.decode();
   const pixels=source=>{const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;canvas.getContext('2d').drawImage(source,0,0);return canvas.toDataURL();};
   return pixels(image)===pixels(expected);
  },await zip.file('EPUB/cover.png').async('base64'));
  assert.equal(coverMatches,true,'preview is the actual EPUB cover');
  const pages=Object.keys(zip.files).filter(n=>/^EPUB\/p\d+\.xhtml$/.test(n));let html='';for(const file of pages)html+=await zip.file(file).async('string');
  assert.match(await zip.file('EPUB/package.opf').async('string'),/reflowable/);assert.doesNotMatch(html,/<script|position:absolute|<meta name="viewport"/);
  for(const row of report.coverage)assert.equal(row.sourceRuns,row.representedRuns);
  if(name==='columns')assert.ok(html.indexOf('IZQUIERDA 7')<html.indexOf('DERECHA 1'),'column reading order');
  if(name==='table')assert.match(html,/<table>/,'semantic table');
  if(name==='formula')assert.match(html,/Fórmula conservada como imagen/);
  if(name==='image'){assert.match(html,/<figure>/);assert.match(html,/<figcaption>Figura 1/);}
  if(['scan','partial-scan','mixed'].includes(name))assert.equal(report.ocrPages,1);
  if(name==='partial-scan'){assert.match(html,/Archivo parcial/);assert.equal((html.match(/Archivo parcial/g)||[]).length,1);}
  if(name==='links'){assert.match(html,/https:\/\/example.org\/referencia/);assert.match(html,/href="p2.xhtml"/);assert.doesNotMatch(html,/javascript:/);}
  if(name==='unicode'){assert.match(html,/pingüino/);assert.match(html,/Καλημέρα/);assert.match(html,/Привет/);}
  if(name==='long')assert.equal(pages.length,40);
  results.push({name,status:'passed',ms:Math.round(performance.now()-start),pages:report.pages,warnings:report.warnings.length});console.log(`${name}: passed (${results.at(-1).ms} ms)`);
 }
 for(const name of ['encrypted','restricted','damaged','empty','fake','too-many','blank','rotated']){
  await page.goto(`${base}/convert/`);await page.locator('#pdf').setInputFiles(`tests/fixtures/${name}.pdf`);
  await page.locator('#error:not([hidden])').waitFor({timeout:60_000});assert.equal(await page.locator('#download').getAttribute('href'),null);
  results.push({name,status:'rejected',message:await page.locator('#error').innerText()});console.log(`${name}: rejected`);
 }
 // Cancellation must recover for a subsequent job, with no stale link.
 await page.goto(`${base}/convert/`);await page.locator('#pdf').setInputFiles('tests/fixtures/scan.pdf');await page.locator('#cancel').click();await page.locator('#error:not([hidden])').waitFor();assert.match(await page.locator('#error').innerText(),/cancelada/);assert.equal(await page.locator('#download').getAttribute('href'),null);await page.locator('#pdf').setInputFiles('tests/fixtures/simple.pdf');await page.locator('#result:not([hidden])').waitFor({timeout:30_000});results.push({name:'cancel-retry',status:'passed'});
 await page.locator('#another').click();assert.equal(await page.locator('#download').getAttribute('href'),null);assert.equal(await page.locator('#thumbnail').getAttribute('src'),null);
 // Cancel an OCR worker during model loading (not just before it starts).
 let releaseModel;const held=new Promise(resolve=>releaseModel=resolve);
 await page.route('**/ocr/spa.traineddata.gz',async route=>{await held;await route.abort().catch(()=>{});});
 await page.goto(`${base}/convert/`);const modelRequest=page.waitForRequest('**/ocr/spa.traineddata.gz');await page.locator('#pdf').setInputFiles('tests/fixtures/scan.pdf');await modelRequest;
 await page.locator('#cancel').click();await page.locator('#error:not([hidden])').waitFor({timeout:5000});assert.match(await page.locator('#error').innerText(),/cancelada/);releaseModel();await page.unroute('**/ocr/spa.traineddata.gz');results.push({name:'cancel-ocr-initialization',status:'passed'});
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.screenshot({path:'tests/output/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(engine.name()==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const frame=page.frameLocator('iframe'),mobileStart=performance.now();await frame.locator('#pdf').setInputFiles('tests/fixtures/simple.pdf');await frame.locator('#result:not([hidden])').waitFor({timeout:30_000});
 await page.locator('iframe[data-layout="result"]').waitFor({timeout:5000});
 assert.equal(await frame.locator('#download').isVisible(),true);
 const frameHeight=await page.locator('iframe').evaluate(el=>el.clientHeight),downloadBottom=await frame.locator('#download').evaluate(el=>el.getBoundingClientRect().bottom);
 assert.ok(downloadBottom<=frameHeight,'mobile download must fit inside the frame');
 await page.screenshot({path:'tests/output/mobile-result.png',fullPage:true});results.push({name:'mobile-layout-conversion',status:'passed',cpuThrottle:engine.name()==='chromium'?4:1,ms:Math.round(performance.now()-mobileStart)});
 const external=requests.filter(r=>new URL(r.url).origin!==new URL(base).origin&&!/^(blob:|data:)/.test(r.url));
 assert.deepEqual(external,[],'no external requests');assert.equal(requests.filter(r=>r.method!=='GET').length,0,'no document upload requests');assert.deepEqual(errors,[],'no unhandled JS errors');results.push({name:'network-isolation-no-ads',status:'passed',requests:requests.length});
 assert.ok(!results.some(r=>r.status==='failed'),'all conversion cases must pass');
}finally{await writeFile('tests/output/e2e-results.json',JSON.stringify({browser:engine.name(),results,errors},null,2));await browser.close();}
