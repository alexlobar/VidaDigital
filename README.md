# Vida digital

Tus suscripciones, cuentas, apps, dispositivos, licencias, copias de seguridad y webs en un solo sitio, enlazados entre sí, con el gasto total, lo que vence en los próximos 30 días, qué cuentas no tienen verificación en dos pasos, qué copias tocan y cómo va el cambio de móvil. HTML, CSS y JavaScript vanilla: sin dependencias, sin build, offline, con los datos en `localStorage`.

**Versión documentada: 2.3.0** (11-11-2026) · esquema de datos **1**.

| Versión | Cambios |
|---|---|
| 2.3.0 | **Contraseña** (datos y copias cifrados con AES-256). **Guardar copia en Drive** con el menú Compartir. **Duplicar**. **Selector visual de logos** con vista previa. **Resumen a tu gusto** (ordenar y ocultar tarjetas y secciones). **Botón + flotante**. **Color de acento** |
| 2.2.0 | **Buscador global** en el Resumen. Sección **Programas** con su tarjeta *Cambio de ordenador*. **Etiquetas** libres con filtro en cada lista. **Archivar**. **Importar desde Excel** (pegar celdas o CSV) con plantilla |
| 2.1.0 | Secciones **Licencias y claves** y **Copias de seguridad** (con «Hecha hoy» y tarjeta en el Resumen). **Enlaces** entre elementos de cualquier sección, con sugerencias |
| 2.0.0 | Sin barra de navegación: el Resumen es el menú y cada sección vuelve con ‹. Logos de marca en todas las listas. Pruebas gratuitas, suscripciones compartidas (tu parte) y cuentas para borrar |
| 1.1.0 | Sección **Apps** con el estado de cada una en el cambio de móvil, botón ✓ y tarjeta de progreso en el Resumen |
| 1.0.0 | Suscripciones, cuentas, dispositivos y webs |

Sigue la estructura de `../Base-app-web.md`.

## Archivos

```
index.html             Marcado: vistas, formulario y navegación
manifest.json          Metadatos PWA
sw.js                  Service worker (caché offline, prefijo vida-digital-v)
icon.svg               Icono (navegador y escritorio)
icon-180.png           iPhone
icon-192.png           Android
icon-512.png           Android
icon-maskable-512.png  Android, a sangre
css/styles.css         Estilos en 13 secciones; tokens en :root
js/utils.js            Fechas, dinero, DOM, catálogos, KINDS y LA VERSIÓN
js/logos.js            Logos de marca (Simple Icons, CC0) y cómo encontrar el de cada elemento
js/store.js            localStorage: carga, saneado, migraciones y escritura
js/calc.js             Gasto, próximos cobros, caducidades, seguridad, copias y cambios de equipo
js/sheet.js            Formato Excel: columnas, plantilla y lectura de lo pegado o importado
js/ui.js               Todo lo que toca el DOM
js/app.js              Eventos, exportación/importación y arranque
```

Orden de carga = orden de dependencia: `utils → logos → store → calc → sheet → ui → app`.

## Pantallas

**Resumen (el menú).** Arriba, el **buscador global**: busca en todas las secciones a la vez (archivados incluidos, marcados como tal) y, mientras tiene texto, sustituye al resto del Resumen por los resultados. `#trabajo` filtra por etiqueta y se combina con texto (`#trabajo google`); Esc lo vacía. Debajo, un recuadro por sección con su dato principal (gasto al mes, cuentas sin 2FA, apps migradas…); tocarlo abre la sección. No hay barra de navegación: cada sección vuelve con ‹ (o con el botón atrás del móvil) y el logo de la cabecera también lleva aquí. Si hay apps apuntadas, debajo sale **Cambio de móvil**: cuántas están migradas, una barra de progreso y la lista de las que faltan (primero las instaladas a medias). Cuando están todas, aparece *Empezar otro cambio de móvil*, que las devuelve a «Pendiente». Después, el gasto al mes y al año de las suscripciones activas (más el coste anual de los dominios, prorrateado), desglosado por categoría. Debajo, lo que pasa en los próximos 30 días: cobros, pruebas gratis que acaban, renovaciones, dominios y licencias que caducan y garantías que se acaban. Después, cuántas cuentas no tienen 2FA (empezando por las importantes) y, solo si hay algo que hacer, las copias de seguridad que tocan y las cuentas para borrar.

