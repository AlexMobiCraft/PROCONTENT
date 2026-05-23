# PostToolUse: авто-исправление ESLint ошибок после редактирования TS файлов

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

  # Проверяем что это TypeScript файл
  if ($filePath -notmatch '\.(ts|tsx)$') {
    exit 0
  }

  # Запускаем ESLint с флагом --fix
  Write-Host "Running ESLint on: $filePath" -ForegroundColor Cyan
  $output = & npm run lint -- --fix $filePath 2>&1

  if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ ESLint: файл $filePath проверен и исправлен" -ForegroundColor Green
  } else {
    # ESLint может вернуть код ошибки даже если файл успешно исправлен
    # Выводим предупреждение но не падаем
    Write-Host "⚠ ESLint: завершён с кодом $LASTEXITCODE" -ForegroundColor Yellow
  }
} catch {
  # Игнорируем ошибки
  Write-Host "⚠ ESLint: ошибка выполнения (игнорируется)" -ForegroundColor Yellow
}
