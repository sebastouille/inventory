[CmdletBinding()]
param(
  [string]$SchemaPath = "prisma/schema.prisma",
  [string]$DatabaseUrl = "postgresql://inventory:inventory@127.0.0.1:5560/inventory"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

if ($env:PRISMA_GENERATE_NO_ENGINE) {
  Write-Error "Generation Prisma refusee : PRISMA_GENERATE_NO_ENGINE est defini. Ce projet local exige un client Prisma avec engine local."
}

if ($env:PRISMA_CLIENT_ENGINE_TYPE -and $env:PRISMA_CLIENT_ENGINE_TYPE -eq "client") {
  Write-Error "Generation Prisma refusee : PRISMA_CLIENT_ENGINE_TYPE=client activerait un mode incompatible avec l usage local PostgreSQL."
}

$schemaFullPath = if ([System.IO.Path]::IsPathRooted($SchemaPath)) {
  $SchemaPath
} else {
  Join-Path $repoRoot $SchemaPath
}
if (-not (Test-Path -LiteralPath $schemaFullPath)) {
  Write-Error "Schema Prisma introuvable : $schemaFullPath"
}

$clientDirectory = Join-Path $repoRoot "node_modules/.prisma/client"
if (Test-Path -LiteralPath $clientDirectory) {
  Remove-Item -LiteralPath $clientDirectory -Recurse -Force
}

$env:DATABASE_URL = $DatabaseUrl

& npx prisma generate --schema $schemaFullPath
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$generatedIndex = Join-Path $clientDirectory "index.js"
if (-not (Test-Path -LiteralPath $generatedIndex)) {
  Write-Error "Client Prisma genere introuvable : $generatedIndex"
}

$generatedContent = Get-Content -LiteralPath $generatedIndex -Raw
if ($generatedContent -notmatch '"copyEngine":\s*true') {
  Write-Error "Generation Prisma invalide : le client genere n embarque pas l engine local. Ne pas utiliser --no-engine sur ce projet."
}

Write-Host "Prisma Client regenere avec engine local valide."
