param(
  [Parameter(Mandatory = $true)]
  [string]$Title
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$date = Get-Date -Format "yyyy-MM-dd"
$slug = ($Title.ToLower() -replace "[^a-z0-9]+", "-").Trim("-")
$target = Join-Path $root "docs\steps\$date-$slug.md"

if (Test-Path $target) {
  Write-Error "Step file already exists: $target"
  exit 1
}

$template = Get-Content (Join-Path $root "docs\templates\step-template.md") -Raw
$content = $template.Replace("{{TITLE}}", $Title).Replace("{{GOAL}}", "[Describe the goal of this step]")
Set-Content -LiteralPath $target -Value $content

Write-Output $target
