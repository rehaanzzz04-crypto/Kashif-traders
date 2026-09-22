$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$taskName = "Kashif Traders Local Billing"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js LTS install ho raha hai..."
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
}
$nodePath = (Get-Command node).Source
$scriptPath = Join-Path $PSScriptRoot "server.mjs"
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('"' + $scriptPath + '"') -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Kashif Traders local offline billing server" -Force | Out-Null
if (-not (Get-NetFirewallRule -DisplayName "Kashif Traders Local Billing" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "Kashif Traders Local Billing" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow -Profile Private | Out-Null
}
Start-ScheduledTask -TaskName $taskName
$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1 -ExpandProperty IPAddress
Write-Host ""
Write-Host "Setup complete. Mobile/Cashier par yeh address open karein:"
Write-Host ("http://" + $ip + ":8787") -ForegroundColor Green
Write-Host "Laptop aur mobile same Wi-Fi par hone chahiye."
Read-Host "Enter press karein"

