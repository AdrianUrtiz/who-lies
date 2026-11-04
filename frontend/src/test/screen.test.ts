import { describe, it, expect } from 'vitest'
import { getScreen } from '../game/screen'
import type { Room, Player, VotingResults } from '../store/useGameStore'

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    roomId: 'r1',
    name: 'A',
    character: 'X',
    isLiar: false,
    hasRevealed: true,
    isReady: true,
    isEliminated: false,
    isConnected: true,
    secret: 's',
    joinedAt: new Date().toISOString(),
    ...overrides,
  }
}

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    code: 'ABC123',
    hostId: 'p1',
    categoryId: 'marvel',
    status: 'WAITING',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    currentRound: 1,
    players: [player({ id: 'p1' }), player({ id: 'p2', name: 'B' })],
    ...overrides,
  }
}

function results(overrides: Partial<VotingResults> = {}): VotingResults {
  return {
    room: room({ status: 'VOTING' }),
    eliminatedPlayer: null,
    liarCaught: false,
    liar: null,
    gameFinished: false,
    ...overrides,
  }
}

describe('getScreen (P3-D5)', () => {
  it('home sin sala o sin jugador', () => {
    expect(getScreen(null, player(), null)).toBe('home')
    expect(getScreen(room(), null, null)).toBe('home')
  })

  it('FINISHED siempre gana', () => {
    expect(getScreen(room({ status: 'FINISHED' }), player(), results())).toBe(
      'gameOver'
    )
  })

  it('results tapa a VOTING/PLAYING', () => {
    expect(getScreen(room({ status: 'VOTING' }), player(), results())).toBe(
      'results'
    )
    expect(getScreen(room({ status: 'PLAYING' }), player(), results())).toBe(
      'results'
    )
  })

  it('WAITING -> lobby, VOTING -> voting', () => {
    expect(getScreen(room({ status: 'WAITING' }), player(), null)).toBe('lobby')
    expect(getScreen(room({ status: 'VOTING' }), player(), null)).toBe('voting')
  })

  it('PLAYING: reveal hasta que todos revelen+listen', () => {
    const pending = room({
      status: 'PLAYING',
      players: [
        player({ id: 'p1', hasRevealed: true, isReady: false }),
        player({ id: 'p2', name: 'B', hasRevealed: false, isReady: false }),
      ],
    })
    expect(getScreen(pending, player(), null)).toBe('characterReveal')

    const ready = room({
      status: 'PLAYING',
      players: [
        player({ id: 'p1', hasRevealed: true, isReady: true }),
        player({
          id: 'p2',
          name: 'B',
          hasRevealed: true,
          isReady: true,
        }),
      ],
    })
    expect(getScreen(ready, player(), null)).toBe('discussion')
  })

  it('PLAYING: eliminados no bloquean la discusión', () => {
    const r = room({
      status: 'PLAYING',
      players: [
        player({ id: 'p1', hasRevealed: true, isReady: true }),
        player({
          id: 'p2',
          name: 'B',
          hasRevealed: false,
          isReady: false,
          isEliminated: true,
        }),
      ],
    })
    expect(getScreen(r, player(), null)).toBe('discussion')
  })
})
