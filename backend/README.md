# Who Lies - Backend

Backend del juego "El Mentiroso" construido con NestJS, Socket.IO y Prisma.

## 🚀 Tecnologías

- **NestJS**: Framework de Node.js
- **Socket.IO**: Comunicación en tiempo real
- **Prisma**: ORM para PostgreSQL
- **PostgreSQL**: Base de datos
- **TypeScript**: Lenguaje principal

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar PostgreSQL con Docker
docker-compose up -d

# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# (Opcional) Abrir Prisma Studio
npx prisma studio
```

## 🏃‍♂️ Ejecución

```bash
# Modo desarrollo
npm run start:dev

# Modo producción
npm run build
npm run start:prod
```

## 🌐 Endpoints de Socket.IO

### `createRoom`
Crea una nueva sala de juego.
```typescript
socket.emit('createRoom', {
  hostId: string,
  characterName: string
});
```

### `joinRoom`
Unirse a una sala existente.
```typescript
socket.emit('joinRoom', {
  code: string,
  playerName: string
});
```

### `startGame`
Iniciar el juego (solo el host).
```typescript
socket.emit('startGame', {
  roomId: string
});
```

### `revealCharacter`
Revelar el personaje de un jugador.
```typescript
socket.emit('revealCharacter', {
  playerId: string,
  roomId: string
});
```

### `leaveRoom`
Salir de una sala.
```typescript
socket.emit('leaveRoom', {
  roomId: string
});
```

## 📡 Eventos del servidor

- `roomUpdated`: Se emite cuando la sala se actualiza (nuevo jugador, etc.)
- `gameStarted`: Se emite cuando el juego comienza
- `playerRevealed`: Se emite cuando un jugador revela su personaje

## 🗄️ Estructura del proyecto

```
backend/
├── src/
│   ├── prisma/           # Módulo de Prisma
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── rooms/            # Módulo de salas
│   │   ├── rooms.module.ts
│   │   ├── rooms.service.ts
│   │   └── rooms.gateway.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma     # Esquema de la base de datos
├── docker-compose.yml    # PostgreSQL con Docker
└── .env                  # Variables de entorno
```

## 🔧 Variables de entorno

Crear un archivo `.env` en la raíz:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/who_lies?schema=public"
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## 📝 Notas

- El backend corre en el puerto `3001` por defecto
- PostgreSQL corre en el puerto `5432`
- Las migraciones de Prisma se ejecutan automáticamente con `prisma migrate dev`
