[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cliEntry = Join-Path $repoRoot 'packages/cli/dist/index.js'
$coreEntry = Join-Path $repoRoot 'packages/core/dist/index.js'

function Resolve-Executable {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "未找到可执行命令: $Name"
    }
    return $command.Source
}

function Ensure-Built {
    if ((Test-Path $cliEntry) -and (Test-Path $coreEntry)) {
        return
    }

    Write-Host 'CLI dist 缺失，开始自动编译 @okk/core 和 @okk/cli ...' -ForegroundColor Cyan
    $npm = Resolve-Executable -Name 'npm.cmd'

    & $npm 'run' 'build' '-w' '@okk/core'
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    & $npm 'run' 'build' '-w' '@okk/cli'
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$node = Resolve-Executable -Name 'node'
Ensure-Built

Push-Location $repoRoot
try {
    & $node $cliEntry @CliArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
