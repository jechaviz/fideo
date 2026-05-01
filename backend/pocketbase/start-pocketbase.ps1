[CmdletBinding()]
param(
    [string]$Version = "0.37.3",
    [string]$Http = "127.0.0.1:8090",
    [switch]$InstallIfMissing,
    [string[]]$PocketBaseArgs = @()
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $root)
$osPlatform = [System.Runtime.InteropServices.OSPlatform]
$runtimeInfo = [System.Runtime.InteropServices.RuntimeInformation]
$binaryName = if ($runtimeInfo::IsOSPlatform($osPlatform::Windows)) { "pocketbase.exe" } else { "pocketbase" }
$exe = Join-Path $root $binaryName

function Import-EnvMap {
    param(
        [string[]]$Candidates
    )

    $map = @{}
    foreach ($candidate in $Candidates) {
        if (-not (Test-Path -LiteralPath $candidate)) {
            continue
        }

        Get-Content -LiteralPath $candidate | ForEach-Object {
            if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                if (
                    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'"))
                ) {
                    $value = $value.Substring(1, $value.Length - 2)
                }

                if ($name) {
                    $map[$name] = $value
                }
            }
        }
    }

    return $map
}

function Set-EnvIfMissing {
    param(
        [string]$Name,
        [string[]]$FallbackKeys,
        [hashtable]$Map
    )

    $current = [Environment]::GetEnvironmentVariable($Name, "Process")
    if (-not [string]::IsNullOrWhiteSpace($current)) {
        return
    }

    foreach ($fallbackKey in $FallbackKeys) {
        if ($Map.ContainsKey($fallbackKey) -and -not [string]::IsNullOrWhiteSpace($Map[$fallbackKey])) {
            [Environment]::SetEnvironmentVariable($Name, $Map[$fallbackKey], "Process")
            return
        }
    }
}

$envMap = Import-EnvMap -Candidates @(
    (Join-Path $repoRoot 'frontend\.env.local'),
    (Join-Path $repoRoot 'frontend\.env')
)

Set-EnvIfMissing -Name 'FIDEO_GEMINI_API_KEY' -FallbackKeys @('FIDEO_GEMINI_API_KEY', 'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY') -Map $envMap
Set-EnvIfMissing -Name 'GEMINI_API_KEY' -FallbackKeys @('GEMINI_API_KEY', 'FIDEO_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY') -Map $envMap
Set-EnvIfMissing -Name 'FIDEO_GEMINI_MODEL' -FallbackKeys @('FIDEO_GEMINI_MODEL', 'GEMINI_MODEL') -Map $envMap
Set-EnvIfMissing -Name 'GEMINI_MODEL' -FallbackKeys @('GEMINI_MODEL', 'FIDEO_GEMINI_MODEL') -Map $envMap
Set-EnvIfMissing -Name 'ONESIGNAL_ENABLED' -FallbackKeys @('ONESIGNAL_ENABLED') -Map $envMap
Set-EnvIfMissing -Name 'ONESIGNAL_APP_ID' -FallbackKeys @('ONESIGNAL_APP_ID', 'VITE_ONESIGNAL_APP_ID', 'FIDEO_ONESIGNAL_APP_ID') -Map $envMap
Set-EnvIfMissing -Name 'ONESIGNAL_REST_API_KEY' -FallbackKeys @('ONESIGNAL_REST_API_KEY', 'FIDEO_ONESIGNAL_REST_API_KEY', 'VITE_ONESIGNAL_REST_API_KEY') -Map $envMap
Set-EnvIfMissing -Name 'FIDEO_APP_URL' -FallbackKeys @('FIDEO_APP_URL', 'VITE_FIDEO_APP_URL', 'VITE_APP_URL') -Map $envMap

if (-not (Test-Path -LiteralPath $exe)) {
    if (-not $InstallIfMissing) {
        throw "No encontre $binaryName en $root. Ejecuta .\install-pocketbase.ps1 o usa -InstallIfMissing."
    }

    $installScript = Join-Path $root "install-pocketbase.ps1"
    if (-not (Test-Path -LiteralPath $installScript)) {
        throw "No encontre el instalador local en $installScript."
    }

    & $installScript -Version $Version -Destination $root
}

$args = @("serve", "--http", $Http)
if ($PocketBaseArgs.Count -gt 0) {
    $args += $PocketBaseArgs
}

Write-Host "PocketBase iniciando en http://$Http"
Write-Host "Dashboard: http://$Http/_/"

Push-Location $root
try {
    & $exe @args
}
finally {
    Pop-Location
}
