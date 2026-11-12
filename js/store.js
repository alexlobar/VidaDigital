/* ============================================================
   store.js — Persistencia y CRUD. Única capa que habla con
   localStorage. No toca el DOM: avisa de los cambios por
   suscripción.
   ============================================================ */
window.VD = window.VD || {};

VD.store = (function () {
  'use strict';

  const U = VD.utils;

  /* Todas las apps de alexlobar.github.io comparten el mismo localStorage:
     la clave lleva el nombre de la app para no pisar los datos de otra. */
  const KEY = 'vidaDigital.v1';
  const BACKUP_KEY = 'vidaDigital.corrupt-backup';
  const VERSION = 1;                 // esquema de datos, no la versión de la app

  /* Topes de longitud por tipo de campo. No están para limitar lo que
     escribas, sino para que un pegado accidental enorme no se coma la
     cuota que comparten todas las apps del dominio. */
  const MAX_LEN = { text: 80, url: 300, textarea: 2000 };
  const MAX_ITEMS = 1000;            // por tipo
  const MAX_LINKS = 30;              // enlaces por elemento
  const MAX_TAGS = 10;               // etiquetas por elemento
  const MAX_TAG = 24;                // caracteres por etiqueta
  const THEMES = ['dark', 'light'];
  const BACKUP_DAYS = [0, 7, 14, 30];   // 0 = no recordar

  let state = null;
  let listeners = [];
  let lastError = null;      // lo consulta app.js tras arrancar
  let writable = true;       // false si el navegador bloquea localStorage

  /* ── Saneado ──────────────────────────────────────────────
     Los datos vienen de localStorage o de una copia importada: son
     entrada externa y pueden estar rotos o editados a mano. Todo lo que
     no encaje se descarta o vuelve a su valor por defecto en lugar de
     romper la app.

     Es además la ÚNICA definición de la forma de los datos: el estado
     inicial también pasa por aquí (defaultState). Un campo nuevo se añade
     en utils.KINDS y este saneado lo rellena solo, tanto en instalaciones
     nuevas como en datos antiguos. ────────────────────────── */

  function cleanField(field, value) {
    switch (field.type) {
      case 'select':
        return U.byId(field.options, value) ? value : (field.default || field.options[0].id);
      case 'money': {
        // Vacío es "sin precio", que no es lo mismo que 0 € (gratis).
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
      }
      case 'date':
        return U.isValidKey(value) ? value : null;
      case 'check':
        return typeof value === 'boolean' ? value : !!field.default;
      case 'tags': {
        // Lista o "trabajo, familia". Sin repetir, sin distinguir
        // mayúsculas: "Trabajo" y "trabajo" son la misma etiqueta.
        const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
        const seen = {};
        return raw.map(function (t) { return typeof t === 'string' ? t.trim().replace(/^#/, '').slice(0, MAX_TAG) : ''; })
          .filter(function (t) {
            const k = U.plain(t);
            if (!k || seen[k]) return false;
            seen[k] = true;
            return true;
          }).slice(0, MAX_TAGS);
      }
      case 'links': {
        // "tipo:id", sin repetir. Que el elemento exista se comprueba
        // después, cuando ya están saneadas todas las listas.
        if (!Array.isArray(value)) return [];
        const seen = {};
        return value.filter(function (k) {
          if (typeof k !== 'string' || seen[k]) return false;
          const parts = k.split(':');
          if (parts.length !== 2 || !U.kindById(parts[0]) || !parts[1] || parts[1].length > 40) return false;
          seen[k] = true;
          return true;
        }).slice(0, MAX_LINKS);
      }
      default:
        return typeof value === 'string' ? value.trim().slice(0, MAX_LEN[field.type] || MAX_LEN.text) : '';
    }
  }

  function cleanItem(kind, raw) {
    if (!raw || typeof raw !== 'object') return null;

    const item = {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : U.uid(kind.id),
      createdAt: U.isValidKey(raw.createdAt) ? raw.createdAt : U.todayKey(),
      updatedAt: U.isValidKey(raw.updatedAt) ? raw.updatedAt : null,
      // No es un campo del formulario: se cambia con el botón Archivar.
      archived: raw.archived === true
    };
    kind.fields.forEach(function (f) { item[f.key] = cleanField(f, raw[f.key]); });

    return item.name ? item : null;
  }

  /**
   * Orden y visibilidad de las tarjetas o secciones del Resumen:
   * { order: [ids], hidden: [ids] }. Los ids que ya no existen se caen y
   * los que falten (una tarjeta nueva de una versión posterior) se añaden
   * al final, visibles: si no, nunca los verías.
   */
  function cleanLayout(raw, catalog) {
    const ids = catalog.map(function (c) { return c.id; });
    const r = raw && typeof raw === 'object' ? raw : {};
    const order = (Array.isArray(r.order) ? r.order : [])
      .filter(function (id, i, all) { return ids.indexOf(id) >= 0 && all.indexOf(id) === i; });
    ids.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    const hidden = (Array.isArray(r.hidden) ? r.hidden : [])
      .filter(function (id, i, all) { return ids.indexOf(id) >= 0 && all.indexOf(id) === i; });
    return { order: order, hidden: hidden };
  }

  function cleanState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const s = src.settings && typeof src.settings === 'object' ? src.settings : {};

    const out = {
      version: VERSION,
      settings: {
        theme: THEMES.indexOf(s.theme) >= 0 ? s.theme : 'dark',
        accent: U.byId(U.ACCENTS, s.accent) ? s.accent : U.ACCENTS[0].id,
        backupDays: BACKUP_DAYS.indexOf(Number(s.backupDays)) >= 0 ? Number(s.backupDays) : 14,
        lastExport: U.isValidKey(s.lastExport) ? s.lastExport : null,
        homeCards: cleanLayout(s.homeCards, U.HOME_CARDS),
        homeSections: cleanLayout(s.homeSections, U.KINDS)
      }
    };

    U.KINDS.forEach(function (kind) {
      const seen = {};
      out[kind.id] = (Array.isArray(src[kind.id]) ? src[kind.id] : [])
        .map(function (r) { return cleanItem(kind, r); })
        .filter(function (it) {
          // Un id repetido (copia editada a mano) haría que editar uno
          // cambiase otro: se queda el primero.
          if (!it || seen[it.id]) return false;
          seen[it.id] = true;
          return true;
        })
        .slice(0, MAX_ITEMS);
    });

    // Enlaces a elementos que ya no existen (borrados, o de una copia
    // editada a mano) y enlaces de un elemento consigo mismo: fuera.
    const exists = {};
    U.KINDS.forEach(function (kind) {
      out[kind.id].forEach(function (it) { exists[kind.id + ':' + it.id] = true; });
    });
    U.KINDS.forEach(function (kind) {
      out[kind.id].forEach(function (it) {
        if (!it.links) return;
        const self = kind.id + ':' + it.id;
        it.links = it.links.filter(function (k) { return exists[k] && k !== self; });
      });
    });

    return out;
  }

  /** La app empieza vacía: lo que tienes se añade a mano o se importa. */
  function defaultState() {
    return cleanState({});
  }

  /* ── Migraciones ──────────────────────────────────────────
     Una función por cambio de esquema que TRANSFORME datos que ya
     existen. Un campo nuevo no necesita migración: basta con su valor
     por defecto en el saneado. Hoy no hay ninguna (esquema 1).
     ─────────────────────────────────────────────────────── */

  function migrate(incoming) {
    // if (incoming < 2) migrateXxx();
    return incoming;
  }

  /* ── Cifrado ──────────────────────────────────────────────
     Con contraseña, lo que se guarda en localStorage (y las copias
     exportadas) es un sobre cifrado, no el JSON a la vista:

       { app: 'vida-digital', enc: 1, iter, salt, iv, data }

     · La clave sale de la contraseña con PBKDF2-SHA-256 (600 000 vueltas,
       lo que recomienda OWASP) y una sal aleatoria: probar contraseñas a
       ciegas cuesta lo mismo que esas vueltas por cada intento.
     · Se cifra con AES-GCM de 256 bits y un IV nuevo en cada guardado. GCM
       además detecta cualquier cambio en los datos: una contraseña mala o
       un sobre manipulado dan error, nunca datos basura.
     · La contraseña no se guarda en ningún sitio. Solo vive en memoria la
       clave derivada, y no se puede extraer. Si se olvida la contraseña,
       no hay forma de recuperar los datos: es lo que hace útil el cifrado.
     ─────────────────────────────────────────────────────── */

  const KDF_ITER = 600000;
  const ENC_APP = 'vida-digital';

  let cryptoKey = null;      // CryptoKey AES-GCM, solo si hay contraseña
  let cryptoSalt = null;     // sal de la contraseña actual (Uint8Array)
  let verifier = null;       // un sobre pequeño para comprobar la contraseña
  let lockedEnvelope = null; // el sobre leído al arrancar, hasta desbloquear
  let writeChain = Promise.resolve();
  /* El último sobre escrito, listo para compartir. Compartir tiene que
     llamarse en el mismo toque del botón, sin esperas: si antes hubiera que
     cifrar (asíncrono), el navegador lo bloquearía con NotAllowedError.
     Como cada cambio ya se cifra al guardarse, la copia está siempre hecha. */
  let sealedText = null;
  let sealsPending = 0;      // cifrados en marcha

  function toB64(bytes) {
    let s = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }

  function fromB64(text) {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function isEnvelope(obj) {
    return !!obj && obj.enc === 1 && typeof obj.data === 'string' &&
           typeof obj.salt === 'string' && typeof obj.iv === 'string';
  }

  function cryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle);
  }

  function deriveKey(password, salt, iter) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function seal(obj, key, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain).then(function (data) {
      return { app: ENC_APP, enc: 1, iter: KDF_ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
    });
  }

  /** Sobre → objeto. Rechaza (OperationError) si la clave no es la buena. */
  function unseal(envelope, key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data))
      .then(function (plain) { return JSON.parse(new TextDecoder().decode(plain)); });
  }

  /** Abre un sobre con una contraseña. Devuelve el objeto o null si no es la buena. */
  function openWithPassword(envelope, password) {
    const salt = fromB64(envelope.salt);
    let key = null;
    return deriveKey(password, salt, Number(envelope.iter) || KDF_ITER)
      .then(function (k) { key = k; return unseal(envelope, k); })
      .then(function (obj) { return { obj: obj, key: key, salt: salt }; })
      .catch(function () { return null; });
  }

  function remember(key, salt) {
    cryptoKey = key;
    cryptoSalt = salt;
    return seal({ ok: true }, key, salt).then(function (env) { verifier = env; });
  }

  function isEncrypted() { return !!cryptoKey; }
  function isLocked() { return !!lockedEnvelope; }

  /** Desbloquea los datos al arrancar. true si la contraseña era la buena. */
  function unlock(password) {
    if (!lockedEnvelope) return Promise.resolve(true);
    return openWithPassword(lockedEnvelope, password).then(function (res) {
      if (!res) return false;
      return remember(res.key, res.salt).then(function () {
        const incoming = Math.floor(Number(res.obj && res.obj.version)) || 1;
        state = cleanState(res.obj);
        migrate(incoming);
        // Lo guardado es justo lo que se acaba de abrir: ya es la copia.
        sealedText = JSON.stringify(lockedEnvelope);
        lockedEnvelope = null;
        lastError = null;
        return true;
      });
    });
  }

  /** ¿Es esta la contraseña actual? Para cambiarla o quitarla. */
  function checkPassword(password) {
    if (!verifier) return Promise.resolve(false);
    return openWithPassword(verifier, password).then(function (res) { return !!res; });
  }

  /** Pone o cambia la contraseña y vuelve a guardar todo cifrado con ella. */
  function setPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(password, salt, KDF_ITER)
      .then(function (key) { return remember(key, salt); })
      .then(function () { return save(true); });
  }

  /** Quita la contraseña: los datos vuelven a guardarse sin cifrar. */
  function removePassword() {
    cryptoKey = null;
    cryptoSalt = null;
    verifier = null;
    sealedText = null;
    return Promise.resolve(save(true));
  }

  /**
   * "He olvidado la contraseña": se empieza de cero, pero el sobre cifrado
   * se guarda aparte por si un día la recuerdas (se puede importar).
   */
  function forgetAndReset() {
    try { if (lockedEnvelope) localStorage.setItem(BACKUP_KEY, JSON.stringify(lockedEnvelope)); } catch (e) { /* sin espacio */ }
    lockedEnvelope = null;
    cryptoKey = null;
    cryptoSalt = null;
    verifier = null;
    sealedText = null;
    lastError = null;
    state = defaultState();
    save(true);
  }

  /**
   * El texto de la copia, al momento (sin promesas: se llama desde el toque
   * de un botón que va a compartir). Cifrada si hay contraseña.
   * { text, fresh }: `fresh` es false si hay un cambio aún sin cifrar (el
   * último medio segundo); entonces `text` es la copia anterior o null.
   */
  function exportNow() {
    if (!state) return { text: null, fresh: false };
    if (!cryptoKey) return { text: JSON.stringify(state, null, 2), fresh: true };
    return { text: sealedText, fresh: !!sealedText && !scheduleWrite.pending() && sealsPending === 0 };
  }

  /* ── Carga y guardado ─────────────────────────────────────── */

  function load() {
    lastError = null;
    let raw = null;

    try {
      raw = localStorage.getItem(KEY);
    } catch (err) {
      // Safari en privado, cookies bloqueadas: la app sigue en memoria.
      console.warn('localStorage no accesible:', err);
      lastError = { type: 'unavailable' };
      writable = false;
      state = defaultState();
      return state;
    }

    if (!raw) {
      state = defaultState();
      save();
      return state;
    }

    try {
      const parsed = JSON.parse(raw);

      // Cifrado: no hay estado hasta que se escriba la contraseña. Nada se
      // guarda mientras tanto (writeNow lo comprueba).
      if (isEnvelope(parsed)) {
        lockedEnvelope = parsed;
        state = null;
        lastError = { type: cryptoAvailable() ? 'locked' : 'nocrypto' };
        return null;
      }

      const incoming = Math.floor(Number(parsed && parsed.version)) || 1;
      state = cleanState(parsed);
      migrate(incoming);
      save();
    } catch (err) {
      console.error('Datos corruptos en localStorage:', err);
      // Se conserva el original por si hay que recuperarlo a mano.
      try { localStorage.setItem(BACKUP_KEY, raw); } catch (e) { /* sin espacio: se pierde */ }
      lastError = { type: 'corrupt' };
      state = defaultState();
      save();
    }
    return state;
  }

  function writeText(text) {
    try {
      localStorage.setItem(KEY, text);
      return true;
    } catch (err) {
      console.error('No se pudo guardar:', err);
      lastError = { type: err.name === 'QuotaExceededError' ? 'quota' : 'write' };
      emit('error', lastError);
      return false;
    }
  }

  /**
   * Sin contraseña, escribe al momento. Con ella, cifrar es asíncrono: las
   * escrituras se encadenan para que una más antigua no pise a una más
   * nueva. Devuelve true o una promesa de true/false.
   */
  function writeNow() {
    if (!writable || !state) return false;     // bloqueada: no hay nada que guardar
    if (!cryptoKey) return writeText(JSON.stringify(state));

    const snapshot = JSON.parse(JSON.stringify(state));
    const key = cryptoKey;
    const salt = cryptoSalt;
    sealsPending++;
    writeChain = writeChain
      .then(function () { return seal(snapshot, key, salt); })
      .then(function (env) {
        const text = JSON.stringify(env);
        // Si entretanto se quitó la contraseña, este sobre ya no vale como copia.
        if (cryptoKey === key) sealedText = text;
        return writeText(text);
      })
      .catch(function (err) {
        console.error('No se pudo cifrar:', err);
        lastError = { type: 'write' };
        emit('error', lastError);
        return false;
      })
      .then(function (ok) { sealsPending--; return ok; });
    return writeChain;
  }

  // Escribir en el buscador o guardar varias cosas seguidas genera ráfagas:
  // se agrupan para no serializar todo el estado en cada una.
  const scheduleWrite = U.debounce(writeNow, 180);

  function save(immediate) {
    if (immediate) { scheduleWrite.cancel(); return writeNow(); }
    scheduleWrite();
    return true;
  }

  // Cerrar la pestaña con una escritura pendiente perdería el último cambio.
  // Con cifrado la escritura es asíncrona y `pagehide` puede no esperarla:
  // por eso también se guarda al pasar a segundo plano, que en el móvil
  // llega antes (cambiar de app, bloquear la pantalla).
  window.addEventListener('pagehide', function () { save(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save(true);
  });

  /* Tope de localStorage por origen en Chrome, Firefox y Safari: 5 MiB,
     contados en caracteres. El origen es alexlobar.github.io entero, así
     que se reparte con las demás apps publicadas ahí. */
  const STORAGE_MAX = 5 * 1024 * 1024;

  /**
   * Cuánto ocupa el almacenamiento, en caracteres (≈ bytes). Se mide el
   * estado en memoria y no lo escrito, para que una escritura pendiente no
   * falsee la cifra. `others` es lo de otras apps del mismo origen.
   */
  function storageUse() {
    // Cifrado ocupa un tercio más (base64): se cuenta para no quedarse corto.
    let mine = KEY.length + Math.round(JSON.stringify(state).length * (cryptoKey ? 1.34 : 1));
    let others = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === KEY) continue;
        const size = k.length + (localStorage.getItem(k) || '').length;
        if (k === BACKUP_KEY) mine += size;
        else others += size;
      }
    } catch (e) { /* sin acceso al almacenamiento: solo cuenta el estado */ }
    return { mine: mine, others: others, max: STORAGE_MAX };
  }

  /* ── Suscripción ──────────────────────────────────────────── */

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  function emit(event, payload) {
    listeners.forEach(function (fn) {
      try { fn(event, payload); } catch (err) { console.error('Listener falló:', err); }
    });
  }

  /** Persiste y avisa. */
  function commit(event, payload) {
    save();
    emit(event || 'change', payload);
  }

  /* ── Lectura ──────────────────────────────────────────────── */

  function getState() { return state; }
  function getSettings() { return state.settings; }
  function getLastError() { return lastError; }

  function getItems(kindId) { return state[kindId].slice(); }

  function getItem(kindId, id) {
    return state[kindId].filter(function (it) { return it.id === id; })[0] || null;
  }

  /** "subs:subs_abc" → { kind, item }, o null si ya no existe. */
  function resolveLink(key) {
    const parts = String(key).split(':');
    if (!state[parts[0]]) return null;
    const item = getItem(parts[0], parts[1]);
    return item ? { kind: parts[0], item: item } : null;
  }

  /**
   * Todo lo enlazado con un elemento, en los dos sentidos: lo que apunta
   * él y lo que le apunta a él. Así enlazar desde la cuenta o desde la
   * suscripción da lo mismo, y no hay que mantener dos copias al día.
   */
  function getLinked(kindId, id) {
    const self = kindId + ':' + id;
    const item = getItem(kindId, id);
    const keys = item && item.links ? item.links.slice() : [];
    U.KINDS.forEach(function (kind) {
      state[kind.id].forEach(function (other) {
        if (other.links && other.links.indexOf(self) >= 0) {
          const k = kind.id + ':' + other.id;
          if (keys.indexOf(k) < 0) keys.push(k);
        }
      });
    });
    return keys.map(resolveLink).filter(Boolean);
  }

  /* ── Escritura ────────────────────────────────────────────── */

  /**
   * Crea (sin `id`) o actualiza (con `id`). Pasa por el saneado, así que
   * lo que llegue del formulario no puede dejar un elemento a medias.
   * Devuelve el elemento guardado o null si no era válido.
   */
  function saveItem(kindId, data) {
    const kind = U.kindById(kindId);
    const list = state[kindId];
    const today = U.todayKey();

    let index = -1;
    if (data.id) {
      for (let i = 0; i < list.length; i++) if (list[i].id === data.id) { index = i; break; }
    }
    const prev = index >= 0 ? list[index] : null;
    if (!prev && list.length >= MAX_ITEMS) return null;

    const item = cleanItem(kind, Object.assign({}, prev, data, {
      id: prev ? prev.id : U.uid(kindId),
      createdAt: prev ? prev.createdAt : today,
      updatedAt: today
    }));
    if (!item) return null;

    if (prev) list[index] = item;
    else list.push(item);

    // El formulario manda la lista completa de enlaces, en los dos
    // sentidos. Lo que quitaste y estaba guardado en el otro elemento se
    // borra allí también; si no, getLinked lo seguiría enseñando.
    if (Array.isArray(data.links)) {
      const self = kindId + ':' + item.id;
      item.links = item.links.filter(function (k) { return k !== self; });
      U.KINDS.forEach(function (kind) {
        state[kind.id].forEach(function (other) {
          if (!other.links || other.links.indexOf(self) < 0) return;
          if (item.links.indexOf(kind.id + ':' + other.id) >= 0) return;
          other.links = other.links.filter(function (k) { return k !== self; });
        });
      });
    }

    commit('items', { kind: kindId });
    return item;
  }

  /** Quita un elemento y devuelve lo necesario para deshacerlo. */
  function removeItem(kindId, id) {
    const list = state[kindId];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      const item = list.splice(i, 1)[0];
      commit('items', { kind: kindId });
      return { kind: kindId, item: item, index: i };
    }
    return null;
  }

  function restoreItem(removed) {
    if (!removed || getItem(removed.kind, removed.item.id)) return;
    const list = state[removed.kind];
    list.splice(Math.min(removed.index, list.length), 0, removed.item);
    commit('items', { kind: removed.kind });
  }

  /**
   * Para el siguiente cambio de móvil (apps) u ordenador (programs): todo
   * lo que se pasó vuelve a "Pendiente". Lo de "No la paso" se queda.
   */
  function resetMigration(kindId) {
    const today = U.todayKey();
    state[kindId].forEach(function (a) {
      if (a.migration === 'no' || a.migration === 'pendiente') return;
      a.migration = 'pendiente';
      a.updatedAt = today;
    });
    commit('items', { kind: kindId });
  }

  /**
   * Archivar no borra: el elemento deja de contar (gasto, avisos,
   * progreso) y pasa al final de su lista, plegado. Se puede recuperar.
   */
  function setArchived(kindId, id, archived) {
    const item = getItem(kindId, id);
    if (!item) return null;
    item.archived = !!archived;
    item.updatedAt = U.todayKey();
    commit('items', { kind: kindId });
    return item;
  }

  /**
   * Importación en bloque (desde Excel). Si en la misma sección ya hay un
   * elemento con el mismo nombre, se completa con lo que traiga la fila
   * (las celdas vacías no borran nada); si no, se crea. Un solo guardado.
   */
  function importItems(entries) {
    const today = U.todayKey();
    let added = 0;
    let updated = 0;

    entries.forEach(function (e) {
      const kind = U.kindById(e.kind);
      const list = state[e.kind];
      const name = U.plain(e.data.name);
      let index = -1;
      for (let i = 0; i < list.length; i++) if (U.plain(list[i].name) === name) { index = i; break; }

      if (index >= 0) {
        const merged = Object.assign({}, list[index]);
        Object.keys(e.data).forEach(function (k) {
          // El nombre ya coincide: se queda como lo escribiste tú, no
          // como venga en la hoja ("netflix" no pisa a "Netflix").
          if (k === 'name') return;
          const v = e.data[k];
          if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) merged[k] = v;
        });
        merged.updatedAt = today;
        const item = cleanItem(kind, merged);
        if (item) { list[index] = item; updated++; }
      } else if (list.length < MAX_ITEMS) {
        const item = cleanItem(kind, Object.assign({}, e.data, { id: U.uid(e.kind), createdAt: today, updatedAt: today }));
        if (item) { list.push(item); added++; }
      }
    });

    save(true);
    emit('replace');
    return { added: added, updated: updated };
  }

  function setSetting(key, value) {
    const patch = {};
    patch[key] = value;
    // Pasa por el saneado completo: un valor que no está en el catálogo
    // vuelve a su valor por defecto en vez de colarse en los datos.
    state.settings = cleanState({ settings: Object.assign({}, state.settings, patch) }).settings;
    commit('settings');
  }

  function markExported() {
    state.settings.lastExport = U.todayKey();
    commit('settings');
  }

  /* Tarjetas (list 'homeCards') y secciones ('homeSections') del Resumen. */

  /** Sube (dir -1) o baja (dir 1) un elemento un puesto. */
  function moveLayout(list, id, dir) {
    const order = state.settings[list].order.slice();
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    order[i] = order[j];
    order[j] = id;
    setSetting(list, { order: order, hidden: state.settings[list].hidden });
  }

  function toggleLayout(list, id) {
    const hidden = state.settings[list].hidden.slice();
    const i = hidden.indexOf(id);
    if (i >= 0) hidden.splice(i, 1);
    else hidden.push(id);
    setSetting(list, { order: state.settings[list].order, hidden: hidden });
  }

  /** Importar una copia: misma puerta que la carga, saneado y migraciones. */
  function replaceState(raw) {
    const incoming = Math.floor(Number(raw && raw.version)) || 1;
    // La fecha de la última copia es de este navegador, no de la copia.
    const lastExport = state.settings.lastExport;
    state = cleanState(raw);
    migrate(incoming);
    state.settings.lastExport = lastExport;
    save(true);
    emit('replace');
  }

  /** Borrar todo: datos y contraseña. Se empieza de cero, sin cifrar. */
  function reset() {
    cryptoKey = null;
    cryptoSalt = null;
    verifier = null;
    sealedText = null;
    state = defaultState();
    save(true);
    emit('replace');
  }

  return {
    load: load, save: save, subscribe: subscribe,
    isEncrypted: isEncrypted, isLocked: isLocked, cryptoAvailable: cryptoAvailable, isEnvelope: isEnvelope,
    unlock: unlock, checkPassword: checkPassword, setPassword: setPassword, removePassword: removePassword,
    forgetAndReset: forgetAndReset, exportNow: exportNow, openBackup: openWithPassword,
    moveLayout: moveLayout, toggleLayout: toggleLayout,
    getState: getState, getSettings: getSettings, getLastError: getLastError,
    getItems: getItems, getItem: getItem, getLinked: getLinked, resolveLink: resolveLink,
    saveItem: saveItem, removeItem: removeItem, restoreItem: restoreItem,
    resetMigration: resetMigration, setArchived: setArchived, importItems: importItems,
    setSetting: setSetting, markExported: markExported,
    replaceState: replaceState, reset: reset,
    storageUse: storageUse,
    KEY: KEY, BACKUP_KEY: BACKUP_KEY, BACKUP_DAYS: BACKUP_DAYS
  };
})();
