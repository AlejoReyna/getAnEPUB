# Dependencias y licencias

Versiones fijadas en `package-lock.json`. Auditoría de dependencias de producción ejecutada el 31 de octubre de 2026: ningún aviso conocido devuelto por `npm audit --omit=dev`; no es garantía frente a vulnerabilidades futuras.

| Componente | Uso | Licencia / obligación |
| --- | --- | --- |
| Astro 7.4.4 | Sitio estático, desarrollo y compilación | MIT; conservar avisos. |
| PDF.js 6.4.299 | Parseo/render PDF en worker | Apache-2.0; conservar licencia/avisos. Recursos estándar y CMaps incluyen sus licencias propias. |
| JSZip 3.10.2 | Empaquetado EPUB | Dual MIT/GPLv3; se utiliza bajo MIT y se conserva su aviso. |
| Tesseract.js 7.0.0 y Tesseract.js-core | OCR local WASM | Apache-2.0, con componentes de terceros; conservar avisos de Tesseract/Leptonica y archivos de licencia del paquete. El cliente acotado del protocolo está inspirado en la API de su código Apache. |
| Modelos eng/spa de tessdata | Datos OCR | Apache-2.0 en el proyecto de origen; se descargan derivados cuantizados de naptha/tessdata con SHA-256 verificado. |
| saxes 6.0.0 | Validación XML | ISC; conservar aviso. |
| sharp/libvips (dependencia de Astro) | Herramientas de construcción, fuera de la salida estática | sharp Apache-2.0; binarios libvips LGPL-3.0-or-later. No se distribuyen esos binarios con el sitio. Redistribuir node_modules o modificar/enlazar libvips requiere revisar las obligaciones LGPL. |
| Lightning CSS (herramienta de Astro/Vite) | Compilación CSS, fuera de la salida estática | MPL-2.0. No se distribuyen sus binarios ni código modificado; distribuir modificaciones de esos archivos requiere cumplir MPL. |
| EPUBCheck 5.4.0 | Solo pruebas | BSD-3-Clause y dependencias indicadas por W3C; no se distribuye al navegador. |
| Playwright, TypeScript, tsx, reportlab, pypdf, Pillow | Solo desarrollo/pruebas | Sus licencias se conservan en instalaciones; no se incluyen en salida estática. |

`npm run prepare:assets` copia licencias principales a `public/licenses/` y preserva las licencias de los recursos PDF.js/core OCR. Los paquetes conservan las demás en `node_modules`. No se atribuye una licencia propia a recursos ajenos.

**Comic Sans MS es propietaria.** Se ha comprobado su instalación local en macOS. No se redistribuye ni se generan contornos exportados de esa fuente. El uso CSS de una fuente instalada no garantiza su presencia en otros dispositivos. Para una fuente web uniforme, obtener una licencia adecuada e integrar el archivo autorizado; no basta con copiarla del sistema. Referencias: [Microsoft, familia Comic Sans](https://learn.microsoft.com/en-us/typography/font-list/comic-sans-ms) y [FAQ de redistribución](https://learn.microsoft.com/en-us/typography/fonts/font-faq).

**PyMuPDF/MuPDF**, usado únicamente por el script heredado que ya existía en `tools/`, tiene licencia dual AGPL/comercial. No es dependencia ni componente del sitio nuevo; no se ha ejecutado para convertir documentos de la aplicación. Un servicio propietario que quisiera incorporarlo tendría que revisar AGPL o contratar la licencia comercial. [Licencias de MuPDF](https://mupdf.com/licensing/) y [FAQ de PyMuPDF](https://pymupdf.readthedocs.io/en/latest/faq/index.html).

Es posible usar comercialmente las dependencias del conversor nuevo bajo sus licencias indicadas cumpliendo avisos y condiciones. Una auditoría jurídica completa y los derechos de los documentos/fuentes añadidos quedan a cargo de la instalación comercial concreta.

La inspección de `package-lock.json` encontró esas licencias copyleft de herramientas de construcción; no se ignoraron por ser transitivas. Véanse [licencia de sharp/libvips](https://sharp.pixelplumbing.com/install/#licensing) y [licencia de Lightning CSS](https://github.com/parcel-bundler/lightningcss/blob/master/LICENSE).
