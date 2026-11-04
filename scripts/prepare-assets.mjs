import { cp, mkdir, copyFile, access } from 'node:fs/promises';
for(const lang of ['spa','eng'])await access(`public/ocr/${lang}.traineddata.gz`).catch(()=>{throw new Error('Faltan modelos OCR. Ejecuta npm run setup antes de construir.');});
const target = 'public/engine';
await mkdir(target, {recursive:true});
for (const part of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`node_modules/pdfjs-dist/${part}`, `${target}/${part}`, {recursive:true});
}
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${target}/pdf.worker.min.mjs`);
await copyFile('node_modules/tesseract.js/dist/worker.min.js', `${target}/ocr-worker.min.js`);
await cp('node_modules/tesseract.js-core', `${target}/ocr-core`, {recursive:true, filter:s=> !s.includes('node_modules/tesseract.js-core/node_modules')});
await mkdir('public/licenses', {recursive:true});
await copyFile('third_party/saxes-LICENSE.txt','public/licenses/saxes.txt');
for (const [pkg,file] of [['pdfjs-dist','LICENSE'], ['jszip','LICENSE.markdown'], ['tesseract.js','LICENSE.md'], ['tesseract.js-core','LICENSE'],['xmlchars','LICENSE'],['astro','LICENSE']]) {
  await copyFile(`node_modules/${pkg}/${file}`,`public/licenses/${pkg}.txt`);
}
