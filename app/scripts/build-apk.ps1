# Build a debug APK without Gradle: aapt2 + javac + d8 + zipalign + apksigner
$ErrorActionPreference = "Stop"

$rawB = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$needSubst = $false
$driveLetter = "T:"
if ($rawB -match "[^\x00-\x7F]") {
  $needSubst = $true
  foreach ($char in [char[]]"TUVWXYZSROP") {
    $cand = "$char`:"
    if (-not (Test-Path $cand)) { $driveLetter = $cand; break }
  }
  subst $driveLetter $rawB
  $B = $driveLetter
} else {
  $B = $rawB
}

try {

$Sdk  = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:USERPROFILE "android-sdk" }
$BT   = Join-Path $Sdk "build-tools\34.0.0"
$AJAR = Join-Path $Sdk "platforms\android-34\android.jar"
$Proj = Join-Path $B "android"
$Web  = Join-Path $B "web"
$Out  = Join-Path $B "build\apk"
$JavaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else {
  $jdk = Get-ChildItem "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($jdk) { $jdk.FullName } else { throw "JAVA_HOME not set and no JDK found in C:\Program Files\Java" }
}
$Javac = Join-Path $JavaHome "bin\javac.exe"
$Keytool = Join-Path $JavaHome "bin\keytool.exe"

function Step($n, $msg) { Write-Host ("[" + $n + "] " + $msg) }

# 读取 AndroidManifest.xml 中的版本号与版本代码
$manifestXml = [xml](Get-Content (Join-Path $Proj "AndroidManifest.xml"))
$VerCode = $manifestXml.manifest.'versionCode'
if (-not $VerCode) { $VerCode = "2" }
$VerName = $manifestXml.manifest.'versionName'
if (-not $VerName) { $VerName = "0.1.1" }
$apkName = "radio-diary-v$VerName.apk"

# ---------- 自动归档旧版 APK 到 build/archive ----------
$archiveDir = Join-Path $B "build\archive"
if (-not (Test-Path $archiveDir)) {
  New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
}
$existingApks = Get-ChildItem (Join-Path $B "build") -Filter "*.apk" -File
foreach ($oldApk in $existingApks) {
  $targetArchive = Join-Path $archiveDir $oldApk.Name
  if (Test-Path $targetArchive) { Remove-Item $targetArchive -Force }
  Move-Item $oldApk.FullName $archiveDir -Force
  Write-Host ("      archived old APK: " + $oldApk.Name + " -> build/archive/")
}

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# ---------- 0. 构建并收拢网页资源 (Vite Build) ----------
Step "0/8" "building and copying web assets"
Push-Location $Web
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "npm run build failed"
}
Pop-Location

$dist = Join-Path $Web "dist"
if (-not (Test-Path (Join-Path $dist "index.html"))) {
  throw "dist/index.html not found after vite build!"
}

# 守卫：确保 dist 存在且为最新生成
$distTime = (Get-Item (Join-Path $dist "index.html")).LastWriteTime
$newestSrc = (Get-ChildItem -Recurse (Join-Path $Web "src") -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
if ($distTime -lt $newestSrc.AddSeconds(-5)) {
  throw "Guard failed: dist/index.html is older than newest file in src! Check vite build output."
}

$www = Join-Path $Out "assets\www"
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item (Join-Path $dist "*") $www -Recurse -Force
Write-Host ("      files: " + (Get-ChildItem $www -Recurse -File).Count)

# ---------- 1. 编译资源 ----------
Step "1/8" "aapt2 compile"
$resZip = Join-Path $Out "res.zip"
& (Join-Path $BT "aapt2.exe") compile --dir (Join-Path $Proj "res") -o $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

# ---------- 2. 链接资源与清单 ----------
Step "2/8" "aapt2 link"
$base = Join-Path $Out "base.apk"
$gen  = Join-Path $Out "gen"
New-Item -ItemType Directory -Force -Path $gen | Out-Null
& (Join-Path $BT "aapt2.exe") link `
  -o $base `
  -I $AJAR `
  --manifest (Join-Path $Proj "AndroidManifest.xml") `
  --java $gen `
  --min-sdk-version 23 `
  --target-sdk-version 32 `
  --version-code $VerCode `
  --version-name $VerName `
  $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

# ---------- 3. 编译 Java ----------
Step "3/8" "javac"
$classes = Join-Path $Out "classes"
New-Item -ItemType Directory -Force -Path $classes | Out-Null
$sources = @()
$sources += (Join-Path $Proj "java\com\transvoice\voice\MainActivity.java")
$rJava = Get-ChildItem $gen -Recurse -Filter "R.java" -ErrorAction SilentlyContinue
if ($rJava) { $sources += $rJava.FullName }

& $Javac -encoding UTF-8 -source 8 -target 8 -g:none -Xlint:-options `
  -classpath $AJAR -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

# ---------- 4. dex ----------
Step "4/8" "d8"
$dexDir = Join-Path $Out "dex"
New-Item -ItemType Directory -Force -Path $dexDir | Out-Null
$classFiles = Get-ChildItem $classes -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& (Join-Path $BT "d8.bat") --lib $AJAR --min-api 23 --output $dexDir $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

# ---------- 5. 组装 ----------
Step "5/8" "assembling"
$pkg = Join-Path $Out "pkg"
New-Item -ItemType Directory -Force -Path $pkg | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($base, $pkg)
if (Test-Path (Join-Path $pkg "META-INF")) { Remove-Item (Join-Path $pkg "META-INF") -Recurse -Force }

Copy-Item (Join-Path $dexDir "classes.dex") $pkg -Force
Copy-Item (Join-Path $Out "assets") $pkg -Recurse -Force

$unsigned = Join-Path $Out "unsigned.apk"
if (Test-Path $unsigned) { Remove-Item $unsigned -Force }
$jarExe = Join-Path $JavaHome "bin\jar.exe"
& $jarExe --create --no-compress --no-manifest --file $unsigned -C $pkg .
if ($LASTEXITCODE -ne 0) { throw "jar create failed" }

# ---------- 6. 对齐 ----------
Step "6/8" "zipalign"
$aligned = Join-Path $Out "aligned.apk"
if (Test-Path $aligned) { Remove-Item $aligned -Force }
& (Join-Path $BT "zipalign.exe") -p -f 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

# ---------- 7. 签名 ----------
Step "7/8" "sign"
$ks = Join-Path $B "build\debug.keystore"
if (-not (Test-Path $ks)) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $Keytool -genkeypair -v -keystore $ks -storepass android -keypass android `
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=Android Debug,O=Android,C=US" *> $null
  $ErrorActionPreference = $prev
  Write-Host "      created debug keystore"
}
$final = Join-Path $B "build\$apkName"
if (Test-Path $final) { Remove-Item $final -Force }

& (Join-Path $BT "apksigner.bat") sign `
  --ks $ks --ks-pass pass:android --key-pass pass:android `
  --v1-signing-enabled true `
  --v2-signing-enabled true `
  --v3-signing-enabled true `
  --out $final $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

# ---------- 8. 校验 ----------
Step "8/8" "verify"
& (Join-Path $BT "apksigner.bat") verify --print-certs $final
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

$size = [math]::Round((Get-Item $final).Length / 1MB, 2)
Write-Host ""
Write-Host ("APK_OK " + (Join-Path $rawB "build\$apkName") + "  (" + $size + " MB)")

} finally {
  if ($needSubst) {
    subst $driveLetter /D 2>&1 | Out-Null
  }
}
