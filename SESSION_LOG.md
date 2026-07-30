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

## 2026-07-28 (9): Zusatz-Berechtigungen wirken erst, wenn sie angefordert werden

**Denis:** Export meldete
`HTTP 403 Authentication_MSGraphPermissionMissing: The principal does not have required
Microsoft Graph permission(s): AuditLog.Read.All` – „die rechte sind aber da“.

**Ursache:** Die Rechte sind in Entra erteilt, standen aber nicht im **Zugriffstoken**. Die
App fordert nur die fünf Scopes aus `RUDJ_CONFIG.scopes` an; `AuditLog.Read.All` und
`User-LifeCycleInfo.Read.All` sind bewusst nicht darunter (sonst lägen sie in jedem Token
jeder Anmeldung). Erteilte Zustimmung ≠ angeforderter Scope – Graph sieht nur das Token.

- `js/impexp.js`: neue Funktion `fehlendeZusatzrechte(keys)` vergleicht die von den gewählten
  Feldern verlangten Berechtigungen mit `AUTH.tokenInfo().scopes`. Die Export-Karte zeigt bei
  Bedarf einen Hinweis, welches Feld welche Berechtigung braucht, erklärt den Unterschied
  zwischen „in Entra erteilt“ und „im Token“, und bietet **🔐 Zusatzrechte anfordern**.
  `anfordern()` startet die Anmeldung mit `prompt=none` – ist die Zustimmung erteilt, läuft
  das ohne Rückfrage durch. Die Fallback-Meldung im Protokoll sagt jetzt „… ist nicht im
  Token“ statt „… fehlt“ und verweist auf den Knopf.
- `js/auth.js`: **Fehler behoben** – schlug der stille Versuch fehl, forderte der automatische
  interaktive Nachschlag die Zusatz-Scopes nicht mehr an (`startLogin("select_account")` ohne
  `extraScopes`); man wäre mit einem Token ohne die angeforderten Rechte zurückgekommen. Die
  Zusatz-Scopes werden jetzt in `rudj_px` über den Redirect gemerkt und beim Nachschlag
  wiederverwendet; Aufräumen beim Erfolg ergänzt.
- `js/settings.js`: Die Diagnose listet zusätzlich die **optionalen** Berechtigungen
  (`User.ReadWrite.All`, `AuditLog.Read.All`, `User-LifeCycleInfo.Read.All/.ReadWrite.All`)
  mit ✓/· und Zweck – samt Hinweis, dass „·“ nur „nicht im aktuellen Token“ heißt.
- `README.md`: Abschnitt Export um genau diese Unterscheidung ergänzt (mit der Original-
  Fehlermeldung), Verweis auf die Diagnose.

**Verifikation:** `node --check` 8/8; `tests/test-impexp.mjs` um 7 Prüfungen auf
`fehlendeZusatzrechte` erweitert → **50/50 grün** (nichts gewählt → nichts nötig; nur
lastSignIn → nur AuditLog; mit Scope im Token → nichts offen; Gruppen brauchen kein
Zusatzrecht). `tests/test-graph-fieldmap.mjs` 13/13.
Browser: Offboarding-Vorlage ohne die Scopes → Hinweis nennt „Austrittsdatum, Letzte
Anmeldung“ und beide Berechtigungen, Knopf ruft `startLogin("none", [beide Scopes])`.
Mit den Scopes im Token: Hinweis in der Export-Karte verschwindet (Import-Karte warnt
weiterhin korrekt wegen `User.ReadWrite.All`), Export läuft ohne Rückfall durch und die Spalte
„Letzte Anmeldung“ ist befüllt. Diagnose zeigt die optionale Liste mit ✓/· korrekt.
Konsole fehlerfrei.

## 2026-07-28 (11): Rolle blieb nach Vergabe auf „viewer“

**Denis:** Profil zeigt `viewer`, obwohl in Berechtigungen ein Eintrag
`fedorov@dihag.com / rundumdenjob / editor` steht – „warum?“

