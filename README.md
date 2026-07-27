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

**3 · Startinhalte.** *Einstellungen → Einrichtung → „3 · Startinhalte anlegen“* legt acht Reiter
und sechzehn Beispielkacheln an. Bereits vorhandene Einträge werden nie überschrieben, der
Schritt lässt sich gefahrlos wiederholen.

---

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
