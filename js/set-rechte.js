"use strict";

/* Einstellungen -> Berechtigungen */

SETTINGS_VIEWS.rechte = (() => {
  const { C, $, esc, readForm } = SETUI;
  const neu = () => SETUI.neu();

  async function viewRechte(host) {
    host.innerHTML = `
      <div class="card">
        <h4>🔑 Berechtigungen</h4>
        <p class="hint">Alle Personen im Tenant sehen die Seite automatisch mit der Rolle
          <b>viewer</b>. Höhere Rollen werden in der zentralen Liste
          <b>${esc(C.permList)}</b> auf <b>${esc(C.permSite)}</b> gepflegt – dieselbe Liste,
          die auch das Organigramm verwendet. Ein Eintrag mit App „<b>*</b>“ gilt für alle Apps.</p>
        <p class="hint"><b>Wichtig:</b> Die Rolle wird beim Anmelden einmal gelesen. Wer bereits
          angemeldet ist, behält seine bisherige Rolle bis zum nächsten Seitenaufruf – eine
          gerade vergebene Rolle wirkt bei den Betroffenen also erst nach dem Neuladen.
          Für das eigene Konto lässt sie sich hier sofort neu einlesen.</p>
        <div class="row" style="margin-bottom:14px">
          <button class="btn" id="pNew">+ Rolle vergeben</button>
          <button class="btn sec" id="pReload">🔄 Meine Rolle neu einlesen
            (aktuell: <b>${esc(DATA.ctx.role)}</b>)</button>
          <a class="btn sec" href="${esc(C.adminUrl)}" target="_blank" rel="noopener">Admin-Portal ↗</a>
        </div>
        <div id="pBox"><p class="hint">Wird geladen …</p></div>
      </div>
      <div class="card">
        <h4>👑 Haupt-Administration</h4>
        <p class="hint">Diese Konten sind in <code>js/config.js</code> festgeschrieben und haben
          immer die Rolle <b>admin</b> – unabhängig von der Rechteliste. So bleibt die App
          administrierbar, falls in <b>${esc(C.permList)}</b> einmal kein Eintrag existiert.
          Änderungen daran gehen nur über einen Commit im Repository.</p>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>E-Mail</th><th>Rolle</th><th>Quelle</th></tr></thead>
          <tbody>${(C.hauptAdmins || []).map(m => `
            <tr><td><b>${esc(m)}</b></td>
              <td><span class="pill orange">admin</span></td>
              <td><span class="pill gray">config.js</span></td></tr>`).join("") ||
            `<tr><td colspan="3" style="color:var(--muted)">Kein Haupt-Administrator gesetzt.</td></tr>`}
          </tbody></table></div>
      </div>`;
    $("pNew").onclick = () => editPerm();
    $("pReload").onclick = e => rolleNeuLesen(e.currentTarget);

    try {
      const rows = (await GRAPH.listItems(C.permSite, C.permList, ["Title", "UserEmail", "App", "Role"])) || [];
      const mine = rows.filter(r => r.App === C.appKey || r.App === "*")
        .sort((a, b) => (a.UserEmail || "").localeCompare(b.UserEmail || ""));
      $("pBox").innerHTML = `
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>E-Mail</th><th>App</th><th>Rolle</th><th></th></tr></thead>
          <tbody>${mine.map(r => `
            <tr><td>${esc(r.UserEmail || "")}${
                (r.UserEmail || "").toLowerCase() === DATA.ctx.email
                  ? ' <span class="pill gray">Ihr Konto</span>' : ""}</td>
              <td>${r.App === "*" ? '<span class="pill navy">alle Apps</span>' : esc(r.App)}</td>
              <td><span class="pill ${r.Role === "admin" ? "orange" : r.Role === "editor" ? "navy" : "gray"}">${esc(r.Role || "")}</span></td>
              <td class="actions">${r.App === C.appKey
                  ? `<button class="btn danger sm" data-pdel="${r.id}">Entfernen</button>`
                  : '<small style="color:var(--muted)">app-übergreifend</small>'}</td></tr>`).join("") ||
            `<tr><td colspan="4" style="color:var(--muted)">Noch keine erhöhten Rollen vergeben.</td></tr>`}
          </tbody></table></div>`;
      host.querySelectorAll("[data-pdel]").forEach(b => b.onclick = async () => {
        try {
          await GRAPH.deleteItem(C.permSite, C.permList, b.dataset.pdel);
          APP.toast("Entfernt");
          await rolleUebernehmen();
          neu();
        } catch (e) { APP.toast(e.message, true); }
      });
    } catch (e) {
      $("pBox").innerHTML = `<div class="err">Rechteliste nicht lesbar: ${esc(e.message)}</div>`;
    }
  }

  /** Eigene Rolle neu aus der Rechteliste lesen und die Oberfläche anpassen.
   *  Ohne das bliebe eine gerade vergebene Rolle bis zum nächsten
   *  Seitenaufruf wirkungslos – loadRole() läuft sonst nur beim Anmelden. */
  async function rolleUebernehmen() {
    const r = await DATA.reloadRole();
    if (r.geaendert) APP.refreshTabs();   // z. B. Einstellungen erscheint/verschwindet
    return r;
  }

  async function rolleNeuLesen(btn) {
    btn.disabled = true;
    try {
      const r = await rolleUebernehmen();
      if (r.geaendert) {
        APP.toast(`Rolle jetzt: ${r.neu} (vorher ${r.alt})`);
        neu();
      } else {
        APP.toast(`Unverändert: ${r.neu}`);
      }
    } catch (e) {
      APP.toast(e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  function editPerm() {
    APP.modal({
      title: "Rolle vergeben",
      bodyHtml: `<div class="grid2">
        <div class="span2"><label class="f">E-Mail-Adresse *</label>
          <input type="text" data-f="UserEmail" placeholder="vorname.nachname@dihag.com"></div>
        <div><label class="f">Rolle</label>
          <select data-f="Role">
            <option value="editor">editor – sieht zusätzlich Inhalte ab Rolle „editor“</option>
            <option value="admin">admin – darf zusätzlich diese Einstellungen ändern</option>
          </select></div>
      </div>
      <p class="hint" style="margin-top:12px">Der Eintrag wird für die App
        <b>${esc(C.appKey)}</b> angelegt. Nur <b>admin</b> öffnet diese Einstellungen –
        <b>editor</b> gibt lediglich Inhalte mit Mindestrolle „editor“ frei.
        Bereits angemeldete Personen bekommen die neue Rolle erst nach dem Neuladen.</p>`,
      onOk: async bg => {
        const f = readForm(bg);
        if (!f.UserEmail || !f.UserEmail.includes("@")) { APP.toast("Bitte eine gültige E-Mail eingeben.", true); return false; }
        try {
          await GRAPH.addItem(C.permSite, C.permList, {
            Title: f.UserEmail, UserEmail: f.UserEmail.toLowerCase(), App: C.appKey, Role: f.Role
          });
          APP.toast("Rolle vergeben");
          await rolleUebernehmen();   // betrifft es das eigene Konto, gilt sie sofort
          neu();
        } catch (e) { APP.toast(e.message, true); return false; }
      }
    });
  }

  return viewRechte;
})();
