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

  async function listItems(sitePath, name, top = 999) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) return null;   // Liste fehlt
    const rows = await callAll(`/sites/${sid}/lists/${lid}/items?$expand=fields&$top=${top}`);
    return rows.map(r => ({ id: r.id, ...(r.fields || {}) }));
  }

  async function addItem(sitePath, name, fields) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) throw new Error(`Liste „${name}“ existiert nicht.`);
    const r = await call(`/sites/${sid}/lists/${lid}/items`, {
      method: "POST",
      body: JSON.stringify({ fields })
    });
    return { id: r.id, ...(r.fields || {}) };
  }

  async function updateItem(sitePath, name, itemId, fields) {
    const sid = await siteId(sitePath);
    const lid = await listId(sitePath, name);
    if (!lid) throw new Error(`Liste „${name}“ existiert nicht.`);
    return call(`/sites/${sid}/lists/${lid}/items/${itemId}/fields`, {
      method: "PATCH",
      body: JSON.stringify(fields)
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
    ensureList, colText, colNote, colNum, colBool, colDate
  };
})();
