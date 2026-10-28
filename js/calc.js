/* ============================================================
   calc.js — Cálculos: gasto, próximos cobros y vencimientos,
   seguridad de las cuentas. Funciones puras sobre el estado:
   ni escribe datos ni toca el DOM.
   ============================================================ */
window.VD = window.VD || {};

VD.calc = (function () {
  'use strict';

  const U = VD.utils;

  function periodOf(sub) {
    return U.periodById(sub.period) || U.PERIODS[0];
  }

  /** Lo que cuesta una suscripción al mes, prorrateado. Las inactivas, 0. */
  function monthly(sub) {
    if (!sub.active || !sub.price) return 0;
    const p = periodOf(sub);
    return p.weeks ? sub.price * 52 / 12 / p.weeks : sub.price / p.months;
  }

  /**
   * Siguiente cobro a partir de hoy (incluido). La fecha guardada no se
   * toca: se le suman periodos enteros hasta alcanzar hoy. Se cuenta
   * siempre desde la fecha original y no encadenando, para que un cobro
   * del día 31 que pasa por febrero vuelva al 31 en marzo.
   */
  function nextCharge(sub, today) {
    if (!sub.nextDate) return null;
    if (sub.nextDate >= today) return sub.nextDate;

    const p = periodOf(sub);
    if (p.weeks) {
      const step = 7 * p.weeks;
      return U.addDaysKey(sub.nextDate, Math.ceil(U.daysBetween(sub.nextDate, today) / step) * step);
    }
    for (let k = 1; k < 2400; k++) {
      const key = U.addMonthsKey(sub.nextDate, k * p.months);
      if (key >= today) return key;
    }
    return null;
  }

  /**
   * Fecha de caducidad que importa hoy. Si se renueva sola y ya pasó, la
   * siguiente (un año después); si no, la guardada, aunque esté en el
   * pasado: un dominio caducado es justo lo que hay que ver.
   */
  function nextExpiry(web, today) {
    if (!web.expires) return null;
    if (web.expires >= today || !web.autoRenew) return web.expires;
    for (let k = 1; k < 200; k++) {
      const key = U.addMonthsKey(web.expires, 12 * k);
      if (key >= today) return key;
    }
    return null;
  }

  /** Gasto total. Los dominios con coste anual se suman prorrateados. */
  function totals(state) {
    const byCat = {};
    let subsMonth = 0;
    let active = 0;

    state.subs.forEach(function (s) {
      const m = monthly(s);
      if (s.active) active++;
      if (!m) return;
      subsMonth += m;
      byCat[s.category] = (byCat[s.category] || 0) + m;
    });

    const websYear = state.webs.reduce(function (sum, w) { return sum + (w.price || 0); }, 0);

    const kind = U.kindById('subs');
    const categories = Object.keys(byCat)
      .map(function (id) { return { cat: U.byId(kind.cats, id), month: byCat[id] }; })
      .sort(function (a, b) { return b.month - a.month; });

    return {
      subsMonth: subsMonth,
      websYear: websYear,
      month: subsMonth + websYear / 12,
      year: subsMonth * 12 + websYear,
      activeSubs: active,
      categories: categories
    };
  }

  /**
   * Lo que pasa en los próximos `days` días: cobros, renovaciones,
   * caducidades y fin de garantías. Los dominios caducados que no se
   * renuevan solos se enseñan aunque ya hayan pasado (hasta 60 días).
   */
  function upcoming(state, today, days) {
    const until = U.addDaysKey(today, days);
    const out = [];

    state.subs.forEach(function (s) {
      if (!s.active) return;
      const date = nextCharge(s, today);
      if (!date || date > until) return;
      out.push({ date: date, kind: 'subs', item: s,
                 text: s.price ? 'Cobro de ' + U.money(s.price) : 'Renovación' });
    });

    state.webs.forEach(function (w) {
      const date = nextExpiry(w, today);
      if (!date || date > until || date < U.addDaysKey(today, -60)) return;
      out.push({ date: date, kind: 'webs', item: w, overdue: date < today,
                 text: date < today ? 'Caducó' : w.autoRenew
                   ? 'Se renueva' + (w.price ? ' · ' + U.money(w.price) : '')
                   : 'Caduca: renueva a mano' });
    });

    state.devices.forEach(function (d) {
      if (!d.warrantyUntil || d.warrantyUntil < today || d.warrantyUntil > until) return;
      if (d.status === 'vendido') return;
      out.push({ date: d.warrantyUntil, kind: 'devices', item: d, text: 'Se acaba la garantía' });
    });

    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /** Cuentas sin verificación en dos pasos; las importantes, primero. */
  function security(state) {
    const without = state.accounts.filter(function (a) { return a.twofa === 'no'; });
    return {
      total: state.accounts.length,
      without: without.length,
      important: without.filter(function (a) { return a.important; })
    };
  }

  return {
    monthly: monthly, nextCharge: nextCharge, nextExpiry: nextExpiry,
    totals: totals, upcoming: upcoming, security: security
  };
})();
