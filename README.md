# Rund um den Job

Mitarbeiterportal der **DIHAG Foundry Group** als statische Single-Page-App auf GitHub Pages.
Ergänzt die SharePoint-Intranet-Seite „Rund um den Job“ um eine Oberfläche, deren Inhalte
**pro Gesellschaft und pro Rolle** dynamisch ein- und ausgeblendet werden.

**Live:** https://rundumdenjob.dihag.de/
(die alte Adresse https://dfedorov12.github.io/rundumdenjob/ leitet dorthin um)

---

## Konzept

### Automatische Anmeldung
Beim Aufruf versucht die Seite zuerst eine stille Anmeldung (`prompt=none`, OAuth2 Authorization
Code Flow mit PKCE). Da alle Nutzenden bereits am M365-Tenant angemeldet sind, landen sie ohne
Klick direkt in der App. Erst wenn das fehlschlägt, wird automatisch die interaktive Anmeldung
gestartet – ein Login-Button erscheint nur im Fehlerfall.

### Automatische Zuordnung über die E-Mail-Domäne
Die Endung der Anmelde-Adresse entscheidet über die **Gesellschaft**:

| Domäne | Gesellschaft |
|---|---|
| `@dihag.com` | DIHAG Holding GmbH (Standard) |
| `@gienanth.de` | Gienanth GmbH |
| … | in den Einstellungen pflegbar |

Domänen ohne eigenen Eintrag fallen auf die als **Standard** markierte Gesellschaft zurück.
Niemand muss etwas auswählen; die Zuordnung passiert beim Anmelden.

### Rollen
Jede Person im Tenant sieht die Seite automatisch als `viewer`. Höhere Rollen kommen aus der
zentralen Liste **`AppPermissions`** auf `/sites/ticket` – derselben Liste, die auch das
[Organigramm](https://dfedorov12.github.io/orgchart-/) verwendet:

| Rolle | Bedeutung |
|---|---|
| `viewer` | Standard für alle – sieht alle für die eigene Domäne freigegebenen Inhalte |
| `editor` | sieht zusätzlich Inhalte ab Mindestrolle `editor` (z. B. Führungskräfte-Bereich) |
| `admin` | sieht zusätzlich den Reiter **Einstellungen** und darf alles konfigurieren |

Ein Eintrag mit `App = *` gilt app-übergreifend, `App = rundumdenjob` nur hier.

**Haupt-Administrator: `administrator@dihag.com`** – in `js/config.js` unter `hauptAdmins`
festgeschrieben und damit immer `admin`, unabhängig von der Rechteliste. Das hält die App
administrierbar, falls in `AppPermissions` einmal kein passender Eintrag existiert. Änderungen
daran gehen nur über einen Commit; sichtbar ist die Liste in
*Einstellungen → 🔑 Berechtigungen → Haupt-Administration*.

### Dynamische Reiter und Kacheln
Es gibt zwei Ebenen, beide vollständig über die Einstellungen pflegbar:

1. **Reiter** – die Navigationspunkte im Kopfbereich. Ein Reiter, für den die Domäne oder die
   Rolle nicht passt, erscheint gar nicht erst in der Navigation.
2. **Kacheln** – die Inhalte innerhalb eines Reiters. Jede Kachel wird noch einmal einzeln
   gegen Domäne, Mindestrolle und einen optionalen Gültigkeitszeitraum geprüft.

Jeder Eintrag trägt dafür:

| Feld | Wirkung |
|---|---|
| `Domains` | `*` = alle, sonst Liste von Domänen (`dihag.com;gienanth.de`) |
| `MinRolle` | `viewer` / `editor` / `admin` |
| `Aktiv` | Ein-/Ausschalter ohne Löschen |
| `GueltigVon` / `GueltigBis` | nur bei Kacheln – zeitgesteuertes Ein-/Ausblenden |

Kacheltypen: `link` (öffnet ein Ziel – Intranet-Seite, Timebutler, Schwester-App) und
`text` (Textblock direkt auf der Seite, volle Breite).

### Anbindung an das Intranet und das Organigramm
* Der Reiter **Start** zeigt Profil, Führungskraft, eigenes Team und Kolleg:innen –
  aus denselben Graph-Daten, aus denen sich auch das Organigramm speist, samt Direktlink dorthin.
* Darunter erscheinen die zuletzt geänderten Seiten der Intranet-Root-Site
  (`dihag.sharepoint.com`) als „Neues aus der DIHAG“.
* Kacheln verlinken auf Intranet-Seiten, Timebutler und die übrigen DIHAG-Apps.

---

## Datenhaltung

Drei SharePoint-Listen auf **`/sites/IT`**:

| Liste | Inhalt |
|---|---|
| `RUDJ_Gesellschaften` | Domäne → Gesellschaft (`Title` = Domäne) |
| `RUDJ_Reiter` | Navigationspunkte (`Title` = Anzeigename, `ReiterKey` = Schlüssel) |
| `RUDJ_Kacheln` | Inhalte (`Title` = Überschrift, `ReiterKey` = Zuordnung) |

Rechte: `AppPermissions` auf `/sites/ticket` (bestehende Liste, wird mitgenutzt).

---

## Einrichtung

**1 · Entra ID.** Unter *Authentifizierung → Single-Page-Anwendung* müssen die
Redirect-URIs eingetragen sein – `https://rundumdenjob.dihag.de/` (produktiv) und
optional `https://dfedorov12.github.io/rundumdenjob/` als Fallback.
`js/auth.js` leitet die Adresse aus dem Aufruf ab und läuft unter beiden Hosts.
Benötigte delegierte Berechtigungen: `User.Read`, `User.ReadBasic.All`, `User.Read.All`,
`Sites.ReadWrite.All`, `Mail.Send`.

**2 · Listen und Domänen** per Skript:

```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All","Sites.Manage.All","Sites.ReadWrite.All","User.Read.All"
./setup-rundumdenjob.ps1 -SeedDomains
```

Oder **von Hand in SharePoint** – das umgeht die Rechtefrage beim Anlegen komplett:
[LISTEN-ANLEGEN.md](LISTEN-ANLEGEN.md) nennt alle drei Listen mit exaktem Spaltennamen und
Typ. Die Diagnose in der App prüft anschließend jede Liste **und jede Spalte** und benennt
Abweichungen einzeln.

Schritt 4 des Skripts legt zusätzlich den Haupt-Administrator in `AppPermissions` an, damit er
auch im Admin-Portal auftaucht.

**3 · Prüfen.** Als `administrator@dihag.com` anmelden und
*Einstellungen → 🩺 Diagnose → 🔍 Diagnose starten* aufrufen: erwartet wird je Liste
`✓ vorhanden` und `✓ alle N Spalten nutzbar`. Inhalte werden danach über die Reiter
*Gesellschaften & Domänen*, *Reiter* und *Kacheln* gepflegt; eine bestehende Konfiguration
lässt sich über *📦 Import / Export → Portalkonfiguration* übernehmen.

---

## Import / Export (Entra ID)

*Einstellungen → 📦 Import / Export*, nur für die Rolle `admin`.

### Export

Liest alle Konten des Tenants über Microsoft Graph und lädt sie als CSV (Excel-tauglich:
Semikolon, UTF-8 mit BOM, CRLF) oder JSON herunter. Drei Vorlagen wählen die Felder vor:

| Vorlage | Zweck |
|---|---|
| 🚀 **Onboarding** | Stammdaten für neue Mitarbeitende – Name, Position, Abteilung, Eintrittsdatum, Führungskraft, Kontaktdaten, Nutzungsstandort |
| 🚪 **Offboarding** | Was beim Austritt zu prüfen ist – Kontostatus, Austrittsdatum, Lizenzen, Gruppen, letzte Anmeldung, Führungskraft |
| 📦 **Migration** | Alle verfügbaren Felder |

Die Feldliste lässt sich frei anpassen. Filter: nur aktive Konten, Gastkonten einbeziehen,
nur die unter *Gesellschaften & Domänen* gepflegten Domänen.

Manche Felder brauchen zusätzliche Berechtigungen: **Letzte Anmeldung** verlangt
`AuditLog.Read.All`, **Austrittsdatum** `User-LifeCycleInfo.Read.All`.

> **Wichtig:** In Entra *erteilte* Berechtigungen wirken erst, wenn die Anmeldung sie auch
> **anfordert**. Sonst fehlen sie im Zugriffstoken und Graph antwortet mit
> `Authentication_MSGraphPermissionMissing: The principal does not have required Microsoft
> Graph permission(s)` – obwohl im Portal alles grün aussieht.

Sie stehen absichtlich nicht in `RUDJ_CONFIG.scopes`, weil sie nur hier gebraucht werden und
sonst in jedem Token jeder Anmeldung landen würden. Sind sie für die gewählten Felder nötig
und nicht im Token, zeigt die Export-Karte einen Hinweis mit dem Knopf
**🔐 Zusatzrechte anfordern**; der holt sie still nach (`prompt=none`, bei bereits erteilter
Zustimmung ohne jede Rückfrage). Bis dahin wird der Abruf automatisch ohne diese Felder
wiederholt – die Spalte bleibt leer, statt dass der ganze Export scheitert.

Welche optionalen Berechtigungen im aktuellen Token stecken, zeigt
*Einstellungen → 🩺 Diagnose → 🔍 Diagnose starten*.

> Die Dateien enthalten personenbezogene Daten. Nur dort ablegen, wo das zulässig ist.

### Import – vorhandene Konten aktualisieren

Abgleich über Anmeldename, Objekt-ID, Personalnummer oder E-Mail. Spaltenüberschriften werden
sowohl als deutsche Bezeichnung („Abteilung") als auch als technischer Schlüssel
(`department`) erkannt; unbekannte Spalten werden ignoriert.

* **Leere Zelle** = Feld nicht anfassen. Ein einzelnes `-` **leert** das Feld.
* Datumsangaben in `TT.MM.JJJJ` oder `JJJJ-MM-TT`; Mehrfachwerte mit `|`, `;` oder `,`.
* *🔍 Prüfen* ändert nichts und zeigt eine Vorschau **vorher → nachher** je Konto und Feld.
* Erst *⬆️ Änderungen übernehmen* schreibt, nach einer Bestätigung mit Anzahl.
* Fehlgeschlagene Zeilen werden als CSV heruntergeladen.

Bewusst **nicht** möglich: Konten anlegen, Kennwörter setzen, Anmeldename oder E-Mail ändern,
Lizenzen oder Gruppen zuweisen. Die Spalte **Konto aktiv** wird nur übernommen, wenn das
Häkchen darunter gesetzt ist – sonst bleibt der Kontostatus unangetastet, auch wenn die
Spalte in der Datei steht.

Schreiben braucht `User.ReadWrite.All`. Diese Berechtigung steht absichtlich **nicht** in
`RUDJ_CONFIG.scopes` – sonst müsste ihr jede Anmeldung im Tenant zustimmen. Der Knopf
*🔐 Schreibrechte anfordern* holt sie einmalig für die laufende Sitzung.

### Neuanlagen (Onboarding)

Konten anzulegen heißt, Startkennwörter zu vergeben – das gehört nicht in eine
Browser-Anwendung. Die App erzeugt stattdessen die Vorlage im offiziellen Format für
*Entra-Portal → Benutzer → Massenvorgänge → Benutzer erstellen*; das Kennwort setzt Entra
beim Import. Anschließend die Stammdaten hier per Import nachziehen.

### Portalkonfiguration

Gesellschaften, Reiter und Kacheln als JSON – für den Umzug in eine andere Umgebung oder als
Sicherung vor größeren Umbauten. Der Import legt nur fehlende Einträge an und überschreibt
nie Vorhandenes; neue Reiter erscheinen sofort in der Navigation.

## Fehlersuche

### „Access denied" beim Anlegen der Listen

Die Meldung kommt von SharePoint und hat genau zwei mögliche Ursachen. *Einstellungen →
🩺 Diagnose* unterscheidet sie:

1. **`Sites.ReadWrite.All` fehlt im Token.** Die Diagnose listet die Berechtigungen des
   Access-Tokens (`scp`-Claim). Fehlt der Eintrag, muss die Berechtigung an der
   App-Registrierung als *delegierte* Berechtigung hinterlegt **und** per
   Administratorzustimmung erteilt werden. Danach abmelden und neu anmelden – erst dann
   enthält das neue Token den Scope.
2. **Das Konto darf auf der Site keine Listen anlegen.** Der Knopf *🧪 Schreibtest auf der
   Site* legt eine Hilfsliste `RUDJ_Schreibtest` an und löscht sie sofort wieder. Scheitert
   er mit 403, ist es eine SharePoint-Websiteberechtigung — siehe unten.

Fehlermeldungen im Einrichtungs-Protokoll nennen immer Methode, Pfad, HTTP-Status und
Graph-Fehlercode – also z. B. `POST /sites/…/lists → HTTP 403 accessDenied: Access denied`
statt nur `Access denied`.

### 403 beim Anlegen der Listen (Websiteberechtigung)

Das betrifft **nur diesen einen Einrichtungsschritt**. Für den Betrieb braucht die App
lediglich Lese-/Schreibrechte auf *Listeneinträge* — die hat ein normales Mitgliedskonto
bereits. Nur das Erstellen einer Liste verlangt Vollzugriff auf der Website. Drei Wege,
einer genügt:

**a) Konto zum Websitebesitzer machen.** Auf `/sites/IT` unter *Websiteberechtigungen* das
Konto in die Besitzergruppe aufnehmen, dann in der App *1 · Listen anlegen* wiederholen.

**b) Skript mit einem SharePoint- oder Global-Admin-Konto.**

```powershell
Connect-MgGraph -Scopes "Sites.Manage.All","Sites.ReadWrite.All"
./setup-rundumdenjob.ps1 -SkipAppReg
```

Delegiertes PowerShell läuft als das angemeldete Konto und scheitert mit demselben 403,
wenn dieses Konto keinen Vollzugriff hat — der Weg hilft also nur mit einem entsprechend
berechtigten Konto.

**c) App-only** — umgeht Benutzer- und Websiteberechtigungen vollständig, weil die App-Identität
mit `Sites.FullControl.All` (Application, mit Administratorzustimmung) arbeitet:

