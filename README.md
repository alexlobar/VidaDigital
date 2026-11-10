# Vida digital

Tus suscripciones, cuentas, apps, dispositivos y webs en un solo sitio, con el gasto total, lo que vence en los próximos 30 días, qué cuentas no tienen verificación en dos pasos y cómo va el cambio de móvil. HTML, CSS y JavaScript vanilla: sin dependencias, sin build, offline, con los datos en `localStorage`.

**Versión documentada: 2.0.0** (10-11-2026) · esquema de datos **1**.

| Versión | Cambios |
|---|---|
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
js/calc.js             Gasto, próximos cobros, caducidades, seguridad y cambio de móvil
js/ui.js               Todo lo que toca el DOM
js/app.js              Eventos, exportación/importación y arranque
```

Orden de carga = orden de dependencia: `utils → logos → store → calc → ui → app`.

## Pantallas

**Resumen (el menú).** Arriba, un recuadro por sección con su dato principal (gasto al mes, cuentas sin 2FA, apps migradas…); tocarlo abre la sección. No hay barra de navegación: cada sección vuelve con ‹ (o con el botón atrás del móvil) y el logo de la cabecera también lleva aquí. Si hay apps apuntadas, debajo sale **Cambio de móvil**: cuántas están migradas, una barra de progreso y la lista de las que faltan (primero las instaladas a medias). Cuando están todas, aparece *Empezar otro cambio de móvil*, que las devuelve a «Pendiente». Después, el gasto al mes y al año de las suscripciones activas (más el coste anual de los dominios, prorrateado), desglosado por categoría. Debajo, lo que pasa en los próximos 30 días: cobros, renovaciones, dominios que caducan y garantías que se acaban. Después, cuántas cuentas no tienen 2FA, empezando por las marcadas como importantes. Al final, un acceso a cada sección con su número de elementos.

**Suscripciones.** Servicio, categoría, precio, periodicidad, próximo cobro, fin de la prueba gratis, con quién se comparte y tu parte, cuenta asociada, método de pago, si está activa, web, logo y notas. Las inactivas no suman al gasto y van al final de su grupo. Una prueba gratis sale en «Próximos 30 días» en ámbar, para darla de baja antes del cobro.

**Cuentas.** Servicio, categoría, usuario o email, tipo de 2FA, cómo recuperarla, si es importante, estado (la uso / quiero borrarla / ya la he borrado), web, logo y notas. Sin contraseñas (ver Decisiones). Las marcadas «Quiero borrarla» salen en la tarjeta *Cuentas para borrar* del Resumen; las borradas no cuentan en Seguridad.

**Apps.** Las aplicaciones del móvil: nombre, categoría, estado en el cambio de móvil (pendiente, instalada, migrada, no la paso), cómo se entra (teléfono, email, Google, Apple…), cuenta o usuario, qué hay que pasar a mano (chats, autenticador, partidas…) y notas. El círculo ✓ de cada fila la marca como migrada sin abrir el formulario.

**Dispositivos (Equipos).** Nombre, tipo, marca y modelo, número de serie, fecha de compra, fin de garantía, precio, estado y notas.

**Dominios y webs.** Nombre, tipo (dominio, web, app publicada, repositorio), dirección, proveedor, caducidad, coste anual, si se renueva sola y notas.

**Ajustes.** Tema, recordatorio de copia, exportar e importar JSON, exportar CSV, botón *Instalar*, línea de versión y espacio (`Version-y-espacio.md`) y borrar todo.

Cada elemento lleva el logo de su marca: se busca por el campo *Logo* si lo rellenas, luego por el nombre, la web y cada palabra del nombre o del modelo («Pixel 8» → Google). Si la app no conoce la marca, salen las iniciales sobre un color fijo para ese nombre.

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
| `js/utils.js` | `VERSION = '2.0.0'` y `BUILD_DATE` — la fuente de verdad |
| `sw.js` | `CACHE = 'vida-digital-v2.0.0'` |
| `index.html` | `<html data-build="2.0.0">` |

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
| 1 | — | Esquema inicial. Ni la lista `apps` (1.1.0) ni los campos `trialEnd`, `sharedWith`, `myPrice`, `status` de cuentas y `logo` (2.0.0) necesitaron migración: el saneado les da su valor por defecto en los datos antiguos. |

## Cómo extender

- **Un campo nuevo:** una línea en `fields` del tipo en `utils.KINDS`. El formulario, el saneado y el CSV lo recogen solos. Si debe verse en la lista, añádelo a `describe()` en `ui.js`. No necesita migración.
- **Una categoría nueva:** una línea en su catálogo de `utils.js`.
- **Un logo nuevo:** en `js/logos.js`, copia de simpleicons.org su slug, título, color y trazado a `ICONS`; si no está allí, añádelo a `TEXT` con unas siglas y su color. Otros nombres para la misma marca van en `ALIASES`.
- **Un tipo nuevo de elemento:** una entrada en `utils.KINDS`, su `<section class="view" id="view-x">` en `index.html` con los ids `xList`, `xEmpty`, `xSearch`, `xCount` y `xAdd`, su botón en la navegación, `VIEWS` en `ui.js`, su rama en `describe()` y `countLine()`, y, si lleva fechas o dinero, en `calc.js`.
- **Transformar datos existentes:** sube `VERSION` del esquema en `store.js` y añade la migración en `migrate()`.

## Decisiones que conviene conocer

- **No hay contraseñas, PIN ni números de tarjeta.** `localStorage` no va cifrado: cualquier extensión del navegador o quien abra el ordenador podría leerlo, y una copia exportada es texto plano. Para eso está un gestor de contraseñas; aquí se apunta *dónde* tienes cuenta y *cómo* se recupera.
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
- **Un solo formulario para todos los tipos** (ahora cinco), generado desde `utils.KINDS`, que también usa el saneado: no pueden discrepar.
- **Las URLs se abren solo si son http o https.** `netflix.com` se convierte en `https://netflix.com`; un `javascript:` de una copia manipulada nunca acaba en un enlace.
- **La vista va en el hash** (`#subs`): recargar o el botón atrás del móvil te dejan donde estabas.
- **Prefijo de caché `vida-digital-v`**, único en `alexlobar.github.io`; el service worker solo borra las cachés que empiezan por él.

## Limitaciones

- Los datos solo existen en ese navegador: PC y móvil no se sincronizan. Exporta e importa para pasarlos.
- Una sola moneda (euros).
- No hay avisos con la app cerrada: una web no puede prometer recordatorios fiables. Los vencimientos se ven al abrirla.
- El tope es el de `localStorage`, 5 MB compartidos con tus otras apps de GitHub Pages; con cientos de elementos se queda muy lejos.
