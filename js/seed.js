"use strict";

/* Listendefinitionen und Startinhalte.
   Wird nur aus den Einstellungen heraus (Rolle „admin“) aufgerufen. */

const SEED = (() => {

  const G = GRAPH;

  /* ── Spalten der drei Konfigurationslisten ───────────────────────────
     Wichtig: „Einzelne Textzeile“ ist in SharePoint auf 255 Zeichen
     begrenzt. Alles, was länger werden kann (Beschreibung, Url, Inhalt),
     ist deshalb mehrzeiliger Klartext – NICHT Rich-Text, sonst liefert
     Graph HTML zurück und die Kacheln zeigen Markup an.
     Die hier verwendeten Namen sind gleichzeitig die internen Feldnamen;
     dieselbe Liste steht in LISTEN-ANLEGEN.md für die Anlage per Hand. */

  const COLS = {
    gesellschaften: [
      // Title = E-Mail-Domäne, z. B. "dihag.com"
      G.colText("Gesellschaft"),
      G.colText("Kuerzel", 20),
      G.colText("Farbe", 20),
      G.colBool("Standard"),
      G.colBool("Aktiv"),
      G.colNum("Sortierung")
    ],
    reiter: [
      // Title = Anzeigename des Reiters
      G.colText("ReiterKey", 60),
      G.colText("Icon", 10),
      G.colNote("Beschreibung"),
      G.colText("Domains", 255),
      G.colText("MinRolle", 20),
      G.colBool("Aktiv"),
      G.colNum("Sortierung")
    ],
    kacheln: [
      // Title = Überschrift der Kachel
      G.colText("ReiterKey", 60),
      G.colText("Typ", 20),
      G.colText("Icon", 10),
      G.colNote("Beschreibung"),
      G.colNote("Url"),          // SharePoint-URLs mit Parametern > 255 Zeichen
      G.colNote("Inhalt"),
      G.colText("Badge", 30),
      G.colText("Domains", 255),
      G.colText("MinRolle", 20),
      G.colBool("Aktiv"),
      G.colNum("Sortierung"),
      G.colDate("GueltigVon"),
      G.colDate("GueltigBis")
    ],
    einstellungen: [
      // Title = Schluessel, z. B. "orgScope.viewer"
      G.colText("Wert", 255),
      G.colNote("Hinweis")
    ],
    protokoll: [
      // Title = Zeitpunkt (ISO), damit die Liste von sich aus sortierbar ist
      G.colText("Konto"),
      G.colText("Aktion", 40),
      G.colText("Vorlage", 40),
      G.colNum("Anzahl"),
      G.colNote("Felder"),
      G.colNote("Details")
    ]
  };

  /** Erwartete Feldnamen je Liste – für die Spaltenprüfung in der Diagnose. */
  const EXPECTED = {
    gesellschaften: ["Title", "Gesellschaft", "Kuerzel", "Farbe", "Standard", "Aktiv", "Sortierung"],
    reiter:         ["Title", "ReiterKey", "Icon", "Beschreibung", "Domains", "MinRolle", "Aktiv", "Sortierung"],
    kacheln:        ["Title", "ReiterKey", "Typ", "Icon", "Beschreibung", "Url", "Inhalt", "Badge",
                     "Domains", "MinRolle", "Aktiv", "Sortierung", "GueltigVon", "GueltigBis"],
    einstellungen:  ["Title", "Wert", "Hinweis"],
    protokoll:      ["Title", "Konto", "Aktion", "Vorlage", "Anzahl", "Felder", "Details"]
  };

  /* ── Startinhalte ────────────────────────────────────────────────── */

  const REITER = [
    { Title: "Start",                    ReiterKey: "start",       Icon: "🏠", Sortierung: 10, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Ihr persönlicher Einstieg: Profil, Ansprechpartner und Neuigkeiten aus dem Intranet." },
    { Title: "Mein Arbeitsverhältnis",   ReiterKey: "job",         Icon: "📄", Sortierung: 20, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Alle Informationen und Services rund um Ihr Arbeitsverhältnis – von Urlaubsantrag bis Stellenangebot." },
    { Title: "Onboarding",               ReiterKey: "onboarding",  Icon: "🚀", Sortierung: 30, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Der Start bei uns: Checklisten, Ansprechpartner und die wichtigsten ersten Schritte." },
    { Title: "Lernen & Entwicklung",     ReiterKey: "lernen",      Icon: "🎓", Sortierung: 40, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Schulungen, E-Learnings und Weiterbildungsangebote der DIHAG Foundry Group." },
    { Title: "Sicherheit & Gesundheit",  ReiterKey: "sicherheit",  Icon: "🦺", Sortierung: 50, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Arbeitssicherheit, Sicherheitshandbuch und betriebliches Gesundheitsmanagement." },
    { Title: "Benefits",                 ReiterKey: "benefits",    Icon: "🎁", Sortierung: 60, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Zusatzleistungen und Vorteile für Mitarbeitende." },
    { Title: "IT & Services",            ReiterKey: "it",          Icon: "💻", Sortierung: 70, Domains: "*", MinRolle: "viewer", Aktiv: true,
      Beschreibung: "Anwendungen, Support und Self-Services der IT." },
    { Title: "Führungskräfte",           ReiterKey: "fuehrung",    Icon: "🧭", Sortierung: 80, Domains: "*", MinRolle: "editor", Aktiv: true,
      Beschreibung: "Nur für Führungskräfte: Vorlagen, Prozesse und Auswertungen." }
  ];

  const KACHELN = [
    /* ── Mein Arbeitsverhältnis ── */
    { Title: "Stellenangebote – DIHAG Holding", ReiterKey: "job", Typ: "link", Icon: "🌐", Sortierung: 10,
      Beschreibung: "Aktuelle Ausschreibungen der Unternehmensgruppe – auch für interne Bewerbungen.",
      Url: "https://dihag.sharepoint.com/SitePages/Joblinks.aspx", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "HR Self-Service (Timebutler)", ReiterKey: "job", Typ: "link", Icon: "🕒", Sortierung: 20,
      Beschreibung: "Urlaubsanträge stellen, Krankmeldungen erfassen und Zeitkonten einsehen.",
      Url: "https://timebutler.de/", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Organigramm der Gruppe", ReiterKey: "job", Typ: "link", Icon: "🗂️", Sortierung: 30,
      Beschreibung: "Wer arbeitet wo? Struktur, Abteilungen und Ansprechpartner aller Werke.",
      Url: RUDJ_CONFIG.orgchartUrl, Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Personalveränderungen", ReiterKey: "job", Typ: "text", Icon: "📣", Sortierung: 40, Badge: "in Arbeit",
      Beschreibung: "Ein- und Austritte, Jubiläen und Wechsel innerhalb der Gruppe.",
      Inhalt: "Dieser Bereich wird derzeit aufgebaut. Künftig finden Sie hier Ein- und Austritte, Jubiläen sowie Wechsel innerhalb der DIHAG Foundry Group.",
      Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── Onboarding ── */
    { Title: "Onboarding-Checkliste", ReiterKey: "onboarding", Typ: "text", Icon: "✅", Sortierung: 10,
      Beschreibung: "Die ersten Schritte in Ihrer neuen Rolle.",
      Inhalt: "1. Zugangsdaten und Ausweis bei der Personalabteilung abholen\n2. IT-Ausstattung im Ticketsystem anfordern\n3. Sicherheitsunterweisung absolvieren\n4. Einführungsgespräch mit der Führungskraft\n5. Vorstellungsrunde in der Abteilung",
      Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Ansprechpartner Personal", ReiterKey: "onboarding", Typ: "link", Icon: "👥", Sortierung: 20,
      Beschreibung: "Ihre Personalabteilung im Organigramm.",
      Url: RUDJ_CONFIG.orgchartUrl, Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Unsere DIHAG", ReiterKey: "onboarding", Typ: "link", Icon: "🏭", Sortierung: 30,
      Beschreibung: "Gruppe, Werke und Geschichte im Intranet.",
      Url: "https://dihag.sharepoint.com", Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── Lernen & Entwicklung ── */
    { Title: "E-Learning Informationssicherheit", ReiterKey: "lernen", Typ: "link", Icon: "🔐", Sortierung: 10,
      Beschreibung: "Pflichtschulung zu Informationssicherheit und Datenschutz.",
      Url: "https://dfedorov12.github.io/richtlinienmanagementsystem/", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Richtlinien & Arbeitsanweisungen", ReiterKey: "lernen", Typ: "link", Icon: "📘", Sortierung: 20,
      Beschreibung: "Gültige Richtlinien lesen und Kenntnisnahme bestätigen.",
      Url: "https://dfedorov12.github.io/richtlinienmanagementsystem/", Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── Sicherheit & Gesundheit ── */
    { Title: "Sicherheitshandbuch (SHB)", ReiterKey: "sicherheit", Typ: "link", Icon: "🦺", Sortierung: 10,
      Beschreibung: "Verhaltensregeln auf dem Werksgelände.",
      Url: "https://dihag.sharepoint.com", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Besucheranmeldung", ReiterKey: "sicherheit", Typ: "link", Icon: "🚪", Sortierung: 20,
      Beschreibung: "Externe Gäste vorab anmelden und ein-/auschecken.",
      Url: "https://dfedorov12.github.io/besuchermanagement/", Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── Benefits ── */
    { Title: "Zuwendungen melden (ZAPP)", ReiterKey: "benefits", Typ: "link", Icon: "🎁", Sortierung: 10,
      Beschreibung: "Geschenke und Einladungen dokumentieren – compliance-konform.",
      Url: "https://dfedorov12.github.io/zapp/", Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── IT & Services ── */
    { Title: "IT-Ticketsystem", ReiterKey: "it", Typ: "link", Icon: "🎫", Sortierung: 10,
      Beschreibung: "Störungen melden und Anfragen an die IT stellen.",
      Url: "https://dfedorov12.github.io/tickets/", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "Bedarfsanfrage / Beschaffung", ReiterKey: "it", Typ: "link", Icon: "🛒", Sortierung: 20,
      Beschreibung: "Material und Leistungen anfordern und genehmigen lassen.",
      Url: "https://dfedorov12.github.io/bedarfsanfrage/", Domains: "*", MinRolle: "viewer", Aktiv: true },
    { Title: "E-Rechnung", ReiterKey: "it", Typ: "link", Icon: "🧾", Sortierung: 30,
      Beschreibung: "Eingangsrechnungen prüfen und freigeben.",
      Url: "https://dfedorov12.github.io/e-rechnung/", Domains: "*", MinRolle: "viewer", Aktiv: true },

    /* ── Führungskräfte (nur editor/admin) ── */
    { Title: "Leitfaden Mitarbeitergespräch", ReiterKey: "fuehrung", Typ: "text", Icon: "🗣️", Sortierung: 10,
      Beschreibung: "Vorbereitung und Ablauf des jährlichen Gesprächs.",
      Inhalt: "Diese Kachel ist nur für Führungskräfte sichtbar (Mindestrolle „editor“). Sie zeigt, wie sich Inhalte rollenabhängig ein- und ausblenden lassen.",
      Domains: "*", MinRolle: "editor", Aktiv: true }
  ];

  /* ── Anlegen ─────────────────────────────────────────────────────── */

  async function ensureLists(onLog = () => {}) {
    const C = RUDJ_CONFIG;
    for (const [key, listName] of Object.entries(C.lists)) {
      onLog(`Liste „${listName}“ wird geprüft …`);
      await G.ensureList(C.configSite, listName, COLS[key]);
      onLog(`Liste „${listName}“ ist vorhanden.`);
    }
  }

  /** Legt Standard-Gesellschaften aus den im Tenant gefundenen Domänen an. */
  async function seedGesellschaften(onLog = () => {}) {
    const C = RUDJ_CONFIG;
    const existing = (await GRAPH.listItems(C.configSite, C.lists.gesellschaften, EXPECTED.gesellschaften)) || [];
    const have = new Set(existing.map(g => String(g.Title || "").toLowerCase()));
    const found = await DATA.discoverDomains();
    let i = existing.length;
    for (const { domain } of found) {
      if (have.has(domain)) continue;
      const name = domain.split(".")[0].replace(/^./, c => c.toUpperCase());
      await GRAPH.addItem(C.configSite, C.lists.gesellschaften, {
        Title: domain,
        Gesellschaft: name,
        Kuerzel: name.slice(0, 3).toUpperCase(),
        Farbe: "#17509E",
        Standard: domain === "dihag.com",
        Aktiv: true,
        Sortierung: (++i) * 10
      });
      onLog(`Gesellschaft „${name}“ (${domain}) angelegt.`);
    }
  }

  async function seedContent(onLog = () => {}) {
    const C = RUDJ_CONFIG;
    const rExist = (await GRAPH.listItems(C.configSite, C.lists.reiter, EXPECTED.reiter)) || [];
    const rHave = new Set(rExist.map(r => r.ReiterKey));
    for (const r of REITER) {
      if (rHave.has(r.ReiterKey)) continue;
      await GRAPH.addItem(C.configSite, C.lists.reiter, r);
      onLog(`Reiter „${r.Title}“ angelegt.`);
    }
    const kExist = (await GRAPH.listItems(C.configSite, C.lists.kacheln, EXPECTED.kacheln)) || [];
    const kHave = new Set(kExist.map(k => k.ReiterKey + "|" + k.Title));
    for (const k of KACHELN) {
      if (kHave.has(k.ReiterKey + "|" + k.Title)) continue;
      await GRAPH.addItem(C.configSite, C.lists.kacheln, k);
      onLog(`Kachel „${k.Title}“ angelegt.`);
    }
  }

  return { COLS, EXPECTED, REITER, KACHELN, ensureLists, seedGesellschaften, seedContent };
})();
