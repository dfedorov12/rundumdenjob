/* Prüft Zusammenhänge, die sich beim Arbeiten mehrfach als Fehlerquelle
   erwiesen haben und die kein Syntaxcheck findet:

   - Spaltenschema (COLS) und erwartete Feldnamen (EXPECTED) müssen zueinander
     passen – sonst meldet die Diagnose Spalten als fehlend, die es gibt.
   - „Einzelne Textzeile“ ist in SharePoint auf 255 Zeichen begrenzt. Genau
     daran scheiterten schon Domains (500) und Url (900).
   - Interne Feldnamen dürfen keine Leerzeichen oder Umlaute enthalten.
   - index.html muss jede vorhandene js-Datei laden (und keine fehlende).
   - LISTEN-ANLEGEN.md muss jede Spalte nennen, die die App erwartet. */

import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const wurzel = new URL("../", import.meta.url);
const lies = p => readFileSync(new URL(p, wurzel), "utf8");

const R = [];
const check = (name, ok, detail = "") => R.push({ name, ok, detail });

/* ── seed.js in einer Sandbox laden ───────────────────────────────── */

const spalten = [];   // mitschreiben, was COLS anlegt
const sandbox = {
  console,
  RUDJ_CONFIG: null,
  GRAPH: {
    colText: (n, max = 255) => { const c = { name: n, text: { maxLength: max } }; spalten.push(c); return c; },
    colNote: n => { const c = { name: n, text: { allowMultipleLines: true, textType: "plain" } }; spalten.push(c); return c; },
    colNum:  n => { const c = { name: n, number: {} }; spalten.push(c); return c; },
    colBool: n => { const c = { name: n, boolean: {} }; spalten.push(c); return c; },
    colDate: n => { const c = { name: n, dateTime: { format: "dateOnly" } }; spalten.push(c); return c; }
  }
};
vm.createContext(sandbox);
vm.runInContext(lies("js/config.js") + "\n;globalThis.RUDJ_CONFIG = RUDJ_CONFIG;", sandbox);
vm.runInContext(lies("js/seed.js") + "\n;globalThis.__SEED = SEED;", sandbox);
const SEED = sandbox.__SEED;
const CFG = sandbox.RUDJ_CONFIG;

/* ── COLS ↔ EXPECTED ──────────────────────────────────────────────── */

for (const key of Object.keys(SEED.COLS)) {
  const ausSchema = SEED.COLS[key].map(c => c.name);
  const erwartet = (SEED.EXPECTED[key] || []).filter(n => n !== "Title");
  const fehltInExpected = ausSchema.filter(n => !erwartet.includes(n));
  const fehltInSchema  = erwartet.filter(n => !ausSchema.includes(n));
  check(`COLS und EXPECTED deckungsgleich: ${key}`,
    !fehltInExpected.length && !fehltInSchema.length,
    `nur in COLS: ${fehltInExpected.join(",") || "-"} | nur in EXPECTED: ${fehltInSchema.join(",") || "-"}`);
  check(`EXPECTED enthält Title: ${key}`,
    (SEED.EXPECTED[key] || []).includes("Title"));
}

/* ── SharePoint-Grenzen und Namensregeln ──────────────────────────── */

for (const c of spalten) {
  if (c.text && !c.text.allowMultipleLines) {
    check(`Textspalte „${c.name}“ bleibt unter 256 Zeichen`,
      (c.text.maxLength ?? 255) <= 255,
      `maxLength=${c.text.maxLength}`);
  }
}

const alleNamen = [...new Set([
  ...spalten.map(c => c.name),
  ...Object.values(SEED.EXPECTED).flat()
])];
for (const n of alleNamen) {
  check(`Feldname „${n}“ ohne Leerzeichen`, !/\s/.test(n));
  check(`Feldname „${n}“ ohne Umlaute/ß`, !/[äöüÄÖÜß]/.test(n));
}

/* ── Startinhalte passen zum Schema ───────────────────────────────── */