**Ursache (im Code verifiziert):** `loadRole()` wird ausschließlich aus `loadUser()` beim
Anmelden aufgerufen; danach berührt nichts mehr `ctx.role`. Ein Eintrag, der nach der
Anmeldung entsteht, wirkt in der laufenden Sitzung nicht. Kein Fehler in der Auswertung –
die Zuordnung (E-Mail klein, App = `rundumdenjob` oder `*`, RANK-Vergleich) stimmt.

**Zweiter Punkt, der zur Verwirrung beiträgt:** `editor` öffnet die Einstellungen **nicht**.
Nur `admin` tut das; `editor` gibt lediglich Inhalte mit Mindestrolle `editor` frei.

- `js/data.js`: neue exportierte Funktion `reloadRole()` – liest die Rolle erneut und meldet
  `{alt, neu, geaendert}`.
- `js/settings.js`: `rolleUebernehmen()` nach jedem Vergeben/Entfernen einer Rolle; ändert
  sich dabei die eigene Rolle, wird über `APP.refreshTabs()` sofort die Navigation angepasst
  (Einstellungen erscheint bzw. verschwindet). Neuer Knopf **🔄 Meine Rolle neu einlesen**
  zeigt die aktuelle Rolle im Beschriftungstext. Die eigene Zeile in der Tabelle ist mit
  „Ihr Konto“ markiert. Zwei Hinweistexte ergänzt: dass die Rolle beim Anmelden gelesen wird,
  und dass nur `admin` die Einstellungen öffnet.
- `README.md`: entsprechender Kasten im Abschnitt Rollen.

**Verifikation:** `node --check` 8/8, impexp 50/50, fieldmap 13/13.
Browser, Ablauf exakt nachgestellt: (1) Anmeldung ohne Eintrag → `viewer`;
(2) Eintrag `editor` wird angelegt → Sitzung zeigt weiter `viewer` (= gemeldeter Effekt);
(3) `reloadRole()` → `{alt:viewer, neu:editor, geaendert:true}`;
(4) auf `admin` geändert → Einstellungen-Reiter erscheint. Über die Oberfläche: Knopf zeigt
„(aktuell: admin)“, nach externem Zurückstufen auf `editor` meldet der Toast
„Rolle jetzt: editor (vorher admin)“ und der Einstellungen-Reiter verschwindet.
Konsole fehlerfrei.

## 2026-07-28 (12): „immer noch viewer, auch nach Neuanmeldung“ – Ursache sichtbar gemacht

**Denis:** Auch nach erneutem Anmelden bleibt die Rolle `viewer`.

**Meine vorherige Erklärung (Sitzung veraltet) war damit widerlegt** – `loadRole()` läuft bei
jeder Anmeldung, liefert aber selbst `viewer`. Statt erneut zu raten, sagt die App jetzt,
*warum* sie zu ihrem Ergebnis kommt. Verdächtig war vor allem der `catch`-Zweig in
`loadRole()`: er fing jeden Fehler ab, gab stillschweigend `defaultRole` zurück und schrieb
nur ein `console.warn` – ein 403 auf die Rechteliste sah damit wie „kein Eintrag vorhanden“ aus.

- `js/data.js`: `roleInfo` protokolliert die letzte Ermittlung (Quelle hauptadmin/liste/
  standard, Fehlertext, gelesene Zeilen, Treffer auf die E-Mail, davon mit passender App).
  `roleErklaerung()` formt daraus einen Satz. Fünf unterscheidbare Fälle statt einem stummen
  Fallback. `listItems === null` (Liste nicht gefunden **oder** kein Zugriff) wird eigens
  benannt, statt als „kein Eintrag“ durchzugehen.
- `js/app.js`: Die Profilkarte zeigt den Satz direkt unter der Berechtigung – als roter
  Kasten, wenn die Rechteliste nicht auswertbar war. Dazu der Knopf **🔄 Berechtigung neu
  prüfen**. Wichtig, weil ein `viewer` die Einstellungen gar nicht öffnen kann und die
  bisherige Diagnose damit unerreichbar war.
- `js/settings.js`: Diagnose gibt die Begründung zusätzlich aus.

