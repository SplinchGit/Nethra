param([Parameter(Mandatory=$true)][string]$Executable,[string]$HostArguments='--agent-host',[ValidateSet('true','false')][string]$Enabled='true')
$ErrorActionPreference='Stop'
$nethraUser=[Security.Principal.WindowsIdentity]::GetCurrent()
$nethraTaskName='Nethra '+$nethraUser.User.Value
if($Enabled -eq 'false'){
  Unregister-ScheduledTask -TaskName $nethraTaskName -Confirm:$false -ErrorAction SilentlyContinue
  exit 0
}
if(-not(Test-Path -LiteralPath $Executable -PathType Leaf)){throw 'Nethra executable was not found'}
$nethraAction=New-ScheduledTaskAction -Execute $Executable -Argument $HostArguments -WorkingDirectory (Split-Path -LiteralPath $Executable)
$nethraLogon=New-ScheduledTaskTrigger -AtLogOn -User $nethraUser.Name
$nethraRecovery=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$nethraSettings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$nethraPrincipal=New-ScheduledTaskPrincipal -UserId $nethraUser.Name -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nethraTaskName -Action $nethraAction -Trigger @($nethraLogon,$nethraRecovery) -Settings $nethraSettings -Principal $nethraPrincipal -Description 'Runs your paired local Nethra host after Windows sign-in. No model inference occurs while objectives are waiting.' -Force | Out-Null
