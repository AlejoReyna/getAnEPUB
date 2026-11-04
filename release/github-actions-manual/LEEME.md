# GitHub Actions → Vercel para Get an Epub

Esta carpeta contiene referencias para agregarlas manualmente al repositorio. No se han instalado como configuración activa ni se ha desplegado nada.

## Archivos

- Copia `ci-cd.yml` como `.github/workflows/ci-cd.yml`.
- Copia `vercel.json` a la raíz, junto a `package.json`.

El workflow asume que la rama principal se llama `main`. Si tiene otro nombre, reemplaza todas las referencias a `main`, incluidas las expresiones `refs/heads/main`.

## Conectar el proyecto

1. Sube a GitHub la versión actual completa del proyecto: `src/`, `public/` (excepto archivos generados), `scripts/`, `tests/`, `third_party/`, `astro.config.mjs`, `tsconfig.json`, `package.json` y `package-lock.json`. Conserva `.gitignore`; los modelos OCR y motores se generan en Actions. `dist/` contiene un prototipo anterior.
2. Crea o selecciona el proyecto de Vercel. Desde la raíz local del proyecto ejecuta `npx vercel@latest link` y selecciona ese proyecto. Este comando vincula el directorio; no publica la aplicación.
3. Consulta `.vercel/project.json`: `orgId` se usará como `VERCEL_ORG_ID` y `projectId` como `VERCEL_PROJECT_ID`. Mantén `.vercel/` y `.env*.local` fuera del repositorio mediante `.gitignore`.
4. Genera un token con acceso al equipo del proyecto en https://vercel.com/account/tokens.
5. En el repositorio de GitHub abre Settings → Secrets and variables → Actions → New repository secret. Crea `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`. El token va en Secrets, nunca en el YAML.
6. En Vercel selecciona Node.js 24.x para el proyecto y conserva `PUBLIC_ADS_ENABLED=false` para esta primera instalación en un solo origen.
7. Con los secrets ya configurados, agrega los dos archivos de referencia a sus destinos. En GitHub se puede usar Add file → Create new file, escribir la ruta completa y pegar el contenido.

## Qué ejecuta

- Pull request hacia `main`: instala dependencias, comprueba Astro/TypeScript, ejecuta las pruebas unitarias, descarga/verifica los modelos OCR y compila; no despliega.
- Push a `main`: comprueba el código y las pruebas; usa `vercel pull`, `vercel build --prod` y `vercel deploy --prebuilt --prod` para compilar y publicar. La descarga de modelos está incluida en el build command de `vercel.json`.
- Actions → CI y deploy a Vercel → Run workflow → rama `main`: ejecuta las mismas comprobaciones y publica manualmente. El workflow debe estar ya en la rama predeterminada para que aparezca el botón.
- Ejecución manual en otra rama: solo comprueba y compila.

Si falla un paso, no se ejecutan los siguientes. La URL publicada aparece en el resumen de la ejecución. La rama debe requerir la comprobación `ci-cd` para que GitHub bloquee también la fusión de un pull request con pruebas fallidas; configura esa regla en el repositorio si quieres ese comportamiento.

`vercel.json` desactiva los despliegues automáticos de la integración Git de Vercel para que publique Actions. Conserva las cabeceras públicas y privadas del proyecto; las reglas no se solapan. Esta configuración está preparada para publicidad desactivada y un solo origen. Si activas anuncios posteriormente, hay que adaptar también el alojamiento y las cabeceras para los dos hosts que requiere el proyecto.

Para que solo el botón publique, elimina el bloque `push` del YAML y conserva `pull_request` y `workflow_dispatch`.

## Alcance de la verificación

Se validaron la sintaxis JSON/YAML, la clasificación de rutas y la correspondencia con las cabeceras actuales. Este workflow incluye tipos, pruebas unitarias y compilación; no ejecuta las pruebas de navegador ni EPUBCheck. Hace falta una ejecución real en GitHub con tus credenciales para verificar el despliegue. El ejemplo instala la CLI de Vercel más reciente; puedes fijar una versión concreta después de verificarla si necesitas builds reproducibles.

## Documentación oficial

- https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/project-configuration/git-configuration
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
