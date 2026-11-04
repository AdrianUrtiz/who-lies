import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Home from './components/Home'
import RoomPage from './pages/RoomPage'
import { useGameStore } from './store/useGameStore'
import { socketService } from './sockets/socket'
import {
  setupGameEvents,
  cleanupGameEvents,
  createRoom,
  joinRoom,
  leaveRoom,
} from './sockets/gameEvents'
import { saveSession, clearSession } from './sockets/session'
import { notify } from './ui/toast'
import { useI18n } from './i18n'

function App() {
  const {
    loading,
    error,
    connected,
    setRoom,
    setCurrentPlayer,
    setLoading,
    setError,
    reset,
  } = useGameStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    // Conectar al servidor Socket.IO
    socketService.connect()

    // Configurar eventos de Socket.IO.
    // P1-B1: el rejoin vive en el handler 'connect' de setupGameEvents:
    // cubre F5 (montaje) y reconexiones sin recargar con el mismo código.
    setupGameEvents()

    return () => {
      cleanupGameEvents()
      socketService.disconnect()
    }
  }, [])

  // P3-D3: errores como toast, nunca secuestran la pantalla.
  useEffect(() => {
    if (error) {
      notify.error(error === 'ROOM_NOT_FOUND' ? t.errors.roomNotFound : error)
      setError(null)
    }
  }, [error, setError, t])

  const handleCreateGame = async (categoryId: string, hostName: string) => {
    setLoading(true)

    try {
      const response = await createRoom(categoryId, hostName)

      setRoom(response.room)
      setCurrentPlayer(response.player)
      // P1-B1: persistir asiento para rejoin tras F5 (P2: incluye secreto).
      saveSession({
        roomId: response.room.id,
        playerId: response.player.id,
        code: response.room.code,
        secret: response.player.secret,
      })
      // P3-T1: deep-link a la sala.
      navigate(`/room/${response.room.code}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t.errors.createGame)
      console.error('Error creating game:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGame = async (code: string, playerName: string) => {
    setLoading(true)

    try {
      const response = await joinRoom(code, playerName)
      setRoom(response.room)
      setCurrentPlayer(response.player)
      saveSession({
        roomId: response.room.id,
        playerId: response.player.id,
        code: response.room.code,
        secret: response.player.secret,
      })
      // P3-T1: deep-link a la sala.
      navigate(`/room/${response.room.code}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t.errors.joinGame)
      console.error('Error joining game:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBackToHome = () => {
    // P1-B3: liberar el asiento en el servidor (best effort) y limpiar sesión.
    const { room: r, currentPlayer: p } = useGameStore.getState()
    if (r && p) {
      leaveRoom(r.id, p.id, p.secret).catch(() => undefined)
      clearSession()
    }
    reset()
    navigate('/')
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center'>
        <div className='text-white text-xl' role='status'>
          {t.app.loading}
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position='top-center' richColors />
      {!connected && (
        <div
          role='status'
          className='fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-slate-900 text-center text-sm font-semibold py-2'
        >
          {t.app.reconnecting}
        </div>
      )}
      <Routes>
        <Route
          path='/'
          element={
            <Home onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
          }
        />
        <Route
          path='/room/:code'
          element={<RoomPage onBackToHome={handleBackToHome} />}
        />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </>
  )
}

export default App