**Suscripciones.** Servicio, categoría, precio, periodicidad, próximo cobro, fin de la prueba gratis, con quién se comparte y tu parte, cuenta asociada, método de pago, si está activa, web, logo y notas. Las inactivas no suman al gasto y van al final de su grupo. Una prueba gratis sale en «Próximos 30 días» en ámbar, para darla de baja antes del cobro.

**Cuentas.** Servicio, categoría, usuario o email, tipo de 2FA, cómo recuperarla, si es importante, estado (la uso / quiero borrarla / ya la he borrado), web, logo y notas. Sin contraseñas (ver Decisiones). Las marcadas «Quiero borrarla» salen en la tarjeta *Cuentas para borrar* del Resumen; las borradas no cuentan en Seguridad.

**Apps.** Las aplicaciones del móvil: nombre, categoría, estado en el cambio de móvil (pendiente, instalada, migrada, no la paso), cómo se entra (teléfono, email, Google, Apple…), cuenta o usuario, qué hay que pasar a mano (chats, autenticador, partidas…) y notas. El círculo ✓ de cada fila la marca como migrada sin abrir el formulario.

**Programas.** Lo instalado en el ordenador: nombre, categoría, estado en el cambio de ordenador (pendiente, instalado, migrado, no lo paso), de dónde se instala, cuenta, qué hay que pasar (ajustes, extensiones, partidas, activar la licencia…), web de descarga y notas. Funciona igual que Apps: ✓ en cada fila y la tarjeta **Cambio de ordenador** en el Resumen con *Empezar otro cambio de ordenador*. Las licencias se enlazan al programa para tenerlas a mano al reinstalar.

**Dispositivos (Equipos).** Nombre, tipo, marca y modelo, número de serie, fecha de compra, fin de garantía, precio, estado y notas.

**Licencias y claves.** Programa o juego, categoría, dónde está la clave (nunca la clave en sí), cuenta asociada, dónde se compró, fecha de compra, caducidad (vacía = para siempre), precio y notas. Las que caducan salen en «Próximos 30 días».

**Copias de seguridad.** Qué se copia, categoría, dónde se guarda, si la haces tú o es automática (y solo hay que comprobarla), cada cuánto y la última vez. Cada fila tiene un botón **✓ Hoy** que apunta la copia como hecha (o comprobada) hoy, con *Deshacer*. Estados: *Sin hacer*, *Atrasada*, *Toca en N d* (menos de una semana) y *Al día*. Las que no están al día salen en la tarjeta *Copias de seguridad* del Resumen.

**Dominios y webs.** Nombre, tipo (dominio, web, app publicada, repositorio), dirección, proveedor, caducidad, coste anual, si se renueva sola y notas.

**Etiquetas.** Todos los formularios tienen *Etiquetas* («trabajo, familia, compartido…», separadas por comas), con las ya usadas debajo para añadirlas de un toque. En cada lista sale una fila de etiquetas con cuántos elementos tiene cada una: tocar una filtra la lista; tocarla otra vez quita el filtro. Las filas enseñan sus etiquetas.

**Archivar.** El formulario tiene *Archivar* (y *Desarchivar*), con Deshacer. Lo archivado se conserva pero deja de contar: no suma al gasto, no avisa en Próximos, Seguridad ni Copias, y no cuenta en los cambios de equipo. Va al final de su lista, plegado en *Archivados (N)*.

**Importar desde Excel** (en Ajustes y en la bienvenida). Se pegan celdas copiadas de Excel (cabecera incluida) o se elige un CSV. El formato es el mismo de *Exportar a Excel*: una columna `tipo` con la sección (suscripción, cuenta, app, programa, dispositivo, licencia, copia o web; singular o plural) y una columna por campo, con el nombre de la etiqueta del formulario. Solo es obligatoria la del nombre («Servicio» o «Nombre»). Se entienden fechas `18/12/2026`, `18-12-26` o `2026-12-18`, importes `13,99` o `1.234,56 €`, casillas `sí`/`x`, y los desplegables por su texto («Cada mes», «App autenticadora»), sin importar tildes ni mayúsculas. Antes de importar dice cuántas filas entran, cuáles se saltan y por qué, y qué columnas no reconoce. Si ya existe algo con el mismo nombre en la misma sección, se completa con la fila (las celdas vacías no borran nada) en vez de duplicarlo. Sin columna `tipo`, se elige la sección en el desplegable. El enlace *plantilla* descarga un CSV con la cabecera y un ejemplo por sección.

