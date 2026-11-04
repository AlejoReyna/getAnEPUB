import { messages, englishMessages, shuffledIndices } from './messages';
import { filename } from '../conversion/safety';
import type { Options, Progress, Report } from '../conversion/contracts';
import { isSettingsMessage, type Layout } from './layout';
import { currentLocale, isLanguageMessage, onLocaleChange, setLocale } from '../i18n/browser';
import { t, msg, translate, errorMessage, type Message, type MessageKey } from '../i18n/catalog';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const text=(key:MessageKey,params:Record<string,string|number>={})=>t(currentLocale(),key,params);
let busy=false,controller:AbortController|undefined,timer:ReturnType<typeof setInterval>|undefined,urls:string[]=[],report:Report|undefined;
let lastAnnouncement='',lastTime=0,lastProgress:Progress|undefined,lastError:Message|undefined,messageIndex:number|undefined,resultBytes=0,canceling=false;
const clearMessages=()=>{clearInterval(timer);messageIndex=undefined;$('playful').textContent='';};
function cleanup(){clearMessages();urls.forEach(u=>URL.revokeObjectURL(u));urls=[];$<HTMLAnchorElement>('download').removeAttribute('href');$<HTMLImageElement>('thumbnail').removeAttribute('src');$('report').replaceChildren();report=undefined;lastProgress=undefined;lastError=undefined;}
if(window.parent!==window){document.documentElement.classList.add('embedded');document.body.classList.add('embedded');}
else document.documentElement.classList.add('standalone');
function layout(){
  if(window.parent===window)return;
  const state=$('workspace').dataset.state;
  const optionsOpen=$<HTMLDialogElement>('options').open;
  const reportOpen=document.querySelector<HTMLDetailsElement>('.report-details')?.open??false;
  const preset:Layout=optionsOpen?'options':state==='processing'?'processing':state==='result'?(reportOpen?'report':'result'):!$('error').hidden?'error':'idle';
  window.parent.postMessage({type:'get-an-epub:layout',layout:preset},$('workspace').dataset.parentOrigin||location.origin);
}
function stage(state:'idle'|'processing'|'result'){
  for(const id of ['idle','processing','result'])$(id).hidden=state!==id;
  $('workspace').dataset.state=state;
  const dialog=$<HTMLDialogElement>('options');
  if(state!=='idle'&&dialog.open)dialog.close();
  else layout();
}
function paintBlocks(){
  const bar=$<HTMLProgressElement>('progress');
  const cells=[...document.querySelectorAll<HTMLElement>('#blocks span')];
  const indeterminate=!bar.hasAttribute('value')||!(bar.max>0);
  const filled=indeterminate?0:Math.round((bar.value/bar.max)*cells.length);
  cells.forEach((cell,index)=>{
    cell.classList.remove('off','now');
    if(indeterminate){cell.classList.add(index===0?'now':'off');return;}
    if(index>=filled)cell.classList.add('off');
    else if(index===filled-1&&filled<cells.length)cell.classList.add('now');
  });
}
function openSettings(){
  const dialog=$<HTMLDialogElement>('options');
  if(!dialog.open)dialog.showModal();
  document.getElementById('open-settings')?.setAttribute('aria-expanded','true');
  const title=$<HTMLInputElement>('title');
  if(title.disabled)$('close-settings').focus();else title.focus();
  layout();
}
function progress(p:Progress){
  lastProgress=p;$('stage-label').textContent=canceling?text('canceling'):translate(currentLocale(),p.detail);
  const bar=$<HTMLProgressElement>('progress');
  if(p.total&&p.current!==undefined){bar.max=p.total;bar.value=p.current;$('percentage').textContent=new Intl.NumberFormat(currentLocale(),{style:'percent',maximumFractionDigits:0}).format(p.current/p.total);$('measure').textContent=p.stage==='ocr'?text('measureOcr'):p.stage==='package'?text('measurePackage'):text(p.total===1?'measurePage':'measurePages',{current:p.current,total:p.total});}else{bar.removeAttribute('value');$('percentage').textContent='';$('measure').textContent=text('indeterminate');}
  paintBlocks();
  const now=Date.now();if(p.stage!==lastAnnouncement||now-lastTime>5000){$('announcer').textContent=translate(currentLocale(),p.detail);lastAnnouncement=p.stage;lastTime=now;}
}
function count(one:MessageKey,many:MessageKey,n:number){return text(n===1?one:many,{count:n});}
function renderReport(r:Report){
  $('report').replaceChildren();const intro=document.createElement('p');intro.textContent=text('reportIntro');$('report').append(intro);
  const list=document.createElement('ul');for(const check of r.checks){const li=document.createElement('li');li.textContent=translate(currentLocale(),check);list.append(li);}for(const warning of r.warnings){const li=document.createElement('li'),message=translate(currentLocale(),warning.message);li.textContent=warning.page?text('stagePage',{page:warning.page,message}):message;list.append(li);}$('report').append(list);
  const regionCount=r.coverage.reduce((n,p)=>n+p.imageRegions,0);
  $('warnings').textContent=r.warnings.length?`${count('warningOne','warningMany',r.warnings.length)}${regionCount?` · ${count('regionOne','regionMany',regionCount)}`:''}. ${text('compareOriginal')}`:text('reportOkay');
  const size=new Intl.NumberFormat(currentLocale(),{minimumFractionDigits:2,maximumFractionDigits:2}).format(resultBytes/1048576);
  $('result-info').textContent=`${count('sourceOne','sourceMany',r.pages)} · ${count('ocrOne','ocrMany',r.ocrPages)} · ${size} MB`;
}
function renderFunny(){if(messageIndex!==undefined)$('playful').textContent=messageIndex<0?text('stillWorking'):(currentLocale()==='es'?messages:englishMessages)[messageIndex];}
function showError(message:Message){lastError=message;$('error').textContent=`${text('errorPrefix')} ${translate(currentLocale(),message)}`;$('error').hidden=false;layout();}
async function load(file?:File){
  if(!file||busy)return;
  cleanup();$('error').hidden=true;busy=true;canceling=false;controller=new AbortController();lastAnnouncement='';
  $<HTMLButtonElement>('choose').disabled=true;$<HTMLFieldSetElement>('settings').disabled=true;
  $<HTMLButtonElement>('cancel').disabled=false;stage('processing');$('progress-heading').focus();$('file-name').textContent=file.name;
  progress({stage:'validate',detail:msg('validateStage')});
  const queue=shuffledIndices();messageIndex=queue.shift()!;renderFunny();timer=setInterval(()=>{messageIndex=queue.shift()??-1;renderFunny();if(messageIndex<0)clearInterval(timer);},3200);
  try{
    const {convert}=await import('../conversion/pipeline');
    if(controller.signal.aborted)throw new DOMException('Conversion canceled.','AbortError');
    const options:Options={title:$<HTMLInputElement>('title').value.trim(),author:$<HTMLInputElement>('author').value.trim(),language:$<HTMLSelectElement>('language').value,ocrLanguage:$<HTMLSelectElement>('ocr-language').value as Options['ocrLanguage'],ocr:$<HTMLInputElement>('ocr').checked};
    const result=await convert(file,options,controller.signal,progress);
    if(controller.signal.aborted)throw new DOMException('Conversion canceled.','AbortError');
    clearMessages();report=result.report;const blob=new Blob([result.bytes as Uint8Array<ArrayBuffer>],{type:'application/epub+zip'});resultBytes=blob.size;const download=URL.createObjectURL(blob);urls.push(download);$<HTMLAnchorElement>('download').href=download;$<HTMLAnchorElement>('download').download=filename(result.title);
    $('book-title').textContent=result.title;
    const url=URL.createObjectURL(result.cover);urls.push(url);$<HTMLImageElement>('thumbnail').src=url;$('thumbnail').hidden=false;
    renderReport(report);stage('result');$('result-heading').focus();$('announcer').textContent=text('readyAnnounce');
  }catch(error){clearMessages();stage('idle');showError(errorMessage(error));$('choose').focus();}
  finally{busy=false;canceling=false;controller=undefined;clearMessages();$<HTMLButtonElement>('choose').disabled=false;$<HTMLFieldSetElement>('settings').disabled=false;$<HTMLInputElement>('pdf').value='';$('file-name').textContent='';}
}
$('choose').addEventListener('click',()=>$<HTMLInputElement>('pdf').click());
$('pdf').addEventListener('change',()=>void load($<HTMLInputElement>('pdf').files?.[0]));
$('cancel').addEventListener('click',()=>{canceling=true;controller?.abort();$<HTMLButtonElement>('cancel').disabled=true;clearMessages();$('stage-label').textContent=text('canceling');});
$('another').addEventListener('click',()=>{cleanup();$('error').hidden=true;document.querySelector<HTMLDetailsElement>('.report-details')!.open=false;stage('idle');$<HTMLInputElement>('title').value='';$<HTMLInputElement>('author').value='';$('choose').focus();});
$('download-report').addEventListener('click',()=>{
  if(!report)return;
  const localized={...report,locale:currentLocale(),checks:report.checks.map(check=>translate(currentLocale(),check)),warnings:report.warnings.map(warning=>({...warning,messageKey:warning.message.key,params:warning.message.params,message:translate(currentLocale(),warning.message)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(localized,null,2)],{type:'application/json'}));urls.push(url);const a=document.createElement('a');a.href=url;a.download=text('reportFilename');a.click();
});
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('drag');});
for(const event of ['drop','dragleave'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag');if(event==='drop'&&!busy){const files=(e as DragEvent).dataTransfer?.files;if(files?.length!==1)showError(msg('singleFile'));else void load(files[0]);}});
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
window.addEventListener('pagehide',()=>{controller?.abort();cleanup();});
for(const details of document.querySelectorAll('details'))details.addEventListener('toggle',layout);
const settingsDialog=$<HTMLDialogElement>('options');
settingsDialog.addEventListener('close',()=>{document.getElementById('open-settings')?.setAttribute('aria-expanded','false');layout();});
settingsDialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!settingsDialog.open)return;
  const focusable=[...settingsDialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(el=>el.tabIndex!==-1&&el.getClientRects().length>0);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!settingsDialog.contains(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!settingsDialog.contains(active))){event.preventDefault();first.focus();}
});
settingsDialog.addEventListener('click',event=>{if(event.target===settingsDialog)settingsDialog.close();});
$('close-settings').addEventListener('click',()=>settingsDialog.close());
document.getElementById('open-settings')?.addEventListener('click',()=>openSettings());
window.addEventListener('message',event=>{
  const origin=$('workspace').dataset.parentOrigin||location.origin;
  if(event.source!==window.parent||event.origin!==origin)return;
  if(isLanguageMessage(event.data))setLocale(event.data.locale);
  else if(isSettingsMessage(event.data)&&event.data.open)openSettings();
});
onLocaleChange(()=>{if(lastProgress&&busy)progress(lastProgress);if(report)renderReport(report);if(lastError&&!$('error').hidden)showError(lastError);renderFunny();layout();});
layout();
void document.fonts.load('16px "Comic Sans Local"').catch(()=>[]).then(fonts=>{$('font-notice').hidden=fonts.length>0||document.fonts.check('16px "Comic Sans Licensed"')&&[...document.fonts].some(f=>f.family.includes('Comic Sans Licensed'));});
