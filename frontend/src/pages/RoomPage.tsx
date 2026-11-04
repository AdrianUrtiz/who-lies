import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Lobby from '../components/Lobby'
import CharacterReveal from '../components/CharacterReveal'
import Discussion from '../components/Discussion'
import Voting from '../components/Voting'
import Results from '../components/Results'
import GameOver from '../components/GameOver'
import { useGameStore } from '../store/useGameStore'
import { loadSession } from '../sockets/session'
import { getScreen } from '../game/screen'
import { notify } from '../ui/toast'
import { useI18n } from '../i18n'

interface RoomPageProps {
  onBackToHome: () => void
}

/**
 * P3-T1: página de sala bajo /room/:code.
 * Sin sala en store: si hay sesión para este código, espera al rejoin;
 * si no, redirige a / (D1).
 */
export default function RoomPage({ onBackToHome }: RoomPageProps) {
  const { code } = useParams()
  const { room, currentPlayer, votingResults } = useGameStore()
  const { t } = useI18n()
  const toastedRef = useRef(false)

  const missing = !room || !currentPlayer || room.code !== code
  const session = missing ? loadSession() : null
  const waitingRejoin = !!missing && !!session && session.code === code

  // D1: redirección con aviso (el caso con sesión fallida ya toastea vía ROOM_NOT_FOUND).
  useEffect(() => {
    if (missing && !waitingRejoin && !toastedRef.current) {
      toastedRef.current = true
      notify.error(t.errors.roomNotFound)
    }
  }, [missing, waitingRejoin, t])

  if (!room || !currentPlayer || room.code !== code) {
    if (waitingRejoin) {
      return (
        <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center'>
          <div className='text-white text-xl' role='status'>
            {t.app.loading}
          </div>
        </div>
      )
    }
    return <Navigate to='/' replace />
  }

  const screen = getScreen(room, currentPlayer, votingResults)
  const isHost = currentPlayer.id === room.hostId

  if (screen === 'lobby') {
    return <Lobby room={room} currentPlayer={currentPlayer} isHost={isHost} />
  }

  if (screen === 'characterReveal') {
    return <CharacterReveal room={room} currentPlayer={currentPlayer} />
  }

  if (screen === 'discussion') {
    return (
      <Discussion room={room} currentPlayer={currentPlayer} isHost={isHost} />
    )
  }

  if (screen === 'voting') {
    return <Voting room={room} currentPlayer={currentPlayer} isHost={isHost} />
  }

  if (screen === 'results' && votingResults) {
    return (
      <Results
        results={votingResults}
        currentPlayer={currentPlayer}
        isHost={isHost}
        onBackToHome={onBackToHome}
      />
    )
  }

  if (screen === 'gameOver') {
    return (
      <GameOver
        room={room}
        currentPlayer={currentPlayer}
        onBackToHome={onBackToHome}
      />
    )
  }

  // 'home' es inalcanzable aquí (sin room/player ya redirigimos arriba).
  return <Navigate to='/' replace />
}