const erlaubt = key => new Set(SEED.EXPECTED[key] || []);
for (const [key, rows] of [["reiter", SEED.REITER], ["kacheln", SEED.KACHELN]]) {
  const ok = erlaubt(key);
  const unbekannt = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => !ok.has(k));
  check(`Startinhalte ${key} nutzen nur bekannte Felder`, !unbekannt.length, unbekannt.join(","));
}
check("Jede Startkachel verweist auf einen vorhandenen Reiter",
  SEED.KACHELN.every(k => SEED.REITER.some(r => r.ReiterKey === k.ReiterKey)),
  SEED.KACHELN.filter(k => !SEED.REITER.some(r => r.ReiterKey === k.ReiterKey)).map(k => k.Title).join(","));
check("Reiter-Schlüssel sind eindeutig",
  new Set(SEED.REITER.map(r => r.ReiterKey)).size === SEED.REITER.length);
check("Kein Reiter nutzt den reservierten Schlüssel __settings",
  !SEED.REITER.some(r => r.ReiterKey === "__settings"));

/* ── index.html lädt alle Skripte ─────────────────────────────────── */

const html = lies("index.html");
const dateien = readdirSync(new URL("js/", wurzel)).filter(f => f.endsWith(".js"));
for (const f of dateien) {
  check(`index.html lädt js/${f}`, html.includes(`js/${f}`));
}
const geladen = [...html.matchAll(/src="js\/([^"]+)"/g)].map(m => m[1]);
for (const g of geladen) {
  check(`js/${g} existiert wirklich`, dateien.includes(g));
}
check("config.js wird vor allen anderen Skripten geladen",
  geladen[0] === "config.js", geladen.join(","));

/* ── Konfiguration ────────────────────────────────────────────────── */

check("Alle Listennamen aus config.js haben ein Schema",
  Object.keys(CFG.lists).every(k => SEED.COLS[k]),
  Object.keys(CFG.lists).filter(k => !SEED.COLS[k]).join(","));
check("permSite und configSite liegen auf derselben Site",
  CFG.permSite === CFG.configSite,
  `${CFG.permSite} vs ${CFG.configSite}`);
check("Standardrolle ist viewer",  CFG.defaultRole === "viewer");
check("hauptAdmins ist gesetzt",   Array.isArray(CFG.hauptAdmins) && CFG.hauptAdmins.length > 0);
check("orgScope kennt alle drei Rollen",
  ["viewer", "editor", "admin"].every(r => CFG.orgScope && CFG.orgScope[r]),
  JSON.stringify(CFG.orgScope));
check("orgScope nutzt nur gültige Werte",
  Object.values(CFG.orgScope || {}).every(v => ["werk", "gesellschaft", "alle"].includes(v)),
  JSON.stringify(CFG.orgScope));

/* ── Doku nennt jede Spalte ───────────────────────────────────────── */

const doku = lies("LISTEN-ANLEGEN.md");
for (const [key, liste] of Object.entries(CFG.lists)) {
  check(`LISTEN-ANLEGEN.md beschreibt ${liste}`, doku.includes(liste));
  for (const n of (SEED.EXPECTED[key] || [])) {
    if (n === "Title") continue;
    check(`LISTEN-ANLEGEN.md nennt Spalte ${liste}.${n}`, doku.includes("`" + n + "`"));
  }
}
check("LISTEN-ANLEGEN.md beschreibt AppPermissions", doku.includes(CFG.permList));
for (const n of ["UserEmail", "App", "Role"]) {
  check(`LISTEN-ANLEGEN.md nennt AppPermissions.${n}`, doku.includes("`" + n + "`"));
}

/* ── Ausgabe ──────────────────────────────────────────────────────── */

let fail = 0;
for (const r of R) {
  if (!r.ok) fail++;
  console.log((r.ok ? "PASS " : "FAIL ") + r.name + (!r.ok && r.detail ? "  ‹" + r.detail + "›" : ""));
}
console.log(`\n${R.length - fail}/${R.length} grün`);
process.exit(fail ? 1 : 0);
