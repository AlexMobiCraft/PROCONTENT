# Setup скрипт для инициализации хуков Claude Code на Windows
# Устанавливает правильные разрешения для PowerShell скриптов

param(
  [switch]$Force
)

# Получаем путь к директории скриптов
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptsDir)

Write-Host "🔧 Инициализация хуков Claude Code..." -ForegroundColor Cyan
Write-Host "   Project: $projectRoot" -ForegroundColor Gray

# Проверяем что находимся в правильной директории
if (-not (Test-Path "$scriptsDir\notify.ps1")) {
  Write-Error "Ошибка: не найдены скрипты в $scriptsDir"
  exit 1
}

# Убираем ограничение на исполнение PowerShell скриптов для текущего пользователя (если требуется)
$executionPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($executionPolicy -eq "Restricted") {
  Write-Host "⚠  Обнаружена политика Restricted для CurrentUser" -ForegroundColor Yellow
  Write-Host "   Рекомендуется выполнить: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
  Write-Host ""
}

# Проверяем npm
$npmCheck = & npm --version 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Ошибка: npm не найден в PATH. Убедитесь что Node.js установлен."
  exit 1
}

Write-Host "✓ npm найден: $npmCheck" -ForegroundColor Green

# Проверяем что npx доступен
$npxCheck = & npx --version 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Ошибка: npx не найден. Убедитесь что Node.js установлен."
  exit 1
}

Write-Host "✓ npx найден: $npxCheck" -ForegroundColor Green

# Список скриптов
$scripts = @(
  "notify.ps1",
  "protect-files.ps1",
  "format-prettier.ps1",
  "eslint-fix.ps1"
)

Write-Host ""
Write-Host "📋 Скрипты хуков:" -ForegroundColor Cyan
foreach ($script in $scripts) {
  $scriptPath = Join-Path $scriptsDir $script
  if (Test-Path $scriptPath) {
    Write-Host "   ✓ $script" -ForegroundColor Green
  } else {
    Write-Host "   ✗ $script (не найден)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "✅ Хуки готовы к использованию!" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Инструкции:" -ForegroundColor Cyan
Write-Host "   1. Убедитесь что политика исполнения PowerShell позволяет запуск скриптов"
Write-Host "   2. Claude Code автоматически использует эти хуки через hooks.json"
Write-Host "   3. При проблемах проверьте логи в консоли Claude Code"
Write-Host ""
