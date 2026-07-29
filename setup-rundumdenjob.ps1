# ══════════════════════════════════════════════════════════════════════
#  Einrichtung „Rund um den Job"
#    1. Redirect-URI der App-Registrierung ergaenzen
#    2. SharePoint-Listen RUDJ_* anlegen bzw. vervollstaendigen
#    3. Optional: Domaenen des Tenants als Gesellschaften vorbelegen
#    4. Haupt-Administrator in AppPermissions eintragen
#
#  ZWEI BETRIEBSARTEN
#
#  A) Delegiert (Standard) – laeuft als das angemeldete Benutzerkonto:
#       Install-Module Microsoft.Graph -Scope CurrentUser
#       Connect-MgGraph -Scopes "Application.ReadWrite.All","Sites.Manage.All",`
#                               "Sites.ReadWrite.All","User.Read.All"
#       ./setup-rundumdenjob.ps1
#     ACHTUNG: Das Anlegen von Listen scheitert mit 403, wenn dieses Konto auf
#     der Site keinen Vollzugriff hat – SharePoint-Berechtigungen gelten hier
#     genauso wie im Browser. Nur ein Websitebesitzer bzw. ein SharePoint-/
#     Global-Administrator kommt durch.
#
#  B) App-only (-AppOnly) – laeuft mit den Rechten einer App-Registrierung und
#     ist damit unabhaengig von Benutzer- und Websiteberechtigungen:
#       ./setup-rundumdenjob.ps1 -AppOnly -SkipAppReg `
#           -AppClientId "089bf9ad-2d9a-4cbc-b85d-88b4484af0bb" `
#           -AppSecret (Read-Host -AsSecureString "Client Secret")
#     Voraussetzung: die App-Registrierung braucht die APPLICATION-Berechtigung
#     Sites.FullControl.All (oder Sites.Manage.All) mit Administratorzustimmung.
#     Schritt 1 (Redirect-URI) braucht zusaetzlich Application.ReadWrite.All –
#     sonst mit -SkipAppReg ueberspringen und im Portal von Hand eintragen.
# ══════════════════════════════════════════════════════════════════════

param(
    [string] $ClientId    = "c7710322-13ab-44c5-8ba1-314ca5cdb38d",  # = js/config.js
    [string] $RedirectUri = "https://rundumdenjob.dihag.de/",
    [string] $SitePath    = "dihag.sharepoint.com:/sites/IT",
    [string] $PermPath    = "dihag.sharepoint.com:/sites/IT",   # = js/config.js permSite
    [string] $HauptAdmin  = "administrator@dihag.com",              # = js/config.js hauptAdmins
    [switch] $SkipAppReg,
    [switch] $SeedDomains,

    # Betriebsart B
    [switch] $AppOnly,
    [string] $AppTenantId = "fdb70646-023a-403b-a4b9-1f474a935123",
    [string] $AppClientId,
    [System.Security.SecureString] $AppSecret
)

$ErrorActionPreference = "Stop"
$g = "https://graph.microsoft.com/v1.0"

# ── Graph-Aufruf, je nach Betriebsart ─────────────────────────────────
$script:AppToken = $null

function Get-AppToken {
    if ($script:AppToken -and $script:AppToken.Expires -gt (Get-Date).AddMinutes(2)) {
        return $script:AppToken.Value
    }
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AppSecret))
    $resp = Invoke-RestMethod -Method POST `
        -Uri "https://login.microsoftonline.com/$AppTenantId/oauth2/v2.0/token" `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{
            client_id     = $AppClientId
            client_secret = $plain
            scope         = "https://graph.microsoft.com/.default"
            grant_type    = "client_credentials"
        }
    $script:AppToken = @{
        Value   = $resp.access_token
        Expires = (Get-Date).AddSeconds([int]$resp.expires_in)
    }
    return $resp.access_token
}

function Gx {
    param([string]$Method = "GET", [string]$Uri, $Body)
    if ($AppOnly) {
        $headers = @{ Authorization = "Bearer $(Get-AppToken)" }
        if ($null -ne $Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers `
                -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 6)
        }
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
    }
    if ($null -ne $Body) {
        return Invoke-MgGraphRequest -Method $Method -Uri $Uri `
            -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 6)
    }
    return Invoke-MgGraphRequest -Method $Method -Uri $Uri
}

