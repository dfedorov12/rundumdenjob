"use strict";

/* Oberfläche: Start, dynamische Reiter, Kacheln, Intranet-Anbindung */

const APP = (() => {

  const C = RUDJ_CONFIG;
  const $ = id => document.getElementById(id);
  let current = null;

  /* ── kleine Helfer ───────────────────────────────────────────────── */

  const esc = s => { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; };

  const initials = n => {
    if (!n) return "?";
    const p = String(n).trim().split(/\s+/);
    return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase();
  };

  const safeUrl = u => {
    const s = String(u || "").trim();
    return /^(https?:|mailto:|tel:)/i.test(s) ? s : "";
  };

  let _toastT = null;
  function toast(msg, isErr = false) {
    let t = $("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = isErr ? "err-t" : "";
    t.hidden = false;
    clearTimeout(_toastT);
    _toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function modal({ title, bodyHtml, okText = "Speichern", onOk, wide = false }) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `
      <div class="modal"${wide ? ' style="max-width:860px"' : ""}>
        <div class="mh"><h4>${esc(title)}</h4><button class="x" data-x>&times;</button></div>
        <div class="mb">${bodyHtml}</div>
        <div class="mf">
          <button class="btn sec" data-x>Abbrechen</button>
          ${onOk ? `<button class="btn" data-ok>${esc(okText)}</button>` : ""}
        </div>
      </div>`;
    const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    bg.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    bg.addEventListener("click", e => { if (e.target === bg) close(); });
    document.addEventListener("keydown", onKey);
    const okBtn = bg.querySelector("[data-ok]");
    if (okBtn) okBtn.onclick = async () => {
      okBtn.disabled = true;
      try { if (await onOk(bg) !== false) close(); }
      catch (e) { toast(e.message, true); }
      finally { okBtn.disabled = false; }
    };
    document.body.appendChild(bg);
    const first = bg.querySelector("input,select,textarea");
    if (first) first.focus();
    return { el: bg, close };
  }

  /* ── Start ───────────────────────────────────────────────────────── */

  async function boot() {
    const setTxt = t => { const e = $("bootTxt"); if (e) e.textContent = t; };
    const fail = m => {
      $("bootSpin").hidden = true;
      $("bootTxt").hidden = true;
      const e = $("bootErr"); e.hidden = false; e.innerHTML = "⚠️ " + esc(m);
      const b = $("bootBtn"); b.hidden = false; b.onclick = () => AUTH.startLogin("select_account");
    };

    let r;
    try { r = await AUTH.signIn(); }
    catch (e) { return fail(e.message); }
    if (r === "redirecting") return;
    if (typeof r === "object" && r.error) return fail(r.error);

    try {
      setTxt("Benutzerdaten werden geladen …");
      await DATA.loadUser();
    } catch (e) {
      return fail("Anmeldung fehlgeschlagen: " + e.message);
    }

    if (DATA.ctx.role === "none") return showNoAccess();

    try {
      setTxt("Inhalte werden geladen …");
      await DATA.loadConfig();
    } catch (e) {
      console.warn("[Konfiguration]", e.message);
    }

    $("boot").hidden = true;
    $("app").hidden = false;
    renderHeader();
    renderTabs();
    openFromHash();
    loadAvatar();
  }

  function showNoAccess() {
    $("boot").hidden = true;
    $("noAccess").hidden = false;
    $("naMsg").textContent =
      `Ihr Konto (${DATA.ctx.email}) ist für „Rund um den Job“ nicht freigeschaltet. `
      + "Sie können hier eine Freigabe bei der IT anfordern.";
    $("naOut").onclick = AUTH.logout;
    $("naReq").onclick = requestAccess;
  }

  async function requestAccess() {
    const btn = $("naReq");
    btn.disabled = true; btn.textContent = "Wird gesendet …";
    try {
      await GRAPH.call("/me/sendMail", {
        method: "POST",
        body: JSON.stringify({
          saveToSentItems: false,
          message: {
            subject: "Freigabe-Anfrage: Rund um den Job – " + DATA.ctx.name,
            body: {
              contentType: "HTML",
              content: `<p>Hallo IT-Team,</p>
                <p>folgende Person beantragt Zugriff auf <strong>Rund um den Job</strong>:</p>
                <ul><li>Name: <strong>${esc(DATA.ctx.name)}</strong></li>
                <li>E-Mail: ${esc(DATA.ctx.email)}</li>
                <li>App: rundumdenjob</li>
                <li>Datum: ${new Date().toLocaleString("de-DE")}</li></ul>
                <p>Freigabe im <a href="${C.adminUrl}">Admin-Portal</a> erteilen.</p>`
            },
            toRecipients: [{ emailAddress: { address: C.itMail } }]
          }
        })
      });
      $("naSent").hidden = false;
      btn.hidden = true;
    } catch (e) {
      const el = $("naErr"); el.hidden = false; el.textContent = "Fehler: " + e.message;
      btn.disabled = false; btn.textContent = "📧 Freigabe anfragen";
    }
  }

  /* ── Kopfbereich ─────────────────────────────────────────────────── */

  function renderHeader() {
    const { ctx } = DATA;
    $("uName").textContent = ctx.name;
    $("uMeta").textContent = [ctx.me.jobTitle, ctx.me.department].filter(Boolean).join(" · ") || ctx.email;
    $("uAvatar").textContent = initials(ctx.name);
    const g = ctx.gesellschaft;
    if (g) {
      $("gesBadge").hidden = false;
      $("gesName").textContent = g.Gesellschaft || g.Title;
      const dot = $("gesBadge").querySelector(".dot");
      if (g.Farbe) dot.style.background = g.Farbe;
    }
    $("btnLogout").onclick = AUTH.logout;
    $("lnkSupport").onclick = e => { e.preventDefault(); location.href = "mailto:" + C.itMail + "?subject=Rund%20um%20den%20Job"; };
  }

  async function loadAvatar() {
    try {
      const token = await AUTH.getToken();
      const res = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value",
        { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      $("uAvatar").innerHTML = `<img src="${url}" alt="">`;
    } catch {}
  }

  /* ── Reiter ──────────────────────────────────────────────────────── */

  function tabs() {
    const list = DATA.visibleReiter().map(r => ({
      key: r.ReiterKey, title: r.Title, icon: r.Icon || "•", desc: r.Beschreibung, row: r
    }));
    if (DATA.isAdmin()) list.push({ key: "__settings", title: "Einstellungen", icon: "⚙️", desc: "" });
    return list;
  }

  function renderTabs() {
    const bar = $("tabBar");
    bar.innerHTML = "";
    for (const t of tabs()) {
      const b = document.createElement("button");
      b.innerHTML = `<span class="ico">${esc(t.icon)}</span>${esc(t.title)}`;
      b.dataset.key = t.key;
      b.onclick = () => open(t.key);
      bar.appendChild(b);
    }
  }

  function openFromHash() {
    const key = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    const all = tabs();
    open(all.some(t => t.key === key) ? key : (all[0]?.key || null));
  }

  function open(key) {
    const all = tabs();
    if (!key || !all.some(t => t.key === key)) {
      $("main").innerHTML = emptyState("🗂️", "Keine Inhalte freigegeben",
        "Für Ihr Konto ist derzeit kein Bereich freigeschaltet. Wenden Sie sich an die IT.");
      return;
    }
    current = key;
    history.replaceState({}, "", "#" + encodeURIComponent(key));
    document.querySelectorAll("#tabBar button")
      .forEach(b => b.classList.toggle("active", b.dataset.key === key));

    if (key === "__settings") return SETTINGS.render($("main"));
    renderReiter(all.find(t => t.key === key));
  }

  const emptyState = (ico, title, text) =>
    `<div class="empty"><div class="big">${ico}</div><b>${esc(title)}</b><p>${esc(text)}</p></div>`;

  /* ── Reiter-Inhalt ───────────────────────────────────────────────── */

  function renderReiter(tab) {
    const m = $("main");
    const kacheln = DATA.kachelnFor(tab.key);

    m.innerHTML = `
      <div class="view active">
        <div class="page-head">
          <h2><span>${esc(tab.icon)}</span>${esc(tab.title)}</h2>
          ${tab.desc ? `<p>${esc(tab.desc)}</p>` : ""}
        </div>
        <div id="tabExtra"></div>
        <div id="tabTiles"></div>
      </div>`;

    const tilesEl = $("tabTiles");
    tilesEl.innerHTML = kacheln.length
      ? `<div class="tiles">${kacheln.map(tileHtml).join("")}</div>`
      : (tab.key === "start" ? "" : emptyState("📭", "Noch keine Inhalte",
          "In diesem Bereich sind für Sie derzeit keine Inhalte hinterlegt."));

    if (tab.key === "start") renderStart($("tabExtra"));
  }

  function tileHtml(k) {
    const icon = esc(k.Icon || "🔗");
    const badge = k.Badge ? `<span class="badge">${esc(k.Badge)}</span>` : "";
    const typ = String(k.Typ || "link").toLowerCase();

    if (typ === "text") {
      return `<div class="tile text-tile card-wide">${badge}
        <div class="tb">
          <b>${icon} ${esc(k.Title)}</b>
          ${k.Beschreibung ? `<p style="margin:0 0 8px;color:var(--muted);font-size:13.5px">${esc(k.Beschreibung)}</p>` : ""}
          <div class="body">${esc(k.Inhalt || "")}</div>
        </div></div>`;
    }
    const url = safeUrl(k.Url);
    const inner = `${badge}
      <div class="ti">${icon}</div>
      <div class="tb"><b>${esc(k.Title)}</b><p>${esc(k.Beschreibung || "")}</p></div>
      ${url ? '<span class="arrow">↗</span>' : ""}`;
    return url
      ? `<a class="tile" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="tile">${inner}</div>`;
  }

  /* ── Startseite: Profil, Orgchart-Anbindung, Intranet-News ───────── */

  function renderStart(host) {
    const { ctx } = DATA;
    const g = ctx.gesellschaft;
    host.innerHTML = `
      <div class="split">
        <div class="card">
          <h4>👤 Mein Profil</h4>
          <dl class="kv">
            <dt>Name</dt><dd>${esc(ctx.name)}</dd>
            <dt>E-Mail</dt><dd>${esc(ctx.email)}</dd>
            <dt>Position</dt><dd>${esc(ctx.me.jobTitle || "–")}</dd>
            <dt>Abteilung</dt><dd>${esc(ctx.me.department || "–")}</dd>
            <dt>Standort</dt><dd>${esc(ctx.me.officeLocation || "–")}</dd>
            <dt>Gesellschaft</dt><dd>${esc(g ? (g.Gesellschaft || g.Title) : "automatisch nicht zugeordnet")}</dd>
            <dt>Zugeordnet über</dt><dd>@${esc(ctx.domain || "–")}</dd>
            <dt>Berechtigung</dt><dd><span class="pill ${ctx.role === "admin" ? "orange" : ctx.role === "editor" ? "navy" : ""}">${esc(ctx.role)}</span></dd>
          </dl>
        </div>
        <div class="card">
          <h4>🗂️ Mein Umfeld</h4>
          <div id="orgBox"><p class="hint">Wird geladen …</p></div>
          <div class="row" style="margin-top:12px">
            <a class="btn sec sm" href="${esc(C.orgchartUrl)}" target="_blank" rel="noopener">Zum Organigramm ↗</a>
          </div>
        </div>
      </div>
      <div class="card" id="newsCard" hidden>
        <h4>📰 Neues aus der DIHAG</h4>
        <div class="news" id="newsBox"></div>
      </div>`;

    loadOrgBox();
    loadIntranetNews();
  }

  /** Anbindung an das Organigramm: Vorgesetzte:r + direkte Kolleg:innen
   *  kommen aus denselben Graph-Daten, die auch das Orgchart nutzt. */
  async function loadOrgBox() {
    const box = $("orgBox");
    if (!box) return;
    try {
      const sel = "$select=id,displayName,jobTitle,mail,department";
      let mgr = null;
      try { mgr = await GRAPH.call("/me/manager?" + sel); } catch {}
      let peers = [];
      if (mgr) {
        try {
          const d = await GRAPH.call(`/users/${mgr.id}/directReports?${sel}`);
          peers = (d.value || []).filter(p => (p.mail || "").toLowerCase() !== DATA.ctx.email);
        } catch {}
      }
      let reports = [];
      try {
        const d = await GRAPH.call("/me/directReports?" + sel);
        reports = d.value || [];
      } catch {}
      const seen = new Set(reports.map(p => p.id));
      peers = peers.filter(p => !seen.has(p.id));

      const person = p => `
        <a class="person" href="mailto:${esc(p.mail || "")}">
          <span class="avatar">${esc(initials(p.displayName))}</span>
          <span class="pn"><b>${esc(p.displayName)}</b><small>${esc(p.jobTitle || p.mail || "")}</small></span>
        </a>`;

      const parts = [];
      if (mgr) parts.push(`<h3 class="section">Führungskraft</h3><div class="people">${person(mgr)}</div>`);
      if (reports.length) parts.push(`<h3 class="section">Mein Team (${reports.length})</h3>
        <div class="people">${reports.slice(0, 6).map(person).join("")}</div>`);
      if (peers.length) parts.push(`<h3 class="section">Kolleginnen &amp; Kollegen</h3>
        <div class="people">${peers.slice(0, 5).map(person).join("")}</div>`);

      box.innerHTML = parts.length ? parts.join("")
        : `<p class="hint">Für Ihr Konto sind im Verzeichnis keine Zuordnungen hinterlegt.</p>`;
    } catch (e) {
      box.innerHTML = `<p class="hint">Verzeichnisdaten konnten nicht geladen werden.</p>`;
    }
  }

  /** Neuigkeiten aus dem SharePoint-Intranet (Site Pages der Root-Site). */
  async function loadIntranetNews() {
    try {
      const sid = await GRAPH.siteId(C.intranet.site);
      const d = await GRAPH.call(
        `/sites/${sid}/pages/microsoft.graph.sitePage`
        + `?$select=title,webUrl,lastModifiedDateTime,promotionKind`
        + `&$orderby=lastModifiedDateTime desc&$top=20`);
      const pages = (d.value || [])
        .filter(p => p.promotionKind !== "hidden")
        .slice(0, C.intranet.newsCount);
      if (!pages.length) return;
      $("newsBox").innerHTML = pages.map(p => `
        <a href="${esc(p.webUrl)}" target="_blank" rel="noopener">
          <span class="nt">${esc(p.title)}</span>
          <span class="nd">${new Date(p.lastModifiedDateTime).toLocaleDateString("de-DE")}</span>
        </a>`).join("");
      $("newsCard").hidden = false;
    } catch (e) {
      console.warn("[Intranet]", e.message);   // z. B. fehlende Sites-Berechtigung
    }
  }

  /* ── Öffentliche Schnittstelle ───────────────────────────────────── */

  async function reload() {
    DATA.clearCache();
    await DATA.loadConfig(true);
    renderTabs();
    open(current);
  }

  return { boot, open, reload, toast, modal, esc, initials, emptyState, safeUrl };
})();

document.addEventListener("DOMContentLoaded", APP.boot);