**Contraseña** (Ajustes → Contraseña). *Poner contraseña* (mínimo 8 caracteres, dos veces) cifra los datos guardados y, desde entonces, la app arranca en una pantalla de candado que la pide. *Cambiar* y *Quitar* piden la actual. Las copias que se descargan o comparten también salen cifradas; al importarlas se pide la contraseña que tenía la app al exportarlas. *He olvidado la contraseña* (en el candado) empieza de cero y guarda el sobre cifrado aparte por si la recuerdas. El CSV de *Exportar a Excel* no va cifrado.

**Guardar copia en Drive.** Abre el menú *Compartir* del sistema con la copia: en el móvil, Drive, OneDrive, un correo o un chat contigo mismo. Si el navegador no comparte archivos, la descarga. El aviso de copia pendiente usa este mismo botón.

**Duplicar** (en el formulario). Abre un elemento nuevo con todo lo del original, enlaces y etiquetas incluidos, y «(copia)» en el nombre. No se guarda hasta pulsar Guardar.

**Selector de logos.** Junto al campo *Logo* hay una vista previa del logo que saldrá (cambia mientras escribes el nombre, la web…) y el botón *Elegir*, que abre una cuadrícula con buscador de todas las marcas. *Automático* vuelve a dejar que la app lo adivine.

**Resumen a tu gusto** (Ajustes → Resumen). Dos listas, *Secciones del menú* y *Tarjetas*, con ↑ ↓ para ordenar y una casilla para mostrar u ocultar. Una sección oculta sigue existiendo y sale en el buscador. Las tarjetas que dependen de los datos (cambios de equipo, copias, cuentas para borrar) solo aparecen cuando tienen algo, aunque estén marcadas.

**Botón + flotante** (abajo a la derecha). En una sección añade a esa sección; en el Resumen abre un menú para elegir dónde. En Ajustes no sale. En el móvil sustituye al *+ Añadir* de la cabecera.

**Color de acento** (Ajustes → Apariencia). Ocho colores, cada uno ajustado para el tema oscuro y el claro.

**Ajustes.** Tema y color, Resumen, contraseña, recordatorio de copia, guardar en Drive, descargar e importar copia, exportar CSV, importar desde Excel, botón *Instalar*, línea de versión y espacio (`Version-y-espacio.md`) y borrar todo.

Cada elemento lleva el logo de su marca: se busca por el campo *Logo* si lo rellenas, luego por el nombre, la web y cada palabra del nombre o del modelo («Pixel 8» → Google). Si la app no conoce la marca, salen las iniciales sobre un color fijo para ese nombre.

**Enlaces.** Todos los formularios tienen *Enlazado con*: un desplegable para enlazar el elemento con otros de cualquier sección (la suscripción de Netflix con su cuenta y su app; Office con el portátil donde está activado). Arriba salen como *Sugeridos* los que tienen el mismo logo o el mismo nombre. Los enlazados se ven como pastillas con su logo; tocar una abre ese elemento (si hay cambios sin guardar, pregunta antes) y ✕ quita el enlace. En las listas, cada fila acaba con «🔗 Gmail, Netflix +2».

Cada lista se agrupa por categoría en el orden del catálogo, y a partir de 6 elementos aparece un buscador (sin tildes ni mayúsculas). El enlace ↗ de cada fila abre la web del elemento.

## Instalación

- **Ordenador:** doble clic en `index.html`. Funciona con `file://`, aunque sin caché offline ni instalación. Si quieres un acceso directo como el de *Mis cuentas*: `msedge.exe --app="file:///…/VidaDigital/index.html"`.
- **GitHub Pages, la primera vez:** repositorio público, *Add file → Upload files*, entra **dentro** de la carpeta `VidaDigital`, selecciona todo y arrástralo. *Settings → Pages*: rama `main`, carpeta `/ (root)`.
- **Móvil:** abre la dirección en Chrome y pulsa *Ajustes → Instalar la app* (el menú ⋮ de Chrome dirá que ya está instalada por culpa de Hábitos; ver `PWA-Android-ya-instalada.md`).

