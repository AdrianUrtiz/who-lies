import { Trophy, Target, Home, Users, TrendingUp } from 'lucide-react'
import type { Room, Player } from '../store/useGameStore'

interface GameOverProps {
  room: Room
  currentPlayer: Player
  onBackToHome: () => void
}

export default function GameOver({
  room,
  currentPlayer,
  onBackToHome,
}: GameOverProps) {
  // Encontrar al mentiroso
  const liar = room.players.find((p) => p.isLiar)

  // Determinar quién ganó
  const liarEliminated = liar?.isEliminated || false
  const playersWon = liarEliminated
  const liarWon = !liarEliminated

  // Obtener jugadores supervivientes (no eliminados)
  const survivors = room.players.filter((p) => !p.isEliminated)
  const eliminated = room.players.filter((p) => p.isEliminated)

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      <div className='max-w-3xl w-full'>
        {/* Header - Ganador */}
        <div className='text-center mb-8'>
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
              playersWon
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 animate-pulse'
                : 'bg-gradient-to-br from-red-500 to-pink-500 animate-pulse'
            }`}
          >
            {playersWon ? (
              <Trophy className='w-16 h-16 text-white' />
            ) : (
              <Target className='w-16 h-16 text-white' />
            )}
          </div>

          <h1 className='text-5xl font-bold text-white mb-4'>
            {playersWon ? '¡FIN DEL JUEGO!' : '¡JUEGO TERMINADO!'}
          </h1>

          <div
            className={`inline-block px-8 py-4 rounded-2xl ${
              playersWon
                ? 'bg-emerald-500/20 border-2 border-emerald-500'
                : 'bg-red-500/20 border-2 border-red-500'
            }`}
          >
            <p
              className={`text-3xl font-bold ${
                playersWon ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {playersWon
                ? '👥 ¡Los Jugadores Ganan!'
                : '🎭 ¡El Mentiroso Gana!'}
            </p>
          </div>

          <p className='text-slate-400 text-lg mt-4'>
            {playersWon
              ? 'Lograron descubrir al mentiroso'
              : 'El mentiroso logró engañar a todos'}
          </p>
        </div>

        {/* Información del Juego */}
        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-slate-700 mb-6'>
          {/* El Mentiroso */}
          <div className='mb-8'>
            <h3 className='text-2xl font-semibold text-white mb-4 text-center flex items-center justify-center gap-2'>
              <Target className='w-6 h-6 text-purple-400' />
              El Mentiroso Era
            </h3>
            <div className='bg-purple-500/10 border border-purple-500/30 rounded-xl p-6 flex items-center gap-4'>
              <div className='w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center text-4xl'>
                🎭
              </div>
              <div className='flex-1'>
                <p className='text-3xl font-bold text-white mb-2'>
                  {liar?.name || 'Desconocido'}
                </p>
                <p className='text-purple-300'>
                  No sabía que el personaje era:{' '}
                  <span className='font-semibold'>
                    {liar?.character || 'Desconocido'}
                  </span>
                </p>
                {liar?.id === currentPlayer.id && (
                  <div className='mt-2'>
                    <span className='inline-block px-3 py-1 bg-purple-500/30 rounded-full text-purple-300 text-sm font-semibold'>
                      👤 Este eras tú
                    </span>
                  </div>
                )}
              </div>
              {liarEliminated && (
                <div className='text-red-400 text-6xl'>❌</div>
              )}
              {!liarEliminated && (
                <div className='text-emerald-400 text-6xl'>✅</div>
              )}
            </div>
          </div>

          {/* Estadísticas de la Partida */}
          <div className='grid grid-cols-2 gap-4 mb-8'>
            <div className='bg-slate-900/50 rounded-lg p-4 text-center'>
              <div className='text-3xl font-bold text-white mb-1'>
                {room.currentRound}
              </div>
              <div className='text-slate-400 text-sm'>Rondas Jugadas</div>
            </div>
            <div className='bg-slate-900/50 rounded-lg p-4 text-center'>
              <div className='text-3xl font-bold text-white mb-1'>
                {eliminated.length}
              </div>
              <div className='text-slate-400 text-sm'>Jugadores Eliminados</div>
            </div>
          </div>

          {/* Supervivientes */}
          {survivors.length > 0 && (
            <div className='mb-8'>
              <h3 className='text-xl font-semibold text-white mb-4 flex items-center gap-2'>
                <Users className='w-5 h-5 text-emerald-400' />
                Supervivientes ({survivors.length})
              </h3>
              <div className='grid grid-cols-2 gap-3'>
                {survivors.map((player, index) => (
                  <div
                    key={player.id}
                    className={`bg-slate-900/50 rounded-lg p-3 flex items-center gap-3 
                      ${
                        player.id === currentPlayer.id
                          ? 'ring-2 ring-emerald-500'
                          : ''
                      }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                        index % 5 === 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : index % 5 === 1
                            ? 'bg-blue-500/20 text-blue-400'
                            : index % 5 === 2
                              ? 'bg-purple-500/20 text-purple-400'
                              : index % 5 === 3
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className='flex-1'>
                      <span className='text-white font-medium'>
                        {player.name}
                      </span>
                      {player.id === currentPlayer.id && (
                        <span className='text-emerald-400 text-xs ml-2'>
                          (Tú)
                        </span>
                      )}
                    </div>
                    {player.isLiar && <span className='text-2xl'>🎭</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eliminados */}
          {eliminated.length > 0 && (
            <div>
              <h3 className='text-xl font-semibold text-white mb-4 flex items-center gap-2'>
                <TrendingUp className='w-5 h-5 text-red-400 transform rotate-180' />
                Eliminados ({eliminated.length})
              </h3>
              <div className='space-y-2'>
                {eliminated.map((player, index) => (
                  <div
                    key={player.id}
                    className='bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 opacity-60'
                  >
                    <div className='w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center font-bold text-red-400'>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className='flex-1'>
                      <span className='text-slate-300 font-medium'>
                        {player.name}
                      </span>
                      {player.id === currentPlayer.id && (
                        <span className='text-red-400 text-xs ml-2'>(Tú)</span>
                      )}
                      {player.isLiar && (
                        <span className='text-purple-400 text-xs ml-2'>
                          (Era el mentiroso)
                        </span>
                      )}
                    </div>
                    <span className='text-red-400'>❌</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mensaje Final */}
        <div
          className={`text-center p-6 rounded-xl mb-6 ${
            currentPlayer.isLiar
              ? liarWon
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-red-500/10 border border-red-500/30'
              : playersWon
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <p
            className={`text-xl font-bold ${
              (currentPlayer.isLiar && liarWon) ||
              (!currentPlayer.isLiar && playersWon)
                ? 'text-emerald-300'
                : 'text-red-300'
            }`}
          >
            {currentPlayer.isLiar
              ? liarWon
                ? '🎉 ¡Lograste engañar a todos!'
                : '😔 Te descubrieron'
              : playersWon
                ? '🎉 ¡Bien hecho, atraparon al mentiroso!'
                : '😔 El mentiroso ganó esta vez'}
          </p>
        </div>

        {/* Botón para Nueva Partida */}
        <button
          onClick={onBackToHome}
          className='w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 rounded-lg transition-all hover:scale-105 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3'
        >
          <Home className='w-5 h-5' />
          Nueva Partida
        </button>
      </div>
    </div>
  )
}
