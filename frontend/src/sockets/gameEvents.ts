import { socketService } from './socket'
import { useGameStore } from '../store/useGameStore'
import type { Room, VotingResults } from '../store/useGameStore'

export const setupGameEvents = () => {
  const socket = socketService.getSocket()
  const { setRoom, updatePlayers, setVotingResults } = useGameStore.getState()

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

export const startGame = (roomId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('startGame', { roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const revealCharacter = (
  playerId: string,
  roomId: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('revealCharacter', { playerId, roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const setPlayerReady = (
  playerId: string,
  roomId: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('setPlayerReady', { playerId, roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const startVoting = (roomId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('startVoting', { roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const submitVote = (
  roomId: string,
  voterId: string,
  votedForId: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit(
      'submitVote',
      { roomId, voterId, votedForId },
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

export const processVoting = (roomId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('processVoting', { roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const continueGame = (roomId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket()
    socket.emit('continueGame', { roomId }, (response: any) => {
      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error))
      }
    })
  })
}

export const leaveRoom = (roomId: string): Promise<any> => {
  return new Promise((resolve) => {
    const socket = socketService.getSocket()
    socket.emit('leaveRoom', { roomId }, (response: any) => {
      resolve(response)
    })
  })
}
