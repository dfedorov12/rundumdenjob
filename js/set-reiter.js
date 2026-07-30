"use strict";

/* Einstellungen -> Reiter */

SETTINGS_VIEWS.reiter = (() => {
  const { C, $, esc, listMissing, missingBanner, save, delRow,
          fldDomains, fldRolle, fldAktiv, readForm } = SETUI;

  function viewReiter(host) {
    const name = C.lists.reiter;
    if (listMissing(name)) { host.innerHTML = missingBanner(name); return; }
    const rows = DATA.cfg.reiter;

    host.innerHTML = `
      <div class="card">
        <h4>🗂️ Reiter</h4>
        <p class="hint">Jeder Reiter ist ein eigener Eintrag. Über <b>Domänen</b> und <b>Mindestrolle</b>
          steuern Sie, wer ihn überhaupt zu sehen bekommt – ein nicht sichtbarer Reiter erscheint
          gar nicht erst in der Navigation.</p>
        <div class="row" style="margin-bottom:14px"><button class="btn" id="rNew">+ Neuer Reiter</button></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Sort.</th><th>Icon</th><th>Reiter</th><th>Schlüssel</th>
            <th>Domänen</th><th>Rolle ab</th><th>Kacheln</th><th></th></tr></thead>
          <tbody>${rows.map(r => `
            <tr class="${r.Aktiv === false ? "off" : ""}">
              <td>${esc(DATA.num(r.Sortierung))}</td>
              <td style="font-size:18px">${esc(r.Icon || "")}</td>
              <td><b>${esc(r.Title)}</b>${r.Aktiv === false ? ' <span class="pill gray">inaktiv</span>' : ""}</td>
              <td><code>${esc(r.ReiterKey || "")}</code></td>
              <td>${domPills(r.Domains)}</td>
              <td><span class="pill ${r.MinRolle === "admin" ? "orange" : r.MinRolle === "editor" ? "navy" : "gray"}">${esc(r.MinRolle || "viewer")}</span></td>
              <td>${DATA.cfg.kacheln.filter(k => k.ReiterKey === r.ReiterKey).length}</td>
              <td class="actions">
                <button class="btn sec sm" data-edit="${r.id}">Bearbeiten</button>
                <button class="btn danger sm" data-del="${r.id}">Löschen</button>
              </td></tr>`).join("") ||
            `<tr><td colspan="8" style="color:var(--muted)">Noch keine Reiter angelegt.</td></tr>`}
          </tbody></table></div>
      </div>`;

    $("rNew").onclick = () => editReiter(null);
    host.querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => editReiter(rows.find(r => r.id === b.dataset.edit)));
    host.querySelectorAll("[data-del]").forEach(b =>
      b.onclick = () => delRow(name, b.dataset.del, "Reiter"));
  }

  const domPills = v => {
    const d = DATA.parseList(v);
    if (!d.length || d.includes("*")) return '<span class="pill green">alle</span>';
    return d.map(x => `<span class="pill">${esc(x)}</span>`).join(" ");
  };

  function editReiter(row) {
    const r = row || {};
    APP.modal({
      title: row ? "Reiter bearbeiten" : "Neuer Reiter",
      bodyHtml: `<div class="grid2">
        <div><label class="f">Name *</label>
          <input type="text" data-f="Title" value="${esc(r.Title || "")}" placeholder="Mein Arbeitsverhältnis"></div>
        <div><label class="f">Schlüssel * (klein, ohne Leerzeichen)</label>
          <input type="text" data-f="ReiterKey" value="${esc(r.ReiterKey || "")}" placeholder="job"></div>
        <div><label class="f">Icon (Emoji)</label>
          <input type="text" data-f="Icon" value="${esc(r.Icon || "")}" placeholder="📄"></div>
        <div><label class="f">Sortierung</label>
          <input type="number" data-f="Sortierung" value="${r.Sortierung ?? 100}"></div>
        <div class="span2"><label class="f">Kurzbeschreibung (unter der Überschrift)</label>
          <textarea data-f="Beschreibung">${esc(r.Beschreibung || "")}</textarea></div>
        ${fldDomains(r.Domains)}
        ${fldRolle(r.MinRolle)}
        ${fldAktiv(r.Aktiv)}
      </div>`,
      onOk: async bg => {
        const f = readForm(bg);
        if (!f.Title || !f.ReiterKey) { APP.toast("Name und Schlüssel sind Pflicht.", true); return false; }
        f.ReiterKey = f.ReiterKey.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (f.ReiterKey === "__settings") { APP.toast("Dieser Schlüssel ist reserviert.", true); return false; }
        return save(() => row
          ? GRAPH.updateItem(C.configSite, C.lists.reiter, row.id, f)
          : GRAPH.addItem(C.configSite, C.lists.reiter, f));
      }
    });
  }

  return viewReiter;
})();
