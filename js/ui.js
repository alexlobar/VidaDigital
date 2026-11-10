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

  const VIEWS = ['home', 'subs', 'accounts', 'apps', 'programs', 'devices', 'licenses', 'copies', 'webs', 'settings'];

  /* Las dos listas de cambio de equipo: misma lógica, distinto texto. */
  const MIGRATIONS = {
    apps: { card: 'migration', what: 'apps', done: 'migradas', all: 'Las {n} apps están migradas.',
            badges: { pendiente: 'Pendiente', instalada: 'Instalada', lista: 'Migrada', no: 'No la paso' },
            installed: 'Instalada' },
    programs: { card: 'pc', what: 'programas', done: 'migrados', all: 'Los {n} programas están migrados.',
                badges: { pendiente: 'Pendiente', instalada: 'Instalado', lista: 'Migrado', no: 'No lo paso' },
                installed: 'Instalado' }
  };

  const tagFilter = {};      // tipo → etiqueta elegida en su lista
  const showArchived = {};   // tipo → si la lista enseña los archivados
  const THEME_COLOR = { dark: '#0d1117', light: '#f5f7fb' };
  const fmtMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' });

  const els = {};
  let missingIds = [];      // ids que no estaban en el HTML al arrancar
  let formKind = null;      // tipo del formulario abierto
  let formId = null;        // elemento que se edita; null = nuevo
  let formLinks = [];       // enlaces del formulario abierto, "tipo:id"
  let formSnapshot = '';    // cómo estaba al abrirlo, para avisar de cambios sin guardar

  /* ── Arranque ─────────────────────────────────────────────── */

  function init() {
    const ids = [
      'main', 'homeWelcome', 'btnWelcomeImport',
      'spendMonth', 'spendYear', 'spendCats',
      'homeUpcoming', 'homeUpcomingEmpty', 'securityLine', 'securityList', 'homeTiles',
      'migrationCard', 'migrationLine', 'migrationTrack', 'migrationFill', 'migrationList',
      'migrationActions', 'btnResetMigration', 'cleanupCard', 'cleanupLine', 'cleanupList',
      'copiesCard', 'copiesLine', 'copiesHomeList',
      'pcCard', 'pcLine', 'pcTrack', 'pcFill', 'pcList', 'pcActions', 'btnResetPc',
      'globalSearch', 'globalResults', 'homeBody',
      'itemModal', 'itemForm', 'itemTitle', 'itemFields', 'itemError',
      'btnItemClose', 'btnItemDelete', 'btnItemCancel', 'btnItemArchive',
      'importModal', 'importForm', 'importText', 'importKind', 'importResult',
      'btnImportClose', 'btnImportTemplate', 'btnImportFile', 'btnImportRun',
      'setTheme', 'setBackup', 'backupStatus',
      'btnExportJson', 'btnImport', 'btnExportCsv', 'btnReset',
      'installRow', 'btnInstall', 'buildCache', 'buildQuota', 'buildPersist', 'buildHint',
      'toastStack'
    ];
    // Todas las listas comparten estructura: sus ids salen del catálogo.
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

    els.themeMeta = $('meta[name="theme-color"]');

    // Sugerencias del campo Logo: todas las marcas que la app sabe dibujar.
    document.body.appendChild(el('datalist', { id: 'logoTitles' },
      VD.logos.titles().map(function (t) { return el('option', { value: t }); })));

    // Añadir y quitar enlaces es estado del formulario, no del almacén:
    // se queda aquí hasta que se pulse Guardar.
    els.itemFields.addEventListener('change', function (e) {
      if (e.target.id !== 'formLinkPicker' || !e.target.value) return;
      formLinks.push(e.target.value);
      renderLinks();
    });
    els.itemFields.addEventListener('click', function (e) {
      const unlink = e.target.closest('[data-unlink]');
      if (unlink) {
        formLinks = formLinks.filter(function (k) { return k !== unlink.dataset.unlink; });
        renderLinks();
        return;
      }
      // Etiqueta sugerida: se añade al final si no estaba.
      const add = e.target.closest('[data-add-tag]');
      const input = els.itemForm.elements.tags;
      if (!add || !input) return;
      const current = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      if (!current.some(function (t) { return U.plain(t) === U.plain(add.dataset.addTag); })) {
        current.push(add.dataset.addTag);
        input.value = current.join(', ');
      }
    });

    // Secciones para las filas pegadas sin columna "tipo".
    els.importKind.appendChild(el('option', { value: '', text: 'Según la columna «tipo»' }));
    U.KINDS.forEach(function (k) {
      els.importKind.appendChild(el('option', { value: k.id, text: k.name }));
    });
  }

  function getMissingIds() { return missingIds.slice(); }

  /* ── Vistas ───────────────────────────────────────────────── */

  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = 'home';
    VIEWS.forEach(function (v) { els['view-' + v].hidden = v !== name; });
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

  /* ── Logos ────────────────────────────────────────────────
     El de la marca si la app lo conoce (logos.js); si no, las iniciales
     sobre un color que sale del nombre, para que cada elemento tenga
     siempre el mismo y se distinga de sus vecinos. ─────────── */

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function initials(name) {
    const words = String(name).trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : Array.from(words[0] || '?').slice(0, 2).join('');
    return letters.toUpperCase();
  }

  function hueOf(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }

  function logoEl(item, size) {
    const slug = VD.logos.find(item);
    const logo = slug ? VD.logos.get(slug) : null;
    const node = el('span', {
      class: 'logo' + (size ? ' logo--' + size : ''), 'aria-hidden': 'true',
      title: logo ? logo.title : null,
      '--logo-bg': logo ? logo.bg : 'hsl(' + hueOf(item.name) + ' 42% 36%)',
      '--logo-fg': logo ? logo.fg : '#FFFFFF'
    });

    if (logo && logo.path) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', logo.path);
      svg.appendChild(path);
      node.appendChild(svg);
    } else {
      const text = logo ? logo.text : initials(item.name);
      node.appendChild(el('span', { class: 'logo__text' + (text.length > 2 ? ' logo__text--long' : ''), text: text }));
    }
    return node;
  }

  /** Fila pulsable que abre un elemento; la usan las tarjetas del Resumen. */
  function rowButton(kindId, item, date, meta, tone) {
    const d = date ? U.fromKey(date) : null;
    return el('button', {
      type: 'button', class: 'event' + (tone ? ' event--' + tone : ''),
      'data-kind': kindId, 'data-id': item.id
    }, [
      d ? el('span', { class: 'event__date' }, [
        el('span', { class: 'event__day', text: String(d.getDate()) }),
        el('span', { class: 'event__month', text: fmtMonth.format(d).replace('.', '') })
      ]) : null,
      logoEl(item, 'sm'),
      el('span', { class: 'event__body' }, [
        el('span', { class: 'event__name', text: item.name }),
        el('span', { class: 'event__meta', text: meta })
      ])
    ]);
  }

  /* ── Resumen ──────────────────────────────────────────────── */

  function renderHome(today) {
    const state = S.getState();
    els.homeWelcome.hidden = U.KINDS.some(function (k) { return state[k.id].length > 0; });

    renderMigration(state, 'apps');
    renderMigration(state, 'programs');

    // Gasto
    const t = C.totals(state);
    els.spendMonth.textContent = U.money(t.month);
    const sub = [U.money(t.year) + ' al año',
                 t.activeSubs + (t.activeSubs === 1 ? ' suscripción activa' : ' suscripciones activas')];
    if (t.sharedSubs) sub.push('de las compartidas cuenta solo tu parte');
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
                  ev.overdue ? 'danger' : ev.soon || n <= 3 ? 'warn' : '')
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

    // Copias de seguridad que tocan
    const cp = C.copies(state, today);
    els.copiesCard.hidden = !cp.pending.length;
    els.copiesHomeList.textContent = '';
    if (cp.pending.length) {
      const soon = cp.pending.length - cp.late;
      els.copiesLine.textContent = (cp.late ? '⚠️ ' + cp.late + (cp.late === 1 ? ' copia atrasada' : ' copias atrasadas') : '') +
        (cp.late && soon ? ' · ' : '') + (soon ? soon + ' toca' + (soon === 1 ? '' : 'n') + ' esta semana' : '') +
        '. Ábrela y pulsa «Hecha hoy» al hacerla.';
      cp.pending.forEach(function (x) {
        els.copiesHomeList.appendChild(el('li', null, [
          rowButton('copies', x.item, null, copyText(x.item, x.status, today),
                    x.status.state === 'soon' ? 'warn' : 'danger')
        ]));
      });
    }

    // Cuentas para borrar
    const clean = C.cleanup(state);
    els.cleanupCard.hidden = !clean.pending.length;
    els.cleanupList.textContent = '';
    if (clean.pending.length) {
      els.cleanupLine.textContent = clean.pending.length +
        (clean.pending.length === 1 ? ' cuenta por borrar' : ' cuentas por borrar') +
        (clean.done ? ' · ya has borrado ' + clean.done : '') +
        '. Cuando la borres, márcala como «Ya la he borrado».';
      clean.pending.slice().sort(byName).forEach(function (a) {
        els.cleanupList.appendChild(el('li', null, [
          rowButton('accounts', a, null, a.user || catOf(U.kindById('accounts'), a).name, '')
        ]));
      });
    }

    // El menú: un recuadro por sección con su dato más útil.
    els.homeTiles.textContent = '';
    U.KINDS.forEach(function (k) {
      els.homeTiles.appendChild(el('button', { type: 'button', class: 'tile', 'data-view': k.id }, [
        el('span', { class: 'tile__icon', 'aria-hidden': 'true', text: k.icon }),
        el('span', { class: 'tile__label', text: k.name }),
        el('span', { class: 'tile__meta', text: tileMeta(k, state[k.id]) }),
        el('span', { class: 'tile__chevron', 'aria-hidden': 'true', text: '›' })
      ]));
    });

    renderGlobal(today);
  }

  /** "3 · 16,98 €/mes": cuántos hay y el dato que más importa de la sección. */
  function tileMeta(kind, all) {
    const live = all.filter(function (it) { return !it.archived; });
    if (!live.length) return all.length ? 'Todo archivado' : 'Vacío';
    const parts = countLine(kind, live).split(' · ');
    parts[0] = String(live.length);
    return parts.slice(0, 2).join(' · ');
  }

  /* ── Buscador global ──────────────────────────────────────
     Busca en todas las secciones a la vez, archivados incluidos.
     "#trabajo" filtra por etiqueta; se puede combinar con texto
     ("#trabajo google"). ──────────────────────────────────── */

  /** "#trabajo google" → { tags: ['trabajo'], text: 'google' } */
  function parseQuery(q) {
    const tags = [];
    const words = [];
    String(q).trim().split(/\s+/).forEach(function (w) {
      if (!w) return;
      if (w[0] === '#' && w.length > 1) tags.push(U.plain(w.slice(1)));
      else words.push(w);
    });
    return { tags: tags, text: U.plain(words.join(' ')) };
  }

  function hasTags(it, tags) {
    const own = (it.tags || []).map(U.plain);
    return tags.every(function (t) { return own.indexOf(t) >= 0; });
  }

  function renderGlobal(today) {
    const q = parseQuery(els.globalSearch.value);
    const active = !!(q.text || q.tags.length);
    els.globalResults.hidden = !active;
    els.homeBody.hidden = active;
    if (!active) return;

    els.globalResults.textContent = '';
    let total = 0;
    U.KINDS.forEach(function (kind) {
      const found = S.getItems(kind.id).filter(function (it) {
        return hasTags(it, q.tags) && (!q.text || matches(kind, it, q.text));
      }).sort(function (a, b) { return (a.archived - b.archived) || byName(a, b); });
      if (!found.length) return;
      total += found.length;

      els.globalResults.appendChild(el('section', { class: 'group' }, [
        el('h2', { class: 'group__head' }, [
          el('span', { class: 'group__name', text: kind.icon + ' ' + kind.name }),
          el('span', { class: 'group__count', text: String(found.length) })
        ]),
        el('ul', { class: 'events card' }, found.map(function (it) {
          const meta = describe(kind.id, it, today).meta.slice(0, 2);
          if (it.archived) meta.unshift('Archivado');
          return el('li', null, [rowButton(kind.id, it, null, meta.join(' · ') || kind.one, '')]);
        }))
      ]));
    });

    if (!total) {
      els.globalResults.appendChild(el('p', { class: 'list__none',
        text: 'Nada coincide con «' + els.globalSearch.value.trim() + '» en ninguna sección.' }));
    }
  }

  /**
   * Tarjetas "Cambio de móvil" (apps) y "Cambio de ordenador" (programs):
   * progreso y lo que falta por pasar. Los ids del HTML llevan el prefijo
   * de MIGRATIONS[kindId].card: migrationLine, pcLine…
   */
  function renderMigration(state, kindId) {
    const cfg = MIGRATIONS[kindId];
    const id = function (s) { return els[cfg.card + s]; };
    const m = C.migration(state, kindId);
    id('Card').hidden = !m.total;
    if (!m.total) return;

    const pct = Math.round(m.done / m.total * 100);
    id('Fill').style.setProperty('--w', pct + '%');
    id('Track').setAttribute('aria-valuenow', String(pct));
    id('Line').textContent = m.left.length
      ? m.done + ' de ' + m.total + ' ' + cfg.what + ' ' + cfg.done + ' · faltan ' + m.left.length
      : '✅ ' + cfg.all.replace('{n}', m.total);
    id('Actions').hidden = m.left.length > 0;

    const list = id('List');
    list.textContent = '';
    m.left.forEach(function (a) {
      const installed = a.migration === 'instalada';
      const login = a.login && a.login !== 'nose' && a.login !== 'sin' ? ' · ' + U.optionName(U.LOGIN_METHODS, a.login) : '';
      list.appendChild(el('li', null, [
        rowButton(kindId, a, null,
                  (installed ? cfg.installed + ' · falta ' + (a.transfer || 'entrar o pasar datos') : 'Pendiente') + login,
                  installed ? 'warn' : '')
      ]));
    });
    list.hidden = !m.left.length;
  }

  /** "Atrasada 12 días · Google Fotos" / "Nunca hecha · disco externo" */
  function copyText(copy, status, today) {
    let text;
    if (status.state === 'never') text = copy.method === 'auto' ? 'Nunca comprobada' : 'Nunca hecha';
    else if (status.state === 'late') text = 'Atrasada ' + (-status.days) + (status.days === -1 ? ' día' : ' días');
    else if (status.state === 'soon') text = 'Toca ' + relative(today, status.due);
    else text = 'Próxima ' + U.formatDate(status.due);
    return copy.where ? text + ' · ' + copy.where : text;
  }

  /* ── Listas ───────────────────────────────────────────────── */

  /** Lo que enseña la tarjeta de cada elemento, según su tipo. */
  function describe(kindId, it, today) {
    const d = { meta: [], value: '', badge: null, dim: false, star: false };

    if (kindId === 'subs') {
      const p = U.periodById(it.period);
      const mine = C.myAmount(it);
      // Compartida: lo grande es lo que pagas tú; el precio entero, al lado.
      if (mine !== null) d.value = U.money(mine) + ' / ' + p.short;
      if (it.myPrice === 0) {
        d.meta.push('Te la pagan' + (it.price ? ' (' + U.money(it.price) + ')' : ''));
      } else if (it.myPrice !== null && it.price !== null && it.myPrice !== it.price) {
        d.meta.push('Tu parte de ' + U.money(it.price));
      }
      if (it.sharedWith) d.meta.push('Con ' + it.sharedWith);
      if (!it.active) {
        d.dim = true;
        d.badge = { text: 'Inactiva', tone: 'muted' };
      } else {
        if (it.trialEnd && it.trialEnd >= today) {
          d.badge = { text: 'Prueba hasta ' + U.formatDate(it.trialEnd), tone: 'warn' };
        }
        const next = C.nextCharge(it, today);
        if (next) d.meta.push('Próximo cobro ' + U.formatDate(next));
        if (mine && p.id !== 'mensual') d.meta.push('≈ ' + U.money(C.monthly(it)) + ' al mes');
      }
      if (it.account) d.meta.push(it.account);

    } else if (kindId === 'accounts') {
      if (it.user) d.meta.push(it.user);
      if (it.recovery && it.status !== 'borrada') d.meta.push('Recuperación: ' + it.recovery);
      d.star = it.important && it.status !== 'borrada';
      d.dim = it.status === 'borrada';
      if (it.status === 'borrada') d.badge = { text: 'Borrada', tone: 'muted' };
      else if (it.status === 'borrar') d.badge = { text: 'Para borrar', tone: 'warn' };
      else d.badge = it.twofa === 'no'
        ? { text: 'Sin 2FA', tone: it.important ? 'danger' : 'warn' }
        : { text: U.optionName(U.TWOFA, it.twofa), tone: 'ok' };

    } else if (kindId === 'apps' || kindId === 'programs') {
      if (it.account) d.meta.push(it.account);
      if (it.login && it.login !== 'nose') d.meta.push(U.optionName(U.LOGIN_METHODS, it.login));
      if (it.source) d.meta.push(it.source);
      if (it.transfer && it.migration !== 'lista') d.meta.push('Pasar: ' + it.transfer);
      d.dim = it.migration === 'no';
      const tone = { pendiente: 'muted', instalada: 'warn', lista: 'ok', no: 'muted' }[it.migration];
      d.badge = { text: MIGRATIONS[kindId].badges[it.migration], tone: tone };

    } else if (kindId === 'devices') {
      if (it.model) d.meta.push(it.model);
      if (it.purchaseDate) d.meta.push('Comprado ' + U.formatDate(it.purchaseDate));
      if (it.warrantyUntil) {
        d.meta.push(it.warrantyUntil >= today ? 'Garantía hasta ' + U.formatDate(it.warrantyUntil) : 'Sin garantía');
      }
      d.dim = it.status === 'vendido';
      d.badge = { text: U.optionName(U.DEVICE_STATUS, it.status),
                  tone: it.status === 'uso' ? 'ok' : it.status === 'roto' ? 'danger' : 'muted' };

    } else if (kindId === 'licenses') {
      if (it.keyWhere) d.meta.push('Clave: ' + it.keyWhere);
      if (it.account) d.meta.push(it.account);
      if (it.price) d.value = U.money(it.price);
      if (!it.expires) d.badge = { text: 'Para siempre', tone: 'muted' };
      else {
        const n = U.daysBetween(today, it.expires);
        d.badge = n < 0 ? { text: 'Caducada', tone: 'danger' }
                : n <= 30 ? { text: 'Caduca ' + relative(today, it.expires), tone: 'warn' }
                : { text: 'Hasta ' + U.formatDate(it.expires), tone: 'muted' };
        d.dim = n < -30;
      }

    } else if (kindId === 'copies') {
      const st = C.copyStatus(it, today);
      const freq = U.byId(U.COPY_FREQ, it.frequency);
      if (it.where) d.meta.push(it.where);
      d.meta.push((freq ? freq.name : '') + (it.method === 'auto' ? ' · automática' : ''));
      if (it.lastDate) d.meta.push('Última ' + relative(today, it.lastDate));
      d.badge = {
        never: { text: it.method === 'auto' ? 'Sin comprobar' : 'Sin hacer', tone: 'danger' },
        late: { text: 'Atrasada', tone: 'danger' },
        soon: { text: 'Toca ' + (st.days === 0 ? 'hoy' : 'en ' + st.days + ' d'), tone: 'warn' },
        ok: { text: 'Al día', tone: 'ok' }
      }[st.state];

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

    // Lo enlazado, al final de la línea: "🔗 Gmail, Netflix +2".
    const linked = S.getLinked(kind.id, it.id);
    if (linked.length) {
      const names = linked.slice(0, 2).map(function (l) { return l.item.name; }).join(', ');
      d.meta.push('🔗 ' + names + (linked.length > 2 ? ' +' + (linked.length - 2) : ''));
    }
    const tags = it.tags && it.tags.length ? el('span', { class: 'item__tags' }, it.tags.map(function (t) {
      return el('span', { class: 'tag', text: '#' + t });
    })) : null;

    const main = el('button', {
      type: 'button', class: 'item' + (d.dim || it.archived ? ' item--dim' : ''),
      'data-kind': kind.id, 'data-id': it.id
    }, [
      logoEl(it),
      el('span', { class: 'item__body' }, [
        el('span', { class: 'item__name' }, [
          it.name,
          d.star ? el('span', { class: 'item__star', title: 'Importante', text: ' ★' }) : null
        ]),
        d.meta.length ? el('span', { class: 'item__meta', text: d.meta.join(' · ') }) : null,
        tags
      ]),
      el('span', { class: 'item__side' }, [
        d.value ? el('span', { class: 'item__value', text: d.value }) : null,
        d.badge ? el('span', { class: 'badge badge--' + d.badge.tone, text: d.badge.text }) : null
      ])
    ]);

    // Al cambiar de móvil u ordenador se marcan decenas seguidas: un toque
    // en ✓ en vez de abrir el formulario de cada uno.
    const done = it.migration === 'lista';
    const doneWord = MIGRATIONS[kind.id] ? MIGRATIONS[kind.id].badges.lista.toLowerCase() : '';
    const check = MIGRATIONS[kind.id] && it.migration !== 'no' && !it.archived ? el('button', {
      type: 'button', class: 'item__check', 'data-migrate': it.id, 'data-kind': kind.id,
      'aria-pressed': done ? 'true' : 'false',
      'aria-label': (done ? 'Desmarcar ' : 'Marcar como ' + doneWord + ' ') + it.name,
      title: done ? 'Tocar para desmarcar' : 'Marcar como ' + doneWord, text: '✓'
    }) : null;

    // Copias: "Hecha hoy" en un toque, sin abrir el formulario.
    const copyDone = kind.id === 'copies' && !it.archived ? el('button', {
      type: 'button', class: 'item__done', 'data-copy-done': it.id,
      title: it.method === 'auto' ? 'Comprobada hoy' : 'Hecha hoy',
      'aria-label': (it.method === 'auto' ? 'Marcar como comprobada hoy: ' : 'Marcar como hecha hoy: ') + it.name
    }, [el('span', { 'aria-hidden': 'true', text: '✓' }), el('span', { class: 'item__done-text', text: 'Hoy' })]) : null;

    // El enlace va fuera del botón: un <a> dentro de un <button> no es válido.
    const href = U.safeUrl(it.url);
    return el('div', { class: 'item-row' }, [
      main,
      check,
      copyDone,
      href ? el('a', {
        class: 'item__link', href: href, target: '_blank', rel: 'noopener noreferrer',
        title: 'Abrir ' + U.shortUrl(it.url), 'aria-label': 'Abrir la web de ' + it.name, text: '↗'
      }) : null
    ]);
  }

  function matches(kind, it, query) {
    return kind.fields.some(function (f) {
      if (f.type === 'select') return U.plain(U.optionName(f.options, it[f.key])).indexOf(query) >= 0;
      if (f.type === 'tags') return (it.tags || []).some(function (t) { return U.plain(t).indexOf(query) >= 0; });
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
      const alive = all.filter(function (a) { return a.status !== 'borrada'; });
      const no = alive.filter(function (a) { return a.twofa === 'no'; }).length;
      const toDelete = alive.filter(function (a) { return a.status === 'borrar'; }).length;
      return head + (no ? ' · ' + no + ' sin 2FA' : ' · todas con 2FA') +
             (toDelete ? ' · ' + toDelete + ' para borrar' : '');
    }
    if (MIGRATIONS[kind.id]) {
      const m = C.migration(S.getState(), kind.id);
      return head + ' · ' + m.done + ' de ' + m.total + ' ' + MIGRATIONS[kind.id].done;
    }
    if (kind.id === 'licenses') {
      const today = U.todayKey();
      const expired = all.filter(function (l) { return l.expires && l.expires < today; }).length;
      const forever = all.filter(function (l) { return !l.expires; }).length;
      return head + ' · ' + forever + ' para siempre' + (expired ? ' · ' + expired + ' caducadas' : '');
    }
    if (kind.id === 'copies') {
      const cp = C.copies(S.getState(), U.todayKey());
      return head + (cp.late ? ' · ' + cp.late + (cp.late === 1 ? ' atrasada' : ' atrasadas') : ' · todas al día');
    }
    if (kind.id === 'devices') {
      const used = all.filter(function (d) { return d.status === 'uso'; }).length;
      return head + ' · ' + used + ' en uso';
    }
    const y = all.reduce(function (s, w) { return s + (w.price || 0); }, 0);
    return y ? head + ' · ' + U.money(y) + ' al año' : head;
  }

  /** Todas las etiquetas usadas en una sección, de la más usada a la menos. */
  function tagsOf(items) {
    const count = {};
    const label = {};
    items.forEach(function (it) {
      (it.tags || []).forEach(function (t) {
        const k = U.plain(t);
        count[k] = (count[k] || 0) + 1;
        if (!label[k]) label[k] = t;
      });
    });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b, 'es'); })
      .map(function (k) { return { key: k, label: label[k], count: count[k] }; });
  }

  function renderList(kindId, today) {
    const kind = U.kindById(kindId);
    const all = S.getItems(kindId);
    const live = all.filter(function (it) { return !it.archived; });
    const archived = all.filter(function (it) { return it.archived; });
    const search = els[kindId + 'Search'];
    const query = U.plain(search.value);
    const tag = tagFilter[kindId] || null;
    const keep = function (it) {
      return (!query || matches(kind, it, query)) && (!tag || hasTags(it, [tag]));
    };
    const items = live.filter(keep);
    const list = els[kindId + 'List'];

    els[kindId + 'Count'].textContent = countLine(kind, live) +
      (archived.length ? ' · ' + archived.length + ' archivad' + (archived.length === 1 ? 'o' : 'os') : '');
    els[kindId + 'Empty'].hidden = all.length > 0;
    // Con pocos elementos el buscador estorba más que ayuda.
    search.hidden = all.length < 6 && !query;

    list.textContent = '';

    // Etiquetas de la sección: tocar una filtra; tocarla otra vez, quita el filtro.
    const tags = tagsOf(all);
    if (tag && !tags.some(function (t) { return t.key === tag; })) tagFilter[kindId] = null;
    if (tags.length) {
      list.appendChild(el('div', { class: 'tagbar', role: 'group', 'aria-label': 'Filtrar por etiqueta' },
        tags.map(function (t) {
          return el('button', {
            type: 'button', class: 'tag tag--filter', 'data-tag-filter': t.key, 'data-kind': kindId,
            'aria-pressed': tag === t.key ? 'true' : 'false', text: '#' + t.label + ' ' + t.count
          });
        })));
    }

    if (live.length && !items.length) {
      list.appendChild(el('p', { class: 'list__none', text: 'Nada coincide con ' +
        [search.value.trim() ? '«' + search.value.trim() + '»' : '', tag ? '#' + tag : ''].filter(Boolean).join(' y ') + '.' }));
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

    // Archivados: al final, plegados. El buscador y la etiqueta también los filtran.
    if (archived.length) {
      const open = !!showArchived[kindId];
      const shown = archived.filter(keep).sort(byName);
      list.appendChild(el('button', {
        type: 'button', class: 'archived-toggle', 'data-toggle-archived': kindId,
        'aria-expanded': open ? 'true' : 'false',
        text: (open ? '▾ ' : '▸ ') + 'Archivados (' + archived.length + ')'
      }));
      if (open && shown.length) {
        list.appendChild(el('ul', { class: 'group__list group__list--archived' }, shown.map(function (it) {
          return el('li', null, [card(kind, it, today)]);
        })));
      }
    }
  }

  function setTagFilter(kindId, tag) {
    tagFilter[kindId] = tagFilter[kindId] === tag ? null : tag;
  }

  function toggleArchived(kindId) {
    showArchived[kindId] = !showArchived[kindId];
  }

  /* ── Formulario ───────────────────────────────────────────
     Uno para todos los tipos. Los campos se crean desde
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
      const attrs = { id: id, name: f.key, placeholder: f.placeholder, autocomplete: 'off', list: f.list };
      if (f.type === 'date') attrs.type = 'date';
      // Texto y no type="number": así se puede escribir "9,99" con coma.
      else if (f.type === 'money') { attrs.type = 'text'; attrs.inputmode = 'decimal'; }
      // Texto y no type="url": "netflix.com" sin https:// tiene que valer.
      else if (f.type === 'url') { attrs.type = 'text'; attrs.inputmode = 'url'; attrs.spellcheck = 'false'; attrs.maxlength = '300'; }
      else if (f.type === 'tags') { attrs.type = 'text'; attrs.maxlength = '260'; }
      else { attrs.type = 'text'; attrs.maxlength = '80'; }
      if (f.required) attrs.required = true;
      input = el('input', attrs);
      input.value = value === null || value === undefined ? ''
                  : f.type === 'money' ? String(value).replace('.', ',')
                  : f.type === 'tags' ? value.join(', ') : String(value);
    }

    // Etiquetas ya usadas en cualquier sección: un toque las añade, para no
    // acabar con "trabajo", "Trabajo" y "curro".
    let suggest = null;
    if (f.type === 'tags') {
      const used = tagsOf(U.KINDS.reduce(function (all, k) { return all.concat(S.getItems(k.id)); }, []));
      if (used.length) {
        suggest = el('div', { class: 'tag-suggest' }, used.slice(0, 20).map(function (t) {
          return el('button', { type: 'button', class: 'tag tag--filter', 'data-add-tag': t.label, text: '#' + t.label });
        }));
      }
    }

    return el('div', { class: 'field' + (f.half ? ' field--half' : '') }, [
      el('label', { class: 'field__label', for: id, text: f.label + (f.required ? ' *' : '') }),
      input,
      suggest,
      f.hint ? el('p', { class: 'field__hint', text: f.hint }) : null
    ]);
  }

  /* ── Enlaces del formulario ───────────────────────────────
     Viven aquí mientras el formulario está abierto y se guardan con el
     resto al pulsar Guardar. Se enseñan en los dos sentidos: lo que
     enlazaste desde este elemento y lo que se enlazó a él desde otro. ── */

  function linkKey(kindId, id) { return kindId + ':' + id; }

  function linkField(f) {
    return el('div', { class: 'field links-field' }, [
      el('span', { class: 'field__label', text: f.label }),
      el('ul', { class: 'links', id: 'formLinks' }),
      el('select', { class: 'links__picker', id: 'formLinkPicker', 'aria-label': 'Enlazar con otro elemento' }),
      el('p', { class: 'field__hint',
                text: 'Lo que va junto: la suscripción con su cuenta y su app, una licencia con el equipo donde está…' })
    ]);
  }

  /**
   * Candidatos para enlazar. Arriba, los que parecen ir con este elemento:
   * el mismo logo o el mismo nombre en otra sección (Netflix suscripción,
   * cuenta y app).
   */
  function linkOptions() {
    const form = els.itemForm.elements;
    const probe = { name: form.name ? form.name.value : '' };
    ['logo', 'url', 'model', 'where', 'seller', 'provider', 'account'].forEach(function (k) {
      if (form[k]) probe[k] = form[k].value;
    });
    const slug = probe.name ? VD.logos.find(probe) : null;
    const plainName = U.plain(probe.name);
    const self = formId ? linkKey(formKind, formId) : null;

    const suggested = [];
    const groups = [];
    U.KINDS.forEach(function (kind) {
      const options = [];
      S.getItems(kind.id).sort(byName).forEach(function (it) {
        const key = linkKey(kind.id, it.id);
        if (key === self || formLinks.indexOf(key) >= 0) return;
        const option = { key: key, label: it.name, kind: kind };
        const alike = (slug && VD.logos.find(it) === slug) || (plainName && U.plain(it.name) === plainName);
        if (alike) suggested.push(option);
        else options.push(option);
      });
      if (options.length) groups.push({ label: kind.name, options: options });
    });
    if (suggested.length) groups.unshift({ label: 'Sugeridos', options: suggested, suggested: true });
    return groups;
  }

  function renderLinks() {
    const list = document.getElementById('formLinks');
    const picker = document.getElementById('formLinkPicker');
    if (!list || !picker) return;

    list.textContent = '';
    formLinks.forEach(function (key) {
      const ref = S.resolveLink(key);
      if (!ref) return;
      list.appendChild(el('li', { class: 'link-chip' }, [
        el('button', {
          type: 'button', class: 'link-chip__open', title: 'Abrir',
          'data-open-kind': ref.kind, 'data-open-id': ref.item.id
        }, [
          logoEl(ref.item, 'xs'),
          el('span', { class: 'link-chip__name', text: ref.item.name }),
          el('span', { class: 'link-chip__kind', text: U.kindById(ref.kind).one })
        ]),
        el('button', {
          type: 'button', class: 'link-chip__remove', 'data-unlink': key,
          'aria-label': 'Quitar el enlace con ' + ref.item.name, title: 'Quitar enlace', text: '✕'
        })
      ]));
    });
    list.hidden = !formLinks.length;

    const groups = linkOptions();
    picker.textContent = '';
    picker.appendChild(el('option', { value: '', text: groups.length ? '+ Enlazar con…' : 'No hay nada más que enlazar' }));
    groups.forEach(function (g) {
      picker.appendChild(el('optgroup', { label: g.label }, g.options.map(function (o) {
        return el('option', { value: o.key, text: g.suggested ? o.label + ' (' + o.kind.one + ')' : o.label });
      })));
    });
    picker.disabled = !groups.length;
    picker.value = '';
  }

  /** Lo que hay en el formulario, para saber si se ha tocado. */
  function snapshot() {
    return JSON.stringify([Array.prototype.map.call(els.itemForm.elements, function (e) {
      return e.id === 'formLinkPicker' ? '' : e.type === 'checkbox' ? e.checked : e.value;
    }), formLinks]);
  }

  function formDirty() {
    return !!formKind && snapshot() !== formSnapshot;
  }

  function openForm(kindId, item) {
    const kind = U.kindById(kindId);
    formKind = kindId;
    formId = item ? item.id : null;
    formLinks = item ? S.getLinked(kindId, item.id).map(function (l) { return linkKey(l.kind, l.item.id); }) : [];

    els.itemTitle.textContent = (item ? kind.edit : kind.add) + (item && item.archived ? ' (archivado)' : '');
    els.btnItemDelete.hidden = !item;
    els.btnItemArchive.hidden = !item;
    els.btnItemArchive.textContent = item && item.archived ? 'Desarchivar' : 'Archivar';
    els.itemError.hidden = true;
    els.itemFields.textContent = '';
    kind.fields.forEach(function (f) {
      els.itemFields.appendChild(f.type === 'links' ? linkField(f) : fieldNode(f, item ? item[f.key] : undefined));
    });
    renderLinks();
    formSnapshot = snapshot();

    // Puede estar ya abierto: al saltar a un elemento enlazado se reutiliza.
    if (!els.itemModal.open) {
      if (typeof els.itemModal.showModal === 'function') els.itemModal.showModal();
      else els.itemModal.setAttribute('open', '');
    }
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
    formLinks = [];
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
      if (f.type === 'links') { data.links = formLinks.slice(); continue; }
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

  /* ── Importar desde Excel ─────────────────────────────────── */

  function openImport() {
    els.importResult.hidden = true;
    els.importResult.textContent = '';
    if (!els.importModal.open) {
      if (typeof els.importModal.showModal === 'function') els.importModal.showModal();
      else els.importModal.setAttribute('open', '');
    }
    els.importText.focus();
  }

  function closeImport() {
    if (!els.importModal.open) return;
    if (typeof els.importModal.close === 'function') els.importModal.close();
    else els.importModal.removeAttribute('open');
  }

  /** Mensaje bajo el cuadro de texto: lo que se ha leído o por qué no. */
  function importResult(text, isError) {
    els.importResult.textContent = text;
    els.importResult.classList.toggle('import-result--error', !!isError);
    els.importResult.hidden = !text;
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
    openForm: openForm, closeForm: closeForm, readForm: readForm, formState: formState, formDirty: formDirty,
    renderGlobal: renderGlobal, setTagFilter: setTagFilter, toggleArchived: toggleArchived,
    openImport: openImport, closeImport: closeImport, importResult: importResult,
    toast: toast
  };
})();
