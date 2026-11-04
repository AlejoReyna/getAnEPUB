import { ConversionError, msg, t, bookLocale } from '../i18n/catalog';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { LocalOcr } from './ocr';
import { preservePageImage } from './semantic';
import type { Options, Progress, Result, Metadata, Run, SemanticPage, Asset } from './contracts';
import { LIMITS } from './contracts';
import { clean, safeLink, language } from './safety';
pdfjs.GlobalWorkerOptions.workerSrc='/engine/pdf.worker.min.mjs';
const abortError=()=>new DOMException('Conversion canceled.','AbortError');
const blobBytes=async (b:Blob)=>new Uint8Array(await b.arrayBuffer());
const toBlob=(c:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new ConversionError('imageMemory')),'image/png'));
const pause=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function cover(title:string){
  const c=document.createElement('canvas');c.width=600;c.height=800;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,600,800);ctx.strokeStyle='#000';ctx.lineWidth=5;ctx.strokeRect(18,18,564,764);ctx.fillStyle='#000';ctx.fillRect(18,18,22,764);ctx.fillRect(50,18,2,764);
  const font='"Comic Sans Licensed", "Comic Sans Local", "Comic Sans MS", "Comic Sans", cursive';
  ctx.font=`26px ${font}`;ctx.fillText('EPUB',78,100);ctx.font=`52px ${font}`;
  const lines:string[]=[];let line='';
  for(const char of title){if(line&&ctx.measureText(line+char).width>438){lines.push(line.trim());line='';}line+=char;}
  if(line.trim())lines.push(line.trim());
  const visible=lines.slice(0,5);if(lines.length>5)visible[4]=visible[4].slice(0,-1)+'…';
  visible.forEach((text,i)=>ctx.fillText(text,78,245+i*70));
  // Small pixel-book mark, using the same solid monochrome geometry as the UI.
  ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(80,650);ctx.lineTo(110,650);ctx.lineTo(110,658);ctx.lineTo(140,658);ctx.lineTo(140,666);ctx.lineTo(150,674);ctx.lineTo(160,666);ctx.lineTo(160,658);ctx.lineTo(190,658);ctx.lineTo(190,650);ctx.lineTo(220,650);ctx.lineTo(220,682);ctx.lineTo(170,682);ctx.lineTo(150,695);ctx.lineTo(130,682);ctx.lineTo(80,682);ctx.closePath();ctx.stroke();
  ctx.font=`20px ${font}`;ctx.fillText('GET AN EPUB',78,746);return c;
}
export async function convert(file:File,options:Options,signal:AbortSignal,emit:(p:Progress)=>void):Promise<Result>{
  let doc:PDFDocumentProxy|undefined,ocr:LocalOcr|undefined,render:RenderTask|undefined;
  let work:Worker|undefined,task:ReturnType<typeof pdfjs.getDocument>|undefined;
  let timedOut=false,pageExpiredNumber=0,pageTimer:ReturnType<typeof setTimeout>|undefined;
  const pending=new Map<number,{resolve:(x:any)=>void;reject:(e:Error)=>void}>();let serial=0;
  const stop=()=>{render?.cancel();void task?.destroy().catch(()=>{});void ocr?.terminate().catch(()=>{});work?.terminate();pending.forEach(p=>p.reject(abortError()));pending.clear();};
  signal.addEventListener('abort',stop,{once:true});
  const timeout=setTimeout(()=>{timedOut=true;stop();},LIMITS.jobMs);
  const active=()=>{if(signal.aborted)throw abortError();if(timedOut)throw new ConversionError('jobTimeout');};
  const rpc=<T,>(type:string,payload?:unknown,transfer:Transferable[]=[]):Promise<T>=>new Promise((resolve,reject)=>{active();const id=++serial;pending.set(id,{resolve,reject});work!.postMessage({id,type,payload},transfer);});
  try{
    emit({stage:'validate',detail:msg('validateStage')});active();
    if(!file.size)throw new ConversionError('emptyFile');
    if(file.size>LIMITS.fileBytes)throw new ConversionError('fileTooLarge');
    const header=new TextDecoder().decode(await file.slice(0,1024).arrayBuffer());active();
    if(!header.includes('%PDF-'))throw new ConversionError('invalidHeader');
    const data=new Uint8Array(await file.arrayBuffer());active();
    emit({stage:'analyze',detail:msg('analyzeStage')});
    let encrypted=false;
    // This PDF.js version no longer exposes an eval option. CSP also forbids JS eval.
    task=pdfjs.getDocument({data,cMapUrl:'/engine/cmaps/',cMapPacked:true,standardFontDataUrl:'/engine/standard_fonts/',wasmUrl:'/engine/wasm/',enableXfa:false,stopAtErrors:true,maxImageSize:LIMITS.pixels,canvasMaxAreaInBytes:LIMITS.pixels*4,verbosity:0});
    task.onPassword=()=>{encrypted=true;void task!.destroy().catch(()=>{});};
    try{doc=await task.promise;}catch(e){if(encrypted)throw new ConversionError('encrypted');throw e;}active();
    if(doc.numPages<1)throw new ConversionError('noPages');
    if(doc.numPages>LIMITS.pages)throw new ConversionError('tooManyPages',{limit:LIMITS.pages});
    const permissions=await doc.getPermissions();active();
    if(permissions&&!permissions.has(pdfjs.PermissionFlag.COPY))throw new ConversionError('restricted');
    const details=await doc.getMetadata().catch(()=>null);active();
    const info=details?.info as {Title?:string;Author?:string;Language?:string;IsXFAPresent?:boolean}|undefined;
    if(info?.IsXFAPresent)throw new ConversionError('xfa');
    const documentLanguage=options.language==='auto'?language(info?.Language||'und'):language(options.language);
    const title=clean(options.title||info?.Title||file.name.replace(/\.pdf$/i,''),300)||t(bookLocale(documentLanguage),'bookFallback');
    const meta:Metadata={title,author:clean(options.author||info?.Author,200),language:documentLanguage,outline:[]};
    const destination=async(dest:any):Promise<number|undefined>=>{
      try{const d=typeof dest==='string'?await doc!.getDestination(dest):dest;if(!d?.length)return;const n=typeof d[0]==='number'?d[0]:await doc!.getPageIndex(d[0]);return n>=0&&n<doc!.numPages?n+1:undefined;}catch{return;}
    };
    const visit=async(items:any[],depth=0):Promise<void>=>{if(depth>12)return;for(const item of items){active();if(meta.outline.length>=2000)break;const page=await destination(item.dest);if(page)meta.outline.push({title:clean(item.title,200),page});await visit(item.items||[],depth+1);}};
    await visit(await doc.getOutline()||[]);active();
    work=new Worker(new URL('./book.worker.ts',import.meta.url),{type:'module'});
    work.onmessage=({data})=>{if('progress' in data){emit({stage:'package',detail:msg('compressStage'),current:data.progress,total:100});return;}const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(new ConversionError(data.error.key,data.error.params)):p.resolve(data.result);}};
    work.onerror=()=>{pending.forEach(p=>p.reject(new ConversionError('workerStart')));pending.clear();};
    const coverCanvas=cover(title),coverBlob=await toBlob(coverCanvas),coverBytes=await blobBytes(coverBlob);coverCanvas.width=coverCanvas.height=0;
    await rpc('init',{meta,cover:coverBytes},[coverBytes.buffer]);
    let totalChars=0,assetBytes=0,currentOcrPage=0;
    for(let n=1;n<=doc.numPages;n++){
      active();emit({stage:'extract',detail:msg('extractStage',{page:n,total:doc.numPages}),current:n-1,total:doc.numPages});
      let pageExpired=false;
      pageTimer=setTimeout(()=>{pageExpired=true;pageExpiredNumber=n;stop();},LIMITS.pageMs);
      const page=await doc.getPage(n);active();const view=page.getViewport({scale:1});
      if(!Number.isFinite(view.width*view.height)||view.width<10||view.height<10||view.width>3000||view.height>3000)throw new ConversionError('dimensions',{page:n});
      const scale=Math.min(2.4,Math.sqrt(LIMITS.pixels/(view.width*view.height))),renderView=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(renderView.width);canvas.height=Math.ceil(renderView.height);
      try{
        const textContent=await page.getTextContent({disableNormalization:false});active();
        let rotated=false;
        // Filter on the cleaned text: an item holding only bidi controls would become an empty run.
        const textItems=textContent.items.filter((item):item is TextItem=>'str' in item&&!!clean(item.str,50_000).trim());
        let runs:Run[]=textItems.map((item,id)=>{
          const matrix=pdfjs.Util.transform(view.transform,item.transform),size=Math.hypot(matrix[2],matrix[3]);
          const style=textContent.styles[item.fontName];if(Math.abs(matrix[1])>.2||style?.vertical)rotated=true;
          return {id,text:clean(item.str,50_000),x:matrix[4],y:matrix[5]-size*(style?.ascent||.85),w:Math.max(.1,item.width),h:size*1.15,size,bold:/bold|black|heavy/i.test(style?.fontFamily||'')||/bold/i.test(item.fontName),dir:item.dir};
        });
        if(rotated)throw new ConversionError('rotated',{page:n});
        if(runs.length>LIMITS.runsPerPage)throw new ConversionError('tooManyRuns',{page:n});
        const annotations=await page.getAnnotations({intent:'display'});active();
        const hasForm=annotations.some(a=>a.subtype==='Widget');let skippedLinks=false;
        const linkTargets:{x:number;y:number;w:number;h:number;href:string}[]=[];
        for(const a of annotations.filter(a=>a.subtype==='Link')){
          const target=a.dest?await destination(a.dest):undefined;
          let href=target?`p${target}.xhtml`:safeLink(a.url||a.unsafeUrl||'');
          // A raw relative link must name an existing chapter; its fragment cannot be verified.
          const chapter=!target&&href?.match(/^p(\d+)\.xhtml/i);if(chapter)href=Number(chapter[1])<=doc.numPages?`p${chapter[1]}.xhtml`:undefined;
          if(!href){skippedLinks=true;continue;}
          const rect=[...view.convertToViewportPoint(a.rect[0],a.rect[1]),...view.convertToViewportPoint(a.rect[2],a.rect[3])],x=Math.min(rect[0],rect[2]),y=Math.min(rect[1],rect[3]),w=Math.abs(rect[2]-rect[0]),h=Math.abs(rect[3]-rect[1]);
          linkTargets.push({x,y,w,h,href});
        }
        render=page.render({canvas,viewport:renderView,background:'rgb(255,255,255)',annotationMode:pdfjs.AnnotationMode.ENABLE,recordImages:true});await render.promise;render=undefined;active();
        // The parsed font flags are available after rendering; fontName itself is opaque.
        runs.forEach((r,i)=>{const name=textItems[i].fontName;if(page.commonObjs.has(name)){const font=page.commonObjs.get(name);r.bold=Boolean(font.bold||font.black);}});
        const scan=document.createElement('canvas');scan.width=Math.min(620,canvas.width);scan.height=Math.round(canvas.height*scan.width/canvas.width);const ctx=scan.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(canvas,0,0,scan.width,scan.height);const raster=ctx.getImageData(0,0,scan.width,scan.height);
        const extractedChars=runs.reduce((s,r)=>s+r.text.replace(/\s/g,'').length,0);
        const coords=page.imageCoordinates as ArrayLike<number>|null;let fullImage=false;
        if(coords)for(let i=0;i<coords.length;i+=6){const area=Math.abs((coords[i+2]-coords[i])*(coords[i+5]-coords[i+1])-(coords[i+3]-coords[i+1])*(coords[i+4]-coords[i]));if(area>.65)fullImage=true;}
        const isScan=extractedChars<12||(fullImage&&extractedChars<200);
        let fromOcr=false,preserveImage=false;
        const ink=raster.data.reduce((sum,v,i)=>sum+(i%4!==3&&v<180?1:0),0);
        if(isScan&&ink>50){
          if(!options.ocr)throw new ConversionError('needsOcr',{page:n});
          emit({stage:'ocr',detail:msg('ocrLoadStage',{page:n})});
          currentOcrPage=n;
          if(!ocr){
            ocr=new LocalOcr(m=>{if(m.status==='recognizing text')emit({stage:'ocr',detail:msg('ocrStage',{page:currentOcrPage,total:doc!.numPages}),current:m.progress,total:1});else emit({stage:'ocr',detail:msg('ocrPrepareStage',{page:currentOcrPage})});});
            await ocr.initialize(options.ocrLanguage);
          }active();
          const recognized=await ocr.recognize(await blobBytes(await toBlob(canvas)));active();
          if(!Number.isFinite(recognized.data.confidence)||recognized.data.confidence<65||!recognized.data.text.trim())preserveImage=true;
          else {
            let id=0;
            const ocrRuns=(recognized.data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>({id:id++,text:clean(w.text,1000),x:w.bbox.x0/scale,y:w.bbox.y0/scale,w:(w.bbox.x1-w.bbox.x0)/scale,h:(w.bbox.y1-w.bbox.y0)/scale,size:(w.bbox.y1-w.bbox.y0)/scale,bold:false,dir:'ltr'}))))).filter(r=>r.text.trim());
            if(ocrRuns.length){runs=ocrRuns;fromOcr=true;}else preserveImage=true;
          }
        }
        if(runs.length>LIMITS.runsPerPage)throw new ConversionError('tooManyOcrRuns',{page:n});
        for(const {x,y,w,h,href} of linkTargets)for(const r of runs)if(r.x<x+w&&r.x+r.w>x&&r.y<y+h&&r.y+r.h>y)r.href=href;
        totalChars+=runs.reduce((s,r)=>s+r.text.length,0);if(totalChars>LIMITS.textChars)throw new ConversionError('tooMuchText');
        emit({stage:'reconstruct',detail:msg('reconstructStage',{page:n,total:doc.numPages}),current:n-1,total:doc.numPages});
        const input={number:n,width:view.width,height:view.height,runs,ocr:fromOcr,raster:{width:raster.width,height:raster.height,pixels:raster.data}};
        let semantic:SemanticPage;
        if(preserveImage)semantic=preservePageImage(input);
        else {
          try{semantic=await rpc<SemanticPage>('analyze',input,[raster.data.buffer]);}
          catch(error){
            if(!(error instanceof ConversionError)||error.key!=='fullPageImage')throw error;
            semantic=preservePageImage(input);
          }
        }active();
        if(semantic.ocr&&extractedChars>=12)semantic.warnings.push({page:n,code:'partial-ocr',message:msg('partialOcrWarning')});
        if(hasForm)semantic.warnings.push({page:n,code:'forms',message:msg('formsWarning')});
        if(skippedLinks)semantic.warnings.push({page:n,code:'links',message:msg('linksWarning')});
        const assets:Asset[]=[];
        for(const b of semantic.blocks.filter(b=>b.kind==='image')){
          const crop=document.createElement('canvas');const x=Math.max(0,Math.floor(b.box.x*scale)),y=Math.max(0,Math.floor(b.box.y*scale));crop.width=Math.max(1,Math.min(canvas.width-x,Math.ceil(b.box.w*scale)));crop.height=Math.max(1,Math.min(canvas.height-y,Math.ceil(b.box.h*scale)));
          crop.getContext('2d')!.drawImage(canvas,x,y,crop.width,crop.height,0,0,crop.width,crop.height);const bytes=await blobBytes(await toBlob(crop));crop.width=crop.height=0;assetBytes+=bytes.length;if(assetBytes>LIMITS.assetsBytes)throw new ConversionError('tooManyImages');assets.push({id:b.imageId!,bytes});active();
        }
        await rpc('add',{page:semantic,assets},assets.map(a=>a.bytes.buffer));
        scan.width=scan.height=0;clearTimeout(pageTimer);if(pageExpired)throw new ConversionError('pageTimeout',{page:n});
      }finally{canvas.width=canvas.height=0;page.cleanup();clearTimeout(pageTimer);}
      emit({stage:'reconstruct',detail:msg(doc.numPages===1?'reconstructedOne':'reconstructedStage',{current:n,total:doc.numPages}),current:n,total:doc.numPages});await pause();
    }
    emit({stage:'package',detail:msg('packageStage')});
    const output=await rpc<{bytes:Uint8Array;report:Result['report']}>('finish');active();
    emit({stage:'check',detail:msg('checkStage')});
    return {...output,title,cover:coverBlob};
  }catch(error){
    if(signal.aborted)throw abortError();if(timedOut)throw new ConversionError('jobTimeout');
    if(pageExpiredNumber)throw new ConversionError('pageTimeout',{page:pageExpiredNumber});
    const e=error as Error;if(e.name==='InvalidPDFException')throw new ConversionError('invalidPdf');if(/maximum allowed size/i.test(e.message))throw new ConversionError('hugeImage');throw e;
  }finally{clearTimeout(timeout);clearTimeout(pageTimer);signal.removeEventListener('abort',stop);render?.cancel();work?.terminate();await ocr?.terminate().catch(()=>{});await task?.destroy().catch(()=>{});pending.clear();}
}
