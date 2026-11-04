# 🎮 Who Lies - El Mentiroso

Un juego interactivo multijugador en tiempo real inspirado en juegos de deducción social. Un jugador es el "mentiroso" y no conoce el personaje asignado, mientras los demás deben descubrirlo sin revelarlo.

## 🌟 Características

- ✅ **Tiempo Real**: Comunicación instantánea con Socket.IO
- ✅ **Multi-dispositivo**: Juega desde cualquier dispositivo
- ✅ **Persistencia**: Datos guardados en PostgreSQL
- ✅ **Escalable**: Múltiples salas simultáneas
- ✅ **Interfaz Moderna**: UI elegante con TailwindCSS
- ✅ **TypeScript**: Tipado completo en frontend y backend

## 🏗️ Arquitectura

```
┌─────────────────┐                           ┌─────────────────┐
│    Frontend     │    Socket.IO (WebSocket)  │    Backend      │
│  Vite + React   │ ←─────────────────────→  │     NestJS      │
│    + Zustand    │                           │  + Socket.IO    │
└─────────────────┘                           └─────────────────┘
                                                       ↓
                                              ┌─────────────────┐
                                              │   PostgreSQL    │
                                              │  (via Prisma)   │
                                              └─────────────────┘
```

## 📦 Tecnologías

### Backend
- **NestJS** - Framework de Node.js
- **Socket.IO** - WebSockets en tiempo real
- **Prisma** - ORM para PostgreSQL
- **PostgreSQL** - Base de datos relacional
- **TypeScript** - Tipado estático

### Frontend
- **Vite** - Build tool ultra rápido
- **React 19** - Librería de UI
- **Socket.IO Client** - Cliente WebSocket
- **Zustand** - Estado global minimalista
- **TailwindCSS** - Framework de estilos
- **TypeScript** - Tipado estático

## �� Cómo Jugar

1. **Crear Partida**
   - El host define una categoria y el personaje escogido al azar
   - Se genera un código de sala único (ej: "ABC123")

2. **Unirse**
   - Los jugadores ingresan el código de sala
   - Mínimo 3 jugadores para empezar

3. **Juego**
   - Todos ven su personaje asignado en secreto
   - Un jugador es el "mentiroso" y NO ve el personaje
   - Los jugadores hacen preguntas sobre el personaje
   - El mentiroso intenta descubrir cuál es el personaje
   - Los demás intentan descubrir quién es el mentiroso

4. **Victoria**
   - Los jugadores ganan si descubren al mentiroso
   - El mentiroso gana si sobrevive hasta el final sin ser descubierto

## 📁 Estructura del Proyecto

```
who-lies/
├── backend/                # NestJS + Socket.IO + Prisma
│   ├── src/
│   │   ├── prisma/        # Módulo de Prisma
│   │   ├── rooms/         # Lógica de salas (Gateway + Service)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma  # Esquema de BD
│   ├── Dockerfile         # Multi-stage: development / production
│   └── docker-entrypoint.sh # migrate deploy + arranque (prod)
│
├── frontend/              # Vite + React + TypeScript
│   ├── src/
│   │   ├── components/   # Componentes de React
│   │   ├── sockets/      # Socket.IO client
│   │   ├── store/        # Zustand store
│   │   └── App.tsx
│   ├── Dockerfile        # Multi-stage: development / Nginx prod
│   ├── nginx.conf        # SPA fallback + caché (prod)
│   └── .env
│
├── compose.yml           # Dev: postgres + backend + frontend
├── compose.prod.yml      # Override prod (sin volúmenes, sin exponer DB)
├── .env.development      # Secretos dev (valores seguros)
├── .env.production.example # Plantilla para el servidor
└── README.md             # Este archivo
```

## 🌐 URLs en desarrollo

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Prisma Studio**: Ejecutar `npx prisma studio` en `/backend`

## 📝 Comandos Útiles

### Docker (flujo recomendado)

```bash
# Desarrollo: postgres + backend (hot-reload) + frontend (HMR)
docker compose --env-file .env.development up --build

# Aplicar migraciones (primera vez o al cambiar prisma/schema)
docker compose --env-file .env.development exec backend npx prisma migrate deploy

# Producción en servidor propio:
# 1. cp .env.production.example .env.production && editar secretos
# 2. VITE_SOCKET_URL se embebe en el build -> rebuild por entorno
docker compose --env-file .env.production -f compose.yml -f compose.prod.yml up -d --build
```

### Backend (nativo, sin Docker para app; DB sí en Docker)

```bash
# Levantar solo postgres desde la raíz
docker compose --env-file .env.development up -d postgres

cd backend

# Desarrollo
npm run start:dev

# Prisma
npx prisma studio          # Abrir interfaz de BD
npx prisma migrate dev     # Ejecutar migraciones
npx prisma generate        # Generar cliente

# Docker (desde la raíz del repo)
docker compose --env-file .env.development up -d   # Iniciar PostgreSQL
docker compose --env-file .env.development down    # Detener PostgreSQL
```

### Frontend

```bash
cd frontend

# Desarrollo
npm run dev

# Build
npm run build
npm run preview
```

## 🐛 Solución de Problemas

### PostgreSQL no inicia

```bash
# ⚠️ down -v BORRA los datos de la DB (volumen postgres_data)
docker compose --env-file .env.development down -v
docker compose --env-file .env.development up -d postgres
```

### Error de conexión Socket.IO

1. Verifica que el backend esté corriendo: `curl http://localhost:3001`
2. Revisa la consola del navegador para errores
3. Verifica `VITE_SOCKET_URL` en `frontend/.env`

### Prisma no conecta

```bash
cd backend
docker ps  # Verificar que PostgreSQL esté corriendo
npx prisma generate
npx prisma migrate dev
```

## 📚 Documentación

- [SETUP.md](./SETUP.md) - Guía completa de instalación
- [backend/README.md](./backend/README.md) - Documentación del backend
- [frontend/README.md](./frontend/README.md) - Documentación del frontend
- [frontend/CHANGELOG.md](./frontend/CHANGELOG.md) - Historial de cambios

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

## 🙏 Agradecimientos

Inspirado en juegos de deducción social como:
- The Spyfall
- Werewolf
- Among Us

---

**Desarrollado con ❤️ usando NestJS, React y Socket.IO**
