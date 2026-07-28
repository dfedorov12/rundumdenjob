# Rund um den Job

Mitarbeiterportal der **DIHAG Foundry Group** als statische Single-Page-App auf GitHub Pages.
Ergänzt die SharePoint-Intranet-Seite „Rund um den Job“ um eine Oberfläche, deren Inhalte
**pro Gesellschaft und pro Rolle** dynamisch ein- und ausgeblendet werden.

**Live:** https://dfedorov12.github.io/rundumdenjob/

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

**1 · Entra ID.** Unter *Authentifizierung → Single-Page-Anwendung* muss
`https://dfedorov12.github.io/rundumdenjob/` als Redirect-URI eingetragen sein.
Benötigte delegierte Berechtigungen: `User.Read`, `User.ReadBasic.All`, `User.Read.All`,
`Sites.ReadWrite.All`, `Mail.Send`.

**2 · Listen und Domänen** per Skript:

```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All","Sites.Manage.All","Sites.ReadWrite.All","User.Read.All"
./setup-rundumdenjob.ps1 -SeedDomains
```

Alternativ komplett in der App: **Einstellungen → 🛠️ Einrichtung → Schritte 1–3**
(dafür braucht das Konto das Recht, auf `/sites/IT` Listen anzulegen).

Schritt 4 des Skripts legt zusätzlich den Haupt-Administrator in `AppPermissions` an, damit er
auch im Admin-Portal auftaucht.

**3 · Startinhalte.** Als `administrator@dihag.com` anmelden, dann
*Einstellungen → Einrichtung → „3 · Startinhalte anlegen“* – das legt acht Reiter
und sechzehn Beispielkacheln an. Bereits vorhandene Einträge werden nie überschrieben, der
Schritt lässt sich gefahrlos wiederholen.

---

## Fehlersuche

### „Access denied" beim Anlegen der Listen

Die Meldung kommt von SharePoint und hat genau zwei mögliche Ursachen. *Einstellungen →
🛠️ Einrichtung → 🩺 Diagnose* unterscheidet sie:

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

Die Redirect-URI `https://dfedorov12.github.io/rundumdenjob/` fehlt in der
App-Registrierung (Abschnitt *Einrichtung*, Schritt 1).

## Aufbau

```
index.html            Grundgerüst (Boot, Kopfbereich, Reiterleiste, Fußzeile)
css/styles.css        DIHAG Corporate Design
js/config.js          Client-ID, Site-Pfade, Listennamen – einzige Stelle zum Anpassen
js/auth.js            PKCE-Anmeldung mit stillem SSO
js/graph.js           Graph-Aufrufe und SharePoint-Listen-CRUD
js/data.js            Benutzerkontext, Rollen, Sichtbarkeitslogik
js/seed.js            Listenschema und Startinhalte
js/settings.js        Einstellungen (nur admin)
js/app.js             Oberfläche, Reiter, Kacheln, Intranet-Anbindung
setup-rundumdenjob.ps1  Einrichtung per Microsoft.Graph-PowerShell
```

Corporate Design: Azurblau `#17509E`, Navy `#1A2644`, Anthrazit `#424241`,
Lichtblau `#99B7CD`, Orange `#F08300`, Schrift **Exo**.
