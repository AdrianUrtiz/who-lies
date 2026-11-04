import { useState } from 'react'
import { Copy, Check, Users, Play } from 'lucide-react'
import { startGame } from '../sockets/gameEvents'
import { useGameStore } from '../store/useGameStore'
import { getCategoryName } from '../constants/characters'
import type { Room, Player } from '../store/useGameStore'

interface LobbyProps {
  room: Room
  currentPlayer: Player
  isHost: boolean
}

export default function Lobby({ room, currentPlayer, isHost }: LobbyProps) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const { room: storeRoom } = useGameStore()

  // Usar la sala del store si está disponible (se actualiza en tiempo real)
  const currentRoom = storeRoom || room
  const players = currentRoom.players || []

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(currentRoom.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartGame = async () => {
    if (players.length < 3) {
      alert('Se necesitan al menos 3 jugadores para empezar')
      return
    }

    setLoading(true)
    try {
      const res = await startGame(currentRoom.id, currentPlayer.id)
      // P0-T2: el ACK trae tu rol privado; el broadcast es público.
      if (res?.yourPlayer) {
        useGameStore.getState().setCurrentPlayer(res.yourPlayer)
      }
      if (res?.room) {
        useGameStore.getState().setRoom(res.room)
      }
    } catch (error) {
      console.error('Error starting game:', error)
      alert('Error al iniciar el juego')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl border border-slate-700'>
        <div className='text-center mb-8'>
          <div className='w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Users className='w-10 h-10 text-emerald-400' />
          </div>
          <h2 className='text-3xl font-bold text-white mb-4'>Sala de Espera</h2>

          <div className='bg-slate-900/50 rounded-lg p-4 mb-4 inline-block'>
            <p className='text-slate-400 text-sm mb-2'>Código de sala</p>
            <div className='flex items-center gap-3'>
              <span className='text-4xl font-mono font-bold text-white tracking-widest'>
                {currentRoom.code}
              </span>
              <button
                onClick={handleCopyCode}
                className='p-2 hover:bg-slate-700 rounded-lg transition-colors'
                title='Copiar código'
              >
                {copied ? (
                  <Check className='w-6 h-6 text-emerald-400' />
                ) : (
                  <Copy className='w-6 h-6 text-slate-400' />
                )}
              </button>
            </div>
          </div>

          <p className='text-slate-400'>
            Categoría:{' '}
            <span className='text-emerald-400 font-semibold'>
              {getCategoryName(currentRoom.categoryId)}
            </span>
          </p>
        </div>

        <div className='mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-xl font-semibold text-white'>
              Jugadores ({players.length})
            </h3>
            {players.length < 3 && (
              <span className='text-sm text-amber-400'>Mínimo 3 jugadores</span>
            )}
          </div>

          <div className='space-y-2'>
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`bg-slate-900/50 rounded-lg p-4 flex items-center gap-3 ${
                  player.id === currentPlayer.id
                    ? 'ring-2 ring-emerald-500'
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
                <span className='text-white font-medium flex-1'>
                  {player.name}
                  {player.id === currentPlayer.id && (
                    <span className='text-emerald-400 text-sm ml-2'>(Tú)</span>
                  )}
                  {player.id === currentRoom.hostId && (
                    <span className='text-amber-400 text-sm ml-2'>(Host)</span>
                  )}
                  {/* P1-B2: presencia */}
                  {player.isConnected === false && (
                    <span className='text-slate-500 text-sm ml-2'>
                      (desconectado)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={loading || players.length < 3}
            className='w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3'
          >
            <Play className='w-5 h-5' />
            {loading ? 'Iniciando...' : 'Iniciar Partida'}
          </button>
        )}

        {!isHost && (
          <div className='text-center text-slate-400'>
            Esperando a que el host inicie la partida...
          </div>
        )}
      </div>
    </div>
  )
}
