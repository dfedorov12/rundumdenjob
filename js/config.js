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
  // Wichtig: Unter „Authentifizierung → Single-Page-Anwendung“ müssen die
  // Redirect-URIs eingetragen sein (siehe setup-rundumdenjob.ps1):
  //   https://rundumdenjob.dihag.de/            (eigene Domäne, produktiv)
  //   https://dfedorov12.github.io/rundumdenjob/ (Fallback, leitet dorthin um)
  // js/auth.js leitet die Adresse aus dem Aufruf ab und funktioniert auf beiden.
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

  // Optionale Liste fuer Werte, die sonst nur per Commit aenderbar waeren
  // (derzeit orgScope). Fehlt sie, gelten die Vorgaben aus dieser Datei.
  einstellungenListe: "RUDJ_Einstellungen",

  /* ── SharePoint: zentrale Rechteliste ─────────────────────────────
     Liegt auf derselben Site wie die Konfigurationslisten. Vorher
     /sites/ticket – dort konnten normale Konten die Liste nicht lesen,
     wodurch loadRole() still auf die Standardrolle zurückfiel und jede
     vergebene Rolle wirkungslos blieb. */
  permSite: "dihag.sharepoint.com:/sites/IT",
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

  /* ── Sichtbarkeit der Personendaten („Mein Umfeld“) ───────────────
     Wie weit darf jemand ins Verzeichnis schauen? Das Werk kommt – wie im
     Organigramm – aus dem Entra-Feld `companyName`.
       werk         = nur Personen des eigenen Werks
       gesellschaft = alle mit derselben E-Mail-Domäne
       alle         = keine Einschränkung
     Die Führungskraft wird immer gezeigt, auch werksübergreifend, sonst
     stünde die Karte bei Werksleitungen leer. */
  orgScope: {
    viewer: "werk",
    editor: "werk",
    admin:  "alle"
  },

  /* ── Verlinkte Schwester-Apps ─────────────────────────────────────── */
  orgchartUrl: "https://dfedorov12.github.io/orgchart-/",
  adminUrl:    "https://dfedorov12.github.io/admin/",
  itMail:      "ticket@dihag.com",

  /* ── Sonstiges ────────────────────────────────────────────────────── */
  cacheMinutes: 10   // Konfiguration wird so lange im sessionStorage gehalten
};
