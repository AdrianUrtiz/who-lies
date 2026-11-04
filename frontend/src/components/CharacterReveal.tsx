import { useState } from 'react'
import { EyeOff, Users, Check } from 'lucide-react'
import { revealCharacter, setPlayerReady } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import { notify } from '../ui/toast'
import { useI18n, fill } from '../i18n'
import type { Room, Player } from '../store/useGameStore'

interface CharacterRevealProps {
  room: Room
  currentPlayer: Player
}

export default function CharacterReveal({
  room,
  currentPlayer,
}: CharacterRevealProps) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(currentPlayer.hasRevealed)
  const [showCharacter, setShowCharacter] = useState(currentPlayer.hasRevealed)
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  // Usar la sala del store si está disponible (se actualiza en tiempo real)
  const currentRoom = storeRoom || room
  const players = currentRoom.players || []

  // P0-T2: el broadcast es público (sin isLiar/character). El rol propio
  // viene por canal privado (yourPlayerUpdated) en currentPlayer/store.
  const roomPlayer = players.find((p) => p.id === currentPlayer.id)
  const updatedPlayer = {
    ...currentPlayer,
    hasRevealed: roomPlayer?.hasRevealed ?? currentPlayer.hasRevealed,
    isReady: roomPlayer?.isReady ?? currentPlayer.isReady,
    isEliminated: roomPlayer?.isEliminated ?? currentPlayer.isEliminated,
  }
  const isLiar = updatedPlayer.isLiar === true

  // Usar el estado del servidor para isReady
  const ready = updatedPlayer.isReady

  const handleReveal = async () => {
    if (!revealed) {
      try {
        await revealCharacter(
          updatedPlayer.id,
          currentRoom.id,
          currentPlayer.secret
        )
        setRevealed(true)
        setShowCharacter(true) // Mostrar inmediatamente después de revelar
      } catch (error) {
        console.error('Error revealing character:', error)
        notify.error(
          error instanceof Error ? error.message : t.reveal.revealError
        )
      }
    } else {
      setShowCharacter(!showCharacter)
    }
  }

  const handleReady = async () => {
    console.log('handleReady called - ready:', ready, 'revealed:', revealed)
    if (!ready && revealed) {
      setLoading(true)
      try {
        console.log('Sending setPlayerReady to server...')
        const response = await setPlayerReady(
          updatedPlayer.id,
          currentRoom.id,
          currentPlayer.secret
        )
        console.log('setPlayerReady response:', response)
      } catch (error) {
        console.error('Error setting ready:', error)
        notify.error(
          error instanceof Error ? error.message : t.reveal.readyError
        )
      } finally {
        setLoading(false)
        console.log('setLoading(false) executed')
      }
    }
  }

  const revealedCount = players.filter((p) => p.hasRevealed).length
  const readyCount = players.filter((p) => p.isReady).length
  const totalPlayers = players.length
  const allRevealed = players
    .filter((p) => !p.isEliminated)
    .every((p) => p.hasRevealed)
  const allReady = players
    .filter((p) => !p.isEliminated)
    .every((p) => p.isReady)

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='max-w-2xl w-full'>
        <div className='text-center mb-8'>
          <div className='inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-lg rounded-full px-6 py-3 border border-slate-700'>
            <Users className='w-5 h-5 text-slate-400' />
            <span className='text-slate-300' role='status'>
              {fill(t.reveal.seenReadyCounters, {
                revealed: revealedCount,
                total: totalPlayers,
                ready: readyCount,
              })}
            </span>
          </div>
          {allRevealed && !allReady && revealed && (
            <div className='mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 inline-block'>
              <p className='text-emerald-400 font-semibold' role='status'>
                {t.reveal.revealedReady}
              </p>
            </div>
          )}
        </div>

        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700'>
          <div className='text-center'>
            {!showCharacter ? (
              <>
                <div className='w-24 h-24 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6'>
                  <EyeOff className='w-12 h-12 text-slate-500' />
                </div>
                <h2 className='text-3xl font-bold text-white mb-4'>
                  {t.reveal.secretTitle}
                </h2>
                <p className='text-slate-400 mb-8 text-lg'>
                  {t.reveal.revealCta}
                  <br />
                  <span className='text-sm'>{t.reveal.revealHint}</span>
                </p>
                <button
                  onClick={handleReveal}
                  className='bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-lg transition-all hover:scale-105 shadow-lg shadow-red-500/30 text-xl'
                >
                  {t.reveal.reveal}
                </button>
              </>
            ) : (
              <>
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 
                  ${
                    isLiar
                      ? 'bg-gradient-to-br from-red-500 to-pink-500'
                      : 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                  }`}
                >
                  <span className='text-5xl'>{isLiar ? '❓' : '✓'}</span>
                </div>

                {isLiar ? (
                  <>
                    <h2 className='text-4xl font-bold text-white mb-4'>
                      {t.reveal.yourRole}
                    </h2>
                    <div className='bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-lg p-8 mb-6'>
                      <p className='text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400'>
                        {t.reveal.liar}
                      </p>
                    </div>
                    <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-6'>
                      <p className='text-red-300 text-lg mb-2'>
                        {t.reveal.liarHint1}
                      </p>
                      <p className='text-slate-400'>{t.reveal.liarHint2}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className='text-4xl font-bold text-white mb-4'>
                      {t.reveal.yourCharacter}
                    </h2>
                    <div className='bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-8 mb-6'>
                      <p className='text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400'>
                        {updatedPlayer.character || t.reveal.loading}
                      </p>
                    </div>
                    <div className='bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6'>
                      <p className='text-slate-300'>{t.reveal.honestHint}</p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleReveal}
                  className='mt-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto'
                >
                  <EyeOff className='w-5 h-5' />
                  {t.reveal.hide}
                </button>

                {revealed && !ready && (
                  <button
                    onClick={handleReady}
                    disabled={loading}
                    className='mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/30'
                  >
                    <Check className='w-5 h-5' />
                    {loading ? t.reveal.marking : t.reveal.ready}
                  </button>
                )}

                {ready && (
                  <div className='mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 mx-auto inline-block'>
                    <p className='text-emerald-400 font-semibold flex items-center gap-2'>
                      <Check className='w-5 h-5' />
                      {t.reveal.waiting}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className='mt-8 bg-slate-800/30 backdrop-blur-lg rounded-xl p-6 border border-slate-700'>
          <h3 className='text-xl font-bold text-white mb-4 text-center'>
            {t.reveal.howTo}
          </h3>
          <div className='space-y-3 text-slate-300'>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                1
              </span>
              <p>{t.reveal.how1}</p>
            </div>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                2
              </span>
              <p>{t.reveal.how2}</p>
            </div>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                3
              </span>
              <p>{t.reveal.how3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
