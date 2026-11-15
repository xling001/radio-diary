# Syntax and reference check (ASCII only: PS 5.1 reads .ps1 as ANSI)
$N = "node"
$B = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $B

# Every ES module under web/src, enumerated - a hardcoded list silently stops
# covering files added later (the worker added in 0.6.14 was initially unscanned).
$files = @()
foreach ($f in Get-ChildItem -Recurse -File "web/src" -Include *.js) {
  $files += $f.FullName.Substring($B.Length + 1).Replace('\', '/')
}
$files = $files | Sort-Object

$bad = 0
foreach ($f in $files) {
  & $N --check $f 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host ("OK   " + $f) }
  else { Write-Host ("FAIL " + $f); & $N --check $f; $bad++ }
}

$js = Get-Content "web/src/main.js" -Raw
$html = Get-Content "web/index.html" -Raw

$ids = @()
foreach ($m in [regex]::Matches($js, "getElementById\('([^']+)'\)")) { $ids += $m.Groups[1].Value }
foreach ($m in [regex]::Matches($js, "\`$\('([^']+)'\)")) { $ids += $m.Groups[1].Value }
$ids = $ids | Sort-Object -Unique

$dynamicWhitelist = @('dsh-dialog-root')
$missing = @()
foreach ($id in $ids) {
  if ($dynamicWhitelist -contains $id) { continue }
  $needle = 'id="' + $id + '"'
  if ($html.IndexOf($needle) -lt 0) { $missing += $id }
}

Write-Host ""
Write-Host ("DOM refs: " + $ids.Count + " ; missing: " + $(if ($missing.Count) { $missing -join ", " } else { "none" }))

$goes = @()
foreach ($m in [regex]::Matches($html, 'data-go="([a-z]+)"')) { $goes += $m.Groups[1].Value }
$goes = $goes | Sort-Object -Unique

$views = @()
foreach ($m in [regex]::Matches($html, 'data-view="([a-z]+)"')) { $views += $m.Groups[1].Value }
$views = $views | Sort-Object -Unique

$badgo = @()
foreach ($g in $goes) { if ($views -notcontains $g) { $badgo += $g } }

Write-Host ("data-go: " + ($goes -join ",") + " ; unmatched: " + $(if ($badgo.Count) { $badgo -join "," } else { "none" }))
Write-Host ""

# 转义污染闸门：源文件里出现「字面量 `n」通常意味着某次 shell 引号把换行写坏了。
# 危害是静默的——在 CSS 里它让后一条规则整条失效，在 JS 的 // 注释里它把后面的代码注释掉。
# 只在反引号+n 后面不是字母时报错，避免误伤 `normalizeSemitones` 这类正当写法。
$taint = @()
$scanRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'web'
foreach ($f in Get-ChildItem -Recurse -File $scanRoot -Include *.js,*.css,*.html) {
  if ($f.FullName -match '[\\/]node_modules[\\/]' -or $f.FullName -match '[\\/]dist[\\/]') { continue }
  $t = [System.IO.File]::ReadAllText($f.FullName)
  $hits = [regex]::Matches($t, '`n(?![A-Za-z])').Count
  if ($hits -gt 0) { $taint += "$($f.Name) x$hits" }
}
if ($taint.Count) {
  Write-Host ("ESCAPE_TAINT: " + ($taint -join ", "))
} else {
  Write-Host "escape taint: none"
}
Write-Host ""
if ($bad -gt 0 -or $badgo.Count -gt 0 -or $taint.Count -gt 0) {
  Write-Host ("FAILED: syntax=" + $bad + " badgo=" + $badgo.Count + " taint=" + $taint.Count)
  Pop-Location
  exit 1
} else {
  Write-Host "ALL_SYNTAX_OK"
}
Pop-Location
