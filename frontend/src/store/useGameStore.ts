import { create } from 'zustand'

export interface PublicPlayer {
  id: string
  roomId: string
  name: string
  hasRevealed: boolean
  isReady: boolean
  isEliminated: boolean
  // P1-B2: presencia (false = desconectado en gracia o sin socket).
  isConnected: boolean
  joinedAt: string
}

// P0-T2: rol privado. Solo viaja al dueño (ACK / yourPlayerUpdated) o en
// salas FINISHED. El broadcast usa PublicPlayer (sin isLiar/character).
export interface PrivatePlayer extends PublicPlayer {
  isLiar: boolean
  character: string | null
  // P2-T4: secreto del asiento (solo ACK/canal privado, nunca broadcast).
  secret: string
}

/** Alias histórico: el jugador propio siempre es privado. */
export type Player = PrivatePlayer

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
  // P1-B4: el TTL de FINISHED se mide desde aquí.
  finishedAt: string | null
  currentRound: number
  // P0-T2: vista pública. En FINISHED el servidor incluye isLiar/character.
  players: PublicPlayer[]
  votes?: Vote[]
}

export interface VotingResults {
  room: Room
  // P0-T6: en empate no hay eliminado.
  eliminatedPlayer: PublicPlayer | null
  liarCaught: boolean
  // P0-T2: solo se revela cuando termina (o fue cazado); si no, null.
  liar: PrivatePlayer | null
  gameFinished: boolean
  tie?: boolean
  tiedIds?: string[]
}

interface GameState {
  // Estado
  room: Room | null
  currentPlayer: Player | null
  loading: boolean
  error: string | null
  connected: boolean
  votingResults: VotingResults | null

  // Acciones
  setRoom: (room: Room) => void
  setCurrentPlayer: (player: Player) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setConnected: (connected: boolean) => void
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
  connected: true,
  votingResults: null,

  // Acciones
  setRoom: (room) => set({ room }),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setConnected: (connected) => set({ connected }),

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
