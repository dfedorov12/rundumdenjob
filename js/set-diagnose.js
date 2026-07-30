"use strict";

/* Einstellungen -> Diagnose */

SETTINGS_VIEWS.diagnose = (() => {
  const { C, $, esc } = SETUI;

  /* ── 5 · Diagnose ─────────────────────────────────────────────────
     Die früheren Einrichtungsschritte (Listen anlegen, Gesellschaften
     übernehmen, Startinhalte) sind entfallen – die Einrichtung ist
     abgeschlossen. Für eine neue Umgebung bleibt setup-rundumdenjob.ps1
     bzw. LISTEN-ANLEGEN.md der Weg.                                    */

  function viewDiagnose(host) {
    const missing = DATA.cfg.missing;
    host.innerHTML = `
      <div class="card">
        <h4>🩺 Diagnose</h4>
        ${missing.length
          ? `<div class="warn">Es fehlen Listen: <b>${missing.map(esc).join(", ")}</b>.
               Anlegen nach <b>LISTEN-ANLEGEN.md</b> im Repository.</div>`
          : `<div class="ok">Alle Konfigurationslisten sind vorhanden.</div>`}
        <p class="hint">Prüft Konto, Rolle, Token-Berechtigungen sowie jede Liste
          <b>und jede Spalte</b> auf <b>${esc(C.configSite)}</b>. Abweichende interne
          Spaltennamen (z. B. <code>Typ</code> → <code>Typ2</code>) werden dabei
          ausgewiesen – die App berücksichtigt sie automatisch.</p>
        <div class="row">
          <button class="btn" id="dRun">🔍 Diagnose starten</button>
          <button class="btn sec" id="dWrite">🧪 Schreibtest auf der Site</button>
          <button class="btn sec" id="sReload">🔄 Konfiguration neu laden</button>
        </div>
        <p class="hint" style="margin:12px 0 0">Der Schreibtest legt eine Hilfsliste
          <code>RUDJ_Schreibtest</code> an und löscht sie sofort wieder – er verändert nichts
          an Ihrer Konfiguration.</p>
        <pre id="dLog" style="margin-top:16px;background:#f7fafd;border:1px solid var(--border);
          border-radius:8px;padding:12px;font-size:12.5px;max-height:320px;overflow:auto"
          hidden></pre>
      </div>
      <div class="card">
        <h4>ℹ️ So funktioniert die Sichtbarkeit</h4>
        <ol style="font-size:14px;color:var(--text);padding-left:20px;line-height:1.8;margin:0">
          <li>Beim Anmelden liest die Seite die E-Mail-Domäne des Kontos
              (<code>${esc(DATA.ctx.domain || "–")}</code>).</li>
          <li>Die Domäne wird über <b>Gesellschaften &amp; Domänen</b> automatisch einer
              Gesellschaft zugeordnet – ohne Zutun der Nutzenden.</li>
          <li>Zusätzlich wird die Rolle aus <b>${esc(C.permList)}</b> ermittelt
              (Standard: <code>viewer</code>).</li>
          <li>Ein <b>Reiter</b> erscheint nur, wenn Domäne und Rolle passen.
              Ist kein Reiter sichtbar, sieht die Person auch keine Navigation.</li>
          <li>Innerhalb eines Reiters wird jede <b>Kachel</b> noch einmal einzeln geprüft –
              zusätzlich gegen den Gültigkeitszeitraum.</li>
        </ol>
      </div>`;

    const dlog = m => { const p = $("dLog"); p.hidden = false; p.textContent += m + "\n"; p.scrollTop = p.scrollHeight; };
    $("dRun").onclick    = e => diagnose(e.target, dlog);
    $("dWrite").onclick  = e => writeTest(e.target, dlog);
    $("sReload").onclick = () => APP.reload();
  }

  /** Nur-Lese-Diagnose: Konto, Token-Berechtigungen, Site- und Listenzugriff. */
  async function diagnose(btn, log) {
    btn.disabled = true;
    $("dLog").textContent = "";
    try {
      log("── Konto ──────────────────────────────");
      log("Angemeldet:      " + DATA.ctx.email);
      log("Ermittelte Rolle: " + DATA.ctx.role);
      log("Begründung:       " + DATA.roleErklaerung());

      log("\n── Token ──────────────────────────────");
      const ti = AUTH.tokenInfo();
      if (!ti) {
        log("Token nicht lesbar – bitte neu anmelden.");
      } else {
        log("App-Registrierung: " + (ti.appId || "?"));
        log("Gültig bis:        " + (ti.exp ? ti.exp.toLocaleString("de-DE") : "?"));
        log("Berechtigungen:    " + (ti.scopes.join(", ") || "(keine)"));
        const fehlt = C.scopes.filter(s => !ti.scopes.includes(s));
        if (fehlt.length) {
          log("⚠ NICHT im Token:  " + fehlt.join(", "));
          if (fehlt.includes("Sites.ReadWrite.All"))
            log("  → Das ist die Ursache. Sites.ReadWrite.All muss an der App-Registrierung\n"
              + "    " + (ti.appId || C.clientId) + " als delegierte Berechtigung stehen\n"
              + "    UND per Administratorzustimmung erteilt sein. Danach abmelden und neu anmelden.");
        } else {
          log("✓ Alle benötigten Berechtigungen sind im Token enthalten.");
        }

        // Optionale Berechtigungen: nur für einzelne Funktionen, werden erst
        // bei Bedarf angefordert. In Entra erteilt ≠ im Token vorhanden.
        const optional = [
          ["User.ReadWrite.All",              "Import: Konten aktualisieren"],
          ["AuditLog.Read.All",               "Export: Letzte Anmeldung"],
          ["User-LifeCycleInfo.Read.All",     "Export: Austrittsdatum"],
          ["User-LifeCycleInfo.ReadWrite.All","Import: Austrittsdatum schreiben"]
        ];
        log("");
        log("Optional (nur für Import/Export, werden dort bei Bedarf angefordert):");
        for (const [s, zweck] of optional) {
          log("  " + (ti.scopes.includes(s) ? "✓" : "·") + " " + s.padEnd(33) + zweck);
        }
        if (optional.some(([s]) => !ti.scopes.includes(s))) {
          log("  „·“ heißt nur: nicht im aktuellen Token. Die Zustimmung kann in Entra");
          log("  längst erteilt sein – angefordert wird sie über die Knöpfe im Reiter");
          log("  „📦 Import / Export“.");
        }
      }

      log("\n── SharePoint ─────────────────────────");
      let sid = null;
      try {
        const s = await GRAPH.call("/sites/" + C.configSite);
        sid = s.id;
        log("✓ Site lesbar: " + s.webUrl);
      } catch (e) {
        log("✗ Site nicht lesbar: " + (e.detail || e.message));
        return;
      }
      try {
        const l = await GRAPH.call(`/sites/${sid}/lists?$select=name&$top=200`);
        log("✓ Listen der Site lesbar (" + (l.value || []).length + " Stück).");
      } catch (e) {
        log("✗ Listen nicht lesbar: " + (e.detail || e.message));
      }
      let alleDa = true;
      for (const [key, name] of Object.entries(C.lists)) {
        try {
          await GRAPH.call(`/sites/${sid}/lists/${encodeURIComponent(name)}`);
        } catch (e) {
          alleDa = false;
          log((e.status === 404 ? "· " : "✗ ") + name + " – "
            + (e.status === 404 ? "fehlt noch (muss angelegt werden)" : (e.detail || e.message)));
          continue;
        }
        log("✓ " + name + " – vorhanden");
        // Spalten prüfen. Abweichende interne Namen (z. B. Typ → Typ2) werden
        // von der App automatisch aufgelöst und hier nur gemeldet.
        try {
          const erwartet = SEED.EXPECTED[key] || [];
          const map = await GRAPH.fieldMap(C.configSite, name, erwartet, true);
          const fehlt    = erwartet.filter(n => !map[n]);
          const abweichend = erwartet.filter(n => map[n] && map[n] !== n);

          if (fehlt.length) {
            alleDa = false;
            log("   ⚠ fehlende Spalten: " + fehlt.join(", "));
          }
          if (abweichend.length) {
            for (const n of abweichend) log(`   · ${n} heißt intern „${map[n]}“ – wird automatisch berücksichtigt`);
          }
          if (!fehlt.length) {
            log("   ✓ alle " + erwartet.length + " Spalten nutzbar"
              + (abweichend.length ? ` (${abweichend.length} mit abweichendem internen Namen)` : ""));
          }
        } catch (e) {
          // Ohne Spaltenliste ist Vollständigkeit nicht belegt – nicht grün melden.
          alleDa = false;
          log("   ⚠ Spalten nicht lesbar: " + (e.detail || e.message));
        }
      }

      log("");
      if (alleDa) {
        log("Alles in Ordnung – Listen und Spalten sind vollständig nutzbar.");
      } else {
        log("Fehlendes anlegen: LISTEN-ANLEGEN.md im Repository nennt alle Spalten");
        log("mit exaktem Namen und Typ. Danach diese Diagnose erneut ausführen.");
        log("Alternativ zeigt „🧪 Schreibtest auf der Site“, ob die App Listen");
        log("selbst anlegen darf.");
      }
    } catch (e) {
      log("✗ Unerwarteter Fehler: " + (e.detail || e.message));
    } finally {
      btn.disabled = false;
    }
  }

  /** Legt eine Hilfsliste an und entfernt sie sofort wieder. */
  async function writeTest(btn, log) {
    const probe = "RUDJ_Schreibtest";
    btn.disabled = true;
    try {
      log("\n── Schreibtest ────────────────────────");
      const sid = await GRAPH.siteId(C.configSite);

      let existing = null;
      try { existing = await GRAPH.call(`/sites/${sid}/lists/${probe}`); } catch {}
      if (existing) {
        log("· Hilfsliste aus einem früheren Test gefunden – wird aufgeräumt.");
        try { await GRAPH.call(`/sites/${sid}/lists/${existing.id}`, { method: "DELETE" }); }
        catch (e) { log("  (Aufräumen fehlgeschlagen: " + (e.detail || e.message) + ")"); }
      }

      let created;
      try {
        created = await GRAPH.call(`/sites/${sid}/lists`, {
          method: "POST",
          body: JSON.stringify({ displayName: probe, list: { template: "genericList" } })
        });
        log("✓ Liste anlegen hat funktioniert.");
      } catch (e) {
        log("✗ Liste anlegen fehlgeschlagen: " + (e.detail || e.message));
        if (e.status === 403) {
          log("\nDamit ist die Ursache eingegrenzt:");
          log("Das Token ist in Ordnung, aber " + DATA.ctx.email);
          log("darf auf " + C.configSite);
          log("keine Listen anlegen (SharePoint-Websiteberechtigung).");
          log("\nDas betrifft nur diesen einen Einrichtungsschritt. Sobald die Listen");
          log("existieren, genügen die vorhandenen Rechte für den Betrieb der App.");
          log("\nDrei Wege – einer reicht:");
          log("a) Konto auf der Site zum Websitebesitzer machen (Websiteberechtigungen)");
          log("   und danach hier „1 · Listen anlegen“ erneut ausführen.");
          log("b) setup-rundumdenjob.ps1 mit einem SharePoint- oder Global-Admin-Konto:");
          log("     Connect-MgGraph -Scopes \"Sites.Manage.All\",\"Sites.ReadWrite.All\"");
          log("     ./setup-rundumdenjob.ps1 -SkipAppReg");
          log("   Achtung: delegiertes PowerShell läuft als das angemeldete Konto und");
          log("   scheitert mit demselben 403, wenn dieses Konto keinen Vollzugriff hat.");
          log("c) App-only – unabhängig von Benutzer- und Websiteberechtigungen:");
          log("     ./setup-rundumdenjob.ps1 -AppOnly -SkipAppReg \\");
          log("       -AppClientId <App-Reg mit Sites.FullControl.All (Application)> \\");
          log("       -AppSecret (Read-Host -AsSecureString \"Client Secret\")");
        }
        return;
      }

      try {
        await GRAPH.call(`/sites/${sid}/lists/${created.id}`, { method: "DELETE" });
        log("✓ Hilfsliste wieder entfernt – Konfiguration unverändert.");
      } catch (e) {
        log("⚠ Hilfsliste konnte nicht entfernt werden: " + (e.detail || e.message));
        log("  Bitte die Liste „" + probe + "“ in SharePoint manuell löschen.");
      }
      log("\nErgebnis: Die Rechte reichen aus. „1 · Listen anlegen“ sollte jetzt durchlaufen.");
    } catch (e) {
      log("✗ Unerwarteter Fehler: " + (e.detail || e.message));
    } finally {
      btn.disabled = false;
    }
  }

  return viewDiagnose;
})();
