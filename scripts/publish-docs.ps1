$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceDocumentation = Join-Path $repoRoot "docs\recreation-spec.md"
$publishedDocumentation = Join-Path $repoRoot "src\recreation-spec.md"

if (-not (Test-Path -LiteralPath $sourceDocumentation)) {
    throw "Source recreation documentation was not found at $sourceDocumentation."
}

Copy-Item -LiteralPath $sourceDocumentation -Destination $publishedDocumentation -Force
Write-Host "Published Asset recreation documentation to $publishedDocumentation."
