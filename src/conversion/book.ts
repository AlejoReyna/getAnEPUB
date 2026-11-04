import { ConversionError, msg, t, bookLocale } from '../i18n/catalog';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import type { Metadata, SemanticPage, Asset, Report, Run } from './contracts';
import { xml, safeLink, language, clean } from './safety';
const declaration='<?xml version="1.0" encoding="UTF-8"?>';
const CSS=`body{font-family:serif;line-height:1.55;margin:5%;overflow-wrap:break-word}p{margin:.7em 0}h1,h2{line-height:1.2;break-after:avoid}img{max-width:100%;height:auto}figure{margin:1em 0;break-inside:avoid}figcaption,.note{font-size:.9em}table{border-collapse:collapse;max-width:100%;font-size:.95em}th,td{border:1px solid;padding:.35em;text-align:start}a{overflow-wrap:anywhere}.page-marker{font-size:.75em}li{margin:.3em 0}`;
const inline=(rs:Run[])=>rs.map(r=>{const t=xml(r.text),href=r.href&&safeLink(r.href);return href?`<a href="${xml(href)}">${t}</a>`:t;}).join(' ');
function xhtml(title:string,lang:string,body:string){return `${declaration}<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xml(lang)}" lang="${xml(lang)}"><head><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="book.css"/></head><body dir="auto">${body}</body></html>`;}
export class Book {
  zip=new JSZip(); pages:SemanticPage[]=[]; images:string[]=[]; assetBytes=0;
  constructor(public meta:Metadata,cover:Uint8Array){
    meta.title=clean(meta.title,300)||t(bookLocale(meta.language),'bookFallback');meta.author=clean(meta.author,200);meta.language=language(meta.language);
    this.zip.file('mimetype','application/epub+zip',{compression:'STORE'});
    this.zip.file('META-INF/container.xml',`${declaration}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    this.zip.file('EPUB/book.css',CSS);
    this.zip.file('EPUB/cover.png',cover,{compression:'STORE'});
  }
  add(page:SemanticPage,assets:Asset[]){
    if(page.number!==this.pages.length+1)throw new ConversionError('pageOrder');
    for(const asset of assets){
      if(!/^p\d+-region\d+$/.test(asset.id)||this.images.includes(asset.id))throw new ConversionError('invalidResource');
      this.assetBytes+=asset.bytes.length;if(this.assetBytes>64*1024*1024)throw new ConversionError('tooManyImages');
      this.images.push(asset.id);this.zip.file(`EPUB/${asset.id}.png`,asset.bytes,{compression:'STORE'});
    }
    const locale=bookLocale(this.meta.language);
    let heading=0;
    const body=page.blocks.map(b=>{
      if(b.kind==='image'){
        if(!this.images.includes(b.imageId!))throw new ConversionError('missingImage');
        const label=t(locale,b.label?.key||'graphicLabel',b.label?.params);
        return `<figure><img src="${b.imageId}.png" xml:lang="${locale}" lang="${locale}" alt="${xml(label)}"/><figcaption${b.caption?'':` xml:lang="${locale}" lang="${locale}"`}>${b.caption?inline(b.caption):xml(label)}</figcaption></figure>`;
      }
      if(b.kind==='table')return `<table><caption xml:lang="${locale}" lang="${locale}">${xml(t(locale,'bookTable',{page:page.number}))}</caption><thead><tr>${b.rows![0].map(c=>`<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${b.rows!.slice(1).map(row=>`<tr>${row.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      if(b.kind==='heading')return `<h2 id="heading-${++heading}">${inline(b.runs)}</h2>`;
      if(b.kind==='list'){
        const first=b.runs[0],match=first.text.match(/^(\d+)[.)]\s*/);
        const rs=[{...first,text:first.text.replace(/^(?:[•●▪◦‣*-]|\d+[.)])\s*/,'')},...b.runs.slice(1)];
        return match?`<ol start="${Math.min(999999,Number(match[1]))}"><li>${inline(rs)}</li></ol>`:`<ul><li>${inline(rs)}</li></ul>`;
      }
      if(b.kind==='note')return `<aside class="note"><p>${inline(b.runs)}</p></aside>`;
      return `<p>${inline(b.runs)}</p>`;
    }).join('');
    this.zip.file(`EPUB/p${page.number}.xhtml`,xhtml(t(locale,'bookPageTitle',{title:this.meta.title,page:page.number}),this.meta.language,`<section id="page-${page.number}" aria-label="${page.number}"><span epub:type="pagebreak" role="doc-pagebreak" id="source-${page.number}" aria-label="${page.number}"></span>${body||`<p xml:lang="${locale}" lang="${locale}">${xml(t(locale,'bookBlank'))}</p>`}</section>`));
    this.pages.push(page);
  }
  async finish(progress:(n:number)=>void=()=>{}):Promise<{bytes:Uint8Array;report:Report}>{
    const {meta:m,pages}=this;
    const locale=bookLocale(m.language);
    if(!pages.length||!pages.some(p=>p.blocks.some(b=>['paragraph','heading','table','list','note'].includes(b.kind))))throw new ConversionError('insufficientText');
    const links=pages.map(p=>`<li><a href="p${p.number}.xhtml" xml:lang="${locale}" lang="${locale}">${xml(t(locale,'bookPage',{page:p.number}))}</a></li>`).join('');
    const outline=m.outline.filter(e=>e.page>=1&&e.page<=pages.length).slice(0,2000);
    const detected=pages.flatMap(p=>p.blocks.filter(b=>b.kind==='heading').map((b,i)=>({title:b.runs.map(r=>r.text).join(' '),href:`p${p.number}.xhtml#heading-${i+1}`})));
    const toc=outline.length?outline.map(e=>`<li><a href="p${e.page}.xhtml">${xml(e.title)}</a></li>`).join(''):detected.length?detected.map(e=>`<li><a href="${e.href}">${xml(e.title)}</a></li>`).join(''):links;
    this.zip.file('EPUB/nav.xhtml',xhtml(t(locale,'bookToc'),m.language,`<nav epub:type="toc" id="toc"><h1 xml:lang="${locale}" lang="${locale}">${xml(t(locale,'bookToc'))}</h1><ol>${toc}</ol></nav><nav epub:type="page-list" hidden="hidden"><h2 xml:lang="${locale}" lang="${locale}">${xml(t(locale,'bookOriginalPages'))}</h2><ol>${links}</ol></nav>`));
    const manifest=pages.map(p=>`<item id="p${p.number}" href="p${p.number}.xhtml" media-type="application/xhtml+xml"/>`).join('')+this.images.map(id=>`<item id="${id}" href="${id}.png" media-type="image/png"/>`).join('');
    this.zip.file('EPUB/package.opf',`${declaration}<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${xml(m.title)}</dc:title>${m.author?`<dc:creator>${xml(m.author)}</dc:creator>`:''}<dc:language>${xml(m.language)}</dc:language><dc:description xml:lang="${locale}">${xml(t(locale,'bookDescription'))}</dc:description><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/,'Z')}</meta><meta property="rendition:layout">reflowable</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="book.css" media-type="text/css"/><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>${manifest}</manifest><spine>${pages.map(p=>`<itemref idref="p${p.number}"/>`).join('')}</spine></package>`);
    const warnings=pages.flatMap(p=>p.warnings);
    const report:Report={pages:pages.length,textPages:pages.filter(p=>!p.ocr).length,ocrPages:pages.filter(p=>p.ocr).length,warnings,coverage:pages.map(p=>({page:p.number,sourceRuns:p.sourceRuns,representedRuns:p.representedRuns,sourceChars:p.sourceChars,textChars:p.blocks.flatMap(b=>b.kind==='image'?b.caption||[]:b.runs).reduce((n,r)=>n+r.text.length,0),imageRegions:p.blocks.filter(b=>b.kind==='image').length,ocr:p.ocr})),checks:[msg('checkPages'),msg('checkRuns'),msg('checkXml'),msg('checkReflow')]};
    const bytes=await this.zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}},e=>progress(e.percent));
    await validateEpub(bytes,pages.length);
    return {bytes,report};
  }
}
export async function validateEpub(bytes:Uint8Array,expectedPages:number){
  if(new DataView(bytes.buffer,bytes.byteOffset).getUint16(8,true)!==0||new TextDecoder().decode(bytes.slice(30,38))!=='mimetype')throw new ConversionError('invalidMimetypeOrder');
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),names=new Set(Object.keys(zip.files));
  if(await zip.file('mimetype')?.async('string')!=='application/epub+zip')throw new ConversionError('invalidEpub');
  const documents=new Map<string,{ids:Set<string>;refs:string[]}>();
  for(const name of names){if(!/\.(xhtml|opf|xml)$/.test(name))continue;
    const contents=await zip.file(name)!.async('string'),ids=new Set<string>(),refs:string[]=[];
    if(/<!DOCTYPE|<!ENTITY/i.test(contents))throw new ConversionError('xmlDeclarations');
    const parser=new SaxesParser({xmlns:false});let error:Error|undefined;
    parser.on('error',e=>{error=e;});parser.on('opentag',tag=>{
      if(['script','iframe','object','embed'].includes(tag.name.toLowerCase()))throw new ConversionError('activeContent');
      for(const [key,value] of Object.entries(tag.attributes)){
        const v=String(value);if(/^on/i.test(key))throw new ConversionError('activeAttribute');
        if(key==='id'){if(ids.has(v))throw new ConversionError('duplicateId');ids.add(v);}
        if(key==='src'||key==='href'){if(/^[a-z]+:/i.test(v)){if(key==='src'||!safeLink(v))throw new ConversionError('unsafeResource');}else refs.push(v);}
      }
    });parser.write(contents).close();if(error)throw new ConversionError('invalidXml');documents.set(name,{ids,refs});
  }
  for(const [name,{refs}] of documents)for(const ref of refs){const [file,fragment]=ref.split('#');const path=new URL(file||name.split('/').at(-1)!,`https://epub.invalid/${name}`).pathname.slice(1);if(!names.has(path))throw new ConversionError('missingResource');if(fragment&&!documents.get(path)?.ids.has(fragment))throw new ConversionError('missingAnchor');}
  if([...names].filter(n=>/^EPUB\/p\d+\.xhtml$/.test(n)).length!==expectedPages)throw new ConversionError('missingPages');
}
