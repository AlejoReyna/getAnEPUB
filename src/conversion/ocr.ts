import { ConversionError } from '../i18n/catalog';
import type { Page } from 'tesseract.js';
// Minimal client for the pinned Tesseract.js 7 worker protocol (Apache-2.0).
// Owning the Worker from construction makes initialization cancellable too.
export class LocalOcr {
  private worker=new Worker('/engine/ocr-worker.min.js');
  private jobs=new Map<string,{resolve:(data:any)=>void;reject:(e:Error)=>void}>();
  private serial=0;
  constructor(private progress:(data:{status:string;progress:number})=>void){
    this.worker.onmessage=({data})=>{
      if(data.status==='progress'){this.progress(data.data);return;}
      const job=this.jobs.get(data.jobId);if(!job)return;this.jobs.delete(data.jobId);
      data.status==='resolve'?job.resolve(data.data):job.reject(new ConversionError('ocrFailed'));
    };
    this.worker.onerror=e=>{e.preventDefault();this.fail(new ConversionError('ocrStart'));};
  }
  private fail(error:Error){this.jobs.forEach(job=>job.reject(error));this.jobs.clear();}
  private send<T>(action:string,payload:unknown):Promise<T>{return new Promise((resolve,reject)=>{const jobId=`ocr-${++this.serial}`;this.jobs.set(jobId,{resolve,reject});this.worker.postMessage({workerId:'local',jobId,action,payload});});}
  async initialize(lang:string){
    await this.send('load',{options:{lstmOnly:true,corePath:'/engine/ocr-core',logging:false}});
    await this.send('loadLanguage',{langs:lang,options:{langPath:'/ocr',cacheMethod:'none',gzip:true,lstmOnly:true}});
    await this.send('initialize',{langs:lang,oem:1,config:{}});
  }
  async recognize(bytes:Uint8Array){return {data:await this.send<Page>('recognize',{image:bytes,options:{},output:{text:true,blocks:true}})};}
  async terminate(){this.worker.terminate();this.fail(new DOMException('Conversion canceled.','AbortError'));}
}
