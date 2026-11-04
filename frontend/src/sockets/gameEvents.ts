import { socketService } from './socket'
import { useGameStore } from '../store/useGameStore'
import { clearSession, loadSession } from './session'
import type { Room, VotingResults } from '../store/useGameStore'

export const setupGameEvents = () => {
  const socket = socketService.getSocket()
  const { setRoom, setCurrentPlayer, setVotingResults } =
    useGameStore.getState()

  // P0-T2: rol privado por canal directo (el broadcast es público, sin isLiar).
  socket.on('yourPlayerUpdated', (player) => {
    setCurrentPlayer(player)
  })

  // P3: estado de conexión para el banner offline (no bloquea el juego).
  socket.on('connect', () => {
    useGameStore.getState().setConnected(true)
  })
  socket.on('disconnect', () => {
    useGameStore.getState().setConnected(false)
  })

  // P1-B1: rejoin en cada (re)conexión: cubre F5 (montaje) y caídas breves
  // de socket sin recargar (nuevo socket.id sin binding ni join en servidor).
  // Idempotente: reutiliza el asiento, no duplica Player.
  socket.on('connect', () => {
    const session = loadSession()
    if (!session) return
    rejoinRoom(session.code, session.playerId, session.secret)
      .then((response) => {
        const st = useGameStore.getState()
        st.setRoom(response.room)
        st.setCurrentPlayer(response.player)
      })
      .catch(() => {
        // Sala/asiento desaparecidos (o secreto inválido): volver al inicio.
        clearSession()
        // Provoca re-render para que RoomPage redirija a / (App lo toastea).
        useGameStore.getState().setError('ROOM_NOT_FOUND')
      })
  })

  // P1-B3: la sala desapareció (último jugador salió / limpieza).
  socket.on('roomClosed', ({ roomId }: { roomId: string }) => {
    const { room, reset } = useGameStore.getState()
    if (room && room.id === roomId) {
      clearSession()
      reset()
    }
  })

  // Evento cuando la sala se actualiza (nuevo jugador, etc.)
  socket.on('roomUpdated', (room: Room) => {
    console.log('Room updated:', room)
    setRoom(room)
  })

  // Evento cuando el juego empieza
  socket.on('gameStarted', (room: Room) => {
    console.log('Game started:', room)
    setRoom(room)
  })

  // Evento cuando un jugador revela su personaje
  socket.on('playerRevealed', ({ room }: { room: Room }) => {
    console.log('Player revealed:', room)
    setRoom(room)
  })

  // Evento cuando un jugador marca que está listo
  socket.on('playerReady', ({ room }: { room: Room }) => {
    console.log('🎯 playerReady event received:', room)
    console.log(
      '🎯 Players ready status:',
      room.players.map((p) => ({ name: p.name, isReady: p.isReady }))
    )
    setRoom(room)
  })

  // Evento cuando comienza la votación
  socket.on('votingStarted', (room: Room) => {
    console.log('Voting started:', room)
    setRoom(room)
  })

  // Evento cuando alguien envía un voto
  socket.on('voteSubmitted', ({ room }: { room: Room }) => {
    console.log('Vote submitted:', room)
    setRoom(room)
  })

  // Evento cuando se procesan los resultados de la votación
  socket.on('votingResults', (results: VotingResults) => {
    console.log('Voting results:', results)
    setVotingResults(results)
    setRoom(results.room)
  })

  // Evento cuando el juego continúa después de una eliminación
  socket.on('gameContinued', (room: Room) => {
    console.log('Game continued:', room)
    setVotingResults(null)
    setRoom(room)
  })
}

export const cleanupGameEvents = () => {
  const socket = socketService.getSocket()
  socket.off('connect')
  socket.off('yourPlayerUpdated')
  socket.off('roomClosed')
  socket.off('roomUpdated')
  socket.off('gameStarted')
  socket.off('playerRevealed')
  socket.off('playerReady')
  socket.off('votingStarted')
  socket.off('voteSubmitted')
  socket.off('votingResults')
  socket.off('gameContinued')
}

// Funciones para emitir eventos
export const createRoom = (
  categoryId: string,
  hostName: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('createRoom', { categoryId, hostName }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const joinRoom = (code: string, playerName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('joinRoom', { code, playerName }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

// P1-B1: reentrada con el mismo asiento (no crea Player nuevo).
// P2-T4: exige el secreto del asiento.
export const rejoinRoom = (
  code: string,
  playerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('rejoinRoom', { code, playerId, secret }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const startGame = (
  roomId: string,
  requesterPlayerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'startGame',
      { roomId, requesterPlayerId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const revealCharacter = (
  playerId: string,
  roomId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'revealCharacter',
      { playerId, roomId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const setPlayerReady = (
  playerId: string,
  roomId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'setPlayerReady',
      { playerId, roomId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const startVoting = (
  roomId: string,
  requesterPlayerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'startVoting',
      { roomId, requesterPlayerId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const submitVote = (
  roomId: string,
  voterId: string,
  votedForId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'submitVote',
      { roomId, voterId, votedForId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const processVoting = (
  roomId: string,
  requesterPlayerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'processVoting',
      { roomId, requesterPlayerId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const continueGame = (
  roomId: string,
  requesterPlayerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'continueGame',
      { roomId, requesterPlayerId, secret },
      (response: any) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      }
    )
  })
}

export const leaveRoom = (
  roomId: string,
  playerId: string,
  secret: string
): Promise<any> => {
  return new Promise((resolve) => {
    const socket = socketService.getSocket()
    socket.emit('leaveRoom', { roomId, playerId, secret }, (response: any) => {
      resolve(response)
    })
  })
}
