[CmdletBinding()]
param(
    [string]$Version = "0.37.3",
    [string]$Destination = $PSScriptRoot,
    [switch]$Force,
    [switch]$KeepArchive
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-PocketBasePlatform {
    $osPlatform = [System.Runtime.InteropServices.OSPlatform]
    $runtimeInfo = [System.Runtime.InteropServices.RuntimeInformation]

    if ($runtimeInfo::IsOSPlatform($osPlatform::Windows)) {
        $os = "windows"
        $binaryName = "pocketbase.exe"
    }
    elseif ($runtimeInfo::IsOSPlatform($osPlatform::Linux)) {
        $os = "linux"
        $binaryName = "pocketbase"
    }
    elseif ($runtimeInfo::IsOSPlatform($osPlatform::OSX)) {
        $os = "darwin"
        $binaryName = "pocketbase"
    }
    else {
        throw "Sistema operativo no soportado por este helper."
    }

    $architecture = $runtimeInfo::OSArchitecture.ToString().ToLowerInvariant()
    switch ($architecture) {
        "x64" { $arch = "amd64" }
        "arm64" { $arch = "arm64" }
        default { throw "Arquitectura no soportada por este helper: $architecture" }
    }

    [pscustomobject]@{
        Os         = $os
        Arch       = $arch
        BinaryName = $binaryName
    }
}

if (-not (Test-Path -LiteralPath $Destination)) {
    New-Item -ItemType Directory -Path $Destination | Out-Null
}

$destinationRoot = (Resolve-Path -LiteralPath $Destination).Path
$platform = Get-PocketBasePlatform
$assetName = "pocketbase_{0}_{1}_{2}.zip" -f $Version, $platform.Os, $platform.Arch
$downloadUrl = "https://github.com/pocketbase/pocketbase/releases/download/v{0}/{1}" -f $Version, $assetName
$targetBinary = Join-Path $destinationRoot $platform.BinaryName

if ((Test-Path -LiteralPath $targetBinary) -and -not $Force) {
    Write-Host "PocketBase ya existe en $targetBinary. Usa -Force para reinstalar."
    return
}

$tempRoot = Join-Path $destinationRoot ".tmp"
$extractRoot = Join-Path $tempRoot ("pocketbase-{0}-{1}-{2}" -f $Version, $platform.Os, $platform.Arch)
$archivePath = Join-Path $extractRoot $assetName

if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

Write-Host "Descargando $downloadUrl"
Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath

Write-Host "Extrayendo $assetName"
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force

$extractedBinary = Join-Path $extractRoot $platform.BinaryName
if (-not (Test-Path -LiteralPath $extractedBinary)) {
    $foundBinary = Get-ChildItem -Path $extractRoot -Recurse -File -Filter $platform.BinaryName | Select-Object -First 1
    if (-not $foundBinary) {
        throw "No encontre el ejecutable de PocketBase dentro del zip descargado."
    }

    $extractedBinary = $foundBinary.FullName
}

Copy-Item -LiteralPath $extractedBinary -Destination $targetBinary -Force

if ($platform.BinaryName -eq "pocketbase") {
    $chmod = Get-Command chmod -ErrorAction SilentlyContinue
    if ($chmod) {
        & $chmod.Path +x $targetBinary
    }
}

if (-not $KeepArchive) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

Write-Host "PocketBase $Version listo en $targetBinary"
