import { ConversionError, errorMessage } from '../i18n/catalog';
import { reconstruct } from './semantic';
import { Book } from './book';
let book:Book|undefined;
self.onmessage=async ({data})=>{
  const {id,type,payload}=data;
  try{
    let result;
    if(type==='init'){book=new Book(payload.meta,payload.cover);result=true;}
    else if(type==='analyze')result=reconstruct(payload);
    else if(type==='add'){book!.add(payload.page,payload.assets);result=true;}
    else if(type==='finish'){
      const output=await book!.finish(n=>self.postMessage({progress:n}));
      self.postMessage({id,result:output}, {transfer:[output.bytes.buffer]});book=undefined;return;
    }
    else throw new ConversionError('unknownOperation');
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:errorMessage(error)});}
};
