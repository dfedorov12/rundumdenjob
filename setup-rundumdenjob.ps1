# ══════════════════════════════════════════════════════════════════════
#  Einrichtung „Rund um den Job"
#  1. Redirect-URI der App-Registrierung ergaenzen
#  2. SharePoint-Listen RUDJ_* auf /sites/IT anlegen bzw. vervollstaendigen
#  3. Optional: Domaenen des Tenants als Gesellschaften vorbelegen
#
#  Voraussetzung:
#    Install-Module Microsoft.Graph -Scope CurrentUser
#    Connect-MgGraph -Scopes "Application.ReadWrite.All","Sites.Manage.All",
#                            "Sites.ReadWrite.All","User.Read.All"
# ══════════════════════════════════════════════════════════════════════

param(
    [string] $ClientId    = "c7710322-13ab-44c5-8ba1-314ca5cdb38d",  # = js/config.js
    [string] $RedirectUri = "https://dfedorov12.github.io/rundumdenjob/",
    [string] $SitePath    = "dihag.sharepoint.com:/sites/IT",
    [switch] $SkipAppReg,
    [switch] $SeedDomains
)

$ErrorActionPreference = "Stop"
$g = "https://graph.microsoft.com/v1.0"

Write-Host "=== Rund um den Job – Einrichtung ===" -ForegroundColor Cyan

