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
    const me = await GRAPH.call("/me?$select=displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones");
    ctx.me = me;
    ctx.email = (me.mail || me.userPrincipalName || "").toLowerCase();
    ctx.name = me.displayName || ctx.email;
    ctx.domains = [...new Set([domainOf(me.mail), domainOf(me.userPrincipalName)].filter(Boolean))];
    ctx.domain = domainOf(me.mail) || domainOf(me.userPrincipalName);
    ctx.role = await loadRole();
    return ctx;
  }

  /** Rolle aus der zentralen Liste AppPermissions (wie im Orgchart).
   *  Ohne Treffer gilt die Standardrolle – alle Tenant-Nutzer dürfen lesen. */
  async function loadRole() {
    if (C.bootstrapAdmins.map(s => s.toLowerCase()).includes(ctx.email)) return "admin";
    try {
      const rows = await GRAPH.listItems(C.permSite, C.permList);
      if (!rows) return C.defaultRole;
      let best = RANK[C.defaultRole] ?? 1;
      for (const r of rows) {
        if ((r.UserEmail || "").toLowerCase() !== ctx.email) continue;
        if (r.App !== C.appKey && r.App !== "*") continue;
        best = Math.max(best, RANK[String(r.Role || "").toLowerCase()] ?? 0);
      }
      return Object.keys(RANK).find(k => RANK[k] === best) || C.defaultRole;
    } catch (e) {
      console.warn("[Rolle]", e.message);
      return C.defaultRole;   // Rechteliste nicht erreichbar → Lesezugriff
    }
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
      GRAPH.listItems(C.configSite, C.lists.gesellschaften).catch(() => null),
      GRAPH.listItems(C.configSite, C.lists.reiter).catch(() => null),
      GRAPH.listItems(C.configSite, C.lists.kacheln).catch(() => null)
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

  function clearCache() { try { sessionStorage.removeItem("rudj_cfg"); } catch {} }

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
    loadUser, loadConfig, clearCache, resolveGesellschaft,
    isVisible, visibleReiter, kachelnFor, discoverDomains,
    isAdmin, canWrite, parseList, domainOf, num
  };
})();
