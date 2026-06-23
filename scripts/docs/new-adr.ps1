param(
  [Parameter(Mandatory = $true)]
  [string]$Title
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$adrDir = Join-Path $root "docs\adr"
$existing = Get-ChildItem -LiteralPath $adrDir -Filter "*.md" |
  Where-Object { $_.BaseName -match "^\d{4}-" } |
  Sort-Object Name

$nextNumber = if ($existing.Count -eq 0) { 1 } else { [int]$existing[-1].BaseName.Substring(0, 4) + 1 }
$number = "{0:D4}" -f $nextNumber
$slug = ($Title.ToLower() -replace "[^a-z0-9]+", "-").Trim("-")
$target = Join-Path $adrDir "$number-$slug.md"

if (Test-Path $target) {
  Write-Error "ADR file already exists: $target"
  exit 1
}

$template = Get-Content (Join-Path $root "docs\templates\adr-template.md") -Raw
$content = $template.Replace("{{NUMBER}}", $number)
$content = $content.Replace("{{TITLE}}", $Title)
$content = $content.Replace("{{CONTEXT}}", "[Describe the context]")
$content = $content.Replace("{{DECISION}}", "[Describe the decision]")
Set-Content -LiteralPath $target -Value $content

Write-Output $target
