# Vida digital

Tus suscripciones, cuentas, dispositivos y webs en un solo sitio, con el gasto total, lo que vence en los próximos 30 días y qué cuentas no tienen verificación en dos pasos. HTML, CSS y JavaScript vanilla: sin dependencias, sin build, offline, con los datos en `localStorage`.

**Versión documentada: 1.0.0** (28-10-2026) · esquema de datos **1**.

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
js/store.js            localStorage: carga, saneado, migraciones y escritura
js/calc.js             Gasto, próximos cobros, caducidades y seguridad
js/ui.js               Todo lo que toca el DOM
js/app.js              Eventos, exportación/importación y arranque
```

Orden de carga = orden de dependencia: `utils → store → calc → ui → app`.

## Pantallas

**Resumen.** Gasto al mes y al año de las suscripciones activas (más el coste anual de los dominios, prorrateado), desglosado por categoría. Debajo, lo que pasa en los próximos 30 días: cobros, renovaciones, dominios que caducan y garantías que se acaban. Después, cuántas cuentas no tienen 2FA, empezando por las marcadas como importantes. Al final, un acceso a cada sección con su número de elementos.

**Suscripciones.** Servicio, categoría, precio, periodicidad, próximo cobro, cuenta asociada, método de pago, si está activa, web y notas. Las inactivas no suman al gasto y van al final de su grupo.

**Cuentas.** Servicio, categoría, usuario o email, tipo de 2FA, cómo recuperarla, si es importante, web y notas. Sin contraseñas (ver Decisiones).

**Dispositivos (Equipos).** Nombre, tipo, marca y modelo, número de serie, fecha de compra, fin de garantía, precio, estado y notas.

**Dominios y webs.** Nombre, tipo (dominio, web, app publicada, repositorio), dirección, proveedor, caducidad, coste anual, si se renueva sola y notas.

**Ajustes.** Tema, recordatorio de copia, exportar e importar JSON, exportar CSV, botón *Instalar*, línea de versión y espacio (`Version-y-espacio.md`) y borrar todo.

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
| `js/utils.js` | `VERSION = '1.0.0'` y `BUILD_DATE` — la fuente de verdad |
| `sw.js` | `CACHE = 'vida-digital-v1.0.0'` |
| `index.html` | `<html data-build="1.0.0">` |

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
    "account": "yo@gmail.com", "payment": "Tarjeta",
    "active": true, "url": "netflix.com", "notes": ""
  }],
  "accounts": [{ "…": "…", "user": "", "twofa": "no", "recovery": "", "important": false, "url": "", "notes": "" }],
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
| 1 | — | Esquema inicial |

## Cómo extender

- **Un campo nuevo:** una línea en `fields` del tipo en `utils.KINDS`. El formulario, el saneado y el CSV lo recogen solos. Si debe verse en la lista, añádelo a `describe()` en `ui.js`. No necesita migración.
- **Una categoría nueva:** una línea en su catálogo de `utils.js`.
- **Un tipo nuevo de elemento:** una entrada en `utils.KINDS`, su `<section class="view" id="view-x">` en `index.html` con los ids `xList`, `xEmpty`, `xSearch`, `xCount` y `xAdd`, su botón en la navegación, `VIEWS` en `ui.js`, su rama en `describe()` y `countLine()`, y, si lleva fechas o dinero, en `calc.js`.
- **Transformar datos existentes:** sube `VERSION` del esquema en `store.js` y añade la migración en `migrate()`.

## Decisiones que conviene conocer

- **No hay contraseñas, PIN ni números de tarjeta.** `localStorage` no va cifrado: cualquier extensión del navegador o quien abra el ordenador podría leerlo, y una copia exportada es texto plano. Para eso está un gestor de contraseñas; aquí se apunta *dónde* tienes cuenta y *cómo* se recupera.
- **La app empieza vacía y tus datos no van en el código.** El repositorio de GitHub Pages es público; meter tus cuentas como datos de partida las publicaría. Se cargan importando un JSON que no se sube.
- **El próximo cobro no se reescribe.** Se guarda la fecha que pusiste y `calc.nextCharge()` le suma periodos enteros hasta hoy, siempre desde la fecha original: un cobro el día 31 pasa por el 28 de febrero y vuelve al 31 en marzo.
- **Un dominio caducado que no se renueva solo se sigue enseñando** (hasta 60 días) en el resumen: es justo lo que hay que ver.
- **Precio vacío ≠ 0 €.** Vacío es "no lo sé"; 0 es gratis.
- **Un solo formulario para los cuatro tipos**, generado desde `utils.KINDS`, que también usa el saneado: no pueden discrepar.
- **Las URLs se abren solo si son http o https.** `netflix.com` se convierte en `https://netflix.com`; un `javascript:` de una copia manipulada nunca acaba en un enlace.
- **La vista va en el hash** (`#subs`): recargar o el botón atrás del móvil te dejan donde estabas.
- **Prefijo de caché `vida-digital-v`**, único en `alexlobar.github.io`; el service worker solo borra las cachés que empiezan por él.

## Limitaciones

- Los datos solo existen en ese navegador: PC y móvil no se sincronizan. Exporta e importa para pasarlos.
- Una sola moneda (euros).
- No hay avisos con la app cerrada: una web no puede prometer recordatorios fiables. Los vencimientos se ven al abrirla.
- El tope es el de `localStorage`, 5 MB compartidos con tus otras apps de GitHub Pages; con cientos de elementos se queda muy lejos.
