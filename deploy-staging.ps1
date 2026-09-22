param([string]$LogFile = "gcp-deployment-staging.log")
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$bash = @(
  "${env:ProgramFiles}\Git\bin\bash.exe",
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "${env:LocalAppData}\Programs\Git\bin\bash.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash) {
  $g = Get-Command bash -ErrorAction SilentlyContinue
  if ($g) { $bash = $g.Source } else { throw "Install Git for Windows (bash.exe) or use WSL." }
}
& $bash -lc "cd `"$(($root -replace '\\','/'))`" && exec ./deploy-staging.sh" 2>&1 | Tee-Object -FilePath (Join-Path $root $LogFile)
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
