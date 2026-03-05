$out = "preview.log"
$err = "preview.err"

if (Test-Path $out) {
  Remove-Item $out -Force
}
if (Test-Path $err) {
  Remove-Item $err -Force
}

$proc = Start-Process -FilePath "npm.cmd" -ArgumentList @(
  "run",
  "preview",
  "-w",
  "@okk/web-frontend",
  "--",
  "--host",
  "127.0.0.1",
  "--port",
  "4173"
) -PassThru -RedirectStandardOutput $out -RedirectStandardError $err

Start-Sleep -Seconds 3

node -e "(async()=>{const r=await fetch('http://127.0.0.1:4173');const t=await r.text();console.log('frontend_status',r.status);console.log('html_head',t.slice(0,120).replace(/\\n/g,' '));})();"

if ($proc) {
  Stop-Process -Id $proc.Id -Force
}

Write-Output "--- preview.log ---"
Get-Content $out | Select-Object -Last 20
Write-Output "--- preview.err ---"
if (Test-Path $err) {
  Get-Content $err | Select-Object -Last 20
}
