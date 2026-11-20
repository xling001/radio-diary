# Build app/web and publish dist/ cleanly to gh-pages branch (for GitHub Pages / iOS PWA)
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Web  = Join-Path $Root "app\web"
$Dist = Join-Path $Web "dist"

Push-Location $Web
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "vite build failed" }
Pop-Location

if (-not (Test-Path (Join-Path $Dist "index.html"))) {
  throw "dist/index.html missing after build"
}

$tmpDir = Join-Path $env:TEMP ("radio-diary-ghpages-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
  Copy-Item (Join-Path $Dist "*") $tmpDir -Recurse -Force
  Set-Content -Path (Join-Path $tmpDir ".nojekyll") -Value "" -Encoding Ascii

  $remoteUrl = (git -C $Root remote get-url origin).Trim()
  if (-not $remoteUrl) { throw "No git origin remote found in $Root" }

  Push-Location $tmpDir
  git init -b gh-pages | Out-Null
  git add -A
  git commit -m "chore(web): publish Radio Diary Web PWA" | Out-Null

  $ok = $false
  for ($i = 1; $i -le 3; $i++) {
    git push --force $remoteUrl gh-pages:gh-pages
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ok) { throw "git push gh-pages failed" }
  Pop-Location
  Write-Host "DEPLOY_WEB_OK https://xling001.github.io/radio-diary/"
} finally {
  if ((Get-Location).Path -eq $tmpDir) { Pop-Location }
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
