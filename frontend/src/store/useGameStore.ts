import { create } from 'zustand'

export interface Player {
  id: string
  roomId: string
  name: string
  character?: string | null
  isLiar: boolean
  hasRevealed: boolean
  isReady: boolean
  isEliminated: boolean
  joinedAt: string
}

export interface Vote {
  id: string
  roomId: string
  voterId: string
  votedForId: string
  round: number
  createdAt: string
}

export interface Room {
  id: string
  code: string
  hostId: string
  categoryId: string
  status: 'WAITING' | 'PLAYING' | 'VOTING' | 'FINISHED'
  createdAt: string
  startedAt: string | null
  currentRound: number
  players: Player[]
  votes?: Vote[]
}

export interface VotingResults {
  room: Room
  eliminatedPlayer: Player
  liarCaught: boolean
  liar: Player
  gameFinished: boolean
}

interface GameState {
  // Estado
  room: Room | null
  currentPlayer: Player | null
  loading: boolean
  error: string | null
  votingResults: VotingResults | null

  // Acciones
  setRoom: (room: Room) => void
  setCurrentPlayer: (player: Player) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updatePlayers: (players: Player[]) => void
  setVotingResults: (results: VotingResults | null) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  // Estado inicial
  room: null,
  currentPlayer: null,
  loading: false,
  error: null,
  votingResults: null,

  // Acciones
  setRoom: (room) => set({ room }),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  updatePlayers: (players) =>
    set((state) => ({
      room: state.room ? { ...state.room, players } : null,
    })),

  setVotingResults: (results) => set({ votingResults: results }),

  reset: () =>
    set({
      room: null,
      currentPlayer: null,
      loading: false,
      error: null,
      votingResults: null,
    }),
}))
