# MSGF Cloud Run deploy — Windows helper (PowerShell cannot execute .sh natively).
# Usage (from repo root):
#   .\setup-cloud.ps1
#   .\setup-cloud.ps1 -LogFile gcp-deployment-pulse.log
#
# Requires Git Bash (bash.exe) or WSL. Bash 4+ for setup-cloud.sh.

param(
  [string]$LogFile = "gcp-deployment-pulse.log"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$bash = $null
foreach ($c in @(
    "${env:ProgramFiles}\Git\bin\bash.exe",
    "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
    "${env:LocalAppData}\Programs\Git\bin\bash.exe",
    "bash"
)) {
  if ($c -eq "bash") {
    $g = Get-Command bash -ErrorAction SilentlyContinue
    if ($g) { $bash = $g.Source; break }
  }
  elseif (Test-Path $c) { $bash = $c; break }
}

if (-not $bash) {
  Write-Error "bash not found. Install Git for Windows (includes Git Bash) or use WSL, then re-run."
}

Write-Host "Using: $bash"
Write-Host "Log:   $(Join-Path $root $LogFile)"
Write-Host ""

& $bash -lc "cd `"$(($root -replace '\\','/'))`" && exec ./setup-cloud.sh" 2>&1 | Tee-Object -FilePath (Join-Path $root $LogFile)