**Verifikation:** `node --check` 8/8, impexp 50/50, fieldmap 13/13.
Browser, alle fünf Fälle durchgespielt:
a) passender Eintrag → `editor`, „1 passende(r) Eintrag (1 Zeilen gelesen)“;
b) kein Eintrag → „Kein Eintrag … (0 Zeilen gelesen)“;
c) Eintrag nur für andere App → „1 Eintrag auf diese E-Mail, aber keiner für App
   ‚rundumdenjob‘ oder ‚*‘“;
d) Liste nicht gefunden → „nicht gefunden oder für dieses Konto nicht lesbar“;
e) 403 → „GET … → HTTP 403 accessDenied: Access denied“.
Profilkarte: im Fehlerfall Klasse `err` (rot) mit der Graph-Meldung, nach Klick auf
„Berechtigung neu prüfen“ Toast „Berechtigung jetzt: editor“ und Text wechselt auf `hint`.
Konsole fehlerfrei.

**Offen:** Welcher der fünf Fälle bei Denis zutrifft, zeigt die Zeile in der Profilkarte nach
dem nächsten Laden. Wahrscheinlichster Kandidat ist (d)/(e): `fedorov@dihag.com` hat
möglicherweise keinen Lesezugriff auf `/sites/ticket`, wo `AppPermissions` liegt.

## 2026-07-28 (13): Rechteliste auf /sites/IT umgestellt

**Denis:** verweist auf `https://dihag.sharepoint.com/sites/IT/Lists/AppPermissions/` –
diese Liste soll genutzt werden, und bittet um die anzulegenden Felder.

Passt zur Vermutung aus (12): Die `RUDJ_`-Listen auf `/sites/IT` sind für sein Konto lesbar
(die Reiter erscheinen ja), `/sites/ticket` offenbar nicht – dort fiel `loadRole()` still auf
`viewer` zurück.

- `js/config.js`: `permSite` → `dihag.sharepoint.com:/sites/IT`, mit Begründung im Kommentar.
- `setup-rundumdenjob.ps1`: `-PermPath` Standard ebenfalls `/sites/IT`.
- `admin/index.html`: Reihenfolge in `SP_SITES` gedreht, damit `/sites/IT` Standard und
  `APPS_LESEN_VON` ist; `/sites/ticket` bleibt als „alte Liste“ umschaltbar.
- `LISTEN-ANLEGEN.md`: neuer Abschnitt **4 · Liste `AppPermissions`** mit Spaltentabelle
  (`UserEmail`, `App`, `Role` Pflicht; `UserDisplayName`, `Notes` optional), ausdrücklicher
  Warnung, `App`/`Role` **nicht** als Auswahl (Choice) anzulegen – genau daran scheiterte
  `rundumdenjob` in der alten Liste –, Hinweis auf den nötigen **Lesezugriff für alle**
  Mitarbeitenden und einer Beispielzeile.
- `README.md`: Abschnitt Rollen und Datenhaltung auf `/sites/IT` umgestellt, inkl. Kasten zur
  Ursache.
- `_test.html`: `config.js` wird jetzt ebenfalls mit Cache-Buster geladen – ohne das lief der
  Test gegen eine veraltete Konfiguration und zeigte weiter `/sites/ticket`.

**Verifikation:** `node --check` 8/8, impexp 50/50, fieldmap 13/13. Browser mit einem Stub,
der `AppPermissions` **nur** auf `/sites/IT` ausliefert und auf `/sites/ticket` mit 403
antwortet: Rolle `admin`, Begründung „Aus AppPermissions: 1 passende(r) Eintrag (1 Zeilen
gelesen)“, Einstellungen-Reiter sichtbar. Gegenprobe mit `permSite = /sites/ticket`:
`viewer` samt 403-Begründung. Konsole fehlerfrei.

## 2026-07-28 (14): Bestätigung + Aufräumen der Profilkarte

**Denis:** „Aus AppPermissions: 1 passende(r) Eintrag/Einträge (1 Zeilen gelesen).
🔄 Berechtigung neu prüfen klappt, kann wieder raus“

Damit ist die Ursache aus (12)/(13) bestätigt: Die Liste war auf `/sites/ticket` für sein
Konto nicht lesbar; auf `/sites/IT` greift die Rolle sofort.

