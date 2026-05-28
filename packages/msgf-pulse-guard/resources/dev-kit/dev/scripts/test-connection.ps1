# MSGF connectivity probe — requires MSGF_API_URL, MSGF_AUTH_TOKEN, MSGF_TENANT_KEY
# Or copy dev/env.example.json -> dev/env.local.json (gitignored)

$ErrorActionPreference = "Stop"
$kitRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile = Join-Path $kitRoot "dev/env.local.json"

function Load-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $j = Get-Content $Path -Raw | ConvertFrom-Json
  if ($j.MSGF_API_URL) { $env:MSGF_API_URL = $j.MSGF_API_URL }
  if ($j.MSGF_AUTH_TOKEN) { $env:MSGF_AUTH_TOKEN = $j.MSGF_AUTH_TOKEN }
  if ($j.MSGF_TENANT_KEY) { $env:MSGF_TENANT_KEY = $j.MSGF_TENANT_KEY }
}

Load-EnvFile $envFile

$base = ($env:MSGF_API_URL ?? "").TrimEnd("/")
$token = $env:MSGF_AUTH_TOKEN ?? ""
$tenant = $env:MSGF_TENANT_KEY ?? ""

if (-not $base -or -not $token -or -not $tenant) {
  Write-Host "[MSGF] Set MSGF_API_URL, MSGF_AUTH_TOKEN, MSGF_TENANT_KEY or create dev/env.local.json"
  exit 1
}

$uri = "$base/api/msgf/ide/connectivity-check"
$headers = @{
  Authorization = "Bearer $token"
  "X-MSGF-Tenant-Key" = $tenant
  "x-msgf-tenant-id" = $tenant
}

Write-Host "[MSGF] GET $uri"
try {
  $resp = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing
  Write-Host "[MSGF] OK $($resp.StatusCode)"
  Write-Host $resp.Content
  exit 0
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "[MSGF] FAIL HTTP $code"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
