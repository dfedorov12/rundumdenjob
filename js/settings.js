"use strict";

/* Einstellungen (nur Rolle "admin") - Rahmen und gemeinsame Bausteine.

   Die einzelnen Unterreiter liegen in eigenen Dateien (set-*.js) und
   registrieren sich in SETTINGS_VIEWS. Gemeinsame Helfer stehen in SETUI.
   Vorher lag alles in einer Datei mit 44 KB. */

const SETTINGS_VIEWS = {};

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
    ["impexp",         "📦 Import / Export"],
    ["diagnose",       "🩺 Diagnose"]
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
    (SETTINGS_VIEWS[sub] || SETTINGS_VIEWS.gesellschaften)($("setBody"));
  }

  const listMissing = name => DATA.cfg.missing.includes(name);

  function missingBanner(name) {
    return `<div class="warn">Die SharePoint-Liste <b>${esc(name)}</b> existiert noch nicht.
      Anlegen nach <b>LISTEN-ANLEGEN.md</b>; die Diagnose prüft anschließend Listen und Spalten.</div>`;
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

  /* Gemeinsame Bausteine für die Unterreiter in set-*.js. */
  const SETUI = {
    C, $, esc, ROLLEN,
    listMissing, missingBanner, save, delRow,
    fldDomains, fldRolle, fldAktiv, readForm,
    /** Ganzen Einstellungsbereich neu zeichnen (nach dem Speichern). */
    neu: () => render(document.getElementById("main"))
  };
  window.SETUI = SETUI;

  return { render };
})();
