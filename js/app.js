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
      UI.applyTheme(S.getSettings().theme, S.getSettings().accent);
      UI.renderSettings(today);
    }
    U.KINDS.forEach(function (k) {
      if (d.all || d[k.id]) UI.renderList(k.id, today);
    });
    // El resumen lo cruza todo: cualquier cambio en los datos le afecta,
    // y los ajustes deciden qué tarjetas y secciones enseña.
    if (d.all || d.home || d.settings) UI.renderHome(today);
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
    } else if (event === 'external') {
      // Otra ventana (la app instalada o una pestaña) ha guardado: lo de
      // aquí es viejo y ya no se guarda. Se recarga en cuanto se pueda.
      reloadWhenIdle('Has cambiado los datos en otra ventana de la app: se recarga para no pisarlos.');
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
  /** «Usado» / «Cargado» de un dispositivo: la fecha a hoy, con Deshacer. */
  function markDeviceToday(id, field) {
    const device = S.getItem('devices', id);
    if (!device) return;
    const before = device[field];
    const what = field === 'lastUsed' ? 'usado' : 'cargado';
    if (before === today) {
      UI.toast('«' + device.name + '» ya estaba apuntado como ' + what + ' hoy.', { icon: field === 'lastUsed' ? '✋' : '🔋' });
      return;
    }
    const patch = { id: id };
    patch[field] = today;
    S.saveItem('devices', patch);
    UI.toast('«' + device.name + '»: ' + what + ' hoy.', {
      type: 'success', icon: field === 'lastUsed' ? '✋' : '🔋',
      action: { label: 'Deshacer', onClick: function () { const back = { id: id }; back[field] = before; S.saveItem('devices', back); } }
    });
  }

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

  /**
   * La copia de ahora mismo, o null si aún se está cifrando el último
   * cambio (entonces se avisa y se fuerza el guardado para el siguiente toque).
   */
  function backupText() {
    const copy = S.exportNow();
    if (copy.fresh) return copy.text;
    S.save(true);
    UI.toast('Guardando el último cambio… vuelve a pulsar en un segundo.', { icon: '⏳' });
    return null;
  }

  function backupName() {
    return 'vida-digital-' + today;      // fecha local, no toISOString (UTC)
  }

  /** Con contraseña, la copia sale cifrada igual que lo guardado. */
  function exportJson() {
    const text = backupText();
    if (text === null) return;
    download(backupName() + '.json', text, 'application/json');
    S.markExported();
    UI.toast(S.isEncrypted() ? 'Copia cifrada descargada.' : 'Copia descargada.', { type: 'success', icon: '↓' });
  }

  /* ── Guardar en Drive (compartir) ─────────────────────────
     Las reglas, o no funciona:
     · Se llama directamente desde el toque del botón, sin esperas: si antes
       hay una promesa (cifrar, leer…), Chrome lo bloquea con NotAllowedError.
       Por eso la copia sale de store.exportNow(), que ya está hecha.
     · Solo el archivo, sin title ni text: con texto, Drive se queda con el
       texto y tira el archivo.
     · Siempre .txt: Chrome en Android no deja compartir .json, y aunque
       canShare diga que sí, share falla después. Importar acepta los dos.
     · Solo en pantallas táctiles: en Windows el menú de compartir no ofrece
       Drive, así que en el ordenador se descarga.
     · Cancelar el menú da AbortError: no es un fallo, no se avisa. Con
       cualquier otro error se descarga el .json.
     ─────────────────────────────────────────────────────── */

  function canShareFiles() {
    const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    return touch && !!navigator.share && !!navigator.canShare && typeof File === 'function';
  }

  function shareBackup() {
    const text = backupText();
    if (text === null) return;

    if (canShareFiles()) {
      const file = new File([text], backupName() + '.txt', { type: 'text/plain' });
      let ok = false;
      try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }

      if (ok) {
        navigator.share({ files: [file] })
          .then(function () {
            S.markExported();
            UI.toast('Copia enviada.', { type: 'success', icon: '☁️' });
          })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return;      // cerraste el menú
            download(backupName() + '.json', text, 'application/json');
            S.markExported();
            UI.toast('No se pudo compartir: la copia se ha descargado.', { icon: '↓', duration: 6000 });
          });
        return;
      }
    }

    download(backupName() + '.json', text, 'application/json');
    S.markExported();
    UI.toast(S.isEncrypted() ? 'Copia cifrada descargada.' : 'Copia descargada.', { type: 'success', icon: '↓' });
  }

  function csvCell(value) {
    const s = VD.sheet.safeCell(value);       // sin fórmulas: "=…" entra como texto
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

    const byKind = Object.create(null);
    res.entries.forEach(function (en) { byKind[en.kind] = (byKind[en.kind] || 0) + 1; });
    const summary = Object.keys(byKind).map(function (k) {
      return byKind[k] + ' ' + (byKind[k] === 1 ? U.kindById(k).one : U.kindById(k).name.toLowerCase());
    }).join(', ');

    let msg = 'Se van a importar ' + res.entries.length + ' filas: ' + summary + '.';
    if (res.skipped.length) msg += '\n\nSe saltan ' + res.skipped.length + ':\n' + problems.join('\n');
    if (res.unclear.length) {
      msg += '\n\nCeldas que no entiendo (se dejan vacías): ' + res.unclear.slice(0, 4).map(function (u) {
        return 'fila ' + u.line + ', ' + u.column + ': «' + u.value + '»';
      }).join(' · ') + (res.unclear.length > 4 ? ' y ' + (res.unclear.length - 4) + ' más' : '');
    }
    if (res.ignored.length) msg += '\n\nColumnas que no reconozco (se ignoran): ' + res.ignored.join(', ');
    msg += '\n\nLo que ya exista (mismo Id, o mismo nombre y usuario) se completa, no se duplica. ¿Continuar?';
    if (!window.confirm(msg)) return;

    const done = S.importItems(res.entries);
    UI.els.importText.value = '';
    UI.closeImport();
    UI.toast('Importado: ' + done.added + ' nuevos' + (done.updated ? ' y ' + done.updated + ' completados' : '') + '.',
             { type: 'success', icon: '📥', duration: 6000 });
  }

  /** Reemplaza todo por una copia ya abierta (descifrada si lo estaba). */
  function applyBackup(parsed) {
    const looksRight = parsed && typeof parsed === 'object' &&
      U.KINDS.some(function (k) { return Array.isArray(parsed[k.id]); });
    if (!looksRight) {
      UI.toast('El archivo no parece una copia de Vida digital.', { type: 'error', icon: '⚠️' });
      return;
    }
    // Una copia de una versión más nueva perdería lo que esta no conoce.
    if ((Math.floor(Number(parsed.version)) || 1) > S.schemaVersion()) {
      UI.toast('Esta copia es de una versión más nueva de la app. Actualízala (cierra y abre con conexión) e impórtala otra vez.',
               { type: 'error', icon: '⚠️', duration: 9000 });
      return;
    }

    const count = U.KINDS.reduce(function (n, k) {
      return n + (Array.isArray(parsed[k.id]) ? parsed[k.id].length : 0);
    }, 0);
    if (!window.confirm('La copia tiene ' + count + ' elementos y reemplazará todo lo que hay ahora. ¿Continuar?')) return;

    S.replaceState(parsed);
    UI.closeForm();
    UI.toast('Copia importada.', { type: 'success', icon: '↑' });
  }

  // Una copia cifrada espera aquí a que se escriba su contraseña.
  let pendingBackup = null;

  function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,.txt';

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

        if (S.isEnvelope(parsed)) {
          if (!S.cryptoAvailable()) {
            UI.toast('Esta copia está cifrada y este navegador no puede descifrarla.', { type: 'error', icon: '⚠️' });
            return;
          }
          pendingBackup = parsed;
          UI.openPassword('backup');
          return;
        }
        applyBackup(parsed);
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
      // En el móvil, directo a Compartir (Drive…); si no se puede, descarga.
      action: { label: 'Guardar copia', onClick: shareBackup }
    });
  }

  function resetAll() {
    if (!window.confirm('Se borrará todo lo apuntado en este navegador' +
                        (S.isEncrypted() ? ', la contraseña' : '') +
                        (S.getRescues().length ? ' y las copias de rescate' : '') +
                        '. No se puede deshacer.\n\n¿Seguro?')) return;
    S.reset();
    UI.toast('Todo borrado.');
  }

  /* ── Copias de rescate (Ajustes) ──────────────────────────── */

  function downloadRescue(index) {
    const r = S.getRescues()[index];
    if (!r) return;
    download('vida-digital-rescate-' + (r.date || today) + '.json', r.text, 'application/json');
    UI.toast(r.kind === 'locked'
      ? 'Descargada. Para abrirla: Importar copia y la contraseña que tenías entonces.'
      : 'Descargada tal como estaba (dañada): ábrela en un editor de texto para rescatar lo que puedas.',
      { icon: '↓', duration: 7000 });
  }

  function deleteRescue(index) {
    const r = S.getRescues()[index];
    if (!r) return;
    if (!window.confirm('¿Borrar esta copia de rescate? ' +
                        (r.kind === 'locked' ? 'Sin ella, esos datos cifrados se pierden para siempre.' : 'No se puede deshacer.'))) return;
    S.removeRescue(index);
    UI.renderSettings(today);
  }

  /* ── Contraseña ───────────────────────────────────────────── */

  const MIN_PASSWORD = 8;

  function onPasswordSubmit(e) {
    e.preventDefault();
    const f = UI.passwordForm();

    if (f.mode === 'set' || f.mode === 'change') {
      if (f.fresh.length < MIN_PASSWORD) { UI.passwordError('La contraseña nueva necesita al menos ' + MIN_PASSWORD + ' caracteres.'); return; }
      if (f.fresh !== f.repeat) { UI.passwordError('Las dos contraseñas nuevas no coinciden.'); return; }
    }
    if ((f.mode === 'change' || f.mode === 'remove' || f.mode === 'backup') && !f.current) {
      UI.passwordError('Escribe la contraseña.');
      return;
    }

    UI.passwordError('');
    UI.passwordBusy(true);

    if (f.mode === 'backup') {
      const backup = pendingBackup;
      S.openBackup(backup, f.current).then(function (res) {
        UI.passwordBusy(false);
        if (!res) { UI.passwordError('Contraseña incorrecta.'); return; }
        pendingBackup = null;
        UI.closePassword();
        applyBackup(res.obj);
      });
      return;
    }

    const check = f.mode === 'set' ? Promise.resolve(true) : S.checkPassword(f.current);
    check.then(function (ok) {
      if (!ok) { UI.passwordBusy(false); UI.passwordError('La contraseña actual no es esa.'); return null; }
      return (f.mode === 'remove' ? S.removePassword() : S.setPassword(f.fresh)).then(function () {
        UI.passwordBusy(false);
        UI.closePassword();
        UI.renderSettings(today);
        UI.toast({
          set: 'Contraseña puesta: tus datos ya se guardan cifrados. No la olvides.',
          change: 'Contraseña cambiada.',
          remove: 'Contraseña quitada: los datos se guardan sin cifrar.'
        }[f.mode], { type: 'success', icon: f.mode === 'remove' ? '🔓' : '🔒', duration: 6000 });
      });
    }).catch(function (err) {
      console.error(err);
      UI.passwordBusy(false);
      UI.passwordError('No se pudo completar: ' + (err && err.message || 'error') + '.');
    });
  }

  /* ── Candado al arrancar ──────────────────────────────────── */

  function onLockSubmit(e) {
    e.preventDefault();
    const pw = UI.els.lockInput.value;
    if (!pw) { UI.lockMessage('Escribe la contraseña.'); return; }
    UI.lockBusy(true);
    S.unlock(pw).then(function (ok) {
      if (!ok) {
        UI.lockBusy(false);
        UI.lockMessage('Contraseña incorrecta.');
        UI.els.lockInput.select();
        return;
      }
      UI.hideLock();
      afterLoad();
    });
  }

  function onLockForgot() {
    if (!window.confirm('Sin la contraseña no se pueden abrir tus datos: nadie puede, tampoco esta app.\n\n' +
                        'Si sigues, se empieza de cero sin datos. Lo cifrado se guarda en Ajustes → Copias de rescate ' +
                        'por si la recuerdas, y las copias que exportaste siguen abriéndose con su contraseña.\n\n' +
                        '¿Empezar de cero?')) return;
    if (!S.forgetAndReset()) {
      // Sin sitio para guardar lo cifrado: no se borra nada.
      UI.lockMessage('No hay espacio para guardar tus datos cifrados aparte, así que no se ha borrado nada. ' +
                     'Libera espacio (otras apps de este sitio) y vuelve a probar.');
      return;
    }
    UI.hideLock();
    afterLoad();
    UI.toast('Empezamos de cero. Lo cifrado está en Ajustes → Copias de rescate.', { icon: '🔓', duration: 7000 });
  }

  /* ── Duplicar ─────────────────────────────────────────────── */

  function duplicateOpen() {
    const f = UI.formState();
    const item = f.kind && f.id ? S.getItem(f.kind, f.id) : null;
    if (!item) return;
    if (UI.formDirty() && !window.confirm('Se duplica lo que está guardado, sin los cambios que no has guardado. ¿Seguir?')) return;
    UI.openForm(f.kind, item, { copy: true });
    UI.toast('Es una copia: cambia lo que haga falta y pulsa Guardar.', { icon: '⧉' });
  }

  /* ── Eventos ──────────────────────────────────────────────── */

  function bind() {
    const els = UI.els;

    // Un solo manejador para todo lo que navega, añade o abre: los botones
    // de las listas y del resumen se crean y se destruyen en cada repintado.
    document.addEventListener('click', function (e) {
      // Fuera del menú del +, lo cierra.
      if (!e.target.closest('#fabMenu, #fab')) UI.toggleFabMenu(false);

      const t = e.target.closest('[data-back], [data-view], [data-add], [data-migrate], [data-copy-done], ' +
                                 '[data-open-id], [data-tag-filter], [data-toggle-archived], [data-import-excel], ' +
                                 '[data-device-used], [data-device-charged], ' +
                                 '[data-accent], [data-layout-move], [data-rescue-download], [data-rescue-delete], ' +
                                 '.item[data-id], .event[data-id]');
      if (!t) return;
      if (t.hasAttribute('data-back')) back();
      else if (t.dataset.accent) S.setSetting('accent', t.dataset.accent);
      else if (t.dataset.rescueDownload) downloadRescue(Number(t.dataset.rescueDownload));
      else if (t.dataset.rescueDelete) deleteRescue(Number(t.dataset.rescueDelete));
      else if (t.dataset.layoutMove) {
        const p = t.dataset.layoutMove.split(':');
        // Tras repintar, el foco vuelve a la misma flecha (o a la otra, si
        // esta quedó desactivada al llegar arriba o abajo del todo).
        const key = p[0] + ':' + p[1];
        UI.focusAfterRender(['[data-layout-move="' + t.dataset.layoutMove + '"]',
                             '[data-layout-move="' + key + ':' + (-Number(p[2])) + '"]',
                             '[data-layout-toggle="' + key + '"]']);
        S.moveLayout(p[0], p[1], Number(p[2]));
      }
      else if (t.hasAttribute('data-import-excel')) UI.openImport();
      else if (t.dataset.tagFilter) { UI.setTagFilter(t.dataset.kind, t.dataset.tagFilter); UI.renderList(t.dataset.kind, today); }
      else if (t.dataset.toggleArchived) { UI.toggleArchived(t.dataset.toggleArchived); UI.renderList(t.dataset.toggleArchived, today); }
      else if (t.dataset.openId) openLinked(t.dataset.openKind, t.dataset.openId);
      else if (t.dataset.copyDone) markCopyDone(t.dataset.copyDone);
      else if (t.dataset.deviceUsed) markDeviceToday(t.dataset.deviceUsed, 'lastUsed');
      else if (t.dataset.deviceCharged) markDeviceToday(t.dataset.deviceCharged, 'lastCharged');
      else if (t.dataset.migrate) toggleMigrated(t.dataset.kind, t.dataset.migrate);
      else if (t.dataset.view) go(t.dataset.view, true);
      else if (t.dataset.add) { UI.toggleFabMenu(false); UI.openForm(t.dataset.add, null); }
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
    els.btnItemCancel.addEventListener('click', requestCloseForm);
    els.btnItemClose.addEventListener('click', requestCloseForm);
    els.btnItemDelete.addEventListener('click', deleteOpen);
    els.btnItemArchive.addEventListener('click', archiveOpen);
    els.btnItemDuplicate.addEventListener('click', duplicateOpen);

    // El +: en una sección añade ahí; en el Resumen abre el menú de secciones.
    els.fab.addEventListener('click', function () {
      const kind = UI.fabTarget();
      if (kind) UI.openForm(kind, null);
      else UI.toggleFabMenu();
    });

    // Ajustes → Resumen: las casillas Mostrar.
    [els.layoutSections, els.layoutCards].forEach(function (list) {
      list.addEventListener('change', function (e) {
        const key = e.target.dataset.layoutToggle;
        if (!key) return;
        const p = key.split(':');
        UI.focusAfterRender(['[data-layout-toggle="' + key + '"]']);
        S.toggleLayout(p[0], p[1]);
      });
    });

    els.btnShareJson.addEventListener('click', shareBackup);
    els.btnPwSet.addEventListener('click', function () { UI.openPassword('set'); });
    els.btnPwChange.addEventListener('click', function () { UI.openPassword('change'); });
    els.btnPwRemove.addEventListener('click', function () { UI.openPassword('remove'); });
    els.pwForm.addEventListener('submit', onPasswordSubmit);
    els.btnPwClose.addEventListener('click', UI.closePassword);
    els.btnPwCancel.addEventListener('click', UI.closePassword);
    // Mientras se deriva la clave no se puede cerrar (Esc, atrás): la
    // operación se aplicaría igual sin que lo vieras.
    els.pwModal.addEventListener('cancel', function (e) { if (UI.isPasswordBusy()) e.preventDefault(); });
    els.pwModal.addEventListener('close', function () { pendingBackup = null; UI.closePassword(); });

    els.importForm.addEventListener('submit', runImport);
    els.btnImportClose.addEventListener('click', UI.closeImport);
    els.btnImportTemplate.addEventListener('click', downloadTemplate);
    els.btnImportFile.addEventListener('click', chooseCsv);
    els.importModal.addEventListener('click', function (e) {
      if (e.target === els.importModal) UI.closeImport();
    });
    // Esc o el gesto atrás de Android llegan como `cancel`: con cambios sin
    // guardar se pregunta antes de cerrar (antes se perdía lo escrito).
    els.itemModal.addEventListener('cancel', function (e) {
      if (!UI.formDirty()) return;
      e.preventDefault();
      requestCloseForm();
    });
    // Al cerrarse por lo que sea, se limpia el estado del formulario.
    els.itemModal.addEventListener('close', UI.closeForm);
    // Clic en el fondo oscuro: el propio <dialog> es el destino.
    els.itemModal.addEventListener('click', function (e) {
      if (e.target === els.itemModal) requestCloseForm();
    });

    // Esc cierra el menú del +.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.fabMenu.hidden) UI.toggleFabMenu(false);
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

    // Al volver a la app:
    //   · con contraseña y más de AUTOLOCK_MIN minutos fuera, se bloquea;
    //   · si hay una recarga pendiente (otra ventana, versión nueva) y nada
    //     a medias, se hace ahora;
    //   · si ha cambiado el día, se recalculan los "en 3 días" y los cobros.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (S.isEncrypted() && hiddenAt && Date.now() - hiddenAt > AUTOLOCK_MIN * 60000) {
        safeReload();
        return;
      }
      if (reloadPending && !busy()) { safeReload(); return; }
      const now = U.todayKey();
      if (now === today) return;
      today = now;
      dirty.all = true;
      scheduleFlush();
    });
  }

  /* ── Cerrar el formulario ─────────────────────────────────── */

  /** Cancelar, ✕ y el fondo: si hay cambios sin guardar, se pregunta. */
  function requestCloseForm() {
    if (UI.formDirty() && !window.confirm('Tienes cambios sin guardar. ¿Cerrar y perderlos?')) return;
    UI.closeForm();
  }

  /* ── Recargar sin perder nada ─────────────────────────────
     Una versión nueva, datos cambiados en otra ventana o el autobloqueo
     piden recargar. Nunca a mitad de algo: con un formulario abierto, la
     contraseña a medio escribir o un diálogo, se espera y se avisa. Y antes
     de recargar se espera a que lo cifrado esté escrito. ───── */

  // Con contraseña, la app se vuelve a bloquear tras estos minutos fuera
  // (en Android una app en segundo plano puede seguir viva días).
  const AUTOLOCK_MIN = 5;
  let hiddenAt = 0;
  let reloadPending = false;

  function busy() {
    const els = UI.els;
    const lockTyping = !els.lockScreen.hidden && !!els.lockInput.value;
    return els.itemModal.open || els.pwModal.open || els.importModal.open || lockTyping;
  }

  function safeReload() {
    S.flush().then(function () { window.location.reload(); }, function () { window.location.reload(); });
  }

  function reloadWhenIdle(message) {
    if (!busy()) { safeReload(); return; }
    if (reloadPending) return;
    reloadPending = true;
    UI.toast(message + ' Termina lo que estás haciendo y pulsa Recargar.', {
      icon: '↻', duration: 60000,
      action: { label: 'Recargar', onClick: safeReload }
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
    // cambiar de dueño deja el conjunto coherente; si estás a mitad de algo
    // (formulario, contraseña), se espera y se avisa en vez de cortarte.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading) return;           // el evento puede llegar más de una vez
        reloading = true;
        reloadWhenIdle('Hay una versión nueva de la app.');
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

    listenInstall();                     // antes del manifest: si no, el aviso puede perderse
    linkManifest();
    registerServiceWorker();
    requestPersist();

    // Con contraseña no hay datos hasta descifrarlos: primero el candado,
    // y el resto del arranque cuando se abra.
    const err = S.getLastError();
    if (err && (err.type === 'locked' || err.type === 'nocrypto')) {
      UI.els.lockForm.addEventListener('submit', onLockSubmit);
      UI.els.btnLockForgot.addEventListener('click', onLockForgot);
      if (err.type === 'nocrypto') {
        UI.showLock('Este navegador no puede descifrar. Ábrela desde https://alexlobar.github.io/VidaDigital/ o con Chrome o Edge.', false);
      } else {
        UI.showLock('');
      }
      return;
    }
    afterLoad();
  }

  let loaded = false;

  /** El resto del arranque, con los datos ya cargados (o descifrados). Una sola vez. */
  function afterLoad() {
    // Dos llamadas (p. ej. "He olvidado" justo al terminar un desbloqueo)
    // duplicarían los manejadores: cada clic se haría dos veces.
    if (loaded) return;
    loaded = true;
    S.subscribe(onStoreEvent);
    renderAll();
    bind();
    go(location.hash.slice(1) || 'home');

    // Avisos: datos dañados > almacenamiento bloqueado > recordatorio de copia.
    const err = S.getLastError();
    if (err && err.type === 'corrupt') {
      UI.toast('Había datos dañados: se empezó de cero y el original está en Ajustes → Copias de rescate.',
               { type: 'error', icon: '⚠️', duration: 8000 });
    } else if (err && err.type === 'newer') {
      UI.toast('Estos datos son de una versión más nueva de la app: se ven, pero no se guardará nada hasta que la actualices (ciérrala y ábrela con conexión).',
               { type: 'error', icon: '⚠️', duration: 12000 });
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
