import { defineConfig } from 'astro/config';
import { validateDeployment, deploymentEnv } from './scripts/config.mjs';
validateDeployment(deploymentEnv(process.env.NODE_ENV==='development'?'development':'production'));
export default defineConfig({
  output: 'static',
  outDir: './.cache/astro',
  // Keep even small entry scripts external so the production CSP can stay strict.
  vite: { worker: { format: 'es' }, build: { assetsInlineLimit: 0 } },
});