- `js/app.js`: Knopf **🔄 Berechtigung neu prüfen** samt Handler aus der Profilkarte entfernt.
  Die Begründungszeile bleibt, wird aber **nur noch im Fehlerfall** gezeigt
  (`DATA.roleInfo.fehler`) – im Normalbetrieb wäre „Aus AppPermissions: 1 passende(r)
  Eintrag …“ für Mitarbeitende nur technisches Rauschen, im Störungsfall ist es die einzige
  Stelle, an der ein `viewer` die Ursache überhaupt sehen kann.
- Unverändert bleiben: `DATA.reloadRole()` und der Knopf **🔄 Meine Rolle neu einlesen** in
  *Einstellungen → Berechtigungen* (dort nach dem Vergeben einer Rolle sinnvoll), sowie die
  Zeile „Begründung:“ in der Diagnose.

**Verifikation:** `node --check` 8/8, impexp 50/50, fieldmap 13/13. Browser: Normalfall –
Knopf entfernt, Erklärungszeile ausgeblendet, Rolle `admin` in der Karte; Fehlerfall (403 auf
die Rechteliste) – rote Zeile mit der Graph-Meldung erscheint weiterhin. Konsole fehlerfrei.

## 2026-07-28 (15): Kontaktdaten aufklappbar, Verzeichnis nach Werk eingeschränkt

**Denis:** „mit klick auf führungskraft sollen nur die infos angezeigt werden mit mail,
telefonnummer und co. also nur beim draufklicken klappt es informationen aus ; organigramm
soll anzeigbar nach berechtigungen sein, am besten nach werk“

**Werk = `companyName`** – dieselbe Quelle wie im Orgchart (dort `selWerk`/`u.companyName`),
damit beide Apps dasselbe meinen.

- `js/app.js`: Neue Funktion `person(p, meinWerk)` ersetzt den früheren reinen
  `mailto`-Link. Die Zeile ist jetzt anklappbar (`data-person`, `tabindex`, Chevron); darunter
  eine `.person-det`-Box mit E-Mail (mailto), Telefon/Mobil (tel-Links), Position, Abteilung,
  Werk und Standort. Es ist immer nur eine Person offen; erneuter Klick schließt. Fehlen
  Kontaktdaten, steht das ausdrücklich da statt einer leeren Box.
  `$select` um `officeLocation,companyName,mobilePhone,businessPhones` erweitert.
- `js/data.js`: `/me` liest zusätzlich `companyName`; die Profilkarte zeigt eine Zeile **Werk**.
- `js/config.js`: neuer Block `orgScope` je Rolle – `viewer`/`editor` → `werk`,
  `admin` → `alle`; zusätzlich möglich `gesellschaft` (E-Mail-Domäne). Die Führungskraft wird
  bewusst immer gezeigt, sonst bliebe die Karte bei Werksleitungen leer. Ohne `companyName`
  am eigenen Konto wird nicht gefiltert – mit sichtbarem Hinweis, statt still alles zu zeigen.
- `css/styles.css`: `.person` als Schaltfläche (Cursor, Fokusring, Chevron mit Drehung),
  `.person-det` als eingerückte Box.
- `README.md`: Abschnitt zur Orgchart-Anbindung um beides ergänzt, inkl. Tabelle der
  `orgScope`-Werte.

**Verifikation:** `node --check` 8/8, impexp 50/50, fieldmap 13/13. Browser:
- Aufklappen: alle Details anfangs zu; Klick auf „Maria Beispiel“ zeigt E-Mail als
  mailto-Link, **2** tel-Links (Mobil + Festnetz), Position, Abteilung, Werk, Standort;
  Klick auf eine zweite Person schließt die erste; erneuter Klick schließt.
  Person ohne Kontaktdaten zeigt „Keine Kontaktdaten hinterlegt.“
- Werk: als `admin` (Scope `alle`) alle vier Personen und Hinweis „Alle Werke sichtbar“;
  als `viewer` (Scope `werk`, eigenes Werk „DIHAG Holding“) verschwindet die Kollegin aus
  Gienanth, Hinweis „Eingeschränkt auf Ihr Werk DIHAG Holding. 1 Person(en) aus anderen
  Werken ausgeblendet.“; ohne `companyName` am eigenen Konto keine Einschränkung samt
  passendem Hinweis.
