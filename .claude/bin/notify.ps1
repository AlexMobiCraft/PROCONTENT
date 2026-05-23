# Отправляет уведомление пользователю при ожидании ввода
# Кроссплатформенный скрипт для Windows, macOS и Linux

$title = "Claude Code"
$message = "Claude ждёт вашего ввода"

# Определяем ОС
if ($IsWindows -or [Environment]::OSVersion.Platform -eq "Win32NT") {
  # Windows: используем встроенное уведомление
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $notification = New-Object System.Windows.Forms.NotifyIcon
    $notification.Icon = [System.Drawing.SystemIcons]::Information
    $notification.Visible = $true
    $notification.ShowBalloonTip(5000, $title, $message, "Info")
    Start-Sleep -Seconds 6
    $notification.Dispose()
  } catch {
    # Fallback: вывести в консоль если уведомление не удалось
    Write-Host "[$title] $message" -ForegroundColor Yellow
  }
} elseif ($IsMacOS -or $PSVersionTable.OS -like "*Darwin*") {
  # macOS: используем osascript
  osascript -e "display notification `"$message`" with title `"$title`""
} else {
  # Linux: используем notify-send
  notify-send $title $message
}
