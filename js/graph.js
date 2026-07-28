"use strict";

/* Microsoft-Graph-Helfer + SharePoint-Listenzugriff */

const GRAPH = (() => {

  const BASE = "https://graph.microsoft.com/v1.0";
  const _siteIds = {};   // "host:/sites/x" → id
  const _listIds = {};   // "siteId|Listenname" → id

  async function call(path, opts = {}) {
    const token = await AUTH.getToken();
    const url = path.startsWith("https://") ? path : BASE + path;
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || String(res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.code = data?.error?.code;
      // Für die Diagnose: welcher Aufruf ist womit gescheitert?
      err.request = (opts.method || "GET") + " " + path.replace(BASE, "");
      err.detail = `${err.request} → HTTP ${res.status}`
        + (err.code ? ` ${err.code}` : "") + `: ${msg}`;
      throw err;
    }
    return data;
  }

  /** Alle Seiten einer Collection einsammeln (@odata.nextLink). */
  async function callAll(path, maxPages = 20) {
    let out = [], next = path, pages = 0;
    while (next && pages++ < maxPages) {
      const d = await call(next);
      out = out.concat(d?.value || []);
      next = d?.["@odata.nextLink"] || null;
    }
    return out;
  }

  async function siteId(sitePath) {
    if (_siteIds[sitePath]) return _siteIds[sitePath];
    const s = await call("/sites/" + sitePath);
    _siteIds[sitePath] = s.id;
    return s.id;
  }

  /** Listen-ID; null wenn die Liste nicht existiert. */
  async function listId(sitePath, name) {
    const sid = await siteId(sitePath);
    const key = sid + "|" + name;
    if (_listIds[key]) return _listIds[key];
    try {
      const l = await call(`/sites/${sid}/lists/${encodeURIComponent(name)}`);
      _listIds[key] = l.id;
      return l.id;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  /* ── Spaltennamen-Toleranz ────────────────────────────────────────────
     SharePoint hängt beim Anlegen eine Ziffer an, wenn der interne Name
     schon belegt ist – aus „Typ“ wird dann „Typ2“. Auch ein nachträglich
     geänderter Anzeigename lässt den internen Namen unberührt. Damit die
     App unabhängig davon funktioniert, wird einmal je Liste eine Zuordnung
     „erwarteter Name → tatsächlicher interner Name“ aufgebaut und beim
     Lesen und Schreiben automatisch angewandt.                          */

  const _colMaps = {};    // "sitePath|Liste" → { erwartet: intern }
  const _colExp   = {};   // "sitePath|Liste" → string[] erwarteter Namen

  function clearColumnCache() {
    for (const k of Object.keys(_colMaps)) delete _colMaps[k];
    for (const k of Object.keys(_colExp)) delete _colExp[k];
  }

  async function columns(sitePath, name) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) return [];
    const d = await call(`/sites/${sid}/lists/${lid}/columns?$select=name,displayName&$top=200`);
    return d.value || [];
  }

  const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** @returns {Promise<Object<string,string>>} erwartet → intern */
  async function fieldMap(sitePath, name, expected, force = false) {
    const key = sitePath + "|" + name;
    if (_colMaps[key] && !force) return _colMaps[key];
    const cols = await columns(sitePath, name);
    const exact = new Set(cols.map(c => c.name));
    const map = {};
    for (const e of expected) {
      if (exact.has(e)) { map[e] = e; continue; }
      // „Typ“ → „Typ2“
      const suffixed = cols.find(c => new RegExp("^" + rxEsc(e) + "\\d+$").test(c.name));
      if (suffixed) { map[e] = suffixed.name; continue; }
      // Anzeigename passt, interner Name weicht ab
      const byDisplay = cols.find(c => (c.displayName || "").toLowerCase() === e.toLowerCase());
      if (byDisplay) { map[e] = byDisplay.name; continue; }
      const ci = cols.find(c => c.name.toLowerCase() === e.toLowerCase());
      if (ci) { map[e] = ci.name; continue; }
      // bleibt unabgebildet → Spalte fehlt wirklich
    }
    _colMaps[key] = map;
    _colExp[key] = expected.slice();
    return map;
  }

  /** Rohfelder → erwartete Namen (fürs Lesen). */
  function normalize(sitePath, name, fields) {
    const map = _colMaps[sitePath + "|" + name];
    if (!map) return fields;
    const out = { ...fields };
    for (const [erwartet, intern] of Object.entries(map)) {
      if (erwartet !== intern) out[erwartet] = fields[intern];
    }
    return out;
  }

  /** Erwartete Namen → interne Namen (fürs Schreiben). */
  function denormalize(sitePath, name, fields) {
    const key = sitePath + "|" + name;
    const map = _colMaps[key];
    if (!map) return fields;
    const exp = _colExp[key] || [];
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
      if (map[k]) { out[map[k]] = v; continue; }
      if (exp.includes(k)) {
        console.warn(`[SharePoint] Spalte „${k}“ fehlt in ${name} – Wert wird nicht geschrieben.`);
        continue;
      }
      out[k] = v;
    }
    return out;
  }

  /** @param expected Erwartete Feldnamen; aktiviert die Spaltennamen-Toleranz. */
  async function listItems(sitePath, name, expected = null, top = 999) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) return null;   // Liste fehlt
    if (expected) await fieldMap(sitePath, name, expected);
    const rows = await callAll(`/sites/${sid}/lists/${lid}/items?$expand=fields&$top=${top}`);
    return rows.map(r => ({ id: r.id, ...normalize(sitePath, name, r.fields || {}) }));
  }

  async function addItem(sitePath, name, fields) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) throw new Error(`Liste „${name}“ existiert nicht.`);
    const r = await call(`/sites/${sid}/lists/${lid}/items`, {
      method: "POST",
      body: JSON.stringify({ fields: denormalize(sitePath, name, fields) })
    });
    return { id: r.id, ...normalize(sitePath, name, r.fields || {}) };
  }

  async function updateItem(sitePath, name, itemId, fields) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) throw new Error(`Liste „${name}“ existiert nicht.`);
    return call(`/sites/${sid}/lists/${lid}/items/${itemId}/fields`, {
      method: "PATCH",
      body: JSON.stringify(denormalize(sitePath, name, fields))
    });
  }

  async function deleteItem(sitePath, name, itemId) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) throw new Error(`Liste „${name}“ existiert nicht.`);
    return call(`/sites/${sid}/lists/${lid}/items/${itemId}`, { method: "DELETE" });
  }

  /** Legt eine Liste samt Spalten an, falls sie fehlt. Braucht Schreibrechte
   *  auf der Site; ohne diese Rechte wird der Fehler nach oben gereicht. */
  async function ensureList(sitePath, name, columns) {
    const existing = await listId(sitePath, name);
    if (existing) return existing;
    const sid = await siteId(sitePath);
    const l = await call(`/sites/${sid}/lists`, {
      method: "POST",
      body: JSON.stringify({
        displayName: name,
        list: { template: "genericList" },
        columns
      })
    });
    _listIds[sid + "|" + name] = l.id;
    return l.id;
  }

  /* ── Spaltendefinitionen für ensureList ──────────────────────────── */
  const colText   = (n, max = 255) => ({ name: n, text: { maxLength: max } });
  const colNote   = n => ({ name: n, text: { allowMultipleLines: true, textType: "plain" } });
  const colNum    = n => ({ name: n, number: {} });
  const colBool   = n => ({ name: n, boolean: {} });
  const colDate   = n => ({ name: n, dateTime: { format: "dateOnly" } });

  return {
    call, callAll, siteId, listId, listItems, addItem, updateItem, deleteItem,
    ensureList, columns, fieldMap, clearColumnCache,
    colText, colNote, colNum, colBool, colDate
  };
})();
