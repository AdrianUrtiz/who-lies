import { useState } from 'react'
import { MessageSquare, Vote, Users, Clock } from 'lucide-react'
import { startVoting } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import { notify } from '../ui/toast'
import { useI18n, fill } from '../i18n'
import { useCountdown, DISCUSSION_SECONDS } from '../game/useCountdown'
import type { Room, Player } from '../store/useGameStore'

interface DiscussionProps {
  room: Room
  currentPlayer: Player
  isHost: boolean
}

export default function Discussion({
  room,
  currentPlayer,
  isHost,
}: DiscussionProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  // Usar la sala del store si está disponible (se actualiza en tiempo real)
  const currentRoom = storeRoom || room
  const players = currentRoom.players.filter((p) => !p.isEliminated) || []
  const revealedCount = players.filter((p) => p.hasRevealed).length

  // P3-T2: cuenta atrás por ronda; al expirar, el host pasa a votación.
  const timeLeft = useCountdown(
    DISCUSSION_SECONDS,
    `${currentRoom.id}-d${currentRoom.currentRound}`,
    () => {
      if (isHost && !loading) void handleStartVoting()
    }
  )

  const handleStartVoting = async () => {
    if (players.length < 2) {
      notify.error(t.discussion.needTwo)
      return
    }

    setLoading(true)
    try {
      await startVoting(currentRoom.id, currentPlayer.id, currentPlayer.secret)
    } catch (error) {
      console.error('Error starting voting:', error)
      notify.error(
        error instanceof Error ? error.message : t.discussion.votingError
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='max-w-2xl w-full'>
        <div className='text-center mb-8'>
          <div className='w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
            <MessageSquare className='w-10 h-10 text-purple-400' />
          </div>
          <h2 className='text-3xl font-bold text-white mb-2'>
            {t.discussion.title}
          </h2>
          <p className='text-slate-400 text-lg'>{t.discussion.subtitle}</p>
          <div className='flex items-center justify-center gap-3 mt-4'>
            <div className='inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-lg rounded-full px-6 py-3 border border-slate-700'>
              <span className='text-slate-300'>
                {fill(t.discussion.round, { n: currentRoom.currentRound })}
              </span>
            </div>
            <div
              className='inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-lg rounded-full px-6 py-3 border border-slate-700'
              role='timer'
              aria-live='off'
            >
              <Clock className='w-4 h-4 text-purple-400' />
              <span className='text-slate-300 tabular-nums'>
                {fill(t.discussion.timeLeft, { t: timeLeft })}
              </span>
            </div>
          </div>
        </div>

        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700 mb-6'>
          <div className='mb-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xl font-semibold text-white flex items-center gap-2'>
                <Users className='w-5 h-5' />
                {fill(t.discussion.activePlayers, { n: players.length })}
              </h3>
              <span className='text-sm text-slate-400' role='status'>
                {fill(t.discussion.revealed, {
                  a: revealedCount,
                  b: players.length,
                })}
              </span>
            </div>

            <div className='space-y-2'>
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`bg-slate-900/50 rounded-lg p-4 flex items-center gap-3 ${
                    player.id === currentPlayer.id
                      ? 'ring-2 ring-purple-500'
                      : ''
                  }`}
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
                  <div className='flex-1'>
                    <span className='text-white font-medium'>
                      {player.name}
                      {player.id === currentPlayer.id && (
                        <span className='text-purple-400 text-sm ml-2'>
                          {t.discussion.you}
                        </span>
                      )}
                      {player.id === currentRoom.hostId && (
                        <span className='text-amber-400 text-sm ml-2'>
                          {t.discussion.host}
                        </span>
                      )}
                    </span>
                  </div>
                  {player.hasRevealed && (
                    <div className='text-emerald-400 text-sm'>
                      {t.discussion.seen}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className='bg-blue-500/10 border border-blue-500/30 rounded-lg p-6'>
            <h4 className='text-lg font-semibold text-blue-300 mb-3'>
              {t.discussion.tips}
            </h4>
            <ul className='space-y-2 text-slate-300'>
              <li className='flex gap-2'>
                <span>•</span>
                <span>{t.discussion.tip1}</span>
              </li>
              <li className='flex gap-2'>
                <span>•</span>
                <span>{t.discussion.tip2}</span>
              </li>
              <li className='flex gap-2'>
                <span>•</span>
                <span>{t.discussion.tip3}</span>
              </li>
            </ul>
          </div>
        </div>

        {isHost && (
          <button
            onClick={handleStartVoting}
            disabled={loading || players.length < 2}
            className='w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-purple-500/30 flex items-center justify-center gap-3'
          >
            <Vote className='w-5 h-5' />
            {loading ? t.discussion.startingVoting : t.discussion.toVoting}
          </button>
        )}

        {!isHost && (
          <div className='text-center text-slate-400 bg-slate-800/30 backdrop-blur-lg rounded-lg p-4 border border-slate-700'>
            {t.discussion.waitingHost}
          </div>
        )}
      </div>
    </div>
  )
}
