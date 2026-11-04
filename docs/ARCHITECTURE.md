# Arquitectura y prueba técnica

Decisión: procesamiento local, sin servidor de archivos, cola, base de datos ni almacenamiento persistente. La prueba con documentos sintéticos produjo texto seleccionable, columnas ordenadas, tabla XHTML y OCR real. El escaneo limpio tardó menos de un segundo en el equipo de prueba; el caso de 40 páginas, alrededor de dos segundos. Son mediciones de esos casos en un Mac, no estimaciones de duración para usuarios o móviles.

PDF.js/JSZip del prototipo son aprovechables; su EPUB de páginas completas en imágenes no es adaptable. PyMuPDF no se incorpora por su licencia dual AGPL/comercial y porque no elimina por sí solo la necesidad de reconstrucción editorial. Un servidor abriría otra superficie de carga/retención de documentos sin una mejora demostrada para estos casos. Documentos editoriales difíciles siguen necesitando herramientas especializadas o revisión humana.

## Separación de responsabilidades

- `contracts.ts`: contratos de progreso, opciones, bloques semánticos, recursos, cobertura y resultado.
- `pipeline.ts`: valida y orquesta PDF.js, renderiza una página a la vez, selecciona extracción/OCR, obtiene miniatura/recortes y administra recursos. Es independiente de los elementos de la interfaz.
- Worker nativo de PDF.js: parseo PDF, fuentes y decodificación; nunca se crea su visor ni capa de scripting.
- `ocr.ts`: cliente acotado del protocolo de Tesseract.js 7, con el worker bajo control desde su construcción. A diferencia de esperar un `createWorker` sin referencia cancelable durante el arranque, permite terminarlo y rechazar todos sus trabajos pendientes. Cambiar la versión de Tesseract requiere ejecutar la prueba de integración.
- `semantic.ts` dentro de `book.worker.ts`: agrupa por posición y tipografía; decide tablas, columnas y recortes; hace inventario de todos los fragmentos. Las trayectorias de texto Unicode no se rasterizan como salida principal.
- `book.ts` dentro del mismo worker: XHTML, CSS fluido, OPF, índice, imágenes, ZIP y validación de referencias/XML/CRC. No hay ancho/alto de página fijo en el contenido del EPUB.
- `ui/converter.ts`: estados, selección/arrastre, opciones, mensajes decorativos, progreso, errores, cancelación y descarga. No comparte datos con la página pública.

## Reconstrucción y cobertura

Se detecta texto escaso y la presencia de imágenes dominantes para reconocer escaneados. El OCR de una página sustituye toda la extracción de esa página; no se superponen ambas fuentes. Idiomas instalados: español/inglés. La puntuación de confianza interna de Tesseract permite rechazar reconocimiento muy deficiente; no se presenta como porcentaje de calidad del EPUB.

Las tablas requieren varias filas, posiciones alineadas, encabezados reconocibles y datos regulares. Las ambiguas se conservan como imagen. Los títulos se infieren por tamaño y patrones; el índice original, cuando existe, tiene prioridad. Dos columnas se ordenan por separado y generan un aviso. Se conserva la dirección RTL detectada en texto digital, pero no hay un corpus RTL/CJK editorial validado.

Las fórmulas detectadas se recortan sin intentar una transcripción semántica no verificable. El raster de trabajo se inspecciona para localizar tinta fuera de las cajas de texto; regiones residuales suficientemente grandes se recortan. Si intersectan un bloque, ese bloque se representa una sola vez dentro del recorte. Los umbrales pueden perder pequeños ornamentos, unir elementos cercanos o preservar texto como imagen. Una región casi del tamaño de la página provoca rechazo, no un EPUB fijo encubierto.

Cada fragmento tiene ID. Se exige que el conjunto de IDs representados coincida con el extraído/reconocido sin repeticiones. Se conserva una entrada por página y un marcador para páginas vacías en un documento que sí tenga texto. Esta comprobación no encuentra contenido que PDF.js/OCR no haya extraído, ni garantiza orden o interpretación. La inspección visual/lectura comparada sigue siendo necesaria.

## Seguridad, datos y limpieza

Entrada no confiable: cabecera real, tamaño, páginas, permisos, cifrado y dimensiones se comprueban antes de continuar. `stopAtErrors` evita continuar tras errores graves de decodificación o imágenes que exceden el límite. Los recursos de PDF.js son locales; no se admiten URLs documentales ni fetch de rutas procedentes del PDF.

No se ejecutan acciones JavaScript, archivos adjuntos, formularios activos, rich media ni XFA. Se renderiza la apariencia visible del PDF. No se usan `eval`, HTML documental ni un visor PDF interactivo. Metadatos y texto se escapan como XML; en la interfaz se usan `textContent` y DOM creado por la aplicación. Los enlaces admiten HTTP, HTTPS, mailto y destinos propios de página; no credenciales ni javascript/data/file. Las declaraciones DTD/entidades y contenido activo se rechazan al validar el EPUB.