> ⚠️ **No subas nunca a GitHub un `vida-digital-*.json` o `.csv`**: el repositorio es público y llevan tus cuentas. El `.gitignore` los excluye, pero la subida desde la web de GitHub no lo mira: asegúrate de no arrastrarlos.

**Cada versión nueva:** sube la versión en los tres sitios, sube **todos** los archivos juntos en un solo commit y titúlalo `vX.Y.Z`.

## La versión, en tres sitios

| Dónde | Qué |
|---|---|
| `js/utils.js` | `VERSION = '2.3.0'` y `BUILD_DATE` — la fuente de verdad |
| `sw.js` | `CACHE = 'vida-digital-v2.3.0'` |
| `index.html` | `<html data-build="2.3.0">` |

Si no coinciden, la app avisa al arrancar de que el navegador ha mezclado versiones.

## Personalización

- **Colores:** variables de `:root` en `css/styles.css`; el tema claro solo las redefine en `:root[data-theme="light"]`.
- **Catálogos** (categorías, tipos, periodicidades, 2FA, estados): arrays en `js/utils.js`. El formulario y el saneado leen los mismos.
- **Ventana de "próximos"**: el `30` de `C.upcoming(state, today, 30)` en `ui.js`.
- **Punto de corte** móvil/escritorio: `900px` en la sección 13 del CSS.

## Estructura de datos

Clave `vidaDigital.v1` (copia de rescate en `vidaDigital.corrupt-backup`).

```jsonc
{
  "version": 1,                       // esquema de datos
  "settings": {
    "theme": "dark",                  // dark | light
    "backupDays": 14,                 // 0 | 7 | 14 | 30 (0 = no recordar)
    "lastExport": "2026-10-28"        // o null
  },
  "subs": [{
    "id": "subs_k3j2h1a", "createdAt": "2026-10-28", "updatedAt": "2026-10-28",
    "name": "Netflix", "category": "streaming",
    "price": 13.99,                   // null = sin precio (≠ 0 €)
    "period": "mensual",              // mensual | anual | trimestral | semestral | semanal
    "nextDate": "2026-11-12",         // puede quedar en el pasado: calc.js calcula el siguiente
    "trialEnd": null,                 // fin de la prueba gratis
    "sharedWith": "Ana, Luis",
    "myPrice": 6,                     // tu parte; null = pagas todo, 0 = te la pagan
    "account": "yo@gmail.com", "payment": "Tarjeta",
    "active": true, "url": "netflix.com",
    "logo": "",                       // vacío = automático; si no, el nombre de la marca
    "notes": ""
  }],
  "accounts": [{ "…": "…", "user": "", "twofa": "no", "recovery": "", "important": false,
                 "status": "uso",     // uso | borrar | borrada
                 "url": "", "logo": "", "notes": "" }],
  "apps":     [{ "…": "…", "migration": "pendiente",   // pendiente | instalada | lista | no
                 "login": "nose", "account": "", "transfer": "", "notes": "" }],
  "licenses": [{ "…": "…", "keyWhere": "Correo de compra", "account": "", "seller": "",
                 "purchaseDate": null, "expires": null, "price": null }],   // expires null = para siempre
  "copies":   [{ "…": "…", "where": "Google Fotos", "method": "auto",   // manual | auto
                 "frequency": "mensual", "lastDate": "2026-11-10" }],
  "programs": [{ "…": "…", "migration": "pendiente", "source": "Web oficial", "account": "",
                 "transfer": "", "url": "" }],
  // Todos los elementos llevan además "links": ["accounts:accounts_x1y2z3a", …],
  // "tags": ["trabajo", "familia"] y "archived": false
}
// settings además: "accent": "teal", "homeCards" y "homeSections": { "order": [ids], "hidden": [ids] }

// Con contraseña, lo guardado (y las copias) es un sobre en vez de lo de arriba:
{ "app": "vida-digital", "enc": 1, "iter": 600000,
  "salt": "…base64…", "iv": "…base64…", "data": "…base64: el JSON de arriba cifrado…"
  "devices":  [{ "…": "…", "model": "", "serial": "", "purchaseDate": null, "warrantyUntil": null,
                 "price": null, "status": "uso", "notes": "" }],
  "webs":     [{ "…": "…", "url": "", "provider": "", "expires": null, "price": null, "autoRenew": false, "notes": "" }]
}
```

