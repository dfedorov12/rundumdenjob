"use strict";

/* Import und Export von Benutzerdaten aus Entra ID (Azure AD).
   Zweck: On-/Offboarding und allgemeine Migration.

   Grenzen, bewusst gesetzt:
   - Es werden KEINE Konten angelegt und KEINE Kennwörter verarbeitet. Für
     Neuanlagen erzeugt die App die offizielle Entra-Massenimport-CSV, die im
     Portal hochgeladen wird – dort vergibt Entra das Startkennwort.
   - Geschrieben wird nur eine feste Liste von Profilfeldern (WRITABLE).
     userPrincipalName, mail, Lizenzen und Gruppen bleiben unberührt.
   - Schreiben braucht User.ReadWrite.All. Diese Berechtigung steht absichtlich
     nicht in RUDJ_CONFIG.scopes, sondern wird bei Bedarf einzeln angefordert. */

const IMPEXP = (() => {

  const C = RUDJ_CONFIG;
  const $ = id => document.getElementById(id);
  const esc = s => APP.esc(s);

  const WRITE_SCOPE = "User.ReadWrite.All";
  const LIFECYCLE_SCOPE = "User-LifeCycleInfo.ReadWrite.All";

  /* ── Feldkatalog ───────────────────────────────────────────────────
     graph = Name im $select von /users (leer = wird eigens aufgelöst)
     sets  = in welchen Vorlagen das Feld steckt
     write = per Import beschreibbar
     perm  = braucht eine zusätzliche Berechtigung                      */

  const FIELDS = [
    // Kennung
    { key: "id",                     label: "Objekt-ID",            graph: "id",                     sets: ["mig"] },
    { key: "userPrincipalName",      label: "Anmeldename (UPN)",    graph: "userPrincipalName",      sets: ["on", "off", "mig"] },
    { key: "mail",                   label: "E-Mail",               graph: "mail",                   sets: ["on", "off", "mig"] },
    { key: "displayName",            label: "Anzeigename",          graph: "displayName",            sets: ["on", "off", "mig"], write: true },
    { key: "givenName",              label: "Vorname",              graph: "givenName",              sets: ["on", "mig"], write: true },
    { key: "surname",                label: "Nachname",             graph: "surname",                sets: ["on", "mig"], write: true },
    { key: "accountEnabled",         label: "Konto aktiv",          graph: "accountEnabled",         sets: ["on", "off", "mig"], write: true },
    { key: "userType",               label: "Kontotyp",             graph: "userType",               sets: ["mig"] },

    // Beschäftigung
    { key: "jobTitle",               label: "Position",             graph: "jobTitle",               sets: ["on", "off", "mig"], write: true },
    { key: "department",             label: "Abteilung",            graph: "department",             sets: ["on", "off", "mig"], write: true },
    { key: "companyName",            label: "Gesellschaft",         graph: "companyName",            sets: ["on", "off", "mig"], write: true },
    { key: "employeeId",             label: "Personalnummer",       graph: "employeeId",             sets: ["on", "off", "mig"], write: true },
    { key: "employeeType",           label: "Beschäftigungsart",    graph: "employeeType",           sets: ["on", "mig"], write: true },
    { key: "employeeHireDate",       label: "Eintrittsdatum",       graph: "employeeHireDate",       sets: ["on", "mig"], write: true },
    { key: "employeeLeaveDateTime",  label: "Austrittsdatum",       graph: "employeeLeaveDateTime",  sets: ["off", "mig"], write: true,
      perm: "User-LifeCycleInfo.Read.All" },
    { key: "officeLocation",         label: "Standort / Büro",      graph: "officeLocation",         sets: ["on", "off", "mig"], write: true },
    { key: "managerUPN",             label: "Führungskraft (UPN)",  graph: "",                       sets: ["on", "off", "mig"], write: true },
    { key: "managerName",            label: "Führungskraft (Name)", graph: "",                       sets: ["on", "off", "mig"] },

    // Kontakt
    { key: "mobilePhone",            label: "Mobil",                graph: "mobilePhone",            sets: ["on", "mig"], write: true },
    { key: "businessPhones",         label: "Telefon",              graph: "businessPhones",         sets: ["on", "mig"], write: true },
    { key: "streetAddress",          label: "Straße",               graph: "streetAddress",          sets: ["mig"], write: true },
    { key: "postalCode",             label: "PLZ",                  graph: "postalCode",             sets: ["mig"], write: true },
    { key: "city",                   label: "Ort",                  graph: "city",                   sets: ["mig"], write: true },
    { key: "state",                  label: "Bundesland",           graph: "state",                  sets: ["mig"], write: true },
    { key: "country",                label: "Land",                 graph: "country",                sets: ["mig"], write: true },
    { key: "otherMails",             label: "Weitere E-Mails",      graph: "otherMails",             sets: ["mig"], write: true },

    // Technisch
    { key: "usageLocation",          label: "Nutzungsstandort",     graph: "usageLocation",          sets: ["on", "mig"], write: true },
    { key: "preferredLanguage",      label: "Sprache",              graph: "preferredLanguage",      sets: ["on", "mig"], write: true },
    { key: "createdDateTime",        label: "Angelegt am",          graph: "createdDateTime",        sets: ["off", "mig"] },
    { key: "onPremisesSyncEnabled",  label: "AD-synchronisiert",    graph: "onPremisesSyncEnabled",  sets: ["off", "mig"] },
    { key: "onPremisesSamAccountName", label: "SAM-Konto",          graph: "onPremisesSamAccountName", sets: ["mig"] },
    { key: "proxyAddresses",         label: "Proxy-Adressen",       graph: "proxyAddresses",         sets: ["mig"] },
    { key: "lastPasswordChange",     label: "Kennwort geändert",    graph: "lastPasswordChangeDateTime", sets: ["off", "mig"] },

    // Zusatzabfragen / Zusatzrechte
    { key: "licenses",               label: "Lizenzen",             graph: "assignedLicenses",       sets: ["off", "mig"] },
    { key: "lastSignIn",             label: "Letzte Anmeldung",     graph: "signInActivity",         sets: ["off", "mig"],
      perm: "AuditLog.Read.All" },
    { key: "groups",                 label: "Gruppen",              graph: "",                       sets: ["off", "mig"], slow: true }
  ];

  const SETS = {
    on:  "Onboarding – Stammdaten für neue Mitarbeitende",
    off: "Offboarding – was beim Austritt geprüft werden muss",
    mig: "Migration – alle verfügbaren Felder"
  };

  const byKey = k => FIELDS.find(f => f.key === k);

  /* ── Zustand ─────────────────────────────────────────────────────── */

  let auswahl = new Set(FIELDS.filter(f => f.sets.includes("on")).map(f => f.key));
  let vorlage = "on";
  let importZeilen = null;   // geparste Datei
  let importPlan   = null;   // ausgewerteter Abgleich

  const tokenScopes = () => AUTH.tokenInfo()?.scopes || [];
  const hatSchreibrecht = () => tokenScopes().includes(WRITE_SCOPE);

  /** Zusatz-Berechtigungen, die die aktuell gewählten Felder brauchen und die
   *  im Zugriffstoken fehlen.
   *
   *  Wichtig: In Entra erteilte Berechtigungen wirken erst, wenn sie auch
   *  angefordert werden – sie stehen sonst nicht im Token, und Graph antwortet
   *  mit „The principal does not have required permission(s)“. Sie stehen
   *  absichtlich nicht in RUDJ_CONFIG.scopes, weil sie nur hier gebraucht
   *  werden und sonst in jedem Token jeder Anmeldung landen würden. */
  function fehlendeZusatzrechte(keys = [...auswahl]) {
    const da = tokenScopes();
    const noetig = new Set(
      keys.map(byKey).filter(f => f && f.perm).map(f => f.perm));
    return [...noetig].filter(s => !da.includes(s));
  }

  /* ── CSV ─────────────────────────────────────────────────────────── */

  const CSV_SEP = ";";   // deutsches Excel

  function toCsv(kopf, zeilen) {
    const feld = v => {
      if (v === null || v === undefined) return "";
      let s = Array.isArray(v) ? v.join(" | ") : String(v);
      if (s.includes('"') || s.includes(CSV_SEP) || /[\r\n]/.test(s)) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    return "﻿"      // BOM, damit Excel UTF-8 erkennt
      + [kopf.map(feld).join(CSV_SEP), ...zeilen.map(z => z.map(feld).join(CSV_SEP))].join("\r\n");
  }

  /** Robuster CSV-Parser: erkennt ; oder , als Trenner, versteht
   *  Anführungszeichen samt verdoppelten Zeichen und CRLF/LF. */
  function fromCsv(text) {
    const s = String(text).replace(/^﻿/, "");
    const erste = s.split(/\r?\n/)[0] || "";
    const sep = (erste.split(";").length > erste.split(",").length) ? ";" : ",";
    const rows = [];
    let row = [], feld = "", inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { feld += '"'; i++; }
          else inQ = false;
        } else feld += c;
        continue;
      }
      if (c === '"') { inQ = true; continue; }
      if (c === sep) { row.push(feld); feld = ""; continue; }
      if (c === "\n") { row.push(feld); rows.push(row); row = []; feld = ""; continue; }
      if (c === "\r") continue;
      feld += c;
    }
    if (feld !== "" || row.length) { row.push(feld); rows.push(row); }
    const nichtLeer = rows.filter(r => r.some(z => String(z).trim() !== ""));
    if (!nichtLeer.length) return { kopf: [], zeilen: [] };
    const kopf = nichtLeer[0].map(h => h.trim());
    return {
      kopf,
      zeilen: nichtLeer.slice(1).map(r => {
        const o = {};
        kopf.forEach((h, i) => o[h] = String(r[i] ?? "").trim());
        return o;
      })
    };
  }

  function download(name, inhalt, typ = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const heute = () => new Date().toISOString().slice(0, 10);

  /* ── Export ──────────────────────────────────────────────────────── */

  /** Holt die Benutzer mit den gewählten Feldern. Fällt automatisch zurück,
   *  wenn Felder eine Berechtigung brauchen, die dem Token fehlt – dann
   *  bleibt nur dieses Feld leer statt den ganzen Export zu verlieren. */
  async function ladeBenutzer(keys, opt, log) {
    const gewaehlt = keys.map(byKey).filter(Boolean);
    const brauchtManager = keys.includes("managerUPN") || keys.includes("managerName");
    const select = [...new Set([
      "id", "displayName", "userPrincipalName", "accountEnabled", "userType",
      ...gewaehlt.map(f => f.graph).filter(Boolean)
    ])];

    const bauUrl = sel =>
      "/users?$select=" + sel.join(",")
      + (brauchtManager ? "&$expand=manager($select=id,displayName,userPrincipalName)" : "")
      + "&$top=999";

    let users = [];
    try {
      log("Benutzer werden gelesen …");
      users = await GRAPH.callAll(bauUrl(select), 40);
    } catch (e) {
      const heikel = gewaehlt.filter(f => f.perm).map(f => f.graph).filter(Boolean);
      const ohne = select.filter(s => !heikel.includes(s));
      if (heikel.length && ohne.length < select.length) {
        log("⚠ Abruf mit allen Feldern scheiterte: " + (e.detail || e.message));
        log("  Erneuter Versuch ohne: " + heikel.join(", "));
        users = await GRAPH.callAll(bauUrl(ohne), 40);
        for (const f of gewaehlt.filter(x => x.perm)) {
          log("  ⚠ „" + f.label + "“ bleibt leer – " + f.perm + " ist nicht im Token.");
        }
        const fehlt = fehlendeZusatzrechte(keys);
        if (fehlt.length) {
          log("");
          log("  Hinweis: Die Berechtigung kann in Entra durchaus erteilt sein – sie wirkt");
          log("  aber erst, wenn die Anmeldung sie auch anfordert. Im aktuellen Token fehlt:");
          log("    " + fehlt.join(", "));
          log("  Knopf „🔐 Zusatzrechte anfordern“ oben in dieser Karte holt sie nach.");
        }
      } else throw e;
    }
    log("✓ " + users.length + " Konten gelesen.");

    if (!opt.gaeste) {
      const vor = users.length;
      users = users.filter(u => (u.userType || "Member") !== "Guest");
      if (vor !== users.length) log("· " + (vor - users.length) + " Gastkonten übersprungen.");
    }
    if (opt.nurAktiv) {
      const vor = users.length;
      users = users.filter(u => u.accountEnabled !== false);
      log("· " + (vor - users.length) + " deaktivierte Konten übersprungen.");
    }
    if (opt.domains?.length) {
      const vor = users.length;
      const set = new Set(opt.domains);
      users = users.filter(u => set.has(DATA.domainOf(u.mail || u.userPrincipalName)));
      log("· Domänenfilter: " + users.length + " von " + vor + " Konten übrig.");
    }

    // Lizenz-SKUs in lesbare Namen übersetzen
    const skuNamen = {};
    if (keys.includes("licenses")) {
      try {
        const skus = await GRAPH.call("/subscribedSkus?$select=skuId,skuPartNumber");
        for (const s of (skus.value || [])) skuNamen[s.skuId] = s.skuPartNumber;
      } catch { log("⚠ Lizenznamen nicht lesbar – es werden SKU-IDs ausgegeben."); }
    }

    // Gruppen einzeln nachladen (nur auf Wunsch, ein Aufruf je Konto)
    if (keys.includes("groups")) {
      log("Gruppen werden geladen (ein Aufruf je Konto) …");
      let i = 0;
      for (const u of users) {
        try {
          const g = await GRAPH.call(`/users/${u.id}/memberOf?$select=displayName&$top=100`);
          u.__groups = (g.value || []).map(x => x.displayName).filter(Boolean);
        } catch { u.__groups = []; }
        if (++i % 25 === 0) log("  " + i + " / " + users.length);
      }
      log("✓ Gruppen geladen.");
    }

    return users.map(u => zeileBauen(u, keys, skuNamen));
  }

  function zeileBauen(u, keys, skuNamen) {
    const wert = key => {
      switch (key) {
        case "managerUPN":  return u.manager?.userPrincipalName || "";
        case "managerName": return u.manager?.displayName || "";
        case "licenses":    return (u.assignedLicenses || []).map(l => skuNamen[l.skuId] || l.skuId);
        case "lastSignIn":  return u.signInActivity?.lastSignInDateTime || "";
        case "groups":      return u.__groups || [];
        case "employeeHireDate":
        case "employeeLeaveDateTime":
        case "createdDateTime":
        case "lastPasswordChange": {
          const v = u[byKey(key).graph];
          return v ? String(v).slice(0, 10) : "";
        }
        default: {
          const g = byKey(key)?.graph;
          const v = g ? u[g] : "";
          return v === null || v === undefined ? "" : v;
        }
      }
    };
    return keys.map(wert);
  }

  async function exportieren(format, log) {
    const keys = FIELDS.filter(f => auswahl.has(f.key)).map(f => f.key);
    if (!keys.length) { APP.toast("Bitte mindestens ein Feld wählen.", true); return; }
    const opt = {
      nurAktiv: $("ieNurAktiv").checked,
      gaeste:   $("ieGaeste").checked,
      domains:  $("ieNurDomains").checked
        ? DATA.cfg.gesellschaften.filter(g => g.Aktiv !== false)
            .map(g => String(g.Title || "").toLowerCase())
        : []
    };
    const zeilen = await ladeBenutzer(keys, opt, log);
    const kopf = keys.map(k => byKey(k).label);
    const name = `entra-${vorlage}-${heute()}`;

    if (format === "json") {
      const objekte = zeilen.map(z => Object.fromEntries(keys.map((k, i) => [k, z[i]])));
      download(name + ".json", JSON.stringify(objekte, null, 2), "application/json");
    } else {
      download(name + ".csv", toCsv(kopf, zeilen));
    }
    log("✓ " + zeilen.length + " Zeilen als " + format.toUpperCase() + " heruntergeladen.");
  }

  /* ── Import: Datei auswerten ─────────────────────────────────────── */

  /** Ordnet Spaltenüberschriften den Feldschlüsseln zu – akzeptiert die
   *  technischen Schlüssel und die deutschen Bezeichnungen. */
  function spaltenZuordnen(kopf) {
    const norm = s => String(s).toLowerCase().replace(/\s+/g, "");
    const map = {};
    for (const h of kopf) {
      const n = norm(h);
      const f = FIELDS.find(x => norm(x.key) === n || norm(x.label) === n);
      if (f) map[h] = f.key;
    }
    return map;
  }

  const KENNUNG = ["userPrincipalName", "id", "employeeId", "mail"];

  async function importPruefen(log) {
    const { kopf, zeilen } = importZeilen;
    const map = spaltenZuordnen(kopf);
    const erkannt = Object.values(map);
    const unbekannt = kopf.filter(h => !map[h]);
    const schluessel = KENNUNG.find(k => erkannt.includes(k));

    log("Spalten erkannt: " + (erkannt.map(k => byKey(k).label).join(", ") || "keine"));
    if (unbekannt.length) log("· Ignoriert: " + unbekannt.join(", "));
    if (!schluessel) {
      log("✗ Keine Kennungsspalte gefunden. Nötig ist eine von: "
        + KENNUNG.map(k => byKey(k).label).join(", "));
      return null;
    }
    log("Abgleich über: " + byKey(schluessel).label);

    const schreibbar = erkannt.filter(k => byKey(k).write);
    const nurLesen = erkannt.filter(k => !byKey(k).write && !KENNUNG.includes(k));
    if (nurLesen.length) {
      log("· Nicht beschreibbar, wird ignoriert: " + nurLesen.map(k => byKey(k).label).join(", "));
    }
    if (!schreibbar.length) { log("✗ Keine beschreibbaren Felder in der Datei."); return null; }

    log("Vorhandene Konten werden geladen …");
    const select = [...new Set(["id", "displayName", "userPrincipalName", "mail", "employeeId",
      ...schreibbar.map(k => byKey(k).graph).filter(Boolean)])];
    const alle = await GRAPH.callAll(
      "/users?$select=" + select.join(",")
      + (schreibbar.includes("managerUPN") ? "&$expand=manager($select=id,userPrincipalName)" : "")
      + "&$top=999", 40);
    const index = new Map();
    for (const u of alle) {
      for (const k of KENNUNG) {
        const v = u[k];
        if (v) index.set(k + "|" + String(v).toLowerCase(), u);
      }
    }
    log("✓ " + alle.length + " Konten im Verzeichnis.");

    const kennSpalte = kopf.find(h => map[h] === schluessel);
    const plan = { schluessel, felder: schreibbar, aenderungen: [], unbekannteKonten: [], unveraendert: 0 };
    for (const z of zeilen) {
      const kennwert = z[kennSpalte];
      if (!kennwert) continue;
      const u = index.get(schluessel + "|" + String(kennwert).toLowerCase());
      if (!u) { plan.unbekannteKonten.push(kennwert); continue; }

      const diffs = [];
      for (const h of kopf) {
        const k = map[h];
        if (!k || !byKey(k).write) continue;
        const neu = normWert(k, z[h]);
        if (neu === undefined) continue;              // leere Zelle = nicht anfassen
        const alt = istWert(k, u);
        if (String(alt ?? "") !== String(neu ?? "")) diffs.push({ key: k, alt, neu });
      }
      if (diffs.length) plan.aenderungen.push({ user: u, diffs });
      else plan.unveraendert++;
    }

    log("");
    log("Ergebnis: " + plan.aenderungen.length + " Konten mit Änderungen, "
      + plan.unveraendert + " unverändert, " + plan.unbekannteKonten.length + " nicht gefunden.");
    if (plan.unbekannteKonten.length) {
      log("Nicht gefunden: " + plan.unbekannteKonten.slice(0, 15).join(", ")
        + (plan.unbekannteKonten.length > 15 ? " …" : ""));
      log("(Neuanlagen macht dieser Import nicht – dafür die Entra-Massenimport-Vorlage.)");
    }
    return plan;
  }

  /** Leere Zellen bedeuten „nicht ändern“ (undefined).
   *  Ein einzelnes „-“ leert das Feld (null). */
  function normWert(key, roh) {
    const s = String(roh ?? "").trim();
    if (s === "") return undefined;
    if (s === "-") return null;
    switch (key) {
      case "accountEnabled":
        return /^(ja|j|true|wahr|1|aktiv|enabled|yes)$/i.test(s);
      case "businessPhones":
      case "otherMails":
        return s.split(/[|;,]/).map(x => x.trim()).filter(Boolean);
      case "employeeHireDate":
      case "employeeLeaveDateTime": {
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const de  = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`;
        if (de)  return `${de[3]}-${String(de[2]).padStart(2, "0")}-${String(de[1]).padStart(2, "0")}T00:00:00Z`;
        return undefined;
      }
      default: return s;
    }
  }

  function istWert(key, u) {
    if (key === "managerUPN") return u.manager?.userPrincipalName || "";
    const v = u[byKey(key).graph];
    if (Array.isArray(v)) return v.join(" | ");
    if (key === "employeeHireDate" || key === "employeeLeaveDateTime") {
      return v ? String(v).slice(0, 10) + "T00:00:00Z" : "";
    }
    return v ?? "";
  }

  /* ── Import: ausführen ───────────────────────────────────────────── */

  async function importAusfuehren(log) {
    if (!importPlan?.aenderungen.length) { APP.toast("Nichts zu übernehmen.", true); return; }
    const mitStatus = $("ieMitStatus")?.checked;
    const fehler = [];
    let ok = 0;

    log("");
    log("── Übernahme ──────────────────────────");
    for (const { user, diffs } of importPlan.aenderungen) {
      const body = {};
      let managerUPN;
      for (const d of diffs) {
        if (d.key === "managerUPN") { managerUPN = d.neu; continue; }
        if (d.key === "accountEnabled" && !mitStatus) continue;
        body[byKey(d.key).graph] = d.neu;
      }
      try {
        if (Object.keys(body).length) {
          await GRAPH.call("/users/" + user.id, { method: "PATCH", body: JSON.stringify(body) });
        }
        if (managerUPN !== undefined) await managerSetzen(user, managerUPN);
        ok++;
        log("✓ " + user.userPrincipalName + " – " + diffs.map(d => byKey(d.key).label).join(", "));
      } catch (e) {
        fehler.push({ upn: user.userPrincipalName, fehler: e.detail || e.message });
        log("✗ " + user.userPrincipalName + " – " + (e.detail || e.message));
      }
    }
    log("");
    log("Fertig: " + ok + " aktualisiert, " + fehler.length + " Fehler.");
    if (fehler.length) {
      download("import-fehler-" + heute() + ".csv",
        toCsv(["Anmeldename", "Fehler"], fehler.map(f => [f.upn, f.fehler])));
      log("Fehlerliste als CSV heruntergeladen.");
    }
    importPlan = null;
  }

  async function managerSetzen(user, upn) {
    if (upn === null || upn === "") {
      await GRAPH.call(`/users/${user.id}/manager/$ref`, { method: "DELETE" });
      return;
    }
    const r = await GRAPH.call("/users?$select=id&$filter=userPrincipalName eq '"
      + String(upn).replace(/'/g, "''") + "'");
    const m = (r.value || [])[0];
    if (!m) throw new Error("Führungskraft „" + upn + "“ nicht gefunden");
    await GRAPH.call(`/users/${user.id}/manager/$ref`, {
      method: "PUT",
      body: JSON.stringify({ "@odata.id": "https://graph.microsoft.com/v1.0/users/" + m.id })
    });
  }

  /* ── Vorlagen ────────────────────────────────────────────────────── */

  function vorlageLeer() {
    const keys = FIELDS.filter(f => auswahl.has(f.key)).map(f => f.key);
    if (!keys.includes("userPrincipalName")) keys.unshift("userPrincipalName");
    download(`vorlage-${vorlage}-${heute()}.csv`, toCsv(keys.map(k => byKey(k).label), []));
  }

  /** Offizielles Format für „Benutzer per Massenvorgang erstellen“ im
   *  Entra-Portal. Das Startkennwort vergibt Entra, nicht diese App. */
  function entraMassenimport() {
    const kopf = [
      "Name [displayName] Required",
      "User principal name [userPrincipalName] Required",
      "Initial password [passwordProfile] Required",
      "Block sign in (Yes/No) [accountEnabled] Required",
      "First name [givenName]",
      "Last name [surname]",
      "Job title [jobTitle]",
      "Department [department]",
      "Employee ID [employeeId]",
      "Office location [physicalDeliveryOfficeName]",
      "Mobile phone [mobile]",
      "Usage location [usageLocation]"
    ];
    const beispiel = ["Erika Mustermann", "erika.mustermann@dihag.com", "", "No",
      "Erika", "Mustermann", "Sachbearbeiterin", "Einkauf", "10042",
      "Verwaltung", "+49 151 0000000", "DE"];
    download("entra-massenimport-vorlage-" + heute() + ".csv", toCsv(kopf, [beispiel]));
  }

  /* ── Portalkonfiguration ─────────────────────────────────────────── */

  const ohneId = o => {
    const k = { ...o };
    delete k.id;
    for (const f of Object.keys(k)) if (f.startsWith("@") || f === "ContentType") delete k[f];
    return k;
  };

  function konfigExport() {
    download("rundumdenjob-konfiguration-" + heute() + ".json", JSON.stringify({
      exportiert: new Date().toISOString(),
      von: DATA.ctx.email,
      site: C.configSite,
      gesellschaften: DATA.cfg.gesellschaften.map(ohneId),
      reiter:         DATA.cfg.reiter.map(ohneId),
      kacheln:        DATA.cfg.kacheln.map(ohneId)
    }, null, 2), "application/json");
  }

  async function konfigImport(text, log) {
    let d;
    try { d = JSON.parse(text); } catch { log("✗ Keine gültige JSON-Datei."); return; }
    const teile = [
      ["gesellschaften", C.lists.gesellschaften, SEED.EXPECTED.gesellschaften, "Title"],
      ["reiter",         C.lists.reiter,         SEED.EXPECTED.reiter,         "ReiterKey"],
      ["kacheln",        C.lists.kacheln,        SEED.EXPECTED.kacheln,        null]
    ];
    let neu = 0, uebersprungen = 0;
    for (const [key, liste, erwartet, unique] of teile) {
      const rows = d[key];
      if (!Array.isArray(rows)) continue;
      const vorhanden = (await GRAPH.listItems(C.configSite, liste, erwartet)) || [];
      const kennung = r => unique
        ? String(r[unique] || "").toLowerCase()
        : String((r.ReiterKey || "") + "|" + (r.Title || "")).toLowerCase();
      const schluessel = new Set(vorhanden.map(kennung));
      for (const r of rows) {
        if (schluessel.has(kennung(r))) { uebersprungen++; continue; }
        const felder = {};
        for (const f of erwartet) if (f in r) felder[f] = r[f];
        await GRAPH.addItem(C.configSite, liste, felder);
        neu++;
        log("+ " + liste + ": " + (r.Title || kennung(r)));
      }
    }
    log("");
    log("✓ " + neu + " Einträge angelegt, " + uebersprungen + " übersprungen (schon vorhanden).");
    DATA.clearCache();
    await DATA.loadConfig(true);
    DATA.resolveGesellschaft();
    if (neu) {
      APP.refreshTabs();          // neue Reiter sofort in der Navigation zeigen
      log("Navigation aktualisiert.");
    }
  }

  /* ── Oberfläche ──────────────────────────────────────────────────── */

  function render(host) {
    const schreiben = hatSchreibrecht();
    host.innerHTML = `
      <div class="card">
        <h4>⬇️ Export aus Entra ID</h4>
        <p class="hint">Liest alle Konten des Tenants über Microsoft Graph und lädt sie als
          CSV (Excel, Semikolon, UTF-8) oder JSON herunter. Nur lesend – am Verzeichnis wird
          nichts verändert. <b>Die Datei enthält personenbezogene Daten</b>: bitte nur dort
          ablegen, wo das zulässig ist.</p>

        <label class="f">Vorlage</label>
        <div class="row" style="margin-bottom:14px">
          ${Object.entries(SETS).map(([k, t]) => `
            <button class="btn ${k === vorlage ? "" : "sec"} sm" data-set="${k}" title="${esc(t)}">
              ${k === "on" ? "🚀 Onboarding" : k === "off" ? "🚪 Offboarding" : "📦 Migration (alles)"}
            </button>`).join("")}
        </div>

        <label class="f">Felder (${auswahl.size} von ${FIELDS.length} gewählt)</label>
        <div style="max-height:230px;overflow:auto;border:1px solid var(--border);
                    border-radius:8px;padding:10px 12px;margin-bottom:14px">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px">
            ${FIELDS.map(f => `
              <label class="chk" style="font-size:13.5px">
                <input type="checkbox" data-fld="${f.key}"${auswahl.has(f.key) ? " checked" : ""}>
                <span>${esc(f.label)}
                  ${f.write ? "" : ' <span class="pill gray" style="font-size:10px">nur Export</span>'}
                  ${f.perm ? ` <span class="pill orange" style="font-size:10px" title="${esc(f.perm)}">Zusatzrecht</span>` : ""}
                  ${f.slow ? ' <span class="pill orange" style="font-size:10px">langsam</span>' : ""}
                </span>
              </label>`).join("")}
          </div>
        </div>

        <div class="row" style="margin-bottom:14px">
          <label class="chk"><input type="checkbox" id="ieNurAktiv"> nur aktive Konten</label>
          <label class="chk"><input type="checkbox" id="ieGaeste"> Gastkonten einbeziehen</label>
          <label class="chk"><input type="checkbox" id="ieNurDomains"> nur gepflegte Domänen</label>
        </div>

        ${(() => {
          const fehlt = fehlendeZusatzrechte();
          if (!fehlt.length) return "";
          const felder = FIELDS.filter(f => auswahl.has(f.key) && fehlt.includes(f.perm))
            .map(f => f.label);
          return `<div class="warn">Für <b>${felder.map(esc).join(", ")}</b> fehlt im
            Zugriffstoken: <b>${fehlt.map(esc).join(", ")}</b>.
            <div style="margin-top:6px">In Entra erteilte Berechtigungen wirken erst, wenn die
            Anmeldung sie auch anfordert – sonst antwortet Graph mit
            <i>„The principal does not have required permission(s)“</i>. Ohne sie bleiben nur
            diese Spalten leer, der übrige Export läuft.</div>
            <div class="row" style="margin-top:10px">
              <button class="btn warn-btn sm" id="ieGrantRead">🔐 Zusatzrechte anfordern</button>
            </div></div>`;
        })()}

        <div class="row">
          <button class="btn" id="ieCsv">⬇️ CSV herunterladen</button>
          <button class="btn sec" id="ieJson">⬇️ JSON herunterladen</button>
          <button class="btn sec" id="ieTpl">📄 Leere Vorlage</button>
        </div>
      </div>

      <div class="card">
        <h4>⬆️ Import – vorhandene Konten aktualisieren</h4>
        ${schreiben
          ? `<div class="ok">Schreibrechte vorhanden (${WRITE_SCOPE}).</div>`
          : `<div class="warn">Zum Schreiben fehlt die Berechtigung <b>${WRITE_SCOPE}</b>.
               Sie wird absichtlich nicht bei jeder Anmeldung angefordert, sondern nur hier.
               <div class="row" style="margin-top:10px">
                 <button class="btn warn-btn sm" id="ieGrant">🔐 Schreibrechte anfordern</button>
               </div></div>`}
        <p class="hint">Abgleich über Anmeldename, Objekt-ID, Personalnummer oder E-Mail.
          Es werden <b>nur vorhandene Konten aktualisiert</b> – keine Neuanlagen, keine
          Kennwörter, keine Änderungen an Lizenzen, Gruppen oder Anmeldenamen.
          Leere Zellen bleiben unangetastet, ein einzelnes <code>-</code> leert das Feld.</p>

        <label class="f">CSV- oder JSON-Datei</label>
        <input type="file" id="ieFile" accept=".csv,.json,.txt" style="margin-bottom:10px">
        <label class="f">…oder Inhalt einfügen</label>
        <textarea id="ieText" style="min-height:110px;font-family:ui-monospace,Consolas,monospace"
          placeholder="Anmeldename (UPN);Abteilung;Position&#10;erika@dihag.com;Einkauf;Sachbearbeiterin"></textarea>

        <div class="row" style="margin-top:12px">
          <button class="btn" id="ieCheck">🔍 Prüfen (nichts wird geändert)</button>
          <button class="btn warn-btn" id="ieApply" disabled>⬆️ Änderungen übernehmen</button>
        </div>
        <label class="chk" style="margin-top:10px">
          <input type="checkbox" id="ieMitStatus">
          <span>Spalte „Konto aktiv“ mit übernehmen – <b>kann Konten deaktivieren</b> (Offboarding)</span>
        </label>
        <div id="ieDiff"></div>
      </div>

      <div class="card">
        <h4>🚀 Neuanlagen (Onboarding)</h4>
        <p class="hint">Konten anzulegen heißt, Startkennwörter zu vergeben – das gehört nicht
          in eine Browser-Anwendung. Diese Vorlage ist das offizielle Format für
          <b>Entra-Portal → Benutzer → Massenvorgänge → Benutzer erstellen</b>; das Kennwort
          setzt Entra beim Import. Anschließend die Stammdaten hier per Import nachziehen.</p>
        <button class="btn sec" id="ieBulk">📄 Entra-Massenimport-Vorlage</button>
      </div>

      <div class="card">
        <h4>⚙️ Portalkonfiguration</h4>
        <p class="hint">Gesellschaften, Reiter und Kacheln als JSON – für den Umzug in eine
          andere Umgebung oder als Sicherung vor größeren Umbauten. Der Import legt nur
          fehlende Einträge an und überschreibt nie Vorhandenes.</p>
        <div class="row">
          <button class="btn sec" id="ieCfgOut">⬇️ Konfiguration exportieren</button>
          <input type="file" id="ieCfgFile" accept=".json" style="max-width:250px">
          <button class="btn sec" id="ieCfgIn">⬆️ Konfiguration importieren</button>
        </div>
      </div>

      <pre id="ieLog" style="background:#f7fafd;border:1px solid var(--border);
        border-radius:8px;padding:12px;font-size:12.5px;max-height:340px;overflow:auto"
        hidden></pre>`;

    verdrahten(host);
  }

  /** Holt zusätzliche Berechtigungen ins Token. Erst still (prompt=none) –
   *  ist die Zustimmung in Entra schon erteilt, merkt niemand etwas davon;
   *  sonst schaltet auth.js automatisch auf die interaktive Anmeldung um. */
  function anfordern(scopes) {
    if (!scopes.length) return;
    location.hash = "#__settings";
    AUTH.startLogin("none", scopes);
  }

  function verdrahten(host) {
    const log = m => {
      const p = $("ieLog");
      p.hidden = false;
      p.textContent += m + "\n";
      p.scrollTop = p.scrollHeight;
    };
    const reset = () => { const p = $("ieLog"); p.textContent = ""; p.hidden = true; };
    const lauf = async (btn, fn) => {
      btn.disabled = true;
      try { await fn(); }
      catch (e) { log("✗ " + (e.detail || e.message)); APP.toast(e.message, true); }
      finally { btn.disabled = false; }
    };

    host.querySelectorAll("[data-set]").forEach(b => b.onclick = () => {
      vorlage = b.dataset.set;
      auswahl = new Set(FIELDS.filter(f => f.sets.includes(vorlage)).map(f => f.key));
      render(host);
    });
    host.querySelectorAll("[data-fld]").forEach(i => i.onchange = () => {
      if (i.checked) auswahl.add(i.dataset.fld); else auswahl.delete(i.dataset.fld);
    });

    $("ieCsv").onclick  = e => lauf(e.target, () => { reset(); return exportieren("csv", log); });
    $("ieJson").onclick = e => lauf(e.target, () => { reset(); return exportieren("json", log); });
    $("ieTpl").onclick  = () => vorlageLeer();
    $("ieBulk").onclick = () => entraMassenimport();

    if ($("ieGrant")) $("ieGrant").onclick = () => anfordern([WRITE_SCOPE, LIFECYCLE_SCOPE]);
    if ($("ieGrantRead")) $("ieGrantRead").onclick = () => anfordern(fehlendeZusatzrechte());

    const leseQuelle = async () => {
      const f = $("ieFile").files?.[0];
      if (f) return { text: await f.text(), name: f.name };
      const t = $("ieText").value.trim();
      return t ? { text: t, name: "eingefügter Text" } : null;
    };

    $("ieCheck").onclick = e => lauf(e.target, async () => {
      reset();
      const d = await leseQuelle();
      if (!d) { log("✗ Bitte eine Datei wählen oder Inhalt einfügen."); return; }
      log("Quelle: " + d.name);
      const roh = d.text.trim();
      importZeilen = (roh.startsWith("[") || roh.startsWith("{"))
        ? jsonAlsTabelle(roh) : fromCsv(roh);
      log(importZeilen.zeilen.length + " Datenzeilen gelesen.");
      importPlan = await importPruefen(log);
      $("ieApply").disabled = !importPlan?.aenderungen.length;
      zeigeDiff();
    });

    $("ieApply").onclick = () => {
      if (!importPlan) return;
      const anzahl = importPlan.aenderungen.length;
      const deakt = importPlan.aenderungen.filter(a =>
        a.diffs.some(d => d.key === "accountEnabled" && d.neu === false)).length;
      APP.modal({
        title: anzahl + " Konten aktualisieren",
        okText: "Übernehmen",
        bodyHtml: `<p>Es werden <b>${anzahl}</b> Konten in Entra ID geändert.</p>
          ${(deakt && $("ieMitStatus").checked)
            ? `<div class="warn">Davon werden <b>${deakt} Konten deaktiviert</b>.
                 Betroffene können sich danach nicht mehr anmelden.</div>` : ""}
          <p class="hint">Die Änderungen wirken sofort im ganzen Tenant. Eine
            Rückgängig-Funktion gibt es nicht – idealerweise liegt ein Export von
            vorher als Sicherung bereit.</p>`,
        onOk: async () => {
          await importAusfuehren(log);
          $("ieApply").disabled = true;
          zeigeDiff();
        }
      });
    };

    $("ieCfgOut").onclick = () => konfigExport();
    $("ieCfgIn").onclick = e => lauf(e.target, async () => {
      const f = $("ieCfgFile").files?.[0];
      if (!f) { APP.toast("Bitte eine JSON-Datei wählen.", true); return; }
      reset();
      await konfigImport(await f.text(), log);
    });
  }

  function jsonAlsTabelle(text) {
    const d = JSON.parse(text);
    const arr = Array.isArray(d) ? d : (d.users || d.value || []);
    const kopf = [...new Set(arr.flatMap(o => Object.keys(o)))];
    return { kopf, zeilen: arr.map(o => Object.fromEntries(kopf.map(k => [k, o[k] ?? ""]))) };
  }

  /** Anzeige in der Vorschau – Listen wie im Export mit „|“ getrennt. */
  const zeige = v => Array.isArray(v) ? v.join(" | ") : String(v ?? "");

  function zeigeDiff() {
    const box = $("ieDiff");
    if (!box) return;
    if (!importPlan?.aenderungen.length) { box.innerHTML = ""; return; }
    const a = importPlan.aenderungen;
    box.innerHTML = `
      <h3 class="section">Vorschau – ${a.length} Konten mit Änderungen</h3>
      <div class="tbl-wrap" style="max-height:320px;overflow:auto"><table class="tbl">
        <thead><tr><th>Konto</th><th>Feld</th><th>vorher</th><th>nachher</th></tr></thead>
        <tbody>${a.slice(0, 200).flatMap(({ user, diffs }) => diffs.map((d, i) => `
          <tr>
            <td>${i === 0
              ? `<b>${esc(user.displayName)}</b><br><small style="color:var(--muted)">${esc(user.userPrincipalName)}</small>`
              : ""}</td>
            <td>${esc(byKey(d.key).label)}</td>
            <td style="color:var(--muted)">${esc(zeige(d.alt) || "—")}</td>
            <td><b>${esc(d.neu === null ? "(leeren)" : zeige(d.neu))}</b></td>
          </tr>`)).join("")}
        </tbody></table></div>
      ${a.length > 200 ? `<p class="hint">Angezeigt werden die ersten 200 Konten.</p>` : ""}`;
  }

  return { render, FIELDS, SETS, toCsv, fromCsv, spaltenZuordnen, normWert, istWert,
           jsonAlsTabelle, fehlendeZusatzrechte };
})();
