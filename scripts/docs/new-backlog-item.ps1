param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("improvement", "bug", "technical-debt")]
  [string]$Type,

  [Parameter(Mandatory = $true)]
  [string]$Id,

  [Parameter(Mandatory = $true)]
  [string]$Title
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$dir = Join-Path $root "docs\backlog\$Type"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$slug = ($Title.ToLower() -replace "[^a-z0-9]+", "-").Trim("-")
$target = Join-Path $dir "$Id-$slug.md"

if (Test-Path $target) {
  Write-Error "Backlog file already exists: $target"
  exit 1
}

$templateName = if ($Type -eq "bug") { "bug-ticket-template.md" } else { "backlog-item-template.md" }
$template = Get-Content (Join-Path $root "docs\templates\$templateName") -Raw
$content = $template.Replace("{{ID}}", $Id).Replace("{{TITLE}}", $Title)
Set-Content -LiteralPath $target -Value $content

Write-Output $target
