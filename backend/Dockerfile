# Backend NestJS — multi-stage: development (hot-reload) / production (no-root + migraciones).
#-Prisma necesita openssl/libc6-compat en Alpine.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# --- Dependencias (cacheable: solo se invalida si cambia package-lock o prisma) ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# --- Desarrollo: código via bind-mount (compose), arranque con watch ---
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY src ./src
COPY tsconfig*.json nest-cli.json ./
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# --- Build de producción ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Producción: imagen mínima, usuario no-root, migraciones en entrypoint ---
# NOTA: se copia node_modules completo (incluye CLI de prisma para `migrate deploy`).
# Optimización futura: job de migraciones separado + `npm prune --omit=dev`.
FROM node:22-alpine AS production
RUN apk add --no-cache openssl libc6-compat wget
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER nestjs
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
# Sin ruta HTTP raíz (AppController no registrado): salud vía handshake polling de Socket.IO.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider 'http://localhost:3001/socket.io/?EIO=4&transport=polling' || exit 1
