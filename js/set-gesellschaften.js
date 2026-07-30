"use strict";

/* Einstellungen -> Gesellschaften & Domänen */

SETTINGS_VIEWS.gesellschaften = (() => {
  const { C, $, esc, listMissing, missingBanner, save, delRow,
          fldAktiv, readForm } = SETUI;

  function viewGes(host) {
    const name = C.lists.gesellschaften;
    if (listMissing(name)) { host.innerHTML = missingBanner(name); return; }
    const rows = DATA.cfg.gesellschaften;

    host.innerHTML = `
      <div class="card">
        <h4>🏭 Gesellschaften & Domänen</h4>
        <p class="hint">Jede E-Mail-Domäne des Tenants wird genau einer Gesellschaft zugeordnet.
          Die Zuordnung passiert beim Anmelden automatisch – niemand muss etwas auswählen.
          Die als <b>Standard</b> markierte Gesellschaft greift für Domänen ohne eigenen Eintrag.</p>
        <div class="row" style="margin-bottom:14px">
          <button class="btn" id="gNew">+ Domäne zuordnen</button>
          <button class="btn sec" id="gScan">🔍 Domänen im Tenant suchen</button>
          <button class="btn sec" id="gKeep">🧹 Nur bestimmte behalten …</button>
          <button class="btn danger" id="gBulk" disabled>🗑 Ausgewählte löschen</button>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr>
            <th style="width:28px"><input type="checkbox" id="gAll" title="Alle auswählen"></th>
            <th>Domäne</th><th>Gesellschaft</th><th>Kürzel</th><th>Farbe</th>
            <th>Standard</th><th>Sort.</th><th></th></tr></thead>
          <tbody>${rows.map(g => `
            <tr class="${g.Aktiv === false ? "off" : ""}">
              <td><input type="checkbox" data-sel="${g.id}"></td>
              <td><b>@${esc(g.Title)}</b></td>
              <td>${esc(g.Gesellschaft || "–")}</td>
              <td>${esc(g.Kuerzel || "–")}</td>
              <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;vertical-align:-3px;background:${esc(g.Farbe || "#17509E")}"></span></td>
              <td>${g.Standard ? '<span class="pill orange">Standard</span>' : ""}</td>
              <td>${esc(DATA.num(g.Sortierung))}</td>
              <td class="actions">
                <button class="btn sec sm" data-edit="${g.id}">Bearbeiten</button>
                <button class="btn danger sm" data-del="${g.id}">Löschen</button>
              </td></tr>`).join("") ||
            `<tr><td colspan="8" style="color:var(--muted)">Noch keine Zuordnung angelegt.</td></tr>`}
          </tbody></table></div>
      </div>`;

    const sel = () => [...host.querySelectorAll("[data-sel]:checked")].map(i => i.dataset.sel);
    const refresh = () => {
      const n = sel().length;
      const b = $("gBulk");
      b.disabled = n === 0;
      b.textContent = n ? `🗑 ${n} Ausgewählte löschen` : "🗑 Ausgewählte löschen";
    };
    host.querySelectorAll("[data-sel]").forEach(i => i.onchange = refresh);
    $("gAll").onchange = e => {
      host.querySelectorAll("[data-sel]").forEach(i => i.checked = e.target.checked);
      refresh();
    };

    $("gNew").onclick  = () => editGes(null);
    $("gScan").onclick = scanDomains;
    $("gKeep").onclick = () => keepOnly(rows);
    $("gBulk").onclick = () => bulkDelete(rows.filter(r => sel().includes(r.id)));
    host.querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => editGes(rows.find(r => r.id === b.dataset.edit)));
    host.querySelectorAll("[data-del]").forEach(b =>
      b.onclick = () => delRow(name, b.dataset.del, "Gesellschaft"));
  }

  /** Mehrere Zuordnungen auf einmal entfernen – mit vollständiger Vorschau. */
  function bulkDelete(opfer) {
    if (!opfer.length) return;
    const standard = opfer.find(g => g.Standard === true);
    APP.modal({
      title: opfer.length + " Zuordnung" + (opfer.length === 1 ? "" : "en") + " löschen",
      okText: "Endgültig löschen",
      bodyHtml: `
        <p>Diese Einträge werden aus <b>${esc(C.lists.gesellschaften)}</b> entfernt
           (in SharePoint landen sie im Papierkorb der Website):</p>
        <ul style="max-height:220px;overflow:auto;font-size:14px;line-height:1.7;margin:12px 0">
          ${opfer.map(g => `<li><b>@${esc(g.Title)}</b> – ${esc(g.Gesellschaft || "")}</li>`).join("")}
        </ul>
        ${standard ? `<div class="warn">Darunter ist die <b>Standard-Gesellschaft</b>
           (@${esc(standard.Title)}). Ohne sie bekommen Konten mit unbekannter Domäne keine
           Gesellschaft mehr zugeordnet. Bitte danach eine andere als Standard markieren.</div>` : ""}
        <p class="hint">Reiter und Kacheln bleiben unberührt. Nur wenn dort eine dieser
          Domänen unter „Sichtbar für Domänen“ steht, wird sie dadurch wirkungslos.</p>`,
      onOk: () => save(async () => {
        for (const g of opfer) {
          await GRAPH.deleteItem(C.configSite, C.lists.gesellschaften, g.id);
        }
      })
    });
  }

  /** Liste von Domänen einfügen – alles andere wird zum Löschen vorgeschlagen. */
  function keepOnly(rows) {
    APP.modal({
      title: "Nur bestimmte Domänen behalten",
      okText: "Weiter",
      bodyHtml: `
        <p class="hint">Eine Domäne je Zeile (das <code>@</code> darf davor stehen).
          Alles, was nicht in der Liste steht, wird anschließend zum Löschen vorgeschlagen –
          gelöscht wird erst nach der Bestätigung im nächsten Schritt.</p>
        <label class="f">Zu behaltende Domänen</label>
        <textarea data-f="keep" style="min-height:180px;font-family:ui-monospace,Consolas,monospace"
          placeholder="dihag.com&#10;shb-guss.de&#10;walze-coswig.de">${
            esc(rows.map(g => g.Title).join("\n"))}</textarea>`,
      onOk: async bg => {
        const keep = new Set(DATA.parseList(
          bg.querySelector("[data-f=keep]").value.replace(/^@/gm, "")));
        if (!keep.size) { APP.toast("Bitte mindestens eine Domäne angeben.", true); return false; }
        const weg = rows.filter(g => !keep.has(String(g.Title || "").toLowerCase().trim()));
        if (!weg.length) { APP.toast("Es gibt nichts zu entfernen."); return true; }
        setTimeout(() => bulkDelete(weg), 0);
        return true;
      }
    });
  }

  function editGes(row) {
    const r = row || {};
    APP.modal({
      title: row ? "Domäne bearbeiten" : "Domäne zuordnen",
      bodyHtml: `<div class="grid2">
        <div><label class="f">E-Mail-Domäne *</label>
          <input type="text" data-f="Title" value="${esc(r.Title || "")}" placeholder="gienanth.de"></div>
        <div><label class="f">Gesellschaft *</label>
          <input type="text" data-f="Gesellschaft" value="${esc(r.Gesellschaft || "")}" placeholder="Gienanth GmbH"></div>
        <div><label class="f">Kürzel</label>
          <input type="text" data-f="Kuerzel" value="${esc(r.Kuerzel || "")}" placeholder="GIE"></div>
        <div><label class="f">Farbe (Hex)</label>
          <input type="text" data-f="Farbe" value="${esc(r.Farbe || "#17509E")}"></div>
        <div><label class="f">Sortierung</label>
          <input type="number" data-f="Sortierung" value="${r.Sortierung ?? 100}"></div>
        <div style="align-self:end">
          <label class="chk"><input type="checkbox" data-f="Standard"${r.Standard ? " checked" : ""}> Standard-Gesellschaft</label>
        </div>
        ${fldAktiv(r.Aktiv)}
      </div>`,
      onOk: async bg => {
        const f = readForm(bg);
        if (!f.Title || !f.Gesellschaft) { APP.toast("Domäne und Gesellschaft sind Pflicht.", true); return false; }
        f.Title = f.Title.toLowerCase().replace(/^@/, "");
        return save(() => row
          ? GRAPH.updateItem(C.configSite, C.lists.gesellschaften, row.id, f)
          : GRAPH.addItem(C.configSite, C.lists.gesellschaften, f));
      }
    });
  }

  async function scanDomains() {
    const btn = $("gScan");
    btn.disabled = true; btn.textContent = "Suche …";
    try {
      const found = await DATA.discoverDomains();
      const have = new Set(DATA.cfg.gesellschaften.map(g => String(g.Title || "").toLowerCase()));
      const neu = found.filter(f => !have.has(f.domain));
      APP.modal({
        title: "Domänen im Tenant",
        bodyHtml: `
          <p class="hint">Gefunden anhand der Benutzerkonten. Häkchen setzen, um fehlende Domänen
             als Gesellschaft anzulegen (Name lässt sich danach bearbeiten).</p>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th></th><th>Domäne</th><th>Konten</th><th>Status</th></tr></thead>
            <tbody>${found.map(f => `
              <tr><td>${have.has(f.domain) ? "" :
                    `<input type="checkbox" data-dom="${esc(f.domain)}" checked>`}</td>
                <td><b>@${esc(f.domain)}</b></td>
                <td>${f.anzahl}</td>
                <td>${have.has(f.domain)
                      ? '<span class="pill green">zugeordnet</span>'
                      : '<span class="pill gray">neu</span>'}</td></tr>`).join("")}
            </tbody></table></div>`,
        okText: neu.length ? `${neu.length} anlegen` : "Schließen",
        onOk: async bg => {
          const sel = [...bg.querySelectorAll("[data-dom]:checked")].map(i => i.dataset.dom);
          if (!sel.length) return true;
          return save(async () => {
            let i = DATA.cfg.gesellschaften.length;
            for (const d of sel) {
              const nm = d.split(".")[0].replace(/^./, c => c.toUpperCase());
              await GRAPH.addItem(C.configSite, C.lists.gesellschaften, {
                Title: d, Gesellschaft: nm, Kuerzel: nm.slice(0, 3).toUpperCase(),
                Farbe: "#17509E", Standard: false, Aktiv: true, Sortierung: (++i) * 10
              });
            }
          });
        }
      });
    } catch (e) {
      APP.toast("Domänensuche fehlgeschlagen: " + e.message, true);
    } finally {
      btn.disabled = false; btn.textContent = "🔍 Domänen im Tenant suchen";
    }
  }

  return viewGes;
})();
