# Validación de la versión local

Fecha: 31 de octubre de 2026. No se ha publicado ni se ha probado AdSense real. Los documentos de prueba son sintéticos propios. Las pruebas no demuestran fidelidad de todos los PDF ni accesibilidad integral de los EPUB.

## Resultado automatizado

- `npm run check`: sin errores, advertencias ni diagnósticos pendientes de Astro/TypeScript.
- `npm test`: 8 pruebas aprobadas, incluyendo configuración que protege el prototipo anterior, XML/metadatos, enlaces, mensajes, inventario de texto, fórmulas, tablas y paquete EPUB.
- Pruebas E2E: 11 conversiones con descarga real, ocho rechazos previstos, cancelación/reintento, cancelación durante inicialización de OCR, móvil simulado y revisión de solicitudes. Cero errores JavaScript sin tratar.
- `npm run test:security`: conversión en el origen privado, lectura documental denegada desde el padre, política privada sin dominios publicitarios y script de prueba bloqueado por CSP. Se usan dos servidores locales reales, con todas las protecciones normales del navegador.
- EPUBCheck 5.4.0: los 11 EPUB del conjunto pasaron con **0 fatales, 0 errores y 0 advertencias**. Se valida el archivo generado, no uno de demostración preexistente. EPUBCheck usa en esta versión las reglas de EPUB 3.4 para paquetes EPUB 3.
- `npm audit --omit=dev`: sin vulnerabilidades conocidas reportadas en el momento de la revisión.

Las evidencias generadas están en `tests/output/`: EPUB, informes JSON por caso, `e2e-results.json`, `security-results.json`, `epubcheck.log` y capturas de escritorio/móvil. Ninguna se copia al sitio de producción. El resumen de esta ejecución se conserva en `docs/validation-results.json`.

## Casos

| Documento propio | Resultado observado | Aviso/límite |
| --- | --- | --- |
| Texto simple y listas | Párrafos y títulos seleccionables, metadatos y cubierta generada | Revisar saltos de párrafo en otros libros. |
| Dos columnas | Toda la columna izquierda antes de la derecha | Aviso de orden inferido; no valida diseños de tres o más columnas. |
| Tabla regular | `table`, encabezados y celdas con texto | Criterios conservadores; tablas combinadas no equivalen a este caso. |
| Fórmula con superíndice | Recorte PNG con el texto circundante adaptable | Sin MathML ni transcripción inventada; contenido de fórmula no accesible como texto. |
| Ilustración con pie | Recorte de dibujo y `figcaption` de texto | La descripción del contenido gráfico no se genera. |
| Escaneo limpio en español | OCR real, 32 fragmentos en el inventario, texto adaptable | Se avisa que OCR puede equivocarse; no se afirma recuperación perfecta. |
| Escaneo con cabecera digital parcial | OCR completo sustituye la capa parcial; cabecera aparece una vez | Aviso de sustitución de la capa parcial. |
| Libro mixto | Texto digital en la primera página y OCR en la segunda | Una sola fuente de texto por página. |
| Notas/enlaces | Enlace HTTPS y destino interno a la segunda página; texto de nota conservado | Enlace javascript descartado con aviso. Relación llamada/nota no verificada. |
| Unicode | Acentos, signos, griego y cirílico recuperados | Sin corpus editorial CJK/RTL real validado. |
| Libro de 40 páginas | 40 documentos XHTML, inventario completo | No equivale a probar PDFs enormes o muy ilustrados. |
| Cifrado y permisos de copia restringidos | Rechazados con explicación | Requieren una copia desbloqueada/autorizada. |
| Vacío, cabecera falsa y PDF dañado | Rechazados sin descarga | No se disfraza el fallo como éxito. |
| 151 páginas | Rechazado antes de procesar contenido | Límite configurado: 150. |
| Libro totalmente blanco | Rechazado por ausencia de contenido adaptable | Una página vacía en un libro con texto puede conservar su marcador. |
| Contenido girado/no recuperable | Rechazado | Usar una exportación horizontal o conservar el PDF. |

La igualdad de IDs detecta duplicaciones/omisiones introducidas por nuestra reconstrucción sobre el texto extraído; **no** detecta por sí sola contenido que nunca fue extraído ni demuestra orden correcto. El detector de ilustraciones y las asociaciones de pies tienen umbrales y requieren revisión visual en documentos distintos de este corpus.

## Lectores

