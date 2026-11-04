import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const results=[],errors=[];await mkdir('tests/output',{recursive:true});
async function open(locale,init){const context=await browser.newContext({locale,acceptDownloads:true});if(init)await context.addInitScript(init);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#interface-language').waitFor();await page.frameLocator('iframe').locator('#choose').waitFor();return {context,page};}
async function language(page,locale){await page.locator('#interface-language').selectOption(locale);await page.waitForFunction(value=>document.documentElement.lang===value,locale);await page.frameLocator('iframe').locator(`html[lang="${locale}"]`).waitFor();}
async function bookLanguage(page,frame,value){if(!await frame.locator('#options').evaluate(el=>el.open))await page.locator('#open-settings').click();await frame.locator('#language').selectOption(value);}
async function download(page,frame,path){const ready=page.waitForEvent('download');await frame.locator('#download').click();await (await ready).saveAs(path);return JSZip.loadAsync(await readFile(path));}
try{
 const {context,page}=await open('en-US');const frame=page.frameLocator('iframe');
 assert.equal(await page.locator('html').getAttribute('lang'),'en-US');assert.equal(await frame.locator('#choose').innerText(),'Choose a PDF');
 assert.equal(await page.locator('.wordmark').getAttribute('aria-label'),'Get an Epub');
 assert.match(await page.locator('.sub').innerText(),/Your next read starts here/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('get-an-epub:language')),null,'automatic detection is not a manual override');
 await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'tests/output/english-desktop.png',fullPage:true});
 await language(page,'es');assert.equal(await frame.locator('#choose').innerText(),'Elegir PDF');assert.match(await page.locator('.sub').innerText(),/Todo listo para tu próxima lectura/);
 await page.reload();await frame.locator('html[lang="es"]').waitFor();assert.equal(await page.locator('#interface-language').inputValue(),'es');
 await page.goto(`${base}/privacidad/`);assert.equal(await page.locator('section[data-locale="es"] h1').innerText(),'Tu lectura es tuya.');
 await page.locator('#interface-language').selectOption('en-US');assert.equal(await page.locator('section[data-locale="en-US"] h1').innerText(),'Your reading is yours.');assert.equal(await page.title(),'Privacy · Get an Epub');
 await page.goto(`${base}/compatibilidad/`);assert.equal(await page.locator('html').getAttribute('lang'),'en-US');assert.match(await page.locator('section[data-locale="en-US"]').innerText(),/The original text is not translated/);
 await page.goto(base);await frame.locator('#choose').waitFor();
 // Change the interface language while OCR is loading: the document and worker must survive.
 await bookLanguage(page,frame,'es');
 let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/ocr/spa.traineddata.gz',async route=>{await held;await route.continue().catch(()=>{});});
 const model=page.waitForRequest('**/ocr/spa.traineddata.gz');await frame.locator('#pdf').setInputFiles('tests/fixtures/scan.pdf');await model;
 assert.equal(await frame.locator('#processing').isVisible(),true);
 const filename=await frame.locator('#file-name').innerText();await language(page,'es');
 assert.equal(await frame.locator('#file-name').innerText(),filename);assert.equal(await frame.locator('#language').inputValue(),'es');assert.equal(await frame.locator('#ocr-language').inputValue(),'spa');assert.equal(await frame.locator('#processing').isVisible(),true);
 assert.match(await frame.locator('#stage-label').innerText(),/OCR|reconocimiento/);
 release();await frame.locator('#result:not([hidden])').waitFor({timeout:30000});await page.unroute('**/ocr/spa.traineddata.gz');
 const href=await frame.locator('#download').getAttribute('href'),cover=await frame.locator('#thumbnail').getAttribute('src');
 await language(page,'en-US');assert.equal(await frame.locator('#download').getAttribute('href'),href);assert.equal(await frame.locator('#thumbnail').getAttribute('src'),cover);assert.match(await frame.locator('#result-info').innerText(),/^1 source page/);
 const spanish=await download(page,frame,'tests/output/localized-spanish.epub');assert.match(await spanish.file('EPUB/package.opf').async('string'),/<dc:language>es<\/dc:language>/);assert.match(await spanish.file('EPUB/nav.xhtml').async('string'),/Índice/);
 await frame.locator('.report-details summary').click();assert.match(await frame.locator('#report').innerText(),/Text coverage checks/);assert.doesNotMatch(await frame.locator('#report').innerText(),/\[object Object\]|Texto reconocido con OCR/);
 const reportDownload=page.waitForEvent('download');await frame.locator('#download-report').click();await (await reportDownload).saveAs('tests/output/localized-report.json');const report=JSON.parse(await readFile('tests/output/localized-report.json','utf8'));assert.equal(report.locale,'en-US');assert.ok(report.warnings.every(w=>w.messageKey&&typeof w.message==='string'));
 await frame.locator('#another').click();await bookLanguage(page,frame,'en');await frame.locator('#pdf').setInputFiles('tests/fixtures/simple.pdf');await frame.locator('#result:not([hidden])').waitFor({timeout:30000});
 const english=await download(page,frame,'tests/output/localized-english.epub');assert.match(await english.file('EPUB/package.opf').async('string'),/<dc:language>en<\/dc:language>/);assert.match(await english.file('EPUB/nav.xhtml').async('string'),/>Contents</);assert.match(await english.file('EPUB/p1.xhtml').async('string'),/Lectura sencilla/,'source content is never translated');
 await frame.locator('#another').click();await bookLanguage(page,frame,'auto');await frame.locator('#pdf').setInputFiles('tests/fixtures/simple.pdf');await frame.locator('#result:not([hidden])').waitFor({timeout:30000});const unspecified=await download(page,frame,'tests/output/localized-unspecified.epub');assert.match(await unspecified.file('EPUB/package.opf').async('string'),/<dc:language>und<\/dc:language>/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/output/english-result-mobile.png',fullPage:true});await frame.locator('#another').click();
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const positions=await page.locator('.language-switch,#open-settings').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));assert.ok(positions[0].right<=positions[1].left,'header controls must not overlap');const overlapsCard=await page.evaluate(()=>{const card=document.querySelector('.converter-frame').getBoundingClientRect();return [...document.querySelectorAll('.site-footer a')].some(link=>{const rect=link.getBoundingClientRect();return rect.bottom>card.top&&rect.top<card.bottom&&rect.right>card.left&&rect.left<card.right;});});assert.equal(overlapsCard,false,'footer links must not cover the converter');await page.screenshot({path:`tests/output/english-mobile-${width}.png`,fullPage:true});}
 await frame.locator('#pdf').setInputFiles('tests/fixtures/fake.pdf');await frame.locator('#error:not([hidden])').waitFor();assert.match(await frame.locator('#error').innerText(),/valid PDF header/);await language(page,'es');assert.match(await frame.locator('#error').innerText(),/cabecera PDF válida/);
 results.push('English UI; manual override persists across reloads and pages; language changes preserve active OCR and downloads; reports localized; document/OCR languages independent; mobile header fits; errors update');await context.close();
 const unsupported=await open('fr-FR');assert.equal(await unsupported.page.locator('html').getAttribute('lang'),'en-US');await unsupported.context.close();results.push('Unsupported language falls back to US English');
 const preferred=await open('fr-FR',()=>Object.defineProperty(navigator,'languages',{get:()=>['fr-FR','es-MX','en-US']}));assert.equal(await preferred.page.locator('html').getAttribute('lang'),'es');await preferred.context.close();results.push('First supported browser preference selected');
 const blocked=await open('en-US',()=>{Storage.prototype.getItem=()=>{throw new Error('Unavailable')};Storage.prototype.setItem=()=>{throw new Error('Unavailable')};});await language(blocked.page,'es');assert.equal(await blocked.page.frameLocator('iframe').locator('#choose').innerText(),'Elegir PDF');await blocked.context.close();results.push('Language switch works when storage is unavailable');
 assert.deepEqual(errors,[]);console.log(results.join('\n'));
}finally{await writeFile('tests/output/localization-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
