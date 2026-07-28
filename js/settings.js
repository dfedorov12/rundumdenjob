"use strict";

/* Einstellungen (nur Rolle „admin“):
   Gesellschaften (Domänen-Zuordnung), Reiter, Kacheln, Berechtigungen, Einrichtung */

const SETTINGS = (() => {

  const C = RUDJ_CONFIG;
  const $ = id => document.getElementById(id);
  const esc = s => APP.esc(s);
  let sub = "gesellschaften";

  const SUBS = [
    ["gesellschaften", "🏭 Gesellschaften & Domänen"],
    ["reiter",         "🗂️ Reiter"],
    ["kacheln",        "🔳 Kacheln"],
    ["rechte",         "🔑 Berechtigungen"],
    ["einrichtung",    "🛠️ Einrichtung"]
  ];

  const ROLLEN = ["viewer", "editor", "admin"];

  /* ── Rahmen ──────────────────────────────────────────────────────── */

  function render(host) {
    host.innerHTML = `
      <div class="view active">
        <div class="page-head">
          <h2><span>⚙️</span>Einstellungen</h2>
          <p>Hier steuern Sie, welche Reiter und Kacheln welche Nutzergruppe sieht.
             Die Zuordnung erfolgt automatisch über die E-Mail-Domäne (Gesellschaft)
             und die Rolle aus der zentralen Rechteliste.</p>
        </div>
        <div class="subnav" id="setSub"></div>
        <div id="setBody"></div>
      </div>`;
    const nav = $("setSub");
    for (const [key, label] of SUBS) {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = key === sub ? "active" : "";
      b.onclick = () => { sub = key; render(host); };
      nav.appendChild(b);
    }
    ({ gesellschaften: viewGes, reiter: viewReiter, kacheln: viewKacheln,
       rechte: viewRechte, einrichtung: viewSetup }[sub])($("setBody"));
  }

  const listMissing = name => DATA.cfg.missing.includes(name);

  function missingBanner(name) {
    return `<div class="warn">Die SharePoint-Liste <b>${esc(name)}</b> existiert noch nicht.
      Legen Sie sie unter <b>🛠️ Einrichtung</b> an.</div>`;
  }

  async function save(fn, host) {
    try {
      await fn();
      DATA.clearCache();
      await DATA.loadConfig(true);
      DATA.resolveGesellschaft();
      APP.toast("Gespeichert");
      render(document.getElementById("main"));
      return true;
    } catch (e) {
      APP.toast(e.message, true);
      return false;
    }
  }

  /* ── Gemeinsame Formularbausteine ────────────────────────────────── */

  function fldDomains(value) {
    const opts = DATA.cfg.gesellschaften
      .map(g => `${g.Title} – ${g.Gesellschaft || ""}`).join(" · ");
    return `
      <div class="span2">
        <label class="f">Sichtbar für Domänen</label>
        <input type="text" data-f="Domains" value="${esc(value || "*")}" placeholder="* (alle) oder dihag.com;gienanth.de">
        <p class="hint" style="margin-top:6px">„<b>*</b>“ = alle Mitarbeitenden. Mehrere Domänen mit Semikolon trennen.
          ${opts ? "Bekannt: " + esc(opts) : ""}</p>
      </div>`;
  }

  const fldRolle = value => `
    <div>
      <label class="f">Mindestrolle</label>
      <select data-f="MinRolle">
        ${ROLLEN.map(r => `<option value="${r}"${(value || "viewer") === r ? " selected" : ""}>${r}</option>`).join("")}
      </select>
    </div>`;

  const fldAktiv = value => `
    <div style="align-self:end">
      <label class="chk"><input type="checkbox" data-f="Aktiv"${value !== false ? " checked" : ""}> Aktiv</label>
    </div>`;

  /** Liest alle [data-f]-Felder eines Containers aus. */
  function readForm(root) {
    const out = {};
    root.querySelectorAll("[data-f]").forEach(el => {
      const k = el.dataset.f;
      if (el.type === "checkbox") out[k] = el.checked;
      else if (el.type === "number") out[k] = el.value === "" ? null : Number(el.value);
      else out[k] = el.value.trim() === "" ? null : el.value.trim();
    });
    return out;
  }

  /* ── 1 · Gesellschaften / Domänen ────────────────────────────────── */

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
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Domäne</th><th>Gesellschaft</th><th>Kürzel</th><th>Farbe</th>
            <th>Standard</th><th>Sort.</th><th></th></tr></thead>
          <tbody>${rows.map(g => `
            <tr class="${g.Aktiv === false ? "off" : ""}">
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
            `<tr><td colspan="7" style="color:var(--muted)">Noch keine Zuordnung angelegt.</td></tr>`}
          </tbody></table></div>
      </div>`;

    $("gNew").onclick = () => editGes(null);
    $("gScan").onclick = scanDomains;
    host.querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => editGes(rows.find(r => r.id === b.dataset.edit)));
    host.querySelectorAll("[data-del]").forEach(b =>
      b.onclick = () => delRow(name, b.dataset.del, "Gesellschaft"));
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

  /* ── 2 · Reiter ──────────────────────────────────────────────────── */

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

  /* ── 3 · Kacheln ─────────────────────────────────────────────────── */

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
    $("kFil").onchange = e => { kFilter = e.target.value; render(document.getElementById("main")); };
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

  /* ── Löschen ─────────────────────────────────────────────────────── */

  function delRow(listName, id, label) {
    APP.modal({
      title: label + " löschen",
      bodyHtml: `<p>Soll dieser Eintrag wirklich gelöscht werden? Das lässt sich hier nicht rückgängig machen
        (in SharePoint liegt der Eintrag anschließend im Papierkorb der Site).</p>`,
      okText: "Löschen",
      onOk: () => save(() => GRAPH.deleteItem(C.configSite, listName, id))
    });
  }

  /* ── 4 · Berechtigungen ──────────────────────────────────────────── */

  async function viewRechte(host) {
    host.innerHTML = `
      <div class="card">
        <h4>🔑 Berechtigungen</h4>
        <p class="hint">Alle Personen im Tenant sehen die Seite automatisch mit der Rolle
          <b>viewer</b>. Höhere Rollen werden in der zentralen Liste
          <b>${esc(C.permList)}</b> auf <b>${esc(C.permSite)}</b> gepflegt – dieselbe Liste,
          die auch das Organigramm verwendet. Ein Eintrag mit App „<b>*</b>“ gilt für alle Apps.</p>
        <div class="row" style="margin-bottom:14px">
          <button class="btn" id="pNew">+ Rolle vergeben</button>
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

    try {
      const rows = (await GRAPH.listItems(C.permSite, C.permList, ["Title", "UserEmail", "App", "Role"])) || [];
      const mine = rows.filter(r => r.App === C.appKey || r.App === "*")
        .sort((a, b) => (a.UserEmail || "").localeCompare(b.UserEmail || ""));
      $("pBox").innerHTML = `
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>E-Mail</th><th>App</th><th>Rolle</th><th></th></tr></thead>
          <tbody>${mine.map(r => `
            <tr><td>${esc(r.UserEmail || "")}</td>
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
          APP.toast("Entfernt"); render(document.getElementById("main"));
        } catch (e) { APP.toast(e.message, true); }
      });
    } catch (e) {
      $("pBox").innerHTML = `<div class="err">Rechteliste nicht lesbar: ${esc(e.message)}</div>`;
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
        <b>${esc(C.appKey)}</b> angelegt.</p>`,
      onOk: async bg => {
        const f = readForm(bg);
        if (!f.UserEmail || !f.UserEmail.includes("@")) { APP.toast("Bitte eine gültige E-Mail eingeben.", true); return false; }
        try {
          await GRAPH.addItem(C.permSite, C.permList, {
            Title: f.UserEmail, UserEmail: f.UserEmail.toLowerCase(), App: C.appKey, Role: f.Role
          });
          APP.toast("Rolle vergeben");
          render(document.getElementById("main"));
        } catch (e) { APP.toast(e.message, true); return false; }
      }
    });
  }

  /* ── 5 · Einrichtung ─────────────────────────────────────────────── */

  function viewSetup(host) {
    const missing = DATA.cfg.missing;
    host.innerHTML = `
      <div class="card">
        <h4>🛠️ Einrichtung</h4>
        ${missing.length
          ? `<div class="warn">Es fehlen noch Listen: <b>${missing.map(esc).join(", ")}</b>.</div>`
          : `<div class="ok">Alle Konfigurationslisten sind vorhanden.</div>`}
        <p class="hint">Die Konfiguration liegt in drei SharePoint-Listen auf
          <b>${esc(C.configSite)}</b>. Der Knopf legt fehlende Listen samt Spalten an –
          dafür braucht Ihr Konto das Recht, auf dieser Site Listen zu erstellen.
          Bereits vorhandene Einträge werden nie überschrieben.</p>
        <div class="row">
          <button class="btn" id="sLists">1 · Listen anlegen</button>
          <button class="btn sec" id="sGes">2 · Gesellschaften aus Tenant übernehmen</button>
          <button class="btn sec" id="sCont">3 · Startinhalte anlegen</button>
          <button class="btn sec" id="sReload">🔄 Neu laden</button>
        </div>
        <pre id="sLog" style="margin-top:16px;background:#f7fafd;border:1px solid var(--border);
          border-radius:8px;padding:12px;font-size:12.5px;max-height:260px;overflow:auto"
          hidden></pre>
      </div>
      <div class="card">
        <h4>🩺 Diagnose</h4>
        <p class="hint">Scheitert das Anlegen mit <b>Access denied</b>, liegt es an einer von zwei
          Ursachen: entweder fehlt dem Token die Berechtigung <b>Sites.ReadWrite.All</b>
          (App-Registrierung / Admin-Zustimmung), oder das angemeldete Konto darf auf
          <b>${esc(C.configSite)}</b> keine Listen anlegen (SharePoint-Websiteberechtigung).
          Die Diagnose unterscheidet beides.</p>
        <div class="row">
          <button class="btn" id="dRun">🔍 Diagnose starten</button>
          <button class="btn sec" id="dWrite">🧪 Schreibtest auf der Site</button>
        </div>
        <p class="hint" style="margin:12px 0 0">Der Schreibtest legt eine Hilfsliste
          <code>RUDJ_Schreibtest</code> an und löscht sie sofort wieder – er verändert nichts
          an Ihrer Konfiguration.</p>
        <pre id="dLog" style="margin-top:16px;background:#f7fafd;border:1px solid var(--border);
          border-radius:8px;padding:12px;font-size:12.5px;max-height:320px;overflow:auto"
          hidden></pre>
      </div>
      <div class="card">
        <h4>ℹ️ So funktioniert die Sichtbarkeit</h4>
        <ol style="font-size:14px;color:var(--text);padding-left:20px;line-height:1.8;margin:0">
          <li>Beim Anmelden liest die Seite die E-Mail-Domäne des Kontos
              (<code>${esc(DATA.ctx.domain || "–")}</code>).</li>
          <li>Die Domäne wird über <b>Gesellschaften &amp; Domänen</b> automatisch einer
              Gesellschaft zugeordnet – ohne Zutun der Nutzenden.</li>
          <li>Zusätzlich wird die Rolle aus <b>${esc(C.permList)}</b> ermittelt
              (Standard: <code>viewer</code>).</li>
          <li>Ein <b>Reiter</b> erscheint nur, wenn Domäne und Rolle passen.
              Ist kein Reiter sichtbar, sieht die Person auch keine Navigation.</li>
          <li>Innerhalb eines Reiters wird jede <b>Kachel</b> noch einmal einzeln geprüft –
              zusätzlich gegen den Gültigkeitszeitraum.</li>
        </ol>
      </div>`;

    const log = m => { const p = $("sLog"); p.hidden = false; p.textContent += m + "\n"; p.scrollTop = p.scrollHeight; };
    const run = async (btn, fn, done) => {
      btn.disabled = true;
      try { await fn(); log("✓ " + done); DATA.clearCache(); await DATA.loadConfig(true); }
      catch (e) {
        log("✗ " + (e.detail || e.message));
        if (e.status === 403) log("  → Ursache eingrenzen: Karte „🩺 Diagnose“ unten.");
        APP.toast(e.message, true);
      }
      finally { btn.disabled = false; }
    };

    $("sLists").onclick = e => run(e.target, () => SEED.ensureLists(log), "Listen geprüft/angelegt.");
    $("sGes").onclick   = e => run(e.target, () => SEED.seedGesellschaften(log), "Gesellschaften übernommen.");
    $("sCont").onclick  = e => run(e.target, () => SEED.seedContent(log), "Startinhalte angelegt.");
    $("sReload").onclick = () => APP.reload();

    const dlog = m => { const p = $("dLog"); p.hidden = false; p.textContent += m + "\n"; p.scrollTop = p.scrollHeight; };
    $("dRun").onclick   = e => diagnose(e.target, dlog);
    $("dWrite").onclick = e => writeTest(e.target, dlog);
  }

  /** Nur-Lese-Diagnose: Konto, Token-Berechtigungen, Site- und Listenzugriff. */
  async function diagnose(btn, log) {
    btn.disabled = true;
    $("dLog").textContent = "";
    try {
      log("── Konto ──────────────────────────────");
      log("Angemeldet:      " + DATA.ctx.email);
      log("Ermittelte Rolle: " + DATA.ctx.role);

      log("\n── Token ──────────────────────────────");
      const ti = AUTH.tokenInfo();
      if (!ti) {
        log("Token nicht lesbar – bitte neu anmelden.");
      } else {
        log("App-Registrierung: " + (ti.appId || "?"));
        log("Gültig bis:        " + (ti.exp ? ti.exp.toLocaleString("de-DE") : "?"));
        log("Berechtigungen:    " + (ti.scopes.join(", ") || "(keine)"));
        const fehlt = C.scopes.filter(s => !ti.scopes.includes(s));
        if (fehlt.length) {
          log("⚠ NICHT im Token:  " + fehlt.join(", "));
          if (fehlt.includes("Sites.ReadWrite.All"))
            log("  → Das ist die Ursache. Sites.ReadWrite.All muss an der App-Registrierung\n"
              + "    " + (ti.appId || C.clientId) + " als delegierte Berechtigung stehen\n"
              + "    UND per Administratorzustimmung erteilt sein. Danach abmelden und neu anmelden.");
        } else {
          log("✓ Alle benötigten Berechtigungen sind im Token enthalten.");
        }
      }

      log("\n── SharePoint ─────────────────────────");
      let sid = null;
      try {
        const s = await GRAPH.call("/sites/" + C.configSite);
        sid = s.id;
        log("✓ Site lesbar: " + s.webUrl);
      } catch (e) {
        log("✗ Site nicht lesbar: " + (e.detail || e.message));
        return;
      }
      try {
        const l = await GRAPH.call(`/sites/${sid}/lists?$select=name&$top=200`);
        log("✓ Listen der Site lesbar (" + (l.value || []).length + " Stück).");
      } catch (e) {
        log("✗ Listen nicht lesbar: " + (e.detail || e.message));
      }
      let alleDa = true;
      for (const [key, name] of Object.entries(C.lists)) {
        try {
          await GRAPH.call(`/sites/${sid}/lists/${encodeURIComponent(name)}`);
        } catch (e) {
          alleDa = false;
          log((e.status === 404 ? "· " : "✗ ") + name + " – "
            + (e.status === 404 ? "fehlt noch (muss angelegt werden)" : (e.detail || e.message)));
          continue;
        }
        log("✓ " + name + " – vorhanden");
        // Spalten prüfen. Abweichende interne Namen (z. B. Typ → Typ2) werden
        // von der App automatisch aufgelöst und hier nur gemeldet.
        try {
          const erwartet = SEED.EXPECTED[key] || [];
          const map = await GRAPH.fieldMap(C.configSite, name, erwartet, true);
          const fehlt    = erwartet.filter(n => !map[n]);
          const abweichend = erwartet.filter(n => map[n] && map[n] !== n);

          if (fehlt.length) {
            alleDa = false;
            log("   ⚠ fehlende Spalten: " + fehlt.join(", "));
          }
          if (abweichend.length) {
            for (const n of abweichend) log(`   · ${n} heißt intern „${map[n]}“ – wird automatisch berücksichtigt`);
          }
          if (!fehlt.length) {
            log("   ✓ alle " + erwartet.length + " Spalten nutzbar"
              + (abweichend.length ? ` (${abweichend.length} mit abweichendem internen Namen)` : ""));
          }
        } catch (e) {
          // Ohne Spaltenliste ist Vollständigkeit nicht belegt – nicht grün melden.
          alleDa = false;
          log("   ⚠ Spalten nicht lesbar: " + (e.detail || e.message));
        }
      }

      log("");
      if (alleDa) {
        log("Alles vollständig. Weiter mit „2 · Gesellschaften aus Tenant übernehmen“");
        log("und „3 · Startinhalte anlegen“ – beide brauchen nur Schreibrechte auf");
        log("Listeneinträge, keinen Vollzugriff auf die Website.");
      } else {
        log("Zum Anlegen per Hand: LISTEN-ANLEGEN.md im Repository nennt alle Spalten");
        log("mit exaktem Namen und Typ. Danach diese Diagnose erneut ausführen.");
        log("Alternativ zeigt „🧪 Schreibtest auf der Site“, ob die App die Listen");
        log("selbst anlegen darf.");
      }
    } catch (e) {
      log("✗ Unerwarteter Fehler: " + (e.detail || e.message));
    } finally {
      btn.disabled = false;
    }
  }

  /** Legt eine Hilfsliste an und entfernt sie sofort wieder. */
  async function writeTest(btn, log) {
    const probe = "RUDJ_Schreibtest";
    btn.disabled = true;
    try {
      log("\n── Schreibtest ────────────────────────");
      const sid = await GRAPH.siteId(C.configSite);

      let existing = null;
      try { existing = await GRAPH.call(`/sites/${sid}/lists/${probe}`); } catch {}
      if (existing) {
        log("· Hilfsliste aus einem früheren Test gefunden – wird aufgeräumt.");
        try { await GRAPH.call(`/sites/${sid}/lists/${existing.id}`, { method: "DELETE" }); }
        catch (e) { log("  (Aufräumen fehlgeschlagen: " + (e.detail || e.message) + ")"); }
      }

      let created;
      try {
        created = await GRAPH.call(`/sites/${sid}/lists`, {
          method: "POST",
          body: JSON.stringify({ displayName: probe, list: { template: "genericList" } })
        });
        log("✓ Liste anlegen hat funktioniert.");
      } catch (e) {
        log("✗ Liste anlegen fehlgeschlagen: " + (e.detail || e.message));
        if (e.status === 403) {
          log("\nDamit ist die Ursache eingegrenzt:");
          log("Das Token ist in Ordnung, aber " + DATA.ctx.email);
          log("darf auf " + C.configSite);
          log("keine Listen anlegen (SharePoint-Websiteberechtigung).");
          log("\nDas betrifft nur diesen einen Einrichtungsschritt. Sobald die Listen");
          log("existieren, genügen die vorhandenen Rechte für den Betrieb der App.");
          log("\nDrei Wege – einer reicht:");
          log("a) Konto auf der Site zum Websitebesitzer machen (Websiteberechtigungen)");
          log("   und danach hier „1 · Listen anlegen“ erneut ausführen.");
          log("b) setup-rundumdenjob.ps1 mit einem SharePoint- oder Global-Admin-Konto:");
          log("     Connect-MgGraph -Scopes \"Sites.Manage.All\",\"Sites.ReadWrite.All\"");
          log("     ./setup-rundumdenjob.ps1 -SkipAppReg");
          log("   Achtung: delegiertes PowerShell läuft als das angemeldete Konto und");
          log("   scheitert mit demselben 403, wenn dieses Konto keinen Vollzugriff hat.");
          log("c) App-only – unabhängig von Benutzer- und Websiteberechtigungen:");
          log("     ./setup-rundumdenjob.ps1 -AppOnly -SkipAppReg \\");
          log("       -AppClientId <App-Reg mit Sites.FullControl.All (Application)> \\");
          log("       -AppSecret (Read-Host -AsSecureString \"Client Secret\")");
        }
        return;
      }

      try {
        await GRAPH.call(`/sites/${sid}/lists/${created.id}`, { method: "DELETE" });
        log("✓ Hilfsliste wieder entfernt – Konfiguration unverändert.");
      } catch (e) {
        log("⚠ Hilfsliste konnte nicht entfernt werden: " + (e.detail || e.message));
        log("  Bitte die Liste „" + probe + "“ in SharePoint manuell löschen.");
      }
      log("\nErgebnis: Die Rechte reichen aus. „1 · Listen anlegen“ sollte jetzt durchlaufen.");
    } catch (e) {
      log("✗ Unerwarteter Fehler: " + (e.detail || e.message));
    } finally {
      btn.disabled = false;
    }
  }

  return { render };
})();
