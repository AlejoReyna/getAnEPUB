// Fixed presentation presets only: never transmit measured heights or document data.
export const layouts = ['idle','options','processing','result','report','error'] as const;
export type Layout = typeof layouts[number];
export function isLayoutMessage(value:unknown):value is {type:'get-an-epub:layout';layout:Layout}{
  if(!value||typeof value!=='object')return false;
  const data=value as Record<string,unknown>;
  return Object.keys(data).length===2&&data.type==='get-an-epub:layout'&&layouts.includes(data.layout as Layout);
}
export function isSettingsMessage(value:unknown):value is {type:'get-an-epub:settings';open:boolean}{
  if(!value||typeof value!=='object')return false;
  const data=value as Record<string,unknown>;
  return Object.keys(data).length===2&&data.type==='get-an-epub:settings'&&typeof data.open==='boolean';
}
