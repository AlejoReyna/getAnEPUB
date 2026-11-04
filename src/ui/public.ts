import { isLayoutMessage } from './layout';
import { currentLocale, onLocaleChange } from '../i18n/browser';
const hero=document.querySelector<HTMLElement>('.hero');
const paper=document.querySelector<HTMLElement>('.paper-subtitle');
if(hero&&paper){
  const measure=()=>paper.style.setProperty('--paper-width',`${paper.getBoundingClientRect().width}px`);
  new ResizeObserver(measure).observe(paper);
  // Without Comic Sans the traced pen strokes do not match the glyphs.
  void document.fonts.load('16px "Comic Sans Local"').catch(()=>[]).then(fonts=>{
    const licensed=[...document.fonts].some(f=>f.family.includes('Comic Sans Licensed'))&&document.fonts.check('16px "Comic Sans Licensed"');
    if(fonts.length===0&&!licensed)hero.classList.add('no-ink');
  });
  void document.fonts.ready.then(()=>{
    measure();paper.classList.add('paper-ready');
    hero.classList.add('is-drawing');
  });
  onLocaleChange(()=>{
    hero.classList.remove('is-drawing');measure();
    void hero.offsetWidth;hero.classList.add('is-drawing');
  });
}
// Only a small allowlist of fixed layouts crosses the boundary. No file access.
const frame=document.querySelector<HTMLIFrameElement>('.converter-frame');
if(frame){
  const converterOrigin=new URL(frame.src,location.href).origin;
  const sendLanguage=()=>frame.contentWindow?.postMessage({type:'get-an-epub:language',locale:currentLocale()},converterOrigin);
  frame.addEventListener('load',sendLanguage);
  onLocaleChange(sendLanguage);
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow||event.origin!==converterOrigin||!isLayoutMessage(event.data))return;
    frame.dataset.layout=event.data.layout;
  });
}
const slot=document.getElementById('ad-slot');
if(slot){
  const {client,slot:adSlot,adapter}=slot.dataset;let loaded=false;
  const script=document.createElement('script');script.src=adapter!;script.async=true;document.head.append(script);
  window.addEventListener('get-an-epub:ads-consent',(event:Event)=>{
    const consent=(event as CustomEvent).detail;
    // A reviewed CMP adapter supplies this event only after a valid decision.
    if(loaded||consent?.adsAllowed!==true||consent?.privacyReady!==true||!/^ca-pub-\d{16}$/.test(client||'')||!/^\d{10}$/.test(adSlot||''))return;
    loaded=true;
    const ad=document.createElement('ins');ad.className='adsbygoogle';ad.style.display='block';ad.dataset.adClient=client;ad.dataset.adSlot=adSlot;ad.dataset.adFormat='auto';ad.dataset.fullWidthResponsive='true';slot.append(ad);
    const provider=document.createElement('script');provider.async=true;provider.crossOrigin='anonymous';provider.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    provider.onload=()=>{const target=window as Window&{adsbygoogle?:unknown[]};(target.adsbygoogle||=[]).push({});};document.head.append(provider);
  });
}
