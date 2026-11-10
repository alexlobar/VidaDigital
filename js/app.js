/* ============================================================
   app.js — Conecta los eventos con el store, exporta e importa
   copias y arranca la app.
   ============================================================ */
window.VD = window.VD || {};

VD.app = (function () {
  'use strict';

  const U = VD.utils;
  const S = VD.store;
  const UI = VD.ui;

  let today = U.todayKey();
  let view = 'home';

  /* ── Repintado ────────────────────────────────────────────
     El store avisa de qué ha cambiado; aquí se apunta en `dirty` y se
     pinta una sola vez por fotograma, aunque un clic dispare varios
     eventos (borrar y deshacer, importar…). ─────────────────── */

  const dirty = {};
  let frame = null;

  function scheduleFlush() {
    if (frame) return;
    frame = window.requestAnimationFrame(flush);
  }

  function flush() {
    frame = null;
    const d = Object.assign({}, dirty);
    Object.keys(dirty).forEach(function (k) { delete dirty[k]; });

    if (d.all || d.settings) {
      UI.applyTheme(S.getSettings().theme);
      UI.renderSettings(today);
    }
    U.KINDS.forEach(function (k) {
      if (d.all || d[k.id]) UI.renderList(k.id, today);
    });
    // El resumen lo cruza todo: cualquier cambio en los datos le afecta.
    if (d.all || d.home) UI.renderHome(today);
  }

  function renderAll() {
    dirty.all = true;
    flush();
  }

  function onStoreEvent(event, payload) {
    if (event === 'items') {
      // Todo: las filas enseñan los nombres de lo enlazado, que puede
      // estar en otra sección (renombrar una cuenta cambia la fila de su
      // suscripción). Son listas cortas; repintarlas cuesta poco.
      dirty.all = true;
    } else if (event === 'settings') {
      dirty.settings = true;
    } else if (event === 'replace') {
      dirty.all = true;
    } else if (event === 'error') {
      UI.toast(payload && payload.type === 'quota'
        ? 'No queda espacio para guardar. Mira Ajustes → Versión y exporta una copia.'
        : 'No se ha podido guardar el último cambio.', {
        type: 'error', icon: '⚠️', action: { label: 'Exportar', onClick: exportJson }
      });
      return;
    }
    scheduleFlush();
  }

  /* ── Navegación ───────────────────────────────────────────
     La vista va en el hash (#subs) para que recargar o el botón
     atrás del móvil te dejen donde estabas. ─────────────────── */

  function go(name, push) {
    const from = view;
    view = UI.showView(name);
    const hash = view === 'home' ? '' : '#' + view;
    if (location.hash !== hash) {
      const url = location.pathname + location.search + hash;
      // Se apunta si se llegó desde el Resumen: así ‹ vuelve con el
      // historial (y el botón atrás del móvil hace lo mismo) en vez de
      // apilar otra entrada.
      if (push) history.pushState({ fromHome: from === 'home' }, '', url);
      else history.replaceState(null, '', url);
    }
    if (view === 'settings') UI.renderBuildInfo();
  }

  /** ‹ de cada sección: vuelve al Resumen. */
  function back() {
    if (history.state && history.state.fromHome) history.back();
    else go('home', false);
  }

  /* ── Formulario ───────────────────────────────────────────── */

  function openItem(kindId, id) {
    const item = S.getItem(kindId, id);
    if (item) UI.openForm(kindId, item);
  }

  function onFormSubmit(e) {
    e.preventDefault();
    const read = UI.readForm();
    if (!read) return;

    const isNew = !read.data.id;
    const saved = S.saveItem(read.kind, read.data);
    if (!saved) {
      UI.toast('No se ha podido guardar: revisa los datos.', { type: 'error', icon: '⚠️' });
      return;
    }
    UI.closeForm();
    UI.toast(isNew ? '«' + saved.name + '» añadido.' : 'Cambios guardados.', { type: 'success', icon: '✓' });
  }

  /** Borrar pide confirmación y además deja unos segundos para deshacer. */
  function deleteOpen() {
    const f = UI.formState();
    const item = f.kind && f.id ? S.getItem(f.kind, f.id) : null;
    if (!item) return;
    if (!window.confirm('¿Borrar «' + item.name + '»?')) return;

    const removed = S.removeItem(f.kind, f.id);
    UI.closeForm();
    UI.toast('«' + item.name + '» borrado.', {
      icon: '🗑️',
      action: { label: 'Deshacer', onClick: function () { S.restoreItem(removed); } }
    });
  }

  /** Saltar desde el formulario a un elemento enlazado. */
  function openLinked(kindId, id) {
    const item = S.getItem(kindId, id);
    if (!item) return;
    if (UI.formDirty() && !window.confirm('Tienes cambios sin guardar en este formulario. ¿Descartarlos y abrir «' +
                                          item.name + '»?')) return;
    UI.openForm(kindId, item);
  }

  /* ── Copias de seguridad ──────────────────────────────────── */

  /** «Hecha hoy»: apunta la fecha, con unos segundos para deshacerlo. */
  function markCopyDone(id) {
    const copy = S.getItem('copies', id);
    if (!copy) return;
    const before = copy.lastDate;
    if (before === today) {
      UI.toast('«' + copy.name + '» ya estaba apuntada hoy.', { icon: '💾' });
      return;
    }
    S.saveItem('copies', { id: id, lastDate: today });
    UI.toast((copy.method === 'auto' ? 'Comprobada hoy: «' : 'Copia hecha hoy: «') + copy.name + '».', {
      type: 'success', icon: '💾',
      action: { label: 'Deshacer', onClick: function () { S.saveItem('copies', { id: id, lastDate: before }); } }
    });
  }

  /** Archivar o recuperar el elemento abierto. Con Deshacer, como borrar. */
  function archiveOpen() {
    const f = UI.formState();
    const item = f.kind && f.id ? S.getItem(f.kind, f.id) : null;
    if (!item) return;
    const archive = !item.archived;
    S.setArchived(f.kind, f.id, archive);
    UI.closeForm();
    UI.toast(archive ? '«' + item.name + '» archivado: ya no cuenta en el gasto ni en los avisos.'
                     : '«' + item.name + '» vuelve a estar activo.', {
      icon: archive ? '🗄️' : '↩️',
      action: { label: 'Deshacer', onClick: function () { S.setArchived(f.kind, f.id, !archive); } }
    });
  }

  /* ── Cambio de móvil y de ordenador ───────────────────────── */

  const MOVES = {
    apps: { all: '¡Todas las apps migradas!', what: 'las apps', next: 'cambio de móvil', icon: '📲', no: '«No la paso»' },
    programs: { all: '¡Todos los programas migrados!', what: 'los programas', next: 'cambio de ordenador',
                icon: '🖥️', no: '«No lo paso»' }
  };

  /** El ✓ de la lista: migrado ↔ pendiente. */
  function toggleMigrated(kindId, id) {
    const item = S.getItem(kindId, id);
    if (!item || item.migration === 'no') return;
    const done = item.migration !== 'lista';
    S.saveItem(kindId, { id: id, migration: done ? 'lista' : 'pendiente' });

    const m = VD.calc.migration(S.getState(), kindId);
    if (done && m.total && m.done === m.total) {
      UI.toast(MOVES[kindId].all, { type: 'success', icon: '🎉' });
    }
  }

  function resetMigration(kindId) {
    const mv = MOVES[kindId];
    if (!window.confirm('Todos ' + mv.what + ' volverán a «Pendiente» para el siguiente ' + mv.next +
                        ' (lo marcado ' + mv.no + ' se queda como está). ¿Continuar?')) return;
    S.resetMigration(kindId);
    UI.toast('Listo para el siguiente ' + mv.next + '.', { type: 'success', icon: mv.icon });
  }

  /* ── Exportación e importación ────────────────────────────── */

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportJson() {
    download('vida-digital-' + today + '.json',
             JSON.stringify(S.getState(), null, 2),
             'application/json');
    S.markExported();
    UI.toast('Copia exportada.', { type: 'success', icon: '↓' });
  }

  function csvCell(value) {
    const s = String(value === null || value === undefined ? '' : value);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Filas → CSV con BOM y ";": Excel en español abre así los acentos bien y cada dato en su columna. */
  function toCsv(rows) {
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  }

  /**
   * Un solo archivo con todo, con las columnas de sheet.js (las mismas que
   * entiende Importar desde Excel): se puede editar y volver a importar.
   */
  function exportCsv() {
    const rows = [VD.sheet.header()];
    U.KINDS.forEach(function (k) {
      S.getItems(k.id).forEach(function (it) {
        const linked = S.getLinked(k.id, it.id).map(function (l) { return l.item.name; });
        rows.push(VD.sheet.row(k, it, linked));
      });
    });
    download('vida-digital-' + today + '.csv', toCsv(rows), 'text/csv;charset=utf-8');
    UI.toast('Datos exportados en CSV.', { type: 'success', icon: '↓' });
  }

  /* ── Importar desde Excel ─────────────────────────────────── */

  function downloadTemplate() {
    download('vida-digital-plantilla.csv', toCsv(VD.sheet.template()), 'text/csv;charset=utf-8');
    UI.importResult('Plantilla descargada: ábrela en Excel, cambia los ejemplos por lo tuyo y pégalo aquí.');
  }

  function chooseCsv() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,text/csv,text/plain';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      // Excel guarda "CSV (delimitado por comas)" en Windows-1252 y "CSV
      // UTF-8" en UTF-8. Se lee como UTF-8 y, si salen caracteres
      // imposibles (�), se vuelve a leer como Windows-1252.
      read('utf-8');

      function read(encoding) {
        const reader = new FileReader();
        reader.onload = function () {
          const text = String(reader.result);
          if (encoding === 'utf-8' && text.indexOf('�') >= 0) { read('windows-1252'); return; }
          UI.els.importText.value = text;
          UI.importResult('Archivo «' + file.name + '» cargado. Revisa y pulsa Importar.');
        };
        reader.onerror = function () { UI.importResult('No se pudo leer el archivo.', true); };
        reader.readAsText(file, encoding);
      }
    });
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
  }

  function runImport(e) {
    e.preventDefault();
    const text = UI.els.importText.value;
    if (!text.trim()) { UI.importResult('Pega primero las celdas copiadas de Excel o elige un CSV.', true); return; }

    const res = VD.sheet.parse(text, UI.els.importKind.value || null);
    const problems = res.skipped.slice(0, 4).map(function (s) { return 'fila ' + s.line + ': ' + s.reason; });
    if (res.skipped.length > 4) problems.push('y ' + (res.skipped.length - 4) + ' más');

    if (!res.entries.length) {
      UI.importResult('No hay nada que importar. ' + problems.join(' · '), true);
      return;
    }

    const byKind = {};
    res.entries.forEach(function (en) { byKind[en.kind] = (byKind[en.kind] || 0) + 1; });
    const summary = Object.keys(byKind).map(function (k) {
      return byKind[k] + ' ' + (byKind[k] === 1 ? U.kindById(k).one : U.kindById(k).name.toLowerCase());
    }).join(', ');

    let msg = 'Se van a importar ' + res.entries.length + ' filas: ' + summary + '.';
    if (res.skipped.length) msg += '\n\nSe saltan ' + res.skipped.length + ':\n' + problems.join('\n');
    if (res.ignored.length) msg += '\n\nColumnas que no reconozco (se ignoran): ' + res.ignored.join(', ');
    msg += '\n\nLo que ya exista con el mismo nombre se completa, no se duplica. ¿Continuar?';
    if (!window.confirm(msg)) return;

    const done = S.importItems(res.entries);
    UI.els.importText.value = '';
    UI.closeImport();
    UI.toast('Importado: ' + done.added + ' nuevos' + (done.updated ? ' y ' + done.updated + ' completados' : '') + '.',
             { type: 'success', icon: '📥', duration: 6000 });
  }

  function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function () {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch (err) {
          UI.toast('El archivo no es un JSON válido.', { type: 'error', icon: '⚠️' });
          return;
        }

        const looksRight = parsed && typeof parsed === 'object' &&
          U.KINDS.some(function (k) { return Array.isArray(parsed[k.id]); });
        if (!looksRight) {
          UI.toast('El archivo no parece una copia de Vida digital.', { type: 'error', icon: '⚠️' });
          return;
        }

        const count = U.KINDS.reduce(function (n, k) {
          return n + (Array.isArray(parsed[k.id]) ? parsed[k.id].length : 0);
        }, 0);
        if (!window.confirm('La copia tiene ' + count + ' elementos y reemplazará todo lo que hay ahora. ¿Continuar?')) return;

        S.replaceState(parsed);
        UI.closeForm();
        UI.toast('Copia importada.', { type: 'success', icon: '↑' });
      };
      reader.onerror = function () {
        UI.toast('No se pudo leer el archivo.', { type: 'error', icon: '⚠️' });
      };
      reader.readAsText(file);
    });

    // Firefox exige que el input esté en el documento para abrir el diálogo.
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
  }

  /**
   * Aviso de copia. Los datos viven solo en este navegador: si nunca
   * exportas y se borran, no hay de dónde recuperarlos. Solo si hay algo
   * que perder.
   */
  function checkBackupReminder() {
    const days = S.getSettings().backupDays;
    if (!days) return;
    const state = S.getState();
    if (!U.KINDS.some(function (k) { return state[k.id].length > 0; })) return;

    const last = S.getSettings().lastExport;
    if (last && U.daysBetween(last, today) < days) return;

    UI.toast(last
      ? 'Llevas ' + U.daysBetween(last, today) + ' días sin exportar una copia.'
      : 'Aún no has exportado ninguna copia de tus datos.', {
      icon: '💾',
      action: { label: 'Exportar', onClick: exportJson }
    });
  }

  function resetAll() {
    if (!window.confirm('Se borrará todo lo apuntado en este navegador. No se puede deshacer.\n\n¿Seguro?')) return;
    S.reset();
    UI.toast('Todo borrado.');
  }

  /* ── Eventos ──────────────────────────────────────────────── */

  function bind() {
    const els = UI.els;

    // Un solo manejador para todo lo que navega, añade o abre: los botones
    // de las listas y del resumen se crean y se destruyen en cada repintado.
    document.addEventListener('click', function (e) {
      const t = e.target.closest('[data-back], [data-view], [data-add], [data-migrate], [data-copy-done], ' +
                                 '[data-open-id], [data-tag-filter], [data-toggle-archived], [data-import-excel], ' +
                                 '.item[data-id], .event[data-id]');
      if (!t) return;
      if (t.hasAttribute('data-back')) back();
      else if (t.hasAttribute('data-import-excel')) UI.openImport();
      else if (t.dataset.tagFilter) { UI.setTagFilter(t.dataset.kind, t.dataset.tagFilter); UI.renderList(t.dataset.kind, today); }
      else if (t.dataset.toggleArchived) { UI.toggleArchived(t.dataset.toggleArchived); UI.renderList(t.dataset.toggleArchived, today); }
      else if (t.dataset.openId) openLinked(t.dataset.openKind, t.dataset.openId);
      else if (t.dataset.copyDone) markCopyDone(t.dataset.copyDone);
      else if (t.dataset.migrate) toggleMigrated(t.dataset.kind, t.dataset.migrate);
      else if (t.dataset.view) go(t.dataset.view, true);
      else if (t.dataset.add) UI.openForm(t.dataset.add, null);
      else openItem(t.dataset.kind, t.dataset.id);
    });

    window.addEventListener('popstate', function () {
      view = UI.showView(location.hash.slice(1) || 'home');
      if (view === 'settings') UI.renderBuildInfo();
    });

    U.KINDS.forEach(function (k) {
      els[k.id + 'Search'].addEventListener('input', function () { UI.renderList(k.id, today); });
    });

    els.globalSearch.addEventListener('input', function () { UI.renderGlobal(today); });
    els.globalSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { els.globalSearch.value = ''; UI.renderGlobal(today); }
    });

    els.itemForm.addEventListener('submit', onFormSubmit);
    els.btnItemCancel.addEventListener('click', UI.closeForm);
    els.btnItemClose.addEventListener('click', UI.closeForm);
    els.btnItemDelete.addEventListener('click', deleteOpen);
    els.btnItemArchive.addEventListener('click', archiveOpen);

    els.importForm.addEventListener('submit', runImport);
    els.btnImportClose.addEventListener('click', UI.closeImport);
    els.btnImportTemplate.addEventListener('click', downloadTemplate);
    els.btnImportFile.addEventListener('click', chooseCsv);
    els.importModal.addEventListener('click', function (e) {
      if (e.target === els.importModal) UI.closeImport();
    });
    // Esc cierra el <dialog> solo; aquí se limpia el estado del formulario.
    els.itemModal.addEventListener('close', UI.closeForm);
    // Clic en el fondo oscuro: el propio <dialog> es el destino.
    els.itemModal.addEventListener('click', function (e) {
      if (e.target === els.itemModal) UI.closeForm();
    });

    els.setTheme.addEventListener('change', function () { S.setSetting('theme', els.setTheme.value); });
    els.setBackup.addEventListener('change', function () { S.setSetting('backupDays', Number(els.setBackup.value)); });
    els.btnExportJson.addEventListener('click', exportJson);
    els.btnExportCsv.addEventListener('click', exportCsv);
    els.btnImport.addEventListener('click', importJson);
    els.btnWelcomeImport.addEventListener('click', importJson);
    els.btnReset.addEventListener('click', resetAll);
    els.btnResetMigration.addEventListener('click', function () { resetMigration('apps'); });
    els.btnResetPc.addEventListener('click', function () { resetMigration('programs'); });

    // Si la app se queda abierta de un día para otro, los "en 3 días" y
    // los próximos cobros se recalculan al volver a ella.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      const now = U.todayKey();
      if (now === today) return;
      today = now;
      dirty.all = true;
      scheduleFlush();
    });
  }

  /* ── Arranque ─────────────────────────────────────────────── */

  /**
   * En file:// el origen es "null" y pedir el manifest da un error de CORS
   * que asusta sin ser nada. Se enlaza solo cuando sirve de algo.
   */
  function linkManifest() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.json';
    document.head.appendChild(link);
  }

  /* ── Instalar desde la propia app ─────────────────────────
     Chrome para Android (hasta la 157) comprueba por DOMINIO si una app ya
     está instalada: con Hábitos instalada en alexlobar.github.io, su menú
     "Instalar app" dice que esta ya lo está. El aviso beforeinstallprompt
     sí mira la carpeta: se guarda y se ofrece con un botón propio, que solo
     aparece cuando hay algo que instalar. Ver PWA-Android-ya-instalada.md.
     Tiene que escucharse antes de enlazar el manifest. ─────────────── */

  let installPrompt = null;

  function listenInstall() {
    window.addEventListener('beforeinstallprompt', function (ev) {
      ev.preventDefault();               // sin la mini-barra de Chrome: botón propio
      installPrompt = ev;
      UI.els.installRow.hidden = false;
    });

    UI.els.btnInstall.addEventListener('click', function () {
      if (!installPrompt) return;
      const ev = installPrompt;
      installPrompt = null;              // cada aviso solo se puede usar una vez
      UI.els.installRow.hidden = true;
      ev.prompt();
      if (ev.userChoice) ev.userChoice.catch(function () { /* cancelado */ });
    });

    window.addEventListener('appinstalled', function () {
      installPrompt = null;
      UI.els.installRow.hidden = true;
      UI.toast('App instalada. Ya la tienes en la pantalla de inicio.', { type: 'success', icon: '📲' });
      // Instalada, Chrome suele conceder la protección que antes negó.
      requestPersist();
    });
  }

  /* ── Datos protegidos ─────────────────────────────────────
     Sin esto el almacenamiento es "best-effort": el navegador puede
     borrarlo si le falta espacio. Se pide en cada arranque mientras no
     esté concedido, porque Chrome lo decide por uso e instalación. ── */
  function requestPersist() {
    if (!navigator.storage || !navigator.storage.persist) return;

    navigator.storage.persisted()
      .then(function (yes) { return yes || navigator.storage.persist(); })
      .catch(function () { /* sin permiso para preguntar: se queda como esté */ })
      .then(function () { UI.renderPersist(); });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Un service worker necesita origen seguro: abierto con file:// no aplica.
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    // Si ya había un service worker, el relevo puede pillar la página a
    // medias: index.html de una versión y .js de otra. Recargar una vez al
    // cambiar de dueño deja el conjunto coherente.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading) return;           // el evento puede llegar más de una vez
        reloading = true;
        window.location.reload();
      });
    }

    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker no registrado:', err);
    });
  }

  /**
   * Si el arranque falla, una pantalla muerta parece pérdida de datos. Mejor
   * decir qué ha pasado, dejar claro que el almacén no se ha tocado y dar el
   * error listo para copiar.
   */
  function showStartupError(err) {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';

    const box = document.createElement('div');
    box.className = 'fatal';

    const title = document.createElement('h1');
    title.className = 'fatal__title';
    title.textContent = 'La app no ha podido arrancar';

    const text = document.createElement('p');
    text.className = 'fatal__text';
    text.textContent = 'Tus datos siguen guardados: este fallo ocurre antes de escribir nada. ' +
                       'No borres los datos del navegador.';

    const pre = document.createElement('pre');
    pre.className = 'fatal__detail';
    pre.textContent = (err && (err.stack || err.message)) || String(err);

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(pre);
    main.appendChild(box);
  }

  /**
   * Avisa si el navegador ha mezclado versiones (un index.html de una y
   * unos .js de otra) o si faltan elementos en el HTML.
   */
  function checkBuildMatch() {
    const html = document.documentElement.dataset.build || null;
    const missing = UI.getMissingIds();
    if (html === U.version && !missing.length) return;

    console.error('Versiones descuadradas · index.html:', html, '· js:', U.version,
                  '· elementos que faltan:', missing);
    UI.toast('El navegador ha mezclado versiones (' + (html || 'desconocida') +
             ' y ' + U.version + '). Recarga forzando: Ctrl + Mayús + R.',
             { type: 'error', icon: '⚠️', duration: 12000 });
  }

  function boot() {
    UI.init();
    S.load();
    S.subscribe(onStoreEvent);
    renderAll();
    bind();
    go(location.hash.slice(1) || 'home');

    listenInstall();                     // antes del manifest: si no, el aviso puede perderse
    linkManifest();
    registerServiceWorker();
    requestPersist();

    // Avisos: datos dañados > almacenamiento bloqueado > recordatorio de copia.
    const err = S.getLastError();
    if (err && err.type === 'corrupt') {
      UI.toast('Había datos dañados: se empezó de cero y se guardó una copia del original.',
               { type: 'error', icon: '⚠️' });
    } else if (err && err.type === 'unavailable') {
      UI.toast('El navegador bloquea el almacenamiento: los cambios no se guardarán.',
               { type: 'error', icon: '⚠️' });
    } else {
      checkBackupReminder();
    }

    // El último, porque es el que hay que ver aunque haya salido otro.
    checkBuildMatch();
  }

  function start() {
    try {
      boot();
    } catch (err) {
      console.error('Fallo al arrancar:', err);
      showStartupError(err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  return {};
})();
