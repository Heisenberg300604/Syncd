param(
    [switch]$Once,
    [switch]$Clean,
    [switch]$ClearData,
    [switch]$Logcat,
    [string]$Device = "",
    [double]$DebounceSeconds = 2.0
)

# Ensure UTF-8 output encoding for clean emoji and box-drawing symbols
try {
    [System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# ---------------------------------------------------------------
#  Environment & Toolchain Setup
# ---------------------------------------------------------------

# Set JAVA_HOME if not already set or invalid
if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    $potentialJavas = @(
        "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot",
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Java\jdk-17*",
        "$env:USERPROFILE\scoop\apps\openjdk17\current",
        "$env:USERPROFILE\scoop\apps\microsoft-jdk17\current"
    )
    foreach ($jPath in $potentialJavas) {
        $resolved = Resolve-Path $jPath -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path "$($resolved.Path)\bin\java.exe")) {
            $env:JAVA_HOME = $resolved.Path
            break
        }
    }
}

# Locate ADB
$adb = $null
$potentialAdbs = @(
    "$PSScriptRoot\android-sdk\platform-tools\adb.exe",
    "$env:USERPROFILE\scoop\apps\android-clt\current\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
    "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe",
    "adb"
)

foreach ($candidate in $potentialAdbs) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $adb = $candidate
        break
    } elseif (Test-Path $candidate) {
        $adb = $candidate
        break
    }
}

