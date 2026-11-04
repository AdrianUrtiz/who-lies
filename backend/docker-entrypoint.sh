#!/bin/sh
# Entrypoint de producción: aplica migraciones y luego arranca Nest.
# `exec` preserva señales (SIGTERM) para apagado limpio.
set -eu

echo "→ Running Prisma migrations..."
npx prisma migrate deploy

echo "→ Starting backend..."
exec node dist/main
