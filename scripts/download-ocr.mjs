import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hashes={eng:'45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91',spa:'40be52f97b5d4eb7460073dc1f94cd546b27150333c0bf854ed7e7132db6bceb'};
await mkdir('public/ocr',{recursive:true});
for(const [lang,hash] of Object.entries(hashes)){
  const path=`public/ocr/${lang}.traineddata.gz`;let data=await readFile(path).catch(()=>null);
  if(!data){const response=await fetch(`https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best_int/${lang}.traineddata.gz`);if(!response.ok)throw new Error('No se pudo descargar el modelo OCR.');data=Buffer.from(await response.arrayBuffer());}
  if(createHash('sha256').update(data).digest('hex')!==hash)throw new Error(`Modelo ${lang}: SHA-256 inesperado.`);
  await writeFile(path,data);console.log(`Modelo ${lang} verificado.`);
}