# Set SDK roots if detected
if (Test-Path "$PSScriptRoot\android-sdk") {
    $env:ANDROID_HOME = "$PSScriptRoot\android-sdk"
} elseif (-not $env:ANDROID_HOME) {
    if (Test-Path "$env:USERPROFILE\scoop\apps\android-clt\current") {
        $env:ANDROID_HOME = "$env:USERPROFILE\scoop\apps\android-clt\current"
    } elseif (Test-Path "$env:USERPROFILE\AppData\Local\Android\Sdk") {
        $env:ANDROID_HOME = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    }
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

if (Test-Path "$PSScriptRoot\.gradle_user_home") {
    $env:GRADLE_USER_HOME = "$PSScriptRoot\.gradle_user_home"
}

# ---------------------------------------------------------------
#  App Constants
# ---------------------------------------------------------------

$PACKAGE_NAME    = "com.syncd.android.debug"
$MAIN_ACTIVITY   = "com.syncd.android.MainActivity"
$LAUNCH_INTENT   = "$PACKAGE_NAME/$MAIN_ACTIVITY"
$APK_PATH        = "app\build\outputs\apk\debug\app-debug.apk"

# ---------------------------------------------------------------
#  UI Primitives & Styling
# ---------------------------------------------------------------

function Get-Timestamp { 
    return (Get-Date -Format "hh:mm:ss tt") 
}

function Clear-ScreenSafe {
    try {
        if ($Host.UI.RawUI.KeyAvailable -or $Host.Name -notmatch "ServerRemoteHost") {
            [System.Console]::Clear()
        }
    } catch {}
}

function Write-Header {
    Clear-ScreenSafe
    Write-Host ""
    Write-Host "    ╭───────────────────────────────────────────────────────────────╮" -ForegroundColor DarkCyan
    Write-Host "    │                                                               │" -ForegroundColor DarkCyan
    Write-Host "    │   🎵  SYNCD APP  ·  Continuous Device Test & Watch Runner     │" -ForegroundColor Cyan
    Write-Host "    │       Auto-Build  ➜  Auto-Install  ➜  Auto-Launch             │" -ForegroundColor DarkGray
    Write-Host "    │                                                               │" -ForegroundColor DarkCyan
    Write-Host "    ╰───────────────────────────────────────────────────────────────╯" -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Section($label) {
    Write-Host ""
    Write-Host "  ┌─ " -NoNewline -ForegroundColor DarkGray
    Write-Host $label -NoNewline -ForegroundColor White
    $padding = [Math]::Max(1, 56 - $label.Length)
    Write-Host (" " + ("─" * $padding) + "┐") -ForegroundColor DarkGray
}

function Write-Log($icon, $msg, $color = "Gray") {
    Write-Host "  │  " -NoNewline -ForegroundColor DarkGray
    Write-Host "$icon " -NoNewline -ForegroundColor $color
    Write-Host $msg -ForegroundColor $color
}

function Write-OK($msg)      { Write-Log "✔" $msg "Green" }
function Write-Info($msg)    { Write-Log "→" $msg "Cyan" }
function Write-Warn($msg)    { Write-Log "!" $msg "Yellow" }
function Write-Fail($msg)    { Write-Log "✘" $msg "Red" }
function Write-Dim($msg)     { Write-Log "·" $msg "DarkGray" }

function Write-StatusLine($label, $value, $valueColor = "White") {
    Write-Host "  │  " -NoNewline -ForegroundColor DarkGray
    Write-Host ("{0,-18}" -f $label) -NoNewline -ForegroundColor DarkGray
    Write-Host $value -ForegroundColor $valueColor
}

# ---------------------------------------------------------------
#  Device Helpers
# ---------------------------------------------------------------

$script:deviceCache = @{}

function Get-ActiveDevices {
    if (-not $adb) { return @() }
    $devicesRaw = & $adb devices 2>&1
    $deviceList = @()
    foreach ($line in $devicesRaw) {
        if ($line -match "^(\S+)\s+device(\s+|$)") {
            $id = $matches[1]
            if ($Device -eq "" -or $id -eq $Device) {
                $deviceList += $id
            }
        }
    }
    return $deviceList
}

function Get-DeviceDetails($id) {
    if ($script:deviceCache.ContainsKey($id)) {
        return $script:deviceCache[$id]
    }
    
    $modelRaw = (& $adb -s $id shell getprop ro.product.model 2>&1) -join ""
    $brandRaw = (& $adb -s $id shell getprop ro.product.manufacturer 2>&1) -join ""
    $sdkRaw   = (& $adb -s $id shell getprop ro.build.version.sdk 2>&1) -join ""
    $relRaw   = (& $adb -s $id shell getprop ro.build.version.release 2>&1) -join ""
    
    $model = "$modelRaw".Trim()
    $brand = "$brandRaw".Trim()
    $sdk   = "$sdkRaw".Trim()
    $rel   = "$relRaw".Trim()
    
    $icon = if ($id -like "emulator-*") { "💻 Emulator" } else { "📱 Phone" }
    
    $brandFormatted = if ($brand) { (Get-Culture).TextInfo.ToTitleCase($brand.ToLower()) } else { "" }
    $name = if ($brandFormatted -and $model) { "$brandFormatted $model" } else { $id }
    
    $versionInfo = if ($rel -and $sdk) { "(Android $rel, API $sdk)" } else { "" }
    $label = "$name $versionInfo [$id] ($icon)"
    
    $details = [PSCustomObject]@{
        Id      = $id
        Label   = $label
        Model   = $model
        Brand   = $brandFormatted
        Release = $rel
        Sdk     = $sdk
        IsEmu   = ($id -like "emulator-*")
    }
    
    $script:deviceCache[$id] = $details
    return $details
}

function Wake-Device($id) {
    # Send WAKEUP (224) and MENU/UNLOCK (82) keyevents to wake screen if asleep
    & $adb -s $id shell input keyevent 224 2>&1 | Out-Null
    & $adb -s $id shell input keyevent 82 2>&1 | Out-Null
}

# ---------------------------------------------------------------
#  Build, Install & Launch Action
# ---------------------------------------------------------------

function BuildAndDeploy {
    Write-Section "BUILD  &  DEPLOY  [$(Get-Timestamp)]"
    
    # ── Device Resolution ──
    $deviceIds = @(Get-ActiveDevices)
    if ($deviceIds.Count -eq 0) {
        Write-Warn "No active Android devices or emulators connected."
        Write-Dim  "Connect your device with USB Debugging enabled, or start an emulator."
        if ($adb) {
            Write-Dim "Running: $adb devices"
        } else {
            Write-Fail "ADB not found on PATH or standard Android SDK locations."
        }
        return $false
    }

    Write-StatusLine "Target Devices:" "$($deviceIds.Count) device(s) ready" "Cyan"
    foreach ($d in $deviceIds) {
        $dev = Get-DeviceDetails $d
        Write-Dim "  • $($dev.Label)"
    }

    # ── Build Step ──
    $gradleCmd = ".\gradlew.bat"
    if (-not (Test-Path $gradleCmd)) {
        $gradleCmd = "gradlew.bat"
    }

    $gradleArgs = @("assembleDebug")
    if ($Clean) {
        & $gradleCmd --stop 2>&1 | Out-Null
        $gradleArgs = @("clean", "assembleDebug")
        Write-Info "Executing clean build..."
    }

    Write-Host ""
    Write-Info "Running Gradle assembleDebug..."
    $startTime = Get-Date

    $buildResult = Start-Process -FilePath $gradleCmd -ArgumentList $gradleArgs -NoNewWindow -PassThru -Wait
    $duration = ((Get-Date) - $startTime).TotalSeconds

    if ($buildResult.ExitCode -ne 0) {
        Write-Warn ("Initial build failed (exit code {0}). Stopping stale Gradle daemons and clearing locked intermediates..." -f $buildResult.ExitCode)
        
        # Stop stale or conflicting daemons holding Windows file locks
        & $gradleCmd --stop 2>&1 | Out-Null
        
        # Remove locked/stale intermediate and generated cache directories
        $stuckPaths = @(
            "$PSScriptRoot\app\build\intermediates",
            "$PSScriptRoot\app\build\generated\ksp",
            "$PSScriptRoot\app\build\kspCaches",
            "$PSScriptRoot\app\build\tmp"
        )
        foreach ($p in $stuckPaths) {
            if (Test-Path $p) {
                try {
                    Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        }

        Write-Info "Retrying Gradle assembleDebug..."
        $retryStart = Get-Date
        $buildResult = Start-Process -FilePath $gradleCmd -ArgumentList $gradleArgs -NoNewWindow -PassThru -Wait
        $duration = ((Get-Date) - $retryStart).TotalSeconds

        if ($buildResult.ExitCode -ne 0) {
            Write-Fail ("Build failed after retry with exit code {0}  ›  {1:N1}s" -f $buildResult.ExitCode, $duration)
            return $false
        }
    }
    Write-OK ("Build succeeded  ›  {0:N1}s" -f $duration)

    # ── APK Check ──
    if (-not (Test-Path $APK_PATH)) {
        Write-Fail "APK file was not found at $APK_PATH"
        return $false
    }

    $apkFile = Get-Item $APK_PATH
    $apkSizeMb = [Math]::Round($apkFile.Length / 1MB, 2)
    Write-Dim ("APK: {0} ({1} MB)" -f $apkFile.Name, $apkSizeMb)

    # ── Deploy on each device ──
    Write-Host ""
    foreach ($targetDevice in $deviceIds) {
        $dev = Get-DeviceDetails $targetDevice
        Write-Info "Deploying to $($dev.Brand) $($dev.Model) ($targetDevice)..."
        
        # Optional clear data
        if ($ClearData) {
            Write-Dim "Clearing app data for $PACKAGE_NAME..."
            & $adb -s $targetDevice shell pm clear $PACKAGE_NAME 2>&1 | Out-Null
        }

        # Wake screen
        Wake-Device $targetDevice

        # Ensure file handle and Windows Defender scanning on APK have settled
        Start-Sleep -Milliseconds 400

        $resolvedApk = if (Test-Path $APK_PATH) { (Resolve-Path $APK_PATH).Path } else { Join-Path $PSScriptRoot $APK_PATH }

        # Detect Android version for tailored compatibility
        [int]$sdkInt = 0
        if ($dev.Sdk) {
            [int]::TryParse($dev.Sdk, [ref]$sdkInt) | Out-Null
        }

        # Build device-aware ADB install flags based on Android API level:
        # -r = replace existing app
        # -d = allow version code downgrade
        # --bypass-low-target-sdk-block = Android 14+ (API 34+) compatibility
        # -g = grant all runtime permissions (only supported on API 23+)
        $installBaseArgs = @("install", "-r", "-d")
        if ($sdkInt -ge 34) {
            $installBaseArgs += "--bypass-low-target-sdk-block"
        }
        $installArgs = if ($sdkInt -ge 23) { $installBaseArgs + @("-g", $resolvedApk) } else { $installBaseArgs + @($resolvedApk) }

        $installStart = Get-Date
        $installOut = & $adb -s $targetDevice @installArgs 2>&1

        # Resilient Retry Logic: Handle transient USB drops, locked APK handles, or signature mismatches
        if ($installOut -notmatch "Success") {
            if ($installOut -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match") {
                Write-Warn "Signature mismatch detected. Performing clean reinstall..."
                & $adb -s $targetDevice uninstall $PACKAGE_NAME 2>&1 | Out-Null
                Start-Sleep -Milliseconds 500
                $cleanArgs = if ($sdkInt -ge 23) { @("install", "-g", $resolvedApk) } else { @("install", $resolvedApk) }
                $installOut = & $adb -s $targetDevice @cleanArgs 2>&1
            } else {
                # Transient stream install failure (common on OnePlus / OxygenOS right after build)
                Write-Warn "First install attempt failed, retrying in 1s..."
                Start-Sleep -Seconds 1
                Wake-Device $targetDevice
                $installOut = & $adb -s $targetDevice @installArgs 2>&1
                
                # If still failing, try standard install without -g (some OS versions reject -g on stream)
                if ($installOut -notmatch "Success") {
                    Start-Sleep -Milliseconds 500
                    $plainArgs = $installBaseArgs + @($resolvedApk)
                    $installOut = & $adb -s $targetDevice @plainArgs 2>&1
                }
            }
        }
        $installDuration = ((Get-Date) - $installStart).TotalSeconds

        if ($installOut -match "Success") {
            Write-OK ("Installed ({0:N1}s)  ›  {1}" -f $installDuration, $dev.Label)
            
            # Setup reverse port forwarding for local backend (port 5000) over USB
            & $adb -s $targetDevice reverse tcp:5000 tcp:5000 2>&1 | Out-Null

            # Launch App across older and newer Android versions
            # --user 0 targets current primary user space (handles Android 12+ work profile/multi-user restrictions)
            $launchArgs = @("shell", "am", "start", "-n", $LAUNCH_INTENT, "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER")
            if ($sdkInt -ge 24) {
                $launchArgs += @("--user", "0")
            }
            $launchOut = & $adb -s $targetDevice @launchArgs 2>&1
            
            if ($launchOut -match "Error|Exception" -and $launchOut -notmatch "Warning: Activity not started") {
                # Fallback to monkey launcher
                $monkeyOut = & $adb -s $targetDevice shell monkey -p $PACKAGE_NAME -c android.intent.category.LAUNCHER 1 2>&1
                if ($monkeyOut -match "Events injected: 1") {
                    Write-OK "Launched  ›  $PACKAGE_NAME"
                } else {
                    Write-Warn "Launch warning: $launchOut"
                }
            } else {
                Write-OK "Launched  ›  $LAUNCH_INTENT"
            }
        } else {
            Write-Fail "Install failed  ›  $($dev.Label)"
            $installOut | ForEach-Object { Write-Dim $_ }
            Write-Dim "Tip: On OnePlus / ColorOS, verify 'Install via USB' is enabled in Developer Options"
            Write-Dim "and ensure the device is unlocked to accept installation prompts."
        }
    }

    # ── Logcat streaming (if -Logcat was specified) ──
    if ($Logcat -and $deviceIds.Count -gt 0) {
        $primary = $deviceIds[0]
        Write-Section "LOGCAT STREAM [$primary]"
        Write-Dim "Streaming logcat for $PACKAGE_NAME... (Ctrl+C to stop)"
        & $adb -s $primary logcat -c
        & $adb -s $primary logcat --pid=(`&$adb -s $primary shell pidof -s $PACKAGE_NAME) -v color
    }

    return $true
}

# ---------------------------------------------------------------
#  Main Entrypoint
# ---------------------------------------------------------------

Write-Header

if ($adb) {
    Write-StatusLine "ADB Path:" $adb "Cyan"
} else {
    Write-StatusLine "ADB Path:" "NOT FOUND" "Red"
}

if ($env:JAVA_HOME) {
    Write-StatusLine "JAVA_HOME:" $env:JAVA_HOME "DarkGray"
}

if (Test-Path "$PSScriptRoot\android-sdk") {
    Write-StatusLine "Android SDK:" "$PSScriptRoot\android-sdk" "Cyan"
} elseif ($env:ANDROID_HOME) {
    Write-StatusLine "Android SDK:" $env:ANDROID_HOME "DarkGray"
}

if ($Device) {
    Write-StatusLine "Target Lock:" $Device "Yellow"
}

# Run initial build & install
$initialSuccess = BuildAndDeploy

# Exit if -Once is requested
if ($Once) {
    Write-Host ""
    Write-OK "Run completed (-Once)."
    exit 0
}

# ---------------------------------------------------------------
#  Continuous File Watcher
# ---------------------------------------------------------------

Write-Section "LIVE WATCHER"
Write-StatusLine "Status:" "Active & Watching" "Green"
Write-StatusLine "Debounce:" "$($DebounceSeconds)s" "Gray"
Write-Dim "Watching: app/src, build.gradle.kts, res, AndroidManifest..."
Write-Dim "Press Ctrl+C in terminal to stop watcher."

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents   = $true

# Filter ignored paths and extensions
$ignorePattern = "(^|\\|\/)(build|\.gradle|\.git|\.gradle_user_home|\.kotlin|\.idea|android-sdk|node_modules|Loger)(\\|\/|$)|(\.log|\.apk|\.tmp|\.ps1|~$)"

$lastEventTime = [DateTime]::MinValue
$changeIndex   = 0

try {
    while ($true) {
        $change = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 1000)
        if ($change.TimedOut -eq $false) {
            $relPath = $change.Name
            
            # Skip ignored directories and files
            if ($relPath -match $ignorePattern) {
                continue
            }
            
            $now = Get-Date
            if (($now - $lastEventTime).TotalSeconds -ge $DebounceSeconds) {
                $lastEventTime = $now
                $changeIndex++
                
                Write-Host ""
                $changeHeader = "  ● CHANGE #$changeIndex  ›  $relPath"
                $ts = "  $(Get-Timestamp)  "
                $totalWidth = 66
                $spacer = " " * [Math]::Max(1, $totalWidth - $changeHeader.Length - $ts.Length)
                
                Write-Host "  ╔" -NoNewline -ForegroundColor DarkYellow
                Write-Host ("═" * 64) -NoNewline -ForegroundColor DarkYellow
                Write-Host "╗" -ForegroundColor DarkYellow
                Write-Host "  ║  " -NoNewline -ForegroundColor DarkYellow
                Write-Host "●" -NoNewline -ForegroundColor Yellow
                Write-Host "●" -NoNewline -ForegroundColor DarkYellow
                Write-Host "● " -NoNewline -ForegroundColor Yellow
                Write-Host "CHANGE #$changeIndex" -NoNewline -ForegroundColor White
                Write-Host "  ›  " -NoNewline -ForegroundColor DarkGray
                Write-Host $relPath -NoNewline -ForegroundColor Yellow
                Write-Host $spacer -NoNewline
                Write-Host $ts -NoNewline -ForegroundColor DarkGray
                Write-Host "║" -ForegroundColor DarkYellow
                Write-Host "  ╚" -NoNewline -ForegroundColor DarkYellow
                Write-Host ("═" * 64) -NoNewline -ForegroundColor DarkYellow
                Write-Host "╝" -ForegroundColor DarkYellow
                
                BuildAndDeploy
                
                Write-Section "LIVE WATCHER"
                Write-Dim "Watching for new source changes..."
            }
        }
    }
} finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
}

