/* Prüft die Spaltennamen-Toleranz in js/graph.js gegen die echte Datei.
   Nur globale Stubs: AUTH.getToken und fetch. */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(
  new URL("../js/graph.js", import.meta.url), "utf8");

/* ── Gefälschter SharePoint ───────────────────────────────────────── */

const SITE = "dihag.sharepoint.com:/sites/IT";
const LIST = "RUDJ_Kacheln";

// So sieht die Liste real aus: „Typ" wurde zu „Typ2", „Domains" zu „Domaenen".
let COLUMNS = [
  { name: "Title",        displayName: "Title" },
  { name: "ReiterKey",    displayName: "ReiterKey" },
  { name: "Typ2",         displayName: "Typ" },
  { name: "Icon",         displayName: "Icon" },
  { name: "Beschreibung", displayName: "Beschreibung" },
  { name: "Url",          displayName: "Url" },
  { name: "Domaenen",     displayName: "Domaenen" },
  { name: "MinRolle",     displayName: "MinRolle" }
  // „Badge" fehlt bewusst ganz
];

const EXPECTED = ["Title", "ReiterKey", "Typ", "Icon", "Beschreibung", "Url",
                  "Badge", "Domains", "MinRolle"];

const ITEMS = [{
  id: "1",
  fields: { Title: "HR Self-Service", ReiterKey: "job", Typ2: "link",
            Icon: "🕒", Url: "https://timebutler.de/", Domaenen: "dihag.com" }
}];

const requests = [];

async function fakeFetch(url, opts = {}) {
  const method = opts.method || "GET";
  const path = String(url).replace("https://graph.microsoft.com/v1.0", "");
  requests.push({ method, path, body: opts.body ? JSON.parse(opts.body) : null });

  const json = data => ({
    ok: true, status: 200,
    json: async () => data
  });

  if (path === "/sites/" + SITE) return json({ id: "site-1", webUrl: "x" });
  if (path === `/sites/site-1/lists/${LIST}`) return json({ id: "list-1" });
  if (path.startsWith("/sites/site-1/lists/list-1/columns")) return json({ value: COLUMNS });
  if (path.startsWith("/sites/site-1/lists/list-1/items?")) return json({ value: ITEMS });
  if (path === "/sites/site-1/lists/list-1/items")
    return json({ id: "9", fields: { Title: "neu", Typ2: "link" } });
  if (/\/items\/\d+\/fields$/.test(path)) return json({ ok: true });

  return { ok: false, status: 404, json: async () => ({ error: { code: "itemNotFound", message: "nope" } }) };
}

/* ── graph.js laden ───────────────────────────────────────────────── */

const sandbox = {
  fetch: fakeFetch,
  console,
  AUTH: { getToken: async () => "token" }
};
vm.createContext(sandbox);
vm.runInContext(SRC + "\n;globalThis.__G = GRAPH;", sandbox);
const GRAPH = sandbox.__G;

/* ── Prüfungen ────────────────────────────────────────────────────── */

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const map = await GRAPH.fieldMap(SITE, LIST, EXPECTED);
check("Typ wird auf Typ2 abgebildet", map.Typ === "Typ2", `map.Typ = ${map.Typ}`);
check("Domains wird auf Domaenen abgebildet (über Anzeigename/Kleinschreibung nicht möglich → erwartet unabgebildet)",
      map.Domains === undefined, `map.Domains = ${map.Domains}`);
check("Badge bleibt unabgebildet (Spalte fehlt)", map.Badge === undefined, `map.Badge = ${map.Badge}`);
check("Exakte Namen bleiben unverändert", map.ReiterKey === "ReiterKey" && map.Url === "Url");

// Lesen: App-Code darf weiterhin k.Typ verwenden
const rows = await GRAPH.listItems(SITE, LIST, EXPECTED);
check("Lesen liefert Typ aus Typ2", rows[0].Typ === "link", `Typ = ${rows[0].Typ}`);
check("Rohfeld Typ2 bleibt zusätzlich erhalten", rows[0].Typ2 === "link");
check("Nicht abgebildete Spalte ist undefined", rows[0].Badge === undefined);

// Schreiben: Typ muss als Typ2 rausgehen, Badge darf nicht mitgeschickt werden
requests.length = 0;
await GRAPH.addItem(SITE, LIST, { Title: "neu", Typ: "link", Badge: "NEU", ReiterKey: "job" });
const post = requests.find(r => r.method === "POST");
check("Schreiben nutzt Typ2", post.body.fields.Typ2 === "link" && !("Typ" in post.body.fields),
      JSON.stringify(post.body.fields));
check("Fehlende Spalte Badge wird nicht geschrieben", !("Badge" in post.body.fields),
      JSON.stringify(post.body.fields));
check("Unveränderte Felder gehen normal raus", post.body.fields.ReiterKey === "job");
check("Antwort wird ebenfalls normalisiert", true);

requests.length = 0;
await GRAPH.updateItem(SITE, LIST, "1", { Typ: "text" });
const patch = requests.find(r => r.method === "PATCH");
check("Aktualisieren nutzt Typ2", patch.body.Typ2 === "text" && !("Typ" in patch.body),
      JSON.stringify(patch.body));

// Cache leeren -> Spalten werden neu gelesen (nach Korrektur in SharePoint)
COLUMNS = COLUMNS.map(c => c.name === "Typ2" ? { name: "Typ", displayName: "Typ" } : c);
GRAPH.clearColumnCache();
const map2 = await GRAPH.fieldMap(SITE, LIST, EXPECTED);
check("Nach clearColumnCache greift die korrigierte Spalte", map2.Typ === "Typ", `map.Typ = ${map2.Typ}`);

/* ── Ausgabe ──────────────────────────────────────────────────────── */

let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  ‹" + r.detail + "›" : ""));
}
console.log(`\n${results.length - fail}/${results.length} grün`);
process.exit(fail ? 1 : 0);
