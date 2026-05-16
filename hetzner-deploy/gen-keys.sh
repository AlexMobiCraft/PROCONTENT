#!/bin/bash
# Генерация ключей для self-hosted Supabase
# Запуск: bash gen-keys.sh

set -e

echo "=== Генерация ключей для self-hosted Supabase ==="

# Пароли
POSTGRES_PASSWORD=$(openssl rand -hex 32)
DASHBOARD_PASSWORD=$(openssl rand -hex 16)

# JWT секрет (32 байта = 64 hex символа)
JWT_SECRET=$(openssl rand -hex 32)

# Secret key base для realtime
SECRET_KEY_BASE=$(openssl rand -hex 32)

# Vault enc key
VAULT_ENC_KEY=$(openssl rand -hex 32)

# Logflare токены
LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 32)
LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 32)

# Crypto key
PG_META_CRYPTO_KEY=$(openssl rand -hex 32)

# Генерация JWT токенов (HS256) через Python без внешних зависимостей
python3 << 'PYEOF'
import hmac, hashlib, base64, json, sys

def b64encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def make_jwt(secret, payload):
    header = b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64encode(json.dumps(payload).encode())
    msg = f"{header}.{body}"
    sig = b64encode(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
    return f"{msg}.{sig}"

# Читаем JWT_SECRET из переменной окружения или генерируем новый
import os
secret = os.environ.get('JWT_SECRET', '')
if not secret:
    import secrets
    secret = secrets.token_hex(32)

anon_key = make_jwt(secret, {"role": "anon"})
service_key = make_jwt(secret, {"role": "service_role"})

print(f"JWT_SECRET={secret}")
print(f"ANON_KEY={anon_key}")
print(f"SERVICE_ROLE_KEY={service_key}")
PYEOF

echo ""
echo "=== Скопируйте эти значения в файл .env ==="
echo ""
