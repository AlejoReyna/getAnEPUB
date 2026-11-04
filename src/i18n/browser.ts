import { catalog, t, type Locale, type MessageKey } from './catalog';
export const storageKey='get-an-epub:language';
export const isLocale=(value:unknown):value is Locale=>value==='en-US'||value==='es';
export function preferredLocale(languages:readonly string[],saved?:unknown):Locale{
  if(isLocale(saved))return saved;
  for(const language of languages){if(/^es(?:-|$)/i.test(language))return 'es';if(/^en(?:-|$)/i.test(language))return 'en-US';}
  return 'en-US';
}
export function currentLocale():Locale{return document.documentElement.dataset.locale==='es'?'es':'en-US';}
export function setLocale(locale:Locale,persist=false){
  const changed=currentLocale()!==locale;
  document.documentElement.lang=locale;document.documentElement.dataset.locale=locale;
  if(persist)try{localStorage.setItem(storageKey,locale);}catch{}
  for(const attr of ['aria-label','title','placeholder','alt','content']){
    for(const el of document.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`)){
      const key=el.getAttribute(`data-i18n-${attr}`) as MessageKey;
      if(key in catalog)el.setAttribute(attr,t(locale,key));
    }
  }
  const titleKey=document.documentElement.dataset.titleKey as MessageKey;
  for(const el of document.querySelectorAll<HTMLElement>('[data-i18n]')){const key=el.dataset.i18n as MessageKey;if(key in catalog)el.textContent=t(locale,key);}
  if(titleKey in catalog)document.title=t(locale,titleKey);
  for(const selector of document.querySelectorAll<HTMLSelectElement>('[data-language-picker]'))selector.value=locale;
  if(changed)document.dispatchEvent(new CustomEvent('localechange',{detail:locale}));
}
export const onLocaleChange=(handler:()=>void)=>document.addEventListener('localechange',handler);
export function initializeLocale(){
  setLocale(currentLocale());
  for(const selector of document.querySelectorAll<HTMLSelectElement>('[data-language-picker]'))selector.addEventListener('change',()=>{if(isLocale(selector.value))setLocale(selector.value,true);});
  window.addEventListener('storage',event=>{if(event.key===storageKey){let saved;try{saved=localStorage.getItem(storageKey);}catch{}setLocale(preferredLocale(navigator.languages,saved));}});
  window.addEventListener('languagechange',()=>{let saved;try{saved=localStorage.getItem(storageKey);}catch{}setLocale(preferredLocale(navigator.languages,saved));});
}
export function isLanguageMessage(value:unknown):value is {type:'get-an-epub:language';locale:Locale}{
  if(!value||typeof value!=='object')return false;
  const data=value as Record<string,unknown>;
  return Object.keys(data).length===2&&data.type==='get-an-epub:language'&&isLocale(data.locale);
}
