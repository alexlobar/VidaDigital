/* ============================================================
   ui.js — Todo el DOM vive aquí: vistas, listas, formulario,
   avisos y la línea de versión. Lee del store y de calc, pero
   nunca escribe datos: las acciones pasan por app.js.
   ============================================================ */
window.VD = window.VD || {};

VD.ui = (function () {
  'use strict';

  const U = VD.utils;
  const S = VD.store;
  const C = VD.calc;
  const $ = U.$;
  const el = U.createEl;

  const VIEWS = ['home', 'subs', 'accounts', 'devices', 'webs', 'settings'];
  const THEME_COLOR = { dark: '#0d1117', light: '#f5f7fb' };
  const fmtMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' });

  const els = {};
  let missingIds = [];      // ids que no estaban en el HTML al arrancar
  let formKind = null;      // tipo del formulario abierto
  let formId = null;        // elemento que se edita; null = nuevo

  /* ── Arranque ─────────────────────────────────────────────── */

  function init() {
    const ids = [
      'main', 'homeWelcome', 'btnWelcomeImport',
      'spendMonth', 'spendYear', 'spendCats',
      'homeUpcoming', 'homeUpcomingEmpty', 'securityLine', 'securityList', 'homeTiles',
      'itemModal', 'itemForm', 'itemTitle', 'itemFields', 'itemError',
      'btnItemClose', 'btnItemDelete', 'btnItemCancel',
      'setTheme', 'setBackup', 'backupStatus',
      'btnExportJson', 'btnImport', 'btnExportCsv', 'btnReset',
      'installRow', 'btnInstall', 'buildCache', 'buildQuota', 'buildPersist', 'buildHint',
      'toastStack'
    ];
    // Las cuatro listas comparten estructura: sus ids salen del catálogo.
    U.KINDS.forEach(function (k) {
      ['List', 'Empty', 'Search', 'Count', 'Add'].forEach(function (s) { ids.push(k.id + s); });
    });
    VIEWS.forEach(function (v) { ids.push('view-' + v); });

    ids.forEach(function (id) { els[id] = document.getElementById(id); });

    // Un id que falte no puede tumbar la app: antes, un solo hueco en el
    // HTML la dejaba pintada pero sin responder a nada. Se rellena con un
    // nodo suelto, lo que dependa de él no se ve, y app.js avisa al arrancar.
    missingIds = ids.filter(function (id) { return !els[id]; });
    missingIds.forEach(function (id) { els[id] = document.createElement(id.indexOf('view-') === 0 ? 'section' : 'span'); });
    if (missingIds.length) console.error('Faltan estos elementos en index.html: ' + missingIds.join(', '));

    els.navItems = U.$$('.nav__item');
    els.themeMeta = $('meta[name="theme-color"]');
  }

  function getMissingIds() { return missingIds.slice(); }

  /* ── Vistas ───────────────────────────────────────────────── */

  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = 'home';
    VIEWS.forEach(function (v) { els['view-' + v].hidden = v !== name; });
    els.navItems.forEach(function (b) {
      if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    return name;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (els.themeMeta) els.themeMeta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR.dark);
  }

  /* ── Piezas comunes ───────────────────────────────────────── */

  function catOf(kind, item) {
    return U.byId(kind.cats, item.category) || { icon: kind.icon, name: '' };
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  }

  /** "hoy", "mañana", "en 5 días", "hace 3 días" */
  function relative(today, key) {
    const n = U.daysBetween(today, key);
    if (n === 0) return 'hoy';
    if (n === 1) return 'mañana';
    if (n > 0) return 'en ' + n + ' días';
    return n === -1 ? 'ayer' : 'hace ' + (-n) + ' días';
  }

  /** Fila pulsable que abre un elemento; la usan el resumen y la seguridad. */
  function rowButton(kindId, item, date, meta, tone) {
    const kind = U.kindById(kindId);
    const d = date ? U.fromKey(date) : null;
    return el('button', {
      type: 'button', class: 'event' + (tone ? ' event--' + tone : ''),
      'data-kind': kindId, 'data-id': item.id
    }, [
      d ? el('span', { class: 'event__date' }, [
        el('span', { class: 'event__day', text: String(d.getDate()) }),
        el('span', { class: 'event__month', text: fmtMonth.format(d).replace('.', '') })
      ]) : el('span', { class: 'event__date event__date--icon', 'aria-hidden': 'true', text: catOf(kind, item).icon }),
      el('span', { class: 'event__body' }, [
        el('span', { class: 'event__name', text: (d ? catOf(kind, item).icon + ' ' : '') + item.name }),
        el('span', { class: 'event__meta', text: meta })
      ])
    ]);
  }

  /* ── Resumen ──────────────────────────────────────────────── */

  function renderHome(today) {
    const state = S.getState();
    els.homeWelcome.hidden = U.KINDS.some(function (k) { return state[k.id].length > 0; });

    // Gasto
    const t = C.totals(state);
    els.spendMonth.textContent = U.money(t.month);
    const sub = [U.money(t.year) + ' al año',
                 t.activeSubs + (t.activeSubs === 1 ? ' suscripción activa' : ' suscripciones activas')];
    if (t.websYear) sub.push('incluye ' + U.money(t.websYear) + ' al año de dominios');
    els.spendYear.textContent = sub.join(' · ');

    els.spendCats.textContent = '';
    const top = t.categories.length ? t.categories[0].month : 0;
    t.categories.forEach(function (c) {
      els.spendCats.appendChild(el('li', { class: 'bar' }, [
        el('span', { class: 'bar__label', text: c.cat.icon + ' ' + c.cat.name }),
        el('span', { class: 'bar__value', text: U.money(c.month) }),
        el('span', { class: 'bar__track', 'aria-hidden': 'true' }, [
          el('span', { class: 'bar__fill', '--w': (c.month / top * 100).toFixed(1) + '%' })
        ])
      ]));
    });

    // Próximos 30 días
    const events = C.upcoming(state, today, 30);
    els.homeUpcoming.textContent = '';
    events.forEach(function (ev) {
      const n = U.daysBetween(today, ev.date);
      els.homeUpcoming.appendChild(el('li', null, [
        rowButton(ev.kind, ev.item, ev.date, ev.text + ' · ' + relative(today, ev.date),
                  ev.overdue ? 'danger' : n <= 3 ? 'warn' : '')
      ]));
    });
    els.homeUpcomingEmpty.hidden = events.length > 0;

    // Seguridad
    const sec = C.security(state);
    els.securityList.textContent = '';
    if (!sec.total) {
      els.securityLine.textContent = 'Cuando apuntes tus cuentas, aquí verás cuáles no tienen verificación en dos pasos.';
    } else if (!sec.without) {
      els.securityLine.textContent = '✅ Tus ' + sec.total + ' cuentas tienen verificación en dos pasos.';
    } else {
      els.securityLine.textContent = '⚠️ ' + sec.without + ' de ' + sec.total +
        (sec.total === 1 ? ' cuenta' : ' cuentas') + ' sin verificación en dos pasos' +
        (sec.important.length ? '. Empieza por las importantes:' : '.');
      sec.important.forEach(function (a) {
        els.securityList.appendChild(el('li', null, [
          rowButton('accounts', a, null, a.user || 'Sin 2FA', 'danger')
        ]));
      });
    }

    // Accesos a cada sección
    els.homeTiles.textContent = '';
    U.KINDS.forEach(function (k) {
      els.homeTiles.appendChild(el('button', { type: 'button', class: 'tile', 'data-view': k.id }, [
        el('span', { class: 'tile__icon', 'aria-hidden': 'true', text: k.icon }),
        el('span', { class: 'tile__num', text: String(state[k.id].length) }),
        el('span', { class: 'tile__label', text: k.name })
      ]));
    });
  }

  /* ── Listas ───────────────────────────────────────────────── */

  /** Lo que enseña la tarjeta de cada elemento, según su tipo. */
  function describe(kindId, it, today) {
    const d = { meta: [], value: '', badge: null, dim: false, star: false };

    if (kindId === 'subs') {
      const p = U.periodById(it.period);
      if (it.price !== null) d.value = U.money(it.price) + ' / ' + p.short;
      if (!it.active) {
        d.dim = true;
        d.badge = { text: 'Inactiva', tone: 'muted' };
      } else {
        const next = C.nextCharge(it, today);
        if (next) d.meta.push('Próximo cobro ' + U.formatDate(next));
        if (it.price && p.id !== 'mensual') d.meta.push('≈ ' + U.money(C.monthly(it)) + ' al mes');
      }
      if (it.account) d.meta.push(it.account);

    } else if (kindId === 'accounts') {
      if (it.user) d.meta.push(it.user);
      if (it.recovery) d.meta.push('Recuperación: ' + it.recovery);
      d.star = it.important;
      d.badge = it.twofa === 'no'
        ? { text: 'Sin 2FA', tone: it.important ? 'danger' : 'warn' }
        : { text: U.optionName(U.TWOFA, it.twofa), tone: 'ok' };

    } else if (kindId === 'devices') {
      if (it.model) d.meta.push(it.model);
      if (it.purchaseDate) d.meta.push('Comprado ' + U.formatDate(it.purchaseDate));
      if (it.warrantyUntil) {
        d.meta.push(it.warrantyUntil >= today ? 'Garantía hasta ' + U.formatDate(it.warrantyUntil) : 'Sin garantía');
      }
      d.dim = it.status === 'vendido';
      d.badge = { text: U.optionName(U.DEVICE_STATUS, it.status),
                  tone: it.status === 'uso' ? 'ok' : it.status === 'roto' ? 'danger' : 'muted' };

    } else if (kindId === 'webs') {
      if (it.url) d.meta.push(U.shortUrl(it.url));
      if (it.provider) d.meta.push(it.provider);
      if (it.price) d.value = U.money(it.price) + ' / año';
      const exp = C.nextExpiry(it, today);
      if (exp) {
        const n = U.daysBetween(today, exp);
        if (n < 0) d.badge = { text: 'Caducado', tone: 'danger' };
        else if (n <= 30) d.badge = { text: (it.autoRenew ? 'Se renueva ' : 'Caduca ') + relative(today, exp),
                                      tone: it.autoRenew ? 'muted' : 'warn' };
        else d.meta.push((it.autoRenew ? 'Se renueva el ' : 'Caduca el ') + U.formatDate(exp));
      }
    }
    return d;
  }

  function card(kind, it, today) {
    const d = describe(kind.id, it, today);

    const main = el('button', {
      type: 'button', class: 'item' + (d.dim ? ' item--dim' : ''),
      'data-kind': kind.id, 'data-id': it.id
    }, [
      el('span', { class: 'item__icon', 'aria-hidden': 'true', text: catOf(kind, it).icon }),
      el('span', { class: 'item__body' }, [
        el('span', { class: 'item__name' }, [
          it.name,
          d.star ? el('span', { class: 'item__star', title: 'Importante', text: ' ★' }) : null
        ]),
        d.meta.length ? el('span', { class: 'item__meta', text: d.meta.join(' · ') }) : null
      ]),
      el('span', { class: 'item__side' }, [
        d.value ? el('span', { class: 'item__value', text: d.value }) : null,
        d.badge ? el('span', { class: 'badge badge--' + d.badge.tone, text: d.badge.text }) : null
      ])
    ]);

    // El enlace va fuera del botón: un <a> dentro de un <button> no es válido.
    const href = U.safeUrl(it.url);
    return el('div', { class: 'item-row' }, [
      main,
      href ? el('a', {
        class: 'item__link', href: href, target: '_blank', rel: 'noopener noreferrer',
        title: 'Abrir ' + U.shortUrl(it.url), 'aria-label': 'Abrir la web de ' + it.name, text: '↗'
      }) : null
    ]);
  }

  function matches(kind, it, query) {
    return kind.fields.some(function (f) {
      if (f.type === 'select') return U.plain(U.optionName(f.options, it[f.key])).indexOf(query) >= 0;
      if (typeof it[f.key] !== 'string') return false;
      return U.plain(it[f.key]).indexOf(query) >= 0;
    });
  }

  function countLine(kind, all) {
    const n = all.length;
    if (!n) return 'Nada apuntado todavía';
    const head = n + ' ' + (n === 1 ? kind.one : kind.name.toLowerCase());

    if (kind.id === 'subs') {
      const m = all.reduce(function (s, x) { return s + C.monthly(x); }, 0);
      return head + ' · ' + U.money(m) + ' al mes';
    }
    if (kind.id === 'accounts') {
      const no = all.filter(function (a) { return a.twofa === 'no'; }).length;
      return head + (no ? ' · ' + no + ' sin 2FA' : ' · todas con 2FA');
    }
    if (kind.id === 'devices') {
      const used = all.filter(function (d) { return d.status === 'uso'; }).length;
      return head + ' · ' + used + ' en uso';
    }
    const y = all.reduce(function (s, w) { return s + (w.price || 0); }, 0);
    return y ? head + ' · ' + U.money(y) + ' al año' : head;
  }

  function renderList(kindId, today) {
    const kind = U.kindById(kindId);
    const all = S.getItems(kindId);
    const search = els[kindId + 'Search'];
    const query = U.plain(search.value);
    const items = query ? all.filter(function (it) { return matches(kind, it, query); }) : all;
    const list = els[kindId + 'List'];

    els[kindId + 'Count'].textContent = countLine(kind, all);
    els[kindId + 'Empty'].hidden = all.length > 0;
    // Con pocos elementos el buscador estorba más que ayuda.
    search.hidden = all.length < 6 && !query;

    list.textContent = '';
    if (all.length && !items.length) {
      list.appendChild(el('p', { class: 'list__none', text: 'Nada coincide con «' + search.value.trim() + '».' }));
      return;
    }

    kind.cats.forEach(function (cat) {
      const group = items.filter(function (it) { return it.category === cat.id; });
      if (!group.length) return;

      // Las suscripciones inactivas y los equipos vendidos, al final de su grupo.
      group.sort(function (a, b) {
        const da = describe(kindId, a, today).dim;
        const db = describe(kindId, b, today).dim;
        return da === db ? byName(a, b) : da ? 1 : -1;
      });

      const head = [
        el('span', { class: 'group__name', text: cat.icon + ' ' + cat.name }),
        el('span', { class: 'group__count', text: String(group.length) })
      ];
      if (kindId === 'subs') {
        const m = group.reduce(function (s, x) { return s + C.monthly(x); }, 0);
        if (m) head.push(el('span', { class: 'group__sum', text: U.money(m) + '/mes' }));
      }

      list.appendChild(el('section', { class: 'group' }, [
        el('h2', { class: 'group__head' }, head),
        el('ul', { class: 'group__list' }, group.map(function (it) {
          return el('li', null, [card(kind, it, today)]);
        }))
      ]));
    });
  }

  /* ── Formulario ───────────────────────────────────────────
     Uno para los cuatro tipos. Los campos se crean desde
     utils.KINDS, la misma tabla que usa el saneado. ────────── */

  function fieldNode(f, value) {
    const id = 'f_' + f.key;

    if (f.type === 'check') {
      const box = el('input', { type: 'checkbox', id: id, name: f.key });
      box.checked = value === undefined ? !!f.default : !!value;
      return el('label', { class: 'field field--check' }, [box, el('span', { text: f.label })]);
    }

    let input;
    if (f.type === 'select') {
      input = el('select', { id: id, name: f.key }, f.options.map(function (o) {
        return el('option', { value: o.id, text: o.icon ? o.icon + ' ' + o.name : o.name });
      }));
      input.value = value || f.default || f.options[0].id;
    } else if (f.type === 'textarea') {
      input = el('textarea', { id: id, name: f.key, rows: '3', maxlength: '2000', placeholder: f.placeholder });
      input.value = value || '';
    } else {
      const attrs = { id: id, name: f.key, placeholder: f.placeholder, autocomplete: 'off' };
      if (f.type === 'date') attrs.type = 'date';
      // Texto y no type="number": así se puede escribir "9,99" con coma.
      else if (f.type === 'money') { attrs.type = 'text'; attrs.inputmode = 'decimal'; }
      // Texto y no type="url": "netflix.com" sin https:// tiene que valer.
      else if (f.type === 'url') { attrs.type = 'text'; attrs.inputmode = 'url'; attrs.spellcheck = 'false'; attrs.maxlength = '300'; }
      else { attrs.type = 'text'; attrs.maxlength = '80'; }
      if (f.required) attrs.required = true;
      input = el('input', attrs);
      input.value = value === null || value === undefined ? ''
                  : f.type === 'money' ? String(value).replace('.', ',') : String(value);
    }

    return el('div', { class: 'field' + (f.half ? ' field--half' : '') }, [
      el('label', { class: 'field__label', for: id, text: f.label + (f.required ? ' *' : '') }),
      input,
      f.hint ? el('p', { class: 'field__hint', text: f.hint }) : null
    ]);
  }

  function openForm(kindId, item) {
    const kind = U.kindById(kindId);
    formKind = kindId;
    formId = item ? item.id : null;

    els.itemTitle.textContent = item ? kind.edit : kind.add;
    els.btnItemDelete.hidden = !item;
    els.itemError.hidden = true;
    els.itemFields.textContent = '';
    kind.fields.forEach(function (f) {
      els.itemFields.appendChild(fieldNode(f, item ? item[f.key] : undefined));
    });

    if (typeof els.itemModal.showModal === 'function') els.itemModal.showModal();
    else els.itemModal.setAttribute('open', '');
    els.itemFields.scrollTop = 0;
    // Al crear, directo al nombre. Al editar no: en el móvil sacaría el
    // teclado encima de lo que quieres leer.
    if (!item) els.itemForm.elements.name.focus();
  }

  function closeForm() {
    if (els.itemModal.open) {
      if (typeof els.itemModal.close === 'function') els.itemModal.close();
      else els.itemModal.removeAttribute('open');
    }
    formKind = null;
    formId = null;
  }

  function formState() {
    return { kind: formKind, id: formId };
  }

  function showFormError(text, input) {
    els.itemError.textContent = text;
    els.itemError.hidden = false;
    if (input) input.focus();
  }

  /** "1.234,56 €" → 1234.56; "" → null; basura → NaN. */
  function parseMoney(text) {
    let raw = String(text).replace(/[\s€]/g, '');
    if (!raw) return null;
    if (raw.indexOf(',') >= 0) raw = raw.replace(/\./g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
  }

  /** Lee el formulario. Devuelve { kind, data } o null si hay un error (ya enseñado). */
  function readForm() {
    const kind = U.kindById(formKind);
    const form = els.itemForm.elements;
    const data = { id: formId };

    for (let i = 0; i < kind.fields.length; i++) {
      const f = kind.fields[i];
      const input = form[f.key];
      if (!input) continue;

      if (f.type === 'check') {
        data[f.key] = input.checked;
      } else if (f.type === 'money') {
        const n = parseMoney(input.value);
        if (isNaN(n)) { showFormError('«' + f.label + '» no es un importe válido. Ejemplo: 9,99', input); return null; }
        data[f.key] = n;
      } else {
        data[f.key] = input.value;
      }

      if (f.required && !String(input.value).trim()) {
        showFormError('Falta «' + f.label + '».', input);
        return null;
      }
    }

    els.itemError.hidden = true;
    return { kind: formKind, data: data };
  }

  /* ── Ajustes ──────────────────────────────────────────────── */

  function renderSettings(today) {
    const s = S.getSettings();
    els.setTheme.value = s.theme;
    els.setBackup.value = String(s.backupDays);

    if (!s.lastExport) {
      els.backupStatus.textContent = 'Aún no has exportado ninguna copia.';
    } else {
      els.backupStatus.textContent = 'Última copia: ' + U.formatDate(s.lastExport) +
        ' (' + relative(today, s.lastExport) + ').';
    }
  }

  /* ── Versión, espacio y protección ────────────────────────
     Receta de Version-y-espacio.md: qué versión guarda la caché
     offline, cuánto ocupa todo, cuánto queda de los 5 MB y si el
     navegador puede borrar los datos. ────────────────────────── */

  /** 1234 → "1,2 KB"; por debajo de 10 KB con un decimal. */
  function formatKB(bytes) {
    const kb = bytes / 1024;
    return kb.toLocaleString('es-ES', { maximumFractionDigits: kb < 10 ? 1 : 0 }) + ' KB';
  }

  function cacheBytes(name) {
    return caches.open(name).then(function (cache) {
      return cache.keys().then(function (reqs) {
        return Promise.all(reqs.map(function (req) {
          return cache.match(req)
            .then(function (res) { return res ? res.blob() : null; })
            .then(function (b) { return b ? b.size : 0; });
        }));
      });
    }).then(function (sizes) { return sizes.reduce(function (a, b) { return a + b; }, 0); });
  }

  function setBuildHint(text) {
    els.buildHint.textContent = text;
    els.buildHint.hidden = !text;
  }

  function renderQuota(use) {
    const pct = (use.mine + use.others) / use.max * 100;
    let text = 'Datos: ' + formatKB(use.mine) + ' de ' + formatKB(use.max) + ' máx.';
    if (use.others >= 1024) text += ' · otras apps: ' + formatKB(use.others);
    if (pct >= 1) text += ' (' + Math.round(pct) + ' %)';

    els.buildQuota.textContent = text;
    els.buildQuota.dataset.state = pct >= 90 ? 'full' : pct >= 70 ? 'high' : 'ok';
    els.buildQuota.title = 'El navegador guarda hasta 5 MB por sitio, a repartir con tus otras apps de GitHub Pages.';
  }

  /** Solo pinta el estado; pedir la protección es cosa de app.js. */
  function renderPersist() {
    if (!navigator.storage || !navigator.storage.persisted) { els.buildPersist.hidden = true; return; }

    navigator.storage.persisted().then(function (yes) {
      els.buildPersist.hidden = false;
      els.buildPersist.dataset.state = yes ? 'ok' : 'risk';
      els.buildPersist.textContent = yes ? '🔒 Protegidos: el navegador no los borrará'
                                         : '⚠️ Sin proteger: el navegador podría borrarlos';
      els.buildPersist.title = yes
        ? 'El navegador los trata como persistentes: no los borra aunque le falte espacio.'
        : 'Si le falta espacio (o, en Safari, tras días sin abrirla) podría borrarlos. ' +
          'Instalar la app y usarla a menudo suele bastar para que los proteja. Exporta copias.';
    }).catch(function () { els.buildPersist.hidden = true; });
  }

  function renderBuildInfo() {
    const use = S.storageUse();
    const data = use.mine;
    const prefix = U.CACHE_PREFIX;
    renderQuota(use);
    renderPersist();

    // La fecha solo se pone si la versión guardada es la del código: de una
    // versión vieja no la conocemos.
    function line(version, appBytes) {
      return 'v' + version + (version === U.version ? ' · ' + U.buildDate() : '') +
             ' · ' + formatKB(appBytes + data);
    }

    setBuildHint('');
    els.buildCache.dataset.state = 'plain';
    els.buildCache.title = '';

    // Se mira el protocolo y no isSecureContext: file:// cuenta como contexto
    // seguro, pero su CacheStorage no se puede leer.
    if (location.protocol === 'file:' || !window.caches) {
      els.buildCache.textContent = line(U.version, 0);
      els.buildCache.title = 'Sin caché offline: solo cuentan tus datos';
      return;
    }

    const expected = prefix + U.version;
    els.buildCache.textContent = 'Comprobando…';

    caches.keys().then(function (keys) {
      // Solo las cachés de esta app: el almacén es de todo alexlobar.github.io.
      const mine = keys.filter(function (k) { return k.indexOf(prefix) === 0; });

      if (!mine.length) {
        els.buildCache.textContent = line(U.version, 0);
        setBuildHint('Todavía no se ha guardado una copia offline.');
        return null;
      }

      // Justo al actualizar pueden convivir dos: se enseña la nueva y se suman ambas.
      const stale = mine.indexOf(expected) < 0;
      const name = stale ? mine[mine.length - 1] : expected;

      return Promise.all(mine.map(cacheBytes)).then(function (sizes) {
        const app = sizes.reduce(function (a, b) { return a + b; }, 0);
        els.buildCache.textContent = line(name.replace(prefix, ''), app);
        els.buildCache.title = 'App ' + formatKB(app) + ' + datos ' + formatKB(data);
        els.buildCache.dataset.state = stale ? 'stale' : 'ok';
        if (stale) {
          setBuildHint('La copia offline no coincide con la v' + U.version +
                       '. Cierra la app del todo y ábrela otra vez para que se actualice.');
        }
      });
    }).catch(function () {
      els.buildCache.textContent = line(U.version, 0);
      els.buildCache.title = 'No se pudo leer la caché: solo cuentan tus datos';
    });
  }

  /* ── Toasts ───────────────────────────────────────────────── */

  /** toast('Hecho', { type:'success', icon:'✓', action:{label, onClick}, duration }) */
  function toast(message, opts) {
    const o = opts || {};
    const node = el('div', { class: 'toast' + (o.type ? ' toast--' + o.type : ''), role: 'status' });

    if (o.icon) node.appendChild(el('span', { class: 'toast__icon', 'aria-hidden': 'true', text: o.icon }));
    node.appendChild(el('span', { class: 'toast__text', text: message }));

    let life = 3000;
    if (o.action) {
      node.classList.add('toast--action');
      const btn = el('button', { type: 'button', class: 'toast__action', text: o.action.label });
      btn.addEventListener('click', function () {
        o.action.onClick();
        node.remove();
      });
      node.appendChild(btn);
      life = 7000;      // hace falta tiempo real para leer y decidir
    }
    if (o.duration > 0) life = o.duration;

    els.toastStack.appendChild(node);

    setTimeout(function () {
      if (!node.isConnected) return;
      node.classList.add('is-leaving');
      node.addEventListener('animationend', function () { node.remove(); }, { once: true });
      setTimeout(function () { node.remove(); }, 400);   // red de seguridad
    }, life);
  }

  return {
    els: els, init: init, getMissingIds: getMissingIds,
    showView: showView, applyTheme: applyTheme,
    renderHome: renderHome, renderList: renderList, renderSettings: renderSettings,
    renderBuildInfo: renderBuildInfo, renderPersist: renderPersist,
    openForm: openForm, closeForm: closeForm, readForm: readForm, formState: formState,
    toast: toast
  };
})();