# ── 1 · Redirect-URI ──────────────────────────────────────────────────
if (-not $SkipAppReg) {
    Write-Host "`n[1] App-Registrierung $ClientId" -ForegroundColor Yellow
    $apps = (Invoke-MgGraphRequest -Method GET `
        -Uri "$g/applications?`$filter=appId eq '$ClientId'").value
    if (-not $apps) {
        Write-Warning "App-Registrierung nicht gefunden – Schritt 1 uebersprungen."
    } else {
        $app  = $apps[0]
        $uris = @($app.spa.redirectUris)
        if ($uris -contains $RedirectUri) {
            Write-Host "  Redirect-URI bereits eingetragen." -ForegroundColor Green
        } else {
            $uris += $RedirectUri
            Invoke-MgGraphRequest -Method PATCH -Uri "$g/applications/$($app.id)" `
                -Body (@{ spa = @{ redirectUris = $uris } } | ConvertTo-Json -Depth 4) `
                -ContentType "application/json" | Out-Null
            Write-Host "  Redirect-URI ergaenzt: $RedirectUri" -ForegroundColor Green
        }
        $need = @("User.Read","User.ReadBasic.All","User.Read.All","Sites.ReadWrite.All","Mail.Send")
        Write-Host "  Benoetigte delegierte Berechtigungen: $($need -join ', ')"
        Write-Host "  (Admin-Zustimmung im Portal pruefen, falls Nutzer Fehler AADSTS65001 sehen.)"
    }
}

# ── 2 · Listen ────────────────────────────────────────────────────────
Write-Host "`n[2] SharePoint-Listen auf $SitePath" -ForegroundColor Yellow
$site = Invoke-MgGraphRequest -Method GET -Uri "$g/sites/$SitePath"
$sid  = $site.id
Write-Host "  Site: $($site.webUrl)"

function Ensure-List($name) {
    try {
        $l = Invoke-MgGraphRequest -Method GET -Uri "$g/sites/$sid/lists/$name"
        Write-Host "  Liste '$name' vorhanden." -ForegroundColor Green
        return $l.id
    } catch {
        $body = @{ displayName = $name; list = @{ template = "genericList" } }
        $l = Invoke-MgGraphRequest -Method POST -Uri "$g/sites/$sid/lists" `
            -Body ($body | ConvertTo-Json -Depth 4) -ContentType "application/json"
        Write-Host "  Liste '$name' angelegt." -ForegroundColor Green
        return $l.id
    }
}

function Ensure-Columns($listName, $defs) {
    $cols = (Invoke-MgGraphRequest -Method GET `
        -Uri "$g/sites/$sid/lists/$listName/columns?`$top=200").value
    $existing = @($cols | ForEach-Object { $_.name })
    foreach ($d in $defs) {
        if ($existing -contains $d.name) { continue }
        $body = @{ name = $d.name; displayName = $d.name }
        switch ($d.kind) {
            "note"     { $body["text"] = @{ allowMultipleLines = $true; textType = "plain" } }
            "dateOnly" { $body["dateTime"] = @{ format = "dateOnly" } }
            default    { $body[$d.kind] = @{} }
        }
        Invoke-MgGraphRequest -Method POST -Uri "$g/sites/$sid/lists/$listName/columns" `
            -Body ($body | ConvertTo-Json -Depth 4) -ContentType "application/json" | Out-Null
        Write-Host "    [$listName] Spalte '$($d.name)' angelegt"
    }
}

Ensure-List "RUDJ_Gesellschaften" | Out-Null
Ensure-Columns "RUDJ_Gesellschaften" @(
    @{ name = "Gesellschaft"; kind = "text"    },   # Title = E-Mail-Domaene
    @{ name = "Kuerzel";      kind = "text"    },
    @{ name = "Farbe";        kind = "text"    },
    @{ name = "Standard";     kind = "boolean" },
    @{ name = "Aktiv";        kind = "boolean" },
    @{ name = "Sortierung";   kind = "number"  }
)

Ensure-List "RUDJ_Reiter" | Out-Null
Ensure-Columns "RUDJ_Reiter" @(
    @{ name = "ReiterKey";    kind = "text"    },   # Title = Anzeigename
    @{ name = "Icon";         kind = "text"    },
    @{ name = "Beschreibung"; kind = "note"    },
    @{ name = "Domains";      kind = "text"    },
    @{ name = "MinRolle";     kind = "text"    },
    @{ name = "Aktiv";        kind = "boolean" },
    @{ name = "Sortierung";   kind = "number"  }
)

Ensure-List "RUDJ_Kacheln" | Out-Null
Ensure-Columns "RUDJ_Kacheln" @(
    @{ name = "ReiterKey";    kind = "text"     },  # Title = Kachelueberschrift
    @{ name = "Typ";          kind = "text"     },
    @{ name = "Icon";         kind = "text"     },
    @{ name = "Beschreibung"; kind = "note"     },
    @{ name = "Url";          kind = "text"     },
    @{ name = "Inhalt";       kind = "note"     },
    @{ name = "Badge";        kind = "text"     },
    @{ name = "Domains";      kind = "text"     },
    @{ name = "MinRolle";     kind = "text"     },
    @{ name = "Aktiv";        kind = "boolean"  },
    @{ name = "Sortierung";   kind = "number"   },
    @{ name = "GueltigVon";   kind = "dateOnly" },
    @{ name = "GueltigBis";   kind = "dateOnly" }
)

# ── 3 · Gesellschaften aus den Tenant-Domaenen ────────────────────────
if ($SeedDomains) {
    Write-Host "`n[3] Domaenen des Tenants" -ForegroundColor Yellow
    $users = (Invoke-MgGraphRequest -Method GET `
        -Uri "$g/users?`$select=mail,userPrincipalName&`$top=999").value
    $domains = $users |
        ForEach-Object { ($_.mail ?? $_.userPrincipalName) } |
        Where-Object { $_ -match "@" } |
        ForEach-Object { ($_ -split "@")[-1].ToLower() } |
        Where-Object { $_ -notlike "*.onmicrosoft.com" } |
        Group-Object | Sort-Object Count -Descending

    $have = @((Invoke-MgGraphRequest -Method GET `
        -Uri "$g/sites/$sid/lists/RUDJ_Gesellschaften/items?`$expand=fields&`$top=999").value |
        ForEach-Object { $_.fields.Title })

    $i = $have.Count
    foreach ($d in $domains) {
        if ($have -contains $d.Name) { Write-Host "  @$($d.Name) – bereits zugeordnet"; continue }
        $i++
        $nm = (Get-Culture).TextInfo.ToTitleCase(($d.Name -split "\.")[0])
        $fields = @{
            Title        = $d.Name
            Gesellschaft = $nm
            Kuerzel      = $nm.Substring(0, [Math]::Min(3, $nm.Length)).ToUpper()
            Farbe        = "#17509E"
            Standard     = ($d.Name -eq "dihag.com")
            Aktiv        = $true
            Sortierung   = $i * 10
        }
        Invoke-MgGraphRequest -Method POST -Uri "$g/sites/$sid/lists/RUDJ_Gesellschaften/items" `
            -Body (@{ fields = $fields } | ConvertTo-Json -Depth 4) -ContentType "application/json" | Out-Null
        Write-Host "  @$($d.Name) -> '$nm' angelegt ($($d.Count) Konten)" -ForegroundColor Green
    }
}

Write-Host "`nFertig. Reiter und Kacheln legen Sie danach in der App unter" -ForegroundColor Cyan
Write-Host "Einstellungen -> Einrichtung -> '3 · Startinhalte anlegen' an." -ForegroundColor Cyan
