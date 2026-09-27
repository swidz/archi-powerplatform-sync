param(
    [string]$ScriptsDirectory = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Archi/scripts')
)
$ErrorActionPreference = 'Stop'
$taskPackage = Split-Path -Parent $PSScriptRoot
$taskScripts = [IO.Path]::GetFullPath($ScriptsDirectory)
$taskDestination = [IO.Path]::GetFullPath((Join-Path $taskScripts 'archi-powerplatform-sync'))
if(!(($taskDestination + [IO.Path]::DirectorySeparatorChar).StartsWith($taskScripts.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))){throw 'Installation path must remain under ScriptsDirectory.'}
New-Item -ItemType Directory -Force -Path $taskDestination | Out-Null
foreach($taskFolder in @('lib','scripts','docs')){
    $taskTarget = Join-Path $taskDestination $taskFolder
    New-Item -ItemType Directory -Force -Path $taskTarget | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $taskPackage $taskFolder) -File | Copy-Item -Destination $taskTarget -Force
}
$taskConfig = Join-Path $taskDestination 'config'
New-Item -ItemType Directory -Force -Path $taskConfig | Out-Null
if(!(Test-Path -LiteralPath (Join-Path $taskConfig 'settings.js'))){Copy-Item -LiteralPath (Join-Path $taskPackage 'config/settings.js') -Destination $taskConfig}
Copy-Item -LiteralPath (Join-Path $taskPackage 'README.md') -Destination $taskDestination -Force
Write-Output "Installed to $taskDestination. Existing settings.js was preserved. Refresh the jArchi Scripts tree."
