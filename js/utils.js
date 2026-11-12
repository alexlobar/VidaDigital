/* ============================================================
   utils.js — Utilidades puras: fechas, dinero, DOM, catálogos
   y LA VERSIÓN. No conoce el estado ni toca localStorage.
   ============================================================ */
window.VD = window.VD || {};

VD.utils = (function () {
  'use strict';

  /* ── Versión ──────────────────────────────────────────────
     Fuente única de la versión: MAYOR.MENOR.PARCHE.
       · PARCHE (1.0.1) → correcciones y retoques visuales.
       · MENOR  (1.1.0) → funcionalidad nueva compatible.
       · MAYOR  (2.0.0) → rediseño o cambio de datos incompatible.
     Aparece en otros dos sitios: CACHE en sw.js (un service worker no
     puede leer este archivo) y data-build en index.html. Si se
     desincronizan, la app lo avisa al arrancar. ──────────────── */
  const VERSION = '2.3.1';
  const BUILD_DATE = '2026-11-12';
  /* Igual que PREFIX en sw.js. Único en alexlobar.github.io: no puede ser
     el comienzo del prefijo de otra app (ver Service-worker-cache.md). */
  const CACHE_PREFIX = 'vida-digital-v';

  /* ── Colores de acento ────────────────────────────────────
     Cada uno con su versión para el tema oscuro y el claro: el mismo
     color no se lee igual sobre negro que sobre blanco. `on` es el color
     del texto encima de un botón relleno. ui.applyTheme() los pasa a los
     tokens --accent*; ningún componente escribe un color de marca. ── */
  const ACCENTS = [
    { id: 'teal',    name: 'Turquesa', dark: ['#2dd4bf', '#5eead4', '#04211d'], light: ['#0f766e', '#115e59', '#ffffff'] },
    { id: 'blue',    name: 'Azul',     dark: ['#60a5fa', '#93c5fd', '#0b1b33'], light: ['#1d4ed8', '#1e40af', '#ffffff'] },
    { id: 'violet',  name: 'Violeta',  dark: ['#a78bfa', '#c4b5fd', '#1b1036'], light: ['#6d28d9', '#5b21b6', '#ffffff'] },
    { id: 'pink',    name: 'Rosa',     dark: ['#f472b6', '#f9a8d4', '#2d0a1c'], light: ['#be185d', '#9d174d', '#ffffff'] },
    { id: 'red',     name: 'Rojo',     dark: ['#f87171', '#fca5a5', '#2b0707'], light: ['#b91c1c', '#991b1b', '#ffffff'] },
    { id: 'orange',  name: 'Naranja',  dark: ['#fb923c', '#fdba74', '#2a1204'], light: ['#c2410c', '#9a3412', '#ffffff'] },
    { id: 'amber',   name: 'Ámbar',    dark: ['#fbbf24', '#fcd34d', '#2a1a02'], light: ['#b45309', '#92400e', '#ffffff'] },
    { id: 'green',   name: 'Verde',    dark: ['#4ade80', '#86efac', '#052e16'], light: ['#15803d', '#166534', '#ffffff'] }
  ];

  /* ── Tarjetas del Resumen ─────────────────────────────────
     El orden de partida. Cada una vive en index.html con el id
     `<id>Card`; desde Ajustes se reordenan y se ocultan. ───── */
  const HOME_CARDS = [
    { id: 'migration', name: 'Cambio de móvil' },
    { id: 'pc',        name: 'Cambio de ordenador' },
    { id: 'spend',     name: 'Gasto' },
    { id: 'upcoming',  name: 'Próximos 30 días' },
    { id: 'security',  name: 'Seguridad' },
    { id: 'copies',    name: 'Copias de seguridad' },
    { id: 'cleanup',   name: 'Cuentas para borrar' }
  ];

  /* ── Catálogos ────────────────────────────────────────────
     Un elemento guarda solo el `id`; el nombre y el icono salen de aquí.
     Están en JS y no en el HTML para que el desplegable del formulario y
     el saneado del store lean la misma lista y no puedan discrepar.
     Los emojis van sueltos, nunca en una cadena que luego se parte:
     algunos ocupan dos unidades y se romperían. ─────────────── */
  const SUB_CATEGORIES = [
    { id: 'streaming', name: 'Vídeo y streaming',      icon: '📺' },
    { id: 'musica',    name: 'Música y audio',          icon: '🎵' },
    { id: 'nube',      name: 'Nube y almacenamiento',   icon: '☁️' },
    { id: 'software',  name: 'Software y apps',         icon: '🧩' },
    { id: 'ia',        name: 'Inteligencia artificial', icon: '🤖' },
    { id: 'lectura',   name: 'Prensa y lectura',        icon: '📰' },
    { id: 'juegos',    name: 'Juegos',                  icon: '🎮' },
    { id: 'telefonia', name: 'Móvil e internet',        icon: '📶' },
    { id: 'otros',     name: 'Otras',                   icon: '📦' }
  ];

  const ACCOUNT_CATEGORIES = [
    { id: 'correo',         name: 'Correo',             icon: '✉️' },
    { id: 'redes',          name: 'Redes y mensajería', icon: '💬' },
    { id: 'banca',          name: 'Banca y pagos',      icon: '🏦' },
    { id: 'compras',        name: 'Compras',            icon: '🛒' },
    { id: 'trabajo',        name: 'Trabajo',            icon: '💼' },
    { id: 'administracion', name: 'Administración',     icon: '🏛️' },
    { id: 'ocio',           name: 'Ocio',               icon: '🎬' },
    { id: 'desarrollo',     name: 'Desarrollo',         icon: '🛠️' },
    { id: 'otros',          name: 'Otras',              icon: '🔑' }
  ];

  const APP_CATEGORIES = [
    { id: 'mensajeria',    name: 'Mensajería',            icon: '💬' },
    { id: 'redes',         name: 'Redes sociales',        icon: '📸' },
    { id: 'juegos',        name: 'Juegos',                icon: '🎮' },
    { id: 'deporte',       name: 'Deporte y salud',       icon: '🏃' },
    { id: 'banca',         name: 'Banca y pagos',         icon: '🏦' },
    { id: 'compras',       name: 'Compras y comida',      icon: '🛒' },
    { id: 'transporte',    name: 'Transporte y viajes',   icon: '🚗' },
    { id: 'ocio',          name: 'Música, vídeo y ocio',  icon: '🎬' },
    { id: 'productividad', name: 'Trabajo y organización', icon: '🗂️' },
    { id: 'utilidades',    name: 'Utilidades',            icon: '🔧' },
    { id: 'otros',         name: 'Otras',                 icon: '📦' }
  ];

  /* Cómo se entra en una app. Al cambiar de móvil es lo primero que hay
     que saber: con el número de teléfono basta el SMS, con email hace
     falta la contraseña a mano. */
  const LOGIN_METHODS = [
    { id: 'nose',     name: 'No lo sé' },
    { id: 'telefono', name: 'Número de teléfono' },
    { id: 'email',    name: 'Email y contraseña' },
    { id: 'google',   name: 'Con Google' },
    { id: 'apple',    name: 'Con Apple' },
    { id: 'facebook', name: 'Con Facebook' },
    { id: 'sin',      name: 'No necesita cuenta' }
  ];

  /* Estado de una app en el cambio de móvil, en el orden en que se avanza.
     "Instalada" no es "migrada": falta entrar o pasar los datos (chats,
     partidas, el autenticador…), que es justo lo que se olvida. */
  const MIGRATION = [
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'instalada', name: 'Instalada, falta entrar o pasar datos' },
    { id: 'lista',     name: 'Migrada' },
    { id: 'no',        name: 'No la paso' }
  ];

  const DEVICE_TYPES = [
    { id: 'movil',     name: 'Móviles',          icon: '📱' },
    { id: 'portatil',  name: 'Portátiles',       icon: '💻' },
    { id: 'sobremesa', name: 'Sobremesa',        icon: '🖥️' },
    { id: 'tablet',    name: 'Tablets',          icon: '📲' },
    { id: 'reloj',     name: 'Relojes',          icon: '⌚' },
    { id: 'audio',     name: 'Audio',            icon: '🎧' },
    { id: 'consola',   name: 'Consolas',         icon: '🎮' },
    { id: 'tv',        name: 'TV y streaming',   icon: '📺' },
    { id: 'red',       name: 'Router y red',     icon: '📡' },
    { id: 'otro',      name: 'Otros',            icon: '🔌' }
  ];

  const WEB_TYPES = [
    { id: 'dominio', name: 'Dominios',        icon: '🔗' },
    { id: 'web',     name: 'Webs',            icon: '🌐' },
    { id: 'app',     name: 'Apps publicadas', icon: '📲' },
    { id: 'repo',    name: 'Repositorios',    icon: '📁' },
    { id: 'otro',    name: 'Otros',           icon: '🧷' }
  ];

  /* Periodicidad de un cobro. `months` o `weeks`, nunca los dos: el
     semanal no cabe en meses enteros y se prorratea aparte (calc.js). */
  const PERIODS = [
    { id: 'mensual',    name: 'Cada mes',       short: 'mes',       months: 1 },
    { id: 'anual',      name: 'Cada año',       short: 'año',       months: 12 },
    { id: 'trimestral', name: 'Cada 3 meses',   short: 'trimestre', months: 3 },
    { id: 'semestral',  name: 'Cada 6 meses',   short: 'semestre',  months: 6 },
    { id: 'semanal',    name: 'Cada semana',    short: 'semana',    weeks: 1 }
  ];

  /* Ordenados de más a menos seguro, salvo "Sin 2FA", que va primero
     porque es el valor por defecto y el que la app señala. */
  const TWOFA = [
    { id: 'no',      name: 'Sin 2FA' },
    { id: 'passkey', name: 'Passkey' },
    { id: 'llave',   name: 'Llave física' },
    { id: 'app',     name: 'App autenticadora' },
    { id: 'sms',     name: 'SMS' },
    { id: 'email',   name: 'Código por email' }
  ];

  /* Una cuenta que ya no usas sigue siendo una puerta abierta con tus
     datos dentro: "Quiero borrarla" la apunta en la lista de limpieza. */
  const ACCOUNT_STATUS = [
    { id: 'uso',     name: 'La uso' },
    { id: 'borrar',  name: 'Quiero borrarla' },
    { id: 'borrada', name: 'Ya la he borrado' }
  ];

  /* Campo común a todos los tipos: casi siempre el logo sale solo por el
     nombre o la web, y esto es para cuando no ("Móvil personal" → Apple). */
  const LOGO_FIELD = {
    key: 'logo', label: 'Logo', type: 'text', list: 'logoTitles', placeholder: 'Automático',
    hint: 'Si no sale solo, escribe la marca: Apple, Google, BBVA…'
  };

  /* Enlaces con otros elementos: la suscripción de Netflix con su cuenta y
     su app, una licencia con el equipo donde está activada… Se guardan en
     un lado y se ven desde los dos (store.getLinked). */
  const LINKS_FIELD = { key: 'links', label: 'Enlazado con', type: 'links' };

  /* Etiquetas libres ("trabajo", "familia", "compartido con Ana"): cruzan
     las secciones, que las categorías no. */
  const TAGS_FIELD = {
    key: 'tags', label: 'Etiquetas', type: 'tags', placeholder: 'trabajo, familia, compartido…',
    hint: 'Separadas por comas. Filtran en cada sección y en el buscador.'
  };

  const PROGRAM_CATEGORIES = [
    { id: 'navegador',    name: 'Navegadores',           icon: '🌐' },
    { id: 'ofimatica',    name: 'Ofimática',             icon: '📝' },
    { id: 'comunicacion', name: 'Comunicación',          icon: '💬' },
    { id: 'multimedia',   name: 'Música y vídeo',        icon: '🎬' },
    { id: 'juegos',       name: 'Juegos',                icon: '🎮' },
    { id: 'creatividad',  name: 'Diseño, foto y vídeo',  icon: '🎨' },
    { id: 'desarrollo',   name: 'Desarrollo',            icon: '🛠️' },
    { id: 'seguridad',    name: 'Seguridad',             icon: '🛡️' },
    { id: 'utilidades',   name: 'Utilidades',            icon: '🔧' },
    { id: 'trabajo',      name: 'Trabajo',               icon: '💼' },
    { id: 'otros',        name: 'Otros',                 icon: '📦' }
  ];

  /* Igual que MIGRATION, en masculino: "el programa". Mismos ids, así el
     cálculo del progreso es el mismo para el móvil y el ordenador. */
  const MIGRATION_PC = [
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'instalada', name: 'Instalado, falta configurar o pasar datos' },
    { id: 'lista',     name: 'Migrado' },
    { id: 'no',        name: 'No lo paso' }
  ];

  const DEVICE_STATUS = [
    { id: 'uso',      name: 'En uso' },
    { id: 'guardado', name: 'Guardado' },
    { id: 'prestado', name: 'Prestado' },
    { id: 'vendido',  name: 'Vendido' },
    { id: 'roto',     name: 'Roto' }
  ];

  const LICENSE_CATEGORIES = [
    { id: 'sistema',     name: 'Sistema operativo',      icon: '🖥️' },
    { id: 'ofimatica',   name: 'Ofimática',              icon: '📝' },
    { id: 'juegos',      name: 'Juegos',                 icon: '🎮' },
    { id: 'creatividad', name: 'Diseño, foto y vídeo',   icon: '🎨' },
    { id: 'seguridad',   name: 'Antivirus y VPN',        icon: '🛡️' },
    { id: 'desarrollo',  name: 'Desarrollo',             icon: '🛠️' },
    { id: 'otros',       name: 'Otras',                  icon: '📦' }
  ];

  const COPY_CATEGORIES = [
    { id: 'fotos',       name: 'Fotos y vídeos',             icon: '📷' },
    { id: 'documentos',  name: 'Documentos',                 icon: '📄' },
    { id: 'movil',       name: 'Móvil completo',             icon: '📱' },
    { id: 'ordenador',   name: 'Ordenador',                  icon: '💻' },
    { id: 'chats',       name: 'Chats',                      icon: '💬' },
    { id: 'claves',      name: 'Contraseñas y 2FA',          icon: '🔐' },
    { id: 'apps',        name: 'Datos de apps',              icon: '🗂️' },
    { id: 'otros',       name: 'Otras',                      icon: '📦' }
  ];

  /* Cada cuánto hay que hacer (o comprobar, si es automática) una copia. */
  const COPY_FREQ = [
    { id: 'mensual',    name: 'Cada mes',     days: 30 },
    { id: 'semanal',    name: 'Cada semana',  days: 7 },
    { id: 'diaria',     name: 'Cada día',     days: 1 },
    { id: 'trimestral', name: 'Cada 3 meses', days: 91 },
    { id: 'semestral',  name: 'Cada 6 meses', days: 182 },
    { id: 'anual',      name: 'Cada año',     days: 365 }
  ];

  /* Una copia automática también se revisa: si el móvil dejó de subir
     fotos hace medio año, la copia "automática" no existe. */
  const COPY_METHODS = [
    { id: 'manual', name: 'La hago yo' },
    { id: 'auto',   name: 'Automática (solo comprobarla)' }
  ];

  /* ── Tipos de elemento ────────────────────────────────────
     Cada tipo tiene su lista de campos. De esta tabla salen a la vez el
     formulario (ui.js), el saneado (store.js) y la exportación CSV: añadir
     un campo es añadir una línea aquí y nada más.
     Tipos de campo: text, textarea, url, select, money, date, check, tags, links.
     No hay campo de contraseña a propósito: localStorage no va cifrado y
     cualquier extensión o quien abra el navegador podría leerlo. ── */
  const KINDS = [
    {
      id: 'subs', name: 'Suscripciones', nav: 'Suscrip.', one: 'suscripción',
      add: 'Nueva suscripción', edit: 'Editar suscripción', icon: '💳',
      cats: SUB_CATEGORIES,
      fields: [
        { key: 'name', label: 'Servicio', type: 'text', required: true, placeholder: 'Netflix, Spotify, iCloud…' },
        { key: 'category', label: 'Categoría', type: 'select', options: SUB_CATEGORIES, default: 'otros' },
        { key: 'price', label: 'Precio (€)', type: 'money', half: true },
        { key: 'period', label: 'Se paga', type: 'select', options: PERIODS, half: true },
        { key: 'nextDate', label: 'Próximo cobro', type: 'date', half: true },
        { key: 'trialEnd', label: 'Fin de la prueba gratis', type: 'date', half: true },
        { key: 'sharedWith', label: 'Compartida con', type: 'text', half: true, placeholder: 'Ana, Luis…' },
        { key: 'myPrice', label: 'Tu parte (€)', type: 'money', half: true,
          hint: 'Vacío: pagas el precio entero. 0: te la pagan otros. Es lo que cuenta en tu gasto.' },
        { key: 'account', label: 'Cuenta asociada', type: 'text', placeholder: 'email o usuario' },
        { key: 'payment', label: 'Método de pago', type: 'text', placeholder: 'Tarjeta, PayPal, factura del móvil…',
          hint: 'Solo el nombre: nunca el número de la tarjeta.' },
        { key: 'active', label: 'Activa: cuenta en el gasto', type: 'check', default: true },
        { key: 'url', label: 'Web', type: 'url', placeholder: 'netflix.com' },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Plan, cómo darla de baja…' }
      ]
    },
    {
      id: 'accounts', name: 'Cuentas', nav: 'Cuentas', one: 'cuenta',
      add: 'Nueva cuenta', edit: 'Editar cuenta', icon: '🔑',
      cats: ACCOUNT_CATEGORIES,
      fields: [
        { key: 'name', label: 'Servicio', type: 'text', required: true, placeholder: 'Gmail, Amazon, banco…' },
        { key: 'category', label: 'Categoría', type: 'select', options: ACCOUNT_CATEGORIES, default: 'otros' },
        { key: 'user', label: 'Usuario o email', type: 'text' },
        { key: 'twofa', label: 'Verificación en dos pasos', type: 'select', options: TWOFA },
        { key: 'recovery', label: 'Cómo recuperarla', type: 'text',
          placeholder: 'móvil, email alternativo, códigos guardados en…' },
        { key: 'important', label: 'Importante: perderla sería un problema', type: 'check', default: false },
        { key: 'status', label: 'Estado', type: 'select', options: ACCOUNT_STATUS },
        { key: 'url', label: 'Web', type: 'url' },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea',
          hint: 'No apuntes contraseñas: aquí no van cifradas. Para eso, un gestor de contraseñas.' }
      ]
    },
    {
      id: 'apps', name: 'Apps', nav: 'Apps', one: 'app',
      add: 'Nueva app', edit: 'Editar app', icon: '📲',
      cats: APP_CATEGORIES,
      fields: [
        { key: 'name', label: 'App', type: 'text', required: true, placeholder: 'WhatsApp, Instagram, Steam, Playtomic…' },
        { key: 'category', label: 'Categoría', type: 'select', options: APP_CATEGORIES, default: 'otros' },
        { key: 'migration', label: 'Cambio de móvil', type: 'select', options: MIGRATION },
        { key: 'login', label: 'Cómo se entra', type: 'select', options: LOGIN_METHODS, half: true },
        { key: 'account', label: 'Cuenta o usuario', type: 'text', half: true },
        { key: 'transfer', label: 'Qué hay que pasar', type: 'text',
          placeholder: 'Copia de chats, autenticador, partidas…',
          hint: 'Lo que no se recupera solo al iniciar sesión.' },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea',
          placeholder: 'Pasos para migrarla, dónde está la copia…' }
      ]
    },
    {
      id: 'programs', name: 'Programas', nav: 'Programas', one: 'programa',
      add: 'Nuevo programa', edit: 'Editar programa', icon: '🖥️',
      cats: PROGRAM_CATEGORIES,
      fields: [
        { key: 'name', label: 'Programa', type: 'text', required: true, placeholder: 'Chrome, Office, Steam, VS Code…' },
        { key: 'category', label: 'Categoría', type: 'select', options: PROGRAM_CATEGORIES, default: 'otros' },
        { key: 'migration', label: 'Cambio de ordenador', type: 'select', options: MIGRATION_PC },
        { key: 'source', label: 'De dónde se instala', type: 'text', half: true,
          placeholder: 'Web oficial, Microsoft Store…' },
        { key: 'account', label: 'Cuenta o usuario', type: 'text', half: true },
        { key: 'transfer', label: 'Qué hay que pasar', type: 'text',
          placeholder: 'Ajustes, extensiones, partidas, activar la licencia…',
          hint: 'Si tiene licencia, enlázala abajo y la tendrás a mano al reinstalar.' },
        { key: 'url', label: 'Web de descarga', type: 'url' },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Versión, plugins, pasos de instalación…' }
      ]
    },
    {
      id: 'devices', name: 'Dispositivos', nav: 'Equipos', one: 'dispositivo',
      add: 'Nuevo dispositivo', edit: 'Editar dispositivo', icon: '💻',
      cats: DEVICE_TYPES,
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Móvil personal, portátil del trabajo…' },
        { key: 'category', label: 'Tipo', type: 'select', options: DEVICE_TYPES, default: 'otro' },
        { key: 'model', label: 'Marca y modelo', type: 'text', placeholder: 'Pixel 8, MacBook Air M2…' },
        { key: 'serial', label: 'Número de serie', type: 'text' },
        { key: 'purchaseDate', label: 'Fecha de compra', type: 'date', half: true },
        { key: 'warrantyUntil', label: 'Garantía hasta', type: 'date', half: true },
        { key: 'price', label: 'Precio de compra (€)', type: 'money', half: true },
        { key: 'status', label: 'Estado', type: 'select', options: DEVICE_STATUS, half: true },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Dónde está la factura, accesorios, a quién se lo prestaste…' }
      ]
    },
    {
      id: 'licenses', name: 'Licencias y claves', nav: 'Licencias', one: 'licencia',
      add: 'Nueva licencia', edit: 'Editar licencia', icon: '🎟️',
      cats: LICENSE_CATEGORIES,
      fields: [
        { key: 'name', label: 'Programa o juego', type: 'text', required: true,
          placeholder: 'Office 2021, Windows 11 Pro, un juego…' },
        { key: 'category', label: 'Categoría', type: 'select', options: LICENSE_CATEGORIES, default: 'otros' },
        { key: 'keyWhere', label: 'Dónde está la clave', type: 'text',
          placeholder: 'Correo de compra, caja, gestor de contraseñas…',
          hint: 'Solo dónde encontrarla: la clave en sí, en un gestor de contraseñas.' },
        { key: 'account', label: 'Cuenta asociada', type: 'text', half: true, placeholder: 'email o usuario' },
        { key: 'seller', label: 'Dónde se compró', type: 'text', half: true, placeholder: 'Microsoft Store, Steam…' },
        { key: 'purchaseDate', label: 'Fecha de compra', type: 'date', half: true },
        { key: 'expires', label: 'Caduca', type: 'date', half: true },
        { key: 'price', label: 'Precio (€)', type: 'money', half: true },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea',
          placeholder: 'Cuántos equipos admite, cómo se desactiva al cambiar de equipo…',
          hint: 'Sin fecha de caducidad es una licencia para siempre.' }
      ]
    },
    {
      id: 'copies', name: 'Copias de seguridad', nav: 'Copias', one: 'copia',
      add: 'Nueva copia de seguridad', edit: 'Editar copia de seguridad', icon: '💾',
      cats: COPY_CATEGORIES,
      fields: [
        { key: 'name', label: 'Qué se copia', type: 'text', required: true,
          placeholder: 'Fotos del móvil, carpeta Documentos, chats de WhatsApp…' },
        { key: 'category', label: 'Categoría', type: 'select', options: COPY_CATEGORIES, default: 'otros' },
        { key: 'where', label: 'Dónde se guarda', type: 'text',
          placeholder: 'Google Fotos, disco externo, OneDrive…',
          hint: 'Lo ideal: 3 copias, en 2 sitios distintos, 1 de ellas fuera de casa.' },
        { key: 'method', label: 'Cómo se hace', type: 'select', options: COPY_METHODS },
        { key: 'frequency', label: 'Hacerla o revisarla', type: 'select', options: COPY_FREQ, half: true },
        { key: 'lastDate', label: 'Última vez', type: 'date', half: true },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Pasos, qué carpetas, dónde está el disco…' }
      ]
    },
    {
      id: 'webs', name: 'Dominios y webs', nav: 'Webs', one: 'web',
      add: 'Nueva web o dominio', edit: 'Editar web o dominio', icon: '🌐',
      cats: WEB_TYPES,
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'midominio.com, Hábitos…' },
        { key: 'category', label: 'Tipo', type: 'select', options: WEB_TYPES, default: 'otro' },
        { key: 'url', label: 'Dirección', type: 'url', placeholder: 'alexlobar.github.io/Habitos/' },
        { key: 'provider', label: 'Proveedor', type: 'text', placeholder: 'GitHub Pages, Namecheap, Hostinger…' },
        { key: 'expires', label: 'Caduca o se renueva', type: 'date', half: true },
        { key: 'price', label: 'Coste al año (€)', type: 'money', half: true },
        { key: 'autoRenew', label: 'Se renueva sola', type: 'check', default: false },
        LOGO_FIELD,
        TAGS_FIELD,
        LINKS_FIELD,
        { key: 'notes', label: 'Notas', type: 'textarea' }
      ]
    }
  ];

  function byId(list, id) {
    return list.filter(function (x) { return x.id === id; })[0] || null;
  }

  function kindById(id) { return byId(KINDS, id); }
  function periodById(id) { return byId(PERIODS, id); }

  /** Nombre visible de un valor de catálogo: optionName(TWOFA, 'app') → "App autenticadora". */
  function optionName(list, id) {
    const o = byId(list, id);
    return o ? o.name : '';
  }

  /* ── Fechas ───────────────────────────────────────────────
     Toda la app identifica un día con una clave "YYYY-MM-DD"
     construida en HORA LOCAL. Usar toISOString() aquí sería un
     bug: convierte a UTC y desplaza un día entero a quien apunte
     algo de madrugada. ─────────────────────────────────────── */

  /** Date → "YYYY-MM-DD" en hora local. */
  function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /** "YYYY-MM-DD" → Date a medianoche local. */
  function fromKey(key) {
    const parts = String(key).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isValidKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
    const d = fromKey(key);
    return !isNaN(d.getTime()) && toKey(d) === key;   // descarta 2025-02-30
  }

  function todayKey() {
    return toKey(new Date());
  }

  /** Suma días respetando cambios de mes, año bisiesto y horario de verano. */
  function addDaysKey(key, n) {
    const d = fromKey(key);
    return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }

  /**
   * Suma meses sin desbordar: el 31 de enero + 1 mes es el 28 (o 29) de
   * febrero, no el 3 de marzo, que es lo que haría new Date(y, m + 1, 31).
   */
  function addMonthsKey(key, n) {
    const d = fromKey(key);
    const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return toKey(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last)));
  }

  /** Días naturales entre dos claves (b - a). Inmune al horario de verano. */
  function daysBetween(keyA, keyB) {
    return Math.round((fromKey(keyB) - fromKey(keyA)) / 86400000);
  }

  const fmtShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
  const fmtFull = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  /** "12 nov" este año; "12 nov 2027" si es de otro. */
  function formatDate(key) {
    if (!isValidKey(key)) return '';
    const d = fromKey(key);
    return (d.getFullYear() === new Date().getFullYear() ? fmtShort : fmtFull).format(d);
  }

  /** Fecha de esta versión: "28/10/2026" */
  function buildDate() {
    const d = fromKey(BUILD_DATE);
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  /* ── Dinero ───────────────────────────────────────────────── */

  const fmtMoney = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

  function money(n) {
    return fmtMoney.format(Number(n) || 0);
  }

  /* ── Texto ────────────────────────────────────────────────── */

  /** Para buscar: sin tildes ni mayúsculas, "Japón" y "japon" caen igual. */
  function plain(s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').trim();
  }

  /**
   * Convierte lo que escribió el usuario en un enlace seguro, o null.
   * "netflix.com" → "https://netflix.com". Solo http y https: un
   * "javascript:" guardado (a mano o en una copia importada) no puede
   * acabar en un href.
   */
  function safeUrl(value) {
    const s = String(value || '').trim();
    if (!s) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
    try {
      const u = new URL(withScheme);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  /** "https://www.netflix.com/es/" → "netflix.com/es" para enseñarlo corto. */
  function shortUrl(value) {
    const href = safeUrl(value);
    if (!href) return String(value || '');
    const u = new URL(href);
    return (u.host.replace(/^www\./, '') + u.pathname).replace(/\/$/, '');
  }

  /* ── DOM ──────────────────────────────────────────────────── */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** createEl('button', { class:'btn', text:'Hola' }, [hijos]) — siempre textContent, nunca innerHTML. */
  function createEl(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === false || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === '--') node.style.setProperty(k, v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ── Varios ───────────────────────────────────────────────── */

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  function debounce(fn, wait) {
    let t = null;
    function wrapped() {
      const args = arguments;
      const self = this;
      clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, wait);
    }
    wrapped.cancel = function () { clearTimeout(t); t = null; };
    /** ¿Hay una llamada esperando? (store.exportNow lo usa para saber si la copia está al día). */
    wrapped.pending = function () { return t !== null; };
    return wrapped;
  }

  return {
    version: VERSION, buildDate: buildDate, CACHE_PREFIX: CACHE_PREFIX,
    ACCENTS: ACCENTS, HOME_CARDS: HOME_CARDS,
    KINDS: KINDS, kindById: kindById,
    PERIODS: PERIODS, periodById: periodById,
    TWOFA: TWOFA, DEVICE_STATUS: DEVICE_STATUS, ACCOUNT_STATUS: ACCOUNT_STATUS, LOGIN_METHODS: LOGIN_METHODS, MIGRATION: MIGRATION,
    COPY_FREQ: COPY_FREQ, COPY_METHODS: COPY_METHODS, MIGRATION_PC: MIGRATION_PC,
    optionName: optionName, byId: byId,
    toKey: toKey, fromKey: fromKey, isValidKey: isValidKey, todayKey: todayKey,
    addDaysKey: addDaysKey, addMonthsKey: addMonthsKey, daysBetween: daysBetween,
    formatDate: formatDate,
    money: money, plain: plain, safeUrl: safeUrl, shortUrl: shortUrl,
    $: $, $$: $$, createEl: createEl,
    uid: uid, debounce: debounce
  };
})();
