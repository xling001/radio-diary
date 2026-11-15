# Install Android SDK command-line tools + platform + build-tools (ASCII only)
$ErrorActionPreference = "Continue"

$Sdk   = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:USERPROFILE "android-sdk" }
$Tools = Join-Path $Sdk "cmdline-tools\latest"
$Zip   = Join-Path $env:TEMP "cmdline-tools.zip"
$Url   = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

New-Item -ItemType Directory -Force -Path $Sdk | Out-Null

if (-not (Test-Path (Join-Path $Tools "bin\sdkmanager.bat"))) {
  Write-Host "[1/4] downloading commandline-tools ..."
  if (-not (Test-Path $Zip)) {
    Invoke-WebRequest $Url -OutFile $Zip -UseBasicParsing
  }
  Write-Host ("      zip bytes = " + (Get-Item $Zip).Length)

  Write-Host "[2/4] extracting ..."
  $tmp = Join-Path $env:TEMP "cmdline-tools-unzip"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $Zip -DestinationPath $tmp -Force

  New-Item -ItemType Directory -Force -Path (Split-Path $Tools) | Out-Null
  if (Test-Path $Tools) { Remove-Item $Tools -Recurse -Force }
  Move-Item (Join-Path $tmp "cmdline-tools") $Tools
} else {
  Write-Host "[1/4] commandline-tools already present"
}

$SdkManager = Join-Path $Tools "bin\sdkmanager.bat"
if (-not (Test-Path $SdkManager)) { Write-Host "SDKMANAGER_MISSING"; exit 1 }

Write-Host "[3/4] accepting licenses ..."
$yes = (1..40 | ForEach-Object { "y" }) -join "`n"
$yes | & $SdkManager --sdk_root=$Sdk --licenses 2>&1 | Select-Object -Last 6

Write-Host "[4/4] installing packages ..."
& $SdkManager --sdk_root=$Sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0" 2>&1 | Select-Object -Last 15

Write-Host "---- verify ----"
foreach ($p in @(
  "platforms\android-34\android.jar",
  "build-tools\34.0.0\aapt2.exe",
  "build-tools\34.0.0\d8.bat",
  "build-tools\34.0.0\apksigner.bat",
  "platform-tools\adb.exe"
)) {
  $full = Join-Path $Sdk $p
  if (Test-Path $full) { Write-Host ("OK   " + $p) } else { Write-Host ("MISS " + $p) }
}
Write-Host "SDK_SETUP_DONE"