Write-Host "=== Rund um den Job – Einrichtung ===" -ForegroundColor Cyan
if ($AppOnly) {
    if (-not $AppClientId -or -not $AppSecret) {
        throw "-AppOnly braucht -AppClientId und -AppSecret."
    }
    Write-Host "Betriebsart: App-only ueber $AppClientId" -ForegroundColor Cyan
} else {
    Write-Host "Betriebsart: delegiert (angemeldetes Benutzerkonto)" -ForegroundColor Cyan
}

# ── 1 · Redirect-URI ──────────────────────────────────────────────────
if (-not $SkipAppReg) {
    Write-Host "`n[1] App-Registrierung $ClientId" -ForegroundColor Yellow
    try {
        $apps = (Gx -Uri "$g/applications?`$filter=appId eq '$ClientId'").value
        if (-not $apps) {
            Write-Warning "App-Registrierung nicht gefunden – Schritt 1 uebersprungen."
        } else {
            $app  = $apps[0]
            $uris = @($app.spa.redirectUris)
            if ($uris -contains $RedirectUri) {
                Write-Host "  Redirect-URI bereits eingetragen." -ForegroundColor Green
            } else {
                $uris += $RedirectUri
                Gx -Method PATCH -Uri "$g/applications/$($app.id)" `
                   -Body @{ spa = @{ redirectUris = $uris } } | Out-Null
                Write-Host "  Redirect-URI ergaenzt: $RedirectUri" -ForegroundColor Green
            }
            $need = @("User.Read","User.ReadBasic.All","User.Read.All","Sites.ReadWrite.All","Mail.Send")
            Write-Host "  Benoetigte delegierte Berechtigungen: $($need -join ', ')"
            Write-Host "  (Admin-Zustimmung im Portal pruefen, falls Nutzer AADSTS65001 sehen.)"
        }
    } catch {
        Write-Warning "Schritt 1 fehlgeschlagen: $($_.Exception.Message)"
        Write-Warning "Redirect-URI ggf. im Portal von Hand eintragen und -SkipAppReg nutzen."
    }
}

# ── 2 · Listen ────────────────────────────────────────────────────────
Write-Host "`n[2] SharePoint-Listen auf $SitePath" -ForegroundColor Yellow
$site = Gx -Uri "$g/sites/$SitePath"
$sid  = $site.id
Write-Host "  Site: $($site.webUrl)"

function Ensure-List($name) {
    try {
        $l = Gx -Uri "$g/sites/$sid/lists/$name"
        Write-Host "  Liste '$name' vorhanden." -ForegroundColor Green
        return $l.id
    } catch {
        try {
            $l = Gx -Method POST -Uri "$g/sites/$sid/lists" `
                    -Body @{ displayName = $name; list = @{ template = "genericList" } }
            Write-Host "  Liste '$name' angelegt." -ForegroundColor Green
            return $l.id
        } catch {
            $msg = $_.Exception.Message
            Write-Host "  Liste '$name' KONNTE NICHT angelegt werden: $msg" -ForegroundColor Red
            if ($msg -match "403|denied|Forbidden") {
                Write-Host "  -> Das Konto bzw. die App darf auf dieser Site keine Listen anlegen." -ForegroundColor Red
                if (-not $AppOnly) {
                    Write-Host "  -> Entweder als Websitebesitzer/SharePoint-Admin anmelden," -ForegroundColor Red
                    Write-Host "     oder das Skript mit -AppOnly und einer App-Registrierung" -ForegroundColor Red
                    Write-Host "     mit Sites.FullControl.All (Application) ausfuehren." -ForegroundColor Red
                }
            }
            throw
        }
    }
}

function Ensure-Columns($listName, $defs) {
    $cols = (Gx -Uri "$g/sites/$sid/lists/$listName/columns?`$top=200").value
    $existing = @($cols | ForEach-Object { $_.name })
    foreach ($d in $defs) {
        if ($existing -contains $d.name) { continue }
        $body = @{ name = $d.name; displayName = $d.name }
        switch ($d.kind) {
            "note"     { $body["text"] = @{ allowMultipleLines = $true; textType = "plain" } }
            "dateOnly" { $body["dateTime"] = @{ format = "dateOnly" } }
            default    { $body[$d.kind] = @{} }
        }
        Gx -Method POST -Uri "$g/sites/$sid/lists/$listName/columns" -Body $body | Out-Null
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
    @{ name = "Url";          kind = "note"     },  # SP-URLs mit Parametern > 255 Zeichen
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
    $users = (Gx -Uri "$g/users?`$select=mail,userPrincipalName&`$top=999").value
    $domains = $users |
        ForEach-Object { if ($_.mail) { $_.mail } else { $_.userPrincipalName } } |
        Where-Object { $_ -match "@" } |
        ForEach-Object { ($_ -split "@")[-1].ToLower() } |
        Where-Object { $_ -notlike "*.onmicrosoft.com" } |
        Group-Object | Sort-Object Count -Descending

    $have = @((Gx -Uri "$g/sites/$sid/lists/RUDJ_Gesellschaften/items?`$expand=fields&`$top=999").value |
        ForEach-Object { $_.fields.Title })

    $i = $have.Count
    foreach ($d in $domains) {
        if ($have -contains $d.Name) { Write-Host "  @$($d.Name) – bereits zugeordnet"; continue }
        $i++
        $nm = (Get-Culture).TextInfo.ToTitleCase(($d.Name -split "\.")[0])
        Gx -Method POST -Uri "$g/sites/$sid/lists/RUDJ_Gesellschaften/items" -Body @{
            fields = @{
                Title        = $d.Name
                Gesellschaft = $nm
                Kuerzel      = $nm.Substring(0, [Math]::Min(3, $nm.Length)).ToUpper()
                Farbe        = "#17509E"
                Standard     = ($d.Name -eq "dihag.com")
                Aktiv        = $true
                Sortierung   = $i * 10
            }
        } | Out-Null
        Write-Host "  @$($d.Name) -> '$nm' angelegt ($($d.Count) Konten)" -ForegroundColor Green
    }
}

# ── 4 · Haupt-Administrator in AppPermissions eintragen ───────────────
# Der Haupt-Admin ist bereits ueber js/config.js gesetzt; der Listeneintrag
# macht ihn zusaetzlich im Admin-Portal und in der Rechteliste sichtbar.
if ($HauptAdmin) {
    Write-Host "`n[4] Haupt-Administrator $HauptAdmin" -ForegroundColor Yellow
    try {
        $psite = Gx -Uri "$g/sites/$PermPath"
        $items = (Gx -Uri "$g/sites/$($psite.id)/lists/AppPermissions/items?`$expand=fields&`$top=999").value
        $hit = $items | Where-Object {
            $_.fields.UserEmail -eq $HauptAdmin -and
            ($_.fields.App -eq "rundumdenjob" -or $_.fields.App -eq "*")
        }
        if ($hit) {
            Write-Host "  Eintrag vorhanden (App '$($hit[0].fields.App)', Rolle '$($hit[0].fields.Role)')." -ForegroundColor Green
        } else {
            Gx -Method POST -Uri "$g/sites/$($psite.id)/lists/AppPermissions/items" -Body @{
                fields = @{ Title = $HauptAdmin; UserEmail = $HauptAdmin; App = "rundumdenjob"; Role = "admin" }
            } | Out-Null
            Write-Host "  Eintrag 'rundumdenjob / admin' angelegt." -ForegroundColor Green
        }
    } catch {
        Write-Warning "  AppPermissions nicht erreichbar: $($_.Exception.Message)"
        Write-Warning "  Nicht kritisch – der Haupt-Admin greift ohnehin ueber js/config.js."
    }
}

Write-Host "`nFertig. Reiter und Kacheln legen Sie danach in der App unter" -ForegroundColor Cyan
Write-Host "Einstellungen -> Einrichtung -> '3 · Startinhalte anlegen' an." -ForegroundColor Cyan
Write-Host "Anmelden dafuer als $HauptAdmin." -ForegroundColor Cyan
