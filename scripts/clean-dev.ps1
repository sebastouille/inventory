param(
  [switch]$IncludeInfra
)

$applicationPorts = @(3010, 3011, 3014)
$infrastructurePorts = @(5560, 1035, 8035)
$ports = if ($IncludeInfra) { $applicationPorts + $infrastructurePorts } else { $applicationPorts }

$connections = foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
}

if (-not $connections) {
  Write-Output "Aucun process en ecoute sur les ports cibles : $($ports -join ', ')"
  exit 0
}

$pids = $connections |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -and $_ -gt 0 }

foreach ($processId in $pids) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  $processPorts = $connections |
    Where-Object { $_.OwningProcess -eq $processId } |
    Select-Object -ExpandProperty LocalPort -Unique |
    Sort-Object

  Write-Output ("Arret PID {0} ({1}) sur ports {2}" -f $process.Id, $process.ProcessName, ($processPorts -join ", "))
  Stop-Process -Id $process.Id -Force
}

Write-Output "Nettoyage termine."
