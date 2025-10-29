# Who Lies - Frontend

Frontend del juego "El Mentiroso" construido con Vite, React, TypeScript, Socket.IO y Zustand.

## 🚀 Tecnologías

- **Vite**: Build tool ultra rápido
- **React 19**: Librería de UI
- **TypeScript**: Tipado estático
- **Socket.IO Client**: Comunicación en tiempo real con el backend
- **Zustand**: Gestión de estado global simple y eficiente
- **TailwindCSS**: Framework de estilos utility-first
- **Lucide React**: Iconos modernos

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev

# Compilar para producción
npm run build

# Preview de la build de producción
npm run preview
```

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes de React
│   ├── Home.tsx        # Pantalla principal
│   ├── Lobby.tsx       # Sala de espera
│   └── CharacterReveal.tsx # Revelación de personajes
├── sockets/            # Socket.IO
│   ├── socket.ts       # Servicio de conexión
│   └── gameEvents.ts   # Funciones de eventos
├── store/              # Estado global
│   └── useGameStore.ts # Store de Zustand
├── App.tsx             # Componente principal
└── main.tsx            # Punto de entrada
```

## 🔌 Conexión con el Backend

El frontend se conecta al backend mediante Socket.IO. Asegúrate de:

1. Tener el backend corriendo en `http://localhost:3001`
2. Configurar la variable de entorno `VITE_SOCKET_URL` en el archivo `.env`

```env
VITE_SOCKET_URL=http://localhost:3001
```

## 🎮 Flujo del Juego

### 1. Pantalla Inicial (Home)
- **Crear Partida**: El host define el personaje
- **Unirse**: Los jugadores ingresan el código de sala

### 2. Sala de Espera (Lobby)
- Se muestra el código de sala para compartir
- Lista de jugadores conectados en tiempo real
- El host puede iniciar cuando hay al menos 3 jugadores

### 3. Juego (CharacterReveal)
- Cada jugador revela su personaje en secreto
- Un jugador es el "mentiroso" y no ve el personaje
- Los demás deben encontrar al mentiroso

## 🗃️ Estado Global (Zustand)

El store gestiona:

```typescript
interface GameState {
  room: Room | null              // Sala actual
  currentPlayer: Player | null   // Jugador actual
  loading: boolean               // Estado de carga
  error: string | null           // Errores
  
  // Acciones
  setRoom(room: Room): void
  setCurrentPlayer(player: Player): void
  setLoading(loading: boolean): void
  setError(error: string | null): void
  updatePlayers(players: Player[]): void
  reset(): void
}
```

## 📡 Eventos de Socket.IO

### Eventos que emitimos (cliente → servidor)

- `createRoom` - Crear una nueva sala
- `joinRoom` - Unirse a una sala existente
- `startGame` - Iniciar el juego (solo host)
- `revealCharacter` - Marcar que viste tu personaje
- `leaveRoom` - Salir de una sala

### Eventos que escuchamos (servidor → cliente)

- `roomUpdated` - La sala se actualizó (nuevo jugador, etc.)
- `gameStarted` - El juego ha comenzado
- `playerRevealed` - Un jugador reveló su personaje

## 🎨 Estilos

Usamos TailwindCSS con un tema personalizado:

- **Colores principales**: Slate (oscuro), Emerald (éxito), Red (mentiroso)
- **Efectos**: Blur, gradientes, sombras
- **Responsive**: Mobile-first

## 🔧 Scripts Disponibles

```bash
npm run dev        # Servidor de desarrollo (puerto 5173)
npm run build      # Compilar para producción
npm run preview    # Previsualizar build de producción
npm run lint       # Ejecutar ESLint
```

## 🐛 Troubleshooting

### No se conecta al backend

1. Verifica que el backend esté corriendo:
   ```bash
   curl http://localhost:3001
   ```

2. Revisa la consola del navegador para ver errores de conexión

3. Verifica que `VITE_SOCKET_URL` esté configurado correctamente

### Los jugadores no se actualizan en tiempo real

1. Abre la consola del navegador y busca:
   ```
   ✅ Connected to server
   ```

2. Si no aparece, revisa la conexión con Socket.IO

3. Verifica que los eventos estén configurados correctamente en `gameEvents.ts`

## 📝 Notas de Desarrollo

- **Hot Reload**: Vite recarga automáticamente en desarrollo
- **TypeScript**: Tipado estricto habilitado
- **ESLint**: Configurado con reglas de React y TypeScript
- **Estado Inmutable**: Zustand maneja el estado de forma inmutable

## 🚀 Deploy

Para desplegar en producción:

```bash
# Build
npm run build

# La carpeta dist/ contiene los archivos estáticos
# Puedes desplegarlos en Vercel, Netlify, etc.
```

Recuerda configurar las variables de entorno en tu plataforma de deploy:
- `VITE_SOCKET_URL` - URL del backend en producción

## 📚 Recursos

- [Documentación de Vite](https://vitejs.dev/)
- [Documentación de React](https://react.dev/)
- [Documentación de Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [Documentación de Zustand](https://zustand-demo.pmnd.rs/)
- [Documentación de TailwindCSS](https://tailwindcss.com/)
