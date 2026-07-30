"use strict";

/* Benutzerkontext, Konfigurationsdaten und Sichtbarkeitslogik */

const DATA = (() => {

  const C = RUDJ_CONFIG;
  const RANK = { none: 0, viewer: 1, editor: 2, admin: 3 };

  /** @type {{me:object, email:string, name:string, domains:string[],
   *          domain:string, role:string, gesellschaft:object|null}} */
  const ctx = {
    me: null, email: "", name: "", domains: [], domain: "",
    role: C.defaultRole, gesellschaft: null
  };

  /** @type {{gesellschaften:any[], reiter:any[], kacheln:any[],
   *          missing:string[], writable:boolean}} */
  const cfg = { gesellschaften: [], reiter: [], kacheln: [], missing: [], writable: false };

  /* ── Hilfsfunktionen ─────────────────────────────────────────────── */

  const domainOf = addr => {
    const s = String(addr || "").toLowerCase().trim();
    const i = s.lastIndexOf("@");
    return i < 0 ? "" : s.slice(i + 1);
  };

  /** "a.de; b.de , *" → ["a.de","b.de","*"] */
  const parseList = v => String(v || "")
    .split(/[;,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  const num = v => (v === null || v === undefined || v === "") ? 999 : Number(v);

  function dateOk(row) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.GueltigVon && String(row.GueltigVon).slice(0, 10) > today) return false;
    if (row.GueltigBis && String(row.GueltigBis).slice(0, 10) < today) return false;
    return true;
  }

  /** Kernstück: Ist dieser Eintrag für den aktuellen Nutzer sichtbar? */
  function isVisible(row) {
    if (row.Aktiv === false) return false;
    if (!dateOk(row)) return false;
    if (RANK[ctx.role] < (RANK[String(row.MinRolle || "viewer").toLowerCase()] ?? 1)) return false;
    const doms = parseList(row.Domains);
    if (!doms.length || doms.includes("*")) return true;
    return ctx.domains.some(d => doms.includes(d));
  }

  /* ── Benutzer + Rolle ────────────────────────────────────────────── */

  async function loadUser() {
    const me = await GRAPH.call("/me?$select=displayName,mail,userPrincipalName,jobTitle,"
      + "department,officeLocation,mobilePhone,businessPhones,companyName");
    ctx.me = me;
    ctx.email = (me.mail || me.userPrincipalName || "").toLowerCase();
    ctx.name = me.displayName || ctx.email;
    ctx.domains = [...new Set([domainOf(me.mail), domainOf(me.userPrincipalName)].filter(Boolean))];
    ctx.domain = domainOf(me.mail) || domainOf(me.userPrincipalName);
    ctx.role = await loadRole();
    return ctx;
  }

  /** Haupt-Administrator laut Konfiguration – immer Rolle „admin“. */
  const isHauptAdmin = mail =>
    (C.hauptAdmins || []).map(s => String(s).toLowerCase()).includes(String(mail || "").toLowerCase());

  /** Protokoll der letzten Rollenermittlung – damit „warum viewer?“ beantwortbar
   *  ist, ohne im Code zu suchen. Wird in der Profilkarte und der Diagnose
   *  angezeigt. */
  const roleInfo = {
    quelle: "standard",   // hauptadmin | liste | standard
    fehler: null,         // Text, wenn die Rechteliste nicht gelesen werden konnte
    zeilen: 0,            // gelesene Einträge insgesamt
    treffer: 0,           // Einträge auf die eigene E-Mail
    passend: 0            // davon mit passender App
  };

  /* ── Rollen-Cache ────────────────────────────────────────────────────
     Das Lesen der Rechteliste kostet vier Graph-Aufrufe und lief bisher bei
     jedem Seitenaufruf. Drei Minuten Zwischenspeicher machen den Start
     schneller, ohne dass eine Rechteänderung lange unbemerkt bleibt – und
     „Meine Rolle neu einlesen“ bzw. reloadRole() umgehen den Cache ohnehin. */

  const ROLE_KEY = "rudj_role";
  const ROLE_TTL = 3 * 60 * 1000;

  function roleAusCache(email) {
    try {
      const c = JSON.parse(sessionStorage.getItem(ROLE_KEY) || "null");
      if (!c || c.email !== email || Date.now() - c.ts > ROLE_TTL) return null;
      Object.assign(roleInfo, c.info, { auscache: true });
      return c.role;
    } catch { return null; }
  }

  function roleInCache(email, role) {
    try {
      sessionStorage.setItem(ROLE_KEY, JSON.stringify({
        email, role, ts: Date.now(),
        info: { ...roleInfo, auscache: false }
      }));
    } catch {}
  }

  const clearRoleCache = () => { try { sessionStorage.removeItem(ROLE_KEY); } catch {} };

  /** Rolle aus der zentralen Liste AppPermissions (wie im Orgchart).
   *  Ohne Treffer gilt die Standardrolle – alle Tenant-Nutzer dürfen lesen.
   *  @param {boolean} [frisch] Cache umgehen und neu lesen. */
  async function loadRole(frisch = false) {
    if (!frisch) {
      const c = roleAusCache(ctx.email);
      if (c) return c;
    }
    const rolle = await ermittleRolle();
    // Fehlerfälle nicht zwischenspeichern – sonst wartet man nach dem
    // Beheben eines Rechteproblems minutenlang auf die Wirkung.
    if (!roleInfo.fehler) roleInCache(ctx.email, rolle);
    return rolle;
  }

  async function ermittleRolle() {
    roleInfo.quelle = "standard";
    roleInfo.fehler = null;
    roleInfo.auscache = false;
    roleInfo.zeilen = roleInfo.treffer = roleInfo.passend = 0;

    if (isHauptAdmin(ctx.email)) { roleInfo.quelle = "hauptadmin"; return "admin"; }
    try {
      const rows = await GRAPH.listItems(C.permSite, C.permList, ["Title", "UserEmail", "App", "Role"]);
      if (!rows) {
        // listItems liefert null, wenn die Liste nicht gefunden wird – für
        // Konten ohne Zugriff auf die Site sieht das genauso aus.
        roleInfo.fehler = `Liste „${C.permList}“ auf ${C.permSite} nicht gefunden `
          + "oder für dieses Konto nicht lesbar.";
        return C.defaultRole;
      }
      roleInfo.zeilen = rows.length;
      let best = RANK[C.defaultRole] ?? 1;
      for (const r of rows) {
        if ((r.UserEmail || "").toLowerCase() !== ctx.email) continue;
        roleInfo.treffer++;
        if (r.App !== C.appKey && r.App !== "*") continue;
        roleInfo.passend++;
        best = Math.max(best, RANK[String(r.Role || "").toLowerCase()] ?? 0);
      }
      if (roleInfo.passend) roleInfo.quelle = "liste";
      return Object.keys(RANK).find(k => RANK[k] === best) || C.defaultRole;
    } catch (e) {
      roleInfo.fehler = e.detail || e.message;
      console.warn("[Rolle]", roleInfo.fehler);
      return C.defaultRole;   // Rechteliste nicht erreichbar → Lesezugriff
    }
  }

  /** Ein Satz, warum die aktuelle Rolle so ist, wie sie ist. */
  function roleErklaerung() {
    if (roleInfo.quelle === "hauptadmin")
      return `Haupt-Administrator laut Konfiguration (js/config.js).`;
    if (roleInfo.fehler)
      return `Rechteliste nicht auswertbar – deshalb Standardrolle „${C.defaultRole}“. ${roleInfo.fehler}`;
    if (roleInfo.quelle === "liste")
      return `Aus ${C.permList}: ${roleInfo.passend} passende(r) Eintrag/Einträge `
        + `(${roleInfo.zeilen} Zeilen gelesen).`;
    if (roleInfo.treffer)
      return `${roleInfo.treffer} Eintrag/Einträge auf diese E-Mail gefunden, aber keiner für `
        + `App „${C.appKey}“ oder „*“ – deshalb Standardrolle „${C.defaultRole}“.`;
    return `Kein Eintrag in ${C.permList} für ${ctx.email} `
      + `(${roleInfo.zeilen} Zeilen gelesen) – deshalb Standardrolle „${C.defaultRole}“.`;
  }

  /** Rolle erneut aus AppPermissions lesen, ohne neu anzumelden.
   *  Nötig, weil loadRole() sonst nur einmal beim Anmelden läuft – eine
   *  danach vergebene Rolle würde bis zum nächsten Seitenaufruf nicht wirken.
   *  @returns {Promise<{alt:string, neu:string, geaendert:boolean}>} */
  async function reloadRole() {
    const alt = ctx.role;
    ctx.role = await loadRole(true);   // Cache umgehen
    return { alt, neu: ctx.role, geaendert: alt !== ctx.role };
  }

  const isAdmin  = () => ctx.role === "admin";
  const canWrite = () => ctx.role === "admin" || ctx.role === "editor";

  /* ── Konfiguration laden ─────────────────────────────────────────── */

  async function loadConfig(force = false) {
    const cacheKey = "rudj_cfg";
    if (!force) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const c = JSON.parse(raw);
          if (Date.now() - c.ts < C.cacheMinutes * 60000) {
            Object.assign(cfg, c.data);
            resolveGesellschaft();
            return cfg;
          }
        }
      } catch {}
    }

    cfg.missing = [];
    const [ges, rei, kac] = await Promise.all([
      GRAPH.listItems(C.configSite, C.lists.gesellschaften, SEED.EXPECTED.gesellschaften).catch(() => null),
      GRAPH.listItems(C.configSite, C.lists.reiter,         SEED.EXPECTED.reiter).catch(() => null),
      GRAPH.listItems(C.configSite, C.lists.kacheln,        SEED.EXPECTED.kacheln).catch(() => null)
    ]);
    if (ges === null) cfg.missing.push(C.lists.gesellschaften);
    if (rei === null) cfg.missing.push(C.lists.reiter);
    if (kac === null) cfg.missing.push(C.lists.kacheln);

    cfg.gesellschaften = (ges || []).sort((a, b) => num(a.Sortierung) - num(b.Sortierung));
    cfg.reiter         = (rei || []).sort((a, b) => num(a.Sortierung) - num(b.Sortierung));
    cfg.kacheln        = (kac || []).sort((a, b) => num(a.Sortierung) - num(b.Sortierung));

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        ts: Date.now(),
        data: { gesellschaften: cfg.gesellschaften, reiter: cfg.reiter, kacheln: cfg.kacheln, missing: cfg.missing }
      }));
    } catch {}

    resolveGesellschaft();
    return cfg;
  }

  function clearCache() {
    try { sessionStorage.removeItem("rudj_cfg"); } catch {}
    clearRoleCache();
    GRAPH.clearColumnCache();   // Spalten- und ID-Cache neu ermitteln
  }

  /** Automatische Zuordnung: E-Mail-Domäne → Gesellschaft. */
  function resolveGesellschaft() {
    const act = cfg.gesellschaften.filter(g => g.Aktiv !== false);
    ctx.gesellschaft =
      act.find(g => ctx.domains.includes(String(g.Title || "").toLowerCase().trim())) ||
      act.find(g => g.Standard === true) ||
      null;
    return ctx.gesellschaft;
  }

  /* ── Aufbereitete Sichten für die Oberfläche ─────────────────────── */

  function visibleReiter() {
    return cfg.reiter.filter(isVisible);
  }

  function kachelnFor(reiterKey) {
    return cfg.kacheln.filter(k => (k.ReiterKey || "") === reiterKey && isVisible(k));
  }

  /** Domänen aus dem Tenant einsammeln (für die Einstellungen). */
  async function discoverDomains() {
    const users = await GRAPH.callAll("/users?$select=mail,userPrincipalName&$top=999", 10);
    const counts = {};
    for (const u of users) {
      const d = domainOf(u.mail || u.userPrincipalName);
      if (!d || d.endsWith(".onmicrosoft.com")) continue;
      counts[d] = (counts[d] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([domain, anzahl]) => ({ domain, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }

  return {
    ctx, cfg, RANK,
    roleInfo, roleErklaerung,
    loadUser, loadConfig, clearCache, resolveGesellschaft, reloadRole,
    isVisible, visibleReiter, kachelnFor, discoverDomains,
    isAdmin, canWrite, isHauptAdmin, parseList, domainOf, num
  };
})();
