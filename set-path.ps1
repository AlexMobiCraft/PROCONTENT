# Добавление папки проекта в PATH для текущей сессии
$env:PATH += ";c:\Users\1\DEV\PROCONTENT"

# Для постоянного добавления раскомментируйте следующую строку и запустите от имени администратора:
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
