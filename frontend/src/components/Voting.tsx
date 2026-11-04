import { useState, useEffect, useCallback } from 'react'
import { Vote, CheckCircle, Clock } from 'lucide-react'
import { submitVote, processVoting } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import type { Room, Player } from '../store/useGameStore'

interface VotingProps {
  room: Room
  currentPlayer: Player
  isHost: boolean
}

export default function Voting({ room, currentPlayer, isHost }: VotingProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  // Usar la sala del store si está disponible (se actualiza en tiempo real)
  const currentRoom = storeRoom || room
  const activePlayers = currentRoom.players.filter(
    (p) => !p.isEliminated && p.id !== currentPlayer.id
  )

  // Verificar si el jugador actual ya votó en esta ronda
  useEffect(() => {
    const myVote = currentRoom.votes?.find(
      (v) =>
        v.voterId === currentPlayer.id && v.round === currentRoom.currentRound
    )
    if (myVote) {
      setSelectedPlayer(myVote.votedForId)
      setHasVoted(true)
    }
  }, [currentRoom.votes, currentPlayer.id, currentRoom.currentRound])

  // Contar cuántos jugadores han votado
  const votesInCurrentRound =
    currentRoom.votes?.filter((v) => v.round === currentRoom.currentRound) || []
  const uniqueVoters = new Set(votesInCurrentRound.map((v) => v.voterId))
  const totalVoters = currentRoom.players.filter((p) => !p.isEliminated).length
  const votedCount = uniqueVoters.size
  const allVoted = votedCount === totalVoters

  const handleProcessVoting = useCallback(async () => {
    if (loading) return // Evitar múltiples llamadas
    setLoading(true)
    try {
      console.log('🗳️ Procesando votación...')
      await processVoting(currentRoom.id, currentPlayer.id)
    } catch (error) {
      console.error('Error processing voting:', error)
      alert('Error al procesar votación')
    } finally {
      setLoading(false)
    }
  }, [currentRoom.id, currentPlayer.id, loading])

  // Procesar automáticamente cuando todos hayan votado (solo el host)
  useEffect(() => {
    console.log('🔍 Checking auto-process conditions:', {
      allVoted,
      isHost,
      loading,
      votedCount,
      totalVoters,
    })

    if (allVoted && isHost && !loading) {
      console.log(
        '🗳️ Todos han votado, procesando resultados automáticamente...'
      )
      handleProcessVoting()
    }
  }, [allVoted, isHost, loading, handleProcessVoting, votedCount, totalVoters])

  const handleVote = async () => {
    if (!selectedPlayer) {
      alert('Selecciona un jugador')
      return
    }

    setLoading(true)
    try {
      await submitVote(currentRoom.id, currentPlayer.id, selectedPlayer)
      setHasVoted(true)
    } catch (error) {
      console.error('Error submitting vote:', error)
      alert('Error al enviar voto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='max-w-2xl w-full'>
        <div className='text-center mb-8'>
          <div className='w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Vote className='w-10 h-10 text-red-400' />
          </div>
          <h2 className='text-3xl font-bold text-white mb-2'>Votación</h2>
          <p className='text-slate-400 text-lg'>
            ¿Quién crees que es el mentiroso?
          </p>

          <div className='flex items-center justify-center gap-4 mt-4'>
            <div className='inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-lg rounded-full px-6 py-3 border border-slate-700'>
              <CheckCircle className='w-5 h-5 text-emerald-400' />
              <span className='text-slate-300'>
                {votedCount}/{totalVoters} votos
              </span>
            </div>

            {!allVoted && (
              <div className='inline-flex items-center gap-2 bg-amber-500/10 backdrop-blur-lg rounded-full px-6 py-3 border border-amber-500/30'>
                <Clock className='w-5 h-5 text-amber-400' />
                <span className='text-amber-300'>Esperando votos...</span>
              </div>
            )}
          </div>
        </div>

        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700 mb-6'>
          {!hasVoted ? (
            <>
              <h3 className='text-xl font-semibold text-white mb-4'>
                Selecciona al mentiroso:
              </h3>
              <div className='space-y-2 mb-6'>
                {activePlayers.map((player, index) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayer(player.id)}
                    className={`w-full bg-slate-900/50 hover:bg-slate-800 rounded-lg p-4 flex items-center gap-3 transition-all ${
                      selectedPlayer === player.id
                        ? 'ring-2 ring-red-500 bg-red-500/10'
                        : ''
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
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
                    <div className='flex-1 text-left'>
                      <span className='text-white font-medium text-lg'>
                        {player.name}
                        {player.id === currentRoom.hostId && (
                          <span className='text-amber-400 text-sm ml-2'>
                            (Host)
                          </span>
                        )}
                      </span>
                    </div>
                    {selectedPlayer === player.id && (
                      <CheckCircle className='w-6 h-6 text-red-400' />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleVote}
                disabled={!selectedPlayer || loading}
                className='w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center gap-3'
              >
                <Vote className='w-5 h-5' />
                {loading ? 'Enviando voto...' : 'Confirmar Voto'}
              </button>
            </>
          ) : (
            <div className='text-center py-8'>
              <CheckCircle className='w-16 h-16 text-emerald-400 mx-auto mb-4' />
              <h3 className='text-2xl font-bold text-white mb-2'>
                ¡Voto Registrado!
              </h3>
              <p className='text-slate-400'>Esperando a que todos voten...</p>
              {allVoted && isHost && (
                <button
                  onClick={handleProcessVoting}
                  disabled={loading}
                  className='mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg shadow-emerald-500/30'
                >
                  {loading ? 'Procesando...' : 'Ver Resultados'}
                </button>
              )}
            </div>
          )}
        </div>

        {allVoted && !isHost && (
          <div className='text-center text-slate-400 bg-emerald-500/10 backdrop-blur-lg rounded-lg p-4 border border-emerald-500/30'>
            ✅ Todos han votado. El host mostrará los resultados pronto...
          </div>
        )}
      </div>
    </div>
  )
}
