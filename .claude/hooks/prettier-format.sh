#!/bin/bash
# PostToolUse: авто-форматирование файла через Prettier

input=$(cat)
file=$(echo "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
fp = d.get('file_path') or d.get('tool_input', {}).get('file_path', '')
print(fp)
" 2>/dev/null)

if [ -z "$file" ]; then
  exit 0
fi

if echo "$file" | grep -qE '\.(ts|tsx|js|jsx|css|json)$'; then
  cd /c/Users/1/DEV/PROCONTENT
  result=$(npx prettier --write "$file" 2>&1)
  if [ $? -eq 0 ]; then
    echo "Prettier: $file отформатирован"
  else
    echo "Prettier error: $result"
  fi
fi
