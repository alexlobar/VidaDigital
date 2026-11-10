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

  function cleanState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const s = src.settings && typeof src.settings === 'object' ? src.settings : {};

    const out = {
      version: VERSION,
      settings: {
        theme: THEMES.indexOf(s.theme) >= 0 ? s.theme : 'dark',
        backupDays: BACKUP_DAYS.indexOf(Number(s.backupDays)) >= 0 ? Number(s.backupDays) : 14,
        lastExport: U.isValidKey(s.lastExport) ? s.lastExport : null
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

  function writeNow() {
    if (!writable) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('No se pudo guardar:', err);
      lastError = { type: err.name === 'QuotaExceededError' ? 'quota' : 'write' };
      emit('error', lastError);
      return false;
    }
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
  window.addEventListener('pagehide', function () { save(true); });

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
    let mine = KEY.length + JSON.stringify(state).length;
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

  function reset() {
    state = defaultState();
    save(true);
    emit('replace');
  }

  return {
    load: load, save: save, subscribe: subscribe,
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
