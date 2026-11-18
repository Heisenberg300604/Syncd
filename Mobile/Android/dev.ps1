<#
.SYNOPSIS
    Convenience alias runner for watch.ps1
.DESCRIPTION
    Runs the SyncD App continuous build, watch, and deploy runner.
#>
[CmdletBinding()]
param(
    [switch]$Once,
    [switch]$Clean,
    [switch]$ClearData,
    [switch]$Logcat,
    [string]$Device = "",
    [double]$DebounceSeconds = 2.0
)

$scriptPath = Join-Path $PSScriptRoot "watch.ps1"
& $scriptPath @PSBoundParameters

