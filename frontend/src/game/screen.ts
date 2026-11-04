import type { Room, Player, VotingResults } from '../store/useGameStore'

export type GameScreen =
  | 'home'
  | 'lobby'
  | 'characterReveal'
  | 'discussion'
  | 'voting'
  | 'results'
  | 'gameOver'

/** Lógica pura de navegación por estado (testeable sin React). */
export function getScreen(
  room: Room | null,
  currentPlayer: Player | null,
  votingResults: VotingResults | null
): GameScreen {
  if (!room || !currentPlayer) return 'home'

  // Si el juego ha terminado (FINISHED), mostrar pantalla GameOver
  if (room.status === 'FINISHED') return 'gameOver'

  // Si hay resultados de votación, mostrar pantalla de resultados
  if (votingResults) return 'results'

  // Si la sala está en estado de espera, mostrar lobby
  if (room.status === 'WAITING') return 'lobby'

  // Si la sala está en votación, mostrar pantalla de votación
  if (room.status === 'VOTING') return 'voting'

  // Si el juego está en curso
  if (room.status === 'PLAYING') {
    // Verificar si todos los jugadores activos han revelado y están listos
    const activePlayers = room.players.filter((p) => !p.isEliminated)
    const allRevealed = activePlayers.every((p) => p.hasRevealed)
    const allReady = activePlayers.every((p) => p.isReady)

    // Si todos revelaron y están listos, pasar a la fase de discusión
    if (allRevealed && allReady) {
      return 'discussion'
    }

    // Si no todos revelaron o no están listos, mostrar pantalla de revelación
    return 'characterReveal'
  }

  return 'home'
}
