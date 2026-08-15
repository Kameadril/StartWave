[CmdletBinding()]
param(
    [Parameter(Mandatory=$true,Position=0)][ValidateSet('start','once','submit','status')][string]$Command,
    [Parameter(Position=1)][string]$Prompt,
    [ValidateSet('llm-only','atlas-analysis','bdo-web-search')][string]$Type='llm-only',
    [string[]]$Files=@(), [switch]$NoValidation, [string]$Id
)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Service=Join-Path $Root 'tools\startwave-agent\service.mjs'
$State=Join-Path $Root '.startwave-agent'
foreach($Name in 'queue','claims','runs','logs','failed'){New-Item -ItemType Directory -Force -Path (Join-Path $State $Name)|Out-Null}
Push-Location -LiteralPath $Root
try {
    if($Command -in @('start','once')){& node $Service $Command; exit $LASTEXITCODE}
    if($Command -eq 'submit'){
        if([string]::IsNullOrWhiteSpace($Prompt)){throw 'Prompt is required for submit.'}
        if(-not $Id){$Id='job-'+[DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'-'+([guid]::NewGuid().ToString('N').Substring(0,6))}
        $Job=[ordered]@{id=$Id;createdAt=[DateTimeOffset]::UtcNow.ToString('o');type=$Type;prompt=$Prompt;validation=(-not $NoValidation);files=@($Files)}
        $Target=Join-Path (Join-Path $State 'queue') "$Id.json"
        $Stream=[IO.File]::Open($Target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try{$Writer=[IO.StreamWriter]::new($Stream,[Text.UTF8Encoding]::new($false));$Writer.WriteLine(($Job|ConvertTo-Json -Depth 5 -Compress));$Writer.Dispose()}finally{if($Stream){$Stream.Dispose()}}
        Write-Output $Id; exit 0
    }
    if(-not $Id){Get-ChildItem (Join-Path $State 'runs') -Filter '*.json'|Sort-Object LastWriteTime -Descending|Select-Object -First 10|ForEach-Object{Get-Content -Raw -Encoding UTF8 $_.FullName|ConvertFrom-Json|Select-Object id,status,finishedAt}}
    else{$Result=Join-Path (Join-Path $State 'runs') "$Id.json";if(Test-Path $Result){Get-Content -Raw -Encoding UTF8 $Result}elseif(Test-Path (Join-Path (Join-Path $State 'claims') "$Id.json")){"RUNNING $Id"}elseif(Test-Path (Join-Path (Join-Path $State 'queue') "$Id.json")){"QUEUED $Id"}else{"NOT_FOUND $Id";exit 1}}
} finally {Pop-Location}
