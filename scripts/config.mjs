import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
export function deploymentEnv(mode='production') {
  const env={};for(const file of ['.env','.env.local',`.env.${mode}`,`.env.${mode}.local`]){
    try{Object.assign(env,parseEnv(readFileSync(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return {...env,...process.env};
}
export function validateDeployment(env) {
  if (env.PUBLIC_ADS_ENABLED !== 'true') return;
  const publicOrigin = new URL(env.PUBLIC_SITE_ORIGIN || '');
  const privateOrigin = new URL(env.PUBLIC_CONVERTER_ORIGIN || '');
  if (publicOrigin.protocol !== 'https:' || privateOrigin.protocol !== 'https:' || publicOrigin.hostname === privateOrigin.hostname) {
    throw new Error('Publicidad: se requieren dos hosts HTTPS distintos para aislar los documentos.');
  }
  for(const origin of [publicOrigin,privateOrigin])if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('Publicidad: configura orígenes sin rutas, parámetros ni credenciales.');
  if (!/^ca-pub-\d{16}$/.test(env.PUBLIC_ADSENSE_CLIENT || '') || !/^\d{10}$/.test(env.PUBLIC_ADSENSE_SLOT || '')) {
    throw new Error('Publicidad: faltan identificadores de AdSense válidos.');
  }
  if (env.PUBLIC_PRIVACY_REVIEWED !== 'true' || !/^\/[a-zA-Z0-9_/-]+\.js$/.test(env.PUBLIC_CONSENT_ADAPTER||'')) {
    throw new Error('Publicidad: falta revisar la privacidad e integrar una CMP.');
  }
  if(!existsSync(`public${env.PUBLIC_CONSENT_ADAPTER}`))throw new Error('Publicidad: falta el archivo del adaptador CMP revisado.');
}
