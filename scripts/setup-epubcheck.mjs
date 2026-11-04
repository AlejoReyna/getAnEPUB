import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const version='5.4.0',hash='33350c61038e71dfb3d45a76aed04bf5481e6d5500cb780f6e98db8bbd15a28c';
await mkdir('.cache/epubcheck',{recursive:true});
let bytes=await readFile('.cache/epubcheck.zip').catch(()=>null);
if(!bytes){const response=await fetch(`https://github.com/w3c/epubcheck/releases/download/v${version}/epubcheck-${version}.zip`);if(!response.ok)throw new Error('No se pudo descargar EPUBCheck del W3C.');bytes=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('EPUBCheck: SHA-256 inesperado.');
await writeFile('.cache/epubcheck.zip',bytes);
const result=spawnSync('unzip',['-oq','.cache/epubcheck.zip','-d','.cache/epubcheck'],{stdio:'inherit'});if(result.status!==0)process.exit(1);console.log('EPUBCheck 5.4.0 instalado y verificado para pruebas.');