Las fechas son siempre `"YYYY-MM-DD"` en hora local.

## Saneado y migraciones

Todo lo que se carga o se importa pasa por `cleanState()` en `store.js`, que recorre los campos de `utils.KINDS`: los que faltan toman su valor por defecto, los que no encajan se corrigen y los desconocidos se descartan. Un elemento sin nombre o con un `id` repetido se descarta. El estado inicial también sale de `cleanState({})`.

| Esquema | Función | Qué hace |
|---|---|---|
| 1 | — | Esquema inicial. Ni la lista `apps` (1.1.0) ni los campos `trialEnd`, `sharedWith`, `myPrice`, `status` de cuentas y `logo` (2.0.0) ni las listas `licenses` y `copies` y el campo `links` (2.1.0) ni la lista `programs` y los campos `tags` y `archived` (2.2.0) necesitaron migración: el saneado les da su valor por defecto en los datos antiguos. |

## Cómo extender

- **Un campo nuevo:** una línea en `fields` del tipo en `utils.KINDS`. El formulario, el saneado y el CSV lo recogen solos. Si debe verse en la lista, añádelo a `describe()` en `ui.js`. No necesita migración.
- **Una categoría nueva:** una línea en su catálogo de `utils.js`.
- **Un logo nuevo:** en `js/logos.js`, copia de simpleicons.org su slug, título, color y trazado a `ICONS`; si no está allí, añádelo a `TEXT` con unas siglas y su color. Otros nombres para la misma marca van en `ALIASES`.
- **Un tipo nuevo de elemento:** una entrada en `utils.KINDS`, su `<section class="view" id="view-x">` en `index.html` con los ids `xList`, `xEmpty`, `xSearch`, `xCount` y `xAdd`, su botón en la navegación, `VIEWS` en `ui.js`, su rama en `describe()` y `countLine()`, y, si lleva fechas o dinero, en `calc.js`.
- **Transformar datos existentes:** sube `VERSION` del esquema en `store.js` y añade la migración en `migrate()`.

## Decisiones que conviene conocer

