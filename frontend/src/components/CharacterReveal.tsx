import { useState } from 'react'
import { EyeOff, Users, Check } from 'lucide-react'
import { revealCharacter, setPlayerReady } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import type { Room, Player } from '../store/useGameStore'

interface CharacterRevealProps {
  room: Room
  currentPlayer: Player
}

export default function CharacterReveal({
  room,
  currentPlayer,
}: CharacterRevealProps) {
  const [revealed, setRevealed] = useState(currentPlayer.hasRevealed)
  const [showCharacter, setShowCharacter] = useState(currentPlayer.hasRevealed)
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  // Usar la sala del store si está disponible (se actualiza en tiempo real)
  const currentRoom = storeRoom || room
  const players = currentRoom.players || []

  // Buscar el jugador actualizado en la lista de jugadores
  const updatedPlayer =
    players.find((p) => p.id === currentPlayer.id) || currentPlayer

  // Usar el estado del servidor para isReady
  const ready = updatedPlayer.isReady

  const handleReveal = async () => {
    if (!revealed) {
      try {
        await revealCharacter(updatedPlayer.id, currentRoom.id)
        setRevealed(true)
        setShowCharacter(true) // Mostrar inmediatamente después de revelar
      } catch (error) {
        console.error('Error revealing character:', error)
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
        const response = await setPlayerReady(updatedPlayer.id, currentRoom.id)
        console.log('setPlayerReady response:', response)
      } catch (error) {
        console.error('Error setting ready:', error)
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
            <span className='text-slate-300'>
              {revealedCount} de {totalPlayers} han visto | {readyCount} listos
            </span>
          </div>
          {allRevealed && !allReady && revealed && (
            <div className='mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 inline-block'>
              <p className='text-emerald-400 font-semibold'>
                ✓ Todos han revelado. Haz clic en "Listo" para continuar.
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
                  Tu Personaje Secreto
                </h2>
                <p className='text-slate-400 mb-8 text-lg'>
                  Haz clic para revelar tu personaje
                  <br />
                  <span className='text-sm'>
                    No lo muestres a los demás jugadores
                  </span>
                </p>
                <button
                  onClick={handleReveal}
                  className='bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-lg transition-all hover:scale-105 shadow-lg shadow-red-500/30 text-xl'
                >
                  Revelar Personaje
                </button>
              </>
            ) : (
              <>
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 
                  ${
                    updatedPlayer.isLiar
                      ? 'bg-gradient-to-br from-red-500 to-pink-500'
                      : 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                  }`}
                >
                  <span className='text-5xl'>
                    {updatedPlayer.isLiar ? '❓' : '✓'}
                  </span>
                </div>

                {updatedPlayer.isLiar ? (
                  <>
                    <h2 className='text-4xl font-bold text-white mb-4'>
                      Tu rol es:
                    </h2>
                    <div className='bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-lg p-8 mb-6'>
                      <p className='text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400'>
                        ¡Eres el MENTIROSO!
                      </p>
                    </div>
                    <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-6'>
                      <p className='text-red-300 text-lg mb-2'>
                        Tú no sabes cuál es el personaje
                      </p>
                      <p className='text-slate-400'>
                        Intenta descubrir quién es el personaje escuchando a los
                        demás y haz que no te descubran
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className='text-4xl font-bold text-white mb-4'>
                      Tu personaje es:
                    </h2>
                    <div className='bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-8 mb-6'>
                      <p className='text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400'>
                        {updatedPlayer.character || 'Cargando...'}
                      </p>
                    </div>
                    <div className='bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6'>
                      <p className='text-slate-300'>
                        Encuentra al mentiroso haciendo preguntas sobre el
                        personaje
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleReveal}
                  className='mt-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto'
                >
                  <EyeOff className='w-5 h-5' />
                  Ocultar
                </button>

                {revealed && !ready && (
                  <button
                    onClick={handleReady}
                    disabled={loading}
                    className='mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/30'
                  >
                    <Check className='w-5 h-5' />
                    {loading ? 'Marcando...' : 'Listo para Continuar'}
                  </button>
                )}

                {ready && (
                  <div className='mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 mx-auto inline-block'>
                    <p className='text-emerald-400 font-semibold flex items-center gap-2'>
                      <Check className='w-5 h-5' />
                      Esperando a los demás jugadores...
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className='mt-8 bg-slate-800/30 backdrop-blur-lg rounded-xl p-6 border border-slate-700'>
          <h3 className='text-xl font-bold text-white mb-4 text-center'>
            ¿Cómo jugar?
          </h3>
          <div className='space-y-3 text-slate-300'>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                1
              </span>
              <p>Todos hacen preguntas sobre el personaje por turnos</p>
            </div>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                2
              </span>
              <p>El mentiroso debe intentar averiguar cuál es el personaje</p>
            </div>
            <div className='flex gap-3'>
              <span className='flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold'>
                3
              </span>
              <p>
                Los demás deben encontrar al mentiroso sin revelar el personaje
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
