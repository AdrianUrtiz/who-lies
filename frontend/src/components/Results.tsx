import { Trophy, XCircle, Target, RefreshCw, Home } from 'lucide-react'
import { continueGame } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import type { VotingResults, Player } from '../store/useGameStore'
import { useState } from 'react'

interface ResultsProps {
  results: VotingResults
  currentPlayer: Player
  isHost: boolean
  onBackToHome: () => void
}

export default function Results({
  results,
  currentPlayer,
  isHost,
  onBackToHome,
}: ResultsProps) {
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  const currentRoom = storeRoom || results.room
  const { eliminatedPlayer, liarCaught, liar, gameFinished } = results

  const handleContinueGame = async () => {
    setLoading(true)
    try {
      await continueGame(currentRoom.id)
    } catch (error) {
      console.error('Error continuing game:', error)
      alert('Error al continuar el juego')
    } finally {
      setLoading(false)
    }
  }

  // Determinar quién ganó
  const playersWon = liarCaught
  const liarWon = gameFinished && !liarCaught

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='max-w-2xl w-full'>
        <div className='text-center mb-8'>
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
              playersWon
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                : liarWon
                  ? 'bg-gradient-to-br from-red-500 to-pink-500'
                  : 'bg-amber-500/20'
            }`}
          >
            {playersWon ? (
              <Trophy className='w-12 h-12 text-white' />
            ) : liarWon ? (
              <Target className='w-12 h-12 text-white' />
            ) : (
              <XCircle className='w-12 h-12 text-amber-400' />
            )}
          </div>

          <h2 className='text-4xl font-bold text-white mb-2'>
            {playersWon && '¡Los Jugadores Ganan!'}
            {liarWon && '¡El Mentiroso Gana!'}
            {!gameFinished && '¡Jugador Eliminado!'}
          </h2>

          <p className='text-slate-400 text-lg'>
            {playersWon && 'Atraparon al mentiroso'}
            {liarWon && 'El mentiroso logró engañar a todos'}
            {!gameFinished && 'El juego continúa...'}
          </p>
        </div>

        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700 mb-6'>
          {/* Jugador Eliminado */}
          <div className='mb-8'>
            <h3 className='text-xl font-semibold text-white mb-4 text-center'>
              Jugador Eliminado
            </h3>
            <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-6 flex items-center gap-4'>
              <div className='w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center font-bold text-2xl text-red-400'>
                {eliminatedPlayer.name.charAt(0).toUpperCase()}
              </div>
              <div className='flex-1'>
                <p className='text-2xl font-bold text-white mb-1'>
                  {eliminatedPlayer.name}
                </p>
                <p className='text-slate-400'>
                  {eliminatedPlayer.id === liar.id
                    ? '🎭 Era el MENTIROSO'
                    : '✅ Era inocente'}
                </p>
              </div>
              {eliminatedPlayer.id === currentPlayer.id && (
                <div className='text-red-400 font-semibold'>(Tú)</div>
              )}
            </div>
          </div>

          {/* Info del Mentiroso */}
          <div className='mb-8'>
            <h3 className='text-xl font-semibold text-white mb-4 text-center'>
              El Mentiroso
            </h3>
            <div className='bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 flex items-center gap-4'>
              <div className='w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center text-4xl'>
                ❓
              </div>
              <div className='flex-1'>
                <p className='text-2xl font-bold text-white mb-1'>
                  {liar.name}
                </p>
                <p className='text-purple-300'>
                  No sabía que el personaje era:{' '}
                  <span className='font-semibold'>
                    {liar.character || 'Desconocido'}
                  </span>
                </p>
              </div>
              {liar.id === currentPlayer.id && (
                <div className='text-purple-400 font-semibold'>(Tú)</div>
              )}
            </div>
          </div>

          {/* Jugadores Restantes */}
          {!gameFinished && (
            <div>
              <h3 className='text-xl font-semibold text-white mb-4 text-center'>
                Jugadores Activos (
                {currentRoom.players.filter((p) => !p.isEliminated).length})
              </h3>
              <div className='space-y-2'>
                {currentRoom.players
                  .filter((p) => !p.isEliminated)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className='bg-slate-900/50 rounded-lg p-3 flex items-center gap-3'
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          index % 5 === 0
                            ? 'bg-red-500/20 text-red-400'
                            : index % 5 === 1
                              ? 'bg-blue-500/20 text-blue-400'
                              : index % 5 === 2
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : index % 5 === 3
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className='text-white font-medium flex-1'>
                        {player.name}
                        {player.id === currentPlayer.id && (
                          <span className='text-emerald-400 text-sm ml-2'>
                            (Tú)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className='space-y-3'>
          {!gameFinished && isHost && (
            <button
              onClick={handleContinueGame}
              disabled={loading}
              className='w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3'
            >
              <RefreshCw className='w-5 h-5' />
              {loading
                ? 'Continuando...'
                : 'Continuar Juego (Ronda ' +
                  (currentRoom.currentRound + 1) +
                  ')'}
            </button>
          )}

          {!gameFinished && !isHost && (
            <div className='text-center text-slate-400 bg-slate-800/30 backdrop-blur-lg rounded-lg p-4 border border-slate-700'>
              Esperando a que el host continúe el juego...
            </div>
          )}

          {gameFinished && (
            <button
              onClick={onBackToHome}
              className='w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3'
            >
              <Home className='w-5 h-5' />
              Nueva Partida
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