- **No hay campos de contraseñas, PIN ni números de tarjeta.** Sin contraseña, `localStorage` no va cifrado: cualquier extensión del navegador o quien abra el ordenador podría leerlo. Con contraseña sí va cifrado, pero sigue sin ser un gestor de contraseñas (no rellena, no genera, no se sincroniza): aquí se apunta *dónde* tienes cuenta y *cómo* se recupera.
- **Cómo se cifra** (`store.js`). La clave sale de la contraseña con PBKDF2-SHA-256, 600 000 vueltas (lo que recomienda OWASP) y una sal aleatoria de 16 bytes; se cifra con AES-GCM de 256 bits y un IV nuevo en cada guardado. GCM detecta cualquier cambio: una contraseña mala o un archivo manipulado dan error, nunca datos a medias. La contraseña no se guarda; en memoria solo vive la clave derivada, no extraíble. Todo con la Web Crypto del navegador, sin librerías. Derivar la clave tarda medio segundo o un segundo: es a propósito, para que probar contraseñas a ciegas sea lento.
- **Con cifrado, guardar es asíncrono.** Las escrituras se encadenan para que una vieja no pise a una nueva, y además de en `pagehide` se guarda al pasar a segundo plano (`visibilitychange`), que en el móvil llega antes y da tiempo a cifrar.
- **Olvidar la contraseña = perder los datos.** Es la condición de que el cifrado sirva para algo. *He olvidado la contraseña* no descifra nada: empieza de cero y guarda el sobre cifrado en `vidaDigital.corrupt-backup` por si la recuerdas.
- **Compartir y no solo descargar.** En el móvil, una descarga se queda en *Descargas* y se pierde con el móvil. El menú Compartir (Web Share API) la lleva directamente a Drive. Chrome no deja compartir cualquier tipo: si `.json` no vale, se prueba como `.json.txt`, que *Importar copia* acepta.
- **El acento va en el `style` de `<html>`**, no en el CSS: manda sobre los tokens de los dos temas sin repetir cada color en la hoja de estilos.
- **La app empieza vacía y tus datos no van en el código.** El repositorio de GitHub Pages es público; meter tus cuentas como datos de partida las publicaría. Se cargan importando un JSON que no se sube.
- **El próximo cobro no se reescribe.** Se guarda la fecha que pusiste y `calc.nextCharge()` le suma periodos enteros hasta hoy, siempre desde la fecha original: un cobro el día 31 pasa por el 28 de febrero y vuelve al 31 en marzo.
- **Un dominio caducado que no se renueva solo se sigue enseñando** (hasta 60 días) en el resumen: es justo lo que hay que ver.
- **Precio vacío ≠ 0 €.** Vacío es "no lo sé"; 0 es gratis. Lo mismo con *Tu parte*: vacía es "pago todo", 0 es "me la pagan".
- **El gasto cuenta lo que pagas tú.** En una suscripción compartida suma tu parte, no el precio entero; el cobro de «Próximos 30 días» enseña los dos.
- **Sin barra de navegación.** Con seis secciones no cabían bien en el móvil, y el Resumen ya enseña lo importante de cada una: es mejor menú que una fila de iconos.
- **Logos incluidos y no descargados.** Van dentro de `logos.js` (unos 200 KB), así funcionan sin conexión y la app no avisa a ningún servicio de qué cuentas tienes. Los trazados son de Simple Icons (CC0); las marcas que no tiene llevan siglas. El repositorio es público, pero un logo de marca no revela nada tuyo.
- **Las apps van aparte de las cuentas.** Una cuenta es dónde estás registrado; una app es lo que hay que reinstalar y volver a configurar en el móvil nuevo. Instagram puede estar en las dos, y no pasa nada.
- **«Instalada» no es «migrada».** Lo que se olvida al cambiar de móvil no es instalar, sino entrar y pasar los datos: por eso hay un paso intermedio y el campo *Qué hay que pasar*.
- **Las de «No la paso» no cuentan en el progreso**: si no, el 100 % sería imposible.
- **Los enlaces se guardan en un lado y se ven desde los dos.** `store.getLinked()` junta lo que apunta un elemento y lo que le apunta a él; así no hay dos copias que mantener al día. Al guardar un formulario, lo que quitaste se borra también del otro lado. Los enlaces a elementos borrados se ignoran al leer y se limpian al volver a cargar (así *Deshacer* un borrado los recupera).
- **De las licencias se apunta dónde está la clave, no la clave.** Por el mismo motivo que no hay contraseñas.
- **Una copia automática también se revisa.** Si el móvil dejó de subir fotos hace meses, la copia automática no existe: por eso tiene frecuencia y «Comprobada hoy».
- **Archivar no es un campo del formulario**, sino un botón: es un estado del elemento, no un dato suyo. Todos los cálculos de `calc.js` empiezan por `live(state)`, que quita lo archivado; así no hay un sitio donde se olvide filtrarlo.
- **Exportar e importar comparten columnas** (`sheet.js`). Un CSV exportado se puede editar en Excel y volver a importar; por eso lleva también la columna *Archivado*.
- **Importar completa, no duplica ni borra.** Una fila con un nombre que ya existe en esa sección rellena lo que traiga y deja lo demás; el nombre se queda como lo tenías.
- **Excel guarda CSV en dos codificaciones** («CSV UTF-8» y «CSV delimitado por comas», que es Windows-1252). Se lee como UTF-8 y, si salen caracteres rotos, se relee como Windows-1252.
- **Un solo formulario para todos los tipos** (ahora ocho), generado desde `utils.KINDS`, que también usa el saneado: no pueden discrepar.
- **Las URLs se abren solo si son http o https.** `netflix.com` se convierte en `https://netflix.com`; un `javascript:` de una copia manipulada nunca acaba en un enlace.
- **La vista va en el hash** (`#subs`): recargar o el botón atrás del móvil te dejan donde estabas.
- **Prefijo de caché `vida-digital-v`**, único en `alexlobar.github.io`; el service worker solo borra las cachés que empiezan por él.

## Limitaciones

- Los datos solo existen en ese navegador: PC y móvil no se sincronizan. Exporta e importa para pasarlos.
- Una sola moneda (euros).
- No hay avisos con la app cerrada: una web no puede prometer recordatorios fiables. Los vencimientos se ven al abrirla.
- El tope es el de `localStorage`, 5 MB compartidos con tus otras apps de GitHub Pages; con cientos de elementos se queda muy lejos.
