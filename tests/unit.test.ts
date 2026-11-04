import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeLink, clean, xml, filename } from '../src/conversion/safety';
import { reconstruct } from '../src/conversion/semantic';
import { shuffledMessages, messages } from '../src/ui/messages';
import { isLayoutMessage, isSettingsMessage } from '../src/ui/layout';
import { preferredLocale, isLanguageMessage } from '../src/i18n/browser';
import { catalog, t, errorMessage, ConversionError } from '../src/i18n/catalog';
import { englishMessages } from '../src/ui/messages';
import { validateDeployment } from '../scripts/config.mjs';
import { Book, validateEpub } from '../src/conversion/book';
import type { PageInput, Run } from '../src/conversion/contracts';
import { LIMITS } from '../src/conversion/contracts';
import astroConfig from '../astro.config.mjs';
const page=(runs:Run[]):PageInput=>({number:1,width:612,height:792,runs,ocr:false,raster:{width:1,height:1,pixels:new Uint8ClampedArray([255,255,255,255])}});
const run=(id:number,text:string,x=50,y=80):Run=>({id,text,x,y,w:text.length*6,h:12,size:12,bold:false,dir:'ltr'});
test('Astro config preserves the prototype and emits scripts compatible with the production CSP',()=>{assert.equal(typeof astroConfig,'object');assert.equal(astroConfig.outDir,'./.cache/astro');assert.equal(astroConfig.vite?.build?.assetsInlineLimit,0);});
test('sanitizes markup, metadata, filenames, links and bidi controls',()=>{
 assert.equal(xml('<a & "b">'),'&lt;a &amp; &quot;b&quot;&gt;');assert.equal(clean('a\x00b\u202ec'),'abc');assert.equal(filename('../a/b'),'-a-b.epub');
 for(const href of ['javascript:alert(1)','data:text/html,a','file:///a','https://a:b@example.org','//example.org'])assert.equal(safeLink(href),undefined);
 assert.equal(safeLink('p2.xhtml'),'p2.xhtml');assert.equal(safeLink('https://example.org/á'),'https://example.org/%C3%A1');
});
test('decorative messages are an exhaustive permutation, never recycled',()=>{const result=shuffledMessages(()=>.3);assert.equal(new Set(result).size,20);assert.deepEqual(new Set(result),new Set(messages));assert.notDeepEqual(result,messages);});
test('frame layout messages permit fixed presets only, never document data or measured heights',()=>{
 assert.equal(isLayoutMessage({type:'get-an-epub:layout',layout:'result'}),true);
  for(const value of [null,'result',{type:'get-an-epub:layout',layout:'result',filename:'private.pdf'},{type:'get-an-epub:layout',layout:500},{type:'get-an-epub:layout',layout:'<script>'},{type:'other',layout:'result'}])assert.equal(isLayoutMessage(value),false);
  assert.equal(isSettingsMessage({type:'get-an-epub:settings',open:true}),true);
  for(const value of [null,{type:'get-an-epub:settings',open:'yes'},{type:'get-an-epub:settings',open:true,title:'private'},{type:'get-an-epub:layout',open:true}])assert.equal(isSettingsMessage(value),false);
});
test('manual language wins, regional preferences normalize, and unsupported languages fall back to US English',()=>{
 assert.equal(preferredLocale(['es-MX'],'en-US'),'en-US');
 assert.equal(preferredLocale(['fr-FR','es-AR','en-US']),'es');
 assert.equal(preferredLocale(['en-GB']),'en-US');
 assert.equal(preferredLocale(['ja-JP']),'en-US');
 assert.equal(preferredLocale(['es-MX'],'invalid'),'es');
 assert.equal(isLanguageMessage({type:'get-an-epub:language',locale:'es'}),true);
 for(const value of [{type:'get-an-epub:language',locale:'en-GB'},{type:'get-an-epub:language',locale:'es',file:'private.pdf'},null])assert.equal(isLanguageMessage(value),false);
});
test('every localized message has matching parameters and each language has 20 distinct playful messages',()=>{
 for(const [key,pair] of Object.entries(catalog)){
  assert.ok(pair[0]&&pair[1],key);
  assert.deepEqual([...pair[0].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...pair[1].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),key);
 }
 assert.equal(new Set(englishMessages).size,20);assert.equal(englishMessages.length,messages.length);
 assert.equal(t('en-US','sourceOne',{count:1}),'1 source page');
 assert.equal(t('en-US','tooManyPages',{limit:1000}),'The limit is 1,000 pages. Split the PDF and convert each part.');
 const message=errorMessage(new ConversionError('dimensions',{page:2}));assert.equal(message.key,'dimensions');assert.equal(message.params?.page,2);
});
test('preserves every source run exactly once and infers paragraphs',()=>{const p=reconstruct(page([run(1,'Uno.'),run(2,'Dos.',50,96)]));assert.equal(p.representedRuns,2);assert.equal(p.blocks.length,1);assert.equal(p.blocks[0].kind,'paragraph');});
test('formula is an image region, and is not duplicated as body text',()=>{const p=reconstruct(page([run(1,'E = mc2'),run(2,'Párrafo adaptable',50,140)]));assert.equal(p.blocks[0].kind,'image');assert.equal(p.blocks[1].kind,'paragraph');assert.equal(p.representedRuns,2);});
test('blocks above two columns keep their place in the final order',()=>{
 const rs=[run(1,'31 oct',400,60),run(2,'Resumen amplio que cruza el canal central de la pagina entera.',50,240)];
 for(let k=0;k<4;k++){rs.push(run(3+k,'Columna izquierda',50,320+k*40));rs.push(run(7+k,'Columna derecha',330,320+k*40));}
 const p=reconstruct(page(rs));
 assert.deepEqual(p.blocks.map(b=>b.runs[0].id),[1,2,3,4,5,6,7,8,9,10]);
});
test('three reliable rows become semantic table cells',()=>{const rs=[run(1,'Objeto',50,80),run(2,'Cantidad',300,80),run(3,'A',50,105),run(4,'12',300,105),run(5,'B',50,130),run(6,'24',300,130)];rs[0].bold=rs[1].bold=true;const p=reconstruct(page(rs));assert.equal(p.blocks[0].kind,'table');assert.equal(p.blocks[0].rows?.length,3);});
test('ad configuration fails closed without host and privacy separation',()=>{
 assert.doesNotThrow(()=>validateDeployment({}));assert.throws(()=>validateDeployment({PUBLIC_ADS_ENABLED:'true'}));
 assert.throws(()=>validateDeployment({PUBLIC_ADS_ENABLED:'true',PUBLIC_SITE_ORIGIN:'https://same.example',PUBLIC_CONVERTER_ORIGIN:'https://same.example'}));
});
test('real reflowable package passes internal checks and detects broken links',async()=>{
 const book=new Book({title:'Prueba & acentos',author:'',language:'es',outline:[]},new Uint8Array([1,2,3]));book.add(reconstruct(page([run(1,'Texto real seleccionable.')])),[]);const {bytes,report}=await book.finish();await validateEpub(bytes,1);assert.equal(report.pages,1);await assert.rejects(validateEpub(bytes,2),/pages are missing/);
});
test('long books are one EPUB: the page limit is 600 and the time budget covers them',()=>{
 assert.equal(LIMITS.pages,600);assert.ok(LIMITS.jobMs>=LIMITS.pages*5_000);assert.equal(t('es','limits'),'También puedes arrastrarlo aquí · hasta 32 MB y 600 páginas');
});