Konsole fehlerfrei.

## 2026-07-30: Alle elf Optimierungen umgesetzt

**Denis:** „ja, alles umsetzen" – die zehn Vorschläge aus der Analyse plus währenddessen
„filterung im import export auf Domäne und folgende Gruppe: dihag_intern@dihag.com".

**1 · Tastaturbedienung (Fehler, den ich selbst eingebaut hatte).** Die Personenzeile hatte
`role="button"` und `tabindex="0"`, aber nur einen Klick-Handler – bei einem `div` löst Enter
keinen Klick aus. Fokussieren ging, Aufklappen nicht. Jetzt `keydown` für Enter und Leertaste,
dazu `aria-expanded` und `aria-label`.

**2 · CI** (`.github/workflows/pruefung.yml`): `node --check` über `js/` und `tests/` plus die
drei Suiten, bei jedem Push und PR. Hat sich sofort bezahlt – siehe Punkt 6.

**3 · Test-Harness im Repo.** `_test.html` war per `.gitignore` nur lokal, die Browsertests
also nicht reproduzierbar. Jetzt `tests/harness.html` mit `noindex` und sichtbarem Hinweis,
dass alle Daten erfunden sind.

**4 · Neuer Test `tests/test-konsistenz.mjs`** (150 Prüfungen): COLS gegen EXPECTED, die
255-Zeichen-Grenze von SharePoint-Textspalten, Feldnamen ohne Leerzeichen/Umlaute,
Startinhalte gegen das Schema, `index.html` lädt jede js-Datei in der richtigen Reihenfolge,
Konfigurationswerte, und LISTEN-ANLEGEN.md nennt jede Spalte. Gegen eine eingebaute
Regression geprüft (`Domains` auf 500 → Test schlägt fehl).

**5 · Metadaten- und Rollen-Cache.** `graph.js` hielt Site-IDs, Listen-IDs und
Spaltenzuordnung nur im Arbeitsspeicher, `loadRole` las die Rechteliste bei jedem
Seitenaufruf: rund 21 Graph-Aufrufe je Kaltstart. Jetzt `sessionStorage` (12 h) mit
gesammeltem Schreiben, Rolle 3 Minuten. Fehlerfälle werden bewusst **nicht** gecacht.
**Eigener Fehler dabei:** `metaLeeren()` wies `_meta` neu zu, während `_siteIds` &Co.
`const`-Referenzen auf die alten Objekte hielten – das Leeren hätte nicht gewirkt. Jetzt
werden die Objekte ausgeräumt statt ersetzt; ein Test deckt genau das ab.

**6 · settings.js aufgeteilt** (44 KB → Rahmen + fünf `set-*.js`), Module registrieren sich in
`SETTINGS_VIEWS`, gemeinsame Helfer in `SETUI`. **Dabei mit fehlschlagendem Test gepusht:**
`impexp.js` registriert sich jetzt ebenfalls, im Node-Test fehlte `SETTINGS_VIEWS`. Ich hatte
vor dem Push nur zwei der drei Suiten laufen lassen – die CI hat es gemeldet, Nachtrag-Commit.

**7 · Suche über alle Kacheln.** Feld im Kopfbereich, ab zwei Zeichen, entprellt, Treffer mit
Reiter-Zuordnung und Hervorhebung. Läuft über `visibleReiter`/`kachelnFor` und erbt damit
Rolle, Domäne, `Aktiv` und Zeitraum – im Browser gegengeprüft, dass eine `editor`-Kachel als
`viewer` nicht auftaucht. Hervorhebung arbeitet auf maskiertem Text (mit `img/onerror` und
`script` geprüft, nichts wird ausgeführt).

**8 · Werks-Freigaben.** Optionale Spalte `Werke` in `AppPermissions` (Liste oder `*`) gibt
gezielt fremde Werke frei, unabhängig vom eigenen `companyName`. `ctx.werke` + `werkErlaubt()`.

