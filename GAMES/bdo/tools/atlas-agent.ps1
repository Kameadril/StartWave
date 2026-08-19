[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('validate', 'report')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$AgentPath = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot 'tools\atlas-agent\agent.mjs'))
$RootPrefix = $ProjectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $AgentPath.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Atlas Worker path escapes the project root.'
}

Push-Location -LiteralPath $ProjectRoot
try {
    & node $AgentPath $Mode
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
