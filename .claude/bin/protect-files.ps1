# Блокирует редактирование защищённых файлов (env, migrations, lock файлы)
# Читает JSON от Claude и проверяет путь файла

param()

# Читаем JSON из stdin
$jsonInput = $input | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($null -eq $jsonInput) {
  exit 0
}

# Извлекаем путь файла из tool_input
$filePath = $jsonInput.tool_input.file_path

if ([string]::IsNullOrEmpty($filePath)) {
  exit 0
}

# Нормализуем путь для кроссплатформенности (слеши -> backslashes)
$filePath = $filePath -replace '/', '\'

# Паттерны защищённых файлов
$protectedPatterns = @(
  "\.env",
  "\.env\.local",
  "prisma\migrations\",
  "package-lock\.json",
  "pnpm-lock\.yaml",
  "yarn\.lock",
  "\.git\"
)

foreach ($pattern in $protectedPatterns) {
  if ($filePath -match $pattern) {
    Write-Error "Заблокировано: $filePath — защищённый файл (паттерн: '$pattern')" -ErrorAction Stop
    exit 2
  }
}

exit 0
