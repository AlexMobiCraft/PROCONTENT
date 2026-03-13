#!/bin/bash
# PreToolUse: блокирует редактирование .env файлов

input=$(cat)
file=$(echo "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
fp = d.get('file_path') or d.get('tool_input', {}).get('file_path', '')
print(fp)
" 2>/dev/null)

if echo "$file" | grep -qE '\.env(\.[a-zA-Z]+)?$'; then
  echo "BLOCKED: редактирование $file запрещено — изменяйте .env файлы вручную"
  exit 2
fi
