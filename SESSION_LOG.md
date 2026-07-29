# Session-Log · Rund um den Job

## 2026-07-27 (1): Erstaufbau der App

**Denis:** Neue Website `rundumdenjob` unter dfedorov12, angebunden ans SharePoint-Intranet,
im DIHAG Corporate Design. Zuordnung der Nutzenden automatisch über die E-Mail-Domänenendung,
konfigurierbar über einen Einstellungsreiter. Alles, was angezeigt wird, soll rechteabhängig
dynamisch steuerbar sein (Reiter/Icons – Vorschlag erbeten). Anbindung an
`dfedorov12.github.io/orgchart-/`, automatische Anmeldung.

**Umgesetzter Vorschlag – zweistufiges Sichtbarkeitsmodell:**
Ebene 1 = **Reiter** (Navigationspunkte), Ebene 2 = **Kacheln** (Inhalte im Reiter).
Beide Ebenen tragen dieselben Sichtbarkeitsfelder `Domains` (`*` oder Domänenliste),
`MinRolle` (viewer/editor/admin) und `Aktiv`; Kacheln zusätzlich `GueltigVon`/`GueltigBis`.
Ein Reiter ohne Treffer verschwindet komplett aus der Navigation. Kacheltypen: `link` und `text`.

**Dateien (neu):**
- `index.html` – Boot-Screen, Kein-Zugriff-Screen, Kopfbereich mit Gesellschafts-Badge,
  dynamische Reiterleiste, Fußzeile.
