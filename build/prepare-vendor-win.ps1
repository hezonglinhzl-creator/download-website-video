$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root "vendor"
$ffmpegExtractDir = Join-Path $vendorDir "ffmpeg-extract"
$ytDlpPath = Join-Path $vendorDir "yt-dlp.exe"
$ffmpegPath = Join-Path $vendorDir "ffmpeg.exe"
$ffprobePath = Join-Path $vendorDir "ffprobe.exe"
$ffmpegZipPath = Join-Path $vendorDir "ffmpeg-release-essentials.zip"

New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null

if (!(Test-Path $ytDlpPath)) {
  Write-Host "Downloading yt-dlp.exe..."
  Invoke-WebRequest `
    -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
    -OutFile $ytDlpPath
}

if (!(Test-Path $ffmpegPath)) {
  if (!(Test-Path $ffmpegZipPath)) {
    Write-Host "Downloading ffmpeg essentials build..."
    Invoke-WebRequest `
      -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" `
      -OutFile $ffmpegZipPath
  }

  New-Item -ItemType Directory -Force -Path $ffmpegExtractDir | Out-Null
  Write-Host "Extracting ffmpeg.exe..."
  Expand-Archive -Path $ffmpegZipPath -DestinationPath $ffmpegExtractDir -Force

  $ffmpegSource = Get-Item (Join-Path $ffmpegExtractDir "ffmpeg-*-essentials_build\bin\ffmpeg.exe") | Select-Object -First 1
  $ffprobeSource = Get-Item (Join-Path $ffmpegExtractDir "ffmpeg-*-essentials_build\bin\ffprobe.exe") | Select-Object -First 1

  Copy-Item -Path $ffmpegSource.FullName -Destination $ffmpegPath -Force
  Copy-Item -Path $ffprobeSource.FullName -Destination $ffprobePath -Force
}

Write-Host "Vendor tools are ready:"
Write-Host "  $ytDlpPath"
Write-Host "  $ffmpegPath"
