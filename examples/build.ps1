param(
  [Parameter(Mandatory)][string]$TvIp,
  [Parameter(Mandatory)][string]$Target,
  [string]$SecurityProfile = 'MyHome',
  [string]$TizenStudio = 'C:\tizen-studio',
  [switch]$NoInstall
)
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'src'
$stage = Join-Path $PSScriptRoot 'build\stage'
$out = Join-Path $PSScriptRoot 'build\out'
$tizen = Join-Path $TizenStudio 'tools\ide\bin\tizen.bat'
$sdb = Join-Path $TizenStudio 'tools\sdb.exe'

New-Item -ItemType Directory -Force $stage, $out | Out-Null
robocopy $src $stage /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS /NC /NS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

& $tizen package -t wgt -s $SecurityProfile -o $out -- $stage | Select-Object -Last 1
$wgt = Get-ChildItem $out -Filter *.wgt | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$clean = ($wgt.BaseName -replace '\s', '') + '.wgt'
if ($wgt.Name -ne $clean) { Move-Item $wgt.FullName (Join-Path $out $clean) -Force }
if ($NoInstall) { return }

& $sdb connect "${TvIp}:26101" | Out-Null
& $tizen install -n $clean -t $Target -- $out | Select-Object -Last 2
