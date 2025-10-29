import { useEffect } from 'react'
import Home from './components/Home'
import Lobby from './components/Lobby'
import CharacterReveal from './components/CharacterReveal'
import Discussion from './components/Discussion'
import Voting from './components/Voting'
import Results from './components/Results'
import GameOver from './components/GameOver'
import { useGameStore } from './store/useGameStore'
import { socketService } from './sockets/socket'
import {
  setupGameEvents,
  cleanupGameEvents,
  createRoom,
  joinRoom,
} from './sockets/gameEvents'

type GameScreen =
  | 'home'
  | 'lobby'
  | 'characterReveal'
  | 'discussion'
  | 'voting'
  | 'results'
  | 'gameOver'

function App() {
  const {
    room,
    currentPlayer,
    loading,
    error,
    votingResults,
    setRoom,
    setCurrentPlayer,
    setLoading,
    setError,
    reset,
  } = useGameStore()

  useEffect(() => {
    // Conectar al servidor Socket.IO
    socketService.connect()

    // Configurar eventos de Socket.IO
    setupGameEvents()

    return () => {
      cleanupGameEvents()
      socketService.disconnect()
    }
  }, [])

  const getScreen = (): GameScreen => {
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

  const handleCreateGame = async (categoryId: string, hostName: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await createRoom(categoryId, hostName)

      setRoom(response.room)
      setCurrentPlayer(response.player)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la partida')
      console.error('Error creating game:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGame = async (code: string, playerName: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await joinRoom(code, playerName)
      setRoom(response.room)
      setCurrentPlayer(response.player)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al unirse a la partida'
      )
      console.error('Error joining game:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBackToHome = () => {
    reset()
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center'>
        <div className='text-white text-xl'>Cargando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
        <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md'>
          <p className='text-red-400 text-center mb-4'>{error}</p>
          <button
            onClick={handleBackToHome}
            className='w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-colors'
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const screen = getScreen()
  const isHost = currentPlayer?.id === room?.hostId

  if (screen === 'home') {
    return <Home onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
  }

  if (screen === 'lobby' && room && currentPlayer) {
    return <Lobby room={room} currentPlayer={currentPlayer} isHost={isHost} />
  }

  if (screen === 'characterReveal' && room && currentPlayer) {
    return <CharacterReveal room={room} currentPlayer={currentPlayer} />
  }

  if (screen === 'discussion' && room && currentPlayer) {
    return (
      <Discussion room={room} currentPlayer={currentPlayer} isHost={isHost} />
    )
  }

  if (screen === 'voting' && room && currentPlayer) {
    return <Voting room={room} currentPlayer={currentPlayer} isHost={isHost} />
  }

  if (screen === 'results' && votingResults && currentPlayer) {
    return (
      <Results
        results={votingResults}
        currentPlayer={currentPlayer}
        isHost={isHost}
        onBackToHome={handleBackToHome}
      />
    )
  }

  if (screen === 'gameOver' && room && currentPlayer) {
    return (
      <GameOver
        room={room}
        currentPlayer={currentPlayer}
        onBackToHome={handleBackToHome}
      />
    )
  }

  return null
}

export default App