**Apple Books en este Mac:** se importó y abrió `table.epub`. La vista de lectura expuso “Datos del jardín”, tabla con “Especie/Cantidad, Roble/12, Pino/24” y el párrafo posterior. La cubierta fue la composición generada identificada, no una supuesta portada extraída. Verificación de apertura/lectura; no se completó una matriz exhaustiva de búsqueda/índice/imágenes/Unicode para todos los documentos en Books.

**Thorium 3.5.1 oficial para ARM64:** se importó el mismo EPUB y se verificaron encabezado, tabla semántica con sus filas/celdas y párrafo posterior. El control de texto cambió de 100 % a 125 % y el contenido siguió legible. No se confunde esta prueba con una garantía para todos los libros o lectores.

**Kobo:** investigación de [su especificación oficial EPUB](https://github.com/kobolabs/epub-spec). Sus motores y CSS tienen diferencias entre plataformas y entre EPUB/KEPUB; no se ha probado un dispositivo Kobo físico. Se usa XHTML/CSS sencillo e imágenes PNG, sin scripts ni dependencias de MathML.

**Send to Kindle:** [servicio oficial](https://www.amazon.com/sendtokindle) que acepta EPUB y lo convierte. No se realizó un envío a una cuenta Amazon. Ese paso transmite el archivo a Amazon y puede alterar tablas, imágenes, fuente o navegación. No es lectura nativa universal de EPUB por USB y no se promete equivalencia con Books/Thorium.

## Navegadores, rendimiento y accesibilidad

Las conversiones se ejecutaron con Brave/Chromium y Chrome for Testing 156 en macOS ARM64, con PDF.js y OCR reales. Vista móvil: 390 × 844 y reducción de CPU ×4 para el caso simple; flujo de selección/resultado sin desbordamiento horizontal. Los tiempos medidos figuran en el JSON. Son pruebas de escritorio simulado, **no mediciones de un móvil físico**. Safari, Firefox, iOS y Android físicos permanecen pendientes; no se ha demostrado compatibilidad universal.

La estructura web conserva etiquetas, controles de teclado, foco visible, título semántico, actualizaciones moderadas y `prefers-reduced-motion`. Se inspeccionó el árbol accesible del conversor y de los lectores. Falta una auditoría completa con VoiceOver/NVDA, ampliación al 400 % y pruebas de usuarios. La accesibilidad web no convierte en accesible el contenido de fórmulas o gráficos rasterizados.

## Pendientes explícitos

Licencia web de Comic Sans para dispositivos sin la fuente; CMP/AdSense reales y hosts HTTPS del despliegue; prueba física de móvil/Kobo/Kindle; más corpus de OCR degradado, tablas complejas, RTL/CJK y diseños editoriales; semántica matemática verificable y relaciones avanzadas de notas. La versión funciona con los mecanismos descritos y rechaza/advierte fuera de sus límites; estos pendientes no están simulados.

Durante una corrección de configuración, una construcción llegó a escribir en el directorio del prototipo anterior. Se restauraron sus archivos desde la copia local y los cambios originales registrados, comprobando el módulo previo byte por byte y el mismo diff previo en HTML/CSS. La salida actual queda fijada en configuración y comando a `.cache/astro`; una prueba verifica que no apunte a `dist/`.

## Integración de la interfaz elegida

Se sustituyeron los paneles decorativos por la composición aprobada. Comprobaciones nuevas: orden temporal de los trazos del título, captura del desarrugado, scripts externos compatibles con CSP, mensajes de presentación limitados a valores fijos, igualdad de píxeles entre la cubierta mostrada y la incluida en cada EPUB y botón de descarga dentro del iframe en móvil. Los informes avanzados permanecen plegados. La prueba unitaria adicional eleva el conjunto a nueve casos.

## Localización en español e inglés americano

La revisión bilingüe añade un catálogo con claves y parámetros, doce pruebas unitarias en total y `npm run test:i18n`. Se verificaron preferencia regional del navegador, primer idioma compatible, respaldo en-US, elección manual persistida, navegación informativa, almacenamiento bloqueado, cambio durante la carga de OCR sin perder el archivo, conservación de los enlaces de descarga, informes y errores localizados y encabezado sin solapamiento a 320/390 px. Los EPUB generados en estas pruebas conservan el idioma elegido del libro o `und` cuando faltan metadatos; el texto original no se traduce. Evidencias: `tests/output/localization-results.json` y capturas `english-*.png`.
