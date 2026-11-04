# Frontend Vite + React — development (HMR) / production (build estático en Nginx).
# VITE_SOCKET_URL se embebe en build time -> se pasa como ARG por entorno.

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM base AS build
ARG VITE_SOCKET_URL=http://localhost:3001
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:80/ || exit 1
