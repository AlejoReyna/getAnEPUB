import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { validateDeployment, deploymentEnv } from './config.mjs';
const env=deploymentEnv();
validateDeployment(env);
const ads=env.PUBLIC_ADS_ENABLED==='true';
export function headers({privateOnly=false,adsEnabled=ads}={}){
  const parent=env.PUBLIC_SITE_ORIGIN||"'self'";
  const privateOrigin=env.PUBLIC_CONVERTER_ORIGIN||"'self'";
  const privateCsp=`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; font-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors ${parent}`;
  const publicCsp=`default-src 'self'; script-src 'self'${adsEnabled?" https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:${adsEnabled?' https:':''}; frame-src ${privateOrigin}${adsEnabled?' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com':''}; connect-src 'self'${adsEnabled?' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com':''}; font-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'`;
  return {'Content-Security-Policy':privateOnly?privateCsp:publicCsp,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Cache-Control':'no-store'};
}
if(process.argv[1]?.endsWith('security-headers.mjs')){
  await rm('build',{recursive:true,force:true});await mkdir('build',{recursive:true});
  await cp('.cache/astro','build/public',{recursive:true,filter:s=>!ads||!s.startsWith('.cache/astro/convert')&&!s.startsWith('.cache/astro/engine')&&!s.startsWith('.cache/astro/ocr')});
  await cp('.cache/astro','build/private',{recursive:true});
  // Private host has no public page or advertisement entry point.
  await writeFile('build/private/index.html','<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/convert/"><title>Conversor privado</title><a href="/convert/">Abrir conversor privado</a></html>');
  const rule=(path,privateOnly)=>path+'\n'+Object.entries(headers({privateOnly})).map(([k,v])=>`  ${k}: ${v}`).join('\n')+'\n';
  await writeFile('build/private/_headers',rule('/*',true));
  // Hosts such as Netlify and Cloudflare Pages merge every matching rule, so public and private paths must never overlap.
  const privateDirs=['convert','engine','ocr'],publicPaths=['/'];
  for(const entry of await readdir('build/public',{withFileTypes:true}))if(entry.name!=='_headers'&&!privateDirs.includes(entry.name))publicPaths.push(entry.isDirectory()?`/${entry.name}/*`:`/${entry.name}`);
  const rules=publicPaths.map(path=>rule(path,false));
  if(!ads)for(const dir of privateDirs)rules.push(rule(`/${dir}/*`,true));
  await writeFile('build/public/_headers',rules.join('\n'));
  console.log('Generados build/public y build/private. Publicidad '+(ads?'configurada con aislamiento requerido.':'desactivada.'));
}
