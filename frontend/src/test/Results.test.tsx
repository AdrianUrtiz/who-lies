import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Results from '../components/Results'
import { useGameStore } from '../store/useGameStore'
import type { Room, Player, VotingResults } from '../store/useGameStore'

// gameEvents hace imports de socket al cargar el módulo; no conecta en import.
vi.mock('../sockets/gameEvents', () => ({
  continueGame: vi.fn(),
}))

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    roomId: 'r1',
    name: 'Ana',
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
    status: 'VOTING',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    currentRound: 2,
    players: [
      player({ id: 'p1', name: 'Ana' }),
      player({ id: 'p2', name: 'Beto' }),
      player({ id: 'p3', name: 'Cid' }),
    ],
    ...overrides,
  }
}

describe('Results (empate P0-T6 + i18n)', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    localStorage.clear()
  })

  it('muestra empate sin eliminado y pide revotar', () => {
    const r = room()
    useGameStore.getState().setRoom(r)
    const results: VotingResults = {
      room: r,
      eliminatedPlayer: null,
      liarCaught: false,
      liar: null,
      gameFinished: false,
      tie: true,
      tiedIds: ['p1', 'p2'],
    }
    render(
      <Results
        results={results}
        currentPlayer={player()}
        isHost={true}
        onBackToHome={() => {}}
      />
    )
    expect(screen.getByText('¡Empate!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nadie es eliminado. Vuelvan a discutir y voten de nuevo.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Jugador Eliminado')).not.toBeInTheDocument()
  })

  it('muestra eliminado inocente sin revelar al mentiroso', () => {
    const r = room()
    useGameStore.getState().setRoom(r)
    const results: VotingResults = {
      room: r,
      eliminatedPlayer: { ...player({ id: 'p2', name: 'Beto' }) },
      liarCaught: false,
      liar: null,
      gameFinished: false,
      tie: false,
    }
    render(
      <Results
        results={results}
        currentPlayer={player()}
        isHost={true}
        onBackToHome={() => {}}
      />
    )
    expect(screen.getAllByText('Beto').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('✅ Era inocente')).toBeInTheDocument()
    expect(
      screen.getByText(
        'La identidad del mentiroso sigue oculta... el juego continúa.'
      )
    ).toBeInTheDocument()
  })
})
