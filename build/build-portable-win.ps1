$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "dist"
$releaseBaseDir = Join-Path $root "release\windows"
$releaseDir = Join-Path $releaseBaseDir "portable"
$releaseVendorDir = Join-Path $releaseDir "vendor"
$releasePublicDir = Join-Path $releaseDir "public"
$pkgCmd = Join-Path $root "node_modules\.bin\pkg.cmd"
$nodeCommand = Get-Command node.exe -ErrorAction Stop
$nodeSource = $nodeCommand.Source

Set-Location $root

& (Join-Path $PSScriptRoot "prepare-vendor-win.ps1")

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $releaseBaseDir | Out-Null
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
New-Item -ItemType Directory -Force -Path $releaseVendorDir | Out-Null
New-Item -ItemType Directory -Force -Path $releasePublicDir | Out-Null

if (!(Test-Path $pkgCmd)) {
  Write-Host "pkg is not installed; creating a Node-powered portable package."
  Write-Host "If npm is available later, run npm install and this script will also build a single app exe."
} else {
  Write-Host "Building Windows executable..."
  & $pkgCmd . --targets node18-win-x64 --output (Join-Path $distDir "local-video-downloader.exe")
  Copy-Item -Path (Join-Path $distDir "local-video-downloader.exe") -Destination (Join-Path $releaseDir "local-video-downloader.exe") -Force
}

Copy-Item -Path $nodeSource -Destination (Join-Path $releaseDir "node.exe") -Force
Copy-Item -Path (Join-Path $root "server.js") -Destination (Join-Path $releaseDir "server.js") -Force
Copy-Item -Path (Join-Path $root "public\*") -Destination $releasePublicDir -Recurse -Force
Copy-Item -Path (Join-Path $root "vendor\yt-dlp.exe") -Destination (Join-Path $releaseVendorDir "yt-dlp.exe") -Force
Copy-Item -Path (Join-Path $root "vendor\ffmpeg.exe") -Destination (Join-Path $releaseVendorDir "ffmpeg.exe") -Force

Copy-Item -Path (Join-Path $root "README.md") -Destination (Join-Path $releaseDir "README.md") -Force

$launcherPath = Join-Path $releaseDir "start-windows.bat"
Set-Content -Path $launcherPath -Encoding ASCII -Value @(
  "@echo off",
  "cd /d ""%~dp0""",
  "start """" ""%~dp0node.exe"" ""%~dp0server.js"""
)

$zipPath = Join-Path $releaseBaseDir "local-video-downloader-windows-portable.zip"
Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "Windows portable package is ready:"
Write-Host "  $releaseDir"
Write-Host "Zip package:"
Write-Host "  $zipPath"
Write-Host ""
Write-Host "Send the zip or the whole windows-portable folder."
