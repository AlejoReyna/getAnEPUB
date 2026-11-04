# Publicidad: integración preparada, desactivada

El documento previo `ADSENSE.md` se conserva como material anterior. Este documento describe el código actual. No hay cuenta aprobada, anuncios reales, ingresos previstos ni CMP ficticia. No se ha publicado ningún cambio.

## Aislamiento

Sin anuncios, la instalación local puede usar una página pública y un iframe privado en el mismo origen. Ningún script externo se carga. Al activar la configuración publicitaria, el proceso de construcción exige **dos hosts HTTPS diferentes**: `PUBLIC_SITE_ORIGIN` y `PUBLIC_CONVERTER_ORIGIN`.

Se generan dos salidas:

1. `build/public`: página pública, información útil, políticas y espacio de publicidad. Con anuncios configurados, no contiene la ruta de conversión ni sus recursos de motores/modelos.
2. `build/private`: conversor, motores y modelos. Su `/` redirige a `/convert/`. La CSP de todo ese host prohíbe scripts externos; no se inserta el componente de publicidad. El iframe solo permite scripts propios, descarga y el origen necesario para workers. `frame-ancestors` admite el origen público exacto.

La política del navegador impide que un script del origen público lea archivos o DOM del iframe privado. No hay transferencia de archivos entre frames ni envío de altura calculada a partir del documento. El mensaje de geometría admite seis valores fijos para reservar espacio al iframe; el padre valida origen, ventana emisora y campos exactos. La página pública también puede enviar al conversor una preferencia de idioma (`es` o `en-US`), validada por origen, emisor y campos exactos. El canal de geometría permite conocer el estado visual de la interfaz, pero no el contenido, título, nombre, progreso numérico o miniatura del documento. Un worker aislado por sí solo no sería esta protección. La prueba `test:security` usa dos orígenes HTTP locales, convierte dentro del privado y verifica denegación de acceso desde el padre y bloqueo CSP de un script externo. La separación de hosts HTTPS reales y las cabeceras de un alojamiento futuro deberán comprobarse tras desplegarlo.

## Configuración futura

Copiar `.env.example` como `.env` y definir los campos allí descritos. La construcción valida también archivos `.env.production`/`.local`; el entorno del proceso tiene prioridad. `PUBLIC_ADS_ENABLED=true` falla si faltan hosts separados, un cliente `ca-pub-` de 16 dígitos, slot de 10 dígitos, revisión de privacidad o adaptador local de consentimiento. Un formato de ID válido no prueba aprobación ni autorización para servir anuncios.

El adaptador indicado por `PUBLIC_CONSENT_ADAPTER` debe ser un archivo **local** como `/privacy/consent-adapter.js`. Se deja pendiente porque no se proporcionó una CMP real ni configuración territorial/identificadores. El adaptador de una CMP revisada debe emitir `get-an-epub:ads-consent` con `detail: {adsAllowed: true, privacyReady: true}` únicamente cuando corresponda servir anuncios según la decisión y los requisitos aplicables. No debe proporcionar esos valores por defecto. El evento es un contrato de integración, no sustituye una CMP certificada ni una revisión jurídica. La retirada de consentimiento debe detener publicidad/reiniciar la página pública de acuerdo con la CMP, sin recargar el conversor.

Solo después de ese evento se crea un único slot y se carga el script oficial de AdSense. No se actualiza por progreso ni por documento. La ausencia de consentimiento o el bloqueo de AdSense deja el conversor operativo. El espacio está separado de controles, marcado “Publicidad” y tiene altura reservada al activarse. Sin anuncios no se presenta un gran rectángulo vacío.

Para una activación real faltan: autorización del propietario, cuenta/sitio aprobados, cliente/slot reales, CMP y textos/identidad de responsable revisados, ads.txt con el editor real cuando corresponda y verificación del alojamiento en ambos hosts. No se incluyeron valores inventados ni un banner que simule consentimiento válido. Las listas CSP públicas pueden requerir ajustes a dominios oficiales efectivamente utilizados por la integración aprobada; nunca ampliar la CSP privada.

## Fuentes consultadas

- [Políticas de colocación de anuncios, Google](https://support.google.com/adsense/answer/1346295): separar anuncios de acciones/descargas y evitar clics accidentales.
- [Requisitos de CMP de Google](https://support.google.com/adsense/answer/13554020): requisitos de certificación y TCF en EEE, Reino Unido y Suiza.
- [Política de consentimiento de la UE](https://www.google.com/about/company/user-consent-policy/): tratamiento publicitario separado del tratamiento documental.

Las políticas cambian. Esta preparación técnica no garantiza la aprobación de AdSense ni el cumplimiento de una instalación todavía no configurada.
