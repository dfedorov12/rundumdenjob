"use strict";

/* Zentrale Konfiguration – „Rund um den Job“
   ------------------------------------------
   Diese Datei ist die einzige Stelle, an der IDs/Pfade angepasst werden müssen. */

const RUDJ_CONFIG = {

  /* ── Entra ID / Anmeldung ─────────────────────────────────────────── */
  tenantId: "fdb70646-023a-403b-a4b9-1f474a935123",

  // App-Registrierung. Standard = die Registrierung der ZAPP-App, weil sie
  // bereits Sites.ReadWrite.All besitzt (nötig, damit Admins die Einstellungen
  // schreiben können). Alternative (nur lesend): die Orgchart-Registrierung
  // "4bd5e16e-5345-4ded-adc8-2a7f25922786".
  // Wichtig: Unter „Authentifizierung → Single-Page-Anwendung“ muss
  // https://dfedorov12.github.io/rundumdenjob/ als Redirect-URI eingetragen
  // sein (siehe setup-rundumdenjob.ps1).
  clientId: "c7710322-13ab-44c5-8ba1-314ca5cdb38d",

  scopes: [
    "User.Read",
    "User.ReadBasic.All",
    "User.Read.All",        // Vorgesetzte/Team für das Orgchart-Widget
    "Sites.ReadWrite.All",  // Konfigurationslisten lesen + schreiben
    "Mail.Send"             // Freigabe-Anfrage an die IT
  ],

  /* ── SharePoint: Konfigurationslisten ─────────────────────────────── */
  configSite: "dihag.sharepoint.com:/sites/IT",
  lists: {
    gesellschaften: "RUDJ_Gesellschaften",
    reiter:         "RUDJ_Reiter",
    kacheln:        "RUDJ_Kacheln"
  },

  /* ── SharePoint: zentrale Rechteliste (wie im Orgchart) ───────────── */
  permSite: "dihag.sharepoint.com:/sites/ticket",
  permList: "AppPermissions",
  appKey:   "rundumdenjob",

  // Jede Person im Tenant darf die Seite sehen. Über AppPermissions werden
  // nur höhere Rollen (editor/admin) vergeben.
  defaultRole: "viewer",

  // Haupt-Administrator: hat immer die Rolle „admin“, unabhängig von
  // AppPermissions. Damit bleibt die Seite administrierbar, auch wenn in der
  // Rechteliste noch kein Eintrag für „rundumdenjob“ existiert.
  hauptAdmins: ["administrator@dihag.com"],

  /* ── Anbindung an das SharePoint-Intranet ─────────────────────────── */
  intranet: {
    // Root-Site des Intranets (dort liegen „Unsere DIHAG“, „Neues aus der
    // DIHAG“, „So arbeiten wir“ …)
    site: "dihag.sharepoint.com",
    baseUrl: "https://dihag.sharepoint.com",
    newsCount: 4
  },

  /* ── Verlinkte Schwester-Apps ─────────────────────────────────────── */
  orgchartUrl: "https://dfedorov12.github.io/orgchart-/",
  adminUrl:    "https://dfedorov12.github.io/admin/",
  itMail:      "ticket@dihag.com",

  /* ── Sonstiges ────────────────────────────────────────────────────── */
  cacheMinutes: 10   // Konfiguration wird so lange im sessionStorage gehalten
};
