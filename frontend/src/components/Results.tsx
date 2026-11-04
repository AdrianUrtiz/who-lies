import { Trophy, XCircle, Target, RefreshCw, Home } from 'lucide-react'
import { continueGame } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import { notify } from '../ui/toast'
import { useI18n, fill } from '../i18n'
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
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  const currentRoom = storeRoom || results.room
  const { eliminatedPlayer, liarCaught, liar, gameFinished } = results
  const tie = results.tie === true

  const handleContinueGame = async () => {
    setLoading(true)
    try {
      await continueGame(currentRoom.id, currentPlayer.id, currentPlayer.secret)
    } catch (error) {
      console.error('Error continuing game:', error)
      notify.error(
        error instanceof Error ? error.message : t.results.continueError
      )
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
            {playersWon && t.results.playersWin}
            {liarWon && t.results.liarWin}
            {tie && t.results.tieTitle}
            {!gameFinished && !tie && t.results.eliminatedTitle}
          </h2>

          <p className='text-slate-400 text-lg'>
            {playersWon && t.results.playersWinHint}
            {liarWon && t.results.liarWinHint}
            {tie && t.results.tieHint}
            {!gameFinished && !tie && t.results.continueHint}
          </p>
        </div>

        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700 mb-6'>
          {/* Empate P0-T6: no hay eliminado, hay que revotar */}
          {tie || !eliminatedPlayer ? (
            <div className='bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center'>
              <p className='text-amber-300 text-xl font-bold mb-2'>
                {t.results.tieBody1}
              </p>
              <p className='text-slate-300'>{t.results.tieBody2}</p>
            </div>
          ) : (
            <>
              {/* Jugador Eliminado */}
              <div className='mb-8'>
                <h3 className='text-xl font-semibold text-white mb-4 text-center'>
                  {t.results.eliminated}
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
                      {liar && eliminatedPlayer.id === liar.id
                        ? t.results.wasLiar
                        : t.results.wasInnocent}
                    </p>
                  </div>
                  {eliminatedPlayer.id === currentPlayer.id && (
                    <div className='text-red-400 font-semibold'>
                      {t.results.you}
                    </div>
                  )}
                </div>
              </div>

              {/* Info del Mentiroso (P0-T2: solo viaja si terminó/fue cazado) */}
              {liar ? (
                <div className='mb-8'>
                  <h3 className='text-xl font-semibold text-white mb-4 text-center'>
                    {t.results.liarTitle}
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
                        {t.results.liarUnknown}{' '}
                        <span className='font-semibold'>
                          {liar.character || t.results.unknown}
                        </span>
                      </p>
                    </div>
                    {liar.id === currentPlayer.id && (
                      <div className='text-purple-400 font-semibold'>
                        {t.results.you}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className='mb-8 bg-slate-900/50 rounded-lg p-4 text-center text-slate-400'>
                  {t.results.liarHidden}
                </div>
              )}
            </>
          )}

          {/* Jugadores Restantes */}
          {!gameFinished && (
            <div>
              <h3 className='text-xl font-semibold text-white mb-4 text-center'>
                {fill(t.results.active, {
                  n: currentRoom.players.filter((p) => !p.isEliminated).length,
                })}
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
                            {t.results.you}
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
                ? t.results.continuing
                : fill(t.results.continue, {
                    n: currentRoom.currentRound + 1,
                  })}
            </button>
          )}

          {!gameFinished && !isHost && (
            <div className='text-center text-slate-400 bg-slate-800/30 backdrop-blur-lg rounded-lg p-4 border border-slate-700'>
              {t.results.waitHost}
            </div>
          )}

          {gameFinished && (
            <button
              onClick={onBackToHome}
              className='w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3'
            >
              <Home className='w-5 h-5' />
              {t.app.newGame}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
