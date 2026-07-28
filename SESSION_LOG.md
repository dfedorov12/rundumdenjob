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
