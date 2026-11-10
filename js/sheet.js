/* ============================================================
   sheet.js — El formato de Excel: columnas, plantilla y lectura
   de lo que se pega o se importa. Funciones puras: ni toca el
   DOM ni escribe datos (eso lo hacen ui.js y store.js).

   Exportar e importar usan las mismas columnas, así que un CSV
   exportado se puede editar en Excel y volver a importar.
   ============================================================ */
window.VD = window.VD || {};

VD.sheet = (function () {
  'use strict';

  const U = VD.utils;

  /* ── Columnas ─────────────────────────────────────────────
     Todos los campos de todos los tipos, sin repetir y en orden. La
     cabecera es la etiqueta del primer tipo que usa el campo, sin "(€)":
     "Servicio" para el nombre, "Categoría", "Precio"… ──────────── */

  function columns() {
    const cols = [];
    U.KINDS.forEach(function (k) {
      k.fields.forEach(function (f) {
        if (!cols.some(function (c) { return c.key === f.key; })) {
          cols.push({ key: f.key, label: f.label.replace(/ \(€\)$/, '') });
        }
      });
    });
    return cols;
  }

  /* "Archivado" va al final: no es un campo del formulario, pero sin él
     exportar y volver a importar desarchivaría todo. */
  function header() {
    return ['tipo'].concat(columns().map(function (c) { return c.label; }), ['Archivado']);
  }

  /** "18/11/2026": como lo escribe y lo entiende Excel en español. */
  function dateCell(key) {
    if (!U.isValidKey(key)) return '';
    const p = key.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /** Una fila de exportación. `linkedNames` llega de fuera: es del store. */
  function row(kind, item, linkedNames) {
    return [kind.one].concat(columns().map(function (c) {
      const f = kind.fields.filter(function (x) { return x.key === c.key; })[0];
      if (!f) return '';
      const v = item[f.key];
      if (f.type === 'select') return U.optionName(f.options, v);
      if (f.type === 'check') return v ? 'sí' : 'no';
      if (f.type === 'links') return (linkedNames || []).join(', ');
      if (f.type === 'tags') return (v || []).join(', ');
      // Coma decimal: es lo que espera Excel en español.
      if (f.type === 'money') return v === null ? '' : String(v).replace('.', ',');
      if (f.type === 'date') return dateCell(v);
      return v === null || v === undefined ? '' : v;
    }), [item.archived ? 'sí' : '']);
  }

  /* Un ejemplo por sección para la plantilla, escrito como lo teclearías
     en Excel. Lo que no aparece se queda vacío. */
  const EXAMPLES = {
    subs: { name: 'Netflix', category: 'Vídeo y streaming', price: '13,99', period: 'Cada mes',
            nextDate: '18/12/2026', sharedWith: 'Ana', myPrice: '7', account: 'yo@gmail.com',
            payment: 'Tarjeta', active: 'sí', url: 'netflix.com', tags: 'ocio, compartido' },
    accounts: { name: 'Gmail', category: 'Correo', user: 'yo@gmail.com', twofa: 'App autenticadora',
                recovery: 'Móvil', important: 'sí', status: 'La uso', url: 'gmail.com' },
    apps: { name: 'WhatsApp', category: 'Mensajería', migration: 'Pendiente', login: 'Número de teléfono',
            transfer: 'Copia de chats' },
    programs: { name: 'Steam', category: 'Juegos', migration: 'Pendiente', source: 'Web oficial',
                account: 'mi_usuario', transfer: 'Partidas guardadas' },
    devices: { name: 'Móvil personal', category: 'Móviles', model: 'Pixel 8', purchaseDate: '01/03/2024',
               warrantyUntil: '01/03/2027', price: '699', status: 'En uso' },
    licenses: { name: 'Office 2021', category: 'Ofimática', keyWhere: 'Correo de compra',
                seller: 'Microsoft Store', purchaseDate: '15/01/2025' },
    copies: { name: 'Fotos del móvil', category: 'Fotos y vídeos', where: 'Google Fotos',
              method: 'Automática (solo comprobarla)', frequency: 'Cada mes', lastDate: '01/11/2026' },
    webs: { name: 'Hábitos', category: 'Apps publicadas', url: 'alexlobar.github.io/Habitos/',
            provider: 'GitHub Pages', autoRenew: 'no' }
  };

  function template() {
    const cols = columns();
    return [header()].concat(U.KINDS.map(function (k) {
      const ex = EXAMPLES[k.id] || {};
      return [k.one].concat(cols.map(function (c) { return ex[c.key] || ''; }));
    }));
  }

  /* ── Lectura ──────────────────────────────────────────────
     Lo copiado de Excel llega separado por tabuladores; un CSV, por ";"
     (Excel en español) o por ",". Se adivina por la primera línea. ── */

  function norm(s) {
    return U.plain(s).replace(/\(€\)/g, '').replace(/[^a-z0-9]/g, '');
  }

  function delimiterOf(line) {
    const count = function (ch) { return line.split(ch).length - 1; };
    if (count('\t')) return '\t';
    return count(';') >= count(',') ? ';' : ',';
  }

  /** Texto → filas de celdas. Respeta comillas ("Ana, Luis") y saltos dentro de ellas. */
  function splitRows(text) {
    const src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const delim = delimiterOf(src.split('\n')[0] || '');
    const rows = [];
    let rowCells = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') {
        quoted = true;
      } else if (ch === delim) {
        rowCells.push(cell); cell = '';
      } else if (ch === '\n') {
        rowCells.push(cell); rows.push(rowCells); rowCells = []; cell = '';
      } else {
        cell += ch;
      }
    }
    rowCells.push(cell);
    rows.push(rowCells);
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }

  /* Cabecera → campo. Vale la etiqueta de cualquier tipo ("Precio de
     compra" y "Coste al año" son los dos `price`), el nombre interno y
     algunos sinónimos. */
  const HEADER_ALIASES = {
    nombre: 'name', name: 'name', titulo: 'name',
    precio: 'price', importe: 'price', coste: 'price', etiqueta: 'tags', web: 'url', url: 'url',
    usuario: 'user', email: 'user', correo: 'user', estado: 'status', fechadecompra: 'purchaseDate'
  };

  function headerMap() {
    // "tipo" es siempre la sección, aunque "Tipo" también sea la etiqueta
    // de la categoría en Dispositivos o Webs: por eso va antes que nada.
    const map = { tipo: '__kind', seccion: '__kind', archivado: '__archived' };
    U.KINDS.forEach(function (k) {
      k.fields.forEach(function (f) {
        if (!map[norm(f.label)]) map[norm(f.label)] = f.key;
        if (!map[norm(f.key)]) map[norm(f.key)] = f.key;
      });
    });
    Object.keys(HEADER_ALIASES).forEach(function (a) { if (!map[a]) map[a] = HEADER_ALIASES[a]; });
    return map;
  }

  /* Valor de la columna "tipo" → sección. Singular, plural o el id. */
  const KIND_ALIASES = {
    aplicacion: 'apps', aplicaciones: 'apps', equipo: 'devices', equipos: 'devices',
    clave: 'licenses', claves: 'licenses', copiadeseguridad: 'copies', backup: 'copies',
    dominio: 'webs', dominios: 'webs', webs: 'webs', suscripciones: 'subs', software: 'programs'
  };

  function kindOf(value) {
    const v = norm(value);
    if (!v) return null;
    for (let i = 0; i < U.KINDS.length; i++) {
      const k = U.KINDS[i];
      if ([k.id, k.one, k.name, k.nav].some(function (x) { return norm(x) === v; })) return k.id;
      if (norm(k.one) + 's' === v || norm(k.one) + 'es' === v) return k.id;
    }
    return KIND_ALIASES[v] || null;
  }

  /** "18/11/2026", "18-11-26", "2026-11-18" → "2026-11-18"; si no, null. */
  function parseDate(s) {
    const t = String(s).trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return valid(m[1], m[2], m[3]);
    m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (m) return valid(m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]);
    return null;

    function valid(y, mo, d) {
      const key = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      return U.isValidKey(key) ? key : null;
    }
  }

  /** "1.234,56 €", "13,99", "13.99" → número; si no, null. */
  function parseMoney(s) {
    let raw = String(s).replace(/[\s€]/g, '');
    if (!raw) return null;
    if (raw.indexOf(',') >= 0) raw = raw.replace(/\./g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  }

  const YES = ['si', 's', 'x', 'true', 'verdadero', '1', 'yes', 'activa', 'activo'];

  /**
   * Una celda → valor del campo, o undefined si está vacía o no se
   * entiende (y entonces el saneado pone el valor por defecto o, si el
   * elemento ya existía, se queda el que tenía).
   */
  function cellValue(f, raw) {
    const s = String(raw).trim();
    if (!s) return undefined;
    switch (f.type) {
      case 'select': {
        const v = norm(s);
        const o = f.options.filter(function (x) { return norm(x.name) === v || norm(x.id) === v; })[0] ||
                  f.options.filter(function (x) { return norm(x.name).indexOf(v) === 0; })[0];
        return o ? o.id : undefined;
      }
      case 'money': { const n = parseMoney(s); return n === null ? undefined : n; }
      case 'date': { const d = parseDate(s); return d || undefined; }
      case 'check': return YES.indexOf(norm(s)) >= 0;
      case 'links': return undefined;     // los enlaces no se importan
      default: return s;
    }
  }

  /**
   * Texto pegado o CSV → { entries: [{ kind, data }], skipped: [{ line, reason }],
   *                        ignored: [cabeceras que no se reconocen] }
   * `fallbackKind`: la sección de las filas sin columna "tipo".
   */
  function parse(text, fallbackKind) {
    const rows = splitRows(text);
    const out = { entries: [], skipped: [], ignored: [] };
    if (rows.length < 2) {
      out.skipped.push({ line: 1, reason: 'Hace falta la fila de cabecera y al menos una fila de datos.' });
      return out;
    }

    const map = headerMap();
    const keys = rows[0].map(function (h) {
      const k = map[norm(h)];
      if (!k && h.trim()) out.ignored.push(h.trim());
      return k || null;
    });
    if (keys.indexOf('name') < 0) {
      out.skipped.push({ line: 1, reason: 'No encuentro la columna del nombre («Servicio» o «Nombre»).' });
      return out;
    }
    const kindCol = keys.indexOf('__kind');

    rows.slice(1).forEach(function (cells, i) {
      const line = i + 2;
      const kindId = kindCol >= 0 && cells[kindCol] && cells[kindCol].trim() ? kindOf(cells[kindCol]) : fallbackKind;
      if (!kindId) {
        out.skipped.push({ line: line, reason: kindCol >= 0 && cells[kindCol] && cells[kindCol].trim()
          ? 'Tipo «' + cells[kindCol].trim() + '» desconocido.' : 'Falta el tipo.' });
        return;
      }
      const kind = U.kindById(kindId);
      const data = {};
      keys.forEach(function (key, c) {
        if (!key || key === '__kind' || cells[c] === undefined) return;
        if (key === '__archived') {
          if (String(cells[c]).trim()) data.archived = YES.indexOf(norm(cells[c])) >= 0;
          return;
        }
        const f = kind.fields.filter(function (x) { return x.key === key; })[0];
        if (!f) return;                  // columna de otra sección: vacía en esta fila
        const v = cellValue(f, cells[c]);
        if (v !== undefined) data[key] = v;
      });
      if (!data.name) { out.skipped.push({ line: line, reason: 'Sin nombre.' }); return; }
      out.entries.push({ kind: kindId, data: data });
    });
    return out;
  }

  return { columns: columns, header: header, row: row, template: template, parse: parse };
})();