**9 · orgScope pflegbar.** Neue optionale Liste `RUDJ_Einstellungen` (Title/Wert/Hinweis);
Reichweite je Rolle über *Berechtigungen → Sichtbarkeit des Verzeichnisses* änderbar. Ohne
Liste gilt `config.js`, ein ungültiger Wert wird ignoriert.

**10 · Protokoll.** Optionale Liste `RUDJ_Protokoll` – Zeitpunkt, Konto, Aktion, Vorlage,
Anzahl, Felder, Filter. Nur Metadaten. Fehlt die Liste, läuft der Vorgang durch (belegt).
**Eigener Fehler:** `protokoll()` übergab `C.protokollListe && C.configSite` als Site-Pfad.

**11 · Sicherung vor dem Import.** Vor der ersten Änderung wird eine CSV mit dem Ist-Zustand
heruntergeladen; geprüft, dass sie den **alten** Wert enthält. Der Bestätigungsdialog nennt sie.

**Zusatz · Filter im Import/Export.** Domänen-Auswahl (alle / nur gepflegte / eine bestimmte)
und optional nur Mitglieder einer Gruppe, vorbelegt `dihag_intern@dihag.com`. Transitive
Mitglieder, verschachtelte Gruppen zählen mit; unbekannte Gruppe wird benannt und der Filter
übersprungen statt zu viel zu exportieren.

**Nachtrag · der Gruppenfilter brauchte selbst ein Recht.** Erster Versuch im Tenant:
`GET /groups?$filter=mail eq 'dihag_intern@dihag.com'` → `403 Authorization_RequestDenied`.
Ursache dieselbe wie beim Austrittsdatum – `GroupMember.Read.All` steckte nicht im Token.
Nur hing sie an keinem Feld, sondern am Haken, deshalb:
`fehlendeZusatzrechte()` fragt jetzt zusätzlich `#ieNurGruppe` ab, der Haken löst ein
Neuzeichnen aus (`gruppeAktiv` überlebt es), der Knopf **🔐 Zusatzrechte anfordern** fordert
sie mit an, und bei einem 403 erklärt `gruppenRechtHinweis()` im Protokoll den Unterschied
zwischen „in Entra erteilt“ und „im Token“.

Zwei Formulierungen dabei nachgezogen, weil sie sonst falsches versprachen: der Hinweis kannte
nur Feldnamen und lautete deshalb „Für ␣ fehlt im Zugriffstoken …“, und „Ohne sie bleiben nur diese Spalten leer“ – beim
Gruppenfilter bleibt keine Spalte leer, sondern der Filter entfällt. Der Satz wird jetzt aus
beiden Teilen gebaut; alle vier Fälle im Browser durchgespielt (nur Gruppenrecht fehlt / nur
Feldrecht / beides / alles da).

**Eigener Fehler zweimal derselbe – zu grob geprüft:** „Banner noch da“ stammte beide Male von
meinem Selektor `#setBody .card .warn`, der auch den Hinweis der *Import*-Karte auf das
fehlende `User.ReadWrite.All` traf. Kartenscharf geprüft ist die Export-Karte leer, sobald das
Recht im Token steht. Ebenso hatte ein Reload nicht gegriffen, weil `navigate` nur den Origin
setzte und ein nachgeladenes `impexp.js` an der Doppeldeklaration von `const IMPEXP` scheiterte
– die Seite lief also weiter mit dem alten Code und zeigte „unverändert“ an. Lehre für beide:
prüfen, dass das Prüfmittel wirklich das Neue misst, bevor ich dem Ergebnis glaube.

**Stand:** `node --check` 13/13 Dateien, Tests 21 + 53 + 150 = **224 Prüfungen grün**, CI grün,
Konsole fehlerfrei. Commits bb1e5c1, d728516, 3a4f356, 6fc3688, 15957d0, 5749dda, e74c56a.

**Neu anzulegen (optional, App läuft ohne):** `RUDJ_Einstellungen` und `RUDJ_Protokoll` –
Spalten in LISTEN-ANLEGEN.md, Abschnitte 5 und 6. Dazu die Spalte `Werke` in `AppPermissions`.
