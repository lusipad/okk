$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputDir = Join-Path $repoRoot "output"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$backendOut = Join-Path $outputDir "dev-backend.stdout.log"
$backendErr = Join-Path $outputDir "dev-backend.stderr.log"
$frontendOut = Join-Path $outputDir "dev-frontend.stdout.log"
$frontendErr = Join-Path $outputDir "dev-frontend.stderr.log"

$backend = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "-w", "@okk/web-backend" `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -PassThru

$frontend = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "-w", "@okk/web-frontend" `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -PassThru

Set-Content -Path (Join-Path $outputDir "dev-backend.pid") -Value $backend.Id
Set-Content -Path (Join-Path $outputDir "dev-frontend.pid") -Value $frontend.Id

$uiUrl = $null
for ($i = 0; $i -lt 180; $i += 1) {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:3000/healthz" -UseBasicParsing | Out-Null
    foreach ($port in 5173, 5174, 5175, 5176, 5177) {
      try {
        Invoke-WebRequest -Uri ("http://127.0.0.1:{0}" -f $port) -UseBasicParsing | Out-Null
        $uiUrl = "http://127.0.0.1:$port"
        break
      } catch {
        # try next port
      }
    }
  } catch {
    # backend not ready yet
  }

  if ($uiUrl) {
    break
  }

  Start-Sleep -Seconds 1
}

if (-not $uiUrl) {
  Write-Host "FAILED_TO_START"
  Write-Host ("backend_pid=" + $backend.Id)
  Write-Host ("frontend_pid=" + $frontend.Id)
  foreach ($logPath in @($backendOut, $backendErr, $frontendOut, $frontendErr)) {
    if (Test-Path $logPath) {
      Get-Content -Path $logPath -Tail 80
    }
  }
  exit 1
}

Start-Process $uiUrl | Out-Null

Write-Host ("backend_pid=" + $backend.Id)
Write-Host ("frontend_pid=" + $frontend.Id)
Write-Host ("ui_url=" + $uiUrl)
Write-Host "backend_url=http://127.0.0.1:3000"
Write-Host ("backend_log=" + $backendOut)
Write-Host ("frontend_log=" + $frontendOut)
