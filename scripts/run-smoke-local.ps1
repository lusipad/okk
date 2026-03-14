$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputDir = Join-Path $repoRoot "output"
$backendStdoutLog = Join-Path $outputDir "dev-backend.stdout.log"
$backendStderrLog = Join-Path $outputDir "dev-backend.stderr.log"
$frontendStdoutLog = Join-Path $outputDir "dev-frontend.stdout.log"
$frontendStderrLog = Join-Path $outputDir "dev-frontend.stderr.log"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$backendProcess = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "-w", "@okk/web-backend" `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $backendStdoutLog `
  -RedirectStandardError $backendStderrLog `
  -PassThru

$frontendProcess = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "-w", "@okk/web-frontend" `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $frontendStdoutLog `
  -RedirectStandardError $frontendStderrLog `
  -PassThru

try {
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
    Write-Host "dev servers not ready"
    foreach ($logPath in @($backendStdoutLog, $backendStderrLog, $frontendStdoutLog, $frontendStderrLog)) {
      if (Test-Path $logPath) {
        Get-Content -Path $logPath -Tail 120
      }
    }
    exit 1
  }

  $env:OKK_UI_URL = $uiUrl
  & node (Join-Path $repoRoot "scripts/smoke-e2e.mjs")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  foreach ($process in @($backendProcess, $frontendProcess)) {
    if ($process -and -not $process.HasExited) {
      taskkill /PID $process.Id /T /F | Out-Null
    }
  }
}
