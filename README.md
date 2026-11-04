# Get an Epub

Herramienta gratuita, sin registro, en Astro 7 y TypeScript. Genera EPUB 3 **adaptable** con texto real, OCR local en español/inglés y regiones complejas como imágenes. No garantiza la reconstrucción perfecta de cualquier PDF. No hay API comercial ni IA externa. No se ha publicado esta versión ni activado publicidad.

## Ejecutar

Requiere Node 24 y npm. Desde la raíz del proyecto:

```sh
npm ci
npm run setup
npm run build
npm run preview
```

Abrir [http://127.0.0.1:4321](http://127.0.0.1:4321). `setup` descarga una vez los modelos abiertos OCR en español e inglés, verifica sus SHA-256 y prepara PDF.js/Tesseract. Los modelos y motores se sirven desde el mismo sitio; las conversiones no necesitan conexión externa. Las dependencias y los modelos sí requieren conexión al instalarlos.

Para desarrollar: `npm run dev`. Para comprobar las políticas de seguridad, usar **build + preview**; el servidor de desarrollo de Astro no sustituye las cabeceras de producción. No abrir los archivos HTML mediante `file://`.

`build/public/` es la salida pública. `build/private/` es la salida del origen privado. La construcción fuerza `--outDir ./.cache/astro` y no usa el antiguo `dist/`. La configuración local de hosting conserva su ID y apunta a `build/public`; no se ha ejecutado ningún despliegue.

## Funciones implementadas

- Validación de contenido PDF, tamaño, páginas, permisos, cifrado y errores de lectura.
- Extracción Unicode, inferencia de párrafos/títulos/listas, orden de dos columnas, notas pequeñas y tablas regulares verificables por geometría y encabezados.
- OCR real por página, configurable en español, inglés o ambos. Una imagen dominante con poco texto digital activa OCR de la página completa; sustituye esa capa parcial para no duplicarla.
- Fórmulas detectadas y regiones gráficas conservadas mediante recortes PNG, con avisos de accesibilidad. Pies sencillos de figura cercanos se conservan como `figcaption`. No se inventa MathML.
- Metadatos saneados, idioma, índice de marcadores o títulos, enlaces seguros y destinos internos a páginas. Cubierta tipográfica generada; la vista de resultado muestra la misma imagen incluida en el EPUB. La miniatura de la primera página se conserva dentro del resultado del motor.
- Comprobación por descarga de XML, referencias, recursos y cobertura de fragmentos. EPUBCheck en pruebas, **no en cada conversión del navegador**.
- Progreso de etapa medido o indeterminado, cancelación desde la inicialización de OCR, reintento, limpieza, descarga real e informe JSON opcional.
- Interfaz aprobada: blanco/negro, Comic Sans local, logo pixelado elegido, título escrito trazo por trazo y subtítulo que se desarruga en doce pliegues. Selección centrada, barra horizontal real, veinte mensajes y portada con descarga; sin diagrama ni controles de demostración. Movimiento reducido compatible.
- Interfaz completa en español e inglés americano: detección por `navigator.languages`, elección manual persistida y selector superior derecho. Cambiar el idioma no reinicia la conversión ni modifica el idioma del libro/OCR.
- Publicidad desactivada; integración AdSense con barreras de configuración, sin anuncios simulados ni esperas publicitarias.

## Límites de esta versión

32 MB, 150 páginas, un trabajo por pestaña, 6 millones de píxeles por página/imagen interna, 64 MB de regiones PNG, 24.000 fragmentos por página, 4 millones de caracteres y ocho minutos por trabajo; 45 segundos por página, incluido OCR. Los límites reducen el consumo pero no pueden imponer un techo absoluto de RAM al navegador ni aislarlo del sistema operativo.

La reconstrucción es heurística. Los PDF sin Unicode correcto, con columnas irregulares, ecuaciones complejas, tablas combinadas, texto vertical, capas o fondos pueden rechazarse o requerir revisión. El detector visual tiene límites: la cobertura comprueba lo que se extrajo o reconoció, no demuestra que todas las regiones del PDF se hayan interpretado. No hay conversión silenciosa a diseño fijo. Los alfabetos digitales se conservan; el OCR instalado solo cubre español e inglés. Los enlaces a notas no se infieren si no vienen como enlaces internos. Los formularios no mantienen interactividad.

Las imágenes de fórmulas/tablas no son editables ni plenamente accesibles; las ilustraciones no tienen descripciones automáticas del contenido. Revisa el EPUB junto al PDF antes de confiar en datos, fórmulas u orden de lectura.

Consulta [arquitectura y seguridad](docs/ARCHITECTURE.md), [pruebas y lectores](docs/VALIDATION.md), [publicidad e instalación en dos orígenes](docs/ADVERTISING.md) y [licencias](THIRD_PARTY_NOTICES.md).

## Pruebas reproducibles

El workflow de GitHub Actions y la configuración de Vercel están en `.github/workflows/ci-cd.yml` y `vercel.json`. Consulta [cómo funciona y cómo se estructura el CI/CD](docs/CI_CD.md) para la conexión, los eventos, las comprobaciones y el despliegue.

```sh
npm run check
npm test
python3 -m pip install -r tests/requirements.txt
npm run fixtures
npx playwright install chromium
npm run setup:epubcheck
```

Con `npm run preview` en otra terminal:

```sh
npm run test:e2e
npm run test:i18n
npm run test:security
npm run test:epubcheck
```

`BROWSER_EXECUTABLE` permite usar un Chromium existente. Para Firefox: `BROWSER=firefox BROWSER_EXECUTABLE=/ruta/al/ejecutable npm run test:e2e`. Java 11 o posterior y `unzip` son necesarios para EPUBCheck. `EPUBCHECK_JAR` permite usar una instalación propia. `TEST_FONT` permite seleccionar una fuente de pruebas instalada; por defecto usa Arial en macOS o DejaVu Sans en Linux. Los PDF y EPUB de prueba se generan en `tests/fixtures` y `tests/output`, nunca se incluyen en producción.

## Prototipo anterior conservado

`dist/` y `tools/pdf_to_epub.py` corresponden al prototipo previo de **diseño fijo**. No forman parte de la aplicación Astro. El Python usa PyMuPDF, que requiere cumplir AGPL o una licencia comercial; no está integrado ni instalado por este proyecto. El conversor nuevo reutiliza PDF.js y JSZip y genera contenido XHTML adaptable.

Comic Sans está instalada en el equipo de desarrollo. No se distribuye ningún archivo de esa fuente. Para garantizarla en otros dispositivos hace falta una licencia web y añadir el `@font-face` reservado en `src/styles/global.css`; cuando falta la versión local, la interfaz lo informa.
