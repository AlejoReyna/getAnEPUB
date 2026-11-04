import { ConversionError, msg, type Message } from '../i18n/catalog';
import type { Box, Run, PageInput, Block, SemanticPage, Warning } from './contracts';
const median = (ns: number[]) => [...ns].sort((a,b)=>a-b)[Math.floor(ns.length/2)] || 12;
export function bounds(rs: Box[]): Box {
  const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));
  return { x,y,w:Math.max(...rs.map(r=>r.x+r.w))-x,h:Math.max(...rs.map(r=>r.y+r.h))-y };
}
const text = (rs:Run[])=> rs.map(r=>r.text).join(' ');
const overlaps = (a:Box,b:Box)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function tableBounds(page:PageInput,box:Box):Box{
  const r=page.raster,sx=page.width/r.width,sy=page.height/r.height,rules:Box[]=[];
  for(let y=Math.max(0,Math.floor((box.y-28)/sy));y<Math.min(r.height,Math.ceil((box.y+box.h+22)/sy));y++){
    let start=-1;
    for(let x=0;x<=r.width;x++){
      const i=(y*r.width+x)*4,ink=x<r.width&&Math.min(r.pixels[i],r.pixels[i+1],r.pixels[i+2])<210;
      if(ink&&start<0)start=x;
      if(!ink&&start>=0){if((x-start)*sx>Math.max(80,box.w*.75)&&start*sx<box.x+15&&x*sx>box.x+box.w-15)rules.push({x:start*sx,y:y*sy,w:(x-start)*sx,h:sy});start=-1;}
    }
  }
  const b=rules.length?bounds([box,...rules]):box;
  return {x:Math.max(0,b.x-3),y:Math.max(0,b.y-3),w:b.w+6,h:b.h+6};
}
function segments(runs:Run[]) {
  const rows:Run[][]=[];
  for(const run of [...runs].sort((a,b)=>a.y-b.y||a.x-b.x)) {
    let row=rows.findLast(r=>Math.abs(r[0].y-run.y)<Math.min(r[0].h,run.h)*.45);
    if(!row){row=[];rows.push(row);} row.push(run);
  }
  return rows.map(row=>{
    row.sort((a,b)=>a.x-b.x);
    const cells:Run[][]=[];
    for(const run of row){const last=cells.at(-1),prev=last?.at(-1);if(!prev||run.x-(prev.x+prev.w)>Math.max(22,run.size*2.1))cells.push([run]);else last!.push(run);}
    cells.forEach(cell=>{if(cell.filter(r=>r.dir==='rtl').length>cell.length/2)cell.reverse();});
    return cells;
  });
}
// Raster coverage is a conservative detector, not proof of semantic fidelity.
function graphics(page:PageInput, masked:Box[]):Box[] {
  const {raster:r}=page, size=4, cols=Math.ceil(r.width/size), rows=Math.ceil(r.height/size);
  const ink=new Uint8Array(cols*rows), sx=page.width/r.width,sy=page.height/r.height;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
    const i=(y*r.width+x)*4;
    if(Math.min(r.pixels[i],r.pixels[i+1],r.pixels[i+2])<210)ink[Math.floor(y/size)*cols+Math.floor(x/size)]=1;
  }
  for(const box of masked){
    const x0=Math.max(0,Math.floor((box.x-2)/sx/size)),x1=Math.min(cols,Math.ceil((box.x+box.w+2)/sx/size));
    const y0=Math.max(0,Math.floor((box.y-2)/sy/size)),y1=Math.min(rows,Math.ceil((box.y+box.h+2)/sy/size));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)ink[y*cols+x]=0;
  }
  const regions:Box[]=[];
  for(let i=0;i<ink.length;i++)if(ink[i]){
    const stack=[i];ink[i]=0;let x0=cols,y0=rows,x1=0,y1=0,count=0;
    while(stack.length){const n=stack.pop()!,x=n%cols,y=Math.floor(n/cols);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy,k=ny*cols+nx;if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&ink[k]){ink[k]=0;stack.push(k);}}
    }
    if(count>=4&&(x1-x0>=2||y1-y0>=2))regions.push({x:Math.max(0,x0*size*sx-3),y:Math.max(0,y0*size*sy-3),w:Math.min(page.width,(x1-x0+1)*size*sx+6),h:Math.min(page.height,(y1-y0+1)*size*sy+6)});
  }
  // Nearby pieces of an illustration are one crop. Anything textual within it is consumed below.
  // Repeat until stable: a grown region can reach regions already checked.
  for(let merged=true;merged;){merged=false;
    for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++)if(overlaps({...regions[i],x:regions[i].x-8,y:regions[i].y-8,w:regions[i].w+16,h:regions[i].h+16},regions[j])){regions[i]=bounds([regions[i],regions[j]]);regions.splice(j--,1);merged=true;}
  }
  return regions;
}
export function reconstruct(page:PageInput):SemanticPage {
  const {runs}=page, warnings:Warning[]=[], blocks:Block[]=[], consumed=new Set<number>();
  const warn=(code:string,message:Message)=>warnings.push({page:page.number,code,message});
  if(runs.some(r=>r.text.includes('\ufffd')))throw new ConversionError('invalidEncoding',{page:page.number});
  const base=median(runs.filter(r=>r.text.trim().length>3).map(r=>r.size));
  const rows=segments(runs);
  for(let i=0;i<rows.length;i++) {
    const row=rows[i]; if(row.length<2||row.length>8)continue;
    const group=[row], xs=row.map(c=>bounds(c).x);let j=i+1;
    for(;j<rows.length;j++){
      const other=rows[j];const gap=bounds(other.flat()).y-(bounds(group.at(-1)!.flat()).y+bounds(group.at(-1)!.flat()).h);
      if(other.length!==row.length||gap>base*2||!other.every((c,k)=>Math.abs(bounds(c).x-xs[k])<6))break;
      group.push(other);
    }
    const numeric=group.slice(1).some(r=>r.some(c=>/^[-+]?\d[\d.,%\s]*$/.test(text(c))));
    const reliable=group.length>=3&&row.every(c=>c.every(r=>r.bold))&&numeric&&group.every(r=>r.every(c=>text(c).length<100));
    const suspect=group.length>=3&&numeric;
    if(reliable||suspect){
      const rs=group.flat(2),box=bounds(rs);rs.forEach(r=>consumed.add(r.id));
      if(reliable)blocks.push({kind:'table',box:tableBounds(page,box),runs:rs,rows:group});
      else {blocks.push({kind:'image',box,runs:rs,label:msg('tableLabel')});warn('table-image',msg('tableImageWarning'));}
      i=j-1;
    }
  }
  const lines=rows.flat().filter(rs=>!rs.some(r=>consumed.has(r.id)));
  for(const line of lines){
    const t=text(line);
    if(/[=∑∫√≈≠≤≥∂∞]/u.test(t)||line.some(r=>/symbol|math/i.test(r.dir))){
      const box=bounds(line);blocks.push({kind:'image',box:{x:Math.max(0,box.x-3),y:Math.max(0,box.y-3),w:box.w+6,h:box.h+6},runs:line,label:msg('formulaLabel')});line.forEach(r=>consumed.add(r.id));warn('formula-image',msg('formulaWarning'));
    }
  }
  const remaining=lines.filter(rs=>!rs.some(r=>consumed.has(r.id)));
  const gutter=page.width/2;
  const left=remaining.filter(rs=>{const b=bounds(rs);return b.x+b.w<gutter-8;}),right=remaining.filter(rs=>bounds(rs).x>gutter+8);
  const twoColumns=left.length>=4&&right.length>=4,rtl=runs.filter(r=>r.dir==='rtl').length>runs.length/2;
  let ordered=remaining.map(rs=>({rs,box:bounds(rs)}));
  // Shared by text ordering and the final block sort, so both agree on what sits above the columns.
  const start=twoColumns?Math.max(Math.min(...left.map(rs=>bounds(rs).y)),Math.min(...right.map(rs=>bounds(rs).y))):0;
  const rank=(b:Box)=>!twoColumns||b.y<start-base?0:b.w>page.width*.55?3:b.x>gutter?(rtl?1:2):(rtl?2:1);
  if(twoColumns){
    ordered.sort((a,b)=>rank(a.box)-rank(b.box)||a.box.y-b.box.y||a.box.x-b.box.x);
    warn('columns',msg(rtl?'columnsRtl':'columnsLtr'));
  }else ordered.sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
  let previous:Block|undefined;
  for(const {rs,box} of ordered){
    const t=text(rs).trim(); if(!t)continue;
    const heading=median(rs.map(r=>r.size))>base*1.24||/^(cap[ií]tulo|chapter)\s+\S/i.test(t);
    const list=/^(?:[•●▪◦‣*-]|\d+[.)])\s/.test(t);
    const note=box.y>page.height*.76&&median(rs.map(r=>r.size))<base*.83;
    const kind=heading?'heading':list?'list':note?'note':'paragraph';
    const prev=previous;
    const canJoin=prev&&kind==='paragraph'&&prev.kind==='paragraph'&&Math.abs(prev.box.x-box.x)<base*1.8&&box.y>prev.box.y&&box.y-prev.box.y-prev.box.h<base*.8&&Math.abs(prev.runs.at(-1)!.size-rs[0].size)<1.5;
    if(canJoin){prev.runs.push(...rs);prev.box=bounds([prev.box,box]);}else{previous={kind,box,runs:[...rs]};blocks.push(previous);}
    rs.forEach(r=>consumed.add(r.id));
  }
  const regions=graphics(page,[...runs, ...blocks.filter(b=>b.kind==='table'||b.kind==='image').map(b=>b.box)]);
  for(const box of regions){
    if(box.w*box.h>page.width*page.height*.72)throw new ConversionError('fullPageImage',{page:page.number});
    const intersect=blocks.filter(b=>overlaps(box,b.box));
    // Never emit the same source text as both an image and reflow text.
    const included=intersect.flatMap(b=>b.runs);
    const combined=intersect.length?bounds([box,...intersect.map(b=>b.box)]):box;
    intersect.forEach(b=>blocks.splice(blocks.indexOf(b),1));
    blocks.push({kind:'image',box:combined,runs:included,label:msg('graphicLabel')});
    warn('graphic-image',msg('graphicWarning'));
  }
  for(const image of blocks.filter(b=>b.kind==='image')){
    const caption=blocks.find(b=>b.kind==='paragraph'&&/^\s*(?:fig(?:ura|ure)?\.?|imagen|illustration)\s*\d/i.test(text(b.runs))&&b.box.y>=image.box.y+image.box.h-2&&b.box.y-image.box.y-image.box.h<64);
    if(caption){image.caption=caption.runs;image.runs.push(...caption.runs);blocks.splice(blocks.indexOf(caption),1);}
  }
  // Put images/tables into the inferred reading order, while preserving column order.
  blocks.sort((a,b)=>rank(a.box)-rank(b.box)||a.box.y-b.box.y||a.box.x-b.box.x);
  blocks.filter(b=>b.kind==='image').forEach((b,i)=>b.imageId=`p${page.number}-region${i+1}`);
  const ids=blocks.flatMap(b=>b.runs.map(r=>r.id));
  if(ids.length!==runs.length||new Set(ids).size!==runs.length)throw new ConversionError('coverageError',{page:page.number});
  if(!blocks.length)warn('blank',msg('blankWarning'));
  if(page.ocr)warn('ocr',msg('ocrWarning'));
  if(blocks.some(b=>b.kind==='note'))warn('notes',msg('notesWarning'));
  return {number:page.number,blocks,warnings,sourceRuns:runs.length,representedRuns:ids.length,ocr:page.ocr,sourceChars:runs.reduce((n,r)=>n+r.text.length,0)};
}
