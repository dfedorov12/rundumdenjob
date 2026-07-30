/* Prüft die Kernlogik von js/impexp.js gegen die echte Datei:
   CSV schreiben/lesen, Spaltenzuordnung, Wertumwandlung und Ist-Werte. */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../js/impexp.js", import.meta.url), "utf8");

/* Nur die Abhängigkeiten stellen, die beim Laden gebraucht werden. */
const sandbox = {
  console,
  // Der Gruppenfilter haengt an einer Checkbox; nur die wird nachgebildet.
  document: {
    getElementById: id => (id === "ieNurGruppe" ? { checked: sandbox.__gruppe } : null),
    createElement: () => ({ style: {} })
  },
  RUDJ_CONFIG: { configSite: "x", lists: {}, scopes: [] },
  APP: { esc: s => String(s ?? ""), toast: () => {} },
  AUTH: { tokenInfo: () => ({ scopes: sandbox.__scopes }) },
  __scopes: [], __gruppe: false,
  GRAPH: {}, DATA: { domainOf: a => String(a).split("@")[1] || "" }, SEED: { EXPECTED: {} },
  // impexp.js registriert sich am Ende als Unterreiter der Einstellungen
  SETTINGS_VIEWS: {},
  URL: { createObjectURL: () => "blob:", revokeObjectURL: () => {} },
  Blob: class {}
};
vm.createContext(sandbox);
vm.runInContext(SRC + "\n;globalThis.__IE = IMPEXP;", sandbox);
const IE = sandbox.__IE;

