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

    // Reiterleiste neu aufteilen, wenn sich die Breite ändert. Der
    // ResizeObserver deckt auch Zoom und erscheinende Scrollbalken ab;
    // fonts.ready ist nötig, weil Exo erst nachgeladen wird und die
    // Textbreiten dadurch nachträglich wachsen.
    let t = null;
    const relayout = () => { clearTimeout(t); t = setTimeout(layoutTabs, 80); };
    if (window.ResizeObserver) {
      // Referenz festhalten – ein nicht referenzierter Observer darf
      // eingesammelt werden und feuert dann nicht mehr.
      _tabObserver = new ResizeObserver(relayout);
      _tabObserver.observe($("tabBar"));
    }
    addEventListener("resize", relayout);   // zusätzlich, schadet nicht
    document.fonts?.ready.then(layoutTabs).catch(() => {});

    document.addEventListener("click", () => { const m = $("tabMenu"); if (m) m.hidden = true; });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { const m = $("tabMenu"); if (m) m.hidden = true; }
    });
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
      bar.appendChild(tabButton(t, "tab"));
    }
    // „⋯ Mehr“ nimmt auf, was nicht in die Breite passt
    const wrap = document.createElement("div");
    wrap.className = "tab-more";
    wrap.hidden = true;
    wrap.innerHTML = `<button id="tabMore" title="Weitere Bereiche">
        <span class="ico">⋯</span>Mehr</button>
      <div class="tab-menu" id="tabMenu" hidden></div>`;
    bar.appendChild(wrap);
    wrap.querySelector("#tabMore").onclick = e => {
      e.stopPropagation();
      const m = $("tabMenu");
      m.hidden = !m.hidden;
    };
    layoutTabs();
  }

  function tabButton(t, cls) {
    const b = document.createElement("button");
    b.className = cls;
    b.innerHTML = `<span class="ico">${esc(t.icon)}</span>${esc(t.title)}`;
    b.dataset.key = t.key;
    b.onclick = () => { $("tabMenu").hidden = true; open(t.key); };
    return b;
  }

  /** Blendet aus, was nicht in die Zeile passt, und hängt es ins Menü.
   *  Ersetzt den früheren waagerechten Scrollbalken. */
  let _laying = false;
  let _tabObserver = null;
  function layoutTabs() {
    const bar = $("tabBar");
    const wrap = bar?.querySelector(".tab-more");
    if (!bar || !wrap || _laying) return;   // Schutz gegen Rückkopplung des ResizeObservers
    _laying = true;
    try { layoutTabsInner(bar, wrap); } finally { _laying = false; }
  }

  function layoutTabsInner(bar, wrap) {
    const menu = $("tabMenu");
    const btns = [...bar.querySelectorAll("button.tab")];

    // Erst alles zeigen, um die echten Breiten zu messen
    btns.forEach(b => b.hidden = false);
    wrap.hidden = false;
    const cs = getComputedStyle(bar);
    const avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const GAP = 2;
    const widths = btns.map(b => b.offsetWidth + GAP);
    const total = widths.reduce((a, b) => a + b, 0);

    if (total <= avail) {                 // alles passt – kein Menü nötig
      wrap.hidden = true;
      menu.hidden = true;
      menu.innerHTML = "";
      return;
    }

    const moreW = wrap.offsetWidth + GAP;
    let used = 0, cut = btns.length;
    for (let i = 0; i < btns.length; i++) {
      if (used + widths[i] > avail - moreW) { cut = i; break; }
      used += widths[i];
    }
    if (cut === 0) cut = 1;               // mindestens ein Reiter bleibt sichtbar

    const versteckt = [];
    btns.forEach((b, i) => {
      b.hidden = i >= cut;
      if (i >= cut) versteckt.push(b.dataset.key);
    });

    const alle = tabs();
    menu.innerHTML = "";
    for (const key of versteckt) {
      const t = alle.find(x => x.key === key);
      if (!t) continue;
      const b = tabButton(t, "");
      b.classList.toggle("active", key === current);
      menu.appendChild(b);
    }
    // Liegt der aktive Reiter im Menü, wird „Mehr“ hervorgehoben
    wrap.querySelector("#tabMore").classList.toggle("active", versteckt.includes(current));
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
    layoutTabs();

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
            <dt>Werk</dt><dd>${esc(ctx.me.companyName || "–")}</dd>
            <dt>Standort</dt><dd>${esc(ctx.me.officeLocation || "–")}</dd>
            <dt>Gesellschaft</dt><dd>${esc(g ? (g.Gesellschaft || g.Title) : "automatisch nicht zugeordnet")}</dd>
            <dt>Zugeordnet über</dt><dd>@${esc(ctx.domain || "–")}</dd>
            <dt>Berechtigung</dt><dd><span class="pill ${ctx.role === "admin" ? "orange" : ctx.role === "editor" ? "navy" : ""}">${esc(ctx.role)}</span></dd>
          </dl>
          ${DATA.roleInfo.fehler ? `<p class="err" style="margin:14px 0 0">
            ${esc(DATA.roleErklaerung())}</p>` : ""}
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

  /** Eine Person in der Liste: Zeile zum Anklappen, Kontaktdaten erst
   *  nach dem Klick. Vorher war die Zeile ein reiner mailto-Link – die
   *  übrigen Angaben waren gar nicht erreichbar. */
  function person(p, meinWerk) {
    const tel = [p.mobilePhone, ...(p.businessPhones || [])].filter(Boolean);
    const werk = p.companyName || "";
    const fremd = werk && meinWerk && werk !== meinWerk;
    const zeile = (dt, dd) => dd ? `<dt>${dt}</dt><dd>${dd}</dd>` : "";
    return `
      <div class="person" data-person tabindex="0" role="button" aria-expanded="false"
           aria-label="Kontaktdaten von ${esc(p.displayName)} anzeigen">
        <span class="avatar">${esc(initials(p.displayName))}</span>
        <span class="pn"><b>${esc(p.displayName)}</b><small>${esc(p.jobTitle || p.mail || "")}</small></span>
        ${fremd ? `<span class="pill gray" style="font-size:10px">${esc(werk)}</span>` : ""}
        <span class="chev">▾</span>
      </div>
      <div class="person-det" hidden>
        <dl class="kv">
          ${zeile("E-Mail", p.mail ? `<a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : "")}
          ${tel.map(t => zeile("Telefon", `<a href="tel:${esc(String(t).replace(/\s+/g, ""))}">${esc(t)}</a>`)).join("")}
          ${zeile("Position", esc(p.jobTitle || ""))}
          ${zeile("Abteilung", esc(p.department || ""))}
          ${zeile("Werk", esc(werk))}
          ${zeile("Standort", esc(p.officeLocation || ""))}
        </dl>
        ${!p.mail && !tel.length ? `<p class="hint" style="margin:0">Keine Kontaktdaten hinterlegt.</p>` : ""}
      </div>`;
  }

  /** Anbindung an das Organigramm: Vorgesetzte:r + direkte Kolleg:innen
   *  kommen aus denselben Graph-Daten, die auch das Orgchart nutzt. */
  async function loadOrgBox() {
    const box = $("orgBox");
    if (!box) return;
    try {
      const sel = "$select=id,displayName,jobTitle,mail,department,officeLocation,"
        + "companyName,mobilePhone,businessPhones";
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

      // Sichtbarkeit nach Rolle einschränken – Werk = companyName, wie im Orgchart.
      const scope = (C.orgScope || {})[DATA.ctx.role] || "werk";
      const meinWerk = DATA.ctx.me.companyName || "";
      const imScope = p => {
        if (scope === "alle") return true;
        if (scope === "gesellschaft") return DATA.ctx.domains.includes(DATA.domainOf(p.mail));
        return !meinWerk || (p.companyName || "") === meinWerk;   // werk
      };
      const vorFilter = reports.length + peers.length;
      reports = reports.filter(imScope);
      peers   = peers.filter(imScope);
      const ausgeblendet = vorFilter - reports.length - peers.length;

      const parts = [];
      if (mgr) parts.push(`<h3 class="section">Führungskraft</h3>
        <div class="people">${person(mgr, meinWerk)}</div>`);
      if (reports.length) parts.push(`<h3 class="section">Mein Team (${reports.length})</h3>
        <div class="people">${reports.slice(0, 8).map(p => person(p, meinWerk)).join("")}</div>`);
      if (peers.length) parts.push(`<h3 class="section">Kolleginnen &amp; Kollegen</h3>
        <div class="people">${peers.slice(0, 8).map(p => person(p, meinWerk)).join("")}</div>`);

      box.innerHTML = parts.length ? parts.join("")
        : `<p class="hint">Für Ihr Konto sind im Verzeichnis keine Zuordnungen hinterlegt.</p>`;

      if (parts.length) {
        box.insertAdjacentHTML("beforeend", `<p class="hint" style="margin-top:14px">
          ${scope === "alle" ? "Alle Werke sichtbar."
            : scope === "gesellschaft" ? `Eingeschränkt auf die Gesellschaft <b>@${esc(DATA.ctx.domain)}</b>.`
            : meinWerk ? `Eingeschränkt auf Ihr Werk <b>${esc(meinWerk)}</b>.`
                       : "Kein Werk im Verzeichnis hinterlegt (Feld <code>companyName</code>) – es wird nicht eingeschränkt."}
          ${ausgeblendet > 0 ? ` ${ausgeblendet} Person(en) aus anderen Werken ausgeblendet.` : ""}
          Zum Aufklappen der Kontaktdaten auf eine Person klicken.</p>`);
      }

      box.querySelectorAll("[data-person]").forEach(el => {
        const umschalten = () => {
          const d = el.nextElementSibling;
          const offen = !d.hidden;
          box.querySelectorAll(".person-det").forEach(x => x.hidden = true);
          box.querySelectorAll("[data-person]").forEach(x => {
            x.classList.remove("open");
            x.setAttribute("aria-expanded", "false");
          });
          if (offen) return;
          d.hidden = false;
          el.classList.add("open");
          el.setAttribute("aria-expanded", "true");
        };
        el.onclick = umschalten;
        // Ein div mit role="button" löst bei Enter/Leertaste keinen Klick aus –
        // ohne das hier wäre die Zeile nur mit der Maus bedienbar.
        el.onkeydown = e => {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            umschalten();
          }
        };
      });
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

  /** Reiterleiste neu aufbauen, ohne den aktuellen Inhalt zu verwerfen –
   *  nötig, wenn sich die Konfiguration im Hintergrund geändert hat
   *  (z. B. nach dem Import einer Portalkonfiguration). */
  function refreshTabs() {
    renderTabs();
    document.querySelectorAll("#tabBar button")
      .forEach(b => b.classList.toggle("active", b.dataset.key === current));
    layoutTabs();
  }

  return { boot, open, reload, refreshTabs, toast, modal, esc, initials, emptyState, safeUrl };
})();

document.addEventListener("DOMContentLoaded", APP.boot);
