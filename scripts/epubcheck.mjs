import { readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const jar=process.env.EPUBCHECK_JAR||'.cache/epubcheck/epubcheck-5.4.0/epubcheck.jar';
await access(jar).catch(()=>{throw new Error('Falta EPUBCheck. Instala v5.4.0 del W3C en .cache/epubcheck o configura EPUBCHECK_JAR.');});
const files=(await readdir('tests/output')).filter(n=>n.endsWith('.epub'));
if(files.length<11)throw new Error('Ejecuta todas las pruebas E2E antes de EPUBCheck (11 EPUB esperados).');
let failed=false;
for(const file of files){const result=spawnSync('java',['-jar',jar,`tests/output/${file}`],{encoding:'utf8'});console.log(`${file}:\n${result.stdout}${result.stderr}`);if(result.status!==0)failed=true;}
if(failed)process.exit(1);