const R = [];
const check = (name, ok, detail = "") => R.push({ name, ok, detail });
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b),
  `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

/* ── CSV schreiben ────────────────────────────────────────────────── */

const csv = IE.toCsv(["A", "B"], [["1", "zwei"]]);
check("CSV beginnt mit BOM (Excel erkennt UTF-8)", csv.charCodeAt(0) === 0xFEFF);
check("CSV trennt mit Semikolon", csv.includes("A;B"), csv.slice(0, 20));
check("CSV nutzt CRLF", csv.includes("\r\n"));

const heikel = IE.toCsv(["X"], [['er sagte "hallo"; und ging']]);
check("Anführungszeichen und Trenner werden maskiert",
  heikel.includes('"er sagte ""hallo""; und ging"'), heikel);
const arr = IE.toCsv(["T"], [[["a", "b"]]]);
check("Mehrwertige Felder werden mit | zusammengefasst", arr.includes("a | b"), arr);

/* ── CSV lesen ────────────────────────────────────────────────────── */

const p1 = IE.fromCsv('Anmeldename (UPN);Abteilung\r\nerika@dihag.com;Einkauf\r\n');
eq("Semikolon-CSV: Kopfzeile", p1.kopf, ["Anmeldename (UPN)", "Abteilung"]);
eq("Semikolon-CSV: Datenzeile", p1.zeilen, [{ "Anmeldename (UPN)": "erika@dihag.com", "Abteilung": "Einkauf" }]);

const p2 = IE.fromCsv('upn,dept\na@b.de,"Ein, Kauf"\n');
check("Komma-CSV wird erkannt", p2.zeilen[0].dept === "Ein, Kauf", JSON.stringify(p2.zeilen[0]));

const p3 = IE.fromCsv('﻿a;b\n1;"zwei ""drei"""\n\n');
check("BOM wird entfernt", p3.kopf[0] === "a", JSON.stringify(p3.kopf));
check("Verdoppelte Anführungszeichen werden gelesen", p3.zeilen[0].b === 'zwei "drei"', p3.zeilen[0].b);
check("Leerzeilen werden verworfen", p3.zeilen.length === 1, String(p3.zeilen.length));

const rund = IE.fromCsv(IE.toCsv(["Position"], [['Leiter "Guss"; Nord']]));
check("Schreiben und Lesen ergibt denselben Wert",
  rund.zeilen[0].Position === 'Leiter "Guss"; Nord', rund.zeilen[0].Position);

/* ── Spaltenzuordnung ─────────────────────────────────────────────── */

const m1 = IE.spaltenZuordnen(["Anmeldename (UPN)", "Abteilung", "Position", "Quatsch"]);
eq("Deutsche Bezeichnungen werden zugeordnet", m1,
  { "Anmeldename (UPN)": "userPrincipalName", "Abteilung": "department", "Position": "jobTitle" });
const m2 = IE.spaltenZuordnen(["userPrincipalName", "  DEPARTMENT  "]);
eq("Technische Schlüssel und Schreibweise/Leerzeichen sind tolerant", m2,
  { "userPrincipalName": "userPrincipalName", "  DEPARTMENT  ": "department" });

/* ── Wertumwandlung ───────────────────────────────────────────────── */

check("Leere Zelle bedeutet 'nicht ändern'", IE.normWert("department", "") === undefined);
check("Nur Leerzeichen bedeutet 'nicht ändern'", IE.normWert("department", "   ") === undefined);
check("Ein '-' leert das Feld", IE.normWert("department", "-") === null);
check("Text wird getrimmt", IE.normWert("department", "  Einkauf ") === "Einkauf");

check("'Ja' ergibt aktives Konto", IE.normWert("accountEnabled", "Ja") === true);
check("'Nein' ergibt deaktiviertes Konto", IE.normWert("accountEnabled", "Nein") === false);
check("'true' ergibt aktives Konto", IE.normWert("accountEnabled", "true") === true);

eq("Telefonliste wird aufgeteilt", IE.normWert("businessPhones", "+49 1 | +49 2"), ["+49 1", "+49 2"]);
eq("Weitere E-Mails werden aufgeteilt", IE.normWert("otherMails", "a@b.de; c@d.de"), ["a@b.de", "c@d.de"]);

check("ISO-Datum wird übernommen",
  IE.normWert("employeeHireDate", "2026-08-01") === "2026-08-01T00:00:00Z",
  String(IE.normWert("employeeHireDate", "2026-08-01")));
check("Deutsches Datum wird umgerechnet",
  IE.normWert("employeeLeaveDateTime", "1.9.2026") === "2026-09-01T00:00:00Z",
  String(IE.normWert("employeeLeaveDateTime", "1.9.2026")));
check("Unlesbares Datum wird ignoriert statt falsch geschrieben",
  IE.normWert("employeeHireDate", "irgendwann") === undefined);

/* ── Ist-Werte aus Graph-Objekten ─────────────────────────────────── */

const u = {
  department: "Einkauf",
  businessPhones: ["+49 1", "+49 2"],
  employeeHireDate: "2026-08-01T00:00:00Z",
  manager: { userPrincipalName: "chef@dihag.com" }
};
check("Ist-Wert einfaches Feld", IE.istWert("department", u) === "Einkauf");
check("Ist-Wert Liste wird vergleichbar gemacht", IE.istWert("businessPhones", u) === "+49 1 | +49 2");
check("Ist-Wert Datum vergleichbar mit Sollwert",
  IE.istWert("employeeHireDate", u) === IE.normWert("employeeHireDate", "2026-08-01"));
check("Ist-Wert Führungskraft kommt aus manager", IE.istWert("managerUPN", u) === "chef@dihag.com");
check("Fehlendes Feld ergibt Leerstring", IE.istWert("jobTitle", u) === "");

// Gleicher Wert darf keine Änderung erzeugen
check("Unveränderte Abteilung erzeugt keinen Unterschied",
  String(IE.istWert("department", u)) === String(IE.normWert("department", "Einkauf")));

/* ── JSON als Tabelle ─────────────────────────────────────────────── */

const j = IE.jsonAlsTabelle('[{"userPrincipalName":"a@b.de","department":"IT"},{"userPrincipalName":"c@d.de"}]');
eq("JSON-Liste: Kopf aus allen Schlüsseln", j.kopf, ["userPrincipalName", "department"]);
check("JSON-Liste: fehlender Wert wird leer", j.zeilen[1].department === "");

/* ── Feldkatalog ──────────────────────────────────────────────────── */

const schluessel = IE.FIELDS.map(f => f.key);
check("Feldschlüssel sind eindeutig", new Set(schluessel).size === schluessel.length);
check("Jedes Feld ist mindestens einer Vorlage zugeordnet",
  IE.FIELDS.every(f => f.sets?.length));
check("Vorlage Migration enthält alle Felder",
  IE.FIELDS.every(f => f.sets.includes("mig")),
  IE.FIELDS.filter(f => !f.sets.includes("mig")).map(f => f.key).join(","));
check("Anmeldename und E-Mail sind nicht beschreibbar",
  !IE.FIELDS.find(f => f.key === "userPrincipalName").write &&
  !IE.FIELDS.find(f => f.key === "mail").write);
check("Lizenzen und Gruppen sind nicht beschreibbar",
  !IE.FIELDS.find(f => f.key === "licenses").write &&
  !IE.FIELDS.find(f => f.key === "groups").write);
// „lastPasswordChange“ ist ein reines Lesedatum und daher erlaubt – geprüft
// wird, dass kein BESCHREIBBARES Feld Kennwörter berührt.
check("Kein beschreibbares Feld berührt Kennwörter",
  !IE.FIELDS.filter(f => f.write).some(f => /pass|kennwort|secret/i.test(f.key)),
  IE.FIELDS.filter(f => f.write && /pass/i.test(f.key)).map(f => f.key).join(","));
check("Kennwort-Zeitstempel ist nur lesbar",
  !IE.FIELDS.find(f => f.key === "lastPasswordChange").write);
check("Offboarding enthält Austrittsdatum, Kontostatus und Lizenzen",
  ["employeeLeaveDateTime", "accountEnabled", "licenses"]
    .every(k => IE.FIELDS.find(f => f.key === k).sets.includes("off")));
check("Onboarding enthält Eintrittsdatum und Führungskraft",
  ["employeeHireDate", "managerUPN"]
    .every(k => IE.FIELDS.find(f => f.key === k).sets.includes("on")));

/* ── Zusatz-Berechtigungen ────────────────────────────────────────── */

// In Entra erteilte Rechte wirken erst, wenn sie auch angefordert werden –
// entscheidend ist also, was im Token steht.
sandbox.__scopes = ["User.Read", "User.Read.All"];
eq("Ohne Zusatz-Scopes fehlen beide",
  IE.fehlendeZusatzrechte(["lastSignIn", "employeeLeaveDateTime"]).sort(),
  ["AuditLog.Read.All", "User-LifeCycleInfo.Read.All"]);
check("Nur letzte Anmeldung gewählt → nur AuditLog fehlt",
  JSON.stringify(IE.fehlendeZusatzrechte(["lastSignIn"])) === JSON.stringify(["AuditLog.Read.All"]),
  JSON.stringify(IE.fehlendeZusatzrechte(["lastSignIn"])));
check("Felder ohne Zusatzrecht verlangen nichts",
  IE.fehlendeZusatzrechte(["department", "jobTitle", "managerUPN"]).length === 0);

sandbox.__scopes = ["User.Read", "User.Read.All", "AuditLog.Read.All"];
check("Mit AuditLog im Token fehlt dafür nichts mehr",
  IE.fehlendeZusatzrechte(["lastSignIn"]).length === 0);
check("Austrittsdatum fehlt weiterhin",
  JSON.stringify(IE.fehlendeZusatzrechte(["employeeLeaveDateTime"])) === JSON.stringify(["User-LifeCycleInfo.Read.All"]),
  JSON.stringify(IE.fehlendeZusatzrechte(["employeeLeaveDateTime"])));

sandbox.__scopes = ["User.Read", "AuditLog.Read.All", "User-LifeCycleInfo.Read.All"];
check("Mit beiden Scopes ist nichts offen",
  IE.fehlendeZusatzrechte(["lastSignIn", "employeeLeaveDateTime", "groups"]).length === 0);
check("Gruppen brauchen kein Zusatzrecht (nur mehr Aufrufe)",
  !IE.FIELDS.find(f => f.key === "groups").perm);

// Der Gruppenfilter haengt nicht an einem Feld, sondern am Haken: ohne
// GroupMember.Read.All im Token antwortet /groups mit 403.
sandbox.__gruppe = true;
sandbox.__scopes = ["User.Read", "User.Read.All"];
check("Eingeschalteter Gruppenfilter verlangt GroupMember.Read.All",
  IE.fehlendeZusatzrechte(["department"]).includes("GroupMember.Read.All"),
  JSON.stringify(IE.fehlendeZusatzrechte(["department"])));
sandbox.__scopes = ["User.Read", "User.Read.All", "GroupMember.Read.All"];
check("Mit GroupMember im Token fehlt für den Gruppenfilter nichts",
  IE.fehlendeZusatzrechte(["department"]).length === 0,
  JSON.stringify(IE.fehlendeZusatzrechte(["department"])));
sandbox.__gruppe = false;
sandbox.__scopes = ["User.Read", "User.Read.All"];
check("Ausgeschalteter Gruppenfilter verlangt es nicht",
  !IE.fehlendeZusatzrechte(["department"]).includes("GroupMember.Read.All"),
  JSON.stringify(IE.fehlendeZusatzrechte(["department"])));

/* ── Ausgabe ──────────────────────────────────────────────────────── */

let fail = 0;
for (const r of R) {
  if (!r.ok) fail++;
  console.log((r.ok ? "PASS " : "FAIL ") + r.name + (!r.ok && r.detail ? "  ‹" + r.detail + "›" : ""));
}
console.log(`\n${R.length - fail}/${R.length} grün`);
process.exit(fail ? 1 : 0);
