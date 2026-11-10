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
      dirty[payload.kind] = true;
      dirty.home = true;
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
    view = UI.showView(name);
    const hash = view === 'home' ? '' : '#' + view;
    if (location.hash !== hash) {
      const url = location.pathname + location.search + hash;
      if (push) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    }
    if (view === 'settings') UI.renderBuildInfo();
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

  /* ── Cambio de móvil ──────────────────────────────────────── */

  /** El ✓ de la lista: migrada ↔ pendiente. */
  function toggleMigrated(id) {
    const app = S.getItem('apps', id);
    if (!app || app.migration === 'no') return;
    const done = app.migration !== 'lista';
    S.saveItem('apps', { id: id, migration: done ? 'lista' : 'pendiente' });

    const m = VD.calc.migration(S.getState());
    if (done && m.total && m.done === m.total) {
      UI.toast('¡Todas las apps migradas!', { type: 'success', icon: '🎉' });
    }
  }

  function resetMigration() {
    if (!window.confirm('Todas las apps volverán a «Pendiente» para el siguiente cambio de móvil ' +
                        '(las de «No la paso» se quedan como están). ¿Continuar?')) return;
    S.resetMigration();
    UI.toast('Listo para el siguiente cambio de móvil.', { type: 'success', icon: '📲' });
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

  /**
   * Un solo archivo con todo. Las columnas salen de los campos de los cuatro
   * tipos (sin repetir): cada fila rellena las suyas y deja el resto vacío.
   */
  function exportCsv() {
    const cols = [];
    U.KINDS.forEach(function (k) {
      k.fields.forEach(function (f) {
        if (!cols.some(function (c) { return c.key === f.key; })) cols.push({ key: f.key, label: f.label });
      });
    });

    const rows = [['tipo'].concat(cols.map(function (c) { return c.label.replace(/ \(€\)$/, ''); }))];

    U.KINDS.forEach(function (k) {
      S.getItems(k.id).forEach(function (it) {
        rows.push([k.one].concat(cols.map(function (c) {
          const f = k.fields.filter(function (x) { return x.key === c.key; })[0];
          if (!f) return '';
          const v = it[f.key];
          if (f.type === 'select') return U.optionName(f.options, v);
          if (f.type === 'check') return v ? 'sí' : 'no';
          // Coma decimal: es lo que espera Excel en español.
          if (f.type === 'money') return v === null ? '' : String(v).replace('.', ',');
          return v === null ? '' : v;
        })));
      });
    });

    const csv = rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
    // BOM + separador ';': Excel en español abre así los acentos bien y cada
    // dato en su columna.
    download('vida-digital-' + today + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
    UI.toast('Datos exportados en CSV.', { type: 'success', icon: '↓' });
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
      const t = e.target.closest('[data-view], [data-add], [data-migrate], .item[data-id], .event[data-id]');
      if (!t) return;
      if (t.dataset.migrate) toggleMigrated(t.dataset.migrate);
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

    els.itemForm.addEventListener('submit', onFormSubmit);
    els.btnItemCancel.addEventListener('click', UI.closeForm);
    els.btnItemClose.addEventListener('click', UI.closeForm);
    els.btnItemDelete.addEventListener('click', deleteOpen);
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
    els.btnResetMigration.addEventListener('click', resetMigration);

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