- `css/styles.css` – CD (Azur #17509E, Navy #1A2644, Anthrazit #424241, Lichtblau #99B7CD,
  Orange #F08300, Exo); Logo im Header per `filter: brightness(0) invert(1)` weiß auf Navy.
- `js/config.js` – ClientId (ZAPP-Registrierung, hat bereits Sites.ReadWrite.All), TenantId,
  `configSite = /sites/IT`, Listen `RUDJ_Gesellschaften|Reiter|Kacheln`,
  `permSite = /sites/ticket` + `AppPermissions`, `appKey = rundumdenjob`,
  `defaultRole = viewer`, `hauptAdmins = [administrator@dihag.com]`, Intranet-Root
  `dihag.sharepoint.com`, Orgchart-URL.
- `js/auth.js` – PKCE wie im Orgchart, ergänzt um **automatische Anmeldung**: erst
  `prompt=none`-Redirect, bei `login_required` automatisch `prompt=select_account`,
  Login-Button nur im Fehlerfall.
- `js/graph.js` – `call`/`callAll` (nextLink), `siteId`/`listId` (404 → null),
  Listen-CRUD, `ensureList` mit Spaltendefinitionen.
- `js/data.js` – Benutzerkontext (Domänen aus mail + UPN), `loadRole` aus AppPermissions
  (App = `rundumdenjob` oder `*`, sonst defaultRole), `resolveGesellschaft` (Domänentreffer →
  Standard-Eintrag → null), `isVisible` (Aktiv + Zeitraum + Rolle + Domänen),
  `discoverDomains` (Domänen aus `/users`, `.onmicrosoft.com` gefiltert), Session-Cache 10 min.
- `js/seed.js` – Spaltenschema der drei Listen + 8 Reiter / 16 Kacheln Startinhalt
  (Joblinks + HR Self-Service aus der Intranet-Seite, Onboarding, Lernen, Sicherheit,
  Benefits, IT-Services, Führungskräfte-Bereich als `MinRolle: editor`-Beispiel). Idempotent.
- `js/settings.js` – Einstellungen mit 5 Unterreitern: Gesellschaften & Domänen (inkl.
  „Domänen im Tenant suchen“), Reiter, Kacheln (mit Reiter-Filter), Berechtigungen
  (AppPermissions lesen/anlegen/entfernen), Einrichtung (Listen anlegen, Domänen übernehmen,
  Startinhalte) + Erklärtext zur Sichtbarkeitskette.
- `js/app.js` – Boot, Kopfbereich (Avatar aus Graph-Foto, Gesellschafts-Badge),
  dynamische Reiter + Deeplink über `location.hash`, Kachel-Rendering,
  Startseite mit Profil + **Orgchart-Anbindung** (Führungskraft / eigenes Team /
  Kolleg:innen über `/me/manager` + `directReports`) + **Intranet-News**
  (`/sites/{root}/pages/microsoft.graph.sitePage`), Freigabe-Anfrage per `/me/sendMail`.
- `setup-rundumdenjob.ps1` – Redirect-URI ergänzen, Listen + Spalten anlegen,
  optional `-SeedDomains`.
- `README.md`, `.gitignore` (schließt `_test.html` aus).
- `assets/dihag-logo.png` – aus `orgchart/index.html` (Base64) extrahiert, 210 KB.

**Verifikation:** `node --check` für alle 7 JS-Dateien. Browser-Test über `_test.html`
(Stubs für AUTH/GRAPH, lokaler Server auf Port 8769, Eintrag in `.claude/launch.json`):
- 13 Sichtbarkeitsprüfungen grün: admin sieht 8 Reiter inkl. Führungskräfte; als `viewer`
  verschwinden Reiter **und** Kachel; Reiter mit `Domains=gienanth.de` ist für `@dihag.com`
  weg und für `@gienanth.de` da; abgelaufene / zukünftige / inaktive Kachel unsichtbar;
  Gesellschaftsauflösung inkl. Standard-Fallback; Domänensuche findet 3 Domänen;
  `javascript:`-URL wird verworfen.
- Einrichtung: aus leerem Stand 3 Gesellschaften + 8 Reiter + 16 Kacheln, zweiter Durchlauf
  ohne Duplikate.
- CRUD über die Oberfläche: neue Kachel angelegt (URL-Validierung blockt `javascript:`,
  Modal bleibt offen), danach korrekt nur für `@gienanth.de` sichtbar; Löschen funktioniert.
- Alle 5 Unterreiter rendern, Konsole fehlerfrei.

**Offen / manuell:**
1. Redirect-URI `https://dfedorov12.github.io/rundumdenjob/` in der App-Registrierung
   `c7710322-…` eintragen (oder Skript ausführen) – sonst AADSTS50011 beim ersten Aufruf.
2. GitHub Pages im neuen Repo aktivieren.
3. Domänen/Gesellschaften nach dem ersten Login prüfen und benennen (Skript vergibt
   nur einen aus der Domäne abgeleiteten Namen).

## 2026-07-27 (2): Haupt-Admin = administrator@dihag.com

**Denis:** „der hauptadmin soll administrator@dihag.com sein!"

- `js/config.js`: `bootstrapAdmins: ["fedorov@dihag.com"]` → `hauptAdmins: ["administrator@dihag.com"]`
  (umbenannt, weil es kein Notnagel mehr ist, sondern die feste Haupt-Administration).
- `js/data.js`: neue Hilfsfunktion `isHauptAdmin(mail)` (case-insensitiv, tolerant gegen
  fehlendes Feld), von `loadRole()` genutzt und nach außen exportiert.
- `js/settings.js`: Reiter „🔑 Berechtigungen" zeigt zusätzlich die Karte
  **👑 Haupt-Administration** – Tabelle der `hauptAdmins` mit Rolle `admin` und Quelle
  `config.js` plus Hinweis, dass Änderungen nur über einen Commit gehen.
- `setup-rundumdenjob.ps1`: neue Parameter `-PermPath` / `-HauptAdmin`
  (Default `administrator@dihag.com`) und Schritt **[4]**, der den Haupt-Admin idempotent in
  `AppPermissions` (App `rundumdenjob`, Rolle `admin`) einträgt, damit er auch im Admin-Portal
  auftaucht; scheitert der Zugriff, nur Warnung (config.js greift ohnehin).
- `README.md`: Abschnitt Rollen um die Haupt-Administration ergänzt; Einrichtung nennt jetzt
  ausdrücklich die Anmeldung als `administrator@dihag.com` für Schritt 3.
- `_test.html`: Testkonto auf `administrator@dihag.com` umgestellt.

**Verifikation:** `node --check` 7/7. Browser (Stubs): 8 Prüfungen grün – Haupt-Admin greift,
`isHauptAdmin` ignoriert Groß-/Kleinschreibung und lehnt fremde Konten ab, Karte
„Haupt-Administration" wird mit Quelle `config.js` gerendert. Weitere 4 Prüfungen mit einem
zweiten Konto (`fedorov@dihag.com`, kein Listeneintrag): bekommt `viewer`, sieht weder
Einstellungen noch Führungskräfte-Reiter, und wird über einen `AppPermissions`-Eintrag korrekt
auf `editor` gehoben. Konsole fehlerfrei.

## 2026-07-28 (1): „Access denied" bei der Einrichtung – Diagnose eingebaut

**Denis:** Meldung beim Schritt „1 · Listen anlegen":
`Liste „RUDJ_Gesellschaften" wird geprüft … ✗ Access denied`

Ursache liegt außerhalb der App (SharePoint bzw. Token), war aber aus der Meldung nicht
unterscheidbar. Statt zu raten, macht die App den Fall jetzt selbst diagnostizierbar.

- `js/graph.js`: Fehler tragen zusätzlich `request` und `detail`
  (`METHOD /pfad → HTTP <status> <code>: <message>`). Damit steht im Protokoll, *welcher*
  Aufruf gescheitert ist – der Listen-GET (404 = fehlt, harmlos) oder der Listen-POST (403).
- `js/auth.js`: neue Funktion `tokenInfo()` – dekodiert die Nutzlast des Access-Tokens
  (base64url, ohne Signaturprüfung, rein zur Diagnose) und liefert `scopes` (`scp`), `upn`,
  `appId` und `exp`.
- `js/settings.js`:
  - Einrichtungs-Protokoll nutzt `e.detail` und verweist bei 403 auf die Diagnose-Karte.
  - Neue Karte **🩺 Diagnose** mit zwei Knöpfen:
    - *🔍 Diagnose starten* (nur lesend): Konto + Rolle, App-Registrierung, Token-Ablauf,
      Token-Scopes inkl. Abgleich gegen `C.scopes` samt Klartext-Hinweis, wenn
      `Sites.ReadWrite.All` fehlt; danach Site lesbar?, Listen der Site lesbar?, und je
      Konfigurationsliste vorhanden / fehlt (404) / Fehler.
    - *🧪 Schreibtest auf der Site*: legt `RUDJ_Schreibtest` an und löscht sie sofort wieder
      (räumt auch eine Liste aus einem früheren Test auf). Bei 403 folgt die Auflösung
      „Token ok, aber Konto darf auf der Site keine Listen anlegen" mit beiden Auswegen
      (Websitebesitzer bzw. `setup-rundumdenjob.ps1 -SkipAppReg`).
- `README.md`: neuer Abschnitt **Fehlersuche** für „Access denied" und AADSTS50011.

**Verifikation:** `node --check` 7/7. Test-Harness um steuerbare Fehlerfälle erweitert
(`TESTDB.scopes`, `TESTDB.denyWrite`, `TESTDB.listsMissing`, echtes Test-JWT via `mkTestToken`,
Site-/Listen-Pfade im GRAPH-Stub). Geprüft im Browser:
- Fall A (Scope fehlt): Diagnose weist `Sites.ReadWrite.All` als „NICHT im Token" aus und
  nennt App-Registrierung + nötige Admin-Zustimmung.
- Fall B (Scope vorhanden, Site verweigert): Diagnose meldet „alle Berechtigungen enthalten",
  Site + Listen lesbar, drei Listen „fehlt noch"; Schreibtest liefert
  `POST /sites/…/lists → HTTP 403 accessDenied` samt Auflösung und beiden Auswegen.
- Erfolgsfall: Schreibtest legt an, löscht wieder (`probeDeleted = true`), Konfiguration
  unverändert.
- Einrichtungs-Protokoll zeigt bei 403 jetzt `POST /sites/…/lists → HTTP 403 accessDenied:
  Access denied` plus Verweis auf die Diagnose-Karte.
Konsole fehlerfrei.

## 2026-07-28 (2): Ursache geklärt – Websiteberechtigung; App-only-Weg ergänzt

**Diagnose-Protokoll von Denis (Konto administrator@dihag.com):** Token vollständig
(`Mail.Send, Sites.ReadWrite.All, User.Read, User.Read.All, User.ReadBasic.All, profile,
openid, email` → „✓ Alle benötigten Berechtigungen“), Site `/sites/IT` lesbar, 33 Listen
lesbar, die drei RUDJ-Listen fehlen noch. Schreibtest:
`POST /sites/dihag.sharepoint.com,1618712f-…,b93e94cf-… /lists → HTTP 403 accessDenied`.
→ **Ursache 2 bestätigt:** Das Konto hat auf `/sites/IT` Mitglieds-/Bearbeitungsrechte
(deshalb funktioniert ZAPP, das nur Listeneinträge schreibt), aber keinen Vollzugriff und
darf daher keine Listen erstellen.

**Korrektur eines Fehlers in der eigenen Empfehlung:** Der Hinweis „Listen per PowerShell
anlegen – das umgeht die App komplett“ war irreführend. `Connect-MgGraph` mit delegierten
Scopes läuft als dasselbe angemeldete Benutzerkonto und läuft in genau denselben 403; es
umgeht nur den Browser, nicht die SharePoint-Berechtigung. Korrigiert in App-Protokoll und
README.

- `setup-rundumdenjob.ps1` grundlegend erweitert: neue **Betriebsart App-only**
  (`-AppOnly -AppClientId -AppSecret [-AppTenantId]`). Alle Graph-Aufrufe laufen jetzt über
  die Hülle `Gx` (Methode/Uri/Body), die entweder `Invoke-MgGraphRequest` (delegiert) oder
  `Invoke-RestMethod` mit Client-Credentials-Token (`Get-AppToken`, mit Ablauf-Cache) nutzt.
  App-only ist unabhängig von Benutzer- und Websiteberechtigungen, braucht dafür
  `Sites.FullControl.All` als **Application**-Berechtigung mit Administratorzustimmung.
  `Ensure-List` erklärt bei 403 im Klartext, was fehlt und welcher Weg hilft; Schritt 1
  (Redirect-URI) bricht nicht mehr hart ab, sondern warnt und verweist auf `-SkipAppReg`.
  Secret wird als `SecureString` übernommen und nur im Speicher entpackt.
- `js/settings.js`: Der 403-Block im Schreibtest nennt jetzt drei Wege statt zwei, sagt
  ausdrücklich, dass nur dieser eine Einrichtungsschritt betroffen ist (der Betrieb braucht
  nur Item-Rechte), und warnt beim PowerShell-Weg vor genau der Fehlannahme von vorher.
- `README.md`: eigener Abschnitt „403 beim Anlegen der Listen (Websiteberechtigung)“ mit den
  drei Wegen; Verweis auf die bestehende Registrierung „DIHAG Cron-Job“
  (`089bf9ad-2d9a-4cbc-b85d-88b4484af0bb`) als App-only-Kandidat.

**Verifikation:** `node --check` 7/7. PowerShell-Parser über `setup-rundumdenjob.ps1` ohne
Fehler. `-AppOnly` ohne Client-Id/Secret bricht wie vorgesehen mit
„-AppOnly braucht -AppClientId und -AppSecret." ab (kein Netzzugriff davor). Browser: der
403-Zweig des Schreibtests gibt den korrigierten Text mit allen drei Wegen aus, Konsole
fehlerfrei. Der App-only-Graph-Pfad selbst ist unverifiziert – dafür wäre ein Client Secret
nötig, das hier nicht vorliegt.

## 2026-07-28 (3): Listen von Hand anlegen – Spaltenvorgabe + Spaltenprüfung

**Denis:** „wahrscheinlich ist es besser wenn ich die listen selbst erstelle!"

**Zwei eigene Fehler beim Aufschreiben der Vorgabe gefunden und behoben** (`js/seed.js`,
`setup-rundumdenjob.ps1`): „Einzelne Textzeile" ist in SharePoint auf **255 Zeichen**
begrenzt, `colText("Domains", 500)` und `colText("Url", 900)` waren also ungültig.
`Domains` → 255; `Url` → mehrzeiliger Klartext (SharePoint-URLs mit Parametern können
255 Zeichen überschreiten). Im PS-Skript `Url` von `text` auf `note` geändert.

**Neu `LISTEN-ANLEGEN.md`:** vollständige Anlage-Anleitung für die drei Listen mit exaktem
Spaltennamen, SharePoint-Typ und Zweck; vorangestellt fünf Regeln, an denen es sonst
scheitert – Name = interner Feldname und nachträglich nicht änderbar; keine Leerzeichen/
Umlaute (daher `Kuerzel`, `GueltigVon`); mehrzeilig immer **Nur Text**, nie Rich-Text
(sonst liefert Graph HTML und die Kacheln zeigen Markup); `Title` nicht anlegen, nur
umbenennen; Standardwerte der Ja/Nein-Spalten. Plus Berechtigungs- und Kontrollabschnitt.

**`js/seed.js`:** neues Export `EXPECTED` (erwartete Feldnamen je Liste, inkl. `Title`).

**`js/settings.js` – Diagnose prüft jetzt auch Spalten:** je vorhandener Liste werden die
Spalten gelesen und gegen `SEED.EXPECTED` abgeglichen. Fehlende werden namentlich genannt;
weicht nur die Schreibweise ab, wird der tatsächliche interne Name aufgelöst
(`Domains → heißt intern „Domaenen"`) – genau der Fall, der beim Anlegen per Hand passiert.
Am Ende entweder „Alles vollständig" mit Verweis auf Schritt 2/3, oder Verweis auf
LISTEN-ANLEGEN.md.

**Dabei einen echten Fehler in der eigenen Diagnose gefunden:** waren die Spalten nicht
lesbar, wurde trotzdem „Alles vollständig" gemeldet. `alleDa = false` im catch nachgezogen –
ohne Spaltenliste ist Vollständigkeit nicht belegt.

**`_test.html`:** Skripte werden per `document.write` mit Cache-Buster geladen (der Browser
hatte eine alte `seed.js` behalten und die Prüfung dadurch verfälscht – erst dadurch fiel
auf, dass `SEED.EXPECTED` gar nicht ankam). Stub liefert jetzt auch `/columns` und kann per
`TESTDB.colTypo` einen Tippfehler simulieren.

**`README.md`:** Einrichtung nennt den Weg „von Hand in SharePoint" mit Link auf
LISTEN-ANLEGEN.md.

**Verifikation:** `node --check` 7/7. Browser:
- Fall A (korrekt angelegt): `✓ alle 7 / 8 / 14 Spalten vorhanden` + „Alles vollständig".
- Fall B (`Domains` als `Domaenen`, `MinRolle` fehlt): „⚠ fehlende Spalten: Domains,
  MinRolle" und „↳ Domains → heißt intern „Domaenen"" – unterscheidet also eine wirklich
  fehlende von einer falsch benannten Spalte.
- Schritte 2 + 3 gegen von Hand angelegte Listen bei weiterhin verbotenem Listen-Anlegen
  (`denyWrite = true`): 3 Gesellschaften / 8 Reiter / 16 Kacheln, Gesellschaft erkannt.
  Bestätigt, dass für den Betrieb nur Item-Schreibrechte nötig sind.
- Spaltenspezifikation gegengeprüft: `Url` mehrzeilig, `Domains` maxLength 255.
Konsole fehlerfrei.

## 2026-07-28 (4): Spaltennamen-Toleranz – „Typ" heißt in SharePoint „Typ2"

**Denis:** „es heißt statt Typ, Typ2"

SharePoint hat beim Anlegen der Spalte `Typ` den internen Namen `Typ2` vergeben – derselbe
Fallstrick wie `Version` → `Version1` im Richtlinienmanagement. **Nicht** im Code umbenannt,
sondern die App tolerant gemacht; sonst bricht es beim nächsten Neuanlegen wieder, und die
Anleitung müsste je Umgebung anders lauten.

**`js/graph.js` – neue Zuordnungsschicht:**
- `columns(site, liste)` liest `name` + `displayName`.
- `fieldMap(site, liste, erwartet, force)` baut je Liste einmalig „erwarteter Name → tatsächlicher
  interner Name“. Auflösungsreihenfolge: exakter Treffer → Ziffernanhang (`^Typ\d+$` → `Typ2`)
  → gleicher Anzeigename → gleiche Schreibweise case-insensitiv → unabgebildet (Spalte fehlt
  wirklich).
- `normalize()` beim Lesen: der App-Code benutzt weiter `k.Typ`, das Rohfeld `Typ2` bleibt
  zusätzlich erhalten. `denormalize()` beim Schreiben: `Typ` geht als `Typ2` raus; Felder, deren
  Spalte fehlt, werden mit `console.warn` verworfen statt einen 400 auszulösen.
- `listItems(site, name, expected, top)` – dritter Parameter neu (vorher `top`; kein Aufrufer
  hatte ihn gesetzt), aktiviert die Toleranz. `addItem`/`updateItem` wenden sie automatisch an,
  sobald die Zuordnung im Cache steht. `clearColumnCache()` wird von `DATA.clearCache()`
  mitgerufen, damit eine in SharePoint korrigierte Spalte sofort greift.

**Aufrufer nachgezogen:** `data.js` (Konfigurationslisten mit `SEED.EXPECTED.*`, AppPermissions
mit `["Title","UserEmail","App","Role"]`), `seed.js` (alle drei Dedup-Abfragen), `settings.js`
(Berechtigungsliste).

**Diagnose unterscheidet jetzt drei Fälle** statt zwei: `✓ alle N Spalten nutzbar`,
`· Typ heißt intern „Typ2" – wird automatisch berücksichtigt` (Hinweis, kein Fehler) und
`⚠ fehlende Spalten: …` (nicht zuordenbar). `fieldMap` wird dort mit `force=true` gerufen,
damit die Prüfung nie aus dem Cache kommt.

**Neuer Node-Test `tests/test-graph-fieldmap.mjs`:** Das Browser-Harness ersetzt `GRAPH`
komplett – die neue Logik wäre dort ungetestet geblieben. Der Test lädt die **echte**
`js/graph.js` in einen `vm`-Kontext und stubt nur `fetch` und `AUTH.getToken`.
**13/13 grün:** `Typ`→`Typ2` abgebildet, exakte Namen unverändert, fehlendes `Badge` und
wirklich anders benanntes `Domaenen` bleiben unabgebildet, Lesen liefert `Typ` aus `Typ2`,
Schreiben sendet `Typ2` und lässt `Badge` weg, PATCH ebenso, und nach `clearColumnCache()`
greift eine korrigierte Spalte.

**`LISTEN-ANLEGEN.md`:** Regel 1 erklärt den Ziffernanhang samt Beispielausgabe und grenzt ihn
gegen einen wirklich falschen Namen ab; Kontrollabschnitt auf die drei Meldungsarten umgestellt.

**Browser-Verifikation** (Harness um `TESTDB.typ2` und `/columns` erweitert, `fieldMap` im Stub
nachgebildet): Fall `Typ2` → Hinweiszeile + „alle 14 Spalten nutzbar (1 mit abweichendem
internen Namen)" + „Alles vollständig"; zusätzlich fehlende/falsch benannte Reiter-Spalten
werden weiter als `⚠` gemeldet. Konsole fehlerfrei.

## 2026-07-28 (5): Gesellschaften ausdünnen – Mehrfachauswahl + „Nur behalten“

**Denis:** braucht nur 11 Domänen (dihag.com, shb-guss.de, walze-coswig.de, schmie-guss.de,
meuselwitz-guss.de, ewa-guss.de, lintorfereg.de, dihag-gienanth.com, dihag-zaigler.com,
dihag-hasenclever.com, schmie-cnc.de) – „der rest kann entfernt werden“. Die Domänensuche
hatte deutlich mehr angelegt; einzeln löschen wäre mühsam.

**`js/settings.js`, Reiter Gesellschaften:**
- Auswahlspalte je Zeile plus Kopf-Checkbox „Alle auswählen“; Knopf
  **🗑 n Ausgewählte löschen** zeigt die Anzahl und ist ohne Auswahl deaktiviert.
- **🧹 Nur bestimmte behalten …**: Textfeld, eine Domäne je Zeile, mit den vorhandenen
  Domänen vorbelegt. Führende `@` werden toleriert (so lässt sich direkt aus der Tabelle
  kopieren), Trennung über `DATA.parseList` (Zeilenumbruch/Komma/Semikolon, klein, getrimmt).
  Alles, was nicht in der Liste steht, geht in die Löschvorschau.
- `bulkDelete(opfer)` löscht nie ungefragt: Vorschau listet **jeden** betroffenen Eintrag
  namentlich; ist die **Standard-Gesellschaft** dabei, erscheint zusätzlich eine Warnung, dass
  Konten mit unbekannter Domäne danach keine Zuordnung mehr bekommen. Hinweis, dass Reiter und
  Kacheln unberührt bleiben (nur deren Domänenfilter kann wirkungslos werden).

**Verifikation:** `node --check` 7/7, `tests/test-graph-fieldmap.mjs` 13/13.
Browser mit realistischem Ausgangsstand (die 11 gewünschten + 4 Ballast-Domänen):
- „Nur behalten“ mit exakt Denis' Liste **inklusive führender `@`** → Vorschau schlägt genau
  altfirma.de, test.de, extern-partner.com, nichtmehr.de vor, keine Standard-Warnung; nach
  Bestätigung bleiben 11 Einträge, Standard weiterhin dihag.com.
- Checkbox-Weg: Auswahl aktualisiert den Knopftext („🗑 2 Ausgewählte löschen“), Auswahl der
  Standard-Zeile blendet die Warnung ein, **Abbrechen ändert nichts** (11 Einträge unverändert),
  „Alle auswählen“ → 11, Abwählen deaktiviert den Knopf wieder.
Konsole fehlerfrei.

## 2026-07-28 (6): Reiterleiste ohne Scrollbalken + Einrichtungs-Reiter entfernt

**Denis:** „mir gefällt nicht dass die Reiter mit einem Balken hin und hergeschoben werden
können, ich will dass die auf die Seite passgenau sind und schick aussehen im Stil von
SharePoint Intranet“ – und im selben Zug: „einrichtung kann entfernt werden“.

**Reiterleiste (`css/styles.css` + `js/app.js`):**
- `overflow-x: auto` (der sichtbare Balken) → `overflow: hidden`. Was nicht in die Breite
  passt, wandert hinter **„⋯ Mehr“** mit Ausklappmenü – dasselbe Muster wie in der echten
  SharePoint-Websitenavigation (dort das `⋯` neben „So arbeiten wir“).
- Optik an SharePoint angeglichen: heller Streifen (#fff) mit Unterkante statt azurblauem
  Band, Navy-Text, aktiver Punkt fett mit orangefarbenem Unterstrich. Reiter etwas kompakter
  (13,5 px, Innenabstand 11 px) – dadurch passen bei 1180 px sieben statt sechs Reiter direkt
  in die Zeile.
- `layoutTabs()` misst mit allen Reitern sichtbar, rechnet die Kappungsgrenze gegen die
  Breite des „Mehr“-Knopfes und blendet den Rest aus; mindestens ein Reiter bleibt immer
  stehen. Liegt der aktive Reiter im Menü, wird „Mehr“ hervorgehoben und der Eintrag im Menü
  markiert. Menü schließt bei Klick daneben, Escape und nach Auswahl.
- Neu berechnet wird bei `ResizeObserver` auf der Leiste, zusätzlich bei `window.resize`,
  bei jedem Reiterwechsel und nach `document.fonts.ready` – Letzteres, weil Exo nachgeladen
  wird und die Textbreiten dadurch nachträglich wachsen.
- **Zwei Fehler dabei gefunden und behoben:** (1) Der `ResizeObserver` wurde ohne
  festgehaltene Referenz erzeugt (`new ResizeObserver(fn).observe(el)`) – ein nicht
  referenzierter Observer darf eingesammelt werden und feuert dann nicht mehr; jetzt in
  `_tabObserver` gehalten. (2) Rückkopplungsschutz `_laying`, damit ein durch das Umschalten
  ausgelöstes Resize keine Schleife erzeugt.

**Einrichtungs-Reiter entfernt (`js/settings.js`):** Unterreiter „🛠️ Einrichtung“ → **„🩺
Diagnose“**. Die drei Einrichtungsschritte (Listen anlegen / Gesellschaften übernehmen /
Startinhalte anlegen) und ihr Protokoll sind weg; Diagnose, Schreibtest, „Konfiguration neu
laden“ und die Erklärung zur Sichtbarkeitskette bleiben. Abschlusstext der Diagnose auf
„Alles in Ordnung – Listen und Spalten sind vollständig nutzbar.“ umgestellt (verwies vorher
auf die entfallenen Schritte 2 und 3). Unbekannte Unterreiter fallen jetzt auf
Gesellschaften zurück statt einen Fehler zu werfen.
`SEED.ensureLists/seedGesellschaften/seedContent` bleiben in `seed.js` – sie sind nur nicht
mehr aus der Oberfläche erreichbar und der dokumentierte Weg für eine neue Umgebung
(`setup-rundumdenjob.ps1`, LISTEN-ANLEGEN.md). `SEED.EXPECTED` wird weiterhin aktiv genutzt.

**Verifikation:** `node --check` 7/7, `tests/test-graph-fieldmap.mjs` 13/13.
Browser (Harness um Cache-Buster fürs Stylesheet ergänzt – die alte CSS kam aus dem Cache und
hätte den Test verfälscht):
- Bei 1180 px: 7 Reiter sichtbar, 2 im Menü, `scrollWidth == clientWidth` (kein Überlauf),
  Navigationshintergrund #fff, Text Navy.
- Breitenreihe 900 / 640 / 380 / voll: 4 / 3 / 1 / 7 Reiter sichtbar, **in keiner Stufe ein
  Überlauf**, „Mehr“ jeweils vorhanden.
- Menü: öffnet, listet genau die ausgeblendeten Reiter, Klick auf „Führungskräfte“ öffnet den
  Reiter, schließt das Menü und hebt „Mehr“ hervor.
- Einstellungen: fünf Unterreiter ohne „Einrichtung“, Diagnose-Reiter enthält nur noch die
  drei erwarteten Knöpfe, Diagnoselauf meldet „Alles in Ordnung“.
Konsole fehlerfrei.

**Nicht verifizierbar in dieser Umgebung:** Die Browser-Pane kompositiert keine Frames,
deshalb liefert der `ResizeObserver` dort keine Callbacks; die Neuberechnung wurde über den
zusätzlich registrierten `window.resize`-Pfad geprüft. Screenshots waren aus demselben Grund
nicht möglich.

## 2026-07-28 (7): Import / Export für Entra ID (On-/Offboarding, Migration)

**Denis:** „Import und eXport bei Einstellungen hinzufügen um alle Azure mit allen
Notwendigen Feldern für On und offboardings oder allgemein Migration“

**Neuer Unterreiter „📦 Import / Export“** (zwischen Berechtigungen und Diagnose), neue Datei
`js/impexp.js` (~780 Zeilen), eingehängt über `index.html` und `SETTINGS.SUBS`.

**Feldkatalog (36 Felder)** mit je `graph`-Feldname, Vorlagenzugehörigkeit, Schreibbarkeit und
nötiger Zusatzberechtigung. Drei Vorlagen: Onboarding (Stammdaten), Offboarding (Kontostatus,
Austrittsdatum, Lizenzen, Gruppen, letzte Anmeldung), Migration (alles). Feldauswahl frei
anpassbar.

**Export:** `/users` mit `$select` + `$expand=manager`, Paging über `callAll`.
Lizenz-SKUs werden über `/subscribedSkus` in Klarnamen übersetzt, Gruppen optional je Konto
(als „langsam“ gekennzeichnet). Filter: nur aktive, Gastkonten, nur gepflegte Domänen.
Ausgabe als CSV (Semikolon, UTF-8 mit BOM, CRLF – deutsches Excel) oder JSON.
**Selbstheilung bei fehlenden Rechten:** schlägt der Abruf fehl, wird ohne die Felder mit
`perm` erneut versucht; die Spalte bleibt leer und das Protokoll nennt die fehlende
Berechtigung (`AuditLog.Read.All`, `User-LifeCycleInfo.Read.All`), statt den ganzen Export zu
verlieren.

**Import (nur Aktualisierung vorhandener Konten):** eigener CSV-Parser (erkennt `;` oder `,`,
versteht Anführungszeichen samt Verdopplung, BOM, CRLF/LF), JSON ebenfalls möglich.
Spaltenzuordnung akzeptiert deutsche Bezeichnung **und** technischen Schlüssel, tolerant
gegenüber Schreibweise und Leerzeichen. Abgleich über UPN/ID/Personalnummer/E-Mail.
Leere Zelle = nicht ändern, `-` = leeren. Datum `TT.MM.JJJJ` und `JJJJ-MM-TT`, Mehrfachwerte
über `|;,`. `🔍 Prüfen` schreibt nichts und zeigt eine Vorschau vorher→nachher je Feld;
`⬆️ Übernehmen` erst nach Bestätigungsdialog mit Anzahl. Führungskraft über
`PUT /users/{id}/manager/$ref`. Fehlerzeilen als CSV.

**Bewusste Grenzen** (im Code und in der Oberfläche begründet): keine Kontenanlage, keine
Kennwörter, kein Ändern von UPN/E-Mail, keine Lizenz- oder Gruppenzuweisung. Für Neuanlagen
erzeugt die App die **offizielle Entra-Massenimport-Vorlage** (Portal vergibt das Kennwort).
Die Spalte „Konto aktiv“ wird nur mit ausdrücklichem Häkchen übernommen; der
Bestätigungsdialog nennt dann die Zahl der zu deaktivierenden Konten.

**Berechtigung:** `User.ReadWrite.All` steht absichtlich **nicht** in `RUDJ_CONFIG.scopes` –
sonst müsste jede Anmeldung im Tenant zustimmen. `js/auth.js` `startLogin(prompt, extraScopes)`
fordert sie einmalig an (`prompt=consent`), der Reiter erkennt über `AUTH.tokenInfo()`, ob sie
vorliegt.

**Portalkonfiguration:** Gesellschaften/Reiter/Kacheln als JSON exportieren und importieren
(ohne SharePoint-IDs). Import legt nur Fehlendes an, überschreibt nie.

**Dabei gefunden und behoben:** Nach dem Konfig-Import erschienen neue Reiter erst nach
manuellem Neuladen. `js/app.js` bekam `refreshTabs()` (Leiste neu aufbauen ohne den
angezeigten Inhalt zu verwerfen), das `konfigImport` nun aufruft.

**Verifikation:**
- `node --check` 8/8. Neuer Node-Test `tests/test-impexp.mjs` lädt die **echte** `js/impexp.js`
  im `vm` mit minimalen Stubs: **43/43 grün** – CSV mit BOM/CRLF/Semikolon, Maskierung von
  `"` und `;`, Rundlauf schreiben→lesen, Komma-CSV, verdoppelte Anführungszeichen, Leerzeilen;
  Spaltenzuordnung deutsch/technisch; Wertumwandlung (leer/`-`/Ja/Nein/Listen/beide
  Datumsformate/unlesbares Datum wird verworfen); Ist-Werte inkl. Manager und Listenvergleich;
  Katalogregeln (UPN, E-Mail, Lizenzen, Gruppen nicht beschreibbar; kein beschreibbares Feld
  berührt Kennwörter). `tests/test-graph-fieldmap.mjs` weiter 13/13.
  Ein Testfehlschlag war mein eigener Test (`lastPasswordChange` matchte /pass/) – Prüfung auf
  die tatsächliche Absicht umgestellt.
- Browser gegen ein simuliertes Verzeichnis (5 Konten inkl. Gast, deaktiviertem Konto,
  Manager, Lizenz): Export Offboarding liefert 4 Zeilen mit aufgelöster Lizenz
  (`ENTERPRISEPACK`) und Manager; Gastkonto übersprungen; mit Filtern 3 Zeilen.
  Fehlendes `AuditLog.Read.All` → Rückfall greift, Spalte bleibt vorhanden **und leer**,
  Manager trotzdem befüllt (Stub bildet `$select` nach).
  Import: 1 Konto geändert, 1 unverändert, 1 unbekannt; PATCH enthält exakt
  `{department, officeLocation}`. Offboarding-Lauf: **ohne** Häkchen wird `accountEnabled`
  nicht geschrieben (nur Austrittsdatum + Telefon) und keine Warnung gezeigt, **mit** Häkchen
  erscheint „1 Konten deaktiviert“ und der PATCH enthält `accountEnabled:false`;
  Manager per `PUT …/manager/$ref` mit korrekter Ziel-ID; deutsches Datum korrekt zu
  `2026-08-31T00:00:00Z` gewandelt.
  Vorlagen: leere Vorlage nur mit Kopfzeile; Entra-Massenimport enthält `[passwordProfile]`
  mit **leerer** Kennwortspalte. Konfig-Export ohne IDs; Reimport 0 angelegt / 39 übersprungen;
  mit einem zusätzlichen Reiter genau 1 angelegt und sofort in der Navigation.
  Konsole fehlerfrei.

**Anmerkung zu einer früheren Fehlvermutung:** Ein Testlauf meldete „3 Einträge angelegt“ und
einen doppelten Reiter – Ursache war mein eigener, bereits veränderter Teststand innerhalb
derselben Seitensitzung, nicht der Code. Frisch geladen: 1 angelegt, keine Dopplung.

## 2026-07-28 (8): Eigene Domäne rundumdenjob.dihag.de

**Denis:** „ich habe cname und weblink in Azure angepasst auf rundumdenjob.dihag.de“ / „und
github auch“.

Vorgefunden: GitHub Pages steht bereits auf `rundumdenjob.dihag.de`, HTTPS erzwungen, Status
`built`; die `CNAME`-Datei hatte GitHub beim Setzen der Domain selbst ins Repo committet
(`cbc10f1 Create CNAME`) – lokal nur `git pull` nötig, nichts anzulegen.

**Live geprüft:** `https://rundumdenjob.dihag.de/` → 200, `js/impexp.js` → 200,
`assets/dihag-logo.png` → 200; `https://dfedorov12.github.io/rundumdenjob/` → **301** auf die
neue Adresse.

**Härtung in `js/auth.js`:** Die Redirect-URI wurde als `location.origin + location.pathname`
gebildet. Auf der eigenen Domäne ist das `/`, aber ein Aufruf mit `/index.html` (Lesezeichen,
verlinkte Adresse) hätte eine Adresse erzeugt, die nicht in Entra registriert ist → AADSTS50011.
Jetzt wird `index.html`/`index.htm` abgeschnitten und ein Schrägstrich am Ende erzwungen.
Isoliert nachgerechnet, 6/6 Fälle korrekt: `/`, `/index.html`, `/index.htm`,
`/rundumdenjob/`, `/rundumdenjob/index.html` – die Ableitung bleibt dynamisch, damit dieselbe
Auslieferung unter eigener Domäne **und** github.io funktioniert.

**Doku nachgezogen:** README-Kopf auf die neue Live-Adresse (mit Hinweis auf die Umleitung),
Einrichtung Schritt 1 nennt beide Redirect-URIs, Fehlersuche-Abschnitt AADSTS50011 umformuliert
(„genau der Ursprung mit Schrägstrich am Ende"), `js/config.js`-Kommentar entsprechend,
`setup-rundumdenjob.ps1` Standard-`-RedirectUri` auf `https://rundumdenjob.dihag.de/`.

**Dabei aufgeräumt:** Mehrere Stellen verwiesen noch auf den in (6) entfernten
Einrichtungs-Reiter und seine Schritte „2 · Gesellschaften aus Tenant übernehmen“ /
„3 · Startinhalte anlegen“ – README (Einrichtung Schritt 2/3, Fehlersuche),
LISTEN-ANLEGEN.md (Einleitung + Kontrolle), `js/settings.js` (Banner bei fehlender Liste und
Dateikommentar). Alle auf Diagnose bzw. die Inhaltsreiter umgestellt.

**Verifikation:** `node --check` 8/8, `tests/test-impexp.mjs` 43/43,
`tests/test-graph-fieldmap.mjs` 13/13, keine Verweise mehr auf entfallene Schritte.
