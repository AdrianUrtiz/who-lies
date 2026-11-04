import { describe, it, expect } from 'vitest'
import { saveSession, loadSession, clearSession } from '../sockets/session'

describe('session (P3-B1)', () => {
  it('guarda y carga la sesión', () => {
    saveSession({
      roomId: 'r1',
      playerId: 'p1',
      code: 'ABC123',
      secret: 's3cr3t',
    })
    expect(loadSession()).toEqual({
      roomId: 'r1',
      playerId: 'p1',
      code: 'ABC123',
      secret: 's3cr3t',
    })
  })

  it('sin sesión retorna null', () => {
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('sesión incompleta (pre-P2, sin secreto) se descarta', () => {
    sessionStorage.setItem(
      'who-lies-session',
      JSON.stringify({ roomId: 'r', playerId: 'p', code: 'ABC123' })
    )
    expect(loadSession()).toBeNull()
  })

  it('JSON corrupto se descarta sin romper', () => {
    sessionStorage.setItem('who-lies-session', '{no-json')
    expect(loadSession()).toBeNull()
  })

  it('clearSession limpia', () => {
    saveSession({ roomId: 'r', playerId: 'p', code: 'C', secret: 's' })
    clearSession()
    expect(sessionStorage.getItem('who-lies-session')).toBeNull()
  })
})
