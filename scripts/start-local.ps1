# Lokal opstart af pepper-screen-interface + pepper-robot-bridge i ét greb.
#
# Forudsætninger:
#   - pepper-robot-bridge findes som søstermappe (default) eller via -BridgePath
#   - bridge har en aktiv .venv27 med pepper_bridge installeret
#   - python (>= 3.11) findes i PATH
#
# Eksempel:
#   .\scripts\start-local.ps1 -OperatorIp 192.168.1.42 -RobotIp 192.168.1.155

[CmdletBinding()]
param(
    [string]$OperatorIp = "",
    [string]$RobotIp = "",
    [int]$BridgePort = 8080,
    [int]$ProxyPort = 5000,
    [string]$BridgePath = "",
    [switch]$SkipBridge
)

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $PSCommandPath
$proxyDir = Split-Path -Parent $here
if (-not $BridgePath) {
    $BridgePath = Join-Path (Split-Path -Parent $proxyDir) "pepper-robot-bridge"
}

$bridgeHost = "localhost"

function Get-BridgeActivator {
    # Bridge'ens activate-with-naoqi.bat saetter baade venv og PYTHONPATH for
    # NAOqi-SDK'et - vi spawner bridge gennem den i stedet for at kalde python.exe
    # direkte, saa naoqi-importen virker.
    $helper = Join-Path $BridgePath "activate-with-naoqi.bat"
    if (-not (Test-Path $helper)) {
        throw "Kan ikke finde $helper. Koer bridge'ens setup-script foerst (scripts\setup-windows.bat ...)."
    }
    return $helper
}

function Detect-LocalIp {
    $iface = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1
    if ($iface) { return $iface.IPAddress }
    return $null
}

function Wait-ForBridge {
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        try {
            $null = Invoke-WebRequest -Uri "http://${bridgeHost}:${BridgePort}/api/status" -UseBasicParsing -TimeoutSec 2
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

function Send-ShowTabletUrl([string]$Url) {
    $payload = @{ command = "show_tablet_url"; params = @{ url = $Url } } | ConvertTo-Json -Compress
    Write-Host "Sender show_tablet_url til bridge med URL: $Url"
    try {
        $resp = Invoke-RestMethod -Uri "http://${bridgeHost}:${BridgePort}/api/command" `
            -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 10
        $resp | ConvertTo-Json -Depth 5
    } catch {
        Write-Warning "Kunne ikke kontakte bridge: $_"
    }
}

if (-not $OperatorIp) {
    $OperatorIp = Detect-LocalIp
    if ($OperatorIp) {
        Write-Host "Bruger automatisk fundet operator-IP: $OperatorIp"
    } else {
        $OperatorIp = Read-Host "Indtast IP paa operator-maskinen"
    }
}
if (-not $OperatorIp) { throw "operator-IP er paakraevet." }

$logDir = Join-Path $proxyDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$bridgeProc = $null
if (-not $SkipBridge) {
    if (-not (Test-Path $BridgePath)) { throw "Kan ikke finde pepper-robot-bridge i $BridgePath (brug -BridgePath)." }
    if (-not $RobotIp) { $RobotIp = Read-Host "Indtast IP paa Pepper/NAO" }
    if (-not $RobotIp) { throw "robot-IP paakraevet naar bridge skal startes." }

    $activator = Get-BridgeActivator
    Write-Host "Starter pepper-robot-bridge paa localhost:$BridgePort med robot-IP $RobotIp"

    # Spawn bridge via cmd-shell der koerer activate-with-naoqi.bat (saetter venv + naoqi-PYTHONPATH)
    # og derefter pepper-bridge. /d skifter drive, /c afslutter cmd naar processen doer.
    $cmdLine = "/d /c `"call `"$activator`" >nul && pepper-bridge --robot-ip $RobotIp --host localhost --port $BridgePort`""
    $bridgeProc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine `
        -WorkingDirectory $BridgePath `
        -RedirectStandardOutput (Join-Path $logDir "bridge.log") `
        -RedirectStandardError (Join-Path $logDir "bridge.err") `
        -PassThru -NoNewWindow
}

if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command python3 -ErrorAction SilentlyContinue)) {
    throw "python (3.x) paakraevet."
}
$py3 = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "python3" }

Write-Host "Starter pepper-screen-interface paa http://0.0.0.0:$ProxyPort/"
$proxyArgs = @("app.py", "--host", "0.0.0.0", "--port", "$ProxyPort", "--bridge-host", $bridgeHost, "--bridge-port", "$BridgePort")
$proxyProc = Start-Process -FilePath $py3 -ArgumentList $proxyArgs `
    -WorkingDirectory $proxyDir `
    -RedirectStandardOutput (Join-Path $logDir "proxy.log") `
    -RedirectStandardError (Join-Path $logDir "proxy.err") `
    -PassThru -NoNewWindow

try {
    if ($bridgeProc) {
        Write-Host "Venter paa at bridge bliver klar..."
        if (-not (Wait-ForBridge)) { throw "Bridge svarer ikke. Se $logDir\bridge.log" }
    }

    Send-ShowTabletUrl -Url "http://${OperatorIp}:${ProxyPort}/"

    Write-Host ""
    Write-Host "Tryk Ctrl+C for at stoppe."
    while ($true) { Start-Sleep -Seconds 2 }
}
finally {
    Write-Host ""
    Write-Host "Stopper tjenester..."
    if ($bridgeProc -and -not $bridgeProc.HasExited) { Stop-Process -Id $bridgeProc.Id -Force -ErrorAction SilentlyContinue }
    if ($proxyProc -and -not $proxyProc.HasExited) { Stop-Process -Id $proxyProc.Id -Force -ErrorAction SilentlyContinue }
}
