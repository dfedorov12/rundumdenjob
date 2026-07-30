"use strict";

/* Einstellungen -> Kacheln */

SETTINGS_VIEWS.kacheln = (() => {
  const { C, $, esc, listMissing, missingBanner, save, delRow,
          fldDomains, fldRolle, fldAktiv, readForm } = SETUI;
  const domPills = v => {
    const d = DATA.parseList(v);
    if (!d.length || d.includes("*")) return '<span class="pill green">alle</span>';
    return d.map(x => `<span class="pill">${esc(x)}</span>`).join(" ");
  };

  let kFilter = "";

  function viewKacheln(host) {
    const name = C.lists.kacheln;
    if (listMissing(name)) { host.innerHTML = missingBanner(name); return; }
    const rows = DATA.cfg.kacheln.filter(k => !kFilter || k.ReiterKey === kFilter);
    const reiter = DATA.cfg.reiter;

    host.innerHTML = `
      <div class="card">
        <h4>🔳 Kacheln</h4>
        <p class="hint">Kacheln sind die eigentlichen Inhalte. Typ <b>link</b> öffnet ein Ziel
          (Intranet-Seite, Timebutler, andere App), Typ <b>text</b> zeigt einen Textblock direkt auf der Seite.
          Sichtbarkeit wieder über Domänen, Mindestrolle und optional einen Gültigkeitszeitraum.</p>
        <div class="row" style="margin-bottom:14px">
          <button class="btn" id="kNew">+ Neue Kachel</button>
          <select id="kFil" style="width:auto">
            <option value="">Alle Reiter (${DATA.cfg.kacheln.length})</option>
            ${reiter.map(r => `<option value="${esc(r.ReiterKey)}"${kFilter === r.ReiterKey ? " selected" : ""}>${esc(r.Icon || "")} ${esc(r.Title)}</option>`).join("")}
          </select>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Sort.</th><th>Kachel</th><th>Reiter</th><th>Typ</th>
            <th>Domänen</th><th>Rolle ab</th><th>Gültig</th><th></th></tr></thead>
          <tbody>${rows.map(k => `
            <tr class="${k.Aktiv === false ? "off" : ""}">
              <td>${esc(DATA.num(k.Sortierung))}</td>
              <td><b>${esc(k.Icon || "")} ${esc(k.Title)}</b>
                  ${k.Badge ? ` <span class="pill orange">${esc(k.Badge)}</span>` : ""}
                  ${k.Aktiv === false ? ' <span class="pill gray">inaktiv</span>' : ""}
                  <br><small style="color:var(--muted)">${esc((k.Beschreibung || "").slice(0, 70))}</small></td>
              <td>${esc(reiter.find(r => r.ReiterKey === k.ReiterKey)?.Title || k.ReiterKey || "–")}</td>
              <td><span class="pill gray">${esc(k.Typ || "link")}</span></td>
              <td>${domPills(k.Domains)}</td>
              <td><span class="pill ${k.MinRolle === "admin" ? "orange" : k.MinRolle === "editor" ? "navy" : "gray"}">${esc(k.MinRolle || "viewer")}</span></td>
              <td style="white-space:nowrap;font-size:12px;color:var(--muted)">
                ${k.GueltigVon || k.GueltigBis
                  ? esc((k.GueltigVon || "").slice(0, 10) + " – " + (k.GueltigBis || "").slice(0, 10)) : "immer"}</td>
              <td class="actions">
                <button class="btn sec sm" data-edit="${k.id}">Bearbeiten</button>
                <button class="btn danger sm" data-del="${k.id}">Löschen</button>
              </td></tr>`).join("") ||
            `<tr><td colspan="8" style="color:var(--muted)">Keine Kacheln in dieser Auswahl.</td></tr>`}
          </tbody></table></div>
      </div>`;

    $("kNew").onclick = () => editKachel(null);
    $("kFil").onchange = e => { kFilter = e.target.value; SETUI.neu(); };
    host.querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => editKachel(DATA.cfg.kacheln.find(r => r.id === b.dataset.edit)));
    host.querySelectorAll("[data-del]").forEach(b =>
      b.onclick = () => delRow(name, b.dataset.del, "Kachel"));
  }

  function editKachel(row) {
    const k = row || {};
    const reiter = DATA.cfg.reiter;
    APP.modal({
      wide: true,
      title: row ? "Kachel bearbeiten" : "Neue Kachel",
      bodyHtml: `<div class="grid2">
        <div><label class="f">Titel *</label>
          <input type="text" data-f="Title" value="${esc(k.Title || "")}"></div>
        <div><label class="f">Reiter *</label>
          <select data-f="ReiterKey">
            <option value="">– bitte wählen –</option>
            ${reiter.map(r => `<option value="${esc(r.ReiterKey)}"${k.ReiterKey === r.ReiterKey ? " selected" : ""}>${esc(r.Icon || "")} ${esc(r.Title)}</option>`).join("")}
          </select></div>
        <div><label class="f">Typ</label>
          <select data-f="Typ">
            <option value="link"${(k.Typ || "link") === "link" ? " selected" : ""}>link – öffnet ein Ziel</option>
            <option value="text"${k.Typ === "text" ? " selected" : ""}>text – Textblock auf der Seite</option>
          </select></div>
        <div><label class="f">Icon (Emoji)</label>
          <input type="text" data-f="Icon" value="${esc(k.Icon || "")}" placeholder="🔗"></div>
        <div class="span2"><label class="f">Beschreibung</label>
          <input type="text" data-f="Beschreibung" value="${esc(k.Beschreibung || "")}"></div>
        <div class="span2"><label class="f">Ziel-URL (bei Typ „link“)</label>
          <input type="text" data-f="Url" value="${esc(k.Url || "")}" placeholder="https://dihag.sharepoint.com/SitePages/…"></div>
        <div class="span2"><label class="f">Textinhalt (bei Typ „text“)</label>
          <textarea data-f="Inhalt">${esc(k.Inhalt || "")}</textarea></div>
        <div><label class="f">Badge (z. B. NEU)</label>
          <input type="text" data-f="Badge" value="${esc(k.Badge || "")}"></div>
        <div><label class="f">Sortierung</label>
          <input type="number" data-f="Sortierung" value="${k.Sortierung ?? 100}"></div>
        ${fldDomains(k.Domains)}
        ${fldRolle(k.MinRolle)}
        ${fldAktiv(k.Aktiv)}
        <div><label class="f">Gültig ab</label>
          <input type="date" data-f="GueltigVon" value="${esc((k.GueltigVon || "").slice(0, 10))}"></div>
        <div><label class="f">Gültig bis</label>
          <input type="date" data-f="GueltigBis" value="${esc((k.GueltigBis || "").slice(0, 10))}"></div>
      </div>`,
      onOk: async bg => {
        const f = readForm(bg);
        if (!f.Title || !f.ReiterKey) { APP.toast("Titel und Reiter sind Pflicht.", true); return false; }
        if ((f.Typ || "link") === "link" && f.Url && !APP.safeUrl(f.Url)) {
          APP.toast("Die URL muss mit http(s):, mailto: oder tel: beginnen.", true); return false;
        }
        return save(() => row
          ? GRAPH.updateItem(C.configSite, C.lists.kacheln, row.id, f)
          : GRAPH.addItem(C.configSite, C.lists.kacheln, f));
      }
    });
  }

  return viewKacheln;
})();
