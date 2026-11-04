// P1-B1: sesión persistente para rejoin tras F5 (sessionStorage: muere
// con la pestaña, no deja asientos reclamables en otros navegadores).

export interface GameSession {
  roomId: string
  playerId: string
  code: string
  // P2-T4: prueba de titularidad del asiento (solo ACK/canal privado).
  secret: string
}

const KEY = 'who-lies-session'

export function saveSession(s: GameSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage lleno/bloqueado: el juego sigue sin rejoin.
  }
}

export function loadSession(): GameSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<GameSession>
    if (
      typeof s.roomId === 'string' &&
      typeof s.playerId === 'string' &&
      typeof s.code === 'string' &&
      typeof s.secret === 'string'
    ) {
      return {
        roomId: s.roomId,
        playerId: s.playerId,
        code: s.code,
        secret: s.secret,
      }
    }
    return null
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // noop
  }
}
