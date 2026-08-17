$ErrorActionPreference = 'Stop'
$RepoRoot = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Run this command inside the StartWave repository.' }
git -C $RepoRoot config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) { throw 'Could not configure Git hooks.' }
Write-Host 'StartWave publication guard installed for this checkout.'
