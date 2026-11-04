import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../store/useGameStore'
import type { Room, Player, VotingResults } from '../store/useGameStore'

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    roomId: 'r1',
    name: 'A',
    character: 'Iron Man',
    isLiar: false,
    hasRevealed: false,
    isReady: false,
    isEliminated: false,
    isConnected: true,
    secret: 's1',
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
    players: [player()],
    ...overrides,
  }
}

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('setRoom / setCurrentPlayer / setVotingResults / reset', () => {
    const st = useGameStore.getState()
    const r = room()
    const p = player()
    st.setRoom(r)
    st.setCurrentPlayer(p)
    expect(useGameStore.getState().room?.id).toBe('r1')
    expect(useGameStore.getState().currentPlayer?.id).toBe('p1')

    const results: VotingResults = {
      room: r,
      eliminatedPlayer: null,
      liarCaught: false,
      liar: null,
      gameFinished: false,
      tie: true,
      tiedIds: ['p1', 'p2'],
    }
    st.setVotingResults(results)
    expect(useGameStore.getState().votingResults?.tie).toBe(true)

    st.reset()
    const clean = useGameStore.getState()
    expect(clean.room).toBeNull()
    expect(clean.currentPlayer).toBeNull()
    expect(clean.votingResults).toBeNull()
    expect(clean.error).toBeNull()
    expect(clean.loading).toBe(false)
  })

  it('setConnected refleja online/offline', () => {
    useGameStore.getState().setConnected(false)
    expect(useGameStore.getState().connected).toBe(false)
    useGameStore.getState().setConnected(true)
    expect(useGameStore.getState().connected).toBe(true)
  })

  it('setLoading / setError', () => {
    const st = useGameStore.getState()
    st.setLoading(true)
    st.setError('ROOM_NOT_FOUND')
    expect(useGameStore.getState().loading).toBe(true)
    expect(useGameStore.getState().error).toBe('ROOM_NOT_FOUND')
  })
})
