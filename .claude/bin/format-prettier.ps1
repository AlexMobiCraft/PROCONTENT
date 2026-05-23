# PostToolUse: авто-форматирование файла через Prettier
# Работает кроссплатформенно на Windows, macOS и Linux

param()

# Получаем JSON из stdin
$jsonInput = @()
$input | ForEach-Object { $jsonInput += $_ }
$jsonText = $jsonInput -join "`n"

if ([string]::IsNullOrEmpty($jsonText)) {
  exit 0
}

try {
  $json = $jsonText | ConvertFrom-Json -ErrorAction SilentlyContinue
  if ($null -eq $json) {
    exit 0
  }

  # Извлекаем путь файла
  $filePath = $json.tool_input.file_path
  if ([string]::IsNullOrEmpty($filePath)) {
    exit 0
  }

  # Проверяем расширение файла
  if ($filePath -notmatch '\.(ts|tsx|js|jsx|css|json|md|yaml|yml)$') {
    exit 0
  }

  # Получаем переменную окружения PROJECT_ROOT или используем текущую директорию
  $projectRoot = if ([string]::IsNullOrEmpty($env:PROJECT_ROOT)) {
    Get-Location | Select-Object -ExpandProperty Path
  } else {
    $env:PROJECT_ROOT
  }

  # Запускаем Prettier
  $output = & npx prettier --write $filePath 2>&1

  if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prettier: $filePath отформатирован" -ForegroundColor Green
  } else {
    Write-Error "✗ Prettier error: $output"
  }
} catch {
  # Игнорируем ошибки при парсинге JSON
  exit 0
}