La CSP privada permite scripts/workers propios y compilación WASM; no permite JavaScript eval, scripts publicitarios, objetos, formularios enviados ni conexiones externas. Las cabeceras incluyen `nosniff`, referencia desactivada y permisos de cámara/micrófono/geolocalización desactivados. Aplicarlas en el alojamiento es obligatorio: una etiqueta meta no puede sustituir `frame-ancestors`.

Cancelación, límite temporal y errores terminan workers, cancelan render, destruyen el documento y rechazan promesas pendientes. Los canvas se vacían; los URL blob se revocan al convertir otro archivo o salir. No hay registros de nombres o contenido. No se promete borrado forense de memoria; el navegador gestiona su liberación final. El PDF, texto, nombres, miniatura y metadatos no se transmiten a publicidad, analítica ni servidores documentales.

Estados: selección → validación/análisis → extracción u OCR por página → reconstrucción → compresión/comprobación → resultado; error/cancelación vuelve a selección. Cada trabajo crea motor y UUID nuevos, sin efectos persistentes ni descargas automáticas duplicadas. Un reintento vuelve a procesar el archivo; el bloqueo de concurrencia evita carreras en una pestaña.

## Animación y tipografía

El título tiene texto semántico único y SVG decorativo. Las mismas trayectorias centrales del diseño aprobado revelan el texto Comic Sans mediante máscaras, en orden de escritura; no se usan recortes rectangulares ni se distribuyen archivos de fuente. El subtítulo se aplana mediante doce tiras con pliegues y perspectiva. `prefers-reduced-motion` presenta todo sin animación; el selector está disponible desde el principio y el espacio del título está reservado.

La fuente se solicita mediante `local()`. No se copia Comic Sans de macOS al sitio ni al EPUB. Una fuente licenciada puede integrarse con el nombre reservado `Comic Sans Licensed`; la ausencia local se anuncia en la interfaz.

## Integración de la interfaz aprobada

La página pública contiene únicamente encabezado, título, subtítulo, conversor y enlaces informativos. Las opciones avanzadas y los informes permanecen plegados. El conversor conserva selección/arrastre, progreso medido o indeterminado, cancelación, errores y descargas reales. La imagen mostrada al terminar es la misma cubierta PNG empaquetada en el EPUB; no una ilustración de demostración.

Un canal de presentación transmite solamente uno de seis valores constantes (`idle`, `options`, `processing`, `result`, `report`, `error`) para reservar espacio al iframe. El padre exige origen y ventana emisora correctos y rechaza valores o campos adicionales. No acepta HTML, dimensiones medidas, texto, nombres, porcentajes, miniaturas ni archivos. El canal revela el estado de presentación, no el contenido del documento. Las alturas dependen únicamente del valor fijo y del ancho de pantalla.

`assetsInlineLimit: 0` mantiene los scripts de entrada como archivos propios; así, las animaciones y el canal de presentación funcionan con la CSP de producción sin habilitar scripts inline.

## Localización

`src/i18n/catalog.ts` contiene mensajes tipados en `en-US` y `es`, con parámetros, plurales explícitos y errores identificados por código. Workers y motor no envían frases para traducir: transmiten claves y parámetros. La interfaz traduce progreso, errores, avisos e informes según la selección actual. El informe JSON incluye el idioma y conserva las claves de aviso.

`/locale-init.js`, propio y compatible con CSP, selecciona antes de pintar la preferencia manual guardada, después el primer idioma compatible de `navigator.languages`, y finalmente `en-US`. No guarda la detección automática. El selector guarda exclusivamente la elección manual en `get-an-epub:language`; el sitio funciona si el almacenamiento está bloqueado. Los cambios de preferencia del navegador se aplican si no existe una elección guardada. No se usa un servicio externo de identificación.

La página pública envía al iframe únicamente `{type: "get-an-epub:language", locale: "en-US" | "es"}`. El receptor exige origen y ventana padre correctos y campos exactos. El cambio no recarga el iframe ni altera un trabajo activo. El canal existente de geometría sigue sin incluir información del documento.

Las pantallas y páginas informativas incluyen ambas versiones, con solo una visible y accesible. Los títulos animados tienen trayectorias separadas para cada idioma. `lang`, metadatos, atributos accesibles, números y porcentajes se actualizan conjuntamente.

El idioma del libro usa por defecto los metadatos del PDF o `und` si no hay datos utilizables. Una selección explícita tiene prioridad. Nunca se infiere del idioma de la interfaz ni cambia el OCR automáticamente. El EPUB mantiene el texto original. Las etiquetas añadidas al EPUB usan español para libros españoles e inglés como respaldo, con marcas de idioma en contenido generado.
