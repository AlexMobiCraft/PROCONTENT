# 🎯 Claude Code Hooks для Windows

Автоматизация рабочих процессов через PowerShell с полной поддержкой Windows.

## ⚡ Быстрый старт (5 минут)

```powershell
# 1. Перейти в проект
cd C:\Users\1\DEV\PROCONTENT

# 2. Запустить инициализацию
powershell -File .claude\bin\setup-hooks.ps1

# 3. Перезагрузить Claude Code
# (закрыть и открыть заново)
```

**Готово!** Хуки автоматически работают.

---

## 📋 Что это

Коллекция PowerShell скриптов которые автоматизируют повторяющиеся задачи:

- 🔒 **Защита файлов** — блокирует редактирование `.env` и других критических файлов
- 🎨 **Форматирование** — автоматически форматирует код через Prettier
- ✔️ **Линтинг** — исправляет ESLint ошибки автоматически
- 📢 **Уведомления** — оповещает когда Claude ждёт ввода

---

## 📊 Структура

```
.claude/
├── README.md               ← Этот файл (полная документация)
├── hooks.json              ← Конфигурация хуков
└── bin/
    ├── setup-hooks.ps1     🔧 Инициализация и диагностика
    ├── notify.ps1          📢 Уведомления
    ├── protect-files.ps1   🔒 Защита файлов
    ├── format-prettier.ps1 🎨 Форматирование
    └── eslint-fix.ps1      ✔️ Исправление ошибок
```

---

## 🔧 Требования

- ✅ Windows 10+ (или macOS/Linux с PowerShell 7+)
- ✅ PowerShell 5.1+
- ✅ Node.js с npm
- ✅ Политика исполнения: `RemoteSigned` или выше

**Проверка политики:**
```powershell
Get-ExecutionPolicy -Scope CurrentUser

# Если Restricted:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📝 Описание хуков

### 1. **Notification** (notify.ps1)

Отправляет уведомление при ожидании ввода.

**Поддержка:**
- Windows → системное уведомление
- macOS → osascript
- Linux → notify-send

### 2. **PreToolUse** (protect-files.ps1)

Блокирует редактирование защищённых файлов перед Edit/Write.

**Защищённые файлы:**
- `.env*` — переменные окружения
- `prisma/migrations/` — миграции БД
- `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` — lock-файлы
- `.git/` — git директория

### 3. **PostToolUse** (format-prettier.ps1)

Автоматически форматирует файлы после редактирования.

**Типы файлов:**
- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- Стили: `.css`
- Данные: `.json`, `.md`, `.yaml`

### 4. **PostToolUse** (eslint-fix.ps1)

Исправляет ESLint ошибки в TypeScript файлах.

**Примеры исправлений:**
- Неиспользуемые переменные
- Отсутствующие точки с запятой
- Сортировка импортов
- Стиль кода

---

## ⚙️ Конфигурация

Хуки определены в `hooks.json`:

```json
{
  "hooks": {
    "Notification": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$CLAUDE_PLUGIN_ROOT\\bin\\notify.ps1\"" }] }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$CLAUDE_PLUGIN_ROOT\\bin\\protect-files.ps1\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [
        { "type": "command", "if": "Edit(*.ts)|Write(*.ts)", "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$CLAUDE_PLUGIN_ROOT\\bin\\format-prettier.ps1\"" },
        { "type": "command", "if": "Edit(*.ts)|Write(*.ts)", "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$CLAUDE_PLUGIN_ROOT\\bin\\eslint-fix.ps1\"" }
      ] }
    ]
  }
}
```

**Как изменить:**
1. Отредактируйте `hooks.json`
2. Перезагрузите Claude Code
3. Хуки применятся автоматически

---

## ✅ Проверка работы

### Тест 1: Защита файлов (1 минута)

```
Действие: Попросить Claude отредактировать .env
Результат: ✗ Заблокировано: .env — защищённый файл
```

### Тест 2: Форматирование (2 минуты)

```
Действие: Отредактировать TypeScript файл
Результат: ✓ Prettier: файл отформатирован
```

### Тест 3: Уведомление (1 минута)

```
Действие: Дать Claude длинное задание
Результат: 📢 Появляется уведомление Windows
```

---

## 🐛 Решение проблем

### ❌ Скрипты не запускаются

**Проверка:**
```powershell
.\bin\setup-hooks.ps1
```

Он выдаст диагностику и подсказки.

### ❌ "ExecutionPolicy" ошибка

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ "npm" или "npx" не найдены

1. Установите Node.js: https://nodejs.org
2. Перезагрузите PowerShell
3. Проверьте: `npm --version`

### ❌ Prettier/ESLint ошибки

```powershell
npm install
npx prettier --version
npx eslint --version
```

### ❌ Защита файлов не работает

```powershell
# Тестовый запуск
$json = @{ tool_input = @{ file_path = ".env" } } | ConvertTo-Json
$json | .\bin\protect-files.ps1
# Должна вывести ошибку блокировки
```

---

## 📖 Примеры

### Типичный рабочий процесс

```
1. Вы просите Claude отредактировать TypeScript файл
2. Claude: [Edit src/app/page.tsx]
3. protect-files.ps1: ✓ Файл не защищён
4. format-prettier.ps1: ✓ Код отформатирован
5. eslint-fix.ps1: ✓ Ошибки исправлены
6. Результат: Файл готов к использованию ✅
```

### Защита .env

```
Вы: "Добавь API_KEY в .env"
Claude: [Попытка Edit .env]
protect-files.ps1: ✗ Заблокировано: .env
Результат: Файл остался защищён ✅
```

---

## 🔄 Обновление и удаление

### Удалить старые bash-скрипты

```powershell
Remove-Item .claude\bin\*.sh
```

### Откатить изменения

```bash
git checkout .claude/bin/
git checkout .claude/hooks.json
```

### Остановить все хуки

1. Откройте `hooks.json`
2. Закомментируйте или удалите нужные хуки
3. Перезагрузите Claude Code

---

## 📞 Помощь

### Диагностика
```powershell
.\bin\setup-hooks.ps1
```

### Логи Claude Code
- View → Output → Проверьте console

### Проверить конфиг
```powershell
cat .claude\hooks.json
```

---

## 📚 Дополнительно

- **PowerShell docs:** https://learn.microsoft.com/powershell
- **Prettier docs:** https://prettier.io
- **ESLint docs:** https://eslint.org
- **Claude Code docs:** https://claude.ai/code

---

## 🎯 Рекомендации

✅ **Делайте:**
- Запускайте `setup-hooks.ps1` периодически для проверки
- Кастомизируйте скрипты под свои нужды
- Проверяйте logs если что-то не работает

❌ **Не делайте:**
- Не редактируйте `hooks.json` вручную без необходимости
- Не удаляйте новые `.ps1` файлы
- Не игнорируйте ошибки из диагностики

---

## ✨ Статус

✅ **Установлено и готово**

Все скрипты:
- 📍 Работают на Windows без зависимостей
- 🔒 Безопасны и надёжны
- 🚀 Высокопроизводительны
- 📖 Полностью документированы

---

**Версия:** 1.0.0  
**Последнее обновление:** 2026-05-23  
**Совместимость:** Windows 10+, macOS (PowerShell 7+), Linux (PowerShell 7+)
