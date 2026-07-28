# SharePoint-Listen von Hand anlegen

Für „Rund um den Job" braucht es drei Listen auf **https://dihag.sharepoint.com/sites/IT**.
Sie dienen nur als Konfigurationsspeicher – es kommen keine personenbezogenen Daten hinein.

Wenn alles angelegt ist: in der App *Einstellungen → 🛠️ Einrichtung → 🩺 Diagnose →
🔍 Diagnose starten*. Die Diagnose prüft jede Liste **und jede Spalte** und benennt
Abweichungen einzeln. Danach genügen die Schritte *2 · Gesellschaften aus Tenant übernehmen*
und *3 · Startinhalte anlegen* in der App – die brauchen nur Schreibrechte auf
Listeneinträge.

---

## Fünf Regeln, die über Erfolg oder Fehlersuche entscheiden

1. **Spaltenname exakt so übernehmen wie unten** – Groß-/Kleinschreibung inklusive. Der beim
   Anlegen eingegebene Name wird zum internen Feldnamen, und danach lässt er sich nicht mehr
   ändern (nur der Anzeigename). Also lieber zweimal hinsehen.
2. **Keine Leerzeichen und keine Umlaute** in Spaltennamen. Darum heißt es `Kuerzel` und nicht
   „Kürzel", `GueltigVon` und nicht „Gültig von". Ein Leerzeichen würde intern zu `_x0020_`.
3. **Mehrere Textzeilen immer als „Nur Text" (Klartext)**, nie als „Erweiterter Rich-Text".
   Rich-Text liefert über Graph HTML zurück, und die Kacheln würden dann Markup anzeigen.
4. **`Title` nicht anlegen** – die Spalte existiert in jeder Liste schon. Sie hat je Liste eine
   andere Bedeutung (siehe unten). Sinnvoll ist nur, sie umzubenennen.
5. **Ja/Nein-Spalten** (`Aktiv`, `Standard`): Standardwert auf **Ja** bzw. **Nein** setzen wie
   angegeben. `Aktiv` sollte auf **Ja** stehen, damit neue Einträge sofort sichtbar sind.

Anlegen jeweils über *Neu → Liste → Leere Liste*, danach je Spalte
*+ Spalte hinzufügen → Typ wählen → Name eintragen → Speichern*.

---

## 1 · Liste `RUDJ_Gesellschaften`

Ordnet jede E-Mail-Domäne des Tenants einer Gesellschaft zu. Die Zuordnung passiert beim
Anmelden automatisch.

**`Title` = die E-Mail-Domäne**, z. B. `dihag.com` (sinnvoll umbenennen in „Domäne").

| Spaltenname | Typ in SharePoint | Hinweis |
|---|---|---|
| `Gesellschaft` | Einzelne Textzeile | Anzeigename, z. B. `DIHAG Holding GmbH` |
| `Kuerzel` | Einzelne Textzeile | max. 20, z. B. `DIH` |
| `Farbe` | Einzelne Textzeile | Hex-Wert, z. B. `#17509E` |
| `Standard` | Ja/Nein | Standardwert **Nein**. Genau ein Eintrag auf Ja – gilt für Domänen ohne eigenen Eintrag |
| `Aktiv` | Ja/Nein | Standardwert **Ja** |
| `Sortierung` | Zahl, 0 Dezimalstellen | z. B. 10, 20, 30 |

---

## 2 · Liste `RUDJ_Reiter`

Die Navigationspunkte. Ein Reiter, für den Domäne oder Rolle nicht passen, erscheint gar
nicht erst in der Navigation.

**`Title` = Anzeigename des Reiters**, z. B. `Mein Arbeitsverhältnis`.

| Spaltenname | Typ in SharePoint | Hinweis |
|---|---|---|
| `ReiterKey` | Einzelne Textzeile | Schlüssel, klein, ohne Leerzeichen, z. B. `job`. Verbindet Kacheln mit dem Reiter |
| `Icon` | Einzelne Textzeile | ein Emoji, z. B. `📄` |
| `Beschreibung` | Mehrere Textzeilen, **Nur Text** | erscheint unter der Überschrift |
| `Domains` | Einzelne Textzeile | `*` für alle, sonst `dihag.com;gienanth.de` |
| `MinRolle` | Einzelne Textzeile | `viewer`, `editor` oder `admin` |
| `Aktiv` | Ja/Nein | Standardwert **Ja** |
| `Sortierung` | Zahl, 0 Dezimalstellen | Reihenfolge in der Navigation |

---

## 3 · Liste `RUDJ_Kacheln`

Die eigentlichen Inhalte innerhalb eines Reiters.

**`Title` = Überschrift der Kachel**, z. B. `HR Self-Service (Timebutler)`.

| Spaltenname | Typ in SharePoint | Hinweis |
|---|---|---|
| `ReiterKey` | Einzelne Textzeile | muss einem `ReiterKey` aus `RUDJ_Reiter` entsprechen |
| `Typ` | Einzelne Textzeile | `link` (öffnet ein Ziel) oder `text` (Textblock auf der Seite) |
| `Icon` | Einzelne Textzeile | ein Emoji |
| `Beschreibung` | Mehrere Textzeilen, **Nur Text** | Kurztext unter der Überschrift |
| `Url` | Mehrere Textzeilen, **Nur Text** | Ziel bei `Typ = link`. Mehrzeilig, weil SharePoint-URLs mit Parametern länger als 255 Zeichen werden können |
| `Inhalt` | Mehrere Textzeilen, **Nur Text** | Text bei `Typ = text`. Zeilenumbrüche bleiben erhalten |
| `Badge` | Einzelne Textzeile | kleine Markierung, z. B. `NEU` |
| `Domains` | Einzelne Textzeile | `*` oder Domänenliste |
| `MinRolle` | Einzelne Textzeile | `viewer`, `editor` oder `admin` |
| `Aktiv` | Ja/Nein | Standardwert **Ja** |
| `Sortierung` | Zahl, 0 Dezimalstellen | Reihenfolge innerhalb des Reiters |
| `GueltigVon` | Datum und Uhrzeit, Format **Nur Datum** | leer = ab sofort |
| `GueltigBis` | Datum und Uhrzeit, Format **Nur Datum** | leer = unbefristet |

---

## Berechtigungen auf den Listen

Die App liest und schreibt als der angemeldete Benutzer. Damit reicht:

* **Alle Mitarbeitenden:** Lesen. Ohne Leserecht bleibt die Seite leer.
* **Rolle `admin`** (aktuell `administrator@dihag.com`): Mitwirken/Bearbeiten, damit die
  Einstellungen in der App gespeichert werden können.

Erben die Listen die Berechtigungen der Website `/sites/IT`, ist meist schon alles richtig –
dort haben die Mitarbeitenden Lesezugriff.

---

## Kontrolle

1. In der App *Einstellungen → 🛠️ Einrichtung → 🩺 Diagnose → 🔍 Diagnose starten*.
   Erwartet: je Liste `✓ vorhanden` und `✓ alle N Spalten vorhanden`.
2. Weicht ein Name ab, nennt die Diagnose ihn – und wenn nur die Schreibweise abweicht, auch
   den tatsächlichen internen Namen (`Domains → heißt intern „Domaenen"`). Dann die Spalte
   löschen und mit dem richtigen Namen neu anlegen; ein Umbenennen ändert den internen Namen
   nicht mehr.
3. Danach *2 · Gesellschaften aus Tenant übernehmen* und *3 · Startinhalte anlegen*.