```powershell
./setup-rundumdenjob.ps1 -AppOnly -SkipAppReg -AppClientId "<App-Reg-Id>" -AppSecret (Read-Host -AsSecureString "Client Secret")
```

Im Tenant existiert dafür bereits die Registrierung **DIHAG Cron-Job**
(`089bf9ad-2d9a-4cbc-b85d-88b4484af0bb`); sie braucht ggf. noch `Sites.FullControl.All` als
Application-Berechtigung. Das Secret niemals ins Repository — nur interaktiv eingeben.

### „AADSTS50011" direkt beim Aufruf

Die aufgerufene Adresse ist nicht als Redirect-URI in der App-Registrierung hinterlegt.
Eingetragen sein muss genau der Ursprung mit Schrägstrich am Ende, also
`https://rundumdenjob.dihag.de/` (Abschnitt *Einrichtung*, Schritt 1).

## Aufbau

```
index.html            Grundgerüst (Boot, Kopfbereich, Reiterleiste, Fußzeile)
css/styles.css        DIHAG Corporate Design
js/config.js          Client-ID, Site-Pfade, Listennamen – einzige Stelle zum Anpassen
js/auth.js            PKCE-Anmeldung mit stillem SSO
js/graph.js           Graph-Aufrufe und SharePoint-Listen-CRUD
js/data.js            Benutzerkontext, Rollen, Sichtbarkeitslogik
js/seed.js            Listenschema und Startinhalte
js/impexp.js          Import/Export von Entra-Benutzerdaten und Portalkonfiguration
js/settings.js        Einstellungen (nur admin)
js/app.js             Oberfläche, Reiter, Kacheln, Intranet-Anbindung
setup-rundumdenjob.ps1  Einrichtung per Microsoft.Graph-PowerShell
```

Corporate Design: Azurblau `#17509E`, Navy `#1A2644`, Anthrazit `#424241`,
Lichtblau `#99B7CD`, Orange `#F08300`, Schrift **Exo**.
