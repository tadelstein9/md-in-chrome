# Put Markdown in Chrome in a stable folder and open the extensions page.
# Chrome still needs one click: Developer mode → Load unpacked → that folder.
#
# In PowerShell, from this folder:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# Do not save documents inside the folder this script installs to.
[CmdletBinding()]
param(
    [switch]$Download,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$Dest = Join-Path $env:LOCALAPPDATA "md-in-chrome"

$Ship = @(
    "manifest.json", "background.js", "blocks.js", "edits.js", "md.js",
    "saving.js", "pdf.js", "format.js", "editor.html", "editor.js",
    "editor.css", "LICENSE", "README.md"
)

function Copy-Tree {
    param([string]$Src)
    New-Item -ItemType Directory -Force -Path (Join-Path $Dest "icons") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $Dest "lib") | Out-Null
    foreach ($f in $Ship) {
        $from = Join-Path $Src $f
        if (-not (Test-Path -LiteralPath $from)) {
            throw "missing $f in $Src"
        }
        Copy-Item -LiteralPath $from -Destination (Join-Path $Dest $f) -Force
    }
    Copy-Item -LiteralPath (Join-Path $Src "icons\icon128.png") -Destination (Join-Path $Dest "icons\icon128.png") -Force
    Copy-Item -LiteralPath (Join-Path $Src "lib\*") -Destination (Join-Path $Dest "lib") -Force
}

function Install-FromRelease {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("md-in-chrome-" + [guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/tadelstein9/md-in-chrome/releases/latest" -Headers @{ "User-Agent" = "md-in-chrome-install" }
        $asset = $rel.assets | Where-Object { $_.name -like "md-in-chrome-*.zip" } | Select-Object -First 1
        if (-not $asset) { throw "no release zip on GitHub" }
        $zip = Join-Path $tmp "md-in-chrome.zip"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
        $unz = Join-Path $tmp "unz"
        Expand-Archive -LiteralPath $zip -DestinationPath $unz
        $manifest = Get-ChildItem -Path $unz -Filter manifest.json -Recurse | Select-Object -First 1
        if (-not $manifest) { throw "unzipped archive has no manifest.json" }
        Copy-Tree -Src $manifest.DirectoryName
    }
    finally {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($Download) {
    Install-FromRelease
}
elseif (Test-Path -LiteralPath (Join-Path $Here "manifest.json")) {
    Copy-Tree -Src $Here
}
else {
    Install-FromRelease
}

$manifest = Get-Content -LiteralPath (Join-Path $Dest "manifest.json") -Raw | ConvertFrom-Json
Write-Host "Installed Markdown in Chrome $($manifest.version)"
Write-Host "Folder:"
Write-Host "  $Dest"
Write-Host ""
Write-Host "In Chrome or Edge:"
Write-Host "  1. Open chrome://extensions  (or edge://extensions)"
Write-Host "  2. Turn Developer mode on (top right)"
Write-Host "  3. Load unpacked — choose the folder above"
Write-Host "  4. Do not save your documents inside that folder"

if ($NoOpen) { exit 0 }

$chrome = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "chrome://extensions"
}
else {
    Start-Process "chrome://extensions"
}
